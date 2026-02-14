import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  List,
  Loader2,
  AlertCircle,
  RefreshCw,
  Trash2,
  Minus,
  Square,
  X
} from 'lucide-react'
import VideoPlayer from '@/components/VideoPlayer'
import EmbedPlayer from '@/components/EmbedPlayer'
import { getAnimeDetails, stripHtml } from '@/services/anilist'
import type { AniListAnime, LocalAnime, EpisodeProgress } from '@/types'

type AudioType = 'sub' | 'dub'

function getStoredAudioType(anilistId: number): AudioType {
  try {
    return (localStorage.getItem(`audio-pref-${anilistId}`) as AudioType) || 'sub'
  } catch {
    return 'sub'
  }
}

function storeAudioType(anilistId: number, audioType: AudioType): void {
  try {
    localStorage.setItem(`audio-pref-${anilistId}`, audioType)
  } catch { /* ignore */ }
}

function withAutoplayParams(rawUrl: string): string {
  try {
    const url = new URL(rawUrl)
    url.searchParams.set('autoplay', '1')
    url.searchParams.set('autoPlay', '1')
    url.searchParams.set('mute', '1')
    url.searchParams.set('muted', '1')
    return url.toString()
  } catch {
    return rawUrl
  }
}

export default function WatchPage(): JSX.Element {
  const { id, episode } = useParams<{ id: string; episode: string }>()
  const navigate = useNavigate()
  const anilistId = parseInt(id || '0')
  const episodeNumber = parseInt(episode || '1')
  const isMac = navigator.userAgent.includes('Macintosh')

  const [anime, setAnime] = useState<AniListAnime | null>(null)
  const [localAnime, setLocalAnime] = useState<LocalAnime | null>(null)
  const [episodeProgress, setEpisodeProgress] = useState<EpisodeProgress | null>(null)
  const [videoUrl, setVideoUrl] = useState('')
  const [embedUrl, setEmbedUrl] = useState('')
  const [showEpisodeList, setShowEpisodeList] = useState(false)
  const [allProgress, setAllProgress] = useState<EpisodeProgress[]>([])
  const [audioType, setAudioType] = useState<AudioType>(() => getStoredAudioType(anilistId))
  // Provider state
  const [providerLoading, setProviderLoading] = useState(false)
  const [providerError, setProviderError] = useState<string | null>(null)
  const fetchingRef = useRef(false)
  const pageRef = useRef<HTMLDivElement>(null)

  // ─── Auto-hide controls ────────────────────────────────────
  // The <webview> swallows mouse events, so window-level mousemove won't fire
  // over the video. We use an invisible trigger zone at the top edge (always
  // captures pointer) plus mouseenter/mouseleave on the bar itself.
  const [controlsVisible, setControlsVisible] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const startHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => {
      setControlsVisible(false)
      setShowEpisodeList(false) // Also hide episode list
    }, 2000)
  }, [])

  const handleTriggerEnter = useCallback(() => {
    setControlsVisible(true)
    startHideTimer()
  }, [startHideTimer])

  const handleBarActivity = useCallback(() => {
    setControlsVisible(true)
    startHideTimer()
  }, [startHideTimer])

  // Track fullscreen state
  useEffect(() => {
    const handleFullscreenChange = (): void => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [anilistId, episodeNumber])

  async function loadData(): Promise<void> {
    try {
      const [details, local, progress, all] = await Promise.all([
        getAnimeDetails(anilistId),
        window.api.getAnime(anilistId) as Promise<LocalAnime | null>,
        window.api.getEpisodeProgress(anilistId, episodeNumber) as Promise<EpisodeProgress | null>,
        window.api.getProgress(anilistId) as Promise<EpisodeProgress[]>
      ])
      setAnime(details)
      setLocalAnime(local)
      setEpisodeProgress(progress)
      setAllProgress(all)

      // If we have a saved manual source, use it; otherwise auto-fetch
      if (progress?.video_source) {
        setVideoUrl(progress.video_source)
        setEmbedUrl('')
      } else {
        setVideoUrl('')
        setEmbedUrl('')
        fetchFromProvider(details, audioType)
      }
    } catch (error) {
      console.error('Failed to load watch data:', error)
    }
  }

  // Auto-fetch episode from streaming provider
  async function fetchFromProvider(details: AniListAnime | null = anime, audio: AudioType = audioType): Promise<void> {
    if (!details) return
    // Prevent duplicate concurrent fetches (React StrictMode double-invoke)
    if (fetchingRef.current) return
    fetchingRef.current = true
    setProviderLoading(true)
    setProviderError(null)
    setVideoUrl('')
    setEmbedUrl('')

    try {
      const result = await window.api.fetchEpisodeSources({
        anilistId: details.id,
        title: details.title.romaji || details.title.english || '',
        titleEnglish: details.title.english || null,
        episodeNumber,
        audioType: audio
      })

      // If an embed URL is available, use the webview-based player
      if (result.embedUrl) {
        const embedWithAutoplay = withAutoplayParams(result.embedUrl)
        console.log('[WatchPage] Using embed player:', embedWithAutoplay)
        setEmbedUrl(embedWithAutoplay)
      } else if (result.sources && result.sources.length > 0) {
        // Prefer HLS source, fall back to first available
        const best = result.sources.find((s: { isM3U8: boolean }) => s.isM3U8) || result.sources[0]
        console.log('[WatchPage] Video URL:', best.url)
        setVideoUrl(best.url)
      } else {
        setProviderError('No video sources found for this episode')
      }
    } catch (error) {
      console.error('Provider error:', error)
      setProviderError(error instanceof Error ? error.message : 'Failed to fetch episode')
    } finally {
      setProviderLoading(false)
      fetchingRef.current = false
    }
  }

  async function handleClearCache(): Promise<void> {
    await window.api.clearProviderCache(anilistId)
    fetchFromProvider()
  }

  function handleAudioTypeChange(newType: AudioType): void {
    if (newType === audioType) return
    setAudioType(newType)
    storeAudioType(anilistId, newType)
    // Re-fetch with new audio type (clears current source)
    fetchFromProvider(anime, newType)
  }

  // Auto-add to library as "WATCHING" when user starts watching
  useEffect(() => {
    if (anime && !localAnime) {
      window.api.addAnime({
        anilistId: anime.id,
        title: anime.title.romaji,
        titleEnglish: anime.title.english,
        coverImage: anime.coverImage.extraLarge || anime.coverImage.large,
        bannerImage: anime.bannerImage,
        description: stripHtml(anime.description),
        episodesTotal: anime.episodes,
        status: 'WATCHING',
        format: anime.format,
        genres: JSON.stringify(anime.genres),
        season: anime.season,
        seasonYear: anime.seasonYear,
        score: anime.averageScore ? anime.averageScore / 10 : null
      })
    }
  }, [anime, localAnime])

  const handleProgress = useCallback(
    async (currentTime: number, duration: number) => {
      const completed = duration > 0 && currentTime / duration > 0.85 ? 1 : 0
      await window.api.saveProgress({
        anilistId,
        episodeNumber,
        watchedSeconds: currentTime,
        totalSeconds: duration,
        completed,
        videoSource: videoUrl || null
      })
    },
    [anilistId, episodeNumber, videoUrl]
  )

  const handleEnded = useCallback(async () => {
    await window.api.saveProgress({
      anilistId,
      episodeNumber,
      watchedSeconds: 0,
      totalSeconds: 0,
      completed: 1,
      videoSource: videoUrl || null
    })

    // Auto-advance to next episode after a short delay
    const totalEps = anime?.episodes || 0
    if (episodeNumber < totalEps) {
      setTimeout(() => navigate(`/watch/${anilistId}/${episodeNumber + 1}`, { replace: true }), 1500)
    }
  }, [anilistId, episodeNumber, videoUrl, anime, navigate])

  const handleToggleEpisodeWatched = useCallback(async (ep: number) => {
    const prog = allProgress.find((p) => p.episode_number === ep)
    const newCompleted = !prog?.completed
    await window.api.toggleEpisodeCompleted(anilistId, ep, newCompleted)
    const updated = await window.api.getProgress(anilistId) as EpisodeProgress[]
    setAllProgress(updated)
  }, [anilistId, allProgress])

  const totalEpisodes = anime?.episodes || 0
  const title = anime ? anime.title.english || anime.title.romaji : 'Loading...'

  return (
    <div ref={pageRef} className="flex flex-col h-full bg-dark-950 relative">
      {/* Invisible trigger zone — always captures pointer events at the top edge
          so hovering near the top reveals the bar even over the webview.
          Larger in fullscreen to make it easier to trigger. */}
      <div
        className={`absolute top-0 left-0 right-0 z-40 ${isFullscreen ? 'h-12' : 'h-5'} ${controlsVisible ? 'pointer-events-none' : ''}`}
        onMouseEnter={handleTriggerEnter}
      />

      {/* Top bar — slides in when triggered, hides 2s after mouse leaves */}
      <div
        onMouseEnter={handleBarActivity}
        onMouseMove={handleBarActivity}
        onMouseLeave={handleBarActivity}
        className={`drag-region flex items-center justify-between px-4 py-2 bg-dark-900/90 backdrop-blur-sm border-b border-dark-800 shrink-0 absolute top-0 left-0 right-0 z-30 transition-all duration-300 ${isMac ? 'pl-20' : ''} ${
          controlsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/anime/${anilistId}`, { replace: true })}
            className="no-drag btn-ghost text-sm"
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <div className="h-5 w-px bg-dark-700" />
          <h1 className="text-sm font-medium text-white truncate max-w-md">
            {title}
          </h1>
          <span className="text-accent text-sm font-semibold">EP {episodeNumber}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Sub / Dub toggle */}
          <div className="no-drag flex items-center gap-1 bg-dark-800 rounded-lg p-0.5">
            <button
              onClick={() => handleAudioTypeChange('sub')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                audioType === 'sub'
                  ? 'bg-accent text-white'
                  : 'text-dark-400 hover:text-dark-200'
              }`}
            >
              SUB
            </button>
            <button
              onClick={() => handleAudioTypeChange('dub')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                audioType === 'dub'
                  ? 'bg-accent text-white'
                  : 'text-dark-400 hover:text-dark-200'
              }`}
            >
              DUB
            </button>
          </div>

          <div className="h-5 w-px bg-dark-700" />

          {/* Episode navigation */}
          <button
            onClick={() => navigate(`/watch/${anilistId}/${episodeNumber - 1}`, { replace: true })}
            disabled={episodeNumber <= 1}
            className="no-drag btn-ghost text-sm disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} />
            Prev
          </button>
          <button
            onClick={() => setShowEpisodeList(!showEpisodeList)}
            className="no-drag btn-ghost text-sm"
          >
            <List size={16} />
            {episodeNumber} / {totalEpisodes || '?'}
          </button>
          <button
            onClick={() => navigate(`/watch/${anilistId}/${episodeNumber + 1}`, { replace: true })}
            disabled={totalEpisodes > 0 && episodeNumber >= totalEpisodes}
            className="no-drag btn-ghost text-sm disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight size={16} />
          </button>

          {/* Window controls — only show on non-macOS (macOS has native controls) */}
          {!isMac && (
            <>
              <div className="h-5 w-px bg-dark-700 ml-2" />
              <div className="no-drag flex items-center">
                <button
                  onClick={() => window.api.minimizeWindow()}
                  className="p-2 hover:bg-dark-700 rounded transition-colors"
                  title="Minimize"
                >
                  <Minus size={14} className="text-dark-300" />
                </button>
                <button
                  onClick={() => window.api.maximizeWindow()}
                  className="p-2 hover:bg-dark-700 rounded transition-colors"
                  title="Maximize"
                >
                  <Square size={12} className="text-dark-300" />
                </button>
                <button
                  onClick={() => window.api.closeWindow()}
                  className="p-2 hover:bg-red-500/20 rounded transition-colors"
                  title="Close"
                >
                  <X size={14} className="text-dark-300 hover:text-red-400" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Video area */}
        <div className={`flex-1 flex flex-col relative transition-all duration-300 ${controlsVisible ? 'mt-11' : 'mt-0'}`}>
          {/* Centered loading spinner — shown while fetching episode sources */}
          {providerLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-20 bg-black">
              <div className="flex flex-col items-center gap-4">
                <Loader2 size={40} className="animate-spin text-accent" />
                <p className="text-sm text-dark-400">Loading episode...</p>
              </div>
            </div>
          )}

          {/* Centered error — shown when provider fails */}
          {providerError && !providerLoading && !embedUrl && !videoUrl && (
            <div className="absolute inset-0 flex items-center justify-center z-20 bg-black">
              <div className="flex flex-col items-center gap-4">
                <AlertCircle size={40} className="text-red-400" />
                <p className="text-sm text-red-400 max-w-xs text-center">{providerError}</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => fetchFromProvider()}
                    className="btn-ghost text-sm flex items-center gap-2 text-dark-300 hover:text-white"
                  >
                    <RefreshCw size={14} />
                    Retry
                  </button>
                  <button
                    onClick={handleClearCache}
                    className="btn-ghost text-sm flex items-center gap-2 text-dark-300 hover:text-white"
                  >
                    <Trash2 size={14} />
                    Re-search
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Player — only rendered when we have a source URL */}
          {embedUrl ? (
            <EmbedPlayer
              src={embedUrl}
              title={title}
              episodeNumber={episodeNumber}
              initialTime={episodeProgress?.watched_seconds || 0}
              fullscreenTarget={pageRef}
              disableInteractions={controlsVisible}
              onProgress={handleProgress}
              onEnded={handleEnded}
              onError={(msg) => setProviderError(msg)}
            />
          ) : videoUrl ? (
            <VideoPlayer
              src={videoUrl}
              title={title}
              episodeNumber={episodeNumber}
              initialTime={episodeProgress?.watched_seconds || 0}
              onProgress={handleProgress}
              onEnded={handleEnded}
              onPrevious={episodeNumber > 1 ? () => navigate(`/watch/${anilistId}/${episodeNumber - 1}`, { replace: true }) : undefined}
              onNext={
                totalEpisodes > 0 && episodeNumber < totalEpisodes
                  ? () => navigate(`/watch/${anilistId}/${episodeNumber + 1}`, { replace: true })
                  : undefined
              }
              onError={(msg) => setProviderError(msg)}
            />
          ) : null}
        </div>

        {/* Episode list sidebar */}
        {showEpisodeList && totalEpisodes > 0 && (
          <div className="w-64 bg-dark-900 border-l border-dark-800 overflow-y-auto shrink-0">
            <div className="p-3 border-b border-dark-800">
              <h3 className="text-sm font-semibold text-white">Episodes</h3>
            </div>
            <div className="p-2 space-y-1">
              {Array.from({ length: totalEpisodes }, (_, i) => i + 1).map((ep) => {
                const prog = allProgress.find((p) => p.episode_number === ep)
                const isActive = ep === episodeNumber
                const isCompleted = prog?.completed

                return (
                  <button
                    key={ep}
                    onClick={() => navigate(`/watch/${anilistId}/${ep}`, { replace: true })}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      handleToggleEpisodeWatched(ep)
                    }}
                    title="Right-click to toggle watched"
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-accent/20 text-accent'
                        : isCompleted
                          ? 'text-dark-400 hover:bg-dark-800'
                          : 'text-dark-200 hover:bg-dark-800'
                    }`}
                  >
                    <span
                      className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold shrink-0 ${
                        isActive
                          ? 'bg-accent text-white'
                          : isCompleted
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-dark-700 text-dark-400'
                      }`}
                    >
                      {isCompleted ? '✓' : ep}
                    </span>
                    <span className="truncate">Episode {ep}</span>
                    {prog && !prog.completed && prog.total_seconds > 0 && (
                      <span className="ml-auto text-xs text-dark-500">
                        {Math.round((prog.watched_seconds / prog.total_seconds) * 100)}%
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
