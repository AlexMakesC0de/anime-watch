import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'

let db: SqlJsDatabase
let dbPath: string
let saveTimer: ReturnType<typeof setInterval> | null = null

export async function initDatabase(): Promise<void> {
  const userDataPath = app.getPath('userData')
  const dbDir = join(userDataPath, 'data')

  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }

  dbPath = join(dbDir, 'anime-watch.db')

  const SQL = await initSqlJs()

  if (existsSync(dbPath)) {
    const buffer = readFileSync(dbPath)
    db = new SQL.Database(buffer)
  } else {
    db = new SQL.Database()
  }

  createTables()
  persistToFile()

  // Auto-save every 30 seconds
  saveTimer = setInterval(persistToFile, 30_000)

  console.log(`[Database] Initialized at ${dbPath}`)
}

function createTables(): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS anime (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      anilist_id INTEGER UNIQUE NOT NULL,
      title TEXT NOT NULL,
      title_english TEXT,
      cover_image TEXT,
      banner_image TEXT,
      description TEXT,
      episodes_total INTEGER,
      status TEXT NOT NULL DEFAULT 'PLAN_TO_WATCH',
      format TEXT,
      genres TEXT,
      season TEXT,
      season_year INTEGER,
      score REAL,
      added_at DATETIME DEFAULT (datetime('now')),
      updated_at DATETIME DEFAULT (datetime('now'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS watch_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      anime_id INTEGER NOT NULL,
      episode_number INTEGER NOT NULL,
      watched_seconds REAL DEFAULT 0,
      total_seconds REAL DEFAULT 0,
      completed INTEGER DEFAULT 0,
      video_source TEXT,
      watched_at DATETIME DEFAULT (datetime('now')),
      FOREIGN KEY (anime_id) REFERENCES anime(id) ON DELETE CASCADE,
      UNIQUE(anime_id, episode_number)
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS provider_cache (
      anilist_id INTEGER NOT NULL,
      provider TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      cached_at DATETIME DEFAULT (datetime('now')),
      PRIMARY KEY (anilist_id, provider)
    )
  `)

  try { db.run('CREATE INDEX idx_anime_status ON anime(status)') } catch { /* exists */ }
  try { db.run('CREATE INDEX idx_anime_anilist_id ON anime(anilist_id)') } catch { /* exists */ }
  try { db.run('CREATE INDEX idx_progress_anime ON watch_progress(anime_id)') } catch { /* exists */ }
  try { db.run('CREATE INDEX idx_progress_watched ON watch_progress(watched_at)') } catch { /* exists */ }
}

function persistToFile(): void {
  if (!db || !dbPath) return
  const data = db.export()
  writeFileSync(dbPath, Buffer.from(data))
}

// ─── Query helpers ────────────────────────────────────────────

function queryAll(sql: string, params: unknown[] = []): Record<string, unknown>[] {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const results: Record<string, unknown>[] = []
  while (stmt.step()) {
    results.push(stmt.getAsObject() as Record<string, unknown>)
  }
  stmt.free()
  return results
}

function queryOne(sql: string, params: unknown[] = []): Record<string, unknown> | null {
  const results = queryAll(sql, params)
  return results[0] || null
}

function execute(sql: string, params: unknown[] = []): void {
  db.run(sql, params)
  persistToFile()
}

// ─── Public API ───────────────────────────────────────────────

export function addAnime(anime: Record<string, unknown>): void {
  execute(
    `INSERT OR REPLACE INTO anime
      (anilist_id, title, title_english, cover_image, banner_image, description,
       episodes_total, status, format, genres, season, season_year, score, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      anime.anilistId, anime.title, anime.titleEnglish, anime.coverImage, anime.bannerImage,
      anime.description, anime.episodesTotal, anime.status, anime.format, anime.genres,
      anime.season, anime.seasonYear, anime.score
    ]
  )
}

export function getLibrary(status?: string): Record<string, unknown>[] {
  if (status) {
    return queryAll('SELECT * FROM anime WHERE status = ? ORDER BY updated_at DESC', [status])
  }
  return queryAll('SELECT * FROM anime ORDER BY updated_at DESC')
}

export function getAnime(anilistId: number): Record<string, unknown> | null {
  return queryOne('SELECT * FROM anime WHERE anilist_id = ?', [anilistId])
}

export function updateStatus(anilistId: number, status: string): void {
  execute(
    "UPDATE anime SET status = ?, updated_at = datetime('now') WHERE anilist_id = ?",
    [status, anilistId]
  )
}

export function removeAnime(anilistId: number): void {
  execute(
    'DELETE FROM watch_progress WHERE anime_id = (SELECT id FROM anime WHERE anilist_id = ?)',
    [anilistId]
  )
  execute('DELETE FROM anime WHERE anilist_id = ?', [anilistId])
}

export function saveProgress(progress: Record<string, unknown>): void {
  const existing = queryOne(
    `SELECT wp.id FROM watch_progress wp
     JOIN anime a ON wp.anime_id = a.id
     WHERE a.anilist_id = ? AND wp.episode_number = ?`,
    [progress.anilistId, progress.episodeNumber]
  )

  if (existing) {
    execute(
      `UPDATE watch_progress SET
        watched_seconds = ?, total_seconds = ?, completed = ?,
        video_source = COALESCE(?, video_source), watched_at = datetime('now')
       WHERE id = ?`,
      [progress.watchedSeconds, progress.totalSeconds, progress.completed, progress.videoSource, existing.id]
    )
  } else {
    execute(
      `INSERT INTO watch_progress (anime_id, episode_number, watched_seconds, total_seconds, completed, video_source)
       VALUES ((SELECT id FROM anime WHERE anilist_id = ?), ?, ?, ?, ?, ?)`,
      [
        progress.anilistId, progress.episodeNumber, progress.watchedSeconds,
        progress.totalSeconds, progress.completed, progress.videoSource
      ]
    )
  }
}

export function getProgress(anilistId: number): Record<string, unknown>[] {
  return queryAll(
    `SELECT wp.* FROM watch_progress wp
     JOIN anime a ON wp.anime_id = a.id
     WHERE a.anilist_id = ?
     ORDER BY wp.episode_number ASC`,
    [anilistId]
  )
}

export function getEpisodeProgress(
  anilistId: number,
  episodeNumber: number
): Record<string, unknown> | null {
  return queryOne(
    `SELECT wp.* FROM watch_progress wp
     JOIN anime a ON wp.anime_id = a.id
     WHERE a.anilist_id = ? AND wp.episode_number = ?`,
    [anilistId, episodeNumber]
  )
}

export function getContinueWatching(): Record<string, unknown>[] {
  return queryAll(
    `SELECT a.*, wp.episode_number as last_episode, wp.watched_seconds, wp.total_seconds
     FROM anime a
     JOIN watch_progress wp ON wp.anime_id = a.id
     WHERE a.status = 'WATCHING'
       AND wp.watched_at = (
         SELECT MAX(wp2.watched_at) FROM watch_progress wp2 WHERE wp2.anime_id = a.id
       )
       AND wp.completed = 0
     ORDER BY wp.watched_at DESC
     LIMIT 20`
  )
}

// ─── Provider Cache ───────────────────────────────────────────

export function getProviderMapping(anilistId: number, provider: string): string | null {
  const row = queryOne(
    'SELECT provider_id FROM provider_cache WHERE anilist_id = ? AND provider = ?',
    [anilistId, provider]
  )
  return row ? (row.provider_id as string) : null
}

export function setProviderMapping(anilistId: number, provider: string, providerId: string): void {
  execute(
    `INSERT OR REPLACE INTO provider_cache (anilist_id, provider, provider_id, cached_at)
     VALUES (?, ?, ?, datetime('now'))`,
    [anilistId, provider, providerId]
  )
}

export function clearProviderMapping(anilistId: number): void {
  execute('DELETE FROM provider_cache WHERE anilist_id = ?', [anilistId])
}

export function closeDatabase(): void {
  if (saveTimer) clearInterval(saveTimer)
  if (db) {
    persistToFile()
    db.close()
  }
}
