'use strict';

const api = window.BuddyAPI;
const sprites = window.JBSprites;
const sfx = window.JBSfx;
const bgm = window.JBBgm;
const sfxLast = {};
let smoothGraphics = false;
let bgmOverride = null;
let bgmOverrideUntil = 0;
let bgmStarted = false;

function smoothOfSettings(st) {
  return !!(st && st.pixelGraphics === false);
}

function applyGraphics(smooth) {
  smoothGraphics = !!smooth;
  if (typeof document !== 'undefined' && document.body && document.body.classList) {
    document.body.classList.toggle('smooth-gfx', smoothGraphics);
  }
}

function setBgmOverride(name, ms) {
  if (!bgm) return;
  bgmOverride = name;
  bgmOverrideUntil = Date.now() + ms;
  bgm.play(name);
}

function ensureBgm() {
  if (!bgm || !bgm.getEnabled()) return;
  const st = latest && latest.settings ? latest.settings : null;
  if (st && st.bgmOn === false) return;
  if (bgmOverride && Date.now() < bgmOverrideUntil) {
    if (bgm.nowPlaying() !== bgmOverride) bgm.play(bgmOverride);
    return;
  }
  bgmOverride = null;
  bgm.play(bgm.ambientForHour());
}

function startBgmOnGesture() {
  if (bgmStarted) return;
  bgmStarted = true;
  ensureBgm();
  setInterval(() => {
    if (bgmOverride && Date.now() >= bgmOverrideUntil) bgmOverride = null;
    ensureBgm();
  }, 10000);
}

function paintSettingsControls(st) {
  if (!st) return;
  const bgmToggle = el('btn-bgm-toggle');
  const gfxToggle = el('btn-gfx-toggle');
  const bgmRange = el('set-bgm');
  const sfxRange = el('set-sfx');
  if (bgmToggle) bgmToggle.textContent = st.bgmOn ? '🎵 Music: On' : '🔇 Music: Off';
  if (gfxToggle) gfxToggle.textContent = st.pixelGraphics ? '🎨 Pixel-perfect' : '🌫️ Smooth';
  if (bgmRange && document.activeElement !== bgmRange) bgmRange.value = String(Math.round((st.bgmVol || 0.5) * 100));
  if (sfxRange && document.activeElement !== sfxRange) sfxRange.value = String(Math.round((st.sfxVol || 0.7) * 100));
}

function namedAlready() {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('juanbuddy-named') === '1';
  } catch (err) { return false; }
}

function maybeShowNameModal() {
  const modal = el('name-modal');
  if (!modal || namedAlready() || !latest) return;
  const s = latest.state;
  if (s && s.pet && s.pet.name === 'Buddy' && s.pet.stage === 'egg') modal.classList.remove('hidden');
}

function sfxOnce(name) {
  if (!sfx) return;
  const now = Date.now();
  if (sfxLast[name] && now - sfxLast[name] < 1200) return;
  sfxLast[name] = now;
  sfx.play(name);
}

function playActionSound(action, res) {
  if (!sfx) return;
  if (!res || res.ok === false) {
    sfxOnce('error');
    return;
  }
  const map = {
    feed: 'feed', play: 'happy', pat: 'pat', buyUpgrade: 'buy', buySkin: 'buy',
    setSkin: 'happy', claimDaily: 'daily', newGame: 'hatch', startActivity: 'click',
    toggleWork: 'click', toggleSleep: 'click', exportSave: 'click', importSave: 'click',
    rename: 'click', setSpecies: 'happy',
    battleMonster: 'happy', allocateStat: 'levelup', buyGear: 'buy', equipGear: 'happy',
    pullGearGacha: 'coin', choosePath: 'achv', cleanWaste: 'click',
    buyItem: 'buy', equipItem: 'happy', useEvoStone: 'evolve',
  };
  sfxOnce(map[action] || 'click');
}
const UPGRADE_META = {
  bed: { icon: '🛏', title: 'Cozy Bed', desc: 'Energy drains 12% slower per level' },
  toys: { icon: '🧸', title: 'Toy Box', desc: 'Playing gives +25% happiness per level' },
  job: { icon: '📈', title: 'Job Promotion', desc: '+60% coins per level while working' },
  feeder: { icon: '🍽', title: 'Auto-Feeder', desc: 'Auto-feeds a Snack below 20 hunger' },
};
const UPGRADE_MAX = { bed: 5, toys: 5, job: 10, feeder: 1 };

let latest = null;
let toastTimer = null;

const FOOD_PNG_BASE = '../../assets/sprites/food/';
const foodImages = {};

function foodImage(id) {
  if (!(id in foodImages)) {
    const img = new Image();
    foodImages[id] = img;
    img.onload = () => {
      const cv = img._canvas;
      if (cv) drawFoodIcon(cv, id);
    };
    img.onerror = () => { foodImages[id] = null; };
    img.src = `${FOOD_PNG_BASE}${id}.png`;
  }
  return foodImages[id];
}

function drawFoodIcon(canvasEl, id) {
  const cctx = canvasEl.getContext('2d');
  cctx.imageSmoothingEnabled = false;
  cctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  const img = foodImage(id);
  if (img && img.complete && img.naturalWidth > 0) {
    cctx.drawImage(img, 0, 0, canvasEl.width, canvasEl.height);
    return;
  }
  cctx.drawImage(sprites.ensureFoodSprite(id), 0, 0, canvasEl.width, canvasEl.height);
}

const el = (id) => document.getElementById(id);

