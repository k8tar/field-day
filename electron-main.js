import { app, BrowserWindow, protocol, shell, ipcMain, nativeImage } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configure SSL certificate handling BEFORE app is ready
// Ignore SSL certificate errors for local mesh network discovery
app.commandLine.appendSwitch('--ignore-certificate-errors');
app.commandLine.appendSwitch('--ignore-ssl-errors');
app.commandLine.appendSwitch('--ignore-certificate-errors-spki-list');
app.commandLine.appendSwitch('--ignore-certificate-errors-ssl-spki-list');
app.commandLine.appendSwitch('--disable-web-security');
app.commandLine.appendSwitch('--allow-running-insecure-content');
app.commandLine.appendSwitch('--disable-features=VizDisplayCompositor');

console.log('🔧 Electron SSL certificate ignoring configured');

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true } }
]);

// Handle certificate errors for mesh network discovery
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  console.log(`🔍 Certificate error for URL: ${url}`);
  console.log(`🔍 Error: ${error}`);
  
  // For local network IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x), ignore certificate errors
  const isLocalNetwork = /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|127\.|localhost)/i.test(url);
  
  if (isLocalNetwork) {
    console.log(`🔓 Ignoring SSL certificate error for local mesh network: ${url}`);
    // Prevent the default behavior
    event.preventDefault();
    // Trust the certificate
    callback(true);
  } else {
    console.log(`❌ Not ignoring SSL certificate error for external URL: ${url}`);
    // For external URLs, use default behavior
    callback(false);
  }
});

// Handle client certificate selection for mesh network
app.on('select-client-certificate', (event, webContents, url, list, callback) => {
  console.log(`🔐 Client certificate selection for: ${url}`);
  
  // For local network, prevent certificate selection dialog
  const isLocalNetwork = /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|127\.|localhost)/i.test(url);
  
  if (isLocalNetwork) {
    console.log(`🔓 Skipping client certificate selection for local network: ${url}`);
    event.preventDefault();
    callback({});
  }
});

let mainWindow;

// Backend service management
let backendProcess = null;
let isBackendStarting = false;

function resolveWindowIconPath() {
  const devCandidates = [
    path.join(__dirname, 'public', 'app-icon.ico'),
    path.join(__dirname, 'public', 'icon.ico')
  ];
  const packagedCandidates = [
    path.join(process.resourcesPath, 'public', 'app-icon.ico'),
    path.join(process.resourcesPath, 'public', 'icon.ico'),
    path.join(process.resourcesPath, 'app.asar.unpacked', 'public', 'app-icon.ico'),
    path.join(process.resourcesPath, 'app.asar.unpacked', 'public', 'icon.ico')
  ];

  const candidates = app.isPackaged ? packagedCandidates : devCandidates;
  const foundPath = candidates.find((candidate) => fs.existsSync(candidate));

  if (!foundPath) {
    console.warn('⚠️ No window icon file found in expected locations');
    return undefined;
  }

  console.log('🖼️ Using window icon:', foundPath);
  return foundPath;
}

/**
 * Start the Rust backend service
 */
