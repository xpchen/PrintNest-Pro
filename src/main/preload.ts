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
  createProject: (projectId: string, initPayload?: object) =>
    ipcRenderer.invoke('file:createProject', projectId, initPayload),
  duplicateProject: (srcId: string, destId: string) =>
    ipcRenderer.invoke('file:duplicateProject', srcId, destId),
  saveProject: (projectId: string, data: object) =>
    ipcRenderer.invoke('file:saveProject', projectId, data),
  autoSaveProject: (projectId: string, data: object) =>
    ipcRenderer.invoke('file:autoSaveProject', projectId, data),
  loadProject: (projectId: string) =>
    ipcRenderer.invoke('file:loadProject', projectId),
  listProjects: () =>
    ipcRenderer.invoke('file:listProjects'),
  listProjectSummaries: () => ipcRenderer.invoke('file:listProjectSummaries'),
  deleteProject: (projectId: string) =>
    ipcRenderer.invoke('file:deleteProject', projectId),
  readAsBase64: (filePath: string) =>
    ipcRenderer.invoke('file:readAsBase64', filePath),
  listProjectAssets: (projectId: string) =>
    ipcRenderer.invoke('file:listProjectAssets', projectId),
  readAssetThumbnailBase64: (projectId: string, assetId: string) =>
    ipcRenderer.invoke('file:readAssetThumbnailBase64', projectId, assetId),
  parseExcelImport: (filePath: string) =>
    ipcRenderer.invoke('file:parseExcelImport', filePath),
  readExcelSheets: (filePath: string) =>
    ipcRenderer.invoke('file:readExcelSheets', filePath),
  mapTableToImportRows: (table: object, config: object) =>
    ipcRenderer.invoke('file:mapTableToImportRows', table, config),

  // 预览快照缓存
  savePreviewSnapshots: (projectId: string, previews: { id: string; base64: string }[]) =>
    ipcRenderer.invoke('snapshot:savePreviews', projectId, previews),
  loadPreviewSnapshots: (projectId: string, instanceIds: string[]) =>
    ipcRenderer.invoke('snapshot:loadPreviews', projectId, instanceIds),
  clearPreviewSnapshots: (projectId: string) =>
    ipcRenderer.invoke('snapshot:clearPreviews', projectId),

  // PDF 导出
  exportPdf: (options: object) =>
    ipcRenderer.invoke('pdf:export', options),
  exportPdfHistoricalRun: (options: object) =>
    ipcRenderer.invoke('pdf:exportHistoricalRun', options),
  isPdfAvailable: () =>
    ipcRenderer.invoke('pdf:isAvailable'),

  runLayoutJob: (payload: object) => ipcRenderer.invoke('layout:run', payload),
  cancelLayoutJob: () => ipcRenderer.invoke('layout:cancel'),
  listLayoutRuns: (projectId: string) => ipcRenderer.invoke('layout:listRuns', projectId),
  getRunRestorePayload: (projectId: string, runId: string, items: unknown[]) =>
    ipcRenderer.invoke('layout:getRunRestorePayload', projectId, runId, items),
  onLayoutProgress: (cb: (p: { phase: string; pct: number }) => void) => {
    const handler = (_e: unknown, data: { phase: string; pct: number }) => cb(data);
    ipcRenderer.on('layout:progress', handler);
    return () => ipcRenderer.removeListener('layout:progress', handler);
  },

  onAppCommand: (cb: (payload: { id: string; payload?: unknown }) => void) => {
    const handler = (_e: unknown, data: { id: string; payload?: unknown }) => cb(data);
    ipcRenderer.on('app:command', handler);
    return () => ipcRenderer.removeListener('app:command', handler);
  },

  openProjectFolder: (projectId: string) => ipcRenderer.invoke('shell:openProjectFolder', projectId),

  // 导出管理
  listExportProfiles: (projectId: string) =>
    ipcRenderer.invoke('export:listProfiles', projectId),
  saveExportProfile: (projectId: string, profile: object) =>
    ipcRenderer.invoke('export:saveProfile', projectId, profile),
  deleteExportProfile: (projectId: string, profileId: string) =>
    ipcRenderer.invoke('export:deleteProfile', projectId, profileId),
  listExportHistory: (projectId: string, limit?: number) =>
    ipcRenderer.invoke('export:listHistory', projectId, limit),
  recordExportHistory: (projectId: string, entry: object) =>
    ipcRenderer.invoke('export:recordHistory', projectId, entry),

  // 日志
  logError: (...args: unknown[]) => ipcRenderer.invoke('log:error', ...args),
  logWarn: (...args: unknown[]) => ipcRenderer.invoke('log:warn', ...args),
});
