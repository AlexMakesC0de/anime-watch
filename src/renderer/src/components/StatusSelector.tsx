import { WatchStatus } from '@/types'
import {
  Play,
  Bookmark,
  CheckCircle2,
  PauseCircle,
  XCircle,
  ChevronDown
} from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

interface StatusSelectorProps {
  currentStatus: WatchStatus | null
  onStatusChange: (status: WatchStatus) => void
  onRemove?: () => void
  compact?: boolean
}

const statuses: { value: WatchStatus; label: string; icon: typeof Play; color: string }[] = [
  { value: 'WATCHING', label: 'Watching', icon: Play, color: 'text-blue-400' },
  { value: 'PLAN_TO_WATCH', label: 'Plan to Watch', icon: Bookmark, color: 'text-yellow-400' },
  { value: 'COMPLETED', label: 'Completed', icon: CheckCircle2, color: 'text-green-400' },
  { value: 'ON_HOLD', label: 'On Hold', icon: PauseCircle, color: 'text-orange-400' },
  { value: 'DROPPED', label: 'Dropped', icon: XCircle, color: 'text-red-400' }
]

export default function StatusSelector({
  currentStatus,
  onStatusChange,
  onRemove,
  compact = false
}: StatusSelectorProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const currentStatusInfo = statuses.find((s) => s.value === currentStatus)

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={
          currentStatus
            ? 'btn-secondary text-sm'
            : 'btn-primary text-sm'
        }
      >
        {currentStatusInfo ? (
          <>
            <currentStatusInfo.icon size={compact ? 14 : 16} className={currentStatusInfo.color} />
            {!compact && currentStatusInfo.label}
          </>
        ) : (
          <>
            <Bookmark size={compact ? 14 : 16} />
            {!compact && 'Add to Library'}
          </>
        )}
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-48 bg-dark-800 border border-dark-700 rounded-lg shadow-xl z-50 overflow-hidden">
          {statuses.map((status) => (
            <button
              key={status.value}
              onClick={() => {
                onStatusChange(status.value)
                setIsOpen(false)
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                currentStatus === status.value
                  ? 'bg-accent/10 text-accent'
                  : 'text-dark-200 hover:bg-dark-700'
              }`}
            >
              <status.icon size={15} className={status.color} />
              {status.label}
            </button>
          ))}
          {currentStatus && onRemove && (
            <>
              <div className="border-t border-dark-700" />
              <button
                onClick={() => {
                  onRemove()
                  setIsOpen(false)
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-dark-700 transition-colors"
              >
                <XCircle size={15} />
                Remove from Library
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