function showToast(msg, ms) {
  if (!msg) return;
  const t = el('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  t.style.whiteSpace = 'pre-line';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), ms || 2200);
}

function pct(v) {
  return `${Math.round(v)}%`;
}

async function act(action, payload) {
  const res = await api.action(action, payload);
  playActionSound(action, res);
  showToast(res && res.message);
  return res;
}

function render(snapshot) {
  latest = snapshot;
  const { state: s, derived: d, toast } = snapshot;

  if (d.settings) {
    paintSettingsControls(d.settings);
    const wantSmooth = smoothOfSettings(d.settings);
    if (wantSmooth !== smoothGraphics) applyGraphics(wantSmooth);
  }
  maybeShowNameModal();

  if (toast && sfx) {
    const msg = String(toast);
    if (msg.includes('Achievement')) sfxOnce('achv');
    else if (msg.includes('hatched')) sfxOnce('hatch');
    else if (msg.includes('evolved')) sfxOnce('evolve');
    else if (msg.includes('passed away')) sfxOnce('death');
    else if (msg.includes('Daily bonus')) sfxOnce('daily');
  }

  el('pet-name').textContent = s.pet.name;
  el('level').textContent = s.pet.level;
  el('xp-text').textContent = `${Math.floor(s.pet.xp)} / ${d.nextLevelXp} XP`;
  el('xp-fill').style.width = pct(Math.min(100, (s.pet.xp / d.nextLevelXp) * 100));

  el('coins').textContent = Math.floor(s.coins);
  el('coin-rate').textContent = s.flags.working ? `+${d.coinRate.toFixed(1)}/s` : 'not working';

  setMeter('hunger', s.meters.hunger);
  setMeter('energy', s.meters.energy);
  setMeter('happy', s.meters.happiness);

  const pill = el('status-pill');
  pill.textContent = d.buffLabel ? `${d.statusText} · ${d.buffLabel}` : d.statusText;
  pill.classList.toggle('active', s.flags.working || s.flags.sleeping);

  const stateBadge = el('play-state');
  const t = Date.now();
  stateBadge.textContent = s.flags.sleeping ? 'SLEEPING'
    : s.effects.eatUntil > t ? 'EATING'
    : s.effects.happyUntil > t ? 'HAPPY'
    : s.activity ? 'ON ACTIVITY'
    : s.flags.working ? 'WORKING'
    : (d.statusText || 'IDLE').toUpperCase();

  if (d.weather) el('weather-chip').textContent = `${d.weather.icon} ${d.weather.label}`;
  if (d.phase) el('phase-chip').textContent = `${d.phase.icon} ${d.phase.label}`;
  el('streak-chip').textContent = `\uD83D\uDD25 ${d.daily ? d.daily.streak : 0}`;

  el('danger-banner').classList.toggle('hidden', !s.dead && !(d.danger > 0.25));
  el('death-overlay').classList.toggle('hidden', !s.dead);
  if (s.dead) {
    el('death-title').textContent = `${s.pet.name} passed away...`;
    el('death-cause').textContent = `Cause: ${s.dead.cause} — reached Lv ${s.dead.level}`;
  }

  renderExtras(d);
  renderRpg(d);
  renderExplore(d);
  renderBag(d);

  if (d.rpg.items.evolved && !evoTrack.shown) {
    evoTrack.shown = true;
    showEvoPopup(s.pet.species);
  } else if (!d.rpg.items.evolved) {
    evoTrack.shown = false;
  }

  el('btn-work').textContent = s.flags.working ? '💼 Working...' : '💼 Work: Off';
  el('btn-work').classList.toggle('on', s.flags.working);
  el('btn-sleep').textContent = s.flags.sleeping ? '😴 Sleeping...' : '😴 Sleep: Off';
  el('btn-sleep').classList.toggle('on', s.flags.sleeping);

  el('btn-play').disabled = s.flags.sleeping || s.meters.energy < 8;

  renderShop(s, d);
  renderFoods(s, d);
  renderActivities(s, d);
  renderBuddyPicker(s);
  if (toast) showToast(toast);
}

const FOOD_EMOJI = { pad_thai: '🍜', bamboo_stalks: '🎍', khao_lam: '🎋', mango_sticky_rice: '🥭' };
const foodState = { filter: 'all', query: '' };
const foodCards = {};
let filterChips = null;

function regionGroup(country) {
  if (country === 'Philippines') return 'ph';
  if (country === 'India') return 'india';
  return ['Thailand', 'Vietnam', 'Laos', 'Cambodia', 'Malaysia', 'Indonesia', 'Singapore', 'Myanmar', 'Brunei'].includes(country) ? 'asean' : 'world';
}

function renderFoodFilters() {
  const bar = el('food-filters');
  if (!filterChips) {
    filterChips = {};
    const defs = [
      ['all', '✨ All'],
      ['ph', '🇵🇭 PH Favorites'],
      ['asean', '🌴 SE Asia'],
      ['india', '🇮🇳 India'],
      ['world', '🌏 World'],
    ];
    for (const [key, label] of defs) {
      const chip = document.createElement('button');
      chip.className = 'filter-chip';
      chip.textContent = label;
      chip.addEventListener('click', () => {
        foodState.filter = key;
        renderFoodFilters();
      });
      bar.appendChild(chip);
      filterChips[key] = chip;
    }
  }
  for (const [key, chip] of Object.entries(filterChips)) {
    chip.classList.toggle('on', foodState.filter === key);
  }
}

function renderFoods(s, d) {
  const grid = el('food-grid');
  const fav = sprites.getPetById(s.pet.species);
  renderFoodFilters();
  for (const del of sprites.DELICACIES) {
    const group = regionGroup(del.country);
    const matchesRegion = foodState.filter === 'all' || foodState.filter === group;
    const matchesQuery = !foodState.query
      || del.name.toLowerCase().includes(foodState.query)
      || del.country.toLowerCase().includes(foodState.query);
    let card = foodCards[del.id];
    if (!card) {
      card = document.createElement('div');
      card.className = 'food-card';
      card.dataset.food = del.id;
      const icon = document.createElement('canvas');
      icon.width = 32;
      icon.height = 32;
      foodImage(del.id)._canvas = icon;
      try {
        drawFoodIcon(icon, del.id);
      } catch (err) {
        const fb = document.createElement('div');
        fb.className = 'food-icon-fallback';
        fb.textContent = FOOD_EMOJI[del.id] || '🍽';
        card.appendChild(fb);
      }
      const mid = document.createElement('div');
      mid.innerHTML = `<div class="f-name"></div><div class="f-meta"></div><div class="f-fav-tag"></div>`;
      const btn = document.createElement('button');
      btn.className = 'btn f-feed';
      btn.addEventListener('click', () => act('feed', { foodId: del.id }));
      card.appendChild(icon);
      card.appendChild(mid);
      card.appendChild(btn);
      card._els = {
        name: mid.querySelector('.f-name'),
        meta: mid.querySelector('.f-meta'),
        favTag: mid.querySelector('.f-fav-tag'),
        btn,
      };
      grid.appendChild(card);
      foodCards[del.id] = card;
    }
    const isFav = fav && fav.favoriteFood === del.id;
    card.style.display = matchesRegion && matchesQuery ? '' : 'none';
    card.classList.toggle('fav', isFav);
    card._els.name.textContent = `${del.flag || ''} ${del.name}`;
    card._els.meta.textContent = `🍖${del.hunger} · 💖${del.happy}${del.energy ? ` · ⚡${del.energy}` : ''}${del.buff ? ` · ${del.buff.label}` : ''}`;
    card._els.favTag.textContent = isFav ? '★ ' + fav.name + "'s favorite!" : '';
    const afford = s.coins >= del.cost;
    card._els.btn.textContent = del.cost === 0 ? 'FREE' : `🪙${del.cost}`;
    card._els.btn.disabled = s.flags.sleeping || !afford || s.meters.hunger >= 99;
  }
}

let activityIndex = null;

function renderActivities(s, d) {
  const list = el('activities');
  if (!activityIndex) activityIndex = {};
  for (const a of d.activities) {
    let row = activityIndex[a.id];
    if (!row) {
      row = document.createElement('div');
      row.className = 'activity-item';
      row.innerHTML = `
        <div>
          <div class="a-name"></div>
          <div class="a-desc"></div>
          <div class="a-rewards"></div>
        </div>
        <button class="btn a-btn"></button>
        <div class="activity-progress"><div class="pfill"></div></div>`;
      row.querySelector('.a-btn').addEventListener('click', () => act('startActivity', { activityId: a.id }));
      list.appendChild(row);
      activityIndex[a.id] = row;
    }
    row.querySelector('.a-name').textContent = `${a.icon} ${a.name}`;
    row.querySelector('.a-desc').textContent = a.desc;
    row.querySelector('.a-rewards').textContent =
      `⚡${a.energy} · 🪙${a.coins[0]}–${a.coins[1]} · +${a.xp} XP · ${a.duration}s · CD ${a.cooldown}s`;
    const btn = row.querySelector('.a-btn');
    const anyActive = d.activities.some((x) => x.active);
    if (a.active) {
      btn.disabled = true;
      btn.textContent = 'Busy...';
    } else if (a.cooldownRemainingMs > 0) {
      btn.disabled = true;
      btn.textContent = `${Math.ceil(a.cooldownRemainingMs / 1000)}s`;
    } else {
      btn.disabled = s.flags.sleeping || !!anyActive || s.meters.energy < a.energy;
      btn.textContent = 'Start';
    }
    const prog = row.querySelector('.activity-progress');
    if (a.active) {
      prog.classList.add('on');
      prog.querySelector('.pfill').style.width = pct(Math.max(0, Math.min(100,
        100 - ((a.endsAt - Date.now()) / (a.duration * 1000)) * 100)));
    } else {
      prog.classList.remove('on');
    }
    row.classList.toggle('active', a.active);
  }
}

let buddyTilesBuilt = false;

function renderBuddyPicker(s) {
  const grid = el('buddy-grid');
  if (!buddyTilesBuilt) {
    for (const p of sprites.PET_ROSTER) {
      const tile = document.createElement('div');
      tile.className = 'buddy-tile';
      tile.dataset.species = p.id;
      tile.title = p.description || p.species;
      if (s.pet.species === p.id) tile.classList.add('selected');
      else if (s.pet.stage === 'egg') tile.classList.add('mystery');
      const cv = document.createElement('canvas');
      cv.width = 32;
      cv.height = 32;
      try {
        const bank = sprites.ensurePetSprites(p.id);
        const cctx = cv.getContext('2d');
        cctx.imageSmoothingEnabled = false;
        cctx.drawImage(bank.IDLE[0], 0, 0, 32, 32);
      } catch (err) { /* preview only */ }
      const name = document.createElement('span');
      name.className = 'b-name';
      name.textContent = p.name;
      const flag = document.createElement('span');
      flag.className = 'b-flag';
      flag.textContent = `${p.flag || ''} ${p.country}`;
      tile.appendChild(cv);
      tile.appendChild(name);
      tile.appendChild(flag);
      grid.appendChild(tile);
    }
    buddyTilesBuilt = true;
  }
  for (const tile of grid.children) {
    tile.classList.toggle('selected', tile.dataset.species === s.pet.species);
  }
}

function setMeter(prefix, value) {
  el(`${prefix}-fill`).style.width = pct(value);
  el(`${prefix}-val`).textContent = `${Math.round(value)}%`;
}

function renderShop(s, d) {
  const shop = el('shop');
  for (const id of Object.keys(UPGRADE_META)) {
    const meta = UPGRADE_META[id];
    const lvl = s.upgrades[id];
    const maxed = lvl >= UPGRADE_MAX[id];
    const cost = d.upgradeCosts[id];
    let card = shop.querySelector(`[data-upgrade="${id}"]`);
    if (!card) {
      card = document.createElement('div');
      card.className = 'shop-item';
      card.dataset.upgrade = id;
      card.innerHTML = `
        <div class="name"></div>
        <div class="desc"></div>
        <button class="btn buy-btn"></button>`;
      card.querySelector('.buy-btn').addEventListener('click', () => act('buyUpgrade', { upgradeId: id }));
      shop.appendChild(card);
    }
    card.querySelector('.name').innerHTML = `${meta.icon} ${meta.title}
      <span class="lvl-tag">Lv ${lvl}${maxed ? ' (MAX)' : ''}</span>`;
    card.querySelector('.desc').textContent = meta.desc;
    const btn = card.querySelector('.buy-btn');
    btn.disabled = maxed || s.coins < cost;
    btn.textContent = maxed ? 'Maxed out' : `Upgrade — 🪙${cost}`;
  }
}

el('food-search').addEventListener('input', (e) => {
  foodState.query = e.target.value.trim().toLowerCase();
  if (latest) renderFoods(latest.state, latest.derived);
});

el('btn-play').addEventListener('click', () => act('play'));
el('btn-work').addEventListener('click', () => act('toggleWork'));
el('btn-sleep').addEventListener('click', () => act('toggleSleep'));
el('btn-cheer').addEventListener('click', async () => {
  const ev = await window.BuddyAPI.getEvent();
  if (ev && ev.native) showToast(`✨ ${ev.native}\n${ev.romanization ? '(' + ev.romanization + ') — ' : ''}${ev.translation}`, 5000);
});

el('pet-name').addEventListener('click', () => {
  const name = window.prompt('Rename your buddy:', latest ? latest.state.pet.name : 'Buddy');
  if (name) act('rename', { name });
});

el('open-login').addEventListener('change', (e) => {
  api.action('setOpenAtLogin', { open: e.target.checked });
});

el('btn-reset').addEventListener('click', async () => {
  if (!window.confirm('Reset all progress? This cannot be undone.')) return;
  await api.action('reset');
  showToast('Progress reset.');
});

api.onState(render);
api.getState().then((snap) => {
  if (snap) el('open-login').checked = !!snap.openAtLogin;
  render(snap);
});

const petStageCanvas = document.getElementById('dash-pet');
const stageCtx = petStageCanvas.getContext('2d');

const STAGE_W = 480;
const STAGE_H = 360;
const STAGE_CX = 240;
const STAGE_GROUND = 284;
const WALK_Y_MIN = 286;
const WALK_Y_MAX = 348;

const petWalk = { x: STAGE_CX, y: 312, dir: 1, target: null, moving: false };
const stageFx = [];
let lastStageNow = 0;
let petDraw = { cx: STAGE_CX, size: 264, dir: 1 };

function spawnFx(kind, x, y, opts) {
  const o = opts || {};
  stageFx.push({ kind, x, y, vy: o.vy !== undefined ? o.vy : -0.5, life: 1, size: o.size || 16, wobble: Math.random() * 6 });
}

const STAGE_STATE_FILE = { IDLE: 'idle', WALK: 'walk', HAPPY: 'happy', EAT: 'eat', SLEEP: 'sleep' };
const stageFrames = {};

function stageFramesFor(id, state) {
  const key = `${id}_${state}`;
  if (!(key in stageFrames)) {
    const sf = STAGE_STATE_FILE[state];
    const imgs = [];
    for (let f = 0; f < 4; f += 1) {
      const img = new Image();
      img.onerror = () => { img.bad = true; };
      img.src = `../../assets/sprites/${id}_${sf}_${f}.png`;
      imgs.push(img);
    }
    stageFrames[key] = imgs;
  }
  return stageFrames[key].filter((i) => !i.bad && i.complete && i.naturalWidth > 0);
}

const stageSingle = {};

const eggSprite = new Image();
eggSprite.onerror = () => { eggSprite.bad = true; };
eggSprite.src = '../../assets/sprites/egg.png';

function stageSingleFor(id, state) {
  const key = `${id}_${STAGE_STATE_FILE[state]}`;
  if (!(key in stageSingle)) {
    const img = new Image();
    img.onerror = () => { stageSingle[key] = null; };
    img.src = `../../assets/sprites/${key}.png`;
    stageSingle[key] = img;
  }
  const img = stageSingle[key];
  return img && img.complete && img.naturalWidth > 0 ? img : null;
}

const evoSingle = {};

function evoSingleFor(id, state) {
  const key = `${id}_evo_${STAGE_STATE_FILE[state]}`;
  if (!(key in evoSingle)) {
    const img = new Image();
    img.onerror = () => { evoSingle[key] = null; };
    img.src = `../../assets/sprites/evolutions/single/${key}.png`;
    evoSingle[key] = img;
  }
  const img = evoSingle[key];
  return img && img.complete && img.naturalWidth > 0 ? img : null;
}

const evoSheets = {};
const EVO_SHEET_ORDER = { IDLE: 0, WALK: 1, HAPPY: 2, EAT: 3, SLEEP: 4 };

function evoSheetFrameFor(id, state) {
  const key = `${id}_evo_sheet`;
  if (!(key in evoSheets)) {
    const img = new Image();
    img.onerror = () => { evoSheets[key] = null; };
    img.src = `../../assets/sprites/evolutions/sheets/${key}.png`;
    evoSheets[key] = img;
  }
  const img = evoSheets[key];
  if (!img || img.naturalWidth <= 0) return null;
  return { img, idx: EVO_SHEET_ORDER[state] || 0, frameW: img.naturalWidth / 5, frameH: img.naturalHeight };
}

function evoNameFor(id) {
  const list = sprites.EVO_DEFS || [];
  const def = list.find((e) => e.id === id);
  return def ? def.evolvedName : null;
}

function stageStateFor() {
  if (!latest) return 'IDLE';
  const s = latest.state;
  const t = Date.now();
  if (s.flags.sleeping) return 'SLEEP';
  if (s.effects && s.effects.eatUntil > t) return 'EAT';
  if (s.effects && s.effects.happyUntil > t) return 'HAPPY';
  return s.activity || s.flags.working ? 'WALK' : 'IDLE';
}

const skinCanvas = document.createElement('canvas');
skinCanvas.width = STAGE_W;
skinCanvas.height = STAGE_H;

function drawWithSkin(drawFn, tint) {
  if (!tint) {
    drawFn(stageCtx);
    return;
  }
  const sctx = skinCanvas.getContext('2d');
  sctx.clearRect(0, 0, STAGE_W, STAGE_H);
  sctx.imageSmoothingEnabled = smoothGraphics;
  drawFn(sctx);
  sctx.globalCompositeOperation = 'source-atop';
  sctx.fillStyle = tint;
  sctx.fillRect(0, 0, STAGE_W, STAGE_H);
  sctx.globalCompositeOperation = 'source-over';
  stageCtx.drawImage(skinCanvas, 0, 0);
}

function weatherOverlay(id) {
  if (id === 'rainy') return 'rgba(60, 90, 150, 0.14)';
  if (id === 'stormy') return 'rgba(30, 40, 70, 0.26)';
  if (id === 'snowy') return 'rgba(200, 220, 255, 0.14)';
  if (id === 'cloudy') return 'rgba(90, 100, 130, 0.10)';
  return null;
}

function rainFlash(id, now) {
  return id === 'stormy' && Math.floor(now / 2400) % 4 === 0 && (now % 2400) < 90;
}

function drawWeatherFx(id, now) {
  if (id !== 'rainy' && id !== 'stormy' && id !== 'snowy') return;
  stageCtx.save();
  if (id === 'snowy') {
    stageCtx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 16; i += 1) {
      const y = ((now / 26 + i * 23) % (STAGE_H + 20)) - 10;
      const x = (i * 53 + Math.sin(now / 700 + i) * 14) % STAGE_W;
      stageCtx.fillRect(x, y, 3, 3);
    }
  } else {
    stageCtx.strokeStyle = 'rgba(140, 180, 255, 0.5)';
    for (let i = 0; i < 14; i += 1) {
      const y = ((now / 5 + i * 31) % (STAGE_H + 20)) - 10;
      const x = (i * 37 + Math.sin(now / 400 + i) * 7) % STAGE_W;
      stageCtx.beginPath();
      stageCtx.moveTo(x, y);
      stageCtx.lineTo(x - 3, y + 11);
      stageCtx.stroke();
    }
  }
  stageCtx.restore();
}

