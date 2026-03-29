import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  openFiles: () => ipcRenderer.invoke('dialog:openFiles'),
  saveFile: (defaultName: string, filterName: string, extensions: string[]) =>
    ipcRenderer.invoke('dialog:saveFile', defaultName, filterName, extensions),
});
