'use strict';

const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, Notification } = require('electron');
const engine = require('./src/engine/engine');
const motivation = require('./src/pet/motivation');

const isMac = process.platform === 'darwin';
let tray = null;
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
    const d = engine.defaultState();
    return { ...d, ...saved,
      pet: { ...d.pet, ...(saved.pet || {}) },
      meters: { ...d.meters, ...(saved.meters || {}) },
      flags: { ...d.flags, ...(saved.flags || {}) },
      upgrades: { ...d.upgrades, ...(saved.upgrades || {}) },
      activity: saved.activity || null,
      activityCooldowns: saved.activityCooldowns || {},
      effects: { ...d.effects, ...(saved.effects || {}) },
    };
  } catch (err) {
    return engine.defaultState();
  }
}

const state = engine.ensureState(loadState());

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
    case 'startActivity': result = engine.startActivity(state, payload && payload.activityId); break;
    case 'setSpecies':
      if (payload && typeof payload.speciesId === 'string' && setSpeciesId(payload.speciesId)) {
        result = { ok: true, message: 'Buddy chosen!' };
      } else {
        result = { ok: false, message: 'Unknown buddy.' };
      }
      break;
    case 'claimDaily': result = engine.claimDaily(state); break;
    case 'pullGacha': result = engine.pullGacha(state, payload && payload.times); break;
    case 'pullGearGacha': result = engine.pullGearGacha(state, payload && payload.times); break;
    case 'allocateStat': result = engine.allocateStat(state, payload && payload.statId); break;
    case 'buyItem': result = engine.buyItem(state, payload && payload.itemId); break;
    case 'equipItem': result = engine.equipItem(state, payload && payload.itemId); break;
    case 'useEvoStone': result = engine.useEvoStone(state); break;
    case 'battleMonster': result = engine.battleMonster(state, payload && payload.monsterId); break;
    case 'buyGear': result = engine.buyGear(state, payload && payload.gearId); break;
    case 'equipGear': result = engine.equipGear(state, payload && payload.gearId); break;
    case 'choosePath': result = engine.choosePath(state, payload && payload.pathId); break;
    case 'cleanWaste': result = engine.cleanWaste(state, payload ? payload.index : undefined); break;
    case 'setSettings': result = engine.setSettings(state, payload); break;
    case 'choosePerk': result = engine.choosePerk(state, payload ? payload.index : undefined); break;
    case 'buySkin': result = engine.buySkin(state, payload && payload.skinId); break;
    case 'setSkin': result = engine.setSkin(state, payload && payload.skinId); break;
    case 'exportSave':
      result = { ok: true, code: engine.saveCode(state), message: 'Save code copied!' };
      break;
    case 'importSave':
      result = engine.importSave(state, payload && payload.code);
      break;
    case 'newGame': result = engine.newGame(state); break;
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

function setSpeciesId(speciesId) {
  const { getPetById } = require('./src/pet/sprites');
  const pet = getPetById(speciesId);
  if (!pet || pet.id !== speciesId) return false;
  state.pet.species = speciesId;
  return true;
}

async function triggerMotivation(context) {
  const { getPetById } = require('./src/pet/sprites');
  const def = getPetById(state.pet.species);
  const petInfo = {
    name: state.pet.name || def.name,
    species: def.species,
    country: def.country,
    flag: def.flag,
  };
  const event = await motivation.generatePetEvent(petInfo, context);
  if (event.bonusCoins > 0) {
    state.coins += event.bonusCoins;
    dirty = true;
  }
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('buddy:event', event);
  }
  updateTrayTooltip();
  return event;
}

function resetState() {
  const fresh = engine.defaultState();
  Object.keys(state).forEach((key) => { delete state[key]; });
  Object.assign(state, fresh);
  state.flags.sleeping = false;
  state.flags.working = false;
  state.activity = null;
  state.activityCooldowns = {};
  saveState();
  return { ok: true, message: 'Progress reset.' };
}

function createDashboardWindow() {
  if (dashboardWindow && !dashboardWindow.isDestroyed()) {
    dashboardWindow.show();
    dashboardWindow.focus();
    return;
  }
  dashboardWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 760,
    minHeight: 600,
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
  let motivationCountdown = 15 * 60; 
  tickTimer = setInterval(() => {
    const now = Date.now();
    const dt = (now - last) / 1000;
    last = now;
    const tickEvents = engine.tick(state, dt, false);
    for (const ev of tickEvents) {
      if (!ev || !ev.message) continue;
      broadcastState(ev.message);
      if (Notification.isSupported() && (ev.message.includes('passed away') || ev.message.includes('Achievement') || ev.message.includes('evolved') || ev.message.includes('hatched'))) {
        const note = new Notification({ title: 'Juan Buddy', body: ev.message, silent: false });
        note.on('click', createDashboardWindow);
        note.show();
      }
      if (ev.message.includes('passed away')) saveState();
    }
    dirty = true;
    broadcastState(null);
    maybeNotify();
    motivationCountdown -= dt;
    if (motivationCountdown <= 0) {
      motivationCountdown = 15 * 60;
      triggerMotivation('random_blessing');
    }
    if (now % 30000 < 1000) saveState();
  }, 1000);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    dashboardWindow ? dashboardWindow.focus() : createDashboardWindow();
  });

  app.whenReady().then(() => {
    ipcMain.handle('buddy:get', () => fullStateSnapshot());
    ipcMain.handle('buddy:action', (_event, action, payload) => runAction(action, payload));
    ipcMain.handle('buddy:saveNow', () => { saveState(); return true; });
    ipcMain.handle('buddy:getEvent', async () => {
      const event = await triggerMotivation('work_break');
      return event;
    });

    const { ICON_PNG_BASE64 } = require('./assets/icons');
    if (process.platform === 'darwin' && app.dock) {
      app.dock.setIcon(nativeImage.createFromDataURL(`data:image/png;base64,${ICON_PNG_BASE64}`));
    }

    createTray();
    createDashboardWindow();
    startTicking();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createDashboardWindow();
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
