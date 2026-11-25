'use strict';

const api = window.BuddyAPI;
const sprites = window.JBSprites;
const sfx = window.JBSfx;
const sfxLast = {};

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

const FOOD_PNG_BASE = '../assets/sprites/food/';
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
      ['asean', '🌴 ASEAN'],
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
      tile.addEventListener('click', () => act('setSpecies', { speciesId: p.id }));
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

const petWalk = { x: STAGE_CX, dir: 1, target: null, moving: false };
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
      img.src = `../assets/sprites/${id}_${sf}_${f}.png`;
      imgs.push(img);
    }
    stageFrames[key] = imgs;
  }
  return stageFrames[key].filter((i) => !i.bad && i.complete && i.naturalWidth > 0);
}

const stageSingle = {};

function stageSingleFor(id, state) {
  const key = `${id}_${STAGE_STATE_FILE[state]}`;
  if (!(key in stageSingle)) {
    const img = new Image();
    img.onerror = () => { stageSingle[key] = null; };
    img.src = `../assets/sprites/${key}.png`;
    stageSingle[key] = img;
  }
  const img = stageSingle[key];
  return img && img.complete && img.naturalWidth > 0 ? img : null;
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
  sctx.imageSmoothingEnabled = false;
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

function drawStagePet(now) {
  const groundY = STAGE_GROUND;
  stageCtx.clearRect(0, 0, petStageCanvas.width, petStageCanvas.height);
  const pre = latest && latest.derived;
  drawRoom(now, pre && pre.phase ? pre.phase.id : 'day', pre && pre.weather ? pre.weather.id : 'clear');

  const dt = Math.min(0.12, Math.max(0, (now - lastStageNow) / 1000));
  lastStageNow = now;

  if (!latest) return;
  const d = latest.derived;
  const s = latest.state;

  const st0 = stageStateFor();
  if (st0 === 'SLEEP' || st0 === 'EAT') petWalk.target = null;
  if (petWalk.target !== null) {
    const dx = petWalk.target - petWalk.x;
    if (Math.abs(dx) > 4) {
      petWalk.dir = dx > 0 ? 1 : -1;
      petWalk.x = Math.max(70, Math.min(STAGE_W - 70, petWalk.x + petWalk.dir * 95 * dt));
      petWalk.moving = true;
    } else {
      petWalk.target = null;
      petWalk.moving = false;
    }
  } else {
    petWalk.moving = false;
  }
  if (st0 === 'IDLE' && !petWalk.target && !s.flags.working && !s.activity && Math.random() < 0.004) {
    petWalk.target = 110 + Math.random() * 260;
  }

  const st = petWalk.moving ? 'WALK' : st0;
  const stageScale = d.stage ? d.stage.scale : 1;
  const boxSize = Math.round(264 * stageScale);
  petDraw = { cx: petWalk.x, size: boxSize, dir: petWalk.dir };

  stageCtx.save();
  stageCtx.globalAlpha = 0.22;
  stageCtx.fillStyle = '#000';
  stageCtx.beginPath();
  stageCtx.ellipse(petWalk.x, groundY + 4, 64, 10, 0, 0, Math.PI * 2);
  stageCtx.fill();
  stageCtx.restore();

  if (st === 'EAT') drawFoodBowl(petWalk.x + 52 * petWalk.dir);

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
    const prog = Math.max(0.04, Math.min(1, (s.pet.xp || 0) / 14));
    if (prog > 0.8 && Math.random() < 0.05) spawnFx('spark', STAGE_CX + (Math.random() * 40 - 20), 220, { vy: -0.3, size: 10 });
    stageCtx.save();
    stageCtx.imageSmoothingEnabled = false;
    drawWithSkin((g) => eggToCtx(g, now, prog), tint);
    stageCtx.restore();
  } else {
    const bobbing = st === 'HAPPY' || st === 'WALK';
    const yOff = bobbing ? Math.round(Math.sin(now / 260) * 4) : 0;

    stageCtx.save();
    stageCtx.imageSmoothingEnabled = false;

    const drawPath = (g) => {
      g.save();
      g.translate(petWalk.x, 0);
      if (petWalk.dir < 0) g.scale(-1, 1);
      const bx = -boxSize / 2;
      const by = groundY - boxSize + yOff;
      const pngs = stageFramesFor(s.pet.species || 'kala', st);
      const single = stageSingleFor(s.pet.species || 'kala', st);
      if (pngs.length > 0) {
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

    if (st === 'SLEEP' && Math.random() < 0.02) spawnFx('z', petWalk.x + 20, groundY - boxSize + 24, { vy: -0.35, size: 15 });
    if (st === 'EAT' && Math.random() < 0.02) spawnFx('crumb', petWalk.x + 40, groundY - 12, { vy: -0.3, size: 10 });
    if ((s.flags.working || s.activity) && Math.random() < 0.012) spawnFx('coin', petWalk.x + (Math.random() < 0.5 ? -50 : 50), 90, { vy: -0.4, size: 18 });
    if (petWalk.moving && Math.random() < 0.09) spawnFx('spark', petWalk.x - petWalk.dir * boxSize * 0.3, groundY - 4, { vy: -0.15, size: 10 });
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

function drawFoodBowl(x) {
  stageCtx.save();
  stageCtx.fillStyle = '#be123c';
  stageCtx.beginPath();
  stageCtx.moveTo(x - 17, 275);
  stageCtx.lineTo(x + 17, 275);
  stageCtx.lineTo(x + 12, 287);
  stageCtx.lineTo(x - 12, 287);
  stageCtx.closePath();
  stageCtx.fill();
  stageCtx.strokeStyle = '#881337';
  stageCtx.lineWidth = 2;
  stageCtx.stroke();
  stageCtx.fillStyle = Math.sin(Date.now() / 300) > 0 ? '#eab308' : '#d97706';
  stageCtx.beginPath();
  stageCtx.ellipse(x, 275, 13, 5, 0, 0, Math.PI * 2);
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
  if (latest && !latest.state.dead && Math.abs(x - petDraw.cx) < petDraw.size / 2 + 14 && y > 20 && y < STAGE_GROUND + 16) {
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
  if (latest && latest.state.dead) return;
  petWalk.target = Math.max(70, Math.min(STAGE_W - 70, x));
  if (sfx) sfx.play('click');
});

document.querySelectorAll('#tab-bar .studio-tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#tab-bar .studio-tab').forEach((b) => b.classList.toggle('on', b === btn));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.add('hidden'));
    document.querySelector(`.panel-${btn.dataset.tab}`).classList.remove('hidden');
  });
});

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
