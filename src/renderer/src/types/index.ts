// ─── AniList API Types ────────────────────────────────────────

export interface AniListAnime {
  id: number
  title: {
    romaji: string
    english: string | null
    native: string | null
  }
  coverImage: {
    large: string
    extraLarge: string
    color: string | null
  }
  bannerImage: string | null
  description: string | null
  episodes: number | null
  format: AnimeFormat
  status: AniListStatus
  season: AnimeSeason | null
  seasonYear: number | null
  genres: string[]
  averageScore: number | null
  popularity: number | null
  studios: {
    nodes: { name: string }[]
  }
  nextAiringEpisode: {
    airingAt: number
    episode: number
  } | null
  trailer: {
    id: string
    site: string
  } | null
  relations: {
    edges: {
      relationType: string
      node: {
        id: number
        title: { romaji: string; english: string | null }
        coverImage: { large: string }
        format: AnimeFormat
        type: string
      }
    }[]
  }
}

export type AnimeFormat = 'TV' | 'TV_SHORT' | 'MOVIE' | 'SPECIAL' | 'OVA' | 'ONA' | 'MUSIC'
export type AniListStatus = 'FINISHED' | 'RELEASING' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS'
export type AnimeSeason = 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL'

// ─── Local Types ──────────────────────────────────────────────

export type WatchStatus = 'WATCHING' | 'COMPLETED' | 'PLAN_TO_WATCH' | 'ON_HOLD' | 'DROPPED'

export interface LocalAnime {
  id: number
  anilist_id: number
  title: string
  title_english: string | null
  cover_image: string | null
  banner_image: string | null
  description: string | null
  episodes_total: number | null
  status: WatchStatus
  format: string | null
  genres: string | null
  season: string | null
  season_year: number | null
  score: number | null
  added_at: string
  updated_at: string
}

export interface EpisodeProgress {
  id: number
  anime_id: number
  episode_number: number
  watched_seconds: number
  total_seconds: number
  completed: number // 0 or 1
  video_source: string | null
  watched_at: string
}

export interface ContinueWatchingItem extends LocalAnime {
  last_episode: number
  watched_seconds: number
  total_seconds: number
}

// ─── API response page info ───────────────────────────────────

export interface AniListPage {
  pageInfo: {
    total: number
    currentPage: number
    lastPage: number
    hasNextPage: boolean
  }
  media: AniListAnime[]
}
