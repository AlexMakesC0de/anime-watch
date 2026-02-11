import { useEffect, useState } from 'react'
import { Download, RefreshCw, X } from 'lucide-react'

type UpdateState = 'idle' | 'available' | 'downloaded'

export default function UpdateNotification(): JSX.Element | null {
  const [state, setState] = useState<UpdateState>('idle')
  const [version, setVersion] = useState('')
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const cleanupAvailable = window.api.onUpdateAvailable((v) => {
      setVersion(v)
      setState('available')
      setDismissed(false)
    })

    const cleanupDownloaded = window.api.onUpdateDownloaded((v) => {
      setVersion(v)
      setState('downloaded')
      setDismissed(false)
    })

    return () => {
      cleanupAvailable()
      cleanupDownloaded()
    }
  }, [])

  if (state === 'idle' || dismissed) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom">
      <div className="bg-dark-800 border border-dark-700 rounded-xl shadow-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-accent/10 rounded-lg shrink-0">
            {state === 'available' ? (
              <Download size={18} className="text-accent" />
            ) : (
              <RefreshCw size={18} className="text-green-400" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">
              {state === 'available' ? 'Update Available' : 'Update Ready'}
            </p>
            <p className="text-xs text-dark-400 mt-0.5">
              {state === 'available'
                ? `Version ${version} is downloading...`
                : `Version ${version} will be installed on next launch.`}
            </p>

            {state === 'downloaded' && (
              <button
                onClick={() => window.api.restartToUpdate()}
                className="mt-2 px-3 py-1.5 bg-accent hover:bg-accent/80 text-white text-xs font-medium rounded-lg transition-colors"
              >
                Restart Now
              </button>
            )}
          </div>

          <button
            onClick={() => setDismissed(true)}
            className="p-1 hover:bg-dark-700 rounded transition-colors shrink-0"
          >
            <X size={14} className="text-dark-500" />
          </button>
        </div>
      </div>
    </div>
  )
}
