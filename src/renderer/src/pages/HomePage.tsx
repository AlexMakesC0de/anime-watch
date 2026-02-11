import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Play, TrendingUp, Star, Calendar, RefreshCw } from 'lucide-react'
import AnimeGrid from '@/components/AnimeGrid'
import {
  getTrendingAnime,
  getPopularAnime,
  getSeasonAnime,
  getCurrentSeason
} from '@/services/anilist'
import type { AniListAnime, ContinueWatchingItem } from '@/types'

export default function HomePage(): JSX.Element {
  const navigate = useNavigate()
  const [trending, setTrending] = useState<AniListAnime[]>([])
  const [popular, setPopular] = useState<AniListAnime[]>([])
  const [seasonal, setSeasonal] = useState<AniListAnime[]>([])
  const [continueWatching, setContinueWatching] = useState<ContinueWatchingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData(): Promise<void> {
    // Only show loading skeletons on initial load (when no data yet)
    const isInitial = trending.length === 0 && popular.length === 0 && seasonal.length === 0
    if (isInitial) setLoading(true)
    setLoadError(false)

    const { season, year } = getCurrentSeason()

    // Use allSettled so one failure doesn't nuke the rest
    const [trendingRes, popularRes, seasonalRes, continueRes] = await Promise.allSettled([
      getTrendingAnime(1, 12),
      getPopularAnime(1, 12),
      getSeasonAnime(season, year, 1, 12),
      window.api.getContinueWatching()
    ])

    let anyFailed = false

    // Only update state if the fetch succeeded — preserve existing data on failure
    // so the user doesn't lose what's already on screen
    if (trendingRes.status === 'fulfilled') {
      setTrending(trendingRes.value.media)
    } else {
      console.error('Failed to load trending:', trendingRes.reason)
      anyFailed = true
    }

    if (popularRes.status === 'fulfilled') {
      setPopular(popularRes.value.media)
    } else {
      console.error('Failed to load popular:', popularRes.reason)
      anyFailed = true
    }

    if (seasonalRes.status === 'fulfilled') {
      setSeasonal(seasonalRes.value.media)
    } else {
      console.error('Failed to load seasonal:', seasonalRes.reason)
      anyFailed = true
    }

    if (continueRes.status === 'fulfilled') {
      setContinueWatching(continueRes.value as ContinueWatchingItem[])
    } else {
      console.error('Failed to load continue watching:', continueRes.reason)
    }

    // If everything failed and we already have data, keep showing it
    // (don't flash loading skeletons over existing content)

    setLoadError(anyFailed)
    setLoading(false)
  }

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="p-6 space-y-8">
      {/* Error banner with retry */}
      {loadError && !loading && (
        <div className="flex items-center justify-between bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
          <p className="text-red-400 text-sm">Some sections failed to load. Check your internet connection.</p>
          <button onClick={loadData} className="flex items-center gap-1.5 text-sm text-accent hover:text-accent/80 transition-colors">
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      )}

      {/* Continue Watching */}
      {continueWatching.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Play size={20} className="text-accent" />
            <h2 className="text-xl font-bold text-white">Continue Watching</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {continueWatching.map((item) => (
              <div
                key={item.anilist_id}
                onClick={() =>
                  navigate(`/watch/${item.anilist_id}/${item.last_episode}`)
                }
                className="flex items-center gap-3 bg-dark-900 rounded-lg overflow-hidden cursor-pointer
                           hover:bg-dark-800 transition-colors group"
              >
                <img
                  src={item.cover_image || ''}
                  alt={item.title}
                  className="w-16 h-20 object-cover shrink-0"
                />
                <div className="flex-1 min-w-0 pr-3 py-2">
                  <h3 className="text-sm font-medium text-white truncate">{item.title}</h3>
                  <p className="text-xs text-dark-400 mt-0.5">
                    Episode {item.last_episode} · {formatTime(item.watched_seconds)} /{' '}
                    {formatTime(item.total_seconds)}
                  </p>
                  <div className="progress-bar mt-2">
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${(item.watched_seconds / Math.max(item.total_seconds, 1)) * 100}%`
                      }}
                    />
                  </div>
                </div>
                <Play
                  size={20}
                  className="text-accent opacity-0 group-hover:opacity-100 transition-opacity mr-3"
                  fill="currentColor"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Trending */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={20} className="text-accent" />
          <h2 className="text-xl font-bold text-white">Trending Now</h2>
        </div>
        <AnimeGrid anime={trending} loading={loading} />
      </section>

      {/* This Season */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Calendar size={20} className="text-accent" />
          <h2 className="text-xl font-bold text-white">
            {getCurrentSeason().season.charAt(0) + getCurrentSeason().season.slice(1).toLowerCase()}{' '}
            {getCurrentSeason().year}
          </h2>
        </div>
        <AnimeGrid anime={seasonal} loading={loading} />
      </section>

      {/* All-Time Popular */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Star size={20} className="text-accent" />
          <h2 className="text-xl font-bold text-white">All-Time Popular</h2>
        </div>
        <AnimeGrid anime={popular} loading={loading} />
      </section>
    </div>
  )
}
