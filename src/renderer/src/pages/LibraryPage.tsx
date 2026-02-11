import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Library,
  Play,
  CheckCircle2,
  Bookmark,
  PauseCircle,
  XCircle,
  Trash2,
  MoreVertical
} from 'lucide-react'
import type { LocalAnime, WatchStatus, EpisodeProgress } from '@/types'

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: typeof Play; color: string; bgColor: string }
> = {
  WATCHING: { label: 'Watching', icon: Play, color: 'text-blue-400', bgColor: 'bg-blue-400/10' },
  PLAN_TO_WATCH: {
    label: 'Plan to Watch',
    icon: Bookmark,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400/10'
  },
  COMPLETED: {
    label: 'Completed',
    icon: CheckCircle2,
    color: 'text-green-400',
    bgColor: 'bg-green-400/10'
  },
  ON_HOLD: {
    label: 'On Hold',
    icon: PauseCircle,
    color: 'text-orange-400',
    bgColor: 'bg-orange-400/10'
  },
  DROPPED: { label: 'Dropped', icon: XCircle, color: 'text-red-400', bgColor: 'bg-red-400/10' }
}

export default function LibraryPage(): JSX.Element {
  const { status } = useParams<{ status?: string }>()
  const navigate = useNavigate()
  const [library, setLibrary] = useState<LocalAnime[]>([])
  const [progressMap, setProgressMap] = useState<Record<number, EpisodeProgress[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadLibrary()
  }, [status])

  async function loadLibrary(): Promise<void> {
    setLoading(true)
    try {
      const data = (await window.api.getLibrary(status)) as LocalAnime[]
      setLibrary(data)

      // Load progress for each anime
      const progMap: Record<number, EpisodeProgress[]> = {}
      for (const anime of data) {
        const prog = (await window.api.getProgress(anime.anilist_id)) as EpisodeProgress[]
        progMap[anime.anilist_id] = prog
      }
      setProgressMap(progMap)
    } catch (error) {
      console.error('Failed to load library:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleStatusChange(anilistId: number, newStatus: WatchStatus): Promise<void> {
    await window.api.updateStatus(anilistId, newStatus)
    loadLibrary()
  }

  async function handleRemove(anilistId: number): Promise<void> {
    await window.api.removeAnime(anilistId)
    loadLibrary()
  }

  const getEpisodesWatched = (anilistId: number): number => {
    const progress = progressMap[anilistId] || []
    return progress.filter((p) => p.completed).length
  }

  const pageTitle = status ? STATUS_CONFIG[status]?.label || 'Library' : 'My Library'
  const StatusIcon = status ? STATUS_CONFIG[status]?.icon : Library

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        {StatusIcon && (
          <StatusIcon
            size={24}
            className={status ? STATUS_CONFIG[status]?.color : 'text-accent'}
          />
        )}
        <h1 className="text-2xl font-bold text-white">{pageTitle}</h1>
        <span className="text-dark-500 text-sm">({library.length} anime)</span>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse flex items-center gap-4 bg-dark-900 rounded-lg p-3">
              <div className="w-12 h-16 bg-dark-800 rounded" />
              <div className="flex-1">
                <div className="h-4 bg-dark-800 rounded w-1/3 mb-2" />
                <div className="h-3 bg-dark-800 rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      ) : library.length === 0 ? (
        <div className="text-center py-20 text-dark-500">
          <Library size={48} className="mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">Your library is empty</p>
          <p className="text-sm mt-1">
            Search for anime and add them to your library to start tracking.
          </p>
          <button onClick={() => navigate('/search')} className="btn-primary mt-4 mx-auto">
            Discover Anime
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {library.map((anime) => {
            const statusInfo = STATUS_CONFIG[anime.status]
            const episodesWatched = getEpisodesWatched(anime.anilist_id)

            return (
              <div
                key={anime.anilist_id}
                className="flex items-center gap-4 bg-dark-900 hover:bg-dark-800 rounded-lg p-3
                           transition-colors cursor-pointer group"
                onClick={() => navigate(`/anime/${anime.anilist_id}`)}
              >
                {/* Cover */}
                <img
                  src={anime.cover_image || ''}
                  alt={anime.title}
                  className="w-12 h-16 object-cover rounded shrink-0"
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-white truncate">
                    {anime.title_english || anime.title}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-dark-400 mt-0.5">
                    {anime.format && <span>{anime.format}</span>}
                    {statusInfo && (
                      <span
                        className={`status-badge ${statusInfo.bgColor} ${statusInfo.color}`}
                      >
                        {statusInfo.label}
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress */}
                <div className="text-right shrink-0">
                  <p className="text-sm text-dark-300 font-mono">
                    {episodesWatched} / {anime.episodes_total ?? '?'}
                  </p>
                  {anime.episodes_total && anime.episodes_total > 0 && (
                    <div className="progress-bar w-24 mt-1">
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${(episodesWatched / anime.episodes_total) * 100}%`
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemove(anime.anilist_id)
                    }}
                    className="p-1.5 hover:bg-red-500/20 rounded transition-colors"
                    title="Remove"
                  >
                    <Trash2 size={14} className="text-dark-500 hover:text-red-400" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
