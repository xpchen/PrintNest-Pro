import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // 文件对话框
  openFiles: () => ipcRenderer.invoke('dialog:openFiles'),
  openExcelFile: () => ipcRenderer.invoke('dialog:openExcel'),
  saveFile: (defaultName: string, filterName: string, extensions: string[]) =>
    ipcRenderer.invoke('dialog:saveFile', defaultName, filterName, extensions),

  // 素材文件管理
  importAssets: (projectId: string, srcPaths: string[]) =>
    ipcRenderer.invoke('file:importAssets', projectId, srcPaths),
  saveProject: (projectId: string, data: object) =>
    ipcRenderer.invoke('file:saveProject', projectId, data),
  autoSaveProject: (projectId: string, data: object) =>
    ipcRenderer.invoke('file:autoSaveProject', projectId, data),
  loadProject: (projectId: string) =>
    ipcRenderer.invoke('file:loadProject', projectId),
  listProjects: () =>
    ipcRenderer.invoke('file:listProjects'),
  deleteProject: (projectId: string) =>
    ipcRenderer.invoke('file:deleteProject', projectId),
  readAsBase64: (filePath: string) =>
    ipcRenderer.invoke('file:readAsBase64', filePath),
  parseExcelImport: (filePath: string) =>
    ipcRenderer.invoke('file:parseExcelImport', filePath),

  // PDF 导出
  exportPdf: (options: object) =>
    ipcRenderer.invoke('pdf:export', options),
  isPdfAvailable: () =>
    ipcRenderer.invoke('pdf:isAvailable'),

  runLayoutJob: (payload: object) => ipcRenderer.invoke('layout:run', payload),
});
