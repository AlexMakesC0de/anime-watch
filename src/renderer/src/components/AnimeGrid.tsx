import type { AniListAnime } from '@/types'
import AnimeCard from './AnimeCard'

interface AnimeGridProps {
  anime: AniListAnime[]
  title?: string
  loading?: boolean
  emptyMessage?: string
}

export default function AnimeGrid({
  anime,
  title,
  loading = false,
  emptyMessage = 'No anime found'
}: AnimeGridProps): JSX.Element {
  if (loading) {
    return (
      <div>
        {title && <h2 className="text-xl font-bold text-white mb-4">{title}</h2>}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[3/4] bg-dark-800 rounded-lg" />
              <div className="mt-2 h-4 bg-dark-800 rounded w-3/4" />
              <div className="mt-1 h-3 bg-dark-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (anime.length === 0) {
    return (
      <div>
        {title && <h2 className="text-xl font-bold text-white mb-4">{title}</h2>}
        <div className="text-center py-16 text-dark-500">
          <p className="text-lg">{emptyMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {title && <h2 className="text-xl font-bold text-white mb-4">{title}</h2>}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {anime.map((a) => (
          <AnimeCard key={a.id} anime={a} />
        ))}
      </div>
    </div>
  )
}
