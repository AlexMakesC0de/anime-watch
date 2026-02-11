import * as gogoanime from './gogoanime'
import type { StreamingInfo } from './types'
import {
  getProviderMapping,
  setProviderMapping
} from '../database'

export type { VideoSource, StreamingInfo, ProviderResult } from './types'

export interface FetchEpisodeOpts {
  anilistId: number
  title: string
  titleEnglish: string | null
  episodeNumber: number
}

/**
 * High-level function: Given an AniList anime + episode number,
 * find the streaming sources automatically.
 *
 * 1. Check if we have a cached provider mapping (AniList ID → gogoanime slug)
 * 2. If not, search gogoanime by title and cache the best match
 * 3. Fetch the episode streaming URLs
 */
export async function fetchEpisodeSources(opts: FetchEpisodeOpts): Promise<StreamingInfo> {
  const { anilistId, title, titleEnglish, episodeNumber } = opts

  // 1. Check cached mapping
  let slug = getProviderMapping(anilistId, 'gogoanime')

  // 2. If no mapping, search and cache
  if (!slug) {
    console.log(`[Provider] No cached mapping for AniList ID ${anilistId}, searching...`)

    // Try multiple search strategies
    const searchTerms: string[] = [title]
    if (titleEnglish && titleEnglish !== title) searchTerms.push(titleEnglish)

    let results: Awaited<ReturnType<typeof gogoanime.search>> = []
    let best: ReturnType<typeof gogoanime.findBestMatch> = null

    for (const term of searchTerms) {
      results = await gogoanime.search(term)
      if (results.length > 0) {
        best = gogoanime.findBestMatch(results, title, titleEnglish)
        if (best) break
      }
    }

    // If still nothing, try with a simplified query (remove special chars, season info)
    if (!best) {
      for (const term of searchTerms) {
        const simplified = term
          .replace(/\s*(season|part|cour)\s*\d*/gi, '')
          .replace(/[^a-zA-Z0-9\s]/g, '')
          .replace(/\s+/g, ' ')
          .trim()
        if (simplified && simplified !== term) {
          results = await gogoanime.search(simplified)
          if (results.length > 0) {
            best = gogoanime.findBestMatch(results, title, titleEnglish)
            if (best) break
          }
        }
      }
    }

    if (!best) {
      // Reset the cached domain in case it went stale
      gogoanime.resetDomain()
      throw new Error(
        `Could not find "${titleEnglish || title}" on the streaming provider. ` +
          `Try a different title or use a manual video URL.`
      )
    }

    slug = best.id
    setProviderMapping(anilistId, 'gogoanime', slug)
    console.log(`[Provider] Mapped AniList ${anilistId} → gogoanime/${slug}`)
  }

  // 3. Fetch episode sources
  console.log(`[Provider] Fetching sources: ${slug} episode ${episodeNumber}`)
  return gogoanime.getEpisodeSources(slug, episodeNumber)
}

/**
 * Clear the cached mapping for an anime (e.g. if wrong anime was matched)
 */
export { clearProviderMapping } from '../database'
