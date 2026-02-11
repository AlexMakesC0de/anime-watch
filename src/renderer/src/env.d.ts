/// <reference types="@electron-toolkit/preload" />

import type { ElectronAPI } from '@electron-toolkit/preload'

interface StreamingSource {
  url: string
  quality: string
  isM3U8: boolean
}

interface StreamingInfo {
  sources: StreamingSource[]
  headers?: Record<string, string>
  embedUrl?: string
}

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
  fetchEpisodeSources: (opts: {
    anilistId: number
    title: string
    titleEnglish: string | null
    episodeNumber: number
  }) => Promise<StreamingInfo>
  clearProviderCache: (anilistId: number) => Promise<void>
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
