import { Minus, Square, X } from 'lucide-react'

export default function TitleBar(): JSX.Element {
  // macOS uses native traffic‐light buttons via titleBarStyle: 'hiddenInset'.
  // On Windows and Linux we need custom buttons since the frame is hidden.
  const isMac = navigator.userAgent.includes('Macintosh')

  return (
    <div className="drag-region flex items-center justify-between h-9 bg-dark-950 border-b border-dark-900 px-4 select-none shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-accent font-bold text-sm tracking-wide">ANIMEWATCH</span>
      </div>

      {!isMac && (
        <div className="no-drag flex items-center">
          <button
            onClick={() => window.api.minimizeWindow()}
            className="hover:bg-dark-800 p-1.5 rounded transition-colors"
            title="Minimize"
          >
            <Minus size={14} className="text-dark-400" />
          </button>
          <button
            onClick={() => window.api.maximizeWindow()}
            className="hover:bg-dark-800 p-1.5 rounded transition-colors"
            title="Maximize"
          >
            <Square size={12} className="text-dark-400" />
          </button>
          <button
            onClick={() => window.api.closeWindow()}
            className="hover:bg-red-600 p-1.5 rounded transition-colors group"
            title="Close"
          >
            <X size={14} className="text-dark-400 group-hover:text-white" />
          </button>
        </div>
      )}
    </div>
  )
}