function drawGrave() {
  const gx = STAGE_CX;
  const base = STAGE_GROUND;
  stageCtx.save();
  stageCtx.globalAlpha = 0.22;
  stageCtx.fillStyle = '#000';
  stageCtx.beginPath();
  stageCtx.ellipse(gx, base + 3, 42, 8, 0, 0, Math.PI * 2);
  stageCtx.fill();
  stageCtx.restore();
  stageCtx.save();
  stageCtx.fillStyle = '#8b93a8';
  stageCtx.strokeStyle = '#4a5164';
  stageCtx.lineWidth = 3;
  stageCtx.beginPath();
  stageCtx.moveTo(gx - 27, base);
  stageCtx.lineTo(gx - 27, base - 76);
  stageCtx.arc(gx, base - 76, 27, Math.PI, 0);
  stageCtx.lineTo(gx + 27, base);
  stageCtx.closePath();
  stageCtx.fill();
  stageCtx.stroke();
  stageCtx.fillStyle = '#4a5164';
  stageCtx.font = 'bold 20px sans-serif';
  stageCtx.textAlign = 'center';
  stageCtx.fillText('R.I.P', gx, base - 40);
  stageCtx.font = '18px sans-serif';
  stageCtx.fillText('\u{1F64A}\uFE0F', gx, base - 96);
  stageCtx.restore();
}

function drawRoom(now, phaseId, weatherId) {
  const fy = STAGE_GROUND;
  const wallTop = {
    day: '#f7f0dc', dawn: '#fbe4c8', dusk: '#d9a878', night: '#40496a',
  }[phaseId] || '#f7f0dc';
  const wallBot = {
    day: '#e3d7b8', dawn: '#eecfa6', dusk: '#9c7452', night: '#2b3050',
  }[phaseId] || '#e3d7b8';
  const wallGrad = stageCtx.createLinearGradient(0, 0, 0, fy);
  wallGrad.addColorStop(0, wallTop);
  wallGrad.addColorStop(1, wallBot);
  stageCtx.fillStyle = wallGrad;
  stageCtx.fillRect(0, 0, STAGE_W, fy);
  stageCtx.fillStyle = 'rgba(0,0,0,0.10)';
  stageCtx.fillRect(0, fy - 12, STAGE_W, 12);

  const wx = STAGE_CX - 54;
  const wy = 40;
  const ww = 108;
  const wh = 80;
  const skyGrad = stageCtx.createLinearGradient(0, wy, 0, wy + wh);
  if (phaseId === 'night') {
    skyGrad.addColorStop(0, '#0f172a');
    skyGrad.addColorStop(1, '#312e81');
  } else if (phaseId === 'dusk' || phaseId === 'dawn') {
    skyGrad.addColorStop(0, '#f97316');
    skyGrad.addColorStop(1, '#fde047');
  } else {
    skyGrad.addColorStop(0, '#60a5fa');
    skyGrad.addColorStop(1, '#bae6fd');
  }
  stageCtx.fillStyle = skyGrad;
  stageCtx.fillRect(wx, wy, ww, wh);
  stageCtx.save();
  stageCtx.beginPath();
  stageCtx.rect(wx, wy, ww, wh);
  stageCtx.clip();
  if (phaseId === 'night') {
    stageCtx.fillStyle = '#fef9c3';
    stageCtx.beginPath();
    stageCtx.arc(wx + ww - 26, wy + 22, 10, 0, Math.PI * 2);
    stageCtx.fill();
    stageCtx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 9; i += 1) {
      const sx = wx + 10 + ((i * 37) % (ww - 16));
      const sy = wy + 8 + ((i * 23) % (wh - 20));
      stageCtx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.sin(now / 900 + i));
      stageCtx.fillRect(sx, sy, 2, 2);
    }
    stageCtx.globalAlpha = 1;
  } else if (phaseId === 'dusk' || phaseId === 'dawn') {
    stageCtx.fillStyle = '#fb923c';
    stageCtx.beginPath();
    stageCtx.arc(wx + ww / 2, wy + wh - 12, 15, 0, Math.PI * 2);
    stageCtx.fill();
    stageCtx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 2; i += 1) {
      const cxx = wx + ((now / 40 + i * 60) % (ww + 40)) - 20;
      stageCtx.fillRect(cxx, wy + 14 + i * 12, 24, 5);
    }
  } else {
    stageCtx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 3; i += 1) {
      const cxx = wx + ((now / 34 + i * 46) % (ww + 48)) - 24;
      stageCtx.fillRect(cxx, wy + 12 + i * 11, 26, 6);
      stageCtx.fillRect(cxx + 6, wy + 8 + i * 11, 14, 6);
    }
  }
  stageCtx.restore();
  stageCtx.strokeStyle = '#784421';
  stageCtx.lineWidth = 6;
  stageCtx.strokeRect(wx, wy, ww, wh);
  stageCtx.lineWidth = 2;
  stageCtx.beginPath();
  stageCtx.moveTo(wx + ww / 2, wy);
  stageCtx.lineTo(wx + ww / 2, wy + wh);
  stageCtx.moveTo(wx, wy + wh / 2);
  stageCtx.lineTo(wx + ww, wy + wh / 2);
  stageCtx.stroke();
  stageCtx.fillStyle = '#5d3317';
  stageCtx.fillRect(wx - 6, wy + wh, ww + 12, 7);

  stageCtx.strokeStyle = '#3b3226';
  stageCtx.lineWidth = 2;
  stageCtx.beginPath();
  stageCtx.moveTo(0, 8);
  stageCtx.quadraticCurveTo(STAGE_CX, 34, STAGE_W, 8);
  stageCtx.stroke();
  const lightCols = ['#f87171', '#fbbf24', '#4ade80', '#60a5fa', '#c084fc'];
  for (let i = 0; i < 14; i += 1) {
    const lx = 20 + i * 34;
    const ly = 8 + 26 * (4 * (lx / STAGE_W) * (1 - lx / STAGE_W));
    stageCtx.fillStyle = lightCols[i % 5];
    stageCtx.beginPath();
    stageCtx.arc(lx, ly + 3, 5, 0, Math.PI * 2);
    stageCtx.fill();
    stageCtx.globalAlpha = 0.3;
    stageCtx.beginPath();
    stageCtx.arc(lx, ly + 3, 8, 0, Math.PI * 2);
    stageCtx.fill();
    stageCtx.globalAlpha = 1;
  }

  const px = 150;
  stageCtx.strokeStyle = '#6b5d43';
  stageCtx.lineWidth = 2;
  stageCtx.beginPath();
  stageCtx.moveTo(px, 0);
  stageCtx.lineTo(px, 30);
  stageCtx.stroke();
  stageCtx.save();
  stageCtx.translate(px, 46);
  stageCtx.fillStyle = '#facc15';
  stageCtx.strokeStyle = '#b45309';
  stageCtx.lineWidth = 2;
  for (const rot of [Math.PI / 4, 0]) {
    stageCtx.save();
    stageCtx.rotate(rot);
    stageCtx.beginPath();
    stageCtx.rect(-11, -11, 22, 22);
    stageCtx.fill();
    stageCtx.stroke();
    stageCtx.restore();
  }
  stageCtx.fillStyle = '#ef4444';
  stageCtx.beginPath();
  stageCtx.arc(0, 0, 4, 0, Math.PI * 2);
  stageCtx.fill();
  stageCtx.restore();

  const bx = 396;
  const by = 56;
  stageCtx.fillStyle = '#5f3d1f';
  stageCtx.fillRect(bx, by, 74, 96);
  stageCtx.strokeStyle = '#8a5a33';
  stageCtx.lineWidth = 5;
  stageCtx.strokeRect(bx, by, 74, 96);
  stageCtx.beginPath();
  stageCtx.moveTo(bx, by + 48);
  stageCtx.lineTo(bx + 74, by + 48);
  stageCtx.stroke();
  const bookCols = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#fb923c', '#14b8a6', '#f472b6'];
  let bi = 0;
  for (let shelf = 0; shelf < 2; shelf += 1) {
    let sx = bx + 6;
    while (sx < bx + 58) {
      const bw = 7 + ((bi * 7) % 9);
      stageCtx.fillStyle = bookCols[bi % bookCols.length];
      stageCtx.fillRect(sx, by + 8 + shelf * 48 + 14 - ((bi * 5) % 5), bw, 26);
      sx += bw + 2;
      bi += 1;
    }
  }

  stageCtx.fillStyle = '#efe6d0';
  stageCtx.beginPath();
  stageCtx.arc(330, 78, 20, 0, Math.PI * 2);
  stageCtx.fill();
  stageCtx.strokeStyle = '#784421';
  stageCtx.lineWidth = 4;
  stageCtx.stroke();
  stageCtx.strokeStyle = '#2d2d3a';
  stageCtx.lineWidth = 2;
  stageCtx.beginPath();
  stageCtx.moveTo(330, 78);
  stageCtx.lineTo(330 - Math.sin((Date.now() / 1000 % 60) / 60 * Math.PI * 2) * 7, 78 - Math.cos((Date.now() / 1000 % 60) / 60 * Math.PI * 2) * 3 - 2);
  stageCtx.stroke();
  const nw = new Date();
  const hourA = ((nw.getHours() % 12) + nw.getMinutes() / 60) / 12 * Math.PI * 2;
  const minA = nw.getMinutes() / 60 * Math.PI * 2;
  stageCtx.strokeStyle = '#2d2d3a';
  stageCtx.lineWidth = 2.5;
  stageCtx.beginPath();
  stageCtx.moveTo(330, 78);
  stageCtx.lineTo(330 + Math.sin(hourA) * 8, 78 - Math.cos(hourA) * 8);
  stageCtx.moveTo(330, 78);
  stageCtx.lineTo(330 + Math.sin(minA) * 13, 78 - Math.cos(minA) * 13);
  stageCtx.stroke();

  stageCtx.strokeStyle = '#6b5d43';
  stageCtx.lineWidth = 1.5;
  stageCtx.beginPath();
  stageCtx.moveTo(166, 24);
  stageCtx.quadraticCurveTo(240, 34, 314, 24);
  stageCtx.stroke();
  const flagCols = ['#f87171', '#4ade80', '#60a5fa', '#fbbf24', '#f472b6', '#a78bfa'];
  let fi = 0;
  for (let fx = 174; fx < 310; fx += 19) {
    const t = (fx - 166) / 148;
    const fy2 = 24 + 10 * (t * (2 - t)) * 0.25;
    stageCtx.fillStyle = flagCols[fi % flagCols.length];
    stageCtx.beginPath();
    stageCtx.moveTo(fx - 6, fy2);
    stageCtx.lineTo(fx + 6, fy2);
    stageCtx.lineTo(fx, fy2 + 12);
    stageCtx.closePath();
    stageCtx.fill();
    fi += 1;
  }

  const floorGrad = stageCtx.createLinearGradient(0, fy, 0, STAGE_H);
  floorGrad.addColorStop(0, '#cfa06e');
  floorGrad.addColorStop(1, '#a97d4e');
  stageCtx.fillStyle = floorGrad;
  stageCtx.fillRect(0, fy, STAGE_W, STAGE_H - fy);
  stageCtx.fillStyle = '#8a5a33';
  stageCtx.fillRect(0, fy, STAGE_W, 3);
  stageCtx.strokeStyle = 'rgba(90,55,20,0.35)';
  stageCtx.lineWidth = 2;
  for (let ry = fy + 22; ry < STAGE_H; ry += 22) {
    stageCtx.beginPath();
    stageCtx.moveTo(0, ry);
    stageCtx.lineTo(STAGE_W, ry);
    stageCtx.stroke();
  }
  for (let ry = fy; ry < STAGE_H; ry += 22) {
    const offset = (((ry - fy) / 22) % 2) * 60;
    for (let sx2 = offset; sx2 < STAGE_W; sx2 += 120) {
      stageCtx.beginPath();
      stageCtx.moveTo(sx2, ry);
      stageCtx.lineTo(sx2, Math.min(ry + 22, STAGE_H));
      stageCtx.stroke();
    }
  }

  stageCtx.fillStyle = '#4c1d95';
  stageCtx.fillRect(30, 180, 78, 104);
  stageCtx.fillStyle = '#6d28d9';
  stageCtx.fillRect(34, 176, 70, 14);
  stageCtx.fillStyle = '#0f172a';
  stageCtx.fillRect(40, 196, 58, 40);
  stageCtx.fillStyle = '#22d3ee';
  stageCtx.fillRect(44, 200, 50, 30);
  stageCtx.fillStyle = 'rgba(15,23,42,0.5)';
  for (let sy = 202; sy < 228; sy += 5) stageCtx.fillRect(44, sy, 50, 2);
  stageCtx.fillStyle = '#ef4444';
  stageCtx.beginPath();
  stageCtx.arc(52, 258, 5, 0, Math.PI * 2);
  stageCtx.fill();
  stageCtx.fillStyle = '#eab308';
  stageCtx.beginPath();
  stageCtx.arc(68, 258, 5, 0, Math.PI * 2);
  stageCtx.fill();
  stageCtx.fillStyle = '#312e81';
  stageCtx.fillRect(30, 276, 78, 8);

  stageCtx.fillStyle = '#c0563e';
  stageCtx.beginPath();
  stageCtx.moveTo(306, 262);
  stageCtx.lineTo(334, 262);
  stageCtx.lineTo(329, 286);
  stageCtx.lineTo(311, 286);
  stageCtx.closePath();
  stageCtx.fill();
  stageCtx.fillStyle = '#8b3a24';
  stageCtx.fillRect(303, 258, 34, 7);
  stageCtx.strokeStyle = '#268a4f';
  stageCtx.lineWidth = 4;
  stageCtx.lineCap = 'round';
  const leafAngles = [-0.9, -0.45, 0, 0.45, 0.9];
  for (let li = 0; li < leafAngles.length; li += 1) {
    stageCtx.beginPath();
    stageCtx.moveTo(320, 258);
    stageCtx.quadraticCurveTo(320 + leafAngles[li] * 26, 236, 320 + leafAngles[li] * 34, 224 - (li % 2) * 8);
    stageCtx.stroke();
  }
  stageCtx.lineCap = 'butt';

  stageCtx.save();
  stageCtx.globalAlpha = 0.2;
  stageCtx.fillStyle = '#000';
  stageCtx.beginPath();
  stageCtx.ellipse(112, 284, 17, 5, 0, 0, Math.PI * 2);
  stageCtx.fill();
  stageCtx.restore();
  stageCtx.fillStyle = 'rgba(190, 225, 250, 0.4)';
  stageCtx.beginPath();
  stageCtx.arc(112, 266, 17, 0, Math.PI * 2);
  stageCtx.fill();
  stageCtx.fillStyle = '#7dd3fc';
  stageCtx.beginPath();
  stageCtx.arc(112, 268, 14, 0, Math.PI * 2);
  stageCtx.fill();
  const fishTail = Math.sin(Date.now() / 240) * 3;
  stageCtx.fillStyle = '#fb923c';
  stageCtx.beginPath();
  stageCtx.ellipse(116 + fishTail, 266, 6, 3, fishTail / 6, 0, Math.PI * 2);
  stageCtx.fill();
  stageCtx.beginPath();
  stageCtx.moveTo(110 + fishTail, 266);
  stageCtx.lineTo(105 + fishTail, 263);
  stageCtx.lineTo(105 + fishTail, 269);
  stageCtx.closePath();
  stageCtx.fill();
  stageCtx.fillStyle = 'rgba(255,255,255,0.55)';
  stageCtx.fillRect(100, 30, 0, 0);
  stageCtx.beginPath();
  stageCtx.arc(106, 258, 1.5, 0, Math.PI * 2);
  stageCtx.arc(118, 252, 1, 0, Math.PI * 2);
  stageCtx.fill();
  stageCtx.strokeStyle = 'rgba(255,255,255,0.65)';
  stageCtx.lineWidth = 2;
  stageCtx.beginPath();
  stageCtx.arc(112, 266, 17, 0, Math.PI * 2);
  stageCtx.stroke();

  const matX = 130;
  const matY = 318;
  const matW = 220;
  const matH = 36;
  stageCtx.fillStyle = '#d9a544';
  stageCtx.beginPath();
  stageCtx.ellipse(matX + matW / 2, matY + matH / 2, matW / 2, matH / 2, 0, 0, Math.PI * 2);
  stageCtx.fill();
  stageCtx.strokeStyle = 'rgba(138,90,51,0.7)';
  stageCtx.lineWidth = 2;
  for (let mx = -matW / 2; mx < matW / 2; mx += 14) {
    stageCtx.beginPath();
    stageCtx.moveTo(matX + matW / 2 + mx, matY + 3);
    stageCtx.lineTo(matX + matW / 2 + mx + 12, matY + matH - 3);
    stageCtx.stroke();
  }
  for (let my = 0; my < matH; my += 9) {
    stageCtx.beginPath();
    stageCtx.moveTo(matX + 6, matY + my);
    stageCtx.lineTo(matX + matW - 6, matY + my);
    stageCtx.stroke();
  }
  stageCtx.strokeStyle = '#8a5a33';
  stageCtx.lineWidth = 3;
  stageCtx.beginPath();
  stageCtx.ellipse(matX + matW / 2, matY + matH / 2, matW / 2 - 1, matH / 2 - 1, 0, 0, Math.PI * 2);
  stageCtx.stroke();

  stageCtx.fillStyle = '#be123c';
  stageCtx.beginPath();
  stageCtx.ellipse(415, 330, 48, 17, 0, 0, Math.PI * 2);
  stageCtx.fill();
  stageCtx.strokeStyle = '#881337';
  stageCtx.lineWidth = 2;
  stageCtx.stroke();
  stageCtx.fillStyle = '#fda4af';
  stageCtx.beginPath();
  stageCtx.ellipse(415, 327, 33, 10, 0, 0, Math.PI * 2);
  stageCtx.fill();

  if (weatherId === 'cloudy') {
    stageCtx.fillStyle = 'rgba(255,255,255,0.10)';
    stageCtx.fillRect(0, 0, STAGE_W, STAGE_H);
  }
}

