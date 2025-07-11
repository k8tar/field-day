import { app, BrowserWindow, protocol } from 'electron';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Scheme must be registered before the app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { secure: true, standard: true } }
]);

let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'public/favicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'src/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    }
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    require('electron').shell.openExternal(details.url);
    return { action: 'deny' };
  });

  // HMR for renderer base on electron-vite cli
  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('https://localhost:8080');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built HTML file
    const indexPath = app.isPackaged 
      ? path.join(process.resourcesPath, 'dist/index.html')
      : path.join(__dirname, 'dist/index.html');
    
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
        path.join(__dirname, '../dist/index.html')
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
    require('electron').shell.openExternal(navigationUrl);
  });
});
