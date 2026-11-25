'use strict';

const api = window.BuddyAPI;
const sprites = window.JBSprites;
const sfx = window.JBSfx;
const cuteSfx = window.CuteSfx;
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

const UI_THEMES = ['classic', 'mint', 'sky', 'berry', 'violet', 'sunset'];
let currentTheme = 'classic';
let rainMode = 'off';
const WALLPAWS = ['auto', 'cream', 'sky_blue', 'sakura_pink', 'mint_green', 'lavender', 'peach', 'dark_coffee', 'aqua', 'sunshine_yellow', 'periwinkle'];
let currentWallPaw = 'auto';

function applyWallPaw(pick) {
  currentWallPaw = WALLPAWS.includes(pick) ? pick : 'auto';
  if (typeof document === 'undefined' || !document.body || !document.body.classList) return;
  WALLPAWS.forEach((w2) => {
    if (w2 !== 'auto') document.body.classList.toggle(`wallpaw-${w2}`, currentWallPaw === w2);
  });
}

function applyTheme(theme) {
  currentTheme = UI_THEMES.includes(theme) ? theme : 'classic';
  if (typeof document === 'undefined' || !document.body || !document.body.classList) return;
  UI_THEMES.forEach((t) => document.body.classList.toggle(`theme-${t}`, currentTheme === t));
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
  const gfxSelect = el('set-gfx');
  const bgmRange = el('set-bgm');
  const sfxRange = el('set-sfx');
  const musicOn = st.bgmOn !== undefined ? st.bgmOn : (bgm ? bgm.getEnabled() : true);
  if (bgmToggle) bgmToggle.textContent = musicOn ? '🎵 Music: On' : '🔇 Music: Off';
  if (gfxSelect && document.activeElement !== gfxSelect) gfxSelect.value = st.pixelGraphics === false ? 'smooth' : 'pixel';
  if (bgmRange && document.activeElement !== bgmRange) bgmRange.value = String(Math.round((st.bgmVol || 0.5) * 100));
  if (sfxRange && document.activeElement !== sfxRange) sfxRange.value = String(Math.round((st.sfxVol || 0.7) * 100));
  const swatches = document.querySelectorAll('.theme-swatch');
  if (swatches && swatches.forEach) swatches.forEach((sw) => {
    sw.classList.toggle('on', sw.dataset && sw.dataset.theme === (st.theme || 'classic'));
  });
  const wpicks = document.querySelectorAll('.wallpaw-pick');
  if (wpicks && wpicks.forEach) wpicks.forEach((wp) => {
    wp.classList.toggle('on', wp.dataset && wp.dataset.wallpaw === (st.wallPaw || 'auto'));
  });
}

function namedAlready() {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('juanbuddy-named') === '1';
  } catch (err) { return false; }
}

function clearNamedFlag() {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem('juanbuddy-named');
  } catch (err) { /* ignore */ }
}

function maybeShowNameModal() {
  const modal = el('name-modal');
  if (!modal || namedAlready() || !latest) return;
  const s = latest.state;
  if (s && s.pet && s.pet.name === 'Buddy' && s.pet.stage === 'egg') {
    modal.classList.remove('hidden');
    const input = el('name-input');
    if (input) setTimeout(() => { try { input.focus(); } catch (err) { /* ignore */ } }, 60);
  }
}

let perkKeyShown = null;

function maybeShowPerkModal(d) {
  const modal = el('perk-modal');
  if (!modal || !d.perks) return;
  const pending = d.perks.pending;
  if (!pending) {
    if (perkKeyShown) {
      modal.classList.add('hidden');
      perkKeyShown = null;
    }
    return;
  }
  const key = `${pending.at}:${(pending.choices || []).map((c) => `${c.type}${c.rarity}`).join(',')}`;
  if (perkKeyShown === key && !modal.classList.contains('hidden')) return;
  perkKeyShown = key;
  const wrap = el('perk-choices');
  if (wrap) {
    wrap.innerHTML = '';
    (pending.choices || []).forEach((c, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `perk-choice ${c.rarity === 'epic' ? 'epic' : ''}`;
      btn.dataset.perkIdx = String(i);
      btn.innerHTML = `<span class="pk-ico"></span><span class="pk-name"></span><span class="pk-desc"></span><span class="pk-badge"></span>`;
      btn.querySelector('.pk-ico').textContent = c.icon || '\uD83E\uDDF0';
      btn.querySelector('.pk-name').textContent = c.name || c.type;
      btn.querySelector('.pk-desc').textContent = c.desc || '';
      const badge = btn.querySelector('.pk-badge');
      badge.textContent = c.rarity === 'epic' ? '\u2728 EPIC (1%)' : 'COMMON';
      wrap.appendChild(btn);
    });
  }
  modal.classList.remove('hidden');
  sfxOnce('levelup');
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
    buyItem: 'buy', equipItem: 'happy', useEvoStone: 'evolve', choosePerk: 'levelup',
  };
  sfxOnce(map[action] || 'click');
  if (action === 'feed' && cuteSfx) cuteSfx.play('munch');
  if (action === 'claimDaily' && cuteSfx) cuteSfx.play('stamp');
}
const UPGRADE_META = {
  bed: { icon: '🛏', title: 'Cozy Bed', desc: 'Energy drains 12% slower per level' },
  toys: { icon: '🧸', title: 'Toy Box', desc: 'Playing gives +25% happiness per level' },
  job: { icon: '📈', title: 'Job Promotion', desc: '+60% coins per level while working' },
  feeder: { icon: '🍽', title: 'Auto-Feeder', desc: 'Auto-feeds a Snack below 20 hunger' },
};
const UPGRADE_MAX = { bed: 5, toys: 5, job: 10, feeder: 1 };

let latest = null;
const renderTextCache = {};
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
const on = (id, ev, fn) => { const node = el(id); if (node) node.addEventListener(ev, fn); };

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
    if (d.settings.theme && d.settings.theme !== currentTheme) applyTheme(d.settings.theme);
    if (d.settings.wallPaw && d.settings.wallPaw !== currentWallPaw) applyWallPaw(d.settings.wallPaw);
  }
  const weatherId = d.weather ? d.weather.id : 'clear';
  const wantRain = weatherId === 'stormy' ? 'storm' : weatherId === 'rainy' ? 'rain' : 'off';
  if (wantRain !== rainMode) {
    rainMode = wantRain;
    if (sfx) { try { sfx.setRain(wantRain); } catch (err) { /* audio unavailable */ } }
    if (document.body && document.body.classList) document.body.classList.toggle('rain-active', wantRain !== 'off');
  }
  const homeTitle = el('home-title');
  if (homeTitle) homeTitle.textContent = `🏠 ${s.pet.name}'s Home`;
  maybeShowNameModal();
  maybeShowPerkModal(d);

  if (toast && sfx) {
    const msg = String(toast);
    if (msg.includes('Achievement')) sfxOnce('achv');
    else if (msg.includes('hatched')) sfxOnce('hatch');
    else if (msg.includes('evolved')) sfxOnce('evolve');
    else if (msg.includes('passed away')) sfxOnce('death');
    else if (msg.includes('Daily bonus')) sfxOnce('daily');
  }

  if (renderTextCache.petName !== s.pet.name) { renderTextCache.petName = s.pet.name; el('pet-name').textContent = s.pet.name; }
  if (renderTextCache.level !== s.pet.level) { renderTextCache.level = s.pet.level; el('level').textContent = s.pet.level; }
  updateBrandFace(s);

  const coinNum = Math.floor(s.coins);
  if (renderTextCache.coins !== coinNum) { renderTextCache.coins = coinNum; el('coins').textContent = coinNum; }
  const rateTxt = s.flags.working ? `+${d.coinRate.toFixed(1)}/s` : 'not working';
  if (renderTextCache.rate !== rateTxt) { renderTextCache.rate = rateTxt; el('coin-rate').textContent = rateTxt; }

  setMeter('hunger', s.meters.hunger);
  setMeter('energy', s.meters.energy);
  setMeter('happy', s.meters.happiness);
  setMeter('xp', Math.min(100, (s.pet.xp / Math.max(1, d.nextLevelXp)) * 100));

  const stateBadge = el('play-state');
  const t = Date.now();
  stateBadge.textContent = s.flags.sleeping ? 'SLEEPING'
    : s.effects.eatUntil > t ? 'EATING'
    : s.effects.happyUntil > t ? 'HAPPY'
    : s.activity ? 'ON ACTIVITY'
    : s.flags.working ? 'WORKING'
    : (d.statusText || 'IDLE').toUpperCase();

  if (d.weather) el('weather-chip').textContent = `${d.weather.icon} ${d.weather.label}`;
  if (d.phase) {
    el('phase-chip').innerHTML = `<img class="phase-ico pixelated" src="assets/icons/${d.phase.id === 'night' ? 'weather_night_firefly' : 'weather_sun'}.png" alt="" draggable="false"> ${d.phase.label}`;
    if (window.JuanBuddyEco && window.JuanBuddyEco.setTimeOfDay) window.JuanBuddyEco.setTimeOfDay(d.phase.id === 'night' ? 'night' : 'day');
  }
  const streakNow = d.daily ? d.daily.streak : 0;
  const streakIco = streakNow >= 14 ? 'streak_tree' : streakNow >= 7 ? 'streak_sapling' : streakNow >= 3 ? 'streak_sprout' : 'streak_seed';
  el('streak-chip').innerHTML = `<img class="streak-ico pixelated" src="assets/icons/${streakIco}.png" alt="" draggable="false"> ${streakNow}`;

  const hudStreakSrc = `assets/icons/${streakIco}.png`;
  const hudStreakIco = el('hud-streak-ico');
  if (hudStreakIco && hudStreakIco.getAttribute('src') !== hudStreakSrc) hudStreakIco.setAttribute('src', hudStreakSrc);
  const hudStreakDays = el('hud-streak-days');
  if (hudStreakDays) hudStreakDays.textContent = `${streakNow}d`;
  const calDotEl = el('cal-dot');
  if (calDotEl) calDotEl.classList.toggle('hidden', !d.daily || d.daily.claimedToday);
  const questsQ = d.quests || {};
  const questsDone = (questsQ.feedClaimed ? 1 : 0) + (questsQ.playClaimed ? 1 : 0) + (questsQ.cleanClaimed ? 1 : 0);
  const questCountEl = el('quest-count');
  if (questCountEl) questCountEl.textContent = `${questsDone}/3`;
  if (questsPopOpen) renderQuestsPop();

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
  renderPetShop(d);

  if (d.rpg.items.evolved && !evoTrack.shown) {
    evoTrack.shown = true;
    showEvoPopup(s.pet.species);
  } else if (!d.rpg.items.evolved) {
    evoTrack.shown = false;
  }

  el('btn-work').classList.toggle('on', s.flags.working);
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

