import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import TitleBar from './components/TitleBar'
import HomePage from './pages/HomePage'
import SearchPage from './pages/SearchPage'
import LibraryPage from './pages/LibraryPage'
import AnimePage from './pages/AnimePage'
import WatchPage from './pages/WatchPage'

export default function App(): JSX.Element {
  return (
    <div className="flex flex-col h-screen">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
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
    </div>
  )
}
