import { useState, useEffect, useCallback } from 'react'
import { X, ChevronRight, ChevronLeft, Compass, Search, BookOpen, Play, MousePointerClick } from 'lucide-react'

const TUTORIAL_DISMISSED_KEY = 'tutorial-dismissed'

interface TutorialStep {
  title: string
  description: string
  icon: React.ReactNode
}

const steps: TutorialStep[] = [
  {
    title: 'Welcome to AnimeWatch!',
    description:
      'This quick tour will show you around the app. It only takes a minute.',
    icon: <Play size={28} className="text-accent" />
  },
  {
    title: 'Discover Anime',
    description:
      'The Home page shows trending and seasonal anime. Use the Discover tab in the sidebar or the search bar to find any anime by name.',
    icon: <Compass size={28} className="text-accent" />
  },
  {
    title: 'Search & Browse',
    description:
      'Click "Search anime..." at the top of the sidebar or go to Discover. Type a title and hit Enter to search. Click any anime to see its details.',
    icon: <Search size={28} className="text-accent" />
  },
  {
    title: 'Your Library',
    description:
      'On any anime page, use the "Add to Library" button to organize it into Watching, Plan to Watch, Completed, On Hold, or Dropped. Access your library from the sidebar.',
    icon: <BookOpen size={28} className="text-accent" />
  },
  {
    title: 'Watch Episodes',
    description:
      'Click "Start Watching" on an anime page to begin. The player auto-saves your progress. Use the top bar to switch between SUB and DUB, navigate episodes, or open the episode list.',
    icon: <Play size={28} className="text-accent" />
  },
  {
    title: 'Episode Completion',
    description:
      'Episodes are automatically marked as watched when you reach ~85% of the video. However, this isn\'t always perfect — you can always right-click any episode (on the anime page or in the player sidebar) to manually toggle it as watched or unwatched.',
    icon: <MousePointerClick size={28} className="text-accent" />
  }
]

export default function Tutorial(): JSX.Element | null {
  const [visible, setVisible] = useState(false)
  const [started, setStarted] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [dontShowAgain, setDontShowAgain] = useState(false)

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(TUTORIAL_DISMISSED_KEY)
      if (!dismissed) {
        setVisible(true)
      }
    } catch {
      setVisible(true)
    }
  }, [])

  const dismiss = useCallback(() => {
    setVisible(false)
    if (dontShowAgain) {
      try {
        localStorage.setItem(TUTORIAL_DISMISSED_KEY, 'true')
      } catch { /* ignore */ }
    }
  }, [dontShowAgain])

  const dismissPermanently = useCallback(() => {
    setVisible(false)
    try {
      localStorage.setItem(TUTORIAL_DISMISSED_KEY, 'true')
    } catch { /* ignore */ }
  }, [])

  const start = useCallback(() => {
    setStarted(true)
    setCurrentStep(0)
  }, [])

  const next = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1)
    } else {
      dismissPermanently()
    }
  }, [currentStep, dismissPermanently])

  const prev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1)
    }
  }, [currentStep])

  if (!visible) return null

  const step = steps[currentStep]

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-dark-900 border border-dark-700 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {!started ? (
          /* ── Welcome prompt ─────────────────────────────── */
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Play size={32} className="text-accent" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Welcome to AnimeWatch!</h2>
            <p className="text-dark-400 text-sm mb-8">
              Would you like a quick tour of the app?
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={start}
                className="w-full py-2.5 bg-accent hover:bg-accent/80 text-white font-medium rounded-xl transition-colors"
              >
                Start Tour
              </button>
              <button
                onClick={dismiss}
                className="w-full py-2.5 bg-dark-800 hover:bg-dark-700 text-dark-300 font-medium rounded-xl transition-colors"
              >
                Skip
              </button>
            </div>

            <label className="flex items-center justify-center gap-2 mt-5 cursor-pointer group">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-accent focus:ring-accent/30 cursor-pointer"
              />
              <span className="text-xs text-dark-500 group-hover:text-dark-400 transition-colors">
                Don't show again
              </span>
            </label>
          </div>
        ) : (
          /* ── Tutorial steps ─────────────────────────────── */
          <div>
            {/* Progress bar */}
            <div className="h-1 bg-dark-800">
              <div
                className="h-full bg-accent transition-all duration-300"
                style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              />
            </div>

            <div className="p-8">
              {/* Close button */}
              <button
                onClick={dismissPermanently}
                className="absolute top-4 right-4 p-1.5 hover:bg-dark-700 rounded-lg transition-colors"
              >
                <X size={16} className="text-dark-500" />
              </button>

              {/* Icon */}
              <div className="w-14 h-14 bg-accent/10 rounded-2xl flex items-center justify-center mb-5">
                {step.icon}
              </div>

              {/* Content */}
              <h3 className="text-lg font-bold text-white mb-2">{step.title}</h3>
              <p className="text-sm text-dark-400 leading-relaxed">{step.description}</p>

              {/* Step counter */}
              <p className="text-xs text-dark-600 mt-4">
                {currentStep + 1} of {steps.length}
              </p>

              {/* Navigation */}
              <div className="flex items-center justify-between mt-6">
                <button
                  onClick={prev}
                  disabled={currentStep === 0}
                  className="flex items-center gap-1 px-3 py-2 text-sm text-dark-400 hover:text-white disabled:opacity-0 disabled:pointer-events-none transition-colors"
                >
                  <ChevronLeft size={16} />
                  Back
                </button>

                {/* Dots */}
                <div className="flex gap-1.5">
                  {steps.map((_, i) => (
                    <div
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${
                        i === currentStep ? 'bg-accent' : i < currentStep ? 'bg-accent/40' : 'bg-dark-700'
                      }`}
                    />
                  ))}
                </div>

                <button
                  onClick={next}
                  className="flex items-center gap-1 px-4 py-2 bg-accent hover:bg-accent/80 text-white text-sm font-medium rounded-xl transition-colors"
                >
                  {currentStep === steps.length - 1 ? 'Done' : 'Next'}
                  {currentStep < steps.length - 1 && <ChevronRight size={16} />}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
