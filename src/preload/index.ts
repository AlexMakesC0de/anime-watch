import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom API exposed to renderer
const api = {
  // ── Library ────────────────────────────────────
  addAnime: (anime: Record<string, unknown>) => ipcRenderer.invoke('db:add-anime', anime),
  getLibrary: (status?: string) => ipcRenderer.invoke('db:get-library', status),
  getAnime: (anilistId: number) => ipcRenderer.invoke('db:get-anime', anilistId),
  updateStatus: (anilistId: number, status: string) =>
    ipcRenderer.invoke('db:update-status', anilistId, status),
  removeAnime: (anilistId: number) => ipcRenderer.invoke('db:remove-anime', anilistId),

  // ── Watch Progress ─────────────────────────────
  saveProgress: (progress: Record<string, unknown>) =>
    ipcRenderer.invoke('db:save-progress', progress),
  getProgress: (anilistId: number) => ipcRenderer.invoke('db:get-progress', anilistId),
  getEpisodeProgress: (anilistId: number, episodeNumber: number) =>
    ipcRenderer.invoke('db:get-episode-progress', anilistId, episodeNumber),
  getContinueWatching: () => ipcRenderer.invoke('db:get-continue-watching'),

  // ── Streaming Provider ─────────────────────────
  fetchEpisodeSources: (opts: Record<string, unknown>) =>
    ipcRenderer.invoke('provider:fetch-sources', opts),
  clearProviderCache: (anilistId: number) =>
    ipcRenderer.invoke('provider:clear-cache', anilistId),

  // ── Window Controls ────────────────────────────
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  onMaximizedChanged: (callback: (maximized: boolean) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, maximized: boolean): void => callback(maximized)
    ipcRenderer.on('window:maximized-changed', handler)
    return () => ipcRenderer.removeListener('window:maximized-changed', handler)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