function flagCanvas(country, w, h) {
  const cw = w || 22;
  const ch = h || 15;
  const cv = document.createElement('canvas');
  cv.width = cw;
  cv.height = ch;
  cv.className = 'flag-node pixelated';
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const t = ch / 3;
  const star = (cx, cy, r, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const ang = -Math.PI / 2 + (i * Math.PI) / 5;
      const rad = i % 2 === 0 ? r : r * 0.45;
      const sx = cx + Math.cos(ang) * rad;
      const sy = cy + Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.fill();
  };
  const stripes = (colors) => {
    colors.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect(0, (ch / colors.length) * i, cw, ch / colors.length + 1);
    });
  };
  switch (country) {
    case 'Philippines':
      ctx.fillStyle = '#0038a8'; ctx.fillRect(0, 0, cw, ch / 2);
      ctx.fillStyle = '#ce1126'; ctx.fillRect(0, ch / 2, cw, ch / 2);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(cw * 0.45, ch / 2); ctx.lineTo(0, ch); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fcd116'; ctx.fillRect(cw * 0.16 - 2, ch / 2 - 2, 4, 4);
      break;
    case 'Thailand':
      stripes(['#a51931', '#f4f5f8', '#2d2a4a', '#f4f5f8', '#a51931']);
      break;
    case 'Vietnam':
      ctx.fillStyle = '#da251d'; ctx.fillRect(0, 0, cw, ch);
      star(cw / 2, ch / 2, ch * 0.25, '#ffff00');
      break;
    case 'Indonesia':
      ctx.fillStyle = '#ce1126'; ctx.fillRect(0, 0, cw, ch / 2);
      ctx.fillStyle = '#fff'; ctx.fillRect(0, ch / 2, cw, ch / 2);
      break;
    case 'Malaysia': {
      for (let i = 0; i < 7; i += 1) {
        ctx.fillStyle = i % 2 === 0 ? '#cc0001' : '#fff';
        ctx.fillRect(0, (ch / 7) * i, cw, ch / 7 + 1);
      }
      ctx.fillStyle = '#010066'; ctx.fillRect(0, 0, cw * 0.5, ch / 2);
      ctx.fillStyle = '#ffcc00'; ctx.beginPath(); ctx.arc(cw * 0.25, ch / 4, ch * 0.13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#010066'; ctx.beginPath(); ctx.arc(cw * 0.29, ch / 4, ch * 0.11, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'Singapore':
      ctx.fillStyle = '#ce1126'; ctx.fillRect(0, 0, cw, ch / 2);
      ctx.fillStyle = '#fff'; ctx.fillRect(0, ch / 2, cw, ch / 2);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cw * 0.25, ch * 0.25, ch * 0.13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ce1126'; ctx.beginPath(); ctx.arc(cw * 0.29, ch * 0.25, ch * 0.11, 0, Math.PI * 2); ctx.fill();
      break;
    case 'India':
      stripes(['#ff9933', '#ffffff', '#138808']);
      ctx.fillStyle = '#000080'; ctx.beginPath(); ctx.arc(cw / 2, ch / 2, ch * 0.13, 0, Math.PI * 2); ctx.fill();
      break;
    case 'Japan':
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = '#bc002d'; ctx.beginPath(); ctx.arc(cw / 2, ch / 2, ch * 0.3, 0, Math.PI * 2); ctx.fill();
      break;
    case 'China':
      ctx.fillStyle = '#de2910'; ctx.fillRect(0, 0, cw, ch);
      star(cw * 0.2, ch * 0.3, ch * 0.18, '#ffde00');
      break;
    case 'Russia':
      stripes(['#ffffff', '#0039a6', '#d52b1e']);
      break;
    case 'Italy':
      ctx.fillStyle = '#009246'; ctx.fillRect(0, 0, cw / 3, ch);
      ctx.fillStyle = '#fff'; ctx.fillRect(cw / 3, 0, cw / 3, ch);
      ctx.fillStyle = '#ce2b37'; ctx.fillRect(cw * 2 / 3, 0, cw / 3 + 1, ch);
      break;
    default:
      ctx.fillStyle = '#9a8f7d'; ctx.fillRect(0, 0, cw, ch);
      break;
  }
  return cv;
}

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
      ['all', '✨ All', ''],
      ['ph', 'PH Favorites', 'Philippines'],
      ['asean', '🌴 SE Asia', ''],
      ['india', 'India', 'India'],
      ['world', '🌏 World', ''],
    ];
    for (const [key, label, flagCountry] of defs) {
      const chip = document.createElement('button');
      chip.className = 'filter-chip';
      if (flagCountry && key !== 'all') chip.appendChild(flagCanvas(flagCountry, 20, 14));
      chip.appendChild(document.createTextNode(` ${label}`));
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
      mid.querySelector('.f-name').appendChild(flagCanvas(del.country, 20, 14));
      mid.querySelector('.f-name').appendChild(document.createElement('span')).className = 'f-name-text';
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
    card._els.name.textContent = del.name;
    card._els.meta.textContent = `🍖${del.hunger} · 💖${del.happy}${del.energy ? ` · ⚡${del.energy}` : ''}${del.buff ? ` · ${del.buff.label}` : ''}`;
    card._els.favTag.textContent = isFav ? '★ ' + fav.name + "'s favorite!" : '';
    const afford = s.coins >= del.cost;
    card._els.btn.textContent = del.cost === 0 ? 'FREE' : `💰${del.cost}`;
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
      `⚡${a.energy} · 💰${a.coins[0]}–${a.coins[1]} · +${a.xp} XP · ${a.duration}s · CD ${a.cooldown}s`;
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
      const animInfo = STAGE_PNG_ANIMS[p.id];
      let vis;
      if (animInfo) {
        vis = document.createElement('img');
        vis.className = 'pixelated';
        vis.draggable = false;
        vis.alt = p.name;
        vis.src = `../../assets/sprites/${animInfo.dir}/frames/${animInfo.name}_frame_01.png`;
      } else {
        vis = document.createElement('canvas');
        vis.width = 32;
        vis.height = 32;
        try {
          const bank = sprites.ensurePetSprites(p.id);
          const cctx = vis.getContext('2d');
          cctx.imageSmoothingEnabled = false;
          cctx.drawImage(bank.IDLE[0], 0, 0, 32, 32);
        } catch (err) { /* preview only */ }
      }
      const name = document.createElement('span');
      name.className = 'b-name';
      name.textContent = p.name;
      const flag = document.createElement('span');
      flag.className = 'b-flag';
      flag.appendChild(flagCanvas(p.country, 20, 14));
      flag.appendChild(document.createTextNode(` ${p.country}`));
      tile.appendChild(vis);
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

const BRAND_FACE_PAW = '../../assets/sprites/ui/hud_icons/icons_1x_native/icon_paw.png';
function updateBrandFace(s) {
  const face = el('brand-face');
  if (!face) return;
  const pid = s.pet && s.pet.species;
  const animInfo = pid ? STAGE_PNG_ANIMS[pid] : null;
  const src = !pid || s.pet.stage === 'egg'
    ? BRAND_FACE_PAW
    : animInfo
      ? `../../assets/sprites/${animInfo.dir}/frames/${animInfo.name}_frame_01.png`
      : `../../assets/sprites/${pid}_idle_0.png`;
  if (face.dataset.src !== src) {
    face.dataset.src = src;
    face.src = src;
  }
}

const meterCache = {};
function setMeter(prefix, value) {
  const rounded = Math.round(value);
  if (meterCache[prefix] === rounded) return;
  meterCache[prefix] = rounded;
  const fill = el(`${prefix}-fill`);
  const val = el(`${prefix}-val`);
  if (fill) fill.style.width = pct(value);
  if (val) val.textContent = `${Math.round(value)}%`;
  if (prefix === 'xp') {
    const hudFill = el('hud-exp-fill');
    const hudPct = el('hud-exp-pct');
    if (hudFill) hudFill.style.width = pct(value);
    if (hudPct) hudPct.textContent = `${Math.round(value)}%`;
  }
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
    btn.textContent = maxed ? 'Maxed out' : `Upgrade — 💰${cost}`;
  }
}

on('food-search','input', (e) => {
  foodState.query = e.target.value.trim().toLowerCase();
  if (latest) renderFoods(latest.state, latest.derived);
});

on('btn-play','click', () => act('play'));
on('btn-work','click', () => act('toggleWork'));
on('btn-sleep','click', () => act('toggleSleep'));
on('btn-cheer','click', async () => {
  const ev = await window.BuddyAPI.getEvent();
  if (ev && ev.native) showToast(`✨ ${ev.native}\n${ev.romanization ? '(' + ev.romanization + ') — ' : ''}${ev.translation}`, 5000);
});

on('pet-name','click', () => {
  const name = window.prompt('Rename your buddy:', latest ? latest.state.pet.name : 'Buddy');
  if (name) act('rename', { name });
});

on('open-login','change', (e) => {
  api.action('setOpenAtLogin', { open: e.target.checked });
});

on('btn-reset','click', async () => {
  if (!window.confirm('Reset all progress? This cannot be undone.')) return;
  const res = await api.action('reset');
  if (res && res.ok) clearNamedFlag();
  showToast('Progress reset.');
});

on('btn-admin-day','click', async () => {
  if (sfx) sfx.play('click');
  await act('adminAddDay');
});

