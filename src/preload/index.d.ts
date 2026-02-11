import { ElectronAPI } from '@electron-toolkit/preload'

interface AnimeWatchAPI {
  addAnime: (anime: Record<string, unknown>) => Promise<unknown>
  getLibrary: (status?: string) => Promise<unknown[]>
  getAnime: (anilistId: number) => Promise<unknown>
  updateStatus: (anilistId: number, status: string) => Promise<unknown>
  removeAnime: (anilistId: number) => Promise<unknown>
  saveProgress: (progress: Record<string, unknown>) => Promise<unknown>
  getProgress: (anilistId: number) => Promise<unknown[]>
  getEpisodeProgress: (anilistId: number, episodeNumber: number) => Promise<unknown>
  getContinueWatching: () => Promise<unknown[]>
  minimizeWindow: () => void
  maximizeWindow: () => void
  closeWindow: () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: AnimeWatchAPI
  }
}
