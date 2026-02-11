import { BrowserWindow, session } from 'electron'
import type { VideoSource, StreamingInfo, ProviderResult } from './types'
import { toProxyUrl } from '../proxy'

// ─── Configuration ────────────────────────────────────────────
// Gogoanime changes domains regularly. Update these if the site moves.
const DOMAINS = [
  'https://www14.gogoanimes.fi',
  'https://gogoanimes.fi',
  'https://anitaku.pe',
  'https://anitaku.bz',
  'https://anitaku.so',
  'https://gogoanime3.co'
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// ─── HTTP helpers ─────────────────────────────────────────────

async function fetchText(url: string, extraHeaders: Record<string, string> = {}): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, ...extraHeaders },
    redirect: 'follow'
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`)
  return res.text()
}

// ─── HTML parsing helpers ─────────────────────────────────────

function extractAll(html: string, regex: RegExp): string[][] {
  const matches: string[][] = []
  let m: RegExpExecArray | null
  while ((m = regex.exec(html)) !== null) {
    matches.push([...m])
  }
  return matches
}

// ─── Active base URL (we try domains in order) ───────────────

let activeBaseUrl: string | null = null

export function resetDomain(): void {
  activeBaseUrl = null
}

async function getBaseUrl(): Promise<string> {
  if (activeBaseUrl) return activeBaseUrl

  for (const domain of DOMAINS) {
    try {
      const res = await fetch(`${domain}/`, {
        method: 'GET',
        headers: { 'User-Agent': USER_AGENT },
        redirect: 'follow',
        signal: AbortSignal.timeout(8000)
      })
      const finalUrl = res.url
      const text = await res.text()
      if (
        text.includes('gogoanime') ||
        text.includes('Recent Release') ||
        text.includes('anime_name') ||
        text.includes('last_episodes')
      ) {
        const origin = new URL(finalUrl).origin
        activeBaseUrl = origin
        console.log(`[Gogoanime] Using domain: ${origin} (from ${domain})`)
        return origin
      }
    } catch {
      // Try next domain
    }
  }
  activeBaseUrl = DOMAINS[0]
  return activeBaseUrl
}

// ─── Search ───────────────────────────────────────────────────

export async function search(query: string): Promise<ProviderResult[]> {
  const base = await getBaseUrl()
  const url = `${base}/search.html?keyword=${encodeURIComponent(query)}`

  console.log(`[Gogoanime] Searching: ${url}`)
  const html = await fetchText(url)
  const results: ProviderResult[] = []

  const nameRegex = /<p\s+class="name">\s*<a\s+href="\/category\/([^"]+)"[^>]*title="([^"]*)"[^>]*>/g
  const imgRegex = /<div\s+class="img">\s*<a[^>]*>\s*<img\s+src="([^"]*)"[^>]*>/g

  const names = extractAll(html, nameRegex)
  const images = extractAll(html, imgRegex)

  console.log(`[Gogoanime] Found ${names.length} results for "${query}"`)

  for (let i = 0; i < names.length; i++) {
    const [, slug, title] = names[i]
    const image = images[i]?.[1] || undefined

    results.push({
      id: slug,
      title: title || slug,
      url: `${base}/category/${slug}`,
      image
    })
  }

  return results
}

// ─── Episode sources ──────────────────────────────────────────

export async function getEpisodeSources(
  animeSlug: string,
  episodeNumber: number
): Promise<StreamingInfo> {
  const base = await getBaseUrl()
  const episodeUrl = `${base}/${animeSlug}-episode-${episodeNumber}`

  console.log(`[Gogoanime] Fetching episode: ${episodeUrl}`)
  const epHtml = await fetchText(episodeUrl)

  // Extract all data-video attributes (embed URLs for different servers)
  const serverRegex = /data-video="([^"]+)"/g
  const servers = extractAll(epHtml, serverRegex).map((m) => {
    let url = m[1]
    if (url.startsWith('//')) url = 'https:' + url
    return url
  })

  if (servers.length === 0) {
    throw new Error(`No streaming servers found for ${animeSlug} episode ${episodeNumber}`)
  }

  console.log(`[Gogoanime] Found ${servers.length} embed servers`)

  // For each server, first resolve the actual player page (may be an iframe wrapper)
  // then use a hidden BrowserWindow to intercept the m3u8 URL
  let lastError: Error | null = null

  for (const embedUrl of servers) {
    try {
      const sources = await extractViaHiddenWindow(embedUrl, base)
      if (sources.sources.length > 0) {
        return sources
      }
    } catch (err) {
      lastError = err as Error
      console.warn(`[Gogoanime] Server failed (${embedUrl}): ${(err as Error).message}`)
    }
  }

  throw lastError || new Error('Failed to extract video sources from any server')
}

// ─── Hidden BrowserWindow extraction ──────────────────────────
// Instead of trying to reverse-engineer obfuscated player JS,
// we load the embed page in a hidden window and intercept
// network requests to capture the actual video URLs (m3u8/mp4).

async function extractViaHiddenWindow(
  embedUrl: string,
  referer: string
): Promise<StreamingInfo> {
  // First, if this is a wrapper page (like gogoanime.me.uk/newplayer.php),
  // fetch it to find the real player iframe URL
  let playerUrl = embedUrl
  try {
    const html = await fetchText(embedUrl, { Referer: referer })
    const iframeMatch = html.match(/iframe[^>]+src="([^"]+)"/)
    if (iframeMatch) {
      let iframeSrc = iframeMatch[1]
      if (iframeSrc.startsWith('//')) iframeSrc = 'https:' + iframeSrc
      playerUrl = iframeSrc
      console.log(`[Gogoanime] Resolved iframe: ${playerUrl}`)
    }
  } catch {
    // Use the original URL if fetching wrapper fails
  }

  console.log(`[Gogoanime] Extracting via hidden window: ${playerUrl}`)

  return new Promise((resolve, reject) => {
    const capturedUrls: VideoSource[] = []
    let resolved = false

    // Use a persistent partition so Cloudflare cookies are reused across requests
    const partition = 'persist:extractor'

    const win = new BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      webPreferences: {
        partition,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: false
      }
    })

    // Set a timeout — if nothing captured in 25 seconds, give up
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true
        win.destroy()
        if (capturedUrls.length > 0) {
          resolve({ sources: capturedUrls, headers: { Referer: playerUrl }, embedUrl: playerUrl })
        } else {
          reject(new Error(`Timeout: no video URL found from ${embedUrl}`))
        }
      }
    }, 25000)

    // Intercept all network requests from this window to find m3u8/mp4 URLs
    const ses = session.fromPartition(partition)

    ses.webRequest.onBeforeRequest((details, callback) => {
      const url = details.url

      // Capture m3u8 master playlist URLs (skip .ts segment requests and analytics)
      const urlPath = url.split('?')[0] // Ignore query parameters
      if (
        (urlPath.endsWith('.m3u8') || urlPath.includes('/master.m3u8') || urlPath.includes('/index')) &&
        urlPath.includes('.m3u8') &&
        !url.includes('.ts') &&
        !url.includes('jwpltx') &&
        !url.includes('ping.gif')
      ) {
        console.log(`[Gogoanime] Captured m3u8: ${url}`)
        capturedUrls.push({
          url: toProxyUrl(url),
          quality: 'auto',
          isM3U8: true
        })

        if (!resolved) {
          setTimeout(() => {
            if (!resolved) {
              resolved = true
              clearTimeout(timeout)
              win.destroy()
              resolve({ sources: capturedUrls, headers: { Referer: playerUrl }, embedUrl: playerUrl })
            }
          }, 2000) // Wait 2s for more captures
        }
      }

      // Also capture direct mp4 URLs
      if (url.match(/\.(mp4|webm)(\?|$)/) && !url.includes('ad') && url.includes('http')) {
        console.log(`[Gogoanime] Captured video: ${url}`)
        capturedUrls.push({
          url: toProxyUrl(url),
          quality: 'default',
          isM3U8: false
        })

        if (!resolved) {
          setTimeout(() => {
            if (!resolved) {
              resolved = true
              clearTimeout(timeout)
              win.destroy()
              resolve({ sources: capturedUrls, headers: { Referer: playerUrl }, embedUrl: playerUrl })
            }
          }, 2000)
        }
      }

      callback({})
    })

    // Block ad/tracking domains to speed things up
    ses.webRequest.onBeforeSendHeaders((details, callback) => {
      const blockedDomains = [
        'googletagmanager.com',
        'google-analytics.com',
        'doubleclick.net',
        'googlesyndication.com',
        'plausible.io',
        'bvtpk.com',
        'popads.net',
        'popunder'
      ]

      const shouldBlock = blockedDomains.some((d) => details.url.includes(d))
      if (shouldBlock) {
        callback({ cancel: true })
        return
      }

      // Inject referer for all requests
      const headers = { ...details.requestHeaders }
      if (!headers['Referer']) {
        headers['Referer'] = playerUrl
      }
      callback({ requestHeaders: headers })
    })

    // Strip CSP and referrer-policy headers so:
    // 1. The kept-alive window can make cross-origin fetch() calls
    // 2. session.fetch() in the proxy can send Referer headers freely
    ses.webRequest.onHeadersReceived((details, callback) => {
      const headers = { ...details.responseHeaders }
      for (const key of Object.keys(headers)) {
        const lk = key.toLowerCase()
        if (lk.startsWith('content-security-policy') || lk === 'referrer-policy') {
          delete headers[key]
        }
      }
      callback({ responseHeaders: headers })
    })

    // Handle errors
    win.webContents.on('did-fail-load', (_event, _code, desc) => {
      console.warn(`[Gogoanime] Hidden window load failed: ${desc}`)
      // Don't reject here — the player might still load via subframes
    })

    // Load the player page
    win.loadURL(playerUrl, {
      userAgent: USER_AGENT,
      httpReferrer: referer
    })
  })
}

// ─── Title matching ───────────────────────────────────────────

export function findBestMatch(
  results: ProviderResult[],
  title: string,
  titleEnglish?: string | null,
  audioType: 'sub' | 'dub' = 'sub'
): ProviderResult | null {
  if (results.length === 0) return null

  const normalize = (s: string): string =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()

  const isDub = (r: ProviderResult): boolean =>
    r.title.toLowerCase().includes('(dub)') || r.id.endsWith('-dub')

  // Filter results by audio type: dub entries for dub, non-dub for sub
  const filtered = results.filter((r) => (audioType === 'dub' ? isDub(r) : !isDub(r)))
  // Fall back to all results if nothing matches the preferred audio type
  const candidates = filtered.length > 0 ? filtered : results

  const target1 = normalize(title)
  const target2 = titleEnglish ? normalize(titleEnglish) : ''

  const scored = candidates.map((r) => {
    const norm = normalize(r.title)
    let score = 0

    if (norm === target1 || (target2 && norm === target2)) score = 100
    else if (norm.includes(target1) || target1.includes(norm)) score = 80
    else if (target2 && (norm.includes(target2) || target2.includes(norm))) score = 75
    else {
      const words1 = target1.split(' ')
      const words2 = target2 ? target2.split(' ') : []
      const resultWords = norm.split(' ')
      const overlap1 = words1.filter((w) => resultWords.includes(w)).length / words1.length
      const overlap2 =
        words2.length > 0
          ? words2.filter((w) => resultWords.includes(w)).length / words2.length
          : 0
      score = Math.max(overlap1, overlap2) * 60
    }

    // Penalize results whose normalized title is significantly longer than the
    // target — these are likely sequels/spinoffs (e.g. "Tokyo Ghoul:re" when
    // searching for "Tokyo Ghoul"). The penalty grows with the length difference.
    const targetLen = target2 ? Math.min(target1.length, target2.length) : target1.length
    const lenDiff = norm.length - targetLen
    if (lenDiff > 0 && score < 100) {
      score -= Math.min(lenDiff * 2, 20)
    }

    return { result: r, score }
  })

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    // Tie-break: prefer shorter titles (closer to exact match)
    const aNorm = normalize(a.result.title)
    const bNorm = normalize(b.result.title)
    return aNorm.length - bNorm.length
  })
  return scored[0]?.score > 30 ? scored[0].result : null
}
