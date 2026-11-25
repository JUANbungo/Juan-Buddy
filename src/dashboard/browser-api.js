/* Browser fallback for the Electron BuddyAPI preload.
   Loaded only when there is no preload (GitHub Pages / plain browser).
   Runs the same engine with localStorage persistence. */
(function () {
  'use strict';
  if (window.BuddyAPI) return;

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

  function snapshot(toast) {
    return {
      state,
      derived: engine.derivedStats(state),
      settings: state.settings ? { ...state.settings } : null,
      toast: toast || null,
      openAtLogin: false,
    };
  }

  function broadcast(toast) {
    const snap = snapshot(toast);
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
        result = { ok: true, message: 'Login autostart is desktop-only.' };
        break;
      case 'openUrl':
        if (payload && typeof payload.url === 'string' && /^https:\/\//.test(payload.url)) {
          window.open(payload.url, '_blank');
          result = { ok: true };
        }
        break;
      case 'exitApp':
        result = { ok: true, message: 'Close the browser tab to exit.' };
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
    getState: () => snapshot(null),
    action: runAction,
    saveNow: () => { saveState(); return true; },
    onState: (cb) => { listeners.push(cb); },
    onEvent: () => {},
    getEvent: () => triggerMotivation('work_break'),
    isBrowser: true,
  };

  let last = Date.now();
  let motivationCountdown = 15 * 60;
  engine.addOfflineProgress(state);
  setInterval(() => {
    const now = Date.now();
    const dt = (now - last) / 1000;
    last = now;
    const events = engine.tick(state, dt, false) || [];
    for (const ev of events) {
      if (ev && ev.message) broadcast(ev.message);
    }
    broadcast(null);
    motivationCountdown -= dt;
    if (motivationCountdown <= 0) { motivationCountdown = 15 * 60; triggerMotivation('random_blessing'); }
    if (now % 30000 < 1000) saveState();
  }, 1000);
  window.addEventListener('beforeunload', saveState);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveState(); });
})();
