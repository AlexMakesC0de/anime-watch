import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  List,
  Link as LinkIcon,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Trash2
} from 'lucide-react'
import VideoPlayer from '@/components/VideoPlayer'
import EmbedPlayer from '@/components/EmbedPlayer'
import { getAnimeDetails, stripHtml } from '@/services/anilist'
import type { AniListAnime, LocalAnime, EpisodeProgress } from '@/types'

export default function WatchPage(): JSX.Element {
  const { id, episode } = useParams<{ id: string; episode: string }>()
  const navigate = useNavigate()
  const anilistId = parseInt(id || '0')
  const episodeNumber = parseInt(episode || '1')

  const [anime, setAnime] = useState<AniListAnime | null>(null)
  const [localAnime, setLocalAnime] = useState<LocalAnime | null>(null)
  const [episodeProgress, setEpisodeProgress] = useState<EpisodeProgress | null>(null)
  const [videoUrl, setVideoUrl] = useState('')
  const [embedUrl, setEmbedUrl] = useState('')
  const [showEpisodeList, setShowEpisodeList] = useState(false)
  const [allProgress, setAllProgress] = useState<EpisodeProgress[]>([])

  // Provider state
  const [providerLoading, setProviderLoading] = useState(false)
  const [providerError, setProviderError] = useState<string | null>(null)
  const [showManualInput, setShowManualInput] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const fetchingRef = useRef(false)

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
        fetchFromProvider(details)
      }
    } catch (error) {
      console.error('Failed to load watch data:', error)
    }
  }

  // Auto-fetch episode from streaming provider
  async function fetchFromProvider(details: AniListAnime | null = anime): Promise<void> {
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
        episodeNumber
      })

      // If an embed URL is available, use the webview-based player
      if (result.embedUrl) {
        console.log('[WatchPage] Using embed player:', result.embedUrl)
        setEmbedUrl(result.embedUrl)
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
      const completed = duration > 0 && currentTime / duration > 0.9 ? 1 : 0
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
      setTimeout(() => navigate(`/watch/${anilistId}/${episodeNumber + 1}`), 1500)
    }
  }, [anilistId, episodeNumber, videoUrl, anime, navigate])

  const handleSetUrl = (e: React.FormEvent): void => {
    e.preventDefault()
    const url = urlInput.trim()
    if (url) {
      setVideoUrl(url)
      setEmbedUrl('') // Manual URL overrides embed player
      setShowManualInput(false)
      setProviderError(null)
    }
  }

  const totalEpisodes = anime?.episodes || 0
  const title = anime ? anime.title.english || anime.title.romaji : 'Loading...'

  return (
    <div className="flex flex-col h-full bg-dark-950">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-dark-900 border-b border-dark-800 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/anime/${anilistId}`)}
            className="btn-ghost text-sm"
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
          {/* Episode navigation */}
          <button
            onClick={() => navigate(`/watch/${anilistId}/${episodeNumber - 1}`)}
            disabled={episodeNumber <= 1}
            className="btn-ghost text-sm disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} />
            Prev
          </button>
          <button
            onClick={() => setShowEpisodeList(!showEpisodeList)}
            className="btn-ghost text-sm"
          >
            <List size={16} />
            {episodeNumber} / {totalEpisodes || '?'}
          </button>
          <button
            onClick={() => navigate(`/watch/${anilistId}/${episodeNumber + 1}`)}
            disabled={totalEpisodes > 0 && episodeNumber >= totalEpisodes}
            className="btn-ghost text-sm disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Video area */}
        <div className="flex-1 flex flex-col">
          {embedUrl ? (
            <EmbedPlayer
              src={embedUrl}
              title={title}
              episodeNumber={episodeNumber}
              initialTime={episodeProgress?.watched_seconds || 0}
              onProgress={handleProgress}
              onEnded={handleEnded}
              onError={(msg) => setProviderError(msg)}
            />
          ) : (
            <VideoPlayer
              src={videoUrl}
              title={title}
              episodeNumber={episodeNumber}
              initialTime={episodeProgress?.watched_seconds || 0}
              onProgress={handleProgress}
              onEnded={handleEnded}
              onPrevious={episodeNumber > 1 ? () => navigate(`/watch/${anilistId}/${episodeNumber - 1}`) : undefined}
              onNext={
                totalEpisodes > 0 && episodeNumber < totalEpisodes
                  ? () => navigate(`/watch/${anilistId}/${episodeNumber + 1}`)
                  : undefined
              }
              onError={(msg) => setProviderError(msg)}
            />
          )}

          {/* Provider status / source controls */}
          <div className="p-3 bg-dark-900 border-t border-dark-800 space-y-2">
            {providerLoading ? (
              <div className="flex items-center gap-2 text-dark-400 text-sm">
                <Loader2 size={16} className="animate-spin text-accent" />
                <span>Fetching episode from streaming provider...</span>
              </div>
            ) : providerError ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-400 text-sm">
                  <AlertCircle size={16} />
                  <span className="flex-1 truncate">{providerError}</span>
                  <button
                    onClick={() => fetchFromProvider()}
                    className="btn-ghost text-xs flex items-center gap-1"
                  >
                    <RefreshCw size={12} />
                    Retry
                  </button>
                  <button
                    onClick={handleClearCache}
                    className="btn-ghost text-xs flex items-center gap-1"
                    title="Clear cached mapping and re-search"
                  >
                    <Trash2 size={12} />
                    Re-search
                  </button>
                </div>
                {/* Manual fallback */}
                <form onSubmit={handleSetUrl} className="flex gap-2">
                  <div className="relative flex-1">
                    <LinkIcon
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500"
                    />
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="Or paste a direct video URL (.mp4, .m3u8)..."
                      className="input-field pl-10 py-2 text-sm"
                    />
                  </div>
                  <button type="submit" className="btn-primary text-sm">
                    Load
                  </button>
                </form>
              </div>
            ) : videoUrl || embedUrl ? (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 size={16} className="text-green-400" />
                <span className="text-dark-400 flex-1">
                  Playing from streaming provider
                </span>
                <button
                  onClick={() => setShowManualInput(!showManualInput)}
                  className="btn-ghost text-xs"
                >
                  <LinkIcon size={12} />
                  Manual URL
                </button>
                <button
                  onClick={handleClearCache}
                  className="btn-ghost text-xs flex items-center gap-1"
                >
                  <RefreshCw size={12} />
                  Re-fetch
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-dark-500 text-sm">
                <span>No source loaded.</span>
                <button
                  onClick={() => fetchFromProvider()}
                  className="btn-ghost text-xs"
                >
                  Fetch from provider
                </button>
              </div>
            )}

            {/* Manual input (shown on demand when playback is working) */}
            {showManualInput && !providerError && (
              <form onSubmit={handleSetUrl} className="flex gap-2 mt-2">
                <div className="relative flex-1">
                  <LinkIcon
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500"
                  />
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="Paste a direct video URL (.mp4, .m3u8)..."
                    className="input-field pl-10 py-2 text-sm"
                  />
                </div>
                <button type="submit" className="btn-primary text-sm">
                  Load
                </button>
              </form>
            )}
          </div>
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
                    onClick={() => navigate(`/watch/${anilistId}/${ep}`)}
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
