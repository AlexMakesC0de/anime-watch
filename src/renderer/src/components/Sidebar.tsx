import { NavLink, useNavigate } from 'react-router-dom'
import {
  Home,
  Search,
  Library,
  Play,
  Clock,
  CheckCircle2,
  PauseCircle,
  XCircle,
  Bookmark
} from 'lucide-react'

const mainLinks = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/search', icon: Search, label: 'Discover' },
  { to: '/library', icon: Library, label: 'My Library' }
]

const libraryFilters = [
  { to: '/library/WATCHING', icon: Play, label: 'Watching', color: 'text-blue-400' },
  { to: '/library/PLAN_TO_WATCH', icon: Bookmark, label: 'Plan to Watch', color: 'text-yellow-400' },
  { to: '/library/COMPLETED', icon: CheckCircle2, label: 'Completed', color: 'text-green-400' },
  { to: '/library/ON_HOLD', icon: PauseCircle, label: 'On Hold', color: 'text-orange-400' },
  { to: '/library/DROPPED', icon: XCircle, label: 'Dropped', color: 'text-red-400' }
]

export default function Sidebar(): JSX.Element {
  const navigate = useNavigate()

  return (
    <aside className="w-56 bg-dark-950 border-r border-dark-900 flex flex-col shrink-0">
      {/* Quick search */}
      <div className="p-3">
        <button
          onClick={() => navigate('/search')}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-900 text-dark-400
                     hover:bg-dark-800 hover:text-dark-300 transition-colors text-sm"
        >
          <Search size={15} />
          <span>Search anime...</span>
        </button>
      </div>

      {/* Main nav */}
      <nav className="px-2 space-y-0.5">
        {mainLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-accent/10 text-accent'
                  : 'text-dark-300 hover:bg-dark-900 hover:text-white'
              }`
            }
          >
            <link.icon size={18} />
            {link.label}
          </NavLink>
        ))}
      </nav>

      {/* Library filters */}
      <div className="mt-6 px-2">
        <h3 className="text-xs font-semibold text-dark-500 uppercase tracking-wider px-3 mb-2">
          Library
        </h3>
        <div className="space-y-0.5">
          {libraryFilters.map((filter) => (
            <NavLink
              key={filter.to}
              to={filter.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-dark-900 text-white'
                    : 'text-dark-400 hover:bg-dark-900 hover:text-dark-200'
                }`
              }
            >
              <filter.icon size={16} className={filter.color} />
              {filter.label}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Spacer + version */}
      <div className="mt-auto p-4">
        <div className="flex items-center gap-2 text-dark-600 text-xs">
          <Clock size={12} />
          <span>v1.0.0</span>
        </div>
      </div>
    </aside>
  )
}
