import { useState, useRef, useEffect, useCallback } from 'react'
import Hls from 'hls.js'
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  SkipBack,
  SkipForward,
  RotateCcw
} from 'lucide-react'

interface VideoPlayerProps {
  src: string
  title?: string
  episodeNumber?: number
  initialTime?: number
  onProgress?: (currentTime: number, duration: number) => void
  onEnded?: () => void
  onPrevious?: () => void
  onNext?: () => void
  onError?: (message: string) => void
}

export default function VideoPlayer({
  src,
  title,
  episodeNumber,
  initialTime = 0,
  onProgress,
  onEnded,
  onPrevious,
  onNext,
  onError
}: VideoPlayerProps): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const hideControlsTimerRef = useRef<number | null>(null)
  const hlsRef = useRef<Hls | null>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [showControls, setShowControls] = useState(true)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Report progress every 5 seconds
  const lastReportedRef = useRef(0)

  const reportProgress = useCallback(
    (time: number, dur: number) => {
      if (Math.abs(time - lastReportedRef.current) >= 5) {
        lastReportedRef.current = time
        onProgress?.(time, dur)
      }
    },
    [onProgress]
  )

  // Load video source — handle HLS (.m3u8) via hls.js, otherwise native
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    // Clean up previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    if (!src) {
      video.removeAttribute('src')
      video.load()
      return
    }

    const applyInitialTime = (): void => {
      if (video && initialTime > 0) video.currentTime = initialTime
    }

    if (src.includes('.m3u8') && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: false, // Avoid worker security context issues in Electron
        lowLatencyMode: false,
        xhrSetup: (xhr) => {
          xhr.withCredentials = false
        }
      })
      hlsRef.current = hls
      hls.loadSource(src)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('[HLS] Manifest parsed, starting playback')
        applyInitialTime()
        // Auto-play once manifest is ready
        video.play().catch(() => {
          // Autoplay blocked — user can click play
        })
      })
      let networkRetries = 0
      let mediaRetries = 0
      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.warn('[HLS] Error:', data.type, data.details, data.fatal ? '(FATAL)' : '')
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (networkRetries < 3) {
                networkRetries++
                console.log(`[HLS] Network error, retry ${networkRetries}/3...`)
                hls.startLoad()
              } else {
                console.error('[HLS] Network error - all retries exhausted')
                onError?.('Stream failed to load (network error). Try another source.')
                hls.destroy()
                hlsRef.current = null
              }
              break
            case Hls.ErrorTypes.MEDIA_ERROR:
              if (mediaRetries < 2) {
                mediaRetries++
                console.log(`[HLS] Media error, recovering (attempt ${mediaRetries})...`)
                hls.recoverMediaError()
              } else {
                console.error('[HLS] Media error - recovery failed')
                onError?.('Video format error. Try another source.')
                hls.destroy()
                hlsRef.current = null
              }
              break
            default:
              console.error('[HLS] Fatal error:', data.type, data.details)
              onError?.(`Playback error: ${data.details}`)
              hls.destroy()
              hlsRef.current = null
              break
          }
        }
      })
    } else {
      // Native playback (mp4, webm, or Safari native HLS)
      video.src = src
      video.addEventListener('loadedmetadata', applyInitialTime, { once: true })
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [src, initialTime])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const video = videoRef.current
      if (!video) return

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault()
          togglePlay()
          break
        case 'ArrowLeft':
          e.preventDefault()
          video.currentTime = Math.max(0, video.currentTime - 10)
          break
        case 'ArrowRight':
          e.preventDefault()
          video.currentTime = Math.min(video.duration, video.currentTime + 10)
          break
        case 'ArrowUp':
          e.preventDefault()
          setVolume((v) => {
            const newVol = Math.min(1, v + 0.1)
            if (video) video.volume = newVol
            return newVol
          })
          break
        case 'ArrowDown':
          e.preventDefault()
          setVolume((v) => {
            const newVol = Math.max(0, v - 0.1)
            if (video) video.volume = newVol
            return newVol
          })
          break
        case 'm':
          toggleMute()
          break
        case 'f':
          toggleFullscreen()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const togglePlay = (): void => {
    const video = videoRef.current
    if (!video) return

    if (video.paused) {
      video.play()
      setIsPlaying(true)
    } else {
      video.pause()
      setIsPlaying(false)
    }
  }

  const toggleMute = (): void => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setIsMuted(video.muted)
  }

  const toggleFullscreen = (): void => {
    const container = containerRef.current
    if (!container) return

    if (document.fullscreenElement) {
      document.exitFullscreen()
      setIsFullscreen(false)
    } else {
      container.requestFullscreen()
      setIsFullscreen(true)
    }
  }

  const handleTimeUpdate = (): void => {
    const video = videoRef.current
    if (!video) return
    setCurrentTime(video.currentTime)
    reportProgress(video.currentTime, video.duration)
  }

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    const video = videoRef.current
    const bar = progressRef.current
    if (!video || !bar) return

    const rect = bar.getBoundingClientRect()
    const pos = (e.clientX - rect.left) / rect.width
    video.currentTime = pos * video.duration
  }

  const handleMouseMove = (): void => {
    setShowControls(true)
    if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current)
    hideControlsTimerRef.current = window.setTimeout(() => {
      if (isPlaying) setShowControls(false)
    }, 3000)
  }

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div
      ref={containerRef}
      className="relative bg-black w-full aspect-video group"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <video
        ref={videoRef}
        className="w-full h-full cursor-pointer"
        onClick={togglePlay}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => {
          const video = videoRef.current
          if (video) {
            setDuration(video.duration)
            if (initialTime > 0) video.currentTime = initialTime
          }
        }}
        onEnded={() => {
          setIsPlaying(false)
          onProgress?.(duration, duration)
          onEnded?.()
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* No source placeholder */}
      {!src && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-dark-500">
          <Play size={48} className="mb-3" />
          <p className="text-lg font-medium">No video source</p>
          <p className="text-sm mt-1">Add a video URL to start watching</p>
        </div>
      )}

      {/* Controls overlay */}
      <div
        className={`absolute inset-0 flex flex-col justify-end transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

        {/* Top info */}
        {title && (
          <div className="absolute top-0 left-0 right-0 p-4">
            <p className="text-white font-medium text-lg drop-shadow-lg">
              {episodeNumber && <span className="text-accent">Episode {episodeNumber}</span>}
              {episodeNumber && title && <span className="mx-2">·</span>}
              {title}
            </p>
          </div>
        )}

        {/* Bottom controls */}
        <div className="relative z-10 px-4 pb-4 space-y-2">
          {/* Progress bar */}
          <div
            ref={progressRef}
            className="w-full h-1.5 bg-white/20 rounded-full cursor-pointer group/progress hover:h-2.5 transition-all"
            onClick={handleProgressClick}
          >
            <div
              className="h-full bg-accent rounded-full relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-accent rounded-full shadow opacity-0 group-hover/progress:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {onPrevious && (
                <button onClick={onPrevious} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
                  <SkipBack size={18} className="text-white" />
                </button>
              )}

              <button onClick={togglePlay} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                {isPlaying ? (
                  <Pause size={22} className="text-white" fill="currentColor" />
                ) : (
                  <Play size={22} className="text-white" fill="currentColor" />
                )}
              </button>

              {onNext && (
                <button onClick={onNext} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
                  <SkipForward size={18} className="text-white" />
                </button>
              )}

              <button
                onClick={() => {
                  if (videoRef.current) videoRef.current.currentTime -= 10
                }}
                className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
              >
                <RotateCcw size={16} className="text-white" />
              </button>

              {/* Volume */}
              <div className="flex items-center gap-1 group/vol">
                <button onClick={toggleMute} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
                  {isMuted || volume === 0 ? (
                    <VolumeX size={18} className="text-white" />
                  ) : (
                    <Volume2 size={18} className="text-white" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value)
                    setVolume(v)
                    if (videoRef.current) {
                      videoRef.current.volume = v
                      videoRef.current.muted = v === 0
                      setIsMuted(v === 0)
                    }
                  }}
                  className="w-20 h-1 accent-accent opacity-0 group-hover/vol:opacity-100 transition-opacity cursor-pointer"
                />
              </div>

              {/* Time */}
              <span className="text-white/80 text-xs ml-2 font-mono">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={toggleFullscreen} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
                <Maximize size={18} className="text-white" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