function drawFurniture() {
  if (!latest || !latest.state || !latest.state.upgrades) return;
  const up = latest.state.upgrades;
  stageCtx.save();
  if (up.bed >= 1) {
    const bx = 18;
    const bwy = 296 + Math.min(3, up.bed - 1) * 2;
    const h = 34 + up.bed * 5;
    stageCtx.fillStyle = '#8a5a33';
    stageCtx.fillRect(bx, bwy, 84, h);
    stageCtx.fillStyle = '#a15c2f';
    stageCtx.fillRect(bx + 4, bwy - 8, 76, 12);
    stageCtx.fillStyle = fromLevelBedColor(up.bed);
    stageCtx.fillRect(bx + 5, bwy + 6, 74, h - 10);
    if (up.bed >= 3) {
      stageCtx.fillStyle = '#fff';
      stageCtx.fillRect(bx + 10, bwy + 2, 20, 12);
      stageCtx.fillRect(bx + 54, bwy + 8, 24, 10);
    }
  }
  if (up.toys >= 1) {
    stageCtx.fillStyle = '#dc2626';
    stageCtx.fillRect(404, 316, 44, 32);
    stageCtx.fillStyle = '#b91c1c';
    stageCtx.fillRect(404, 316, 44, 6);
    stageCtx.fillStyle = '#ffd166';
    stageCtx.beginPath();
    stageCtx.arc(470 - Math.abs(Math.sin(Date.now() / 2100)) * 34, 352, 6, 0, Math.PI * 2);
    stageCtx.fill();
  }
  if (up.feeder >= 1) {
    stageCtx.fillStyle = '#475569';
    stageCtx.fillRect(128, 320, 26, 30);
    stageCtx.fillStyle = '#22d3ee';
    stageCtx.fillRect(133, 326, 16, 6);
    stageCtx.fillStyle = '#94a3b8';
    stageCtx.fillRect(133, 340, 16, 6);
  }
  stageCtx.restore();
}

function fromLevelBedColor(lvl) {
  return ['#7f1d1d', '#9d174d', '#6d28d9', '#1d4ed8', '#134e4a'][Math.min(4, Math.max(0, lvl - 1))];
}

function drawWaste(now, list) {
  if (!list || !list.length) return;
  stageCtx.save();
  stageCtx.font = '16px sans-serif';
  stageCtx.textAlign = 'center';
  for (const w of list) {
    const wob = Math.sin(now / 400 + w.x) * 2;
    if (w.kind === 'poop') {
      stageCtx.font = '17px sans-serif';
      stageCtx.fillText('\u{1F4A9}', w.x + wob, w.y);
    } else {
      stageCtx.fillStyle = 'rgba(96, 165, 250, 0.5)';
      stageCtx.beginPath();
      stageCtx.ellipse(w.x + wob, w.y - 4, 16, 5, 0, 0, Math.PI * 2);
      stageCtx.fill();
      stageCtx.fillStyle = 'rgba(147, 197, 253, 0.7)';
      stageCtx.beginPath();
      stageCtx.ellipse(w.x + wob, w.y - 5, 8, 3, 0, 0, Math.PI * 2);
      stageCtx.fill();
    }
  }
  stageCtx.restore();
}

const PARK_SKIES = {
  park: ['#38bdf8', '#bbf7d0'],
  baywalk: ['#7e22ce', '#fb923c'],
  market: ['#0ea5e9', '#a7f3d0'],
  temple: ['#fda4af', '#fef3c7'],
  terraces: ['#60a5fa', '#86efac'],
  beach: ['#2563eb', '#fde68a'],
};

function drawPark(now, phaseId, mode) {
  const skies = PARK_SKIES[mode] || PARK_SKIES.park;
  const night = phaseId === 'night';
  const sky = stageCtx.createLinearGradient(0, 0, 0, 284);
  sky.addColorStop(0, night ? '#0f172a' : skies[0]);
  sky.addColorStop(1, night ? '#312e81' : skies[1]);
  stageCtx.fillStyle = sky;
  stageCtx.fillRect(0, 0, STAGE_W, 284);
  stageCtx.fillStyle = night ? '#fef9c3' : '#fef08a';
  stageCtx.beginPath();
  const sunX = mode === 'baywalk' ? STAGE_CX : 380;
  const sunY = mode === 'baywalk' ? 240 : 62;
  stageCtx.arc(sunX, sunY, mode === 'baywalk' ? 22 : 18, 0, Math.PI * 2);
  stageCtx.fill();
  stageCtx.fillStyle = 'rgba(255,255,255,0.8)';
  for (let i = 0; i < 3; i += 1) {
    const cx = ((now / 34 + i * 150) % (STAGE_W + 80)) - 40;
    stageCtx.fillRect(cx, 40 + i * 26, 46, 10);
  }
  if (['park', 'terraces', 'temple'].includes(mode)) {
    const grass = stageCtx.createLinearGradient(0, 284, 0, STAGE_H);
    grass.addColorStop(0, night ? '#14532d' : mode === 'temple' ? '#86efac' : '#4ade80');
    grass.addColorStop(1, night ? '#052e16' : '#16a34a');
    stageCtx.fillStyle = grass;
    stageCtx.fillRect(0, 284, STAGE_W, STAGE_H - 284);
    if (mode === 'terraces') {
      stageCtx.strokeStyle = 'rgba(20, 83, 45, 0.6)';
      stageCtx.lineWidth = 3;
      for (let i = 0; i < 5; i += 1) {
        const ty = 292 + i * 12;
        stageCtx.beginPath();
        stageCtx.moveTo(0, ty);
        stageCtx.quadraticCurveTo(STAGE_CX, ty + 7, STAGE_W, ty);
        stageCtx.stroke();
      }
    }
    if (mode === 'temple') {
      stageCtx.fillStyle = night ? '#7f1d1d' : '#dc2626';
      stageCtx.fillRect(60, 210, 120, 9);
      stageCtx.fillRect(54, 226, 132, 8);
      stageCtx.fillStyle = '#efe9dd';
      stageCtx.fillRect(66, 220, 108, 6);
      stageCtx.fillStyle = '#8b5e3c';
      stageCtx.fillRect(72, 226, 12, 62);
      stageCtx.fillRect(156, 226, 12, 62);
      stageCtx.fillStyle = '#a8a29e';
      for (let i = 0; i < 3; i += 1) stageCtx.fillRect(240 + i * 46, 316 - (i % 2) * 8, 28, 14);
    }
    stageCtx.fillStyle = night ? '#365314' : '#15803d';
    for (const tx of [40, 320]) {
      stageCtx.fillRect(tx + 12, 240, 10, 46);
      stageCtx.beginPath();
      stageCtx.arc(tx + 17, 226, 26, 0, Math.PI * 2);
      stageCtx.fill();
    }
    if (mode === 'park') {
      stageCtx.fillStyle = '#8a5a33';
      stageCtx.fillRect(200, 292, 70, 8);
      stageCtx.fillRect(205, 300, 6, 16);
      stageCtx.fillRect(258, 300, 6, 16);
    }
  } else if (mode === 'beach') {
    stageCtx.fillStyle = night ? '#1e3a5f' : '#0284c7';
    stageCtx.fillRect(0, 210, STAGE_W, 44);
    stageCtx.fillStyle = night ? '#78350f' : '#fcd34d';
    stageCtx.fillRect(0, 254, STAGE_W, STAGE_H - 254);
    stageCtx.fillStyle = '#d97706';
    stageCtx.fillRect(96, 240, 8, 60);
    stageCtx.fillStyle = '#16a34a';
    stageCtx.beginPath();
    stageCtx.ellipse(100, 236, 34, 14, -0.4, 0, Math.PI * 2);
    stageCtx.fill();
    stageCtx.beginPath();
    stageCtx.ellipse(100, 226, 26, 11, 0.3, 0, Math.PI * 2);
    stageCtx.fill();
    stageCtx.fillStyle = '#f87171';
    stageCtx.fillRect(330, 262, 60, 6);
    stageCtx.fillStyle = '#fb7185';
    stageCtx.beginPath();
    stageCtx.arc(360, 248, 22, Math.PI, 0);
    stageCtx.fill();
  } else {
    stageCtx.fillStyle = night ? '#172554' : '#0891b2';
    stageCtx.fillRect(0, 214, STAGE_W, STAGE_H - 214);
    stageCtx.strokeStyle = 'rgba(255,255,255,0.35)';
    stageCtx.lineWidth = 2;
    for (let i = 0; i < 5; i += 1) {
      const wy = 244 + i * 20;
      stageCtx.beginPath();
      stageCtx.moveTo(((now / 24) % 130) - 40, wy);
      stageCtx.lineTo(((now / 24) % 130) - 6, wy);
      stageCtx.stroke();
    }
    if (mode === 'market') {
      for (let bi = 0; bi < 3; bi += 1) {
        const bxc = 70 + bi * 130 + Math.sin(now / 900 + bi) * 6;
        const byc = 232 + bi * 26;
        stageCtx.fillStyle = fromLevelBedColor(bi + 3);
        stageCtx.beginPath();
        stageCtx.moveTo(bxc - 34, byc);
        stageCtx.quadraticCurveTo(bxc, byc + 20, bxc + 34, byc);
        stageCtx.lineTo(bxc + 26, byc);
        stageCtx.lineTo(bxc - 26, byc);
        stageCtx.closePath();
        stageCtx.fill();
        stageCtx.fillStyle = '#fb923c';
        stageCtx.fillRect(bxc - 16, byc - 14, 32, 5);
        stageCtx.fillRect(bxc - 2, byc - 32, 4, 20);
        stageCtx.fillRect(bxc - 2, byc - 32, 18, 4);
      }
    } else {
      stageCtx.fillStyle = night ? '#1e293b' : '#334155';
      for (const bw of [30, 74, 128, 356, 402, 448]) {
        stageCtx.fillRect(bw, 150, 34, 64);
        stageCtx.fillStyle = 'rgba(253, 224, 71, 0.8)';
        for (let wy2 = 0; wy2 < 4; wy2 += 1) stageCtx.fillRect(bw + 6 + (wy2 % 2) * 14, 158 + wy2 * 12, 8, 6);
        stageCtx.fillStyle = night ? '#1e293b' : '#334155';
      }
    }
  }
}