async function startBackendService() {
  if (backendProcess || isBackendStarting) {
    console.log('🔧 Backend service already running or starting');
    return;
  }
  
  isBackendStarting = true;
  console.log('🚀 Starting Rust backend service...');
  
  try {
    // Determine if we're in a packaged app or development
    const isPackaged = app.isPackaged;
    console.log('📦 App is packaged:', isPackaged);
    console.log('📂 __dirname:', __dirname);
    console.log('📂 process.resourcesPath:', process.resourcesPath);
    
    let backendDir, binaryPath;
    
    if (isPackaged) {
      // In packaged app, look for the binary in the resources
      backendDir = path.join(process.resourcesPath, 'backend-service');
      binaryPath = process.platform === 'win32' 
        ? path.join(backendDir, 'target', 'release', 'fieldday-backend.exe')
        : path.join(backendDir, 'target', 'release', 'fieldday-backend');
    } else {
      // In development, use the local backend-service directory
      backendDir = path.join(__dirname, 'backend-service');
      binaryPath = process.platform === 'win32' 
        ? path.join(backendDir, 'target', 'release', 'fieldday-backend.exe')
        : path.join(backendDir, 'target', 'release', 'fieldday-backend');
    }
    
    console.log('🔍 Backend directory:', backendDir);
    console.log('🔍 Binary path:', binaryPath);
    console.log('🔍 Binary exists:', fs.existsSync(binaryPath));
    
    // Check if binary exists, if not try to build it (only in development)
    if (!fs.existsSync(binaryPath)) {
      if (isPackaged) {
        throw new Error('Backend binary not found in packaged app. Please rebuild the application.');
      } else {
        console.log('🔨 Backend binary not found, building...');
        await buildBackendService(backendDir);
      }
    }
    
    // Start the backend service
    backendProcess = spawn(binaryPath, ['--port', '3030', '--discovery-port', '3030', '--verbose'], {
      cwd: backendDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false
    });
    
    backendProcess.stdout.on('data', (data) => {
      console.log(`[BACKEND] ${data.toString().trim()}`);
    });
    
    backendProcess.stderr.on('data', (data) => {
      console.log(`[BACKEND ERROR] ${data.toString().trim()}`);
    });
    
    backendProcess.on('close', (code) => {
      console.log(`🛑 Backend service exited with code ${code}`);
      backendProcess = null;
    });
    
    backendProcess.on('error', (error) => {
      console.error('❌ Failed to start backend service:', error);
      backendProcess = null;
    });
    
    console.log('✅ Backend service started successfully');
    
  } catch (error) {
    console.error('❌ Failed to start backend service:', error);
  } finally {
    isBackendStarting = false;
  }
}

/**
 * Build the Rust backend service
 */
function buildBackendService(backendDir) {
  return new Promise((resolve, reject) => {
    console.log('🔨 Building Rust backend service...');
    
    const buildProcess = spawn('cargo', ['build', '--release'], {
      cwd: backendDir,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    buildProcess.stdout.on('data', (data) => {
      console.log(`[CARGO] ${data.toString().trim()}`);
    });
    
    buildProcess.stderr.on('data', (data) => {
      console.log(`[CARGO ERROR] ${data.toString().trim()}`);
    });
    
    buildProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Backend service built successfully');
        resolve();
      } else {
        console.error(`❌ Backend build failed with code ${code}`);
        reject(new Error(`Build failed with code ${code}`));
      }
    });
    
    buildProcess.on('error', (error) => {
      console.error('❌ Failed to run cargo build:', error);
      reject(error);
    });
  });
}

/**
 * Stop the backend service
 */
function stopBackendService() {
  if (backendProcess) {
    console.log('🛑 Stopping backend service...');
    backendProcess.kill();
    backendProcess = null;
  }
}

