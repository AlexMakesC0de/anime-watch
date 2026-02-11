// ─── Streaming Provider Types ─────────────────────────────────

export interface VideoSource {
  url: string
  quality: string
  isM3U8: boolean
}

export interface StreamingInfo {
  sources: VideoSource[]
  headers?: Record<string, string>
  /** Embed player URL — when set, render in a webview instead of HLS.js */
  embedUrl?: string
}

export type AudioType = 'sub' | 'dub'

export interface ProviderResult {
  id: string
  title: string
  url: string
  image?: string
}
