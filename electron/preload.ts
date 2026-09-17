import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  openIFCDialog: () => ipcRenderer.invoke('dialog:openIFC'),
  saveFileDialog: (options: { defaultName: string; buffer: ArrayBuffer | Uint8Array; filters?: any[] }) =>
    ipcRenderer.invoke('dialog:saveFile', options)
});

declare global {
  interface Window {
    electronAPI?: {
      openIFCDialog: () => Promise<{ filePath: string; fileName: string; fileSize: number; buffer: ArrayBuffer } | null>;
      saveFileDialog: (options: { defaultName: string; buffer: ArrayBuffer | Uint8Array; filters?: any[] }) => Promise<boolean>;
    };
  }
}
