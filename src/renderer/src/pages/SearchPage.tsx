import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, SlidersHorizontal } from 'lucide-react'
import AnimeGrid from '@/components/AnimeGrid'
import { searchAnime, getTrendingAnime } from '@/services/anilist'
import type { AniListAnime } from '@/types'

export default function SearchPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [results, setResults] = useState<AniListAnime[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [defaultAnime, setDefaultAnime] = useState<AniListAnime[]>([])

  useEffect(() => {
    // Load trending as default content
    getTrendingAnime(1, 24).then((res) => setDefaultAnime(res.media))
  }, [])

  // Auto-search when URL params change
  useEffect(() => {
    const q = searchParams.get('q')
    if (q) {
      setQuery(q)
      performSearch(q)
    }
  }, [searchParams])

  const performSearch = useCallback(async (searchQuery: string): Promise<void> => {
    if (!searchQuery.trim()) return

    setLoading(true)
    setHasSearched(true)
    try {
      const data = await searchAnime(searchQuery.trim(), 1, 30)
      setResults(data.media)
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (query.trim()) {
      setSearchParams({ q: query.trim() })
    }
  }

  return (
    <div className="p-6">
      {/* Search bar */}
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto mb-8">
        <div className="relative">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-dark-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for anime by title..."
            className="input-field pl-12 pr-4 py-3 text-lg"
            autoFocus
          />
        </div>
      </form>

      {/* Results */}
      {hasSearched ? (
        <AnimeGrid
          anime={results}
          loading={loading}
          title={`Results for "${searchParams.get('q')}"`}
          emptyMessage="No anime found. Try a different search term."
        />
      ) : (
        <AnimeGrid
          anime={defaultAnime}
          title="Trending Anime"
          loading={defaultAnime.length === 0}
        />
      )}
    </div>
  )
}
