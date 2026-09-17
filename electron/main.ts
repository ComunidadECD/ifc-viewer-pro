import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Visualizador IFC Pro - BIM 2.3 & 4',
    backgroundColor: '#090d16',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    },
    autoHideMenuBar: true,
    show: false
  });

  mainWindow.maximize();
  mainWindow.show();

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Native file dialogs
ipcMain.handle('dialog:openIFC', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Abrir archivo IFC (2.3 / 4)',
    properties: ['openFile'],
    filters: [
      { name: 'Modelos IFC (*.ifc)', extensions: ['ifc'] },
      { name: 'Todos los archivos', extensions: ['*'] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);
  const fileSize = fs.statSync(filePath).size;

  return {
    filePath,
    fileName,
    fileSize,
    buffer: fileBuffer.buffer
  };
});

ipcMain.handle('dialog:saveFile', async (_event, { defaultName, buffer, filters }) => {
  if (!mainWindow) return false;
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
    filters: filters || [{ name: 'Todos los archivos', extensions: ['*'] }]
  });

  if (result.canceled || !result.filePath) {
    return false;
  }

  fs.writeFileSync(result.filePath, Buffer.from(buffer));
  return true;
});
