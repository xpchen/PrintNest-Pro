import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: 'PrintNest Pro - 印智排版系统',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Dev mode: load Vite dev server; Production: load built files
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC: Open file dialog for importing assets
ipcMain.handle('dialog:openFiles', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'tiff', 'svg'] },
    ],
  });
  return result.filePaths;
});

// IPC: Save file dialog for exporting
ipcMain.handle('dialog:saveFile', async (_event, defaultName: string, filterName: string, extensions: string[]) => {
  const result = await dialog.showSaveDialog({
    defaultPath: defaultName,
    filters: [{ name: filterName, extensions }],
  });
  return result.filePath;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