// ==== Splash / loading screen ====
let splashReadyShown = false;
function splashSetup() {
  const splash = el('splash');
  if (!splash) return;
  const fill = el('splash-fill');
  const status = el('splash-status');
  const start = el('btn-splash-start');
  let progress = 0;
  const timer = setInterval(() => {
    progress = Math.min(100, progress + (splashReadyShown ? 12 : 7));
    if (fill) fill.style.width = `${progress}%`;
    if (status && progress >= 100) status.textContent = 'Ready!';
    if (progress >= 100) {
      clearInterval(timer);
      if (start) start.disabled = false;
    }
  }, 95);
  if (start) start.addEventListener('click', () => {
    splash.classList.add('hidden');
    startBgmOnGesture();
    if (sfx) sfx.play('happy');
  });
  const exit = el('btn-splash-exit');
  if (exit) exit.addEventListener('click', () => {
    if (api && api.action) api.action('exitApp');
    else if (typeof window.close === 'function') window.close();
  });
  const creditsBox = el('splash-credits');
  const creditsBtn = el('btn-splash-credits');
  const creditsBack = el('btn-splash-credits-back');
  const openCredits = () => {
    const modal = el('credits-modal');
    if (modal) modal.classList.remove('hidden');
    else if (creditsBox) creditsBox.classList.remove('hidden');
    if (sfx) sfx.play('click');
  };
  if (creditsBtn) creditsBtn.addEventListener('click', openCredits);
  if (creditsBox && creditsBack) creditsBack.addEventListener('click', () => creditsBox.classList.add('hidden'));
  const updatesBtn = el('btn-splash-updates');
  if (updatesBtn) updatesBtn.addEventListener('click', () => {
    const url = 'https://github.com/JUANbungo/Juan-Buddy/releases/latest';
    if (api && api.action) api.action('openUrl', { url });
    else if (typeof window.open === 'function') window.open(url, '_blank');
    if (sfx) sfx.play('click');
  });
}
splashSetup();

api.onState(render);
api.getState().then((snap) => {
  if (snap) el('open-login').checked = !!snap.openAtLogin;
  render(snap);
  splashReadyShown = true;
  initLaunchPopups(snap);
}).catch(() => { splashReadyShown = true; });

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

const STAGE_PNG_ANIMS = {
  pusa: { dir: 'pusa/pusa', name: 'pusa', frames: 8 },
  agila: { dir: 'pusa/agila', name: 'agila', frames: 8 },
  uwak: { dir: 'pusa/uwak', name: 'uwak', frames: 8 },
  ahas: { dir: 'pusa/ahas', name: 'ahas', frames: 8 },
  dragon: { dir: 'pusa/dragon_flame', name: 'dragon_flame', frames: 12 },
};

