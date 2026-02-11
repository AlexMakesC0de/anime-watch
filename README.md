# AnimeWatch

A desktop app to watch and track your anime series. Never lose your place again.

## Features

- **Discover anime** — Browse trending, seasonal, and all-time popular anime powered by the AniList API
- **Search** — Find any anime by title
- **Track your library** — Organize anime into Watching, Plan to Watch, Completed, On Hold, or Dropped
- **Watch with progress tracking** — Built-in video player that saves your position (episode + timestamp) every 5 seconds
- **Resume where you left off** — Continue Watching section on the home page picks up exactly where you stopped
- **Episode progress** — Visual grid showing which episodes are completed, in-progress, or unwatched
- **Auto-advance** — Automatically moves to the next episode when the current one finishes
- **Keyboard shortcuts** — Space/K (play/pause), Arrow keys (seek/volume), F (fullscreen), M (mute)
- **Related anime** — See sequels, prequels, and side stories on each anime's detail page

## Tech Stack

- **Electron** — Cross-platform desktop shell
- **React 18** + **TypeScript** — UI layer
- **Tailwind CSS** — Styling
- **SQLite** (better-sqlite3) — Local database for library & watch progress
- **AniList GraphQL API** — Anime metadata, search, and discovery
- **electron-vite** — Fast build tooling

## Getting Started

```bash
# Install dependencies
npm install

# Run in dev mode (hot reload)
npm run dev

# Build for production
npm run build

# Package as distributable
npm run package
```

## How to Use

1. **Discover** — The home page shows trending and seasonal anime
2. **Search** — Use the search page or the sidebar shortcut to find anime
3. **Add to library** — Click any anime, then use the status dropdown to add it to your library
4. **Watch** — Click "Start Watching" on an anime page, paste a direct video URL, and play
5. **Resume** — Your progress is saved automatically. Come back any time and pick up where you left off from the Continue Watching section or the episode grid

## Project Structure

```
src/
├── main/           # Electron main process
│   ├── index.ts    # Window creation, IPC handlers
│   └── database.ts # SQLite schema & init
├── preload/        # Context bridge (IPC API)
│   └── index.ts
└── renderer/       # React frontend
    ├── index.html
    └── src/
        ├── App.tsx
        ├── main.tsx
        ├── components/   # Reusable UI components
        ├── pages/        # Route pages
        ├── services/     # AniList API client
        ├── types/        # TypeScript types
        └── styles/       # Tailwind base styles
```

## License

MIT
