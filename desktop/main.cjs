'use strict'

/**
 * Electron entry point.
 *
 * Runs the existing Express API inside the Electron main process, bound to a
 * random free port on localhost, then loads the built web app in a window.
 * All data lives in %APPDATA%/Mise/data via the embedded Postgres (PGlite).
 */

const { app, BrowserWindow, dialog, shell, Menu } = require('electron')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

// Pins the userData folder to %APPDATA%/Mise in both dev and packaged builds.
app.setName('Mise')

const isDev = !app.isPackaged
const appRoot = isDev ? path.join(__dirname, '..') : path.join(process.resourcesPath, 'app')

// Must be set before the server modules are imported.
process.env.DATA_DIR = path.join(app.getPath('userData'), 'data')
process.env.NODE_ENV = isDev ? 'development' : 'production'

let mainWindow = null
let httpServer = null

async function startServer() {
  const appModule = await import(pathToFileURL(path.join(appRoot, 'server', 'dist', 'app.js')).href)
  const dbModule = await import(pathToFileURL(path.join(appRoot, 'server', 'dist', 'db.js')).href)
  const seedModule = await import(pathToFileURL(path.join(appRoot, 'server', 'dist', 'lib', 'seed.js')).href)

  const db = await dbModule.getDb()

  // First launch: fill the empty database so the window is not a blank app.
  if (await seedModule.seedIfEmpty(db)) {
    console.log('[desktop] demo menu, tables and staff seeded')
  }

  const expressApp = appModule.createApp()

  const server = await new Promise((resolve, reject) => {
    const instance = expressApp.listen(0, '127.0.0.1', () => resolve(instance))
    instance.on('error', reject)
  })

  return { server, db }
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 620,
    backgroundColor: '#f6f2ea',
    title: 'Mise — Restaurant Manager',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // External links open in the default browser, never inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    shell.openExternal(target)
    return { action: 'deny' }
  })

  mainWindow.loadURL(url)
}

// A second launch would fight the first one over the database lock.
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null)

    try {
      const { server } = await startServer()
      httpServer = server
      const { port } = server.address()
      console.log(`[desktop] api on http://127.0.0.1:${port}`)
      console.log(`[desktop] data in ${process.env.DATA_DIR}`)
      createWindow(`http://127.0.0.1:${port}`)
    } catch (error) {
      console.error(error)
      dialog.showErrorBox(
        'Mise could not start',
        `${error?.message ?? error}\n\nData folder: ${process.env.DATA_DIR}`,
      )
      app.quit()
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0 && httpServer) {
        const { port } = httpServer.address()
        createWindow(`http://127.0.0.1:${port}`)
      }
    })
  })

  app.on('window-all-closed', () => {
    app.quit()
  })

  app.on('before-quit', () => {
    if (httpServer) httpServer.close()
  })
}
