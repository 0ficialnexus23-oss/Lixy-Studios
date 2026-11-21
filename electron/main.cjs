const { app, BrowserWindow, Menu } = require('electron')
const path = require('node:path')

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#111216',
    icon: path.join(__dirname, '..', 'public', 'lixy-logo.svg'),
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#17181d', symbolColor: '#c7c9d1', height: 38 },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  Menu.setApplicationMenu(null)
  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  } else {
    const url = process.env.ELECTRON_START_URL || 'http://127.0.0.1:5173'
    win.loadURL(url)
  }
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
