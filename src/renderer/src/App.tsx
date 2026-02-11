import { Routes, Route, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import TitleBar from './components/TitleBar'
import UpdateNotification from './components/UpdateNotification'
import HomePage from './pages/HomePage'
import SearchPage from './pages/SearchPage'
import LibraryPage from './pages/LibraryPage'
import AnimePage from './pages/AnimePage'
import WatchPage from './pages/WatchPage'

export default function App(): JSX.Element {
  const location = useLocation()
  const isWatchPage = location.pathname.startsWith('/watch/')

  return (
    <div className="flex flex-col h-screen">
      {!isWatchPage && <TitleBar />}
      <div className="flex flex-1 overflow-hidden">
        {!isWatchPage && <Sidebar />}
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/library/:status" element={<LibraryPage />} />
            <Route path="/anime/:id" element={<AnimePage />} />
            <Route path="/watch/:id/:episode" element={<WatchPage />} />
          </Routes>
        </main>
      </div>
      <UpdateNotification />
    </div>
  )
}