function drawStagePet(now) {
  const groundY = STAGE_GROUND;
  stageCtx.clearRect(0, 0, petStageCanvas.width, petStageCanvas.height);
  const pre = latest && latest.derived;
  const activeAct = pre && pre.activities ? pre.activities.find((a) => a.active) : null;
  if (activeAct && activeAct.outdoor) {
    drawPark(now, pre && pre.phase ? pre.phase.id : 'day', activeAct.outdoor);
  } else {
    drawRoom(now, pre && pre.phase ? pre.phase.id : 'day', pre && pre.weather ? pre.weather.id : 'clear');
    drawFurniture();
    drawWaste(now, pre ? pre.waste : []);
  }

  const dt = Math.min(0.12, Math.max(0, (now - lastStageNow) / 1000));
  lastStageNow = now;

  if (!latest) return;
  const d = latest.derived;
  const s = latest.state;

  const st0 = stageStateFor();
  if (st0 === 'SLEEP' || st0 === 'EAT') petWalk.target = null;
  if (petWalk.target !== null) {
    const dx = petWalk.target.x - petWalk.x;
    const dy = petWalk.target.y - petWalk.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      if (Math.abs(dx) > 2) petWalk.dir = dx > 0 ? 1 : -1;
      const len = Math.hypot(dx, dy) || 1;
      const speed = 95 * dt;
      petWalk.x = Math.max(56, Math.min(STAGE_W - 56, petWalk.x + (dx / len) * speed));
      petWalk.y = Math.max(WALK_Y_MIN, Math.min(WALK_Y_MAX, petWalk.y + (dy / len) * speed));
      petWalk.moving = true;
    } else {
      petWalk.target = null;
      petWalk.moving = false;
    }
  } else {
    petWalk.moving = false;
  }
  if (st0 === 'IDLE' && !petWalk.target && !s.flags.working && !s.activity && Math.random() < 0.004) {
    petWalk.target = { x: 110 + Math.random() * 260, y: WALK_Y_MIN + Math.random() * (WALK_Y_MAX - WALK_Y_MIN) };
  }

  const st = petWalk.moving ? 'WALK' : st0;
  const stageScale = d.stage ? d.stage.scale : 1;
  const depthF = (petWalk.y - WALK_Y_MIN) / (WALK_Y_MAX - WALK_Y_MIN);
  const boxSize = Math.round(264 * stageScale * (0.8 + 0.28 * depthF));
  petDraw = { cx: petWalk.x, gy: petWalk.y, size: boxSize, dir: petWalk.dir };

  stageCtx.save();
  stageCtx.globalAlpha = 0.22;
  stageCtx.fillStyle = '#000';
  stageCtx.beginPath();
  stageCtx.ellipse(petWalk.x, petWalk.y + 4, 30 + 26 * depthF, 8 + 3 * depthF, 0, 0, Math.PI * 2);
  stageCtx.fill();
  stageCtx.restore();

  if (latest && !latest.state.dead && petWalk.target !== null) {
    const pulse = 0.5 + 0.5 * Math.sin(now / 170);
    stageCtx.save();
    stageCtx.strokeStyle = `rgba(255, 220, 120, ${0.35 + 0.4 * pulse})`;
    stageCtx.lineWidth = 2.5;
    stageCtx.beginPath();
    stageCtx.ellipse(petWalk.target.x, petWalk.target.y + 3, 15 + 5 * pulse, 5 + 2 * pulse, 0, 0, Math.PI * 2);
    stageCtx.stroke();
    stageCtx.fillStyle = 'rgba(255, 220, 120, 0.6)';
    stageCtx.beginPath();
    stageCtx.ellipse(petWalk.target.x, petWalk.target.y + 3, 3 + 2 * pulse, 1.5 + pulse, 0, 0, Math.PI * 2);
    stageCtx.fill();
    stageCtx.restore();
  }

  if (st === 'EAT') drawFoodBowl(petWalk.x + 40 * petWalk.dir, petWalk.y);

  const phaseTint = d.phase && d.phase.tint;
  const wTint = weatherOverlay(d.weather ? d.weather.id : 'clear');
  const tintList = [phaseTint, wTint].filter(Boolean);
  for (const t of tintList) {
    stageCtx.save();
    stageCtx.fillStyle = t;
    stageCtx.fillRect(0, 0, petStageCanvas.width, petStageCanvas.height);
    stageCtx.restore();
  }
  if (rainFlash(d.weather ? d.weather.id : 'clear', now)) {
    stageCtx.save();
    stageCtx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    stageCtx.fillRect(0, 0, petStageCanvas.width, petStageCanvas.height);
    stageCtx.restore();
  }
  drawWeatherFx(d.weather ? d.weather.id : 'clear', now);

  if (s.dead) {
    drawGrave();
    return;
  }

  const isEgg = s.pet.stage === 'egg';
  const skinDef = d.skins ? d.skins.find((sk) => sk.equipped) : null;
  const tint = skinDef ? skinDef.tint : null;

  if (isEgg) {
    petWalk.target = null;
    petWalk.x = STAGE_CX;
    petWalk.y = 312;
    petDraw = { cx: STAGE_CX, gy: 312, size: 96, dir: 1 };
    const prog = Math.max(0.04, Math.min(1, (s.pet.xp || 0) / 14));
    if (prog > 0.8 && Math.random() < 0.05) spawnFx('spark', STAGE_CX + (Math.random() * 40 - 20), 220, { vy: -0.3, size: 10 });
    stageCtx.save();
    stageCtx.imageSmoothingEnabled = smoothGraphics;
    const shake = prog > 0.6 ? Math.sin(now / 55) * 4 * prog : 0;
    const eggOk = !eggSprite.bad && eggSprite.complete && eggSprite.naturalWidth > 0;
    if (eggOk) {
      const eggH = 100;
      const eggW = Math.round(eggH * eggSprite.naturalWidth / eggSprite.naturalHeight);
      stageCtx.drawImage(eggSprite, STAGE_CX + shake - eggW / 2, petWalk.y - eggH + Math.round(Math.sin(now / 500) * 2), eggW, eggH);
    } else {
      drawWithSkin((g) => eggToCtx(g, now, prog), tint);
    }
    stageCtx.restore();
    stageCtx.save();
    stageCtx.font = '11px sans-serif';
    stageCtx.textAlign = 'center';
    stageCtx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    stageCtx.fillText(prog > 0.8 ? 'crack... crack!' : `keep caring... ${Math.round(prog * 100)}%`, STAGE_CX, petWalk.y + 26);
    stageCtx.restore();
  } else {
    const bobbing = st === 'HAPPY' || st === 'WALK';
    const yOff = bobbing ? Math.round(Math.sin(now / 260) * 4) : 0;

    stageCtx.save();
    stageCtx.imageSmoothingEnabled = smoothGraphics;

    const drawPath = (g) => {
      g.save();
      g.translate(petWalk.x, 0);
      if (petWalk.dir < 0) g.scale(-1, 1);
      const bx = -boxSize / 2;
      const by = petWalk.y - boxSize + yOff;
      const speciesId = s.pet.species || 'kala';
      const evoSingle = s.pet.evolved ? evoSingleFor(speciesId, st) : null;
      const evoFrame = s.pet.evolved && !evoSingle ? evoSheetFrameFor(speciesId, st) : null;
      if (evoSingle) {
        g.drawImage(evoSingle, bx, by, boxSize, boxSize);
      } else if (evoFrame) {
        g.drawImage(evoFrame.img, evoFrame.idx * evoFrame.frameW, 0, evoFrame.frameW, evoFrame.frameH, bx, by, boxSize, boxSize);
      }
      const pngs = stageFramesFor(speciesId, st);
      const single = stageSingleFor(speciesId, st);
      if (evoSingle || evoFrame) {
        // evolved art fully drawn above
      } else if (pngs.length > 0) {
        const img = pngs[Math.floor(now / 170) % pngs.length];
        g.drawImage(img, bx, by, boxSize, boxSize);
      } else if (single) {
        g.drawImage(single, bx, by, boxSize, boxSize);
      } else {
        let bank = null;
        try {
          bank = sprites.ensurePetSprites(s.pet.species || 'kala');
        } catch (err) {
          bank = null;
        }
        if (bank && bank[st]) {
          const frame = bank[st][Math.floor(now / 170) % bank[st].length];
          g.drawImage(frame, bx, by, boxSize, boxSize);
        }
      }
      g.restore();
    };

    if (tint) drawWithSkin(drawPath, tint);
    else drawPath(stageCtx);
    stageCtx.restore();

    if (st === 'SLEEP' && Math.random() < 0.02) spawnFx('z', petWalk.x + 20, petWalk.y - boxSize + 24, { vy: -0.35, size: 15 });
    if (st === 'EAT' && Math.random() < 0.02) spawnFx('crumb', petWalk.x + 40, petWalk.y - 12, { vy: -0.3, size: 10 });
    if ((s.flags.working || s.activity) && Math.random() < 0.012) spawnFx('coin', petWalk.x + (Math.random() < 0.5 ? -50 : 50), 90, { vy: -0.4, size: 18 });
    if (petWalk.moving && Math.random() < 0.09) spawnFx('spark', petWalk.x - petWalk.dir * boxSize * 0.3, petWalk.y - 4, { vy: -0.15, size: 10 });
  }

  for (let i = stageFx.length - 1; i >= 0; i -= 1) {
    const p2 = stageFx[i];
    p2.y += p2.vy;
    p2.x += Math.sin((p2.wobble += 0.06)) * 0.6;
    p2.life -= 0.011;
    if (p2.life <= 0) {
      stageFx.splice(i, 1);
      continue;
    }
    stageCtx.save();
    stageCtx.globalAlpha = Math.min(1, p2.life);
    stageCtx.font = `${p2.size}px sans-serif`;
    stageCtx.textAlign = 'center';
    stageCtx.fillStyle = p2.kind === 'heart' ? '#ff6b81' : p2.kind === 'coin' ? '#ffd166' : 'rgba(240, 240, 255, 0.9)';
    const glyph = p2.kind === 'heart' ? '\u2764' : p2.kind === 'coin' ? '\u{1FA99}' : p2.kind === 'crumb' ? '\u00b7' : p2.kind === 'z' ? 'z' : '\u2726';
    stageCtx.fillText(glyph, p2.x, p2.y);
    stageCtx.restore();
  }
}