function stageFramesFor(id, state) {
  const anim = STAGE_PNG_ANIMS[id];
  const key = anim ? `${id}#${state}` : `${id}_${state}`;
  if (!(key in stageFrames)) {
    const imgs = [];
    if (anim) {
      for (let f = 1; f <= anim.frames; f += 1) {
        const img = new Image();
        img.onerror = () => { img.bad = true; };
        img.src = `../../assets/sprites/${anim.dir}/frames/${anim.name}_frame_${String(f).padStart(2, '0')}.png`;
        imgs.push(img);
      }
    } else {
      const sf = STAGE_STATE_FILE[state];
      for (let f = 0; f < 4; f += 1) {
        const img = new Image();
        img.onerror = () => { img.bad = true; };
        img.src = `../../assets/sprites/${id}_${sf}_${f}.png`;
        imgs.push(img);
      }
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

const gradientCache = new Map();
function cachedGradient(key, make) {
  let g = gradientCache.get(key);
  if (!g) {
    g = make();
    gradientCache.set(key, g);
  }
  return g;
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
  const wallGrad = cachedGradient(`wall:${phaseId}`, () => {
    const wg = stageCtx.createLinearGradient(0, 0, 0, fy);
    wg.addColorStop(0, wallTop);
    wg.addColorStop(1, wallBot);
    return wg;
  });
  stageCtx.fillStyle = wallGrad;
  stageCtx.fillRect(0, 0, STAGE_W, fy);
  stageCtx.fillStyle = 'rgba(0,0,0,0.10)';
  stageCtx.fillRect(0, fy - 12, STAGE_W, 12);

  const wx = STAGE_CX - 54;
  const wy = 40;
  const ww = 108;
  const wh = 80;
  const skyGrad = cachedGradient(`winsky:${phaseId}`, () => {
    const sg = stageCtx.createLinearGradient(0, wy, 0, wy + wh);
    if (phaseId === 'night') {
      sg.addColorStop(0, '#0f172a');
      sg.addColorStop(1, '#312e81');
    } else if (phaseId === 'dusk' || phaseId === 'dawn') {
      sg.addColorStop(0, '#f97316');
      sg.addColorStop(1, '#fde047');
    } else {
      sg.addColorStop(0, '#60a5fa');
      sg.addColorStop(1, '#bae6fd');
    }
    return sg;
  });
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

  const floorGrad = cachedGradient('floor', () => {
    const fg = stageCtx.createLinearGradient(0, fy, 0, STAGE_H);
    fg.addColorStop(0, '#cfa06e');
    fg.addColorStop(1, '#a97d4e');
    return fg;
  });
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

const pooFrames = {};
function pooFrameImg(i) {
  if (pooFrames[i]) return pooFrames[i];
  let img = null;
  try {
    img = new Image();
    img.onerror = () => { img.bad = true; };
    img.src = `../../assets/sprites/waste/poo_${i}.png`;
  } catch (err) { img = null; }
  pooFrames[i] = img;
  return img;
}

function drawWaste(now, list) {
  if (!list || !list.length) return;
  stageCtx.save();
  stageCtx.font = '16px sans-serif';
  stageCtx.textAlign = 'center';
  for (const w of list) {
    const wob = Math.sin(now / 400 + w.x) * 2;
    if (w.kind === 'poop') {
      const f = Math.floor(now / 420 + w.x) % 4;
      const pimg = pooFrameImg(f);
      if (pimg && !pimg.bad && pimg.complete && pimg.naturalWidth > 0) {
        const ih = Math.round(42);
        const iw = Math.round(ih * pimg.naturalWidth / pimg.naturalHeight);
        stageCtx.drawImage(pimg, w.x + wob - iw / 2, w.y - ih + 4, iw, ih);
      } else {
        stageCtx.font = '17px sans-serif';
        stageCtx.fillText('\u{1F4A9}', w.x + wob, w.y);
      }
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

const SCENE_FILES = {
  park: 'sakura_city_park',
  baywalk: 'manila_baywalk',
  market: 'bangkok_floating_market',
  temple: 'kyoto_zen_garden',
  terraces: 'banaue_rice_terraces',
  beach: 'boracay_beach',
};
const stageScenes = {};
function sceneImageFor(mode) {
  if (!SCENE_FILES[mode]) return null;
  if (stageScenes[mode]) return stageScenes[mode];
  let img = null;
  try {
    img = new Image();
    img.onerror = () => { img.bad = true; };
    img.src = `../../assets/scenes/${SCENE_FILES[mode]}.png`;
  } catch (err) { img = null; }
  stageScenes[mode] = img;
  return img;
}

function drawPark(now, phaseId, mode) {
  const scene = sceneImageFor(mode);
  if (scene && !scene.bad && scene.complete && scene.naturalWidth > 0) {
    const sw2 = scene.naturalWidth;
    const sh2 = scene.naturalHeight;
    const scale = Math.max(STAGE_W / sw2, STAGE_H / sh2);
    const dw = sw2 * scale;
    const dh = sh2 * scale;
    stageCtx.drawImage(scene, (STAGE_W - dw) / 2, (STAGE_H - dh) / 2, dw, dh);
    const fade = cachedGradient('photo-fade', () => {
      const fg = stageCtx.createLinearGradient(0, 250, 0, STAGE_H);
      fg.addColorStop(0, 'rgba(10, 12, 20, 0)');
      fg.addColorStop(1, 'rgba(10, 12, 20, 0.30)');
      return fg;
    });
    stageCtx.fillStyle = fade;
    stageCtx.fillRect(0, 250, STAGE_W, STAGE_H - 250);
    return;
  }
  const skies = PARK_SKIES[mode] || PARK_SKIES.park;
  const night = phaseId === 'night';
  const sky = cachedGradient(`psky:${mode}:${night}`, () => {
    const sg = stageCtx.createLinearGradient(0, 0, 0, 284);
    sg.addColorStop(0, night ? '#0f172a' : skies[0]);
    sg.addColorStop(1, night ? '#312e81' : skies[1]);
    return sg;
  });
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
    const grass = cachedGradient(`grass:${mode}:${night}`, () => {
      const gg = stageCtx.createLinearGradient(0, 284, 0, STAGE_H);
      gg.addColorStop(0, night ? '#14532d' : mode === 'temple' ? '#86efac' : '#4ade80');
      gg.addColorStop(1, night ? '#052e16' : '#16a34a');
      return gg;
    });
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

const footFracCache = new Map();
function spriteFootFrac(img) {
  if (!img || !img.naturalWidth || !img.complete) return 1;
  const key = img.src || img;
  if (footFracCache.has(key)) return footFracCache.get(key);
  let frac = 1;
  try {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const c2 = cv.getContext('2d');
    c2.drawImage(img, 0, 0);
    const px = c2.getImageData(0, 0, w, h).data;
    for (let y = h - 1; y >= 0; y -= 1) {
      const row = y * w * 4;
      for (let x = 0; x < w; x += 1) {
        if (px[row + x * 4 + 3] > 12) {
          frac = (y + 1) / h;
          y = -2;
          break;
        }
      }
    }
  } catch (err) {
    frac = 1;
  }
  footFracCache.set(key, frac);
  return frac;
}

const COSMETIC_PNG = new Set([
  'cos_witch_hat', 'cos_salakot', 'cos_sakura_crown', 'cos_gold_crown', 'cos_ushanka', 'cos_shades',
  'cos_red_scarf', 'cos_bell_collar', 'cos_bowtie', 'cos_angel_wings', 'cos_lantern', 'cos_parol_aura',
]);
const GEAR_PNG = {
  wood_sword: 'eq_bamboo_staff', bamboo_katana: 'eq_bamboo_staff', kris: 'eq_kampilan_sword',
  sun_lance: 'eq_kampilan_sword', storm_lance: 'eq_kampilan_sword', phoenix_blade: 'eq_kampilan_sword',
  void_saber: 'eq_kampilan_sword', wind_bow: 'eq_bamboo_staff',
  straw_hat: 'eq_rattan_shield', barong_vest: 'eq_rattan_shield', samurai_plate: 'eq_rattan_shield',
  dragon_mail: 'eq_rattan_shield', cosmic_aegis: 'eq_rattan_shield', sunforged_plate: 'eq_rattan_shield',
  tide_scale: 'eq_rattan_shield', shadow_cloak: 'eq_rattan_shield',
  dream_charm: 'eq_agimat_amulet', moon_ring: 'eq_promise_ring', star_brooch: 'eq_agimat_amulet',
  starfall_charm: 'eq_agimat_amulet',
};

function equippedOverlays(d2) {
  if (!latest || !latest.state) return [];
  const st2 = latest.state;
  if (st2.dead || st2.pet.stage === 'egg') return [];
  const r = latest.derived;
  const rpg = r && r.rpg;
  const shop = rpg && rpg.items ? rpg.items.shop : null;
  const gearList = rpg && rpg.gearShop ? rpg.gearShop : null;
  const poolList = rpg && rpg.gearGacha ? rpg.gearGacha.poolPreview || [] : [];
  const iconOf = (id) => {
    if (!id) return null;
    const it = shop ? shop.find((x) => x.id === id) : null;
    return it ? it.icon : null;
  };
  const gearIconOf = (id) => {
    if (!id) return null;
    const gd = gearList ? gearList.find((x) => x.id === id) : null;
    const pd = !gd ? poolList.find((x) => x.id === id) : null;
    return gd ? gd.icon : (pd ? pd.icon : null);
  };
  const eq = (st2.items && st2.items.equipped) || {};
  const ge = (r && r.gear && r.gear.equipped) || {};
  const out = [];
  const listOf = (iconFn, id, slot) => {
    if (!id || !iconFn(id)) return;
    let pngId = null;
    if (COSMETIC_PNG.has(id)) pngId = id;
    else if (GEAR_PNG[id]) pngId = GEAR_PNG[id];
    out.push({ slot, emo: iconFn(id), pngId });
  };
  listOf(iconOf, eq.Head, 'Head');
  listOf(iconOf, eq.Neck, 'Neck');
  listOf(iconOf, eq.Back, 'Back');
  listOf(iconOf, eq.Armor, 'Armor');
  listOf(iconOf, eq.Relic, 'Relic');
  listOf(iconOf, eq.Weapon, 'Weapon');
  listOf(gearIconOf, ge.weapon, 'Weapon');
  listOf(gearIconOf, ge.armor, 'Armor');
  listOf(gearIconOf, ge.charm, 'Relic');
  return out.filter((o) => o.pngId || o.emo);
}

function drawEquippedOnPet(now) {
  const overlays = equippedOverlays();
  if (!overlays.length) return;
  const dir = petWalk.dir || 1;
  const cx = petWalk.x;
  const gy = petWalk.y;
  const sz = petDraw && petDraw.size ? petDraw.size : 64;
  const bob = Math.round(Math.sin(now / 260) * 4) / 2;
  const anchors = {
    Head: { fx: 0, fy: 1.04, w: 0.5 },
    Neck: { fx: 0.14, fy: 0.72, w: 0.4 },
    Back: { fx: -0.58, fy: 0.6, w: 0.56 },
    Weapon: { fx: 0.52, fy: 0.54, w: 0.5 },
    Armor: { fx: -0.34, fy: 0.44, w: 0.5 },
    Relic: { fx: -0.5, fy: 0.8, w: 0.4 },
  };
  stageCtx.save();
  for (const o of overlays) {
    const a = anchors[o.slot] || anchors.Relic;
    const iw = Math.max(14, Math.round(sz * a.w));
    const x = cx + dir * sz * a.fx;
    const y = gy - sz * a.fy + bob;
    if (o.pngId) {
      const img = overlayImg(`../../assets/sprites/items/${o.pngId.startsWith('cos_') ? 'cosmetics' : 'equipment'}/${o.pngId}.png`);
      if (img) {
        stageCtx.imageSmoothingEnabled = false;
        stageCtx.drawImage(img, x - iw / 2, y - iw / 2, iw, iw);
        continue;
      }
    }
    stageCtx.font = '17px sans-serif';
    stageCtx.textAlign = 'center';
    stageCtx.fillText(o.emo, x, y);
  }
  stageCtx.restore();
}

const overlayImgCache = {};
function overlayImg(path) {
  if (!(path in overlayImgCache)) {
    const img = new Image();
    img.onerror = () => { img.bad = true; };
    img.src = path;
    overlayImgCache[path] = img;
  }
  const im = overlayImgCache[path];
  return im && !im.bad && im.complete && im.naturalWidth > 0 ? im : null;
}

let battleFx = null;
function restoreHomeTitle() {
  const bf = battleFx;
  if (!bf) return;
  const homeTitle = el('home-title');
  if (homeTitle && bf.prevTitle) homeTitle.textContent = bf.prevTitle;
  const badge = el('play-state');
  if (badge && badge.textContent === 'BATTLE') badge.textContent = 'IDLE';
}
function startBattleFx(mon, win) {
  const homeTitle = el('home-title');
  const badge = el('play-state');
  const prevTitle = homeTitle ? homeTitle.textContent : '';
  const monArenas = { guard_slime: 'Meadow Arena', cave_bat: 'Cavern Night', wild_boar: 'Meadow Arena', ridge_wolf: 'Meadow Arena', kumiho: 'Mystic Boss Lair', oni_brute: 'Cavern Night', ember_wyvern: 'Mystic Boss Lair', void_titan: 'Mystic Boss Lair' };
  battleFx = { icon: mon.icon, name: mon.name, win: !!win, t0: performance.now(), dur: 3800, monId: mon.id, prevTitle, dmgShown: false, dmgVal: 40 + Math.floor(Math.random() * 110) };
  if (homeTitle) homeTitle.textContent = `\u2694\uFE0F ${(monArenas[mon.id] || 'Battle Arena')} \u2014 vs ${mon.name}`;
  if (badge) badge.textContent = 'BATTLE';
}

const MONSTER_ARENAS = {
  guard_slime: 'arena_meadow_day',
  cave_bat: 'arena_cavern_night',
  wild_boar: 'arena_meadow_day',
  ridge_wolf: 'arena_meadow_day',
  kumiho: 'arena_mystic_boss',
  oni_brute: 'arena_cavern_night',
  ember_wyvern: 'arena_mystic_boss',
  void_titan: 'arena_mystic_boss',
};
const monsterAnimCache = {};
const MONSTER_4X = { idle: 'idle', attack: 'attack', hurt: 'hurt' };
const MONSTER_4X_COUNT = { idle: 8, attack: 6, hurt: 4 };
function monsterFrames4x(monId, kind) {
  const key = `${monId}:${kind}:4x`;
  if (!(key in monsterAnimCache)) {
    const imgs = [];
    for (let f = 1; f <= (MONSTER_4X_COUNT[kind] || 8); f += 1) {
      const img = new Image();
      img.onerror = () => { img.bad = true; };
      img.src = `../../assets/sprites/battle/monsters/${monId}/frames_4x/${MONSTER_4X[kind]}/${monId}_${MONSTER_4X[kind]}_${String(f).padStart(2, '0')}.png`;
      imgs.push(img);
    }
    monsterAnimCache[key] = imgs;
  }
  return monsterAnimCache[key].filter((i) => !i.bad && i.complete && i.naturalWidth > 0);
}
function monsterFrames(monId, kind) {
  const hi = monsterFrames4x(monId, kind);
  if (hi.length) return hi;
  const key = `${monId}:${kind}`;
  if (!(key in monsterAnimCache)) {
    const spec = { idle: ['', '', 8], attack: ['attack/frames/', 'attack_', 6], hurt: ['hurt_defeated/frames/', 'hurt_defeated_', 4] }[kind] || ['', '', 8];
    const imgs = [];
    for (let f = 1; f <= spec[2]; f += 1) {
      const img = new Image();
      img.onerror = () => { img.bad = true; };
      img.src = `../../assets/sprites/battle/monsters/${monId}/${spec[0]}${monId}_${spec[1]}frame_${String(f).padStart(2, '0')}.png`;
      imgs.push(img);
    }
    monsterAnimCache[key] = imgs;
  }
  return monsterAnimCache[key].filter((i) => !i.bad && i.complete && i.naturalWidth > 0);
}
const arenaCache = {};
function arenaImg(name) {
  if (!(name in arenaCache)) {
    const img = new Image();
    img.onerror = () => { img.bad = true; };
    img.src = `../../assets/sprites/battle/arena_backgrounds/${name}.png`;
    arenaCache[name] = img;
  }
  const img = arenaCache[name];
  return img && !img.bad && img.complete && img.naturalWidth > 0 ? img : null;
}
function drawBattleFx(now) {
  if (!battleFx) return;
  const t = (now - battleFx.t0) / battleFx.dur;
  if (t < 0 || t >= 1) { restoreHomeTitle(); battleFx = null; return; }
  const enter = Math.min(1, t / 0.12);
  const exit = t > 0.8 ? (t - 0.8) / 0.2 : 0;
  const mx = Math.round(STAGE_CX + 118 * enter);
  const my = 284;
  const attackFrame = t >= 0.14 && t < 0.78;
  const fallen = battleFx.win && t >= 0.78;
  const frames = fallen ? monsterFrames(battleFx.monId, 'hurt')
    : attackFrame ? monsterFrames(battleFx.monId, 'attack')
      : monsterFrames(battleFx.monId, 'idle');
  let monImg = null;
  if (frames.length) {
    const speed = attackFrame ? 55 : fallen ? 300 : 140;
    monImg = frames[Math.floor((now - battleFx.t0) / speed) % frames.length];
  }
  const bob = Math.sin(now / 150) * 4;
  const hitPhase = t > 0.14 && t < 0.78;
  const lunge = hitPhase ? Math.sin(Math.min(1, (t - 0.14) / 0.3) * Math.PI) : 0;
  const recoil = hitPhase ? Math.round(lunge * 16) : 0;
  stageCtx.save();
  stageCtx.globalAlpha = Math.max(0, 1 - exit);

  if (hitPhase && lunge > 0.35) {
    const px = STAGE_CX - 74;
    const py = my - 18;
    stageCtx.save();
    stageCtx.strokeStyle = `rgba(255, 244, 214, ${0.85 * lunge})`;
    stageCtx.lineWidth = 4;
    stageCtx.lineCap = 'round';
    stageCtx.beginPath();
    stageCtx.moveTo(px - 6, py - 26 + 22 * lunge);
    stageCtx.quadraticCurveTo(px + 52, py - 34, mx - 34 - recoil, py - 6);
    stageCtx.stroke();
    stageCtx.lineWidth = 2;
    stageCtx.beginPath();
    stageCtx.moveTo(px - 2, py - 12 + 16 * lunge);
    stageCtx.quadraticCurveTo(px + 44, py - 20, mx - 36 - recoil, py + 2);
    stageCtx.stroke();
    stageCtx.restore();
  }

  stageCtx.fillStyle = 'rgba(0,0,0,0.22)';
  stageCtx.beginPath();
  stageCtx.ellipse(mx + recoil, my + 4, 26, 7, 0, 0, Math.PI * 2);
  stageCtx.fill();
  const mxr = mx + recoil;
  if (monImg) {
    const msize = Math.round(84 + bob);
    stageCtx.save();
    stageCtx.imageSmoothingEnabled = false;
    stageCtx.drawImage(monImg, mxr - msize / 2, my - msize + 4, msize, msize);
    if (hitPhase && lunge > 0.55) {
      stageCtx.globalCompositeOperation = 'lighter';
      stageCtx.fillStyle = `rgba(255, 130, 90, ${(lunge - 0.55) * 1.2})`;
      stageCtx.fillRect(mxr - msize / 2, my - msize + 4, msize, msize);
      stageCtx.globalCompositeOperation = 'source-over';
    }
    stageCtx.restore();
  } else {
    stageCtx.font = '46px sans-serif';
    stageCtx.textAlign = 'center';
    stageCtx.fillText(battleFx.icon, mxr, my - 20 + bob);
  }
  stageCtx.fillStyle = '#2a2018';
  stageCtx.fillRect(mxr - 28, my - 84, 56, 7);
  const hpFrac = battleFx.win ? Math.max(0.05, 1 - (t / 0.78) * 0.95) : Math.max(0.3, 1 - t * 0.5);
  stageCtx.fillStyle = battleFx.win ? '#f87171' : '#fbbf24';
  stageCtx.fillRect(mxr - 27, my - 83, 54 * hpFrac, 5);
  stageCtx.font = '10px sans-serif';
  stageCtx.fillStyle = 'rgba(255,255,255,0.85)';
  stageCtx.fillText(battleFx.name, mxr, my - 90);

  if (hitPhase && lunge > 0.45) {
    stageCtx.fillStyle = 'rgba(255, 170, 90, 0.10)';
    stageCtx.fillRect(0, 0, petStageCanvas.width, petStageCanvas.height);
  }
  if (hitPhase && !battleFx.dmgShown && lunge > 0.9) {
    battleFx.dmgShown = true;
  }
  if (battleFx.dmgShown && t < 0.8) {
    const dy = my - 96 - (t - 0.5) * 130;
    const da = Math.max(0, Math.min(1, (t - 0.78) * 8));
    stageCtx.font = 'bold 15px sans-serif';
    stageCtx.textAlign = 'center';
    stageCtx.strokeStyle = 'rgba(30, 20, 10, 0.75)';
    stageCtx.lineWidth = 3;
    stageCtx.strokeText(`-${battleFx.dmgVal}`, mxr, dy);
    stageCtx.fillStyle = battleFx.win ? '#ffe08a' : '#ff9d8a';
    stageCtx.fillText(`-${battleFx.dmgVal}`, mxr, dy);
  }
  if (hitPhase) {
    if (Math.random() < 0.16) spawnFx('spark', mx + Math.random() * 44 - 22, my - 40 + Math.random() * 20, { vy: -0.3, size: 14 });
    if (Math.random() < 0.05) {
      stageCtx.fillStyle = 'rgba(255, 80, 60, 0.12)';
      stageCtx.fillRect(0, 0, petStageCanvas.width, petStageCanvas.height);
    }
  }
  if (t >= 0.78 && t < 0.85 && battleFx.win) {
    for (let i = 0; i < 3; i += 1) spawnFx('coin', mx + Math.random() * 40 - 20, my - 60, { vy: -0.5, size: 16 });
  }
  if (t >= 0.82) {
    stageCtx.font = 'bold 20px sans-serif';
    stageCtx.fillStyle = battleFx.win ? '#ffd54a' : '#f87171';
    stageCtx.strokeStyle = 'rgba(30, 20, 10, 0.7)';
    stageCtx.lineWidth = 3;
    const by = 120 + (t - 0.82) * 40;
    const label = battleFx.win ? 'VICTORY!' : 'DEFEATED...';
    stageCtx.strokeText(label, STAGE_CX, by);
    stageCtx.fillText(label, STAGE_CX, by);
  }
  stageCtx.restore();
}

function drawStagePet(now) {
  const groundY = STAGE_GROUND;
  stageCtx.clearRect(0, 0, petStageCanvas.width, petStageCanvas.height);
  const splashEl = document.getElementById('splash');
  if (splashEl && !splashEl.classList.contains('hidden')) return;

  const bf = battleFx;
  if (bf) {
    const bt = (now - bf.t0) / bf.dur;
    if (bt >= 0 && bt < 0.85) {
      const arena = arenaImg(MONSTER_ARENAS[bf.monId] || 'arena_meadow_day');
      if (arena) {
        const alpha = Math.min(1, bt / 0.08) * (bt > 0.78 ? 1 - (bt - 0.78) / 0.07 : 1);
        if (alpha > 0) {
          stageCtx.save();
          stageCtx.globalAlpha = 0.97 * alpha;
          stageCtx.imageSmoothingEnabled = false;
          stageCtx.drawImage(arena, 0, 0, petStageCanvas.width, petStageCanvas.height);
          stageCtx.restore();
        }
      }
    }
  }
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
      const speciesId = s.pet.species || 'kala';
      const evoSingle = s.pet.evolved ? evoSingleFor(speciesId, st) : null;
      const evoFrame = s.pet.evolved && !evoSingle ? evoSheetFrameFor(speciesId, st) : null;
      let img = null;
      let sub = null;
      if (evoSingle) {
        img = evoSingle;
      } else if (evoFrame) {
        img = evoFrame.img;
        sub = { sx: evoFrame.idx * evoFrame.frameW, sy: 0, sw: evoFrame.frameW, sh: evoFrame.frameH };
      } else {
        const pngs = stageFramesFor(speciesId, st);
        const single = stageSingleFor(speciesId, st);
        if (pngs.length > 0) {
          img = pngs[Math.floor(now / 170) % pngs.length];
        } else if (single) {
          img = single;
        } else {
          let bank = null;
          try {
            bank = sprites.ensurePetSprites(s.pet.species || 'kala');
          } catch (err) {
            bank = null;
          }
          if (bank && bank[st]) img = bank[st][Math.floor(now / 170) % bank[st].length];
        }
      }
      if (img) {
        const by = petWalk.y - Math.round(boxSize * spriteFootFrac(img)) + yOff;
        if (sub) g.drawImage(img, sub.sx, sub.sy, sub.sw, sub.sh, bx, by, boxSize, boxSize);
        else g.drawImage(img, bx, by, boxSize, boxSize);
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

  drawEquippedOnPet(now);
  drawBattleFx(now);

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
    const glyph = p2.kind === 'heart' ? '\u2764' : p2.kind === 'coin' ? '\u{1F4B0}' : p2.kind === 'crumb' ? '\u00b7' : p2.kind === 'z' ? 'z' : '\u2726';
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
      if (cuteSfx) cuteSfx.play('sparkle');
      if (window.JuanBuddyEco && window.JuanBuddyEco.burst) window.JuanBuddyEco.burst(e.clientX, e.clientY, 'compost');
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
    if (cuteSfx) cuteSfx.play('chirp');
    try {
      const sid2 = latest && latest.state && latest.state.pet ? latest.state.pet.species : null;
      if (sfx && sfx.petVoice) sfx.petVoice(sid2 || 'kala');
    } catch (err) { /* voice unavailable */ }
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
  if (cuteSfx) cuteSfx.play('plop');
});

function activateTab(name) {
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.add('hidden'));
  const panel = document.querySelector(`.panel-${name}`);
  if (panel && panel.classList) {
    panel.classList.remove('panel-anim');
    void panel.offsetWidth;
    panel.classList.add('panel-anim');
    panel.classList.remove('hidden');
  }
  if (cuteSfx) cuteSfx.play('rustle');
  document.querySelectorAll('#stage-menu .stage-menu-item').forEach((b) => {
    b.classList.toggle('on', b.dataset && b.dataset.menuTab === name);
  });
}

const stageMenuBtn = el('stage-menu-btn');
const stageMenu = el('stage-menu');
if (stageMenuBtn && stageMenu) {
  stageMenuBtn.addEventListener('click', () => {
    stageMenu.classList.toggle('hidden');
    if (sfx) sfx.play('click');
  });
  stageMenu.querySelectorAll('.stage-menu-item').forEach((b) => {
    b.addEventListener('click', () => {
      if (b.dataset && b.dataset.menuTab) activateTab(b.dataset.menuTab);
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

let lastStepAt = 0;
(function stageLoop() {
  const stageNow = performance.now();
  drawStagePet(stageNow);
  if (petWalk.moving && (!latest || !latest.state || !latest.state.dead) && stageNow - lastStepAt > 240) {
    lastStepAt = stageNow;
    if (cuteSfx) cuteSfx.play('step');
    if (Math.random() < 0.45) spawnFx('crumb', petWalk.x - 14 * petWalk.dir, petWalk.y + 2, { vy: -0.12, size: 8 });
  }
  requestAnimationFrame(stageLoop);
})();

(function fitStageDpr() {
  const apply = () => {
    const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    const w = Math.round(STAGE_W * dpr);
    const h = Math.round(STAGE_H * dpr);
    if (petStageCanvas.width !== w) {
      petStageCanvas.width = w;
      petStageCanvas.height = h;
      stageCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stageCtx.imageSmoothingEnabled = !smoothGraphics;
    }
  };
  apply();
  window.addEventListener('resize', apply);
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
  const fmEl = el('free-food-note');
  if (fmEl) fmEl.textContent = d.rewards && d.rewards.freeFoodAvailable ? '1 free random meal — resets at midnight' : 'Claimed — come back tomorrow';
  const ffb = el('btn-free-food');
  if (ffb) { const on = d.rewards && d.rewards.freeFoodAvailable; ffb.disabled = !on; ffb.textContent = on ? '🎁 Free Daily Meal!' : '✅ Claimed today'; }
  const chipC = el('btn-gacha-free');
  if (chipC) { const on = d.rewards && d.rewards.freePullAvailable; chipC.disabled = !on; chipC.textContent = on ? '🎁 Free Daily Pull!' : 'Free pull used — resets at midnight'; }
  const chipG = el('btn-gear-gacha-free');
  if (chipG) { const on = d.rewards && d.rewards.freePullAvailable; chipG.disabled = !on; chipG.textContent = on ? '🎁 Free Daily Wish!' : 'Free wish used — resets at midnight'; }

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
    btn.textContent = sk.equipped ? '✓ Equipped' : sk.owned ? 'Equip' : sk.gachaOnly ? '🎰 Gacha only' : `💰 ${sk.cost}`;
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

on('btn-daily','click', () => act('claimDaily'));
on('btn-free-food','click', async () => { await act('claimFreeFood'); });

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

function wishRarityCls(rarity) {
  return ['common', 'rare', 'epic', 'legendary', 'mythic'].includes(rarity) ? `r-${rarity}` : 'r-common';
}

function wishCardNode(r) {
  const card = document.createElement('div');
  card.className = `wish-card ${wishRarityCls(r.rarity)}`;
  const unlocked = r.itemUnlocked || r.gearUnlocked || (r.skinUnlocked ? `${r.skinUnlocked} skin` : null);
  const ico = r.icon || '\ud83c\udfb0';
  const stars = '\u2b50'.repeat(Math.max(1, r.stars || 1));
  const name = unlocked || r.name || '';
  card.innerHTML = `<div class="wc-ico">${ico}</div><div class="wc-stars">${stars}</div><div class="wc-name"></div>`;
  card.querySelector('.wc-name').textContent = name;
  return card;
}

function runWishReveal(res, times) {
  return new Promise((resolve) => {
    const overlay = el('wish-overlay');
    const aura = el('wish-aura');
    const petals = el('wish-petals');
    const cardsWrap = el('wish-cards');
    const skip = el('wish-skip');
    if (!overlay || !aura || !petals || !cardsWrap || !skip) { resolve(); return; }
    const best = res.best || { rarity: 'common', stars: 1 };
    const results = (res.results && res.results.length) ? res.results : [best];
    const timers = [];
    let resolved = false;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      timers.forEach(clearTimeout);
      document.body.classList.remove('wish-shake', 'wish-shake-big');
      overlay.className = 'wish-overlay hidden';
      cardsWrap.innerHTML = '';
      petals.innerHTML = '';
      skip.onclick = null;
      resolve();
    };
    skip.onclick = skipReveal;

    function revealCards(fast) {
      cardsWrap.innerHTML = '';
      results.forEach((r, i) => {
        const c = wishCardNode(r);
        c.style.animationDelay = fast ? '0s' : `${i * 0.08}s`;
        if (fast) c.style.animationDuration = '0.18s';
        cardsWrap.appendChild(c);
      });
      if (cuteSfx) cuteSfx.play('sparkle');
      timers.push(setTimeout(finish, fast ? 420 : 950 + results.length * 80));
    }

    function skipReveal() { revealCards(true); }

    overlay.className = 'wish-overlay st1';
    if (cuteSfx) cuteSfx.play('chime');
    const shakeMs = times >= 10 ? 1600 : 1150;
    timers.push(setTimeout(() => overlay.classList.add('st1-fast'), shakeMs * 0.55));
    timers.push(setTimeout(() => {
      overlay.classList.remove('st1', 'st1-fast');
      overlay.classList.add('tele', wishRarityCls(best.rarity));
      petals.innerHTML = '';
      const petalCols = ['#4ade80', '#fbbf24', '#fb7185', '#a78bfa', '#38bdf8'];
      for (let i = 0; i < 14; i += 1) {
        const petal = document.createElement('i');
        petal.className = 'wish-petal';
        petal.style.setProperty('--px', `${Math.random() * 280 - 140}px`);
        petal.style.setProperty('--py', `${-40 - Math.random() * 150}px`);
        petal.style.setProperty('--pr', `${Math.random() * 360}deg`);
        petal.style.animationDelay = `${Math.random() * 0.25}s`;
        petal.style.background = petalCols[i % petalCols.length];
        petals.appendChild(petal);
      }
      document.body.classList.add(best.stars >= 4 ? 'wish-shake-big' : 'wish-shake');
      if (sfx) sfx.playGacha(best.rarity);
      if (best.stars >= 4 && cuteSfx) cuteSfx.play('fanfare');
      timers.push(setTimeout(() => document.body.classList.remove('wish-shake', 'wish-shake-big'), 1000));
      timers.push(setTimeout(revealCards, best.rarity === 'mythic' ? 1500 : 850));
    }, shakeMs));
  });
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
  if (cuteSfx) cuteSfx.play('chime');
  await runWishReveal(res, times);
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
  const iconLine = document.createElement('div');
  iconLine.className = 'gacha-icon';
  iconLine.textContent = best.icon || '🎰';
  resultEl.appendChild(iconLine);
  resultEl.appendChild(starsLine);
  if (best.itemUnlocked) {
    const itemLine = document.createElement('div');
    itemLine.className = 'gacha-skin';
    itemLine.textContent = `\ud83c\udf81 NEW ITEM: ${best.itemIcon || '\ud83c\udfb0'} ${best.itemUnlocked} \u2014 check your Bag!`;
    resultEl.appendChild(itemLine);
  }
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

on('btn-gacha-free','click', () => pullGacha(1));
on('btn-gacha-1','click', () => pullGacha(1));
on('btn-gacha-10','click', () => pullGacha(10));

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
  const submitName = async () => {
    const name = (nameInput.value || '').trim().slice(0, 16);
    if (!name) { showToast('Nickname is too short! 🥺'); return; }
    const res = await api.action('rename', { name });
    closeNameModal();
    if (sfx) sfx.play('happy');
    showToast((res && res.message) || '. ..');
  };
  on('btn-name-save','click', submitName);
  nameInput.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') submitName();
  });
  nameInput.addEventListener('keyup', (e) => e.stopPropagation());
  nameInput.addEventListener('keypress', (e) => e.stopPropagation());
  on('btn-name-skip','click', () => {
    closeNameModal();
    showToast('Your buddy keeps the name Buddy — rename it later by clicking its name! 💛');
  });
}

// ==== Perk choice modal (every level-up) ====
const perkModal = el('perk-modal');
const perkChoices = el('perk-choices');
if (perkModal && perkChoices) {
  perkChoices.addEventListener('click', async (e) => {
    const btn = e.target.closest ? e.target.closest('button[data-perk-idx]') : null;
    if (!btn) return;
    const idx = Number(btn.dataset.perkIdx);
    const res = await api.action('choosePerk', { index: idx });
    if (res && res.ok) {
      perkModal.classList.add('hidden');
      perkKeyShown = null;
      const epic = res.perk && res.perk.rarity === 'epic';
      sfxOnce(epic ? 'evolve' : 'levelup');
      if (epic && typeof spawnConfetti === 'function') spawnConfetti(perkModal, 5);
      showToast((res && res.message) || '. ..', 3200);
    } else {
      if (res) showToast(res.message || '. ..');
    }
  });
}

// ==== Settings panel wiring ====
const bgmToggle = el('btn-bgm-toggle');
const bgmRange = el('set-bgm');
const sfxRange = el('set-sfx');
const gfxSelect = el('set-gfx');
const themeSwatches = el('theme-swatches');
if (bgmToggle && bgm && bgmRange) {
  bgmToggle.addEventListener('click', async () => {
    const on = !bgm.getEnabled();
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
if (gfxSelect) {
  gfxSelect.addEventListener('change', async () => {
    const pixel = gfxSelect.value !== 'smooth';
    applyGraphics(!pixel);
    await api.action('setSettings', { pixelGraphics: pixel });
    if (sfx) sfx.play('click');
  });
}
if (themeSwatches) {
  themeSwatches.addEventListener('click', async (e) => {
    const sw = e.target && e.target.closest ? e.target.closest('button[data-theme]') : null;
    if (!sw) return;
    const theme = sw.dataset.theme;
    applyTheme(theme);
    await api.action('setSettings', { theme });
    if (sfx) sfx.play('coin');
  });
}
const wallpawPicks = el('wallpaw-picks');
if (wallpawPicks) {
  wallpawPicks.addEventListener('click', async (e) => {
    const wp = e.target && e.target.closest ? e.target.closest('button[data-wallpaw]') : null;
    if (!wp) return;
    const pick = wp.dataset.wallpaw;
    applyWallPaw(pick);
    await api.action('setSettings', { wallPaw: pick });
    if (sfx) sfx.play('coin');
  });
}
const ecoThemePicks = el('eco-theme-picks');
if (ecoThemePicks) {
  const syncEcoPicks = () => {
    const cur = window.JuanBuddyEco && window.JuanBuddyEco.getTheme ? window.JuanBuddyEco.getTheme() : 'bamboo-grove';
    ecoThemePicks.querySelectorAll('button[data-eco]').forEach((b) => {
      b.classList.toggle('on', b.dataset.eco === cur);
    });
  };
  syncEcoPicks();
  ecoThemePicks.addEventListener('click', (e) => {
    const b = e.target && e.target.closest ? e.target.closest('button[data-eco]') : null;
    if (!b) return;
    if (window.JuanBuddyEco) window.JuanBuddyEco.setTheme(b.dataset.eco);
    syncEcoPicks();
    if (sfx) sfx.play('coin');
  });
}

document.addEventListener('pointerdown', startBgmOnGesture);
document.addEventListener('keydown', startBgmOnGesture);

on('btn-credits-close','click', () => {
  const modal = el('credits-modal');
  if (modal) modal.classList.add('hidden');
  if (sfx) sfx.play('click');
});

on('btn-export','click', async () => {
  const res = await api.action('exportSave');
  if (!res || !res.ok) return;
  try {
    await navigator.clipboard.writeText(res.code);
    showToast('Save code copied to clipboard! Keep it safe 🔐', 3200);
  } catch (err) {
    window.prompt('Copy your save code:', res.code);
  }
});

on('btn-import','click', async () => {
  const code = window.prompt('Paste your Juan Buddy save code (starts with JB2.):');
  if (!code) return;
  const res = await api.action('importSave', { code: code.trim() });
  showToast(res && res.message, 3200);
});

on('btn-new-game','click', async () => {
  if (!window.confirm('Start over with a new egg? Your buddy will be gone forever, but your achievements stay.')) return;
  const res = await api.action('newGame');
  if (res && res.ok) clearNamedFlag();
  showToast(res && res.message, 4000);
});

const brandLogoEl = el('brand-logo');
if (brandLogoEl) {
  brandLogoEl.style.cursor = 'pointer';
  brandLogoEl.addEventListener('click', () => {
    const url = 'https://www.instagram.com/juanbungo/';
    if (api && api.action) api.action('openUrl', { url });
    else if (typeof window.open === 'function') window.open(url, '_blank');
    if (sfx) sfx.play('click');
  });
}

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
      const icoEl = card.querySelector('.mo-ico');
      const spriteSrc = `../../assets/sprites/battle/monsters/${mo.id}/${mo.id}_static.png`;
      if (icoEl.dataset.imgSrc !== spriteSrc) {
        icoEl.dataset.imgSrc = spriteSrc;
        icoEl.innerHTML = '';
        const img = document.createElement('img');
        img.className = 'pixelated mo-sprite';
        img.alt = mo.name;
        img.draggable = false;
        img.addEventListener('error', () => { icoEl.textContent = mo.icon; });
        img.src = spriteSrc;
        icoEl.appendChild(img);
      }
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
      const def = equippedId ? rpg.gearShop.find((g) => g.id === equippedId) || (rpg.gearGacha && rpg.gearGacha.poolPreview || []).find((g) => g.id === equippedId) || null : null;
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
        ? '\ud83d\udcbc Work Master chosen \u2014 +50% coin rate for life. The idle tycoon!'
        : '\u2694\ufe0f Battle Master chosen \u2014 +15% battle ATK/DEF for life. The arena legend!';
      cardsEl.innerHTML = '';
    } else {
      chosen.classList.add('hidden');
      if (cardsEl.childElementCount === 0) {
        cardsEl.innerHTML = `
          <button class="path-card work" data-choosepath="work">
            <div class="pc-ico">\ud83d\udcbc</div>
            <div class="pc-name">Work Master</div>
            <div class="pc-desc muted small">+50% coin rate for life. Dominate the idle grind, buy everything, max the gacha.</div>
            <div class="pc-hint muted small">Tap once, then confirm below</div>
          </button>
          <button class="path-card fight" data-choosepath="battle">
            <div class="pc-ico">\u2694\ufe0f</div>
            <div class="pc-name">Battle Master</div>
            <div class="pc-desc muted small">+15% ATK &amp; DEF for life. Hunt monsters, hit hard, tank anything.</div>
            <div class="pc-hint muted small">Tap once, then confirm below</div>
          </button>`;
      }
      if (pathPending === 'work' || pathPending === 'battle') {
        const pendingCard = cardsEl.querySelector(`[data-choosepath="${pathPending}"]`);
        if (pendingCard && !pendingCard.classList.contains('confirming')) {
          cardsEl.querySelectorAll('.path-card.confirming').forEach((c) => {
            c.classList.remove('confirming');
            const h = c.querySelector('.pc-hint');
            if (h) h.textContent = 'Tap once, then confirm';
          });
          pendingCard.classList.add('confirming');
          const hint = pendingCard.querySelector('.pc-hint');
          if (hint) hint.textContent = '\u2728 Tap again to lock in \u2014 permanent!';
        }
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

on('battle-points-row','click', async (e) => {
  const btn = e.target.closest('button[data-stat]');
  if (!btn || btn.disabled) return;
  const res = await api.action('allocateStat', { statId: btn.dataset.stat });
  showToast((res && res.message) || '. ..', 1800);
});

on('monster-grid','click', async (e) => {
  const btn = e.target.closest('button[data-monster]');
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  const res = await api.action('battleMonster', { monsterId: btn.dataset.monster });
  if (res && res.ok) {
    setBgmOverride('battle', 40000);
    const mon = latest && latest.derived && latest.derived.rpg && latest.derived.rpg.monsters
      ? latest.derived.rpg.monsters.find((m) => m.id === btn.dataset.monster) : null;
    if (mon) startBattleFx(mon, res.win);
  }
  if (res && res.ok && res.win) {
    for (let i = 0; i < 8; i += 1) spawnFx('coin', STAGE_CX + (Math.random() * 140 - 70), 110 + Math.random() * 40, { vy: -0.5, size: 18 });
  } else if (res && res.ok) {
    spawnFx('z', STAGE_CX, 160, { vy: -0.3, size: 16 });
  }
  showToast((res && res.message) || '. ..', 2800);
});

on('gear-shop','click', async (e) => {
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

on('gear-slots','click', async (e) => {
  const sdiv = e.target.closest('.gear-slot');
  if (!sdiv) return;
  const idx = Array.from(sdiv.parentElement.children).indexOf(sdiv);
  const rpg = latest && latest.derived && latest.derived.rpg;
  if (!rpg) return;
  const slotId = ['weapon', 'armor', 'charm'][idx];
  const equipped = rpg.gear.equipped[slotId];
  if (!equipped) {
    showToast('\ud83d\uddee Empty slot! Buy or win gear in the list below, then tap Equip.', 2400);
    return;
  }
  const res = await api.action('equipGear', { gearId: equipped });
  showToast((res && res.message) || '. ..', 2000);
});

let pathPending = null;
on('path-cards','click', async (e) => {
  const card = e.target.closest('button[data-choosepath]');
  if (!card || card.disabled) return;
  if (pathPending !== card.dataset.choosepath) {
    pathPending = card.dataset.choosepath;
    if (cuteSfx) cuteSfx.play('pop');
    renderRpg(latest);
    showToast('\u2728 Tap the card again to lock in this Destiny \u2014 it is permanent!', 2600);
    return;
  }
  pathPending = null;
  const res = await api.action('choosePath', { pathId: card.dataset.choosepath });
  showToast((res && res.message) || '. ..', 3600);
});

on('explore-grid','click', async (e) => {
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
  if (!res || !res.ok) {
    sfxOnce('error');
    showToast((res && res.message) || '. ..', 2200);
    gearGachaBusy = false;
    return;
  }
  if (cuteSfx) cuteSfx.play('chime');
  await runWishReveal(res, times);
  gearGachaBusy = false;
  const best = res.best || {};
  sfxOnce(best.rarity === 'mythic' ? 'levelup' : 'coin');
  if (best.stars >= 4) spawnConfetti(frame, best.stars);
  resultEl.className = `gacha-result r-${best.rarity}`;
  resultEl.innerHTML = `<div class="gacha-icon">${best.gearIcon || best.icon || '🎰'}</div><div class="gacha-stars">${'\u2b50'.repeat(best.stars)}</div><div class="gacha-rarity">${best.rarity.toUpperCase()}</div><div class="gacha-reward">${best.gearUnlocked ? `\ud83d\udee1\ufe0f NEW GEAR: ${best.gearUnlocked}<br>` : ''}+\ud83e\ude99${best.coins}</div>`;
  resultEl.classList.remove('hidden');
  setTimeout(() => resultEl.classList.add('hidden'), 3400);
}

on('btn-gear-gacha-free','click', () => pullGearWish(1));
on('btn-gear-gacha-1','click', () => pullGearWish(1));
on('btn-gear-gacha-10','click', () => pullGearWish(10));

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
  return parts.length ? parts.join(' ') : (it.id === 'eq_evo_stone' ? 'Unlocks Stage 2 Evolution' : 'Keepsake');
}

const petShopTiles = {};
function renderPetShop(d) {
  const wrap = el('pet-shop');
  if (!wrap || !d.petShop) return;
  for (const pt of d.petShop) {
    let card = petShopTiles[pt.id] || document.createElement('div');
    if (!petShopTiles[pt.id]) {
      card.className = 'pet-shop-card';
      card.dataset.shoppet = pt.id;
      const img = document.createElement('img');
      const anim = STAGE_PNG_ANIMS[pt.id];
      img.className = 'pixelated petshop-ico';
      img.src = anim ? `../../assets/sprites/${anim.dir}/frames/${anim.name}_frame_01.png` : '';
      const body = document.createElement('div');
      body.innerHTML = '<div class="b-name"></div><div class="b-bonus small muted"></div>';
      const btn = document.createElement('button');
      btn.className = 'btn btn-violet b-btn';
      card.appendChild(img);
      card.appendChild(body);
      card.appendChild(btn);
      card._els = { name: body.querySelector('.b-name'), desc: body.querySelector('.b-bonus'), btn };
      wrap.appendChild(card);
      petShopTiles[pt.id] = card;
    }
    card._els.name.textContent = `${pt.icon} ${pt.name}`;
    card._els.desc.textContent = pt.desc;
    const btn = card._els.btn;
    if (pt.owned) { btn.textContent = '\u2713 Adopted!'; btn.disabled = true; }
    else {
      btn.textContent = `\ud83e\ude99${pt.cost.toLocaleString('en-US')}`;
      btn.disabled = d.coins < pt.cost;
    }
  }
}

on('pet-shop', 'click', async (e) => {
  const card = e.target.closest('[data-shoppet]');
  if (!card) return;
  const btn = card.querySelector('button');
  if (btn && btn.disabled) return;
  await act('buyShopPet', { petId: card.dataset.shoppet });
});

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
    const rlabel = it.rarity ? it.rarity.charAt(0).toUpperCase() + it.rarity.slice(1) : '';
    card._els.slot.textContent = `${rlabel ? rlabel + ' \u00b7 ' : ''}${it.kind === 'cosmetic' ? `Cosmetic \u00b7 ${it.slot}` : `${it.type}${it.kind === 'special' ? ' \u00b7 keepsake' : ''}`}`;
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

on('bag-grid','click', (e) => {
  const card = e.target.closest('.bag-card');
  if (!card || !card.dataset.item) return;
  const itemId = card.dataset.item;
  const shop = latest && latest.derived && latest.derived.rpg && latest.derived.rpg.items ? latest.derived.rpg.items.shop : [];
  const it = shop.find((x) => x.id === itemId);
  if (!it) return;
  if (!it.owned) act('buyItem', { itemId });
  else act('equipItem', { itemId });
});


// ===== HUD center zone: pet speech ticker, daily quests, quick audio =====
var questsPopOpen = false;
let tickerStarted = false;

function tickerLine() {
  const l = latest;
  if (!l || !l.derived) return null;
  const d = l.derived;
  const s = l.state;
  if (!s || s.dead) return null;
  const activeAct = (d.activities || []).find((a) => a.active);
  const opts = [];
  if (s.flags.sleeping) {
    opts.push('\u{1F4A4} Zzz... sweet dreams, buddy...', '\u{1F634} Shh... recharging energy...');
  } else if (s.meters.hunger < 25) {
    opts.push('\u{1F35C} Craving a world delicacy!', '\u{1F963} Tummy is rumbling...');
  } else if (s.meters.energy < 25) {
    opts.push('\u{1F4A4} Getting sleepy...', '\u2615\uFE0F Need a quick nap...');
  } else if (s.effects.happyUntil > Date.now()) {
    opts.push('\u{1F495} Wheee! That was fun!', '\u2728\uFE0F Best day ever with you!');
  } else if (activeAct) {
    const label = activeAct.name || activeAct.id;
    opts.push(`\u{1F33F} Enjoying ${label}!`, `\u{1F30F} Exploring ${label}...`);
  } else {
    opts.push(
      '\u2728\uFE0F 100% Online Rate active!',
      '\u{1F49A} Happy to hang out with you!',
      `\u{1F3E1} Chilling in ${s.pet.name}'s Home...`,
      d.weather ? `${d.weather.icon} ${d.weather.label} \u2014 cozy weather today!` : '\u2600\uFE0F\uFE0F Cozy day ahead!',
      d.daily && d.daily.streak >= 3 ? `\u{1F525} Streak day ${d.daily.streak} \u2014 keep it growing!` : '\u{1F331} Fresh leaves, fresh vibes!'
    );
  }
  return opts[Math.floor(Math.random() * opts.length)];
}

function startTicker() {
  if (tickerStarted || !el('hud-ticker')) return;
  tickerStarted = true;
  setInterval(() => {
    if (document.hidden) return;
    const tickEl = el('hud-ticker');
    const txtEl = el('hud-ticker-text');
    if (!tickEl || !txtEl) return;
    const line = tickerLine();
    if (!line || txtEl.textContent === line) return;
    tickEl.classList.add('fade');
    setTimeout(() => {
      txtEl.textContent = line;
      tickEl.classList.remove('fade');
    }, 450);
  }, 8500);
}

function renderQuestsPop() {
  const list = el('quests-list');
  const d = latest && latest.derived;
  if (!list || !d || !d.quests) return;
  const q = d.quests;
  const defs = [
    { id: 'feed', label: '\u{1F35C} Feed a meal 1\u00d7', done: q.feed > 0 },
    { id: 'play', label: '\u{1F3BE} Play together 1\u00d7', done: q.play > 0 },
    { id: 'clean', label: '\u{1F9F9} Clean up 1\u00d7', done: q.clean > 0 },
  ];
  list.innerHTML = '';
  for (const def of defs) {
    const claimed = !!q[`${def.id}Claimed`];
    const row = document.createElement('div');
    row.className = `quest-item${def.done ? ' done' : ''}`;
    const labelEl = document.createElement('span');
    labelEl.textContent = def.label;
    row.appendChild(labelEl);
    const btn = document.createElement('button');
    btn.className = 'btn btn-amber';
    if (claimed) {
      btn.disabled = true;
      btn.textContent = '\u2705 Claimed';
    } else {
      btn.textContent = `+${q.rewardCoins || 40} coins`;
      btn.disabled = !def.done;
      btn.addEventListener('click', async () => {
        const res = await act('claimQuest', { questId: def.id });
        if (res && res.ok) {
          if (cuteSfx) cuteSfx.play('coin');
          const snap = await api.getState();
          if (snap) render(snap);
          renderQuestsPop();
        }
      });
    }
    row.appendChild(btn);
    list.appendChild(row);
  }
}

on('hud-btn-quests', 'click', () => {
  questsPopOpen = !questsPopOpen;
  const pop = el('quests-pop');
  if (!pop) return;
  pop.classList.toggle('hidden', !questsPopOpen);
  if (questsPopOpen) renderQuestsPop();
});
document.addEventListener('click', (e) => {
  if (!questsPopOpen) return;
  const pop = el('quests-pop');
  const btn = el('hud-btn-quests');
  if (!pop) return;
  if (btn && btn.contains(e.target)) return;
  if (pop.contains(e.target)) return;
  questsPopOpen = false;
  pop.classList.add('hidden');
});

function quickAudioOn() {
  return !!(sfx && sfx.isEnabled()) || !!(bgm && bgm.getEnabled && bgm.getEnabled());
}
function paintAudioQuick() {
  const iconEl = el('hud-audio-icon');
  if (iconEl) iconEl.textContent = quickAudioOn() ? '\u{1F50A}' : '\u{1F507}';
}
on('hud-btn-audio', 'click', async () => {
  const target = !quickAudioOn();
  if (sfx) sfx.setEnabled(target);
  if (bgm && bgm.setEnabled) {
    bgm.setEnabled(target);
    if (target) { bgmStarted = true; ensureBgm(); }
  }
  await api.action('setSettings', { bgmOn: target });
  const bgmT = el('btn-bgm-toggle');
  if (bgmT) bgmT.textContent = target ? '\u{1F3B5} Music: On' : '\u{1F507} Music: Off';
  const sfxLabel = el('sfx-label');
  if (sfxLabel && sfx) sfxLabel.textContent = sfx.isEnabled() ? '\u{1F50A} Sound: On' : '\u{1F507} Sound: Off';
  paintAudioQuick();
  if (cuteSfx) cuteSfx.play('pop');
});

// ===== Welcome Back (5% offline idle earnings) + Daily Check-In calendar =====
const CHECKIN_KEY = 'jb-checkin-shown';
let checkinOpen = false;

function dayKeyStr(ms) {
  const d = ms ? new Date(ms) : new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtAway(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${Math.max(1, m)}m`;
}

function initLaunchPopups(snap) {
  startTicker();
  paintAudioQuick();
  const rep = snap && snap.offlineReport;
  if (rep && rep.seconds >= 60 && !(snap.state && snap.state.dead)) {
    el('wb-time').textContent = `${fmtAway(rep.seconds)} away`;
    el('wb-coins').textContent = `+${Math.floor(rep.coins)}`;
    el('wb-xp').textContent = `+${Math.round(rep.xp)}`;
    el('welcome-back-modal').classList.remove('hidden');
    if (sfx) sfx.play('daily');
  } else {
    maybeAutoCheckin();
  }
}

on('wb-collect', 'click', () => {
  if (cuteSfx) cuteSfx.play('coin');
  if (cuteSfx) cuteSfx.play('sparkle');
  el('welcome-back-modal').classList.add('hidden');
  maybeAutoCheckin();
});

function renderCalendar() {
  const grid = el('checkin-grid');
  const d = latest && latest.derived;
  if (!grid || !d || !d.daily) return;
  const daily = d.daily;
  grid.innerHTML = '';
  const end = daily.claimedToday ? new Date() : new Date(Date.now() - 86400000);
  const start = new Date(end);
  start.setDate(start.getDate() - Math.max(0, daily.streak - 1));
  const startKey = dayKeyStr(start.getTime());
  const endKey = dayKeyStr(end.getTime());
  const today = dayKeyStr();
  const wpd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  for (let i = 6; i >= 0; i -= 1) {
    const dt = new Date();
    dt.setDate(dt.getDate() - i);
    const key = dayKeyStr(dt.getTime());
    const stamped = startKey <= key && key <= endKey;
    const cell = document.createElement('div');
    cell.className = `cal-cell${stamped ? ' past' : ''}${key === today ? ' today' : ''}`;
    cell.innerHTML = `<span class="cal-day">${dt.getDate()}</span><span style="font-size:8px" class="muted">${wpd[dt.getDay()]}</span>`;
    if (stamped) {
      const stamp = document.createElement('img');
      stamp.className = 'cal-stamp pixelated';
      stamp.src = 'assets/icons/streak_sprout.png';
      stamp.alt = '';
      stamp.draggable = false;
      cell.appendChild(stamp);
    }
    grid.appendChild(cell);
  }
  el('checkin-streak').textContent = `${daily.streak}-day streak \u00b7 best ${daily.best}`;
  el('checkin-preview').textContent = daily.claimedToday
    ? '\u2705 Checked in today \u2014 next reward tomorrow!'
    : `Today's reward: +${daily.nextReward} coins`;
  const btn = el('checkin-claim');
  btn.disabled = daily.claimedToday;
  btn.textContent = daily.claimedToday ? '\u2705 Come back tomorrow!' : '\u{1F331} Check In & Claim';
}

function openCheckin() {
  renderCalendar();
  const modal = el('checkin-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  checkinOpen = true;
  if (cuteSfx) cuteSfx.play('rustle');
}

function maybeAutoCheckin() {
  const d = latest && latest.derived;
  if (!d || !d.daily) return;
  const today = dayKeyStr();
  if (safeGet(CHECKIN_KEY) === today) return;
  try { localStorage.setItem(CHECKIN_KEY, today); } catch (err) { /* no storage */ }
  if (d.daily.claimedToday) return;
  openCheckin();
}

function safeGet(key) {
  try { return localStorage.getItem(key); } catch (err) { return null; }
}

on('hud-btn-calendar', 'click', () => openCheckin());
on('checkin-close', 'click', () => { el('checkin-modal').classList.add('hidden'); checkinOpen = false; });
on('checkin-claim', 'click', async () => {
  const btn = el('checkin-claim');
  if (btn.disabled) return;
  const res = await act('claimDaily');
  if (res && res.ok) {
    if (cuteSfx) cuteSfx.play('stamp');
    if (cuteSfx) cuteSfx.play('coin');
    const snap = await api.getState();
    if (snap) render(snap);
    renderCalendar();
    const today = dayKeyStr();
    try { localStorage.setItem(CHECKIN_KEY, today); } catch (err) { /* no storage */ }
    setTimeout(() => { el('checkin-modal').classList.add('hidden'); checkinOpen = false; }, 1100);
  }
});

// ===== global tactile button pop sound =====
document.addEventListener('click', (e) => {
  const b = e.target && e.target.closest ? e.target.closest('button') : null;
  if (!b || b.disabled) return;
  if (cuteSfx) cuteSfx.play('pop');
}, true);
