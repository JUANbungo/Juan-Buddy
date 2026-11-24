'use strict';

const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, Notification } = require('electron');
const engine = require('./src/engine/engine');

const isMac = process.platform === 'darwin';
let tray = null;
let petWindow = null;
let dashboardWindow = null;
let tickTimer = null;
let dirty = false;

const savePath = () => path.join(app.getPath('userData'), 'buddy-save.json');
const notifStamps = { hunger: 0, energy: 0 };
const NOTIF_COOLDOWN_MS = 30 * 60 * 1000;

function loadState() {
  try {
    const raw = fs.readFileSync(savePath(), 'utf8');
    const saved = JSON.parse(raw);
    return { ...engine.defaultState(), ...saved,
      pet: { ...engine.defaultState().pet, ...(saved.pet || {}) },
      meters: { ...engine.defaultState().meters, ...(saved.meters || {}) },
      flags: { ...engine.defaultState().flags, ...(saved.flags || {}) },
      upgrades: { ...engine.defaultState().upgrades, ...(saved.upgrades || {}) },
    };
  } catch (err) {
    return engine.defaultState();
  }
}

const state = loadState();

function saveState() {
  try {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(savePath(), JSON.stringify(state));
    dirty = false;
  } catch (err) {
    console.error('Failed to save:', err);
  }
}

function broadcastState(toast) {
  const payload = () => fullStateSnapshot(toast);
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('buddy:state', payload());
  }
  updateTrayTooltip();
}

function runAction(action, payload) {
  let result = { ok: false, message: 'Unknown action.' };
  switch (action) {
    case 'feed': result = engine.feed(state, payload && payload.foodId); break;
    case 'play': result = engine.play(state); break;
    case 'pat': result = engine.petPat(state); break;
    case 'toggleWork': result = engine.toggleWork(state); break;
    case 'toggleSleep': result = engine.toggleSleep(state); break;
    case 'buyUpgrade': result = engine.buyUpgrade(state, payload && payload.upgradeId); break;
    case 'rename':
      if (payload && typeof payload.name === 'string' && payload.name.trim().length > 0) {
        state.pet.name = payload.name.trim().slice(0, 16);
        result = { ok: true, message: `Renamed to ${state.pet.name}.` };
      }
      break;
    case 'setOpenAtLogin':
      app.setLoginItemSettings({ openAtLogin: !!(payload && payload.open) });
      result = { ok: true, message: payload && payload.open ? 'Will open at login.' : 'Autostart disabled.' };
      break;
    case 'reset':
      result = resetState();
      break;
    default: break;
  }
  dirty = true;
  broadcastState(result.message || null);
  return result;
}

function fullStateSnapshot(toast) {
  return {
    state,
    derived: engine.derivedStats(state),
    toast: toast || null,
    openAtLogin: app.getLoginItemSettings().openAtLogin,
  };
}

function resetState() {
  const fresh = engine.defaultState();
  Object.keys(state).forEach((key) => { delete state[key]; });
  Object.assign(state, fresh);
  state.flags.sleeping = false;
  state.flags.working = false;
  saveState();
  return { ok: true, message: 'Progress reset.' };
}

function createPetWindow() {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.show();
    return;
  }
  const { screen } = require('electron');
  const display = screen.getPrimaryDisplay();
  const workArea = display.workArea;
  petWindow = new BrowserWindow({
    width: 240,
    height: 280,
    x: workArea.x + workArea.width - 300,
    y: workArea.y + workArea.height - 320,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  petWindow.setAlwaysOnTop(true, 'screen-saver');
  petWindow.loadFile(path.join(__dirname, 'src', 'pet', 'index.html'));
  petWindow.on('closed', () => { petWindow = null; });
}

function createDashboardWindow() {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.show();
    dashboardWindow.focus();
    return;
  }
  dashboardWindow = new BrowserWindow({
    width: 400,
    height: 640,
    resizable: true,
    title: 'Juan Buddy',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  dashboardWindow.loadFile(path.join(__dirname, 'src', 'dashboard', 'index.html'));
  dashboardWindow.on('closed', () => { dashboardWindow = null; });
}

function trayIcon() {
  const { TRAY_PNG_BASE64 } = require('./assets/icons');
  return nativeImage.createFromDataURL(`data:image/png;base64,${TRAY_PNG_BASE64}`);
}

function updateTrayTooltip() {
  if (tray) tray.setToolTip(`Juan Buddy — ${engine.statusText(state)}`);
}

function createTray() {
  tray = new Tray(trayIcon());
  const menu = Menu.buildFromTemplate([
    { label: 'Open Dashboard', click: createDashboardWindow },
    { label: 'Show / Hide Buddy', click: () => {
      if (!petWindow || petWindow.isDestroyed()) createPetWindow();
      else if (petWindow.isVisible()) petWindow.hide();
      else petWindow.show();
    } },
    { type: 'separator' },
    { label: 'Open at login', type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }) },
    { type: 'separator' },
    { label: 'Quit Juan Buddy', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
  tray.on('double-click', createDashboardWindow);
  updateTrayTooltip();
}

function maybeNotify() {
  if (!Notification.isSupported()) return;
  const now = Date.now();
  const name = state.pet.name;
  const send = (key, body) => {
    if (now - notifStamps[key] < NOTIF_COOLDOWN_MS) return;
    notifStamps[key] = now;
    new Notification({ title: 'Juan Buddy', body }).show();
  };
  if (state.meters.hunger < 15 && !state.flags.sleeping) send('hunger', `${name} is really hungry! Time to feed.`);
  if (state.meters.energy < 10 && !state.flags.sleeping) send('energy', `${name} is exhausted. Let them sleep.`);
}

function startTicking() {
  if (tickTimer) clearInterval(tickTimer);
  let last = Date.now();
  engine.addOfflineProgress(state);
  tickTimer = setInterval(() => {
    const now = Date.now();
    const dt = (now - last) / 1000;
    last = now;
    engine.tick(state, dt, false);
    dirty = true;
    broadcastState(null);
    maybeNotify();
    if (now % 30000 < 1000) saveState();
  }, 1000);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    createPetWindow();
    dashboardWindow ? dashboardWindow.focus() : createDashboardWindow();
  });

  app.whenReady().then(() => {
    ipcMain.handle('buddy:get', () => fullStateSnapshot());
    ipcMain.handle('buddy:action', (_event, action, payload) => runAction(action, payload));
    ipcMain.handle('buddy:saveNow', () => { saveState(); return true; });
    ipcMain.on('pet:openDashboard', createDashboardWindow);
    ipcMain.on('pet:hide', () => { if (petWindow) petWindow.hide(); });

    const { ICON_PNG_BASE64 } = require('./assets/icons');
    if (process.platform === 'darwin' && app.dock) {
      app.dock.setIcon(nativeImage.createFromDataURL(`data:image/png;base64,${ICON_PNG_BASE64}`));
    }

    createTray();
    createPetWindow();
    startTicking();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createPetWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (isMac) return;
});

app.on('before-quit', () => {
  saveState();
  if (tickTimer) clearInterval(tickTimer);
});
