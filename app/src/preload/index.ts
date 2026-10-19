import { clipboard, contextBridge, ipcRenderer } from 'electron'

const maximizeListeners = new Set<(event: Electron.IpcRendererEvent, isMaximized: boolean) => void>()

ipcRenderer.on('MAXIMIZE_STATE', (event, isMaximized: boolean) => {
  maximizeListeners.forEach((listener) => listener(event, isMaximized))
})

contextBridge.exposeInMainWorld('kicksynth', {
  preview: (payload: SynthPayload) => ipcRenderer.invoke('KICK_PREVIEW', payload) as Promise<PreviewResponse>,
  trigger: (payload: SynthPayload) => ipcRenderer.invoke('KICK_TRIGGER', payload) as Promise<TriggerResponse>,
  export: (payload: SynthPayload) => ipcRenderer.invoke('KICK_EXPORT', payload) as Promise<ExportResponse>,
  loadSample: (slot: number) => ipcRenderer.invoke('KICK_LOAD_SAMPLE', slot) as Promise<SampleLoadResponse>,
  getState: () => ipcRenderer.invoke('KICK_GET_STATE') as Promise<ServerStateResponse>,
  copyText: async (text: string) => {
    clipboard.writeText(text)
  },
  close: () => ipcRenderer.send('WINDOW_CLOSE'),
  minimize: () => ipcRenderer.send('WINDOW_MINIMIZE'),
  maximize: () => ipcRenderer.send('WINDOW_MAXIMIZE'),
  onMaximizeState: (listener: (event: Electron.IpcRendererEvent, isMaximized: boolean) => void) => {
    maximizeListeners.add(listener)
  },
  offMaximizeState: (listener: (event: Electron.IpcRendererEvent, isMaximized: boolean) => void) => {
    maximizeListeners.delete(listener)
  }
})