function createWindow() {
  // Create the browser window
  const preloadPath = path.join(__dirname, 'src', 'preload.js');
  const windowIconPath = resolveWindowIconPath();
  console.log('Preload script path:', preloadPath);
  console.log('Preload script exists:', fs.existsSync(preloadPath));
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    autoHideMenuBar: true,
    icon: windowIconPath,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Disable web security for local mesh network discovery
      allowRunningInsecureContent: true,
      experimentalFeatures: true
    }
  });

  mainWindow.on('ready-to-show', () => {
    if (windowIconPath && process.platform === 'linux') {
      // Some Linux desktop environments only update the taskbar icon via setIcon.
      mainWindow.setIcon(nativeImage.createFromPath(windowIconPath));
    }
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  // Add console logging listener to capture preload script output
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[RENDERER] ${message}`);
  });

  // Listen for when the page finishes loading
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Page finished loading, checking if preload script worked...');
    
    // Test if preload script APIs are available
    mainWindow.webContents.executeJavaScript(`
      console.log('🧪 Testing preload APIs from main process...');
      console.log('window.Electron:', typeof window.Electron);
      console.log('window.electronFS:', typeof window.electronFS);
      console.log('window.ElectronTest:', typeof window.ElectronTest);
    `).catch(err => {
      console.error('Failed to test preload APIs:', err);
    });
  });

  // HMR for renderer base on electron-vite cli
  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:8080');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built HTML file
    let indexPath;
    
    if (app.isPackaged) {
      // When packaged, files are in the asar or resources directory
      indexPath = path.join(__dirname, 'dist/index.html');
    } else {
      // Development build
      indexPath = path.join(__dirname, 'dist/index.html');
    }
    
    console.log('Loading from:', indexPath);
    console.log('App is packaged:', app.isPackaged);
    console.log('__dirname:', __dirname);
    console.log('process.resourcesPath:', process.resourcesPath);
    
    mainWindow.loadFile(indexPath).catch(err => {
      console.error('Failed to load index.html:', err);
      // Fallback: try different paths
      const fallbackPaths = [
        path.join(__dirname, 'dist/index.html'),
        path.join(process.resourcesPath, 'app/dist/index.html'),
        path.join(__dirname, '../dist/index.html'),
        path.join(process.resourcesPath, 'dist/index.html')
      ];
      
      for (const fallbackPath of fallbackPaths) {
        console.log('Trying fallback path:', fallbackPath);
        try {
          mainWindow.loadFile(fallbackPath);
          break;
        } catch (fallbackErr) {
          console.error('Fallback failed:', fallbackPath, fallbackErr);
        }
      }
    });
    
    // Enable dev tools in development builds for debugging
    if (!app.isPackaged) {
      mainWindow.webContents.openDevTools();
    }
  }
}

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  // Set app user model id for windows
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.k8tar.fieldday');
  }

  // Start the backend service first
  await startBackendService();

  // Setup IPC handlers for file operations
  ipcMain.handle('fs-write', async (event, filePath, data) => {
    try {
      // Use userData directory for writable storage when packaged
      const dataDir = app.isPackaged ? 
        path.join(app.getPath('userData'), 'data') : 
        path.join(__dirname, 'data');
      const fullPath = path.join(dataDir, filePath);
      const dir = path.dirname(fullPath);
      
      console.log('📝 IPC fs-write:', fullPath);
      console.log('📦 App is packaged:', app.isPackaged);
      console.log('📁 Data directory:', dataDir);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log('📁 Created directory:', dir);
      }
      
      fs.writeFileSync(fullPath, data, 'utf8');
      console.log('✅ File written successfully');
      return { success: true };
    } catch (error) {
      console.error('❌ IPC fs-write error:', error);
      throw error;
    }
  });

  ipcMain.handle('fs-read', async (event, filePath) => {
    try {
      // Use userData directory for writable storage when packaged
      const dataDir = app.isPackaged ? 
        path.join(app.getPath('userData'), 'data') : 
        path.join(__dirname, 'data');
      const fullPath = path.join(dataDir, filePath);
      console.log('📖 IPC fs-read:', fullPath);
      console.log('📦 App is packaged:', app.isPackaged);
      console.log('📁 Data directory:', dataDir);
      
      if (fs.existsSync(fullPath)) {
        const data = fs.readFileSync(fullPath, 'utf8');
        console.log('✅ File read successfully, length:', data.length);
        return data;
      } else {
        console.log('⚠️ File does not exist, returning null');
        return null;
      }
    } catch (error) {
      console.error('❌ IPC fs-read error:', error);
      throw error;
    }
  });

  // Give the backend a moment to start before opening the window
  setTimeout(() => {
    createWindow();
  }, 2000);

  app.on('activate', function () {
    // On macOS, re-create a window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  // Stop the backend service when app is closing
  stopBackendService();
  
  if (process.platform !== 'darwin') app.quit();
});

// Ensure backend service is stopped when app quits
app.on('before-quit', () => {
  stopBackendService();
});

// Handle protocol for production builds
app.on('ready', () => {
  if (process.env.NODE_ENV !== 'development') {
    protocol.registerFileProtocol('app', (request, callback) => {
      const url = request.url.substr(6);
      callback({ path: path.normalize(`${__dirname}/dist/${url}`) });
    });
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });
});
