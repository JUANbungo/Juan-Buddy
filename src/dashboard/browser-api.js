/* Browser fallback for the Electron BuddyAPI preload.
   Loaded only when there is no preload (GitHub Pages / plain browser).
   Runs the same engine with localStorage persistence. */
(function () {
  'use strict';
  if (window.BuddyAPI) return;

  const CAP = window.Capacitor || null;
  const CAP_PLUGINS = CAP && CAP.Plugins ? CAP.Plugins : null;
  const isNative = () => !!(CAP && typeof CAP.isNativePlatform === 'function' && CAP.isNativePlatform());

  const notifStamps = { hunger: 0, energy: 0 };
  const NOTIF_COOLDOWN_MS = 30 * 60 * 1000;

  function pushNotification(title, body) {
    try {
      if (isNative() && CAP_PLUGINS.LocalNotifications && CAP_PLUGINS.LocalNotifications.schedule) {
        CAP_PLUGINS.LocalNotifications.schedule({
          notifications: [{ id: Date.now() % 1000000000, title, body }],
        });
        return;
      }
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(title, { body });
      }
    } catch (err) { /* notifications unavailable on this platform */ }
  }

  function requestNotificationPermission() {
    try {
      if (isNative() && CAP_PLUGINS.LocalNotifications && CAP_PLUGINS.LocalNotifications.requestPermissions) {
        CAP_PLUGINS.LocalNotifications.requestPermissions();
        return;
      }
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    } catch (err) { /* ignore */ }
  }
  document.addEventListener('pointerdown', requestNotificationPermission, { once: true, passive: true });

  function maybeNotify() {
    if (state.dead) return;
    const now = Date.now();
    const name = state.pet.name || 'Buddy';
    const send = (key, body) => {
      if (now - notifStamps[key] < NOTIF_COOLDOWN_MS) return;
      notifStamps[key] = now;
      pushNotification('Juan Buddy', body);
    };
    if (state.meters.hunger < 15 && !state.flags.sleeping) send('hunger', `${name} is really hungry! Time to feed.`);
    if (state.meters.energy < 10 && !state.flags.sleeping) send('energy', `${name} is exhausted. Let them sleep.`);
  }

  const engine = window.JBEngine;
  const sprites = window.JBSprites;
  const motivation = window.JBMotivation || null;
  const STORE_KEY = 'juanbuddy-save-v1';

  function loadState() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return engine.defaultState();
      const saved = JSON.parse(raw);
      const d = engine.defaultState();
      return engine.ensureState({ ...d, ...saved,
        pet: { ...d.pet, ...(saved.pet || {}) },
        meters: { ...d.meters, ...(saved.meters || {}) },
        flags: { ...d.flags, ...(saved.flags || {}) },
        upgrades: { ...d.upgrades, ...(saved.upgrades || {}) },
        activity: saved.activity || null,
        activityCooldowns: saved.activityCooldowns || {},
        effects: { ...d.effects, ...(saved.effects || {}) },
      });
    } catch (err) {
      return engine.defaultState();
    }
  }

  const state = loadState();
  const listeners = [];

  function saveState() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (err) { /* storage full/unavailable */ }
  }

  let pendingOfflineReport = null;

  function snapshot(toast, keepOffline) {
    const rep = pendingOfflineReport;
    if (!keepOffline && rep) pendingOfflineReport = null;
    return {
      state,
      derived: engine.derivedStats(state),
      settings: state.settings ? { ...state.settings } : null,
      toast: toast || null,
      openAtLogin: false,
      offlineReport: rep || null,
    };
  }

  function broadcast(toast) {
    const snap = snapshot(toast, true);
    for (const cb of listeners) {
      try { cb(snap); } catch (err) { /* listener error must not break tick */ }
    }
  }

  function setSpeciesId(speciesId) {
    const pet = sprites.getPetById(speciesId);
    if (!pet || pet.id !== speciesId) return false;
    state.pet.species = speciesId;
    return true;
  }

  async function triggerMotivation(context) {
    if (!motivation || !motivation.generatePetEvent) return null;
    const def = sprites.getPetById(state.pet.species);
    try {
      const event = await motivation.generatePetEvent({
        name: state.pet.name || (def && def.name) || 'Buddy',
        species: def ? def.species : '',
        country: def ? def.country : '',
        flag: def ? def.flag : '',
      }, context);
      if (event && event.bonusCoins > 0) state.coins += event.bonusCoins;
      saveState();
      return event;
    } catch (err) { return null; }
  }

  async function runAction(action, payload) {
    let result = { ok: false, message: 'Unknown action.' };
    switch (action) {
      case 'feed': result = engine.feed(state, payload && payload.foodId); break;
      case 'play': result = engine.play(state); break;
      case 'pat': result = engine.petPat(state); break;
      case 'toggleWork': result = engine.toggleWork(state); break;
      case 'toggleSleep': result = engine.toggleSleep(state); break;
      case 'buyUpgrade': result = engine.buyUpgrade(state, payload && payload.upgradeId); break;
      case 'startActivity': result = engine.startActivity(state, payload && payload.activityId, payload); break;
      case 'stopActivity': result = engine.stopActivity(state); break;
      case 'setSpecies':
        if (payload && typeof payload.speciesId === 'string' && setSpeciesId(payload.speciesId)) {
          result = { ok: true, message: 'Buddy chosen!' };
        } else {
          result = { ok: false, message: 'Unknown buddy.' };
        }
        break;
      case 'claimDaily': result = engine.claimDaily(state); break;
      case 'claimQuest': result = engine.claimQuest(state, payload ? payload.questId : undefined); break;
      case 'pullGacha': result = engine.pullGacha(state, payload && payload.times); break;
      case 'buyShopPet': result = engine.buyShopPet(state, payload && payload.petId); break;
      case 'pullGearGacha': result = engine.pullGearGacha(state, payload && payload.times); break;
      case 'allocateStat': result = engine.allocateStat(state, payload && payload.statId); break;
      case 'buyItem': result = engine.buyItem(state, payload && payload.itemId); break;
      case 'equipItem': result = engine.equipItem(state, payload && payload.itemId); break;
      case 'useEvoStone': result = engine.useEvoStone(state); break;
      case 'battleMonster': result = engine.battleMonster(state, payload && payload.monsterId); break;
    case 'arenaResult': result = engine.arenaResult(state, payload); break;
    case 'arenaRevive': result = engine.arenaRevive(state, payload); break;
      case 'buyGear': result = engine.buyGear(state, payload && payload.gearId); break;
      case 'equipGear': result = engine.equipGear(state, payload && payload.gearId); break;
      case 'choosePath': result = engine.choosePath(state, payload && payload.pathId); break;
      case 'cleanWaste': result = engine.cleanWaste(state, payload ? payload.index : undefined); break;
      case 'setSettings': result = engine.setSettings(state, payload); break;
      case 'choosePerk': result = engine.choosePerk(state, payload ? payload.index : undefined); break;
      case 'buySkin': result = engine.buySkin(state, payload && payload.skinId); break;
      case 'setSkin': result = engine.setSkin(state, payload && payload.skinId); break;
      case 'homeAction': result = engine.homeAction(state, payload); break;
      case 'farmAction': result = engine.farmAction(state, payload); break;
      case 'exportSave':
        result = { ok: true, code: engine.saveCode(state), message: 'Save code copied!' };
        break;
      case 'importSave':
        result = engine.importSave(state, payload && payload.code);
        break;
      case 'newGame': result = engine.newGame(state); break;
      case 'reaperReset': result = engine.reaperReset(state); break;
      case 'rename': {
        if (payload && typeof payload.name === 'string' && payload.name.trim().length > 0) {
          const milestoneFree = !!(state.milestones && state.milestones.rename60);
          if (!milestoneFree && state.coins < 10000) {
            result = { ok: false, message: 'Renaming costs 10,000 gold \u2014 keep working and battling!' };
          } else {
            if (!milestoneFree) state.coins -= 10000;
            state.pet.name = payload.name.trim().slice(0, 16);
            result = { ok: true, message: milestoneFree ? `Renamed to ${state.pet.name}.` : `Renamed to ${state.pet.name} for 10,000 gold.` };
          }
        }
        break;
      }
      case 'setOpenAtLogin':
        result = { ok: true, message: 'Login autostart is desktop-only.' };
        break;
      case 'openUrl':
        if (payload && typeof payload.url === 'string' && /^https:\/\//.test(payload.url)) {
          if (isNative() && CAP_PLUGINS.Browser && CAP_PLUGINS.Browser.open) {
            CAP_PLUGINS.Browser.open({ url: payload.url });
          } else {
            window.open(payload.url, '_blank');
          }
          result = { ok: true };
        }
        break;
      case 'exitApp':
        if (isNative() && CAP_PLUGINS.App && CAP_PLUGINS.App.exitApp) {
          CAP_PLUGINS.App.exitApp();
          result = { ok: true };
        } else {
          result = { ok: true, message: 'Close the browser tab to exit.' };
        }
        break;
      case 'adminAddDay': {
        if (!state.playdays) state.playdays = { last: null, count: 0 };
        state.playdays.count = (state.playdays.count || 0) + 1;
        const d = state.playdays.count;
        const unlocks = [];
        if (d === 3) unlocks.push('Cozy Bag');
        if (d === 7) unlocks.push('Battle + Stats');
        if (d === 14) unlocks.push('Gear Forge');
        if (d === 30) unlocks.push('Destiny Path');
        let msg = `ADMIN: +1 day → ${d} day${d === 1 ? '' : 's'} played.`;
        if (unlocks.length) msg += ' 🔓 ' + unlocks.join(', ') + ' unlocked!';
        result = { ok: true, message: msg };
        break;
      }
      case 'adminAddGold':
        result = engine.adminAddGold(state);
        break;
      case 'adminAddExp':
        result = engine.adminAddExp(state);
        break;
      case 'reset': {
        const fresh = engine.defaultState();
        Object.keys(state).forEach((key) => { delete state[key]; });
        Object.assign(state, fresh);
        state.flags.sleeping = false;
        state.flags.working = false;
        state.activity = null;
        state.activityCooldowns = {};
        saveState();
        broadcast(null);
        result = { ok: true, message: 'Progress reset.' };
        return result;
      }
      default: break;
    }
    try { saveState(); } catch (err) { /* ignore */ }
    broadcast(result && result.message ? result.message : null);
    return result;
  }

  window.JBDevReset = () => { localStorage.removeItem(STORE_KEY); };
  window.__JB_SAVE__ = saveState;

  window.BuddyAPI = {
    getState: () => Promise.resolve(snapshot(null)),
    action: (name, payload) => Promise.resolve(runAction(name, payload)),
    saveNow: () => { saveState(); return Promise.resolve(true); },
    onState: (cb) => { listeners.push(cb); },
    onEvent: () => {},
    getEvent: () => Promise.resolve(triggerMotivation('work_break')),
    isBrowser: true,
  };

  let last = Date.now();
  let motivationCountdown = 15 * 60;
  pendingOfflineReport = engine.addOfflineProgress(state);
  setInterval(() => {
    const now = Date.now();
    const dt = (now - last) / 1000;
    last = now;
    const events = engine.tick(state, dt, false) || [];
    for (const ev of events) {
      if (ev && ev.message) {
        broadcast(ev.message);
        if (ev.message.includes('passed away') || ev.message.includes('Achievement') || ev.message.includes('evolved') || ev.message.includes('hatched')) {
          pushNotification('Juan Buddy', ev.message);
        }
      }
    }
    broadcast(null);
    maybeNotify();
    motivationCountdown -= dt;
    if (motivationCountdown <= 0) { motivationCountdown = 15 * 60; triggerMotivation('random_blessing'); }
    if (now % 30000 < 1000) saveState();
  }, 1000);
  window.addEventListener('beforeunload', saveState);
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenAt = Date.now();
      saveState();
      return;
    }
    if (hiddenAt && Date.now() - hiddenAt > 30000) {
      hiddenAt = 0;
      const rep = engine.addOfflineProgress(state);
      if (rep) {
        pendingOfflineReport = rep;
        saveState();
        broadcast(null);
      }
    } else {
      hiddenAt = 0;
    }
  });
})();
