import { useNavigate } from 'react-router-dom'
import { Play, Star } from 'lucide-react'
import type { AniListAnime } from '@/types'

interface AnimeCardProps {
  anime: AniListAnime
  showProgress?: {
    watched: number
    total: number
  }
}

export default function AnimeCard({ anime, showProgress }: AnimeCardProps): JSX.Element {
  const navigate = useNavigate()
  const title = anime.title.english || anime.title.romaji

  return (
    <div
      className="anime-card cursor-pointer group"
      onClick={() => navigate(`/anime/${anime.id}`)}
    >
      {/* Cover Image */}
      <div className="relative aspect-[3/4] overflow-hidden">
        <img
          src={anime.coverImage.large}
          alt={title}
          className="w-full h-full object-cover"
          loading="lazy"
        />

        {/* Hover overlay */}
        <div className="anime-card-overlay absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 transition-opacity duration-200 flex items-end p-3">
          <button
            className="btn-primary text-sm w-full justify-center"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/anime/${anime.id}`)
            }}
          >
            <Play size={14} fill="currentColor" />
            Details
          </button>
        </div>

        {/* Format badge */}
        {anime.format && (
          <span className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/70 rounded text-[10px] font-semibold text-dark-200">
            {anime.format.replace('_', ' ')}
          </span>
        )}

        {/* Score */}
        {anime.averageScore && (
          <span className="absolute top-2 right-2 flex items-center gap-0.5 px-1.5 py-0.5 bg-black/70 rounded text-[10px] font-semibold text-yellow-400">
            <Star size={10} fill="currentColor" />
            {(anime.averageScore / 10).toFixed(1)}
          </span>
        )}

        {/* Episode progress bar */}
        {showProgress && (
          <div className="absolute bottom-0 left-0 right-0">
            <div className="progress-bar rounded-none h-0.5">
              <div
                className="progress-bar-fill rounded-none"
                style={{ width: `${(showProgress.watched / Math.max(showProgress.total, 1)) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5">
        <h3 className="text-sm font-medium text-white leading-tight line-clamp-2 mb-1">
          {title}
        </h3>
        <div className="flex items-center gap-2 text-xs text-dark-400">
          {anime.seasonYear && <span>{anime.seasonYear}</span>}
          {anime.episodes && <span>· {anime.episodes} eps</span>}
        </div>
        {anime.genres.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {anime.genres.slice(0, 3).map((g) => (
              <span key={g} className="px-1.5 py-0.5 bg-dark-800 rounded text-[10px] text-dark-400">
                {g}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
