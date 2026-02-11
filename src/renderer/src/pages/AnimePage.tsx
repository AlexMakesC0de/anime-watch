import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Play,
  Star,
  Calendar,
  Film,
  Clock,
  ArrowLeft,
  ExternalLink,
  CheckCircle2
} from 'lucide-react'
import StatusSelector from '@/components/StatusSelector'
import { getAnimeDetails, stripHtml } from '@/services/anilist'
import type { AniListAnime, LocalAnime, WatchStatus, EpisodeProgress } from '@/types'

export default function AnimePage(): JSX.Element {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isMac = navigator.userAgent.includes('Macintosh')
  const [anime, setAnime] = useState<AniListAnime | null>(null)
  const [localAnime, setLocalAnime] = useState<LocalAnime | null>(null)
  const [episodeProgress, setEpisodeProgress] = useState<EpisodeProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [descExpanded, setDescExpanded] = useState(false)

  const anilistId = id ? parseInt(id) : 0

  useEffect(() => {
    if (id) loadAnime(parseInt(id))
  }, [id])

  async function loadAnime(anilistId: number): Promise<void> {
    setLoading(true)
    try {
      const [details, local, progress] = await Promise.all([
        getAnimeDetails(anilistId),
        window.api.getAnime(anilistId) as Promise<LocalAnime | null>,
        window.api.getProgress(anilistId) as Promise<EpisodeProgress[]>
      ])
      setAnime(details)
      setLocalAnime(local)
      setEpisodeProgress(progress)
    } catch (error) {
      console.error('Failed to load anime:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleStatusChange(status: WatchStatus): Promise<void> {
    if (!anime) return

    if (localAnime) {
      await window.api.updateStatus(anime.id, status)
    } else {
      await window.api.addAnime({
        anilistId: anime.id,
        title: anime.title.romaji,
        titleEnglish: anime.title.english,
        coverImage: anime.coverImage.extraLarge || anime.coverImage.large,
        bannerImage: anime.bannerImage,
        description: stripHtml(anime.description),
        episodesTotal: anime.episodes,
        status,
        format: anime.format,
        genres: JSON.stringify(anime.genres),
        season: anime.season,
        seasonYear: anime.seasonYear,
        score: anime.averageScore ? anime.averageScore / 10 : null
      })
    }
    const updated = (await window.api.getAnime(anime.id)) as LocalAnime
    setLocalAnime(updated)
  }

  async function handleRemove(): Promise<void> {
    if (!anime) return
    await window.api.removeAnime(anime.id)
    setLocalAnime(null)
  }

  async function handleToggleEpisodeWatched(ep: number): Promise<void> {
    const current = getEpisodeStatus(ep)
    const newCompleted = current !== 'completed'
    await window.api.toggleEpisodeCompleted(anilistId, ep, newCompleted)
    // Refresh progress
    const progress = await window.api.getProgress(anilistId) as EpisodeProgress[]
    setEpisodeProgress(progress)
  }

  const getEpisodeStatus = (ep: number): 'completed' | 'in-progress' | 'unwatched' => {
    const progress = episodeProgress.find((p) => p.episode_number === ep)
    if (!progress) return 'unwatched'
    if (progress.completed) return 'completed'
    return 'in-progress'
  }

  const getEpisodeProgressPct = (ep: number): number => {
    const progress = episodeProgress.find((p) => p.episode_number === ep)
    if (!progress || !progress.total_seconds) return 0
    return (progress.watched_seconds / progress.total_seconds) * 100
  }

  if (loading) {
    return (
      <div className="animate-pulse p-6">
        <div className="h-56 bg-dark-800 rounded-lg mb-6" />
        <div className="flex gap-6">
          <div className="w-48 h-72 bg-dark-800 rounded-lg shrink-0" />
          <div className="flex-1 space-y-3">
            <div className="h-8 bg-dark-800 rounded w-2/3" />
            <div className="h-4 bg-dark-800 rounded w-1/3" />
            <div className="h-20 bg-dark-800 rounded" />
          </div>
        </div>
      </div>
    )
  }

  if (!anime) {
    return (
      <div className="flex items-center justify-center h-full text-dark-500">
        <p>Anime not found</p>
      </div>
    )
  }

  const title = anime.title.english || anime.title.romaji
  const description = stripHtml(anime.description)
  const studios = anime.studios.nodes.map((s) => s.name).join(', ')
  const totalEpisodes = anime.episodes || 0
  const relatedAnime = anime.relations?.edges?.filter(
    (e) => e.node.type === 'ANIME' && ['SEQUEL', 'PREQUEL', 'SIDE_STORY', 'PARENT'].includes(e.relationType)
  )

  return (
    <div className="relative">
      {/* Banner */}
      <div className="relative h-64 overflow-hidden">
        {anime.bannerImage ? (
          <img
            src={anime.bannerImage}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ backgroundColor: anime.coverImage.color || '#1a1b1e' }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-dark-950/60 to-transparent" />

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className={`absolute top-4 btn-ghost bg-black/40 backdrop-blur-sm ${isMac ? 'left-20' : 'left-4'}`}
        >
          <ArrowLeft size={18} />
          Back
        </button>
      </div>

      {/* Content */}
      <div className="px-6 -mt-32 relative z-10">
        <div className="flex gap-6">
          {/* Cover */}
          <div className="shrink-0">
            <img
              src={anime.coverImage.extraLarge || anime.coverImage.large}
              alt={title}
              className="w-48 h-72 object-cover rounded-lg shadow-2xl"
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 pt-20">
            <h1 className="text-3xl font-bold text-white leading-tight">{title}</h1>
            {anime.title.english && anime.title.romaji !== anime.title.english && (
              <p className="text-dark-400 text-sm mt-1">{anime.title.romaji}</p>
            )}

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-dark-300">
              {anime.averageScore && (
                <span className="flex items-center gap-1 text-yellow-400">
                  <Star size={14} fill="currentColor" />
                  {(anime.averageScore / 10).toFixed(1)}
                </span>
              )}
              {anime.format && (
                <span className="flex items-center gap-1">
                  <Film size={14} />
                  {anime.format.replace('_', ' ')}
                </span>
              )}
              {totalEpisodes > 0 && (
                <span className="flex items-center gap-1">
                  <Clock size={14} />
                  {totalEpisodes} episodes
                </span>
              )}
              {anime.season && anime.seasonYear && (
                <span className="flex items-center gap-1">
                  <Calendar size={14} />
                  {anime.season.charAt(0) + anime.season.slice(1).toLowerCase()}{' '}
                  {anime.seasonYear}
                </span>
              )}
              {studios && <span className="text-dark-400">{studios}</span>}
            </div>

            {/* Genres */}
            <div className="flex flex-wrap gap-2 mt-3">
              {anime.genres.map((g) => (
                <span
                  key={g}
                  className="px-2.5 py-1 bg-dark-800 rounded-full text-xs text-dark-300 font-medium"
                >
                  {g}
                </span>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 mt-5">
              <StatusSelector
                currentStatus={localAnime?.status as WatchStatus || null}
                onStatusChange={handleStatusChange}
                onRemove={handleRemove}
              />
              {totalEpisodes > 0 && (
                <button
                  onClick={() => {
                    // Find the next unwatched episode
                    const nextEp =
                      episodeProgress.length > 0
                        ? Math.max(...episodeProgress.map((p) => p.episode_number)) +
                          (episodeProgress.every((p) => p.completed) ? 1 : 0)
                        : 1
                    const ep = Math.min(nextEp, totalEpisodes)
                    navigate(`/watch/${anime.id}/${ep}`)
                  }}
                  className="btn-primary"
                >
                  <Play size={16} fill="currentColor" />
                  {episodeProgress.length > 0 ? 'Continue Watching' : 'Start Watching'}
                </button>
              )}
            </div>

            {/* Description */}
            {description && (
              <div className="mt-6">
                <p
                  className={`text-sm text-dark-300 leading-relaxed ${
                    !descExpanded ? 'line-clamp-4' : ''
                  }`}
                >
                  {description}
                </p>
                {description.length > 300 && (
                  <button
                    onClick={() => setDescExpanded(!descExpanded)}
                    className="text-accent text-sm mt-1 hover:underline"
                  >
                    {descExpanded ? 'Show less' : 'Read more'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Episodes grid */}
        {totalEpisodes > 0 && (
          <section className="mt-8 pb-8">
            <h2 className="text-lg font-bold text-white mb-4">
              Episodes ({episodeProgress.filter((p) => p.completed).length} / {totalEpisodes}{' '}
              watched)
            </h2>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2">
              {Array.from({ length: totalEpisodes }, (_, i) => i + 1).map((ep) => {
                const status = getEpisodeStatus(ep)
                const progressPct = getEpisodeProgressPct(ep)

                return (
                  <button
                    key={ep}
                    onClick={() => navigate(`/watch/${anime.id}/${ep}`)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      handleToggleEpisodeWatched(ep)
                    }}
                    title="Right-click to toggle watched"
                    className={`relative flex items-center justify-center h-10 rounded-lg text-sm font-medium
                      transition-all hover:scale-105 ${
                        status === 'completed'
                          ? 'bg-accent/20 text-accent border border-accent/30'
                          : status === 'in-progress'
                            ? 'bg-dark-800 text-white border border-accent/20'
                            : 'bg-dark-900 text-dark-400 hover:bg-dark-800 hover:text-white'
                      }`}
                  >
                    {status === 'completed' && (
                      <CheckCircle2 size={12} className="absolute top-0.5 right-0.5 text-accent" />
                    )}
                    {status === 'in-progress' && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-dark-700 rounded-b-lg overflow-hidden">
                        <div
                          className="h-full bg-accent"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    )}
                    {ep}
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* Related anime */}
        {relatedAnime && relatedAnime.length > 0 && (
          <section className="mt-4 pb-8">
            <h2 className="text-lg font-bold text-white mb-4">Related</h2>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {relatedAnime.map((rel) => (
                <div
                  key={rel.node.id}
                  onClick={() => navigate(`/anime/${rel.node.id}`)}
                  className="shrink-0 cursor-pointer group"
                >
                  <div className="w-28 aspect-[3/4] rounded-lg overflow-hidden">
                    <img
                      src={rel.node.coverImage.large}
                      alt={rel.node.title.english || rel.node.title.romaji}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <p className="text-xs text-dark-400 mt-1 w-28 truncate">
                    {rel.relationType.replace('_', ' ')}
                  </p>
                  <p className="text-xs text-white font-medium w-28 truncate">
                    {rel.node.title.english || rel.node.title.romaji}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