function drawFoodBowl(x, gy) {
  const by1 = (gy || STAGE_GROUND) - 9;
  const by2 = (gy || STAGE_GROUND) + 3;
  stageCtx.save();
  stageCtx.fillStyle = '#be123c';
  stageCtx.beginPath();
  stageCtx.moveTo(x - 17, by1);
  stageCtx.lineTo(x + 17, by1);
  stageCtx.lineTo(x + 12, by2);
  stageCtx.lineTo(x - 12, by2);
  stageCtx.closePath();
  stageCtx.fill();
  stageCtx.strokeStyle = '#881337';
  stageCtx.lineWidth = 2;
  stageCtx.stroke();
  stageCtx.fillStyle = Math.sin(Date.now() / 300) > 0 ? '#eab308' : '#d97706';
  stageCtx.beginPath();
  stageCtx.ellipse(x, by1, 13, 5, 0, 0, Math.PI * 2);
  stageCtx.fill();
  stageCtx.restore();
}

function eggToCtx(g, now, prog) {
  const shake = prog > 0.6 ? Math.sin(now / 55) * 4 * prog : 0;
  const cy = 250;
  g.save();
  g.globalAlpha = 0.22;
  g.fillStyle = '#000';
  g.beginPath();
  g.ellipse(STAGE_CX + shake, STAGE_GROUND + 3, 30, 7, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.save();
  g.translate(STAGE_CX + shake, cy);
  g.fillStyle = '#f5eede';
  g.strokeStyle = '#6b5d43';
  g.lineWidth = 3;
  g.beginPath();
  g.ellipse(0, 0, 26, 34, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = '#ffd97a';
  g.fillRect(-17, -8, 9, 9);
  g.fillRect(5, 10, 8, 8);
  g.fillRect(10, -20, 7, 7);
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.beginPath();
  g.ellipse(-8, 15, 13, 6, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.save();
  g.font = '11px sans-serif';
  g.textAlign = 'center';
  g.fillStyle = 'rgba(255, 255, 255, 0.85)';
  g.fillText(prog > 0.8 ? 'crack... crack!' : `keep caring... ${Math.round(prog * 100)}%`, STAGE_CX + shake, 322);
  g.restore();
}

let lastStagePat = 0;
petStageCanvas.addEventListener('click', async (e) => {
  const rect = petStageCanvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * STAGE_W;
  const y = ((e.clientY - rect.top) / rect.height) * STAGE_H;
  if (latest && latest.state.dead) return;
  const wastes = (latest.derived && latest.derived.waste) || [];
  let nearest = null;
  let nd = 1e9;
  for (const w of wastes) {
    const dist = Math.hypot(x - w.x, y - (w.y - 8));
    if (dist < nd) { nd = dist; nearest = w; }
  }
  if (nearest && nd < 30) {
    const res = await api.action('cleanWaste', { index: nearest.index });
    if (res && res.ok) {
      for (let i = 0; i < 4; i += 1) spawnFx('spark', nearest.x + (Math.random() * 22 - 11), nearest.y - 10, { vy: -0.5, size: 12 });
      sfxOnce('coin');
    }
    showToast((res && res.message) || 'Cleaned!', 1400);
    return;
  }
  const patW = Math.max(44, petDraw.size * 0.25);
  const patCy = petDraw.gy - petDraw.size * 0.45;
  if (Math.abs(x - petDraw.cx) < patW && Math.abs(y - patCy) < petDraw.size * 0.5) {
    const now = performance.now();
    if (now - lastStagePat < 900) return;
    lastStagePat = now;
    for (let i = 0; i < 3; i += 1) {
      stageFx.push({ kind: 'heart', x: petDraw.cx + (Math.random() * 26 - 13), y: STAGE_GROUND - petDraw.size * 0.3, vy: -0.9, life: 1, size: 14 + Math.random() * 10, wobble: Math.random() * 6 });
    }
    sfxOnce('pat');
    const res = await api.action('pat');
    showToast((res && res.message) || 'hehe~', 1500);
    return;
  }
  if (stageStateFor() === 'SLEEP') {
    showToast('Shhh... your buddy is sleeping! \u{1F4A4}', 1600);
    return;
  }
  petWalk.target = {
    x: Math.max(70, Math.min(STAGE_W - 70, x)),
    y: Math.max(WALK_Y_MIN, Math.min(WALK_Y_MAX, y)),
  };
  if (sfx) sfx.play('click');
});

document.querySelectorAll('#tab-bar .studio-tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#tab-bar .studio-tab').forEach((b) => b.classList.toggle('on', b === btn));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.add('hidden'));
    document.querySelector(`.panel-${btn.dataset.tab}`).classList.remove('hidden');
  });
});

const stageMenuBtn = el('stage-menu-btn');
const stageMenu = el('stage-menu');
if (stageMenuBtn && stageMenu) {
  stageMenuBtn.addEventListener('click', () => {
    stageMenu.classList.toggle('hidden');
    if (sfx) sfx.play('click');
  });
  stageMenu.querySelectorAll('.stage-menu-item').forEach((b) => {
    b.addEventListener('click', () => {
      const tabBtn = document.querySelector(`#tab-bar .studio-tab[data-tab="${b.dataset.menuTab}"]`);
      if (tabBtn && tabBtn.click) tabBtn.click();
      stageMenu.classList.add('hidden');
    });
  });
  document.addEventListener('click', (e) => {
    if (stageMenu.classList.contains('hidden')) return;
    if (e.target !== stageMenuBtn && !stageMenuBtn.contains(e.target) && !stageMenu.contains(e.target)) {
      stageMenu.classList.add('hidden');
    }
  });
}

(function stageLoop() {
  drawStagePet(performance.now());
  requestAnimationFrame(stageLoop);
})();

const achCards = {};

function renderExtras(d) {
  if (!d.achievements) return;
  const grid = el('achv-grid');
  if (grid.childElementCount === 0) {
    for (const a of d.achievements) {
      const card = document.createElement('div');
      card.className = 'achv';
      card.innerHTML = `<div class="achv-ico"></div><div class="achv-name"></div><div class="achv-desc muted"></div>`;
      grid.appendChild(card);
      achCards[a.id] = card;
    }
  }
  for (const a of d.achievements) {
    const card = achCards[a.id];
    card.classList.toggle('unlocked', a.unlocked);
    card.querySelector('.achv-ico').textContent = a.unlocked ? a.icon : '🔒';
    card.querySelector('.achv-name').textContent = a.name;
    card.querySelector('.achv-desc').textContent = a.desc;
  }
  el('btn-daily').textContent = d.daily.claimedToday ? '✅ Claimed — come back tomorrow!' : `🎁 Claim Daily (+${d.daily.nextReward})`;
  el('btn-daily').disabled = d.daily.claimedToday;
  el('daily-info').textContent = `Streak: ${d.daily.streak} day${d.daily.streak === 1 ? '' : 's'} (best ${d.daily.best})`;

  if (d.gacha && d.gacha.rates) {
    el('gacha-rates').textContent = `Rates: ${d.gacha.rates.map((g) => `${'★'.repeat(g.stars)} ${g.name} ${g.rate < 1 ? g.rate : g.rate + '%'}`).join(' · ')}`;
    el('gacha-stats').textContent = `Pulls: ${d.gacha.pulls} · Legendaries: ${d.gacha.fiveStars} · 🎯 Mythics: ${d.gacha.mythics} — good luck! 🍀`;
  }
  const sg = el('skins-grid');
  sg.innerHTML = '';
  for (const sk of d.skins) {
    const card = document.createElement('div');
    card.className = `skin-card${sk.equipped ? ' equipped' : ''}`;
    const sw = document.createElement('div');
    sw.className = `skin-swatch sw-${sk.id}`;
    const nm = document.createElement('div');
    nm.className = 'skin-name';
    nm.textContent = sk.name;
    const btn = document.createElement('button');
    btn.className = 'btn f-feed';
    btn.textContent = sk.equipped ? '✓ Equipped' : sk.owned ? 'Equip' : sk.gachaOnly ? '🎰 Gacha only' : `🪙 ${sk.cost}`;
    btn.disabled = sk.equipped || (!!sk.gachaOnly && !sk.owned);
    btn.addEventListener('click', async () => {
      const res = await api.action(sk.owned ? 'setSkin' : 'buySkin', { skinId: sk.id });
      playActionSound(sk.owned ? 'setSkin' : 'buySkin', res);
      showToast(res && res.message);
    });
    card.appendChild(sw);
    card.appendChild(nm);
    card.appendChild(btn);
    sg.appendChild(card);
  }
}

el('btn-daily').addEventListener('click', () => act('claimDaily'));

let gachaBusy = false;

function spawnConfetti(container, stars) {
  const count = stars >= 5 ? 60 : stars >= 4 ? 34 : 18;
  const cols = ['#fbbf24', '#fb7185', '#a78bfa', '#38bdf8', '#4ade80', '#f472b6'];
  for (let i = 0; i < count; i += 1) {
    const p = document.createElement('div');
    p.className = 'confetti-bit';
    p.style.left = `${Math.random() * 100}%`;
    p.style.background = cols[i % cols.length];
    p.style.animationDelay = `${Math.random() * 0.5}s`;
    p.style.animationDuration = `${1 + Math.random() * 1.2}s`;
    if (i % 3 === 0) p.style.borderRadius = '50%';
    container.appendChild(p);
  }
  setTimeout(() => container.querySelectorAll('.confetti-bit').forEach((c) => c.remove()), 2600);
}

async function pullGacha(times) {
  if (gachaBusy) return;
  gachaBusy = true;
  const res = await api.action('pullGacha', { times });
  const orb = el('gacha-orb');
  const frame = el('gacha-frame');
  const resultEl = el('gacha-result');
  if (!res || res.ok === false) {
    if (sfx) sfx.play('error');
    showToast((res && res.message) || 'Summon failed.');
    gachaBusy = false;
    return;
  }
  if (sfx) sfx.play('click');
  orb.classList.add('spinning');
  frame.classList.add('pulling');
  resultEl.classList.add('hidden');
  const wait = times === 10 ? 1500 : 1000;
  await new Promise((r) => setTimeout(r, wait));
  orb.classList.remove('spinning');
  frame.classList.remove('pulling');
  const best = res.best || { rarity: 'common', stars: 1, name: 'Common', coins: 0 };
  if (sfx) sfx.playGacha(best.rarity);
  resultEl.className = `gacha-result r-${best.rarity}`;
  resultEl.innerHTML = '';
  const starsLine = document.createElement('div');
  starsLine.className = 'gacha-stars';
  starsLine.textContent = '★'.repeat(best.stars);
  const nameLine = document.createElement('div');
  nameLine.className = 'gacha-rarity';
  nameLine.textContent = `${best.name} Pull!`;
  const coinLine = document.createElement('div');
  coinLine.className = 'gacha-reward';
  const totalCoins = (res.results || []).reduce((sum, r) => sum + (r.coins || 0), 0);
  coinLine.textContent = times === 10 ? `${best.name} best of 10 — +${totalCoins} coins total` : `+${best.coins} coins`;
  resultEl.appendChild(starsLine);
  resultEl.appendChild(nameLine);
  resultEl.appendChild(coinLine);
  for (const r of res.results || []) {
    if (r.skinUnlocked) {
      const skinLine = document.createElement('div');
      skinLine.className = 'gacha-skin';
      skinLine.textContent = `🎁 Unlocked ${r.skinUnlocked} skin!`;
      resultEl.appendChild(skinLine);
    }
  }
  if (best.stars >= 3) spawnConfetti(frame, best.stars);
  if (best.rarity === 'mythic') showToast('💫✨ LEGENDARY MYTHIC PULL!!! Share this moment forever ✨💫', 6000);
  gachaBusy = false;
}

el('btn-gacha-1').addEventListener('click', () => pullGacha(1));
el('btn-gacha-10').addEventListener('click', () => pullGacha(10));

