import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import {
  initDatabase,
  closeDatabase,
  addAnime,
  getLibrary,
  getAnime,
  updateStatus,
  removeAnime,
  saveProgress,
  getProgress,
  getEpisodeProgress,
  getContinueWatching,
  clearProviderMapping
} from './database'
import { fetchEpisodeSources, type FetchEpisodeOpts } from './providers'
import { startProxyServer, stopProxyServer } from './proxy'

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    backgroundColor: '#111214',
    titleBarStyle: 'hiddenInset',
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      webSecurity: false, // needed for loading external anime images
      webviewTag: true // needed for embedded video player
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

// ─── IPC Handlers ────────────────────────────────────────────────

function registerIpcHandlers(): void {
  ipcMain.handle('db:add-anime', (_event, anime) => addAnime(anime))
  ipcMain.handle('db:get-library', (_event, status?: string) => getLibrary(status))
  ipcMain.handle('db:get-anime', (_event, anilistId: number) => getAnime(anilistId))
  ipcMain.handle('db:update-status', (_event, anilistId: number, status: string) =>
    updateStatus(anilistId, status)
  )
  ipcMain.handle('db:remove-anime', (_event, anilistId: number) => removeAnime(anilistId))
  ipcMain.handle('db:save-progress', (_event, progress) => saveProgress(progress))
  ipcMain.handle('db:get-progress', (_event, anilistId: number) => getProgress(anilistId))
  ipcMain.handle('db:get-episode-progress', (_event, anilistId: number, episodeNumber: number) =>
    getEpisodeProgress(anilistId, episodeNumber)
  )
  ipcMain.handle('db:get-continue-watching', () => getContinueWatching())

  // ── Streaming Provider ────────────────────────────────────────
  ipcMain.handle('provider:fetch-sources', async (_event, opts: FetchEpisodeOpts) => {
    const result = await fetchEpisodeSources(opts)
    return result
  })
  ipcMain.handle('provider:clear-cache', (_event, anilistId: number) =>
    clearProviderMapping(anilistId)
  )

  // ── Window controls ──────────────────────────────────────────
  ipcMain.on('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })
  ipcMain.on('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win?.isMaximized()) {
      win.unmaximize()
    } else {
      win?.maximize()
    }
  })
  ipcMain.on('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })
}

// ─── App Lifecycle ─────────────────────────────────────────────

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.animewatch.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  await initDatabase()
  await startProxyServer()
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  stopProxyServer()
  closeDatabase()
})
