import { AniListAnime, AniListPage } from '@/types'

const ANILIST_API = 'https://graphql.anilist.co'

const ANIME_FRAGMENT = `
  fragment AnimeFields on Media {
    id
    title { romaji english native }
    coverImage { large extraLarge color }
    bannerImage
    description(asHtml: false)
    episodes
    format
    status
    season
    seasonYear
    genres
    averageScore
    popularity
    studios(isMain: true) { nodes { name } }
    nextAiringEpisode { airingAt episode }
  }
`

const ANIME_DETAIL_FRAGMENT = `
  fragment AnimeDetailFields on Media {
    ...AnimeFields
    trailer { id site }
    relations {
      edges {
        relationType(version: 2)
        node {
          id
          title { romaji english }
          coverImage { large }
          format
          type
        }
      }
    }
  }
  ${ANIME_FRAGMENT}
`

async function anilistQuery<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const maxRetries = 3

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const response = await fetch(ANILIST_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables })
    })

    // Handle rate limiting — AniList returns 429 with Retry-After header
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '0', 10)
      const delay = Math.max(retryAfter, attempt) * 1000
      console.warn(`[AniList] Rate limited (429), retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`)
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, delay))
        continue
      }
    }

    if (!response.ok) {
      throw new Error(`AniList API error: ${response.status} ${response.statusText}`)
    }

    const json = await response.json()
    if (json.errors) {
      throw new Error(`AniList query error: ${json.errors[0]?.message}`)
    }

    return json.data
  }

  throw new Error('AniList API: max retries exceeded (rate limited)')
}

// ─── Search ──────────────────────────────────────────────────

export async function searchAnime(
  query: string,
  page = 1,
  perPage = 20
): Promise<AniListPage> {
  const gql = `
    query ($search: String, $page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { total currentPage lastPage hasNextPage }
        media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
          ...AnimeFields
        }
      }
    }
    ${ANIME_FRAGMENT}
  `
  const data = await anilistQuery<{ Page: AniListPage }>(gql, {
    search: query,
    page,
    perPage
  })
  return data.Page
}

// ─── Trending ────────────────────────────────────────────────

export async function getTrendingAnime(page = 1, perPage = 20): Promise<AniListPage> {
  const gql = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { total currentPage lastPage hasNextPage }
        media(type: ANIME, sort: TRENDING_DESC) {
          ...AnimeFields
        }
      }
    }
    ${ANIME_FRAGMENT}
  `
  const data = await anilistQuery<{ Page: AniListPage }>(gql, { page, perPage })
  return data.Page
}

// ─── Popular ─────────────────────────────────────────────────

export async function getPopularAnime(page = 1, perPage = 20): Promise<AniListPage> {
  const gql = `
    query ($page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { total currentPage lastPage hasNextPage }
        media(type: ANIME, sort: POPULARITY_DESC) {
          ...AnimeFields
        }
      }
    }
    ${ANIME_FRAGMENT}
  `
  const data = await anilistQuery<{ Page: AniListPage }>(gql, { page, perPage })
  return data.Page
}

// ─── Current Season ──────────────────────────────────────────

export async function getSeasonAnime(
  season: string,
  year: number,
  page = 1,
  perPage = 20
): Promise<AniListPage> {
  const gql = `
    query ($season: MediaSeason, $seasonYear: Int, $page: Int, $perPage: Int) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { total currentPage lastPage hasNextPage }
        media(type: ANIME, season: $season, seasonYear: $seasonYear, sort: POPULARITY_DESC) {
          ...AnimeFields
        }
      }
    }
    ${ANIME_FRAGMENT}
  `
  const data = await anilistQuery<{ Page: AniListPage }>(gql, { season, seasonYear: year, page, perPage })
  return data.Page
}

// ─── Anime Details ───────────────────────────────────────────

export async function getAnimeDetails(id: number): Promise<AniListAnime> {
  const gql = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        ...AnimeDetailFields
      }
    }
    ${ANIME_DETAIL_FRAGMENT}
  `
  const data = await anilistQuery<{ Media: AniListAnime }>(gql, { id })
  return data.Media
}

// ─── Helpers ─────────────────────────────────────────────────

export function getCurrentSeason(): { season: string; year: number } {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  let season: string
  if (month >= 1 && month <= 3) season = 'WINTER'
  else if (month >= 4 && month <= 6) season = 'SPRING'
  else if (month >= 7 && month <= 9) season = 'SUMMER'
  else season = 'FALL'

  return { season, year }
}

export function stripHtml(html: string | null): string {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
}