const sfxBtn = el('btn-sfx');
if (sfxBtn) {
  const paintSfx = () => {
    el('sfx-label').textContent = sfx && sfx.isEnabled() ? '🔊 Sound: On' : '🔇 Sound: Off';
  };
  paintSfx();
  sfxBtn.addEventListener('click', () => {
    if (!sfx) return;
    sfx.setEnabled(!sfx.isEnabled());
    paintSfx();
    if (sfx.isEnabled()) sfx.play('coin');
  });
}

// ==== Clock (user's timezone) ====
let hudTz = 'local';
try { hudTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local'; } catch (err) { hudTz = 'local'; }
const hudClock = el('hud-clock');
const hudTzEl = el('hud-tz');
const settingsTzEl = el('settings-tz');
if (hudTzEl) {
  hudTzEl.textContent = hudTz.length > 22 ? `${hudTz.slice(0, 20)}…` : hudTz;
  hudTzEl.title = hudTz;
}
if (settingsTzEl) settingsTzEl.textContent = `🕒 ${hudTz}`;
if (hudClock) {
  const paintClock = () => {
    try { hudClock.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
    catch (err) { hudClock.textContent = ''; }
  };
  paintClock();
  setInterval(paintClock, 15000);
}

// ==== Name modal (16-char limit) ====
const nameModal = el('name-modal');
const nameInput = el('name-input');
if (nameModal && nameInput) {
  const closeNameModal = () => {
    nameModal.classList.add('hidden');
    try { if (typeof localStorage !== 'undefined') localStorage.setItem('juanbuddy-named', '1'); } catch (err) { /* ignore */ }
  };
  el('btn-name-save').addEventListener('click', async () => {
    const name = (nameInput.value || '').trim().slice(0, 16);
    if (!name) { showToast('Nickname is too short! 🥺'); return; }
    const res = await api.action('rename', { name });
    closeNameModal();
    if (sfx) sfx.play('happy');
    showToast((res && res.message) || '. ..');
  });
  el('btn-name-skip').addEventListener('click', () => {
    closeNameModal();
    showToast('Your buddy keeps the name Buddy — rename it later by clicking its name! 💛');
  });
}

// ==== Settings panel wiring ====
const bgmToggle = el('btn-bgm-toggle');
const bgmRange = el('set-bgm');
const sfxRange = el('set-sfx');
const gfxToggle = el('btn-gfx-toggle');
if (bgmToggle && bgm && bgmRange) {
  bgmToggle.addEventListener('click', async () => {
    const st = latest && latest.settings ? latest.settings : {};
    const on = !st.bgmOn;
    if (bgm) bgm.setEnabled(on);
    await api.action('setSettings', { bgmOn: on });
    bgmToggle.textContent = on ? '🎵 Music: On' : '🔇 Music: Off';
    if (on) { bgmStarted = true; ensureBgm(); }
    if (sfx) sfx.play('click');
  });
  bgmRange.addEventListener('input', () => {
    const v = Number(bgmRange.value) / 100;
    if (bgm) bgm.setVolume(v);
    api.action('setSettings', { bgmVol: v });
  });
}
if (sfxRange && sfx) {
  sfxRange.addEventListener('input', () => {
    sfx.setVolume(Number(sfxRange.value) / 100);
  });
}
if (gfxToggle) {
  gfxToggle.addEventListener('click', async () => {
    const st = latest && latest.settings ? latest.settings : {};
    const pixel = !st.pixelGraphics;
    applyGraphics(!pixel);
    await api.action('setSettings', { pixelGraphics: pixel });
    gfxToggle.textContent = pixel ? '🎨 Pixel-perfect' : '🌫️ Smooth';
    if (sfx) sfx.play('click');
  });
}

document.addEventListener('pointerdown', startBgmOnGesture);
document.addEventListener('keydown', startBgmOnGesture);

el('btn-export').addEventListener('click', async () => {
  const res = await api.action('exportSave');
  if (!res || !res.ok) return;
  try {
    await navigator.clipboard.writeText(res.code);
    showToast('Save code copied to clipboard! Keep it safe 🔐', 3200);
  } catch (err) {
    window.prompt('Copy your save code:', res.code);
  }
});

el('btn-import').addEventListener('click', async () => {
  const code = window.prompt('Paste your Juan Buddy save code (starts with JB2.):');
  if (!code) return;
  const res = await api.action('importSave', { code: code.trim() });
  showToast(res && res.message, 3200);
});

el('btn-new-game').addEventListener('click', async () => {
  if (!window.confirm('Start over with a new egg? Your buddy will be gone forever, but your achievements stay.')) return;
  const res = await api.action('newGame');
  showToast(res && res.message, 4000);
});

const monsterCards = {};
const gearShopCards = {};
const exploreCards = {};
let gearGachaBusy = false;

function rpgUnlock(d, id) {
  return (d.rpg && d.rpg.unlocks.find((u) => u.id === id)) || { unlocked: false, daysLeft: 99, day: 99, icon: '', name: '', desc: '' };
}

function renderRpg(d) {
  const rpg = d.rpg;
  if (!rpg) return;

  const bu = rpgUnlock(d, 'battle');
  el('battle-lock').classList.toggle('hidden', bu.unlocked);
  el('battle-body').classList.toggle('hidden', !bu.unlocked);
  if (!bu.unlocked) {
    el('battle-lock').textContent = `${bu.icon || '⚔\ufe0f'} ${bu.name} opens in ${bu.daysLeft} more day${bu.daysLeft === 1 ? '' : 's'} of caring \u2014 ${bu.desc} (${rpg.daysPlayed}/7 days)`;
  } else {
    const b = rpg.battle;
    el('battle-stats').textContent = `\u2694\ufe0f ATK ${b.atk} \u00b7 \ud83d\udee1\ufe0f DEF ${b.def} \u00b7 \ud83d\udca8 SPD ${b.spd}${rpg.path === 'battle' ? ' \u00b7 \ud83c\udf00 Battle Master \u00d71.15' : ''}`;
    el('battle-points-label').textContent = rpg.statPoints > 0
      ? `\u2b06\ufe0f ${rpg.statPoints} stat point${rpg.statPoints === 1 ? '' : 's'} to spend!`
      : 'Level up to earn stat points (+2 per level).';
    document.querySelectorAll('#battle-points-row .btn-stat').forEach((btn) => {
      btn.disabled = rpg.statPoints <= 0;
    });
    const grid = el('monster-grid');
    if (grid.childElementCount === 0) {
      for (const mo of rpg.monsters) {
        const card = document.createElement('div');
        card.className = 'monster-card';
        card.innerHTML = `<div class="mo-ico"></div><div class="mo-name"></div><div class="mo-lvl muted"></div><div class="mo-stats muted small"></div><button class="btn btn-amber mo-btn">\u2694\ufe0f Fight</button>`;
        card.querySelector('.mo-btn').dataset.monster = mo.id;
        grid.appendChild(card);
        monsterCards[mo.id] = card;
      }
    }
    for (const mo of rpg.monsters) {
      const card = monsterCards[mo.id];
      card.classList.toggle('locked', !mo.canFight);
      card.querySelector('.mo-ico').textContent = mo.icon;
      card.querySelector('.mo-name').textContent = mo.name;
      card.querySelector('.mo-lvl').textContent = `Lv ${mo.lvl} monster`;
      card.querySelector('.mo-stats').textContent = `HP ${mo.hp} \u00b7 ATK ${mo.atk} \u00b7 \ud83e\ude99${mo.coins[0]}-${mo.coins[1]} +${mo.xp}xp \u00b7 \u26a1${mo.energy}`;
      const btn = card.querySelector('.mo-btn');
      btn.disabled = !mo.canFight || rpg.cooldownMs > 0;
      btn.textContent = rpg.cooldownMs > 0
        ? `\ud83d\udcaa Rest ${Math.ceil(rpg.cooldownMs / 1000)}s`
        : !mo.canFight ? `Lv ${mo.lvl} + ${mo.energy}\u26a1` : '\u2694\ufe0f Fight';
    }
    el('battle-record').textContent = `Record: ${rpg.battle.wins}W \u2014 ${rpg.battle.losses}L \u00b7 Day ${rpg.daysPlayed} of your journey`;
  }

  const gu = rpgUnlock(d, 'gear');
  el('gear-lock').classList.toggle('hidden', gu.unlocked);
  el('gear-body').classList.toggle('hidden', !gu.unlocked);
  if (!gu.unlocked) {
    el('gear-lock').textContent = `${gu.icon || '\ud83d\udee1\ufe0f'} ${gu.name} opens in ${gu.daysLeft} more day${gu.daysLeft === 1 ? '' : 's'} (${rpg.daysPlayed}/14 days)`;
  } else {
    const slots = el('gear-slots');
    if (slots.childElementCount === 0) {
      for (const sl of rpg.gear.slots) {
        const sdiv = document.createElement('div');
        sdiv.className = 'gear-slot';
        sdiv.innerHTML = `<div class="gs-ico"></div><div class="gs-kind muted small">${sl.name}</div><div class="gs-name"></div><div class="gs-stats small muted"></div>`;
        slots.appendChild(sdiv);
      }
    }
    const slotDivs = slots.querySelectorAll('.gear-slot');
    const bonusTxt = (g) => {
      const parts = [];
      if (g.atk) parts.push(`\u2694\ufe0f+${g.atk}`);
      if (g.def) parts.push(`\ud83d\udee1\ufe0f+${g.def}`);
      if (g.spd) parts.push(`\ud83d\udca8+${g.spd}`);
      return parts.join(' ');
    };
    const equippedIds = [];
    rpg.gear.slots.forEach((sl, i) => {
      const sdiv = slotDivs[i];
      const equippedId = rpg.gear.equipped[sl.id];
      const def = equippedId ? rpg.gearShop.find((g) => g.id === equippedId) || null : null;
      if (equippedId) equippedIds.push(equippedId);
      sdiv.querySelector('.gs-ico').textContent = def ? def.icon : '\u2795';
      sdiv.querySelector('.gs-name').textContent = def ? def.name : 'Empty';
      sdiv.querySelector('.gs-stats').textContent = def ? bonusTxt(def) : '';
      sdiv.classList.toggle('filled', !!def);
    });
    el('gear-gacha-rates').textContent = `Rates: ${rpg.gearGacha.rates.map((g) => `${'\u2605'.repeat(g.stars)} ${g.name} ${g.rate < 1 ? g.rate : g.rate + '%'}`).join(' \u00b7 ')}`;
    el('gear-gacha-stats').textContent = `Wishes: ${rpg.gearGacha.pulls} \u00b7 Legendaries: ${rpg.gearGacha.fiveStars} \u00b7 \ud83c\udfaf Mythics: ${rpg.gearGacha.mythics} \u2014 strongest weapons live here! \ud83c\udf40`;
    const shop = el('gear-shop');
    if (shop.childElementCount === 0) {
      for (const g of rpg.gearShop) {
        const card = document.createElement('div');
        card.className = `gear-card gr-${g.rarity}`;
        card.innerHTML = `<div class="gc-ico"></div><div class="gc-name"></div><div class="gc-stats small muted"></div><button class="btn btn-amber gc-btn"></button>`;
        const btn = card.querySelector('.gc-btn');
        btn.dataset.gearbuy = g.id;
        btn.dataset.gearequip = g.id;
        shop.appendChild(card);
        gearShopCards[g.id] = card;
      }
    }
    for (const g of rpg.gearShop) {
      const card = gearShopCards[g.id];
      card.querySelector('.gc-ico').textContent = g.icon;
      card.querySelector('.gc-name').textContent = g.name;
      card.querySelector('.gc-stats').textContent = bonusTxt(g) || '\u2014';
      const btn = card.querySelector('.gc-btn');
      btn.disabled = false;
      if (equippedIds.includes(g.id)) {
        btn.textContent = '\u2713 Unequip';
      } else if (rpg.gear.owned.includes(g.id)) {
        btn.textContent = '\ud83e\uddf3 Equip';
      } else {
        btn.textContent = `\ud83e\ude99 ${g.cost}`;
        btn.disabled = d.coins < g.cost;
      }
    }
  }

  const pu = rpgUnlock(d, 'path');
  el('path-lock').classList.toggle('hidden', pu.unlocked);
  el('path-body').classList.toggle('hidden', !pu.unlocked);
  if (!pu.unlocked) {
    el('path-lock').textContent = `${pu.icon || '\ud83c\udf00'} ${pu.name} opens in ${pu.daysLeft} more day${pu.daysLeft === 1 ? '' : 's'} (${rpg.daysPlayed}/30 days)`;
  } else {
    const chosen = el('path-chosen');
    const cardsEl = el('path-cards');
    if (rpg.path) {
      chosen.classList.remove('hidden');
      chosen.textContent = rpg.path === 'work'
        ? '\ud83d\udcbc Work Master \u2014 +50% coin rate for life. The idle tycoon!'
        : '\u2694\ufe0f Battle Master \u2014 +15% battle ATK/DEF for life. The arena legend!';
      cardsEl.innerHTML = '';
    } else {
      chosen.classList.add('hidden');
      if (cardsEl.childElementCount === 0) {
        cardsEl.innerHTML = `
          <button class="path-card work" data-choosepath="work">
            <div class="pc-ico">\ud83d\udcbc</div>
            <div class="pc-name">Work Master</div>
            <div class="pc-desc muted small">+50% coin rate for life. Dominate the idle grind, buy everything, max the gacha.</div>
          </button>
          <button class="path-card fight" data-choosepath="battle">
            <div class="pc-ico">\u2694\ufe0f</div>
            <div class="pc-name">Battle Master</div>
            <div class="pc-desc muted small">+15% ATK &amp; DEF for life. Hunt monsters, hit hard, tank anything.</div>
          </button>`;
      }
    }
  }
}

function renderExplore(d) {
  const grid = el('explore-grid');
  if (!grid) return;
  const spots = d.activities.filter((a) => a.outdoor);
  if (grid.childElementCount === 0) {
    for (const a of spots) {
      const card = document.createElement('div');
      card.className = 'explore-card';
      card.innerHTML = `<div class="ex-ico"></div><div class="ex-name"></div><div class="ex-desc muted small"></div><div class="ex-meta muted small"></div><button class="btn btn-amber ex-btn">\ud83c\udf10 Explore</button>`;
      card.querySelector('.ex-btn').dataset.explore = a.id;
      grid.appendChild(card);
      exploreCards[a.id] = card;
    }
  }
  for (const a of spots) {
    const card = exploreCards[a.id];
    if (!card) continue;
    card.classList.toggle('active', a.active);
    card.classList.toggle('locked', a.cooldownRemainingMs > 0 && !a.active);
    card.querySelector('.ex-ico').textContent = a.icon;
    card.querySelector('.ex-name').textContent = a.name;
    card.querySelector('.ex-desc').textContent = a.desc;
    card.querySelector('.ex-meta').textContent = `${a.duration}s \u00b7 \u26a1${a.energy} \u00b7 \ud83e\ude99${a.coins[0]}-${a.coins[1]} \u00b7 +${a.xp}xp \u00b7 cd ${a.cooldown}s`;
    const btn = card.querySelector('.ex-btn');
    btn.disabled = a.active || d.dead;
    btn.textContent = a.active ? `\u23f3 Out exploring... ${Math.max(0, Math.ceil((a.endsAt - Date.now()) / 1000))}s` : a.cooldownRemainingMs > 0 ? `\u23f3 ${Math.ceil(a.cooldownRemainingMs / 1000)}s` : '\ud83c\udf10 Explore';
  }
}

el('battle-points-row').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-stat]');
  if (!btn || btn.disabled) return;
  const res = await api.action('allocateStat', { statId: btn.dataset.stat });
  showToast((res && res.message) || '. ..', 1800);
});

