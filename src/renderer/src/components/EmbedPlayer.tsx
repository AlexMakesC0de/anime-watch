import { useRef, useEffect, useCallback, useState } from 'react'

interface EmbedPlayerProps {
  src: string
  title?: string
  episodeNumber?: number
  initialTime?: number
  onProgress?: (currentTime: number, duration: number) => void
  onEnded?: () => void
  onError?: (message: string) => void
}

/**
 * Embeds the streaming player page in a <webview> with the extractor session.
 * The browser's native network stack handles Cloudflare, HLS, etc.
 * We inject JS to track progress and CSS to clean up the player UI.
 */
export default function EmbedPlayer({
  src,
  title,
  episodeNumber,
  initialTime = 0,
  onProgress,
  onEnded,
  onError
}: EmbedPlayerProps): JSX.Element {
  const webviewRef = useRef<Electron.WebviewTag | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const progressIntervalRef = useRef<number | null>(null)
  const lastReportedRef = useRef(0)
  const endedFiredRef = useRef(false)
  const [isLoading, setIsLoading] = useState(true)

  // Inject CSS and JS after the player page loads
  const onDomReady = useCallback(() => {
    const webview = webviewRef.current
    if (!webview) return
    setIsLoading(false)

    // Inject CSS to clean up the player (hide ads, overlays, make video fill)
    webview.insertCSS(`
      body { margin: 0 !important; padding: 0 !important; overflow: hidden !important; background: #000 !important; }
      /* Hide common ad/overlay elements */
      .ads, .ad-overlay, .ad-container, .popup, .overlay,
      [class*="ad-"], [class*="popup"], [id*="ad-"], [id*="popup"],
      .jw-logo, .vjs-overlay, .plyr__ads,
      div[style*="z-index: 999"], div[style*="z-index: 9999"],
      .close-btn, #close-btn { display: none !important; }
      /* Make the video player fill the entire view */
      video { width: 100% !important; height: 100% !important; object-fit: contain !important; }
      .jw-wrapper, .video-js, .plyr, [class*="player"] {
        width: 100% !important; height: 100% !important;
        position: fixed !important; top: 0 !important; left: 0 !important;
      }
    `).catch(() => {})

    // Inject JS to report progress and seek to initial time
    const initScript = `
      (function() {
        let reported = false;
        function findVideo() {
          const videos = document.querySelectorAll('video');
          // Also check iframes
          if (videos.length === 0) {
            const iframes = document.querySelectorAll('iframe');
            for (const iframe of iframes) {
              try {
                const iframeVideos = iframe.contentDocument?.querySelectorAll('video');
                if (iframeVideos && iframeVideos.length > 0) return iframeVideos[0];
              } catch(e) { /* cross-origin */ }
            }
            return null;
          }
          return videos[0];
        }

        // Poll for video element
        const checkInterval = setInterval(() => {
          const video = findVideo();
          if (!video) return;

          // Set initial time
          if (${initialTime} > 0 && !reported) {
            video.currentTime = ${initialTime};
          }
          reported = true;

          // Remove the interval once we have the video
          clearInterval(checkInterval);
        }, 500);

        // Clean up after 30 seconds
        setTimeout(() => clearInterval(checkInterval), 30000);
      })();
    `
    webview.executeJavaScript(initScript).catch(() => {})
  }, [initialTime])

  // Start progress polling
  useEffect(() => {
    if (isLoading) return

    const webview = webviewRef.current
    if (!webview) return

    progressIntervalRef.current = window.setInterval(() => {
      webview
        .executeJavaScript(`
          (function() {
            const videos = document.querySelectorAll('video');
            const video = videos[0];
            if (!video) return null;
            return {
              currentTime: video.currentTime,
              duration: video.duration || 0,
              ended: video.ended,
              paused: video.paused
            };
          })();
        `)
        .then((state: { currentTime: number; duration: number; ended: boolean; paused: boolean } | null) => {
          if (!state) return
          if (
            state.currentTime > 0 &&
            state.duration > 0 &&
            Math.abs(state.currentTime - lastReportedRef.current) >= 5
          ) {
            lastReportedRef.current = state.currentTime
            onProgress?.(state.currentTime, state.duration)
          }
          // Detect episode end: video.ended, OR watched past 85% of duration
          const isNearEnd = state.duration > 0 && state.currentTime / state.duration > 0.85
          if ((state.ended || isNearEnd) && !endedFiredRef.current) {
            endedFiredRef.current = true
            // Report final progress so it's marked completed
            if (state.duration > 0) {
              onProgress?.(state.currentTime, state.duration)
            }
            onEnded?.()
          }
        })
        .catch(() => {})
    }, 2000)

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
        progressIntervalRef.current = null
      }
    }
  }, [isLoading, onProgress, onEnded])

  // Handle webview fullscreen requests (e.g. user clicks fullscreen button inside the video)
  useEffect(() => {
    const webview = webviewRef.current
    const container = containerRef.current
    if (!webview || !container) return

    const handleEnterFS = (): void => {
      if (!document.fullscreenElement) {
        container.requestFullscreen().catch(() => {})
      }
    }
    const handleLeaveFS = (): void => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
    }

    webview.addEventListener('enter-html-full-screen', handleEnterFS)
    webview.addEventListener('leave-html-full-screen', handleLeaveFS)

    return () => {
      webview.removeEventListener('enter-html-full-screen', handleEnterFS)
      webview.removeEventListener('leave-html-full-screen', handleLeaveFS)
    }
  }, [])

  // Handle webview errors
  const onDidFailLoad = useCallback(
    (_e: Event) => {
      const ev = _e as unknown as { errorDescription: string; validatedURL: string }
      console.warn(`[EmbedPlayer] Failed to load: ${ev.errorDescription} (${ev.validatedURL})`)
      // Don't report -3 (aborted) as an error
      if (ev.errorDescription && ev.errorDescription !== 'ERR_ABORTED') {
        onError?.(`Failed to load player: ${ev.errorDescription}`)
      }
    },
    [onError]
  )

  // Set up webview event listeners
  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) return

    webview.addEventListener('dom-ready', onDomReady)
    webview.addEventListener('did-fail-load', onDidFailLoad)

    return () => {
      webview.removeEventListener('dom-ready', onDomReady)
      webview.removeEventListener('did-fail-load', onDidFailLoad)
    }
  }, [onDomReady, onDidFailLoad])

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black">
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-black">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500" />
            <p className="text-sm text-gray-400">Loading player...</p>
          </div>
        </div>
      )}

      {/* WebView — uses the extractor session which has Cloudflare clearance */}
      <webview
        ref={webviewRef as React.RefObject<Electron.WebviewTag>}
        src={src}
        partition="persist:extractor"
        style={{ width: '100%', height: '100%', border: 'none' }}
        allowpopups={'false' as unknown as boolean}
        // @ts-ignore - webview attributes
        disablewebsecurity="true"
        allowFullScreen
      />
    </div>
  )
}
