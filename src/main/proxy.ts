import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'http'
import { BrowserWindow, net } from 'electron'
import { URL } from 'url'

// ─── Local HLS Proxy ──────────────────────────────────────────
// The CDN is behind Cloudflare. We keep the hidden BrowserWindow
// alive from extraction and use its session.fetch() to make
// requests through Chromium's network stack, which carries CF
// cookies, TLS fingerprint, and HSTS state. We strip
// referrer-policy and CSP from CDN responses via the session's
// webRequest hooks (set up in gogoanime.ts) so Chromium allows
// cross-origin Referer in ses.fetch() calls.

let server: Server | null = null
let proxyPort = 0

/** The hidden BrowserWindow that passed Cloudflare's challenge */
let extractorWindow: BrowserWindow | null = null

/** The referer to send with proxied requests */
let activeReferer: string | null = null

export function setExtractorWindow(win: BrowserWindow, referer: string): void {
  // Clean up previous window if any
  if (extractorWindow && !extractorWindow.isDestroyed()) {
    extractorWindow.destroy()
  }
  extractorWindow = win
  activeReferer = referer
}

export function getExtractorWindow(): BrowserWindow | null {
  if (extractorWindow && !extractorWindow.isDestroyed()) return extractorWindow
  return null
}

export function cleanupExtractorWindow(): void {
  if (extractorWindow && !extractorWindow.isDestroyed()) {
    extractorWindow.destroy()
  }
  extractorWindow = null
}

/**
 * Convert a real CDN URL to a proxied localhost URL.
 */
export function toProxyUrl(realUrl: string): string {
  return `http://127.0.0.1:${proxyPort}/proxy?url=${encodeURIComponent(realUrl)}`
}

/**
 * Start the local proxy server. Call once at app startup.
 */
export function startProxyServer(): Promise<number> {
  return new Promise((resolve, reject) => {
    server = createServer(handleRequest)

    server.on('error', (err) => {
      console.error('[Proxy] Server error:', err)
      reject(err)
    })

    server.listen(0, '127.0.0.1', () => {
      const addr = server!.address()
      if (addr && typeof addr === 'object') {
        proxyPort = addr.port
        console.log(`[Proxy] HLS proxy server listening on http://127.0.0.1:${proxyPort}`)
        resolve(proxyPort)
      }
    })
  })
}

export function stopProxyServer(): void {
  cleanupExtractorWindow()
  if (server) {
    server.close()
    server = null
  }
}

// ─── Request handler ──────────────────────────────────────────

async function sessionFetch(
  win: BrowserWindow,
  targetUrl: string,
  _referer: string,
  retries = 3
): Promise<{ status: number; contentType: string; body: Buffer }> {
  const ses = win.webContents.session

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Use net.fetch() with the extractor session — this goes through
      // Chromium's full network stack with the session's cookies/TLS state.
      // Don't set Referer/Origin as they may trigger ERR_BLOCKED_BY_CLIENT
      // when Electron's referrer-policy enforcement kicks in.
      const response = await net.fetch(targetUrl, {
        session: ses,
        bypassCustomProtocolHandlers: true
      })

      const arrayBuf = await response.arrayBuffer()
      const body = Buffer.from(arrayBuf)
      const contentType = response.headers.get('content-type') || ''
      const status = response.status

      console.log(`[Proxy] net.fetch: ${status} ${contentType} for ${targetUrl.substring(0, 80)}`)

      if (status === 403 && attempt < retries) {
        console.log(`[Proxy] 403, retrying (${attempt}/${retries})...`)
        await new Promise((r) => setTimeout(r, 300 * attempt))
        continue
      }

      return { status, contentType, body }
    } catch (err) {
      const msg = (err as Error).message || String(err)
      console.error(`[Proxy] net.fetch error (attempt ${attempt}): ${msg}`)
      if (attempt >= retries) throw err
      await new Promise((r) => setTimeout(r, 300 * attempt))
    }
  }
  throw new Error('Max retries exceeded')
}

function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  if (!req.url || req.method !== 'GET') {
    res.writeHead(404)
    res.end('Not found')
    return
  }

  const parsed = new URL(req.url, `http://127.0.0.1:${proxyPort}`)

  if (parsed.pathname !== '/proxy') {
    res.writeHead(404)
    res.end('Not found')
    return
  }

  const targetUrl = parsed.searchParams.get('url')
  if (!targetUrl) {
    res.writeHead(400)
    res.end('Missing url parameter')
    return
  }

  const win = getExtractorWindow()
  if (!win) {
    console.error('[Proxy] No extractor window available')
    res.writeHead(503)
    res.end('No browser context available')
    return
  }

  const referer = activeReferer || ''

  sessionFetch(win, targetUrl, referer)
    .then(({ status, contentType, body }) => {
      const isM3u8 =
        contentType.includes('mpegurl') ||
        contentType.includes('m3u8') ||
        targetUrl.includes('.m3u8')

      const outHeaders: Record<string, string> = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': '*',
        'Cache-Control': 'no-cache'
      }

      if (isM3u8 && status === 200) {
        const text = body.toString('utf-8')
        if (text.trimStart().startsWith('#EXTM3U')) {
          const rewritten = rewritePlaylist(text, targetUrl)
          outHeaders['Content-Type'] = 'application/vnd.apple.mpegurl'
          res.writeHead(200, outHeaders)
          res.end(rewritten)
        } else {
          console.warn(`[Proxy] Playlist URL returned non-m3u8 (starts: ${text.substring(0, 50)})`)
          res.writeHead(502)
          res.end('Invalid playlist content')
        }
      } else {
        if (contentType) outHeaders['Content-Type'] = contentType
        outHeaders['Content-Length'] = String(body.length)
        res.writeHead(status, outHeaders)
        res.end(body)
      }
    })
    .catch((err: Error) => {
      console.error(`[Proxy] Fetch error for ${targetUrl.substring(0, 80)}: ${err.message}`)
      res.writeHead(502)
      res.end(`Proxy fetch failed: ${err.message}`)
    })
}

// ─── Playlist rewriting ───────────────────────────────────────

function rewritePlaylist(content: string, playlistUrl: string): string {
  const baseUrl = playlistUrl.substring(0, playlistUrl.lastIndexOf('/') + 1)

  return content
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()

      if (trimmed === '' || (trimmed.startsWith('#') && !trimmed.includes('URI="'))) {
        return line
      }

      if (trimmed.includes('URI="')) {
        return line.replace(/URI="([^"]+)"/, (_match, uri: string) => {
          const absoluteUri = resolveUrl(uri, baseUrl)
          return `URI="${toProxyUrl(absoluteUri)}"`
        })
      }

      if (!trimmed.startsWith('#')) {
        const absoluteUrl = resolveUrl(trimmed, baseUrl)
        return toProxyUrl(absoluteUrl)
      }

      return line
    })
    .join('\n')
}

function resolveUrl(url: string, baseUrl: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  try {
    return new URL(url, baseUrl).href
  } catch {
    return baseUrl + url
  }
}