el('monster-grid').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-monster]');
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  const res = await api.action('battleMonster', { monsterId: btn.dataset.monster });
  if (res && res.ok) setBgmOverride('battle', 40000);
  if (res && res.ok && res.win) {
    for (let i = 0; i < 8; i += 1) spawnFx('coin', STAGE_CX + (Math.random() * 140 - 70), 110 + Math.random() * 40, { vy: -0.5, size: 18 });
  } else if (res && res.ok) {
    spawnFx('z', STAGE_CX, 160, { vy: -0.3, size: 16 });
  }
  showToast((res && res.message) || '. ..', 2800);
});

el('gear-shop').addEventListener('click', async (e) => {
  const buyBtn = e.target.closest('button[data-gearbuy]');
  const eqBtn = e.target.closest('button[data-gearequip]');
  if (buyBtn && !eqBtn) {
    const res = await api.action('buyGear', { gearId: buyBtn.dataset.gearbuy });
    showToast((res && res.message) || '. ..', 2400);
  } else if (eqBtn) {
    const res = await api.action('equipGear', { gearId: eqBtn.dataset.gearequip });
    showToast((res && res.message) || '. ..', 2400);
  }
});

el('gear-slots').addEventListener('click', async (e) => {
  const sdiv = e.target.closest('.gear-slot');
  if (!sdiv) return;
  const idx = Array.from(sdiv.parentElement.children).indexOf(sdiv);
  const rpg = latest && latest.derived && latest.derived.rpg;
  if (!rpg) return;
  const slotId = ['weapon', 'armor', 'charm'][idx];
  const equipped = rpg.gear.equipped[slotId];
  if (!equipped) return;
  const res = await api.action('equipGear', { gearId: equipped });
  showToast((res && res.message) || '. ..', 2000);
});

el('path-cards').addEventListener('click', async (e) => {
  const card = e.target.closest('button[data-choosepath]');
  if (!card || card.disabled) return;
  if (!window.confirm('Ito na talaga? The Destiny choice is PERMANENT for this buddy.')) return;
  const res = await api.action('choosePath', { pathId: card.dataset.choosepath });
  showToast((res && res.message) || '. ..', 3600);
});

el('explore-grid').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-explore]');
  if (!btn || btn.disabled) return;
  const res = await api.action('startActivity', { activityId: btn.dataset.explore });
  showToast((res && res.message) || '. ..', 2400);
});

async function pullGearWish(times) {
  if (gearGachaBusy) return;
  gearGachaBusy = true;
  const frame = el('gear-gacha-frame');
  const resultEl = el('gear-gacha-result');
  frame.classList.add('spinning');
  const res = await api.action('pullGearGacha', { times });
  frame.classList.remove('spinning');
  gearGachaBusy = false;
  if (!res || !res.ok) {
    sfxOnce('error');
    showToast((res && res.message) || '. ..', 2200);
    return;
  }
  const best = res.best || {};
  sfxOnce(best.rarity === 'mythic' ? 'levelup' : 'coin');
  if (best.stars >= 4) spawnConfetti(frame, best.stars);
  resultEl.className = `gacha-result r-${best.rarity}`;
  resultEl.innerHTML = `<div class="gacha-stars">${'\u2b50'.repeat(best.stars)}</div><div class="gacha-rarity">${best.rarity.toUpperCase()}</div><div class="gacha-reward">${best.gearUnlocked ? `\ud83d\udee1\ufe0f NEW GEAR: ${best.gearUnlocked}<br>` : ''}+\ud83e\ude99${best.coins}</div>`;
  resultEl.classList.remove('hidden');
  setTimeout(() => resultEl.classList.add('hidden'), 3400);
}

el('btn-gear-gacha-1').addEventListener('click', () => pullGearWish(1));
el('btn-gear-gacha-10').addEventListener('click', () => pullGearWish(10));

// ===== Cozy Bag: cosmetics & equipment inventory with PNG item icons =====
const evoTrack = { shown: false };
const bagCards = {};

function itemIconNode(itemId, fallbackEmoji) {
  const folder = itemId.startsWith('cos_') ? 'cosmetics' : 'equipment';
  const img = new Image();
  img.className = 'bag-ico pixelated';
  img.onerror = () => {
    const fb = document.createElement('span');
    fb.className = 'bag-ico';
    fb.textContent = fallbackEmoji;
    if (img.parentNode) img.parentNode.replaceChild(fb, img);
  };
  img.src = `../../assets/sprites/items/${folder}/${itemId}.png`;
  return img;
}

function bonusText(it) {
  const parts = [];
  if (it.str) parts.push(`+${it.str} STR`);
  if (it.def) parts.push(`+${it.def} DEF`);
  if (it.agi) parts.push(`+${it.agi} AGI`);
  if (it.mag) parts.push(`+${it.mag} MAG`);
  if (it.luk) parts.push(`+${it.luk} LUK`);
  return parts.length ? parts.join(' ') : (it.id === engine.EVO_STONE_ID ? 'Unlocks Stage 2 Evolution' : 'Keepsake');
}

function renderBag(d) {
  const r = d.rpg;
  const lock = el('bag-lock');
  const body = el('bag-body');
  const unlock = (r.unlocks || []).find((u) => u.id === 'items');
  if (!unlock || !unlock.unlocked) {
    lock.classList.remove('hidden');
    lock.textContent = unlock
      ? `${unlock.icon} ${unlock.name} unlocks after ${unlock.day} days of play \u2014 ${unlock.daysLeft} day${unlock.daysLeft === 1 ? '' : 's'} to go!`
      : 'The Cozy Bag is still locked.';
    body.classList.add('hidden');
    return;
  }
  lock.classList.add('hidden');
  body.classList.remove('hidden');
  const b = r.items.bonus;
  el('bag-bonus').textContent = `Bag bonus \u00b7 STR +${b.str} \u00b7 DEF +${b.def} \u00b7 AGI +${b.agi} \u00b7 MAG +${b.mag} \u00b7 LUK +${b.luk}${r.items.evolved ? ' \u00b7 \u2b50 Stage 2 (+25%)' : ''}`;
  const stone = el('bag-evostone');
  if (r.items.evolutionNote !== false) {
    stone.textContent = r.items.evoStoneCount > 0
      ? `\ud83d\udd2e ${r.items.evoStoneCount} Evo Stone${r.items.evoStoneCount === 1 ? '' : 's'} in your bag${r.items.evolved ? ' \u2014 already Stage 2!' : ' \u2014 evolve anytime, or wait for Level 10!'}`
      : (r.items.evolved ? '\u2728 Stage 2 achieved \u2014 bathala-level style!' : `\ud83d\udd2e Evo Stone auto-evolves at Level ${r.items.evolveAt}`);
  }
  const grid = el('bag-grid');
  grid.innerHTML = '';
  for (const it of r.items.shop) {
    let card = bagCards[it.id] || document.createElement('div');
    if (!bagCards[it.id]) {
      card.className = 'bag-card';
      card.dataset.item = it.id;
      card.appendChild(itemIconNode(it.id, it.icon));
      const mid = document.createElement('div');
      mid.innerHTML = '<div class="b-name"></div><div class="b-bonus"></div><div class="b-slot"></div>';
      const btn = document.createElement('button');
      btn.className = 'btn b-btn';
      card.appendChild(mid);
      card.appendChild(btn);
      card._els = {
        name: mid.querySelector('.b-name'),
        bonus: mid.querySelector('.b-bonus'),
        slot: mid.querySelector('.b-slot'),
        btn,
      };
    }
    card._els.name.textContent = `${it.icon} ${it.name}`;
    card._els.bonus.textContent = bonusText(it);
    card._els.slot.textContent = it.kind === 'cosmetic' ? `Cosmetic \u00b7 ${it.slot}` : `${it.type}${it.kind === 'special' ? ' \u00b7 keepsake' : ''}`;
    const btn = card._els.btn;
    if (!it.owned) {
      btn.textContent = `\ud83e\ude99${it.cost}`;
      btn.disabled = !!latest.state.dead || latest.state.coins < it.cost;
    } else if (it.equipped) {
      btn.textContent = 'Unequip';
    } else {
      btn.textContent = 'Equip';
    }
    grid.appendChild(card);
  }
}

function showEvoPopup(speciesId) {
  const popup = el('evo-popup');
  const canvasEl = el('evo-canvas');
  if (!popup || !canvasEl) return;
  el('evo-name').textContent = evoNameFor(speciesId) || 'Stage 2 Form';
  const cctx = canvasEl.getContext('2d');
  cctx.imageSmoothingEnabled = false;
  cctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  const evoSingle = evoSingleFor(speciesId, 'IDLE');
  const evoFrame = !evoSingle ? evoSheetFrameFor(speciesId, 'IDLE') : null;
  if (evoSingle) {
    cctx.drawImage(evoSingle, 0, 0, canvasEl.width, canvasEl.height);
  } else if (evoFrame) {
    cctx.drawImage(evoFrame.img, evoFrame.idx * evoFrame.frameW, 0, evoFrame.frameW, evoFrame.frameH, 0, 0, canvasEl.width, canvasEl.height);
  } else {
    try {
      const bank = sprites.ensurePetSprites(speciesId);
      if (bank && bank.IDLE) cctx.drawImage(bank.IDLE[0], 0, 0, canvasEl.width, canvasEl.height);
    } catch (err) { /* fallback keeps frame empty */ }
  }
  popup.classList.remove('hidden');
  spawnConfetti(popup, 5);
  if (sfx) sfx.play('evolve');
  setTimeout(() => popup.classList.add('hidden'), 5200);
}

el('bag-grid').addEventListener('click', (e) => {
  const card = e.target.closest('.bag-card');
  if (!card || !card.dataset.item) return;
  const itemId = card.dataset.item;
  const it = engine.ITEMS.find((x) => x.id === itemId);
  if (!it) return;
  if (!it.owned) act('buyItem', { itemId });
  else act('equipItem', { itemId });
});
