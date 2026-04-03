import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import * as path from 'path';
import { registerFileManagerIPC } from './fileManager';
import { registerPdfExportIPC } from './pdfExport';
import { registerExcelImportIPC } from './excelImport';
import { registerLayoutIpc } from './layoutIpc';
import { registerExportManagerIPC } from './exportManager';
import { createApplicationMenu } from './appMenu';
import { getProjectDirectory } from './projectPaths';
import { log } from '../shared/logger';

/* ── 全局异常捕获 ── */
process.on('uncaughtException', (err) => {
  log.app.error('uncaughtException', err);
});
process.on('unhandledRejection', (reason) => {
  log.app.error('unhandledRejection', reason);
});

let mainWindow: BrowserWindow | null = null;

function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

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
  const isDev = !app.isPackaged;
  if (isDev) {
    // Try common Vite dev server ports
    const tryLoadDev = async () => {
      for (const port of [5173, 5174, 5175]) {
        try {
          await mainWindow!.loadURL(`http://localhost:${port}`);
          return true;
        } catch {
          continue;
        }
      }
      return false;
    };
    tryLoadDev().then((ok) => {
      if (!ok) mainWindow!.loadFile(path.join(__dirname, '../renderer/index.html'));
    });
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  createApplicationMenu(getMainWindow);
}

// IPC: Open file dialog for importing assets
ipcMain.handle('dialog:openFiles', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'tiff', 'svg', 'webp'] },
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

ipcMain.handle('dialog:openExcel', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }],
  });
  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle('shell:openProjectFolder', async (_e, projectId: string) => {
  if (!projectId) return false;
  const dir = getProjectDirectory(projectId);
  const err = await shell.openPath(dir);
  return err === '';
});

// 渲染进程日志 IPC（供 renderer 通过 preload 调用）
ipcMain.handle('log:error', (_e, ...args: unknown[]) => {
  log.app.error('[renderer]', ...args);
});
ipcMain.handle('log:warn', (_e, ...args: unknown[]) => {
  log.app.warn('[renderer]', ...args);
});

// Register file manager & PDF export IPC handlers
registerFileManagerIPC();
registerPdfExportIPC();
registerExcelImportIPC();
registerLayoutIpc();
registerExportManagerIPC();

app.whenReady().then(() => {
  log.app.info('app ready, creating window');
  createWindow();
});

app.on('render-process-gone', (_event, _wc, details) => {
  log.app.error('renderer process gone', details);
});

app.on('before-quit', () => {
  log.app.info('app quitting');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
    createApplicationMenu(getMainWindow);
  }
});
