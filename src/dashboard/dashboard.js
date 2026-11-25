'use strict';

const api = window.BuddyAPI;
const sprites = window.JBSprites;
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
  showToast(res && res.message);
}

function render(snapshot) {
  latest = snapshot;
  const { state: s, derived: d, toast } = snapshot;

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

function drawStagePet(now) {
  const cx = 120;
  const groundY = 224;
  stageCtx.clearRect(0, 0, petStageCanvas.width, petStageCanvas.height);
  stageCtx.save();
  stageCtx.globalAlpha = 0.22;
  stageCtx.fillStyle = '#000';
  stageCtx.beginPath();
  stageCtx.ellipse(cx, groundY, 52, 9, 0, 0, Math.PI * 2);
  stageCtx.fill();
  stageCtx.restore();

  if (!latest) return;
  const speciesId = latest.state.pet.species || 'kala';
  const state = stageStateFor();
  const bobbing = state === 'HAPPY' || state === 'WALK';
  const yOff = bobbing ? Math.round(Math.sin(now / 260) * 4) : 0;

  stageCtx.save();
  stageCtx.imageSmoothingEnabled = false;

  const pngs = stageFramesFor(speciesId, state);
  const single = stageSingleFor(speciesId, state);
  if (pngs.length > 0) {
    const img = pngs[Math.floor(now / 170) % pngs.length];
    stageCtx.drawImage(img, cx - 112, groundY - 224 + yOff, 224, 224);
  } else if (single) {
    stageCtx.drawImage(single, cx - 112, groundY - 224 + yOff, 224, 224);
  } else {
    let bank = null;
    try {
      bank = sprites.ensurePetSprites(speciesId);
    } catch (err) {
      bank = null;
    }
    if (bank && bank[state]) {
      const frame = bank[state][Math.floor(now / 170) % bank[state].length];
      stageCtx.drawImage(frame, cx - 112, groundY - 224 + yOff, 224, 224);
    }
  }
  stageCtx.restore();
}


let lastStagePat = 0;
petStageCanvas.addEventListener('click', async () => {
  const now = performance.now();
  if (now - lastStagePat < 900) return;
  lastStagePat = now;
  const res = await api.action('pat');
  showToast((res && res.message) || 'hehe~', 1500);
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
