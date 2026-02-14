import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
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
  clearProviderMapping,
  toggleEpisodeCompleted,
  markAllEpisodesCompleted
} from './database'
import { fetchEpisodeSources, type FetchEpisodeOpts } from './providers'
import { startProxyServer, stopProxyServer } from './proxy'

function createWindow(): BrowserWindow {
  const isMac = process.platform === 'darwin'

  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    backgroundColor: '#111214',
    // macOS: use native hidden title bar; Linux/Windows: completely frameless
    ...(isMac ? { titleBarStyle: 'hiddenInset' } : { frame: false }),
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

  // Track maximize state changes from OS-level events (e.g. double-click title bar, snap)
  mainWindow.on('maximize', () => {
    mainWindow.webContents.send('window:maximized-changed', true)
  })
  mainWindow.on('unmaximize', () => {
    mainWindow.webContents.send('window:maximized-changed', false)
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

// ─── Auto Updater ────────────────────────────────────────────────

function setupAutoUpdater(): void {
  // Don't auto-install — let the user decide
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    console.log('Update available:', info.version)
    const win = BrowserWindow.getAllWindows()[0]
    if (win) win.webContents.send('updater:update-available', info.version)
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log('Update downloaded:', info.version)
    const win = BrowserWindow.getAllWindows()[0]
    if (win) win.webContents.send('updater:update-downloaded', info.version)
  })

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err.message)
  })

  autoUpdater.checkForUpdates()
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
  ipcMain.handle('db:toggle-episode-completed', (_event, anilistId: number, episodeNumber: number, completed: boolean) =>
    toggleEpisodeCompleted(anilistId, episodeNumber, completed)
  )
  ipcMain.handle('db:mark-all-completed', (_event, anilistId: number, totalEpisodes: number) =>
    markAllEpisodesCompleted(anilistId, totalEpisodes)
  )

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
    if (!win) return
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
    // Notify renderer of new state
    win.webContents.send('window:maximized-changed', win.isMaximized())
  })
  ipcMain.on('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })
  ipcMain.handle('window:is-maximized', (event) => {
    return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false
  })
  ipcMain.handle('app:get-version', () => app.getVersion())

  // ── Auto Updater ──────────────────────────────────────────
  ipcMain.on('updater:restart', () => {
    autoUpdater.quitAndInstall(false, true)
  })
}

// ─── App Lifecycle ─────────────────────────────────────────────

// Allow autoplay in webviews (episode player)
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.animewatch.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  await initDatabase()
  await startProxyServer()
  registerIpcHandlers()
  createWindow()
  
  // Check for updates after window is ready (production only)
  if (!is.dev) {
    setupAutoUpdater()
  }

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
