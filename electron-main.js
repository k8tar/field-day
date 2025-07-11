import { app, BrowserWindow, protocol, shell, ipcMain } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true } }
]);

let mainWindow;

function createWindow() {
  // Create the browser window
  const preloadPath = path.join(__dirname, 'src', 'preload.js');
  console.log('Preload script path:', preloadPath);
  console.log('Preload script exists:', fs.existsSync(preloadPath));
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'public', 'favicon.ico'),
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    }
  });

  mainWindow.on('ready-to-show', () => {
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
    mainWindow.loadURL('https://localhost:8080');
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
app.whenReady().then(() => {
  // Set app user model id for windows
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.k8tar.fieldday');
  }

  // Setup IPC handlers for file operations
  ipcMain.handle('fs-write', async (event, filePath, data) => {
    try {
      const fullPath = path.join(__dirname, 'data', filePath);
      const dir = path.dirname(fullPath);
      
      console.log('📝 IPC fs-write:', fullPath);
      
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
      const fullPath = path.join(__dirname, 'data', filePath);
      console.log('📖 IPC fs-read:', fullPath);
      
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

  createWindow();

  app.on('activate', function () {
    // On macOS, re-create a window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
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
