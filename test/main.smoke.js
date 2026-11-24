'use strict';

const path = require('path');
const os = require('os');
const Module = require('module');

const winStubs = [];
const handlers = {};
const listenerEvents = [];

class FakeWindow {
  constructor(opts) {
    this.opts = opts;
    this.webContents = { send: () => {} };
    this.isDestroyed = () => false;
    this.isVisible = () => true;
    this.show = () => {};
    this.hide = () => {};
    this.focus = () => {};
    this.setAlwaysOnTop = () => {};
    this.loadFile = () => Promise.resolve();
    this.on = () => {};
    winStubs.push(this);
  }
}

class FakeTray {
  setToolTip() {}
  setContextMenu() {}
  on() {}
}

const fakeApp = {
  getPath: () => path.join(os.tmpdir(), 'juan-buddy-smoke'),
  requestSingleInstanceLock: () => true,
  whenReady: () => Promise.resolve(),
  getLoginItemSettings: () => ({ openAtLogin: false }),
  setLoginItemSettings: () => {},
  quit: () => {},
  on: () => {},
  dock: undefined,
};

const electronStub = {
  app: fakeApp,
  BrowserWindow: Object.assign(FakeWindow, { getAllWindows: () => winStubs }),
  Tray: FakeTray,
  Menu: { buildFromTemplate: () => ({}) },
  ipcMain: {
    handle: (name, fn) => { handlers[name] = fn; },
    on: (name) => { listenerEvents.push(name); },
  },
  nativeImage: { createFromDataURL: () => ({}) },
  Notification: Object.assign(function () { this.show = () => {}; }, { isSupported: () => true }),
  screen: { getPrimaryDisplay: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) },
};

const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'electron' && parent) return electronStub;
  return origLoad.apply(this, arguments);
};

const fs = require('fs');
fs.rmSync(fakeApp.getPath(), { recursive: true, force: true });

require('../main.js');

setTimeout(async () => {
  let fail = null;
  try {
    if (winStubs.length < 1) throw new Error('pet window was not created');
    if (!handlers['buddy:get']) throw new Error('buddy:get handler missing');
    if (!handlers['buddy:action']) throw new Error('buddy:action handler missing');

    const snap = await handlers['buddy:get']();
    if (!snap || !snap.state || snap.state.pet.name !== 'Buddy') {
      throw new Error('snapshot invalid');
    }

    const feed = await handlers['buddy:action']({}, 'feed', { foodId: 'snack' });
    if (!feed.ok) throw new Error(`feed action failed: ${feed.message}`);

    const work = await handlers['buddy:action']({}, 'toggleWork', null);
    if (!work.ok) throw new Error(`toggleWork failed: ${work.message}`);

    const act1 = await handlers['buddy:action']({}, 'startActivity', { activityId: 'videoke' });
    if (!act1.ok) throw new Error(`startActivity failed: ${act1.message}`);

    const pick = await handlers['buddy:action']({}, 'setSpecies', { speciesId: 'tala' });
    if (!pick.ok) throw new Error(`setSpecies failed: ${pick.message}`);
    const snap2 = await handlers['buddy:get']();
    if (snap2.state.pet.species !== 'tala') throw new Error('species not applied');

    await handlers['buddy:saveNow']();
    const saveFile = path.join(fakeApp.getPath(), 'buddy-save.json');
    if (!fs.existsSync(saveFile)) throw new Error('save file not written');
    const parsed = JSON.parse(fs.readFileSync(saveFile, 'utf8'));
    if (parsed.meters.hunger <= 80) throw new Error('save did not reflect feeding');

  } catch (err) {
    fail = err;
  }
  if (fail) {
    console.error(`smoke FAIL: ${fail.message}`);
    process.exit(1);
  }
  console.log('smoke OK: windows created, IPC actions work, save file valid');
  process.exit(0);
}, 1500);
