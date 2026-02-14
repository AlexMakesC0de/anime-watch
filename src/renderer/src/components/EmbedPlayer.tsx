import { useRef, useEffect, useCallback, useState } from 'react'

interface EmbedPlayerProps {
  src: string
  title?: string
  episodeNumber?: number
  initialTime?: number
  fullscreenTarget?: React.RefObject<HTMLElement | null>
  disableInteractions?: boolean
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
  fullscreenTarget,
  disableInteractions = false,
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

  const dispatchAutoplayGesture = useCallback(() => {
    const webview = webviewRef.current
    if (!webview) return

    const bounds = webview.getBoundingClientRect()
    const x = Math.max(1, Math.floor(bounds.width / 2))
    const y = Math.max(1, Math.floor(bounds.height / 2))

    try {
      webview.focus()
      webview.sendInputEvent({ type: 'mouseMove', x, y })
      webview.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 })
      webview.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 })
      webview.sendInputEvent({ type: 'keyDown', keyCode: 'Space' })
      webview.sendInputEvent({ type: 'char', keyCode: ' ' })
      webview.sendInputEvent({ type: 'keyUp', keyCode: 'Space' })
    } catch {
      // ignore gesture injection failures
    }
  }, [])

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
        let iframePatched = false;
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

        function patchIframeAutoplay() {
          if (iframePatched) return;
          const iframes = document.querySelectorAll('iframe[src]');
          if (!iframes.length) return;
          iframes.forEach(function(iframe) {
            try {
              const src = iframe.getAttribute('src');
              if (!src) return;
              const u = new URL(src, location.href);
              u.searchParams.set('autoplay', '1');
              u.searchParams.set('autoPlay', '1');
              u.searchParams.set('mute', '1');
              u.searchParams.set('muted', '1');
              const next = u.toString();
              if (next !== src) iframe.setAttribute('src', next);
            } catch(e) {}
          });
          iframePatched = true;
        }

        // Poll for video element and keep retrying play until it works
        let playing = false;
        const checkInterval = setInterval(() => {
          if (playing) { clearInterval(checkInterval); return; }

          patchIframeAutoplay();

          // Also try clicking any play button overlays the player might have
          const playBtns = document.querySelectorAll(
            '.jw-icon-playback, .vjs-big-play-button, .plyr__control--overlaid, ' +
            'button[aria-label="Play"], [class*="play-button"], [class*="play_button"], ' +
            '[class*="playBtn"], .btn-play, #play-btn'
          );
          playBtns.forEach(function(btn) { btn.click(); });

          const video = findVideo();
          if (!video) return;

          // Set initial time or nudge to 0.1s to trigger loading
          if (${initialTime} > 0 && !reported) {
            video.currentTime = ${initialTime};
          } else if (!reported) {
            video.currentTime = 0.1;
          }
          reported = true;

          // Try to play
          video.muted = true;
          const p = video.play();
          if (p && p.then) {
            p.then(function() { playing = true; }).catch(function() {
              // Fallback: try muted
              video.muted = true;
              video.play().then(function() { playing = true; }).catch(function() {});
            });
          }

          if (playing) {
            setTimeout(function() { video.muted = false; }, 300);
          }

          // Also dispatch a click on the video in case the player needs it
          video.click();
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
      const target = fullscreenTarget?.current || container
      if (!document.fullscreenElement && target) {
        target.requestFullscreen().catch(() => {})
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

  useEffect(() => {
    const webview = webviewRef.current
    if (!webview) return

    let attemptCount = 0
    const maxAttempts = 8

    const runAttempt = (): void => {
      if (attemptCount >= maxAttempts) return
      attemptCount += 1

      dispatchAutoplayGesture()

      webview.executeJavaScript(`
        (function() {
          const video = document.querySelector('video');
          if (!video) return false;
          if (video.paused) {
            try {
              if (video.currentTime < 0.1) video.currentTime = 0.1;
              video.play();
            } catch {}
          }
          return !video.paused;
        })();
      `).then((isPlaying: boolean) => {
        if (!isPlaying && attemptCount < maxAttempts) {
          window.setTimeout(runAttempt, 700)
        }
      }).catch(() => {
        if (attemptCount < maxAttempts) {
          window.setTimeout(runAttempt, 700)
        }
      })
    }

    const timeoutId = window.setTimeout(runAttempt, 900)
    return () => window.clearTimeout(timeoutId)
  }, [src, dispatchAutoplayGesture])

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
        style={{ width: '100%', height: '100%', border: 'none', pointerEvents: disableInteractions ? 'none' : 'auto' }}
        allowpopups={'false' as unknown as boolean}
        // @ts-ignore - webview attributes
        disablewebsecurity="true"
        allowFullScreen
        // @ts-ignore
        webpreferences="autoplay=true"
      />
    </div>
  )
}
