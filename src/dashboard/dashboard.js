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
  if (s && s.pet && s.pet.name === 'Buddy' && s.pet.stage === 'egg' && modal.classList.contains('hidden')) {
    modal.classList.remove('hidden');
    const input = el('name-input');
    if (input) {
      input.disabled = false;
      input.readOnly = false;
      input.value = '';
      setTimeout(() => { try { window.focus(); input.focus(); } catch (err) { /* ignore */ } }, 50);
    }
  }
}

const COIN_ICON_HTML = '<img class="coin-ico pixelated" src="assets/icons/coin_gold_leaf.png" alt="" draggable="false">';

let perkKeyShown = null;

const PERK_ICONS_PNG = {
  coins: 'assets/icons/coin_gold_leaf.png',
  xp: 'assets/icons/stat_exp_vine.png',
  energy: 'assets/icons/stat_energy_sun.png',
  rest: 'assets/icons/weather_night_firefly.png',
};

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
      btn.className = `perk-choice ${c.rarity === 'epic' ? 'epic' : 'common'}`;
      btn.dataset.perkIdx = String(i);
      const icoSrc = PERK_ICONS_PNG[c.type] || '';
      btn.innerHTML = `<span class="pk-ico">${icoSrc ? `<img class="pixelated" src="${icoSrc}" alt="" draggable="false" onerror="this.style.display='none'"/>` : ''}</span><span class="pk-name"></span><span class="pk-desc"></span><span class="pk-badge"></span>`;
      if (!icoSrc) btn.querySelector('.pk-ico').textContent = c.icon || '\uD83E\uDDF0';
      btn.querySelector('.pk-name').textContent = c.name || c.type;
      btn.querySelector('.pk-desc').textContent = c.desc || '';
      const badge = btn.querySelector('.pk-badge');
      badge.textContent = c.rarity === 'epic' ? '\u2728 EPIC (1% luck)' : 'COMMON';
      btn.addEventListener('mouseenter', () => { if (cuteSfx) cuteSfx.play('tick'); });
      wrap.appendChild(btn);
    });
  }
  modal.classList.remove('hidden');
  if (cuteSfx) cuteSfx.playLevelUpVictory();
  sfxOnce('levelup');
  try {
    const wrapRect = modal.getBoundingClientRect();
    if (window.JuanBuddyEco) window.JuanBuddyEco.burst(wrapRect.left + wrapRect.width / 2, wrapRect.top + 120, 'petals');
  } catch (err) { /* decorative only */ }
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
    battleMonster: 'happy', allocateStat: 'levelup', useEvoStone: 'evolve', choosePerk: 'levelup',
    choosePath: 'achv', cleanWaste: 'click',
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
  arenaSyncPack();
  renderArenaLock(s);

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

  const metersNow = s.meters || {};
  el('danger-banner').classList.toggle('hidden', !s.dead && !(metersNow.hunger <= 15 || metersNow.energy <= 10));
  el('death-overlay').classList.toggle('hidden', !s.dead);
  if (s.dead) {
    el('death-title').textContent = `${s.pet.name} passed away...`;
    el('death-cause').textContent = `Cause: ${s.dead.cause} — reached Lv ${s.dead.level}`;
  }

  safeRender('extras', () => renderExtras(d));
  safeRender('rpg', () => renderRpg(d));
  safeRender('explore', () => renderExplore(d));
  safeRender('petshop', () => renderPetShop(d));

  if (d.rpg.items.evolved && !evoTrack.shown) {
    evoTrack.shown = true;
    showEvoPopup(s.pet.species);
  } else if (!d.rpg.items.evolved) {
    evoTrack.shown = false;
  }

  el('btn-work').classList.toggle('on', s.flags.working);
  el('btn-sleep').classList.toggle('on', s.flags.sleeping);

  el('btn-play').disabled = s.flags.sleeping || s.meters.energy < 8;

  safeRender('shop', () => renderShop(s, d));
  safeRender('foods', () => renderFoods(s, d));
  safeRender('activities', () => renderActivities(s, d));
  safeRender('buddyPicker', () => renderBuddyPicker(s));
  if (toast) showToast(toast);
}

function safeRender(label, fn) {
  try {
    fn();
  } catch (err) {
    try { console.error(`[Juan Buddy] render("${label}") failed:`, err); } catch (e2) { /* ignore */ }
  }
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

const petShopTiles = {};
function renderPetShop(d) {
  const wrap = el('pet-shop');
  if (!wrap || !d.petShop) return;
  for (const pt of d.petShop) {
    let card = petShopTiles[pt.id];
    if (!card) {
      card = document.createElement('div');
      card.className = 'pet-shop-card';
      card.dataset.shoppet = pt.id;
      const img = document.createElement('img');
      img.className = 'pixelated petshop-ico';
      img.alt = pt.name;
      img.src = PET_PREVIEW_PNG[pt.id] || '';
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
    if (pt.owned) {
      btn.textContent = '\u2713 Adopted!';
      btn.disabled = true;
    } else {
      btn.innerHTML = `${COIN_ICON_HTML}${pt.cost.toLocaleString('en-US')}`;
      btn.disabled = d.coins < pt.cost;
    }
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
      btn.addEventListener('click', () => {
        lastFed = { foodId: del.id };
        lastBiteStage = -1;
        return act('feed', { foodId: del.id });
      });
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
    card._els.btn.innerHTML = del.cost === 0 ? 'FREE' : `${COIN_ICON_HTML}${del.cost}`;
    card._els.btn.disabled = s.flags.sleeping || !afford || s.meters.hunger >= 99;
  }
}

let activityIndex = null;

function renderActivities(s, d) {
  const list = el('activities');
  if (!activityIndex) activityIndex = {};
  for (const a of d.activities) {
    if (a.outdoor) continue;
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
    row.querySelector('.a-rewards').innerHTML =
      `<span class="a-reward-line">⚡${a.energy} · ${COIN_ICON_HTML}${a.coins[0]}–${a.coins[1]} · +${a.xp} XP · ${a.duration}s · CD ${a.cooldown}s</span>`;
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
      const animInfo = PET_PREVIEW_PNG[p.id] ? { src: PET_PREVIEW_PNG[p.id] } : null;
      let vis;
      if (animInfo) {
        vis = document.createElement('img');
        vis.className = 'pixelated';
        vis.draggable = false;
        vis.alt = p.name;
        vis.src = animInfo.src;
        vis.addEventListener('error', () => {
          const cv = document.createElement('canvas');
          cv.width = 32;
          cv.height = 32;
          try {
            const bank = sprites.ensurePetSprites(p.id);
            const cctx = cv.getContext('2d');
            cctx.imageSmoothingEnabled = false;
            cctx.drawImage(bank.IDLE[0], 0, 0, 32, 32);
          } catch (err) { /* preview only */ }
          vis.replaceWith(cv);
        });
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
      tile.addEventListener('click', () => openBuddyPreview(p));
      grid.appendChild(tile);
    }
    buddyTilesBuilt = true;
  }
  for (const tile of grid.children) {
    tile.classList.toggle('selected', tile.dataset.species === s.pet.species);
  }
}

let buddyPreviewRaf = null;
let buddyPreviewEl = null;

function closeBuddyPreview() {
  if (buddyPreviewRaf !== null) { cancelAnimationFrame(buddyPreviewRaf); buddyPreviewRaf = null; }
  if (buddyPreviewEl) { buddyPreviewEl.remove(); buddyPreviewEl = null; }
  document.removeEventListener('keydown', buddyPreviewEsc);
}

function buddyPreviewEsc(e) {
  if (e.key === 'Escape') closeBuddyPreview();
}

function openBuddyPreview(p) {
  closeBuddyPreview();
  const BS = window.JBBattleSkills || null;
  const isEvo = typeof p.id === 'string' && p.id.endsWith('_evo');
  const kit = BS ? BS.petKit(p.id, isEvo) : null;
  const battleBase = '../../assets/battle/';

  const anims = (sprites.PET_SHEET_ANIMS[p.id] ? Object.keys(sprites.PET_SHEET_ANIMS[p.id]) : ['idle'])
    .map((a) => ({ anim: a, label: a.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) }));

  const kitHtml = kit ? `
      <div class="jb-bp-kit">
        ${[['Active Skill', kit.skill, 'skill'], ['Battle Talent', kit.talent, 'talent'], ['Collection Passive', kit.passive, 'passive']].map(([label, item, cls]) => `
          <div class="jb-bp-item ${cls} ${kit.isEvo ? 'evo' : ''}" title="${item ? (item.desc || '').replace(/"/g, '&quot;') : ''}">
            <img src="${battleBase}${item.iconUrl}" alt="${item.name}" draggable="false" />
            <div class="jb-bp-item-txt">
              <span class="jb-bp-label">${label}</span>
              <span class="jb-bp-name">${item.name}${kit.isEvo ? ' \u2b50 Evo' : ''}</span>
            </div>
          </div>`).join('')}
      </div>`
    : '<p class="muted small" style="text-align:left;margin:6px 0 0;">No battle kit yet \u2014 this buddy fights with paws only! \ud83d\udc3e</p>';

  const modal = document.createElement('div');
  modal.id = 'buddy-preview';
  modal.className = 'buddy-preview';
  modal.innerHTML = `
    <div class="buddy-preview-card">
      <div class="bp-head">
        <span class="bp-name">${p.name}</span>
        <span class="bp-country">${p.flag || ''} ${p.country || ''}</span>
        <button class="bp-close" title="Close" type="button">\u2715</button>
      </div>
      <div class="bp-stage-wrap">
        <canvas class="bp-stage" width="192" height="192"></canvas>
      </div>
      <div class="bp-anim-btns">
        ${anims.map((a, i) => `<button class="bp-anim-btn ${i === 0 ? 'on' : ''}" data-anim="${a.anim}" type="button">${a.label}</button>`).join('')}
      </div>
      <div class="bp-species muted small">${p.species || ''}${p.favoriteFood ? ` \u00b7 Favorite food: ${p.favoriteFood.replace(/_/g, ' ')}` : ''}</div>
      <div class="bp-kit-left">${kitHtml}</div>
    </div>`;
  document.body.appendChild(modal);
  buddyPreviewEl = modal;

  modal.addEventListener('click', (e) => { if (e.target === modal) closeBuddyPreview(); });
  modal.querySelector('.bp-close').addEventListener('click', closeBuddyPreview);
  document.addEventListener('keydown', buddyPreviewEsc);

  const canvas = modal.querySelector('.bp-stage');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  let curAnim = anims[0] ? anims[0].anim : 'idle';
  let frames = null;
  let fps = 8;
  let frame = 0;
  let acc = 0;
  let last = 0;
  let drewFallback = false;

  function drawFallbackFrame() {
    if (drewFallback) return;
    try {
      const bank = sprites.ensurePetSprites(p.id);
      const src = bank[curAnim.toUpperCase()] || bank.IDLE;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(src[0], 0, 0, canvas.width, canvas.height);
      drewFallback = true;
    } catch (err) { /* preview only */ }
  }

  function loop(ts) {
    if (!buddyPreviewEl || !buddyPreviewEl.isConnected) { buddyPreviewRaf = null; return; }
    if (!frames) {
      frames = sprites.petSheetFrames(p.id, curAnim);
      if (frames) { fps = sprites.petSheetFps(p.id, curAnim); drewFallback = false; }
      else drawFallbackFrame();
    }
    if (frames && frames.length) {
      if (!last) last = ts;
      acc += ts - last;
      last = ts;
      const step = 1000 / Math.max(1, fps);
      while (acc >= step) { acc -= step; frame = (frame + 1) % frames.length; }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(frames[frame], 0, 0, canvas.width, canvas.height);
    }
    buddyPreviewRaf = requestAnimationFrame(loop);
  }
  buddyPreviewRaf = requestAnimationFrame(loop);

  modal.querySelectorAll('.bp-anim-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('.bp-anim-btn').forEach((b) => b.classList.remove('on'));
      btn.classList.add('on');
      curAnim = btn.dataset.anim;
      frames = sprites.petSheetFrames(p.id, curAnim);
      fps = sprites.petSheetFps(p.id, curAnim);
      frame = 0;
      acc = 0;
      last = 0;
      drewFallback = false;
      if (!frames) drawFallbackFrame();
    });
  });
}

const BRAND_FACE_PAW = '../../assets/sprites/ui/hud_icons/icons_1x_native/icon_paw.png';
function updateBrandFace(s) {
  const face = el('brand-face');
  if (!face) return;
  const pid = s.pet && s.pet.species;
  const animInfo = pid ? PET_PREVIEW_PNG[pid] : null;
  const src = !pid || s.pet.stage === 'egg'
    ? BRAND_FACE_PAW
    : animInfo || `../../assets/sprites/${pid}_idle_0.png`;
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
    btn.innerHTML = maxed ? 'Maxed out' : `Upgrade — ${COIN_ICON_HTML}${cost}`;
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

on('btn-title-screen','click', () => {
  if (cuteSfx) cuteSfx.play('click');
  window.location.reload();
});

on('pet-name','click', () => openBuddyProfile());

on('open-login','change', (e) => {
  api.action('setOpenAtLogin', { open: e.target.checked });
});

function askConfirm(message) {
  return new Promise((resolve) => {
    const modal = el('confirm-modal');
    if (!modal) { resolve(window.confirm(message)); return; }
    const txt = el('confirm-text');
    const yes = el('btn-confirm-yes');
    const no = el('btn-confirm-no');
    if (txt) txt.textContent = message;
    modal.classList.remove('hidden');
    if (sfx) sfx.play('click');
    const done = (val) => {
      modal.classList.add('hidden');
      if (yes) yes.removeEventListener('click', okH);
      if (no) no.removeEventListener('click', noH);
      modal.removeEventListener('click', outH);
      document.removeEventListener('keydown', keyH, true);
      resolve(val);
    };
    const okH = (e) => { if (e.cancelable) e.preventDefault(); e.stopPropagation(); done(true); };
    const noH = (e) => { if (e.cancelable) e.preventDefault(); e.stopPropagation(); done(false); };
    const outH = (e) => { if (e.target === modal) done(false); };
    const keyH = (e) => {
      if (e.key === 'Escape') { if (e.cancelable) e.preventDefault(); e.stopPropagation(); done(false); }
      else if (e.key === 'Enter') { if (e.cancelable) e.preventDefault(); e.stopPropagation(); done(true); }
    };
    if (yes) yes.addEventListener('click', okH);
    if (no) no.addEventListener('click', noH);
    modal.addEventListener('click', outH);
    document.addEventListener('keydown', keyH, true);
    setTimeout(() => { try { window.focus(); if (yes) yes.focus(); } catch (err) { /* ignore */ } }, 50);
  });
}

on('btn-reset','click', async () => {
  if (!(await askConfirm('Reset all progress? This cannot be undone.'))) return;
  const res = await api.action('reset');
  if (res && res.ok) clearNamedFlag();
  showToast('Progress reset.');
});

on('btn-admin-day','click', async () => {
  if (sfx) sfx.play('click');
  await act('adminAddDay');
});

on('btn-admin-gold','click', async () => {
  if (sfx) sfx.play('click');
  await act('adminAddGold');
});

on('btn-admin-exp','click', async () => {
  if (sfx) sfx.play('click');
  await act('adminAddExp');
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
    const cm = el('credits-modal');
    if (cm) cm.classList.add('hidden');
    if (creditsBox) creditsBox.classList.add('hidden');
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
  const creditsModal = el('credits-modal');
  const openCredits = () => {
    if (creditsModal) creditsModal.classList.remove('hidden');
    else if (creditsBox) creditsBox.classList.remove('hidden');
    if (sfx) sfx.play('click');
  };
  const closeCredits = () => {
    if (creditsModal) creditsModal.classList.add('hidden');
    if (creditsBox) creditsBox.classList.add('hidden');
  };
  if (creditsBtn) creditsBtn.addEventListener('click', openCredits);
  if (creditsBox && creditsBack) creditsBack.addEventListener('click', closeCredits);
  if (creditsModal) creditsModal.addEventListener('click', (e) => {
    if (e.target === creditsModal) closeCredits();
  });
  const updatesBtn = el('btn-splash-updates');
  if (updatesBtn) updatesBtn.addEventListener('click', () => {
    const url = 'https://github.com/JUANbungo/Juan-Buddy/releases/latest';
    if (api && api.action) api.action('openUrl', { url });
    else if (typeof window.open === 'function') window.open(url, '_blank');
    if (sfx) sfx.play('click');
  });
}
splashSetup();

// ===== Battle Arena + Death/Revive integration (engine-authoritative economy) =====
let arena = null;

function arenaPetDead() {
  const a = latest && latest.state && latest.state.arena;
  return !!(a && (a.status === 'ghost' || a.status === 'tombstone'));
}

function fmtArenaClock(ms) {
  const total = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
  const h = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  const pad = (v) => String(v).padStart(2, '0');
  return `${pad(h)}:${pad(mm)}:${pad(s)}`;
}

function arenaDeathFromEngine(a) {
  return {
    status: a && a.status ? a.status : 'alive',
    deathCount: (a && a.deaths) || 0,
    lockoutUntil: (a && a.ghostUntil) || 0,
    resetAt: (a && a.resetAt) || 0,
    lastDeathAt: Date.now(),
  };
}

function arenaSyncPack() {
  if (!arena || !latest || !latest.state) return;
  const snap = latest.derived ? latest.derived.arena : null;
  const next = arenaDeathFromEngine(snap);
  const cur = arena.deathState;
  if (!cur || cur.status !== next.status || cur.deathCount !== next.deathCount || cur.lockoutUntil !== next.lockoutUntil || cur.resetAt !== next.resetAt) {
    arena.deathState = next;
    if (arena.inArena) arena.renderArenaStage();
  }
}

function arenaMenuTab(name) {
  if (!arena) return;
  if (name === 'battle') {
    const unlocks = latest && latest.derived && latest.derived.rpg && latest.derived.rpg.unlocks ? latest.derived.rpg.unlocks : [];
    const bu = unlocks.find((u) => u.id === 'battle');
    if (bu && bu.unlocked) {
      arena.enterArena();
    } else if (arena.inArena) {
      arena.exitArena();
    }
    return;
  }
  if (arena.inArena) arena.exitArena();
}

function renderArenaLock(s) {
  const badge = el('arena-lock-badge');
  if (!badge) return;
  const dead = arenaPetDead();
  badge.classList.toggle('hidden', !dead);
  if (!dead) return;
  const snap = latest && latest.derived ? latest.derived.arena : null;
  const petName = s && s.pet ? s.pet.name : 'Your pet';
  const msgEl = badge.querySelector('.arena-lock-msg');
  const clockEl = el('arena-lock-clock');
  if (msgEl) {
    if (snap && snap.status === 'tombstone') {
      msgEl.textContent = '🪦 FULL DEATH! Buy the Special Reincarnation Stone (150,000 gold) in the Shop — or the game resets in:';
    } else {
      msgEl.textContent = `👻 ${petName} is dead! Buy a Reincarnation Stone in the Shop to revive.`;
    }
  }
  if (clockEl && snap) {
    clockEl.textContent = fmtArenaClock(snap.status === 'tombstone' ? snap.resetRemainingMs : snap.lockoutRemainingMs);
  }
}

const DEATH_SHEETS = {};
function deathSheetFrames(sheetName) {
  if (typeof Image === 'undefined') return null;
  const url = `../../assets/death/${sheetName}.png`;
  const entry = DEATH_SHEETS[url];
  if (entry) return entry.ready ? entry.frames : null;
  const rec = { ready: false, frames: [] };
  DEATH_SHEETS[url] = rec;
  const img = new Image();
  img.onload = () => {
    try {
      const fw = Math.floor(img.naturalWidth / 4);
      const fh = img.naturalHeight;
      const fr = [];
      for (let i = 0; i < 4; i += 1) {
        const cv = document.createElement('canvas');
        cv.width = fw;
        cv.height = fh;
        const g = cv.getContext('2d');
        g.imageSmoothingEnabled = false;
        g.drawImage(img, i * fw, 0, fw, fh, 0, 0, fw, fh);
        fr.push(cv);
      }
      rec.frames = fr;
      rec.ready = true;
    } catch (err) { /* canvas unavailable */ }
  };
  img.onerror = () => { rec.failed = true; };
  img.src = url;
  return entry ? null : null;
}

function drawDeathPet(now, status) {
  petWalk.target = null;
  petWalk.x = STAGE_CX;
  petWalk.y = 312;
  petDraw = { cx: STAGE_CX, gy: 312, size: 96, dir: 1 };
  const isGhost = status === 'ghost';
  const frames = isGhost ? deathSheetFrames('pet_ghost_idle_sheet') : deathSheetFrames('pet_tombstone_idle_sheet');
  stageCtx.save();
  stageCtx.imageSmoothingEnabled = false;
  if (frames && frames.length) {
    const fr = frames[Math.floor((now * 6) / 1000) % frames.length];
    const h = 88;
    const bob = isGhost ? Math.round(Math.sin(now / 500) * 3) : Math.round(Math.sin(now / 700) * 1.5);
    stageCtx.drawImage(fr, STAGE_CX - h / 2, 312 - h + bob, h, h);
  }
  stageCtx.restore();
  const snap = latest && latest.derived ? latest.derived.arena : null;
  const remain = snap ? (isGhost ? snap.lockoutRemainingMs : snap.resetRemainingMs) : 0;
  stageCtx.save();
  stageCtx.font = '11px sans-serif';
  stageCtx.textAlign = 'center';
  stageCtx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  stageCtx.fillText(isGhost ? `👻 dead... revives in ${fmtArenaClock(remain)}` : `🪦 full death... reset in ${fmtArenaClock(remain)}`, STAGE_CX, 330);
  stageCtx.restore();
}

function initArena() {
  if (arena || typeof window.JuanBuddyBattleArena !== 'function' || typeof document === 'undefined') return;
  const stageMount = el('arena-stage');
  if (!stageMount) return;
  arena = new window.JuanBuddyBattleArena({
    assetBase: '../../assets',
    stageMount,
    selectorMount: el('arena-selector'),
    homeElement: document.querySelector('.card.playground'),
    getPlayer() {
      const s = latest && latest.state;
      const derived = latest && latest.derived ? latest.derived : null;
      const rpg = derived && derived.rpg ? derived.rpg : null;
      const bs = rpg && rpg.battle ? rpg.battle : {};
      const level = s && s.pet ? s.pet.level : 1;
      const totals = derived && derived.collection ? derived.collection.totals : {};
      const arenaAtkMul = 1 + (totals.arenaAtkPct || 0);
      const arenaHpMul = 1 + (totals.arenaHpPct || 0);
      const maxHp = Math.round((40 + (bs.def || 2) * 4 + level * 6) * arenaHpMul);
      const species = s && s.pet && s.pet.species ? sprites.normalizeSpeciesId(s.pet.species) : null;
      const evolved = !!(s && s.pet && s.pet.evolved);
      let sheetPetId = null;
      if (species) {
        const evoId = `${species}_evo`;
        if (evolved && sprites.petSheetInfo(evoId, 'idle')) sheetPetId = evoId;
        else if (sprites.petSheetInfo(species, 'idle')) sheetPetId = species;
        else if (sprites.petSheetInfo(evoId, 'idle')) sheetPetId = evoId;
      }
      const sheetInfo = sheetPetId ? sprites.petSheetInfo(sheetPetId, 'idle') : null;
      const sheetUrl = sheetInfo ? sprites.petSheetUrl(sheetPetId, 'idle') : null;
      const kitRaw = derived && derived.collection ? derived.collection.activeKit : null;
      const battleBase = `${this.assetBase}/battle/`;
      const kit = kitRaw ? {
        ...kitRaw,
        skill: kitRaw.skill ? {
          ...kitRaw.skill,
          iconUrl: kitRaw.skill.iconUrl ? battleBase + kitRaw.skill.iconUrl : null,
          vfxUrl: kitRaw.skill.vfxSheetUrl ? battleBase + kitRaw.skill.vfxSheetUrl : null,
        } : null,
        talent: kitRaw.talent ? { ...kitRaw.talent, iconUrl: kitRaw.talent.iconUrl ? battleBase + kitRaw.talent.iconUrl : null } : null,
        passive: kitRaw.passive ? { ...kitRaw.passive, iconUrl: kitRaw.passive.iconUrl ? battleBase + kitRaw.passive.iconUrl : null } : null,
      } : null;
      return {
        name: (s && s.pet && s.pet.name) || 'Buddy',
        level,
        maxHp,
        hp: maxHp,
        atk: Math.round(((bs.atk || 5) + level * 2) * arenaAtkMul),
        def: bs.def || 2,
        spd: bs.spd || 3,
        gold: (s && s.coins) || 0,
        sheetFrames: sheetInfo ? sheetInfo.frames : 0,
        sheetUrl,
        spriteUrl: (species && PET_PREVIEW_PNG[species]) || `${this.assetBase}/monsters/guard_slime/idle_sheet.png`,
        kit,
      };
    },
    setGold() { /* gold is engine-authoritative */ },
    addReward(reward) {
      return api.action('arenaResult', { monsterId: reward.monster.id, win: true, gold: reward.gold, xp: reward.xp }).then((res) => {
        if (res && res.ok && window.JB_rollLimitedDrop) {
          const drop = window.JB_rollLimitedDrop(reward.monster);
          if (drop) showToast(`🎁 Limited drop found: ${drop.itemName}!`, 2600);
        }
        return res;
      }).catch(() => null);
    },
    onResetGame() { /* the engine tick performs the tombstone reset */ },
    onStateChange(info) {
      const inArena = !!(info && info.inArena);
      const place = el('arena-place');
      if (place && place.classList) place.classList.toggle('hidden', !inArena);
      const adRight = el('ad-right');
      if (adRight && adRight.classList) adRight.classList.toggle('hidden', inArena);
    },
  });

  arena.triggerPetDeath = function (forceFullDeath) {
    api.action('arenaResult', { monsterId: this.selectedMonster.id, win: false, gold: 0, xp: 0 }).then((res) => {
      if (res && res.arena) {
        this.deathState = arenaDeathFromEngine(res.arena);
        if (this.inArena) this.renderArenaStage();
      }
      if (res && res.message) showToast(res.message, 4200);
    }).catch(() => {});
  };

  const reviveVia = (inst, kind) => api.action('arenaRevive', { kind }).then((res) => {
    if (res && res.ok && res.arena) {
      inst.deathState = arenaDeathFromEngine(res.arena);
      inst.renderArenaStage();
    }
    return { ok: !!(res && res.ok), message: (res && res.message) || '' };
  }).catch(() => ({ ok: false, message: 'Revival failed.' }));

  arena.buyReincarnationStone = function () { return reviveVia(this, 'reincarnation'); };
  arena.buySpecialReincarnationStone = function () { return reviveVia(this, 'special'); };

  setInterval(() => {
    if (arenaPetDead() && (!arena || !arena.inArena)) renderArenaLock(latest && latest.state);
  }, 1000);
}

initArena();

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
let eggExciteUntil = 0;
const stageFx = [];
let lastStageNow = 0;
let petDraw = { cx: STAGE_CX, size: 264, dir: 1 };
let petDrawInfo = null;
let stageV2Key = null;
const shadowSmooth = { cx: null, rx: null };

function spawnFx(kind, x, y, opts) {
  const o = opts || {};
  stageFx.push({ kind, x, y, vy: o.vy !== undefined ? o.vy : -0.5, life: 1, size: o.size || 16, wobble: Math.random() * 6 });
}

const STAGE_STATE_FILE = { IDLE: 'idle', WALK: 'walk', HAPPY: 'happy', EAT: 'eat', SLEEP: 'sleep' };
const stageFrames = {};

const STAGE_PNG_ANIMS = {};
const PET_PREVIEW_PNG = {};
for (const pid of Object.keys(sprites.PET_SHEET_ANIMS || {})) {
  if (pid === 'egg') continue;
  PET_PREVIEW_PNG[pid] = sprites.petSheetGif(pid, 'idle');
}

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
  if (!img) return 1;
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h || img.complete === false) return 1;
  const key = img.src || img;
  if (footFracCache.has(key)) return footFracCache.get(key);
  let frac = 1;
  try {
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
// Gear (weapons/armor/charms) feature is disabled for rework — only cosmetics (cos_*) wear on the buddy.

function equippedOverlays(d2) {
  if (!latest || !latest.state) return [];
  const st2 = latest.state;
  if (st2.dead || st2.pet.stage === 'egg') return [];
  const r = latest.derived;
  const rpg = r && r.rpg;
  const shop = rpg && rpg.items ? rpg.items.shop : null;
  const iconOf = (id) => {
    if (!id) return null;
    const it = shop ? shop.find((x) => x.id === id) : null;
    return it ? it.icon : null;
  };
  const eq = (st2.items && st2.items.equipped) || {};
  const out = [];
  const listOf = (iconFn, id, slot) => {
    if (!id || !iconFn(id)) return;
    const pngId = COSMETIC_PNG.has(id) ? id : null;
    out.push({ slot, emo: iconFn(id), pngId });
  };
  listOf(iconOf, eq.Head, 'Head');
  listOf(iconOf, eq.Neck, 'Neck');
  listOf(iconOf, eq.Back, 'Back');
  listOf(iconOf, eq.Armor, 'Armor');
  listOf(iconOf, eq.Relic, 'Relic');
  listOf(iconOf, eq.Weapon, 'Weapon');
  return out.filter((o) => o.pngId);
}

const PET_ANCHORS = {
  default: {
    Head: { fx: 0.0, fy: 0.02, w: 0.46, snug: 0.07 },
    Neck: { fx: 0.08, fy: 0.3, w: 0.36 },
    Back: { fx: -0.52, fy: 0.38, w: 0.5 },
    Weapon: { fx: 0.56, fy: 0.5, w: 0.44 },
    Armor: { fx: -0.22, fy: 0.52, w: 0.44 },
    Relic: { fx: -0.56, fy: 0.74, w: 0.36 },
  },
  muning: { Head: { fx: 0.02, fy: 0.02, w: 0.46, snug: 0.07 } },
  banog: { Head: { fx: 0.0, fy: 0.03, w: 0.44, snug: 0.08 } },
  gagak: { Head: { fx: 0.0, fy: 0.02, w: 0.42, snug: 0.06 } },
  ran: { Head: { fx: 0.06, fy: 0.18, w: 0.4, snug: 0.05 } },
  dragon: { Head: { fx: 0.0, fy: 0.03, w: 0.5, snug: 0.08 } },
  kala: { Head: { fx: 0.0, fy: 0.04, w: 0.48, snug: 0.06 } },
  bantay: { Head: { fx: 0.0, fy: 0.05, w: 0.46, snug: 0.06 } },
  tala: { Head: { fx: 0.0, fy: 0.05, w: 0.46, snug: 0.06 } },
  chai: { Head: { fx: 0.0, fy: 0.03, w: 0.5, snug: 0.06 } },
  linh: { Head: { fx: 0.0, fy: 0.03, w: 0.44, snug: 0.05 } },
  bara: { Head: { fx: 0.0, fy: 0.03, w: 0.48, snug: 0.06 } },
  rimau: { Head: { fx: 0.0, fy: 0.05, w: 0.46, snug: 0.06 } },
  merli: { Head: { fx: 0.0, fy: 0.02, w: 0.48, snug: 0.05 } },
  raja: { Head: { fx: 0.0, fy: 0.04, w: 0.5, snug: 0.06 } },
  mochi: { Head: { fx: 0.0, fy: 0.05, w: 0.46, snug: 0.06 } },
  misha: { Head: { fx: 0.0, fy: 0.03, w: 0.48, snug: 0.05 } },
  gino: { Head: { fx: 0.0, fy: 0.04, w: 0.44, snug: 0.05 } },
};

const contentBoxCache = new WeakMap();
function contentBoxOf(img) {
  const w0 = img ? (img.naturalWidth || img.width) : 0;
  const h0 = img ? (img.naturalHeight || img.height) : 0;
  if (!img || !w0 || (!img.naturalWidth && !img.height)) return { top: 0.06, bottom: 0.94, left: 0.25, right: 0.75 };
  if (contentBoxCache.has(img)) return contentBoxCache.get(img);
  let out = { top: 0.06, bottom: 0.94, left: 0.25, right: 0.75 };
  try {
    const s = Math.min(64, w0, h0) || 64;
    const c = document.createElement('canvas');
    c.width = s;
    c.height = s;
    const icmp = c.getContext('2d', { willReadFrequently: true });
    icmp.imageSmoothingEnabled = false;
    icmp.drawImage(img, 0, 0, s, s);
    const data = icmp.getImageData(0, 0, s, s).data;
    let top = null;
    let bottom = null;
    let left = null;
    let right = null;
    for (let y = 0; y < s; y += 1) {
      for (let x = 0; x < s; x += 1) {
        if (data[(y * s + x) * 4 + 3] > 24) {
          if (top === null) top = y;
          bottom = y;
          if (left === null || x < left) left = x;
          if (right === null || x > right) right = x;
        }
      }
    }
    if (top !== null && bottom !== null && left !== null) {
      out = { top: top / s, bottom: (bottom + 1) / s, left: left / s, right: (right + 1) / s };
    }
  } catch (err) { /* tainted or missing frame */ }
  contentBoxCache.set(img, out);
  return out;
}

function drawEquippedOnPet(now, layer) {
  const all = equippedOverlays();
  if (!all.length) return;
  const overlays = layer === 'back' ? all.filter((o) => o.slot === 'Back') : all.filter((o) => o.slot !== 'Back');
  if (!overlays.length) return;
  const info = petDrawInfo || { cx: petWalk.x, topY: petWalk.y - 56, contentH: 52, yOff: 0, dir: petWalk.dir || 1 };
  const dir = info.dir;
  const cx = info.cx;
  const ch = info.contentH || 52;
  const species = latest && latest.state && latest.state.pet ? latest.state.pet.species : null;
  const petSet = PET_ANCHORS[species] || {};
  const anchors = { ...PET_ANCHORS.default, ...petSet };
  stageCtx.save();
  for (const o of overlays) {
    const a = anchors[o.slot] || anchors.Relic;
    const isShades = o.slot === 'Head' && o.pngId === 'cos_shades';
    const iw = Math.max(12, Math.round(ch * a.w * (isShades ? 0.9 : 1)));
    const x = cx + dir * ch * a.fx;
    let y;
    if (o.slot === 'Head') {
      y = info.topY + ch * a.fy - iw / 2 + ch * a.snug;
    } else {
      y = info.topY + ch * a.fy + info.yOff;
    }
    if (o.pngId) {
      const img = overlayImg(`../../assets/sprites/items/${o.pngId.startsWith('cos_') ? 'cosmetics' : 'equipment'}/${o.pngId}.png`);
      if (img) {
        stageCtx.imageSmoothingEnabled = false;
        const pcb = contentBoxOf(img);
        let dy = y - iw / 2;
        if (o.slot === 'Head' && o.pngId === 'cos_shades') {
          dy = (info.topY + ch * a.fy + ch * 0.17) - iw * (pcb.top + pcb.bottom) / 2;
        } else if (o.slot === 'Head') {
          const headLine = info.topY + ch * a.fy + ch * (a.snug === undefined ? 0.07 : a.snug);
          dy = headLine - iw * pcb.bottom;
        } else {
          dy = y - iw * (pcb.top + pcb.bottom) / 2;
        }
        stageCtx.drawImage(img, x - iw / 2, dy, iw, iw);
        continue;
      }
    }
    stageCtx.font = `${Math.max(12, Math.round(ch * 0.32))}px sans-serif`;
    stageCtx.textAlign = 'center';
    stageCtx.fillText(o.emo, x, y + iw / 3);
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
    const spec = { idle: ['frames/', '', 8], attack: ['attack/frames/', 'attack_', 6], hurt: ['hurt_defeated/frames/', 'hurt_defeated_', 4] }[kind] || ['frames/', '', 8];
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
  const evoShrink = s.pet.evolved ? 0.8 : 1;
  const boxSize = Math.round(264 * stageScale * evoShrink * (0.8 + 0.28 * depthF));
  petDraw = { cx: petWalk.x, gy: petWalk.y, size: boxSize, dir: petWalk.dir };
  const stageSpeciesKey = sprites.normalizeSpeciesId(s.pet.species || 'kala');
  if (stageV2Key !== stageSpeciesKey) {
    stageV2Key = stageSpeciesKey;
    sprites.prewarmPetSheets(stageSpeciesKey);
  }
  // keep petDrawInfo from the previous frame — the back-layer cosmetics pass
  // renders before this frame's sprite is measured (1-frame staleness is invisible)

  let shadowCx = petWalk.x;
  let shadowRx = Math.min(30 + 26 * depthF, 44);
  if (petDrawInfo && typeof petDrawInfo.contentL === 'number' && !(latest && latest.state && latest.state.pet && latest.state.pet.stage === 'egg')) {
    const cc = (petDrawInfo.contentL + petDrawInfo.contentR) / 2;
    shadowCx = petWalk.x + petWalk.dir * (cc - 0.5) * boxSize;
    shadowRx = Math.max(12, Math.min(boxSize * 0.2, ((petDrawInfo.contentR - petDrawInfo.contentL) * boxSize) / 2));
  }
  if (shadowSmooth.cx === null) { shadowSmooth.cx = shadowCx; shadowSmooth.rx = shadowRx; }
  else {
    const k = Math.min(1, dt * 12);
    shadowSmooth.cx += (shadowCx - shadowSmooth.cx) * k;
    shadowSmooth.rx += (shadowRx - shadowSmooth.rx) * k;
  }
  shadowCx = shadowSmooth.cx;
  shadowRx = shadowSmooth.rx;
  stageCtx.save();
  stageCtx.globalAlpha = 0.22;
  stageCtx.fillStyle = '#000';
  stageCtx.beginPath();
  stageCtx.ellipse(shadowCx, petWalk.y + 4, shadowRx, 8 + 3 * depthF, 0, 0, Math.PI * 2);
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

  if (st === 'EAT') drawFoodBowl(petWalk.x + 42 * petWalk.dir, petWalk.y, now);
  drawEquippedOnPet(now, 'back');

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

  if (arenaPetDead()) {
    drawDeathPet(now, latest.state.arena.status);
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
    const eggAnim = prog > 0.92 ? 'crack' : (now < eggExciteUntil || prog > 0.6 ? 'shaking' : 'idle');
    const eggFrames = sprites.petSheetFrames('egg', eggAnim);
    const eggOk = !eggSprite.bad && eggSprite.complete && eggSprite.naturalWidth > 0;
    if (eggFrames && eggFrames.length) {
      const fps = sprites.petSheetFps('egg', eggAnim);
      const fr = eggFrames[Math.floor((now * fps) / 1000) % eggFrames.length];
      const eggH = 118;
      stageCtx.imageSmoothingEnabled = false;
      stageCtx.drawImage(fr, STAGE_CX - eggH / 2, petWalk.y - eggH + Math.round(Math.sin(now / 500) * 2), eggH, eggH);
    } else if (eggOk) {
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
    const bobbing = st === 'HAPPY' || st === 'WALK' || st === 'EAT';
    const yOff = bobbing ? Math.round(Math.sin(now / (st === 'EAT' ? 130 : 260)) * (st === 'EAT' ? 2 : 4)) : 0;

    stageCtx.save();
    stageCtx.imageSmoothingEnabled = smoothGraphics;

    const drawPath = (g) => {
      g.save();
      g.translate(petWalk.x, 0);
      if (petWalk.dir < 0) g.scale(-1, 1);
      const bx = -boxSize / 2;
      const speciesId = s.pet.species || 'kala';
      const speciesKey = sprites.normalizeSpeciesId(speciesId);
      const isEvo = s.pet.evolved;
      const v2Try = (pid, stateOverride) => {
        const anim = sprites.petSheetAnim(stateOverride || st, pid);
        const frames = anim ? sprites.petSheetFrames(pid, anim) : null;
        if (frames && frames.length) {
          const fps = sprites.petSheetFps(pid, anim);
          return { frames, idx: Math.floor((now * fps) / 1000) % frames.length };
        }
        return null;
      };
      let v2hit = null;
      if (battleFx && speciesKey === 'dragon') v2hit = v2Try('dragon', 'FIRE_BREATH');
      if (!v2hit && isEvo) v2hit = v2Try(`${speciesKey}_evo`);
      if (!v2hit) v2hit = v2Try(speciesId);
      const isV2Pet = !!sprites.petSheetInfo(speciesKey, 'idle');
      if (!v2hit && isV2Pet) {
        v2hit = v2Try(speciesKey, 'IDLE');
        if (!v2hit && isEvo) v2hit = v2Try(`${speciesKey}_evo`, 'IDLE');
      }
      let img = null;
      let sub = null;
      if (v2hit) {
        img = v2hit.frames[v2hit.idx];
      } else if (!isV2Pet) {
        const evoSingle = s.pet.evolved ? evoSingleFor(speciesId, st) : null;
        const evoFrame = s.pet.evolved && !evoSingle ? evoSheetFrameFor(speciesId, st) : null;
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
      }
      if (img) {
        g.imageSmoothingEnabled = false;
        const by = petWalk.y - Math.round(boxSize * spriteFootFrac(img)) + yOff;
        if (sub) g.drawImage(img, sub.sx, sub.sy, sub.sw, sub.sh, bx, by, boxSize, boxSize);
        else g.drawImage(img, bx, by, boxSize, boxSize);
        const cb = sub ? { top: 0.06, bottom: 0.94, left: 0.25, right: 0.75 } : contentBoxOf(img);
        petDrawInfo = {
          cx: petWalk.x,
          topY: by + boxSize * cb.top,
          contentH: Math.max(20, boxSize * (cb.bottom - cb.top)),
          yOff,
          dir: petWalk.dir,
          contentL: cb.left,
          contentR: cb.right,
        };
      }
      g.restore();
    };

    if (tint) drawWithSkin(drawPath, tint);
    else drawPath(stageCtx);
    stageCtx.restore();

    if (st === 'SLEEP' && Math.random() < 0.02) spawnFx('z', petWalk.x + 20, petWalk.y - boxSize + 24, { vy: -0.35, size: 15 });
    if ((s.flags.working || s.activity) && Math.random() < 0.012) spawnFx('coin', petWalk.x + (Math.random() < 0.5 ? -50 : 50), 90, { vy: -0.4, size: 18 });
    if (petWalk.moving && Math.random() < 0.09) spawnFx('spark', petWalk.x - petWalk.dir * boxSize * 0.3, petWalk.y - 4, { vy: -0.15, size: 10 });
  }

  drawEquippedOnPet(now, 'front');
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
    if (p2.kind === 'imgfx' && p2.img) {
      stageCtx.imageSmoothingEnabled = false;
      stageCtx.drawImage(p2.img, p2.x - p2.size / 2, p2.y - p2.size / 2, p2.size, p2.size);
    } else {
      stageCtx.font = `${p2.size}px sans-serif`;
      stageCtx.textAlign = 'center';
      stageCtx.fillStyle = p2.kind === 'heart' ? '#ff6b81' : p2.kind === 'coin' ? '#ffd166' : 'rgba(240, 240, 255, 0.9)';
      const glyph = p2.kind === 'heart' ? '\u2764' : p2.kind === 'coin' ? '\u{1F4B0}' : p2.kind === 'crumb' ? '\u00b7' : p2.kind === 'z' ? 'z' : '\u2726';
      stageCtx.fillText(glyph, p2.x, p2.y);
    }
    stageCtx.restore();
  }
}

const eatingImgCache = {};
function eatingImg(file) {
  if (!(file in eatingImgCache)) {
    const img = new Image();
    img.onerror = () => { img.bad = true; };
    img.src = `../../assets/sprites/eating/${file}`;
    eatingImgCache[file] = img;
  }
  const im = eatingImgCache[file];
  return im && !im.bad && im.complete && im.naturalWidth > 0 ? im : null;
}

let lastFed = null;
let lastBiteStage = -1;

function drawFoodBowl(x, gy, now) {
  const s = latest && latest.state;
  const eatUntil = s && s.effects ? s.effects.eatUntil : 0;
  const t = Date.now();
  const remaining = Math.max(0, eatUntil - t);
  const frac = Math.max(0, Math.min(1, remaining / 6000));
  const leaf = eatingImg('banana_leaf/banana_leaf_01_full_4x.png');
  const leafHalf = eatingImg('banana_leaf/banana_leaf_02_half_4x.png');
  const leafEmpty = eatingImg('banana_leaf/banana_leaf_03_empty_base_4x.png');
  const lw = 48;
  const lh = 40;
  const lx = x - lw / 2;
  const ly = (gy || STAGE_GROUND) - lh + 6;
  stageCtx.save();
  stageCtx.imageSmoothingEnabled = false;
  if (leafEmpty) stageCtx.drawImage(leafEmpty, lx, ly, lw, lh);
  let stage = 2;
  if (frac > 0.66) stage = 0;
  else if (frac > 0.33) stage = 1;
  if (stage === 0 || stage === 1) {
    const base = stage === 0 ? leaf : leafHalf;
    if (base) stageCtx.drawImage(base, lx, ly, lw, lh);
    if (lastFed && lastFed.foodId) {
      const food = foodImage(lastFed.foodId);
      const okFood = food && food.complete && food.naturalWidth > 0;
      const fw = Math.round(lw * (stage === 0 ? 0.62 : 0.42));
      if (okFood) {
        const munch = Math.sin(now / 130) * 1.5;
        stageCtx.drawImage(food, lx + lw / 2 - fw / 2, ly + lh * 0.18 - fw * 0.45 + munch, fw, fw);
      }
    }
  }
  if (stage !== lastBiteStage && lastBiteStage >= 0) {
    for (let i = 0; i < 3; i += 1) {
      spawnImgFx('fx/fx_eating_crumbs_4x.png', x + (Math.random() * 16 - 8), ly + 6, { vy: -0.25, size: 12 });
    }
    if (cuteSfx) cuteSfx.play('munch');
  }
  lastBiteStage = stage;
  stageCtx.restore();
}

function spawnImgFx(file, x, y, opts) {
  const img = eatingImg(file);
  if (!img) return;
  const o = opts || {};
  stageFx.push({ kind: 'imgfx', img, x, y, vy: o.vy !== undefined ? o.vy : -0.5, life: 1, size: o.size || 16, wobble: Math.random() * 6 });
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
  if (latest && (latest.state.dead || arenaPetDead())) return;
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
    if (latest && latest.state && latest.state.pet && latest.state.pet.stage === 'egg') {
      eggExciteUntil = now + 1400;
    }
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
      if (b.dataset && b.dataset.menuTab) {
        activateTab(b.dataset.menuTab);
        arenaMenuTab(b.dataset.menuTab);
      }
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
let eatPrevState = null;
let eatMunchAt = 0;
(function stageLoop() {
  const stageNow = performance.now();
  drawStagePet(stageNow);
  if (petWalk.moving && (!latest || !latest.state || (!latest.state.dead && !arenaPetDead())) && stageNow - lastStepAt > 240) {
    lastStepAt = stageNow;
    if (cuteSfx) cuteSfx.play('step');
    if (Math.random() < 0.45) spawnFx('crumb', petWalk.x - 14 * petWalk.dir, petWalk.y + 2, { vy: -0.12, size: 8 });
  }
  const nowState = stageStateFor();
  if (nowState === 'EAT' && stageNow - eatMunchAt > 520) {
    eatMunchAt = stageNow;
    if (cuteSfx) cuteSfx.play('munch');
  }
  if (eatPrevState === 'EAT' && nowState !== 'EAT') {
    spawnImgFx('fx/fx_eating_heart_4x.png', petWalk.x, petWalk.y - 40, { vy: -0.45, size: 20 });
    lastFed = null;
  }
  eatPrevState = nowState;
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
    btn.innerHTML = sk.equipped ? '✓ Equipped' : sk.owned ? 'Equip' : sk.gachaOnly ? '🎰 Gacha only' : `${COIN_ICON_HTML}${sk.cost}`;
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
  coinLine.innerHTML = times === 10 ? `${best.name} best of 10 — +${totalCoins} ${COIN_ICON_HTML} total` : `+${best.coins} ${COIN_ICON_HTML}`;
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
    let res = null;
    try { res = await api.action('rename', { name }); } catch (err) { /* never block the modal */ }
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
      if (cuteSfx) cuteSfx.play('bloom');
      try {
        const r = btn.getBoundingClientRect();
        if (window.JuanBuddyEco) window.JuanBuddyEco.burst(r.left + r.width / 2, r.top + r.height / 2, 'leaves');
      } catch (err) { /* decorative only */ }
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
  if (!(await askConfirm('Start over with a new egg? Your buddy will be gone forever, but your achievements stay.'))) return;
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

const exploreCards = {};

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
    card.querySelector('.ex-meta').innerHTML = `${a.duration}s \u00b7 \u26a1${a.energy} \u00b7 ${COIN_ICON_HTML}${a.coins[0]}-${a.coins[1]} \u00b7 +${a.xp}xp \u00b7 cd ${a.cooldown}s`;
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

let pathPending = null;
on('path-cards','click', async (e) => {
  const card = e.target.closest('button[data-choosepath]');
  if (!card || card.disabled) return;
  if (pathPending !== card.dataset.choosepath) {
    pathPending = card.dataset.choosepath;
    if (cuteSfx) cuteSfx.play('pop');
    renderRpg(latest && latest.derived);
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


// ===== Evo popup tracking (Cozy Bag feature is disabled for rework) =====
const evoTrack = { shown: false };

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

on('pet-shop','click', (e) => {
  const card = e.target.closest('.pet-shop-card');
  if (!card || !card.dataset.shoppet) return;
  const pt = latest && latest.derived && latest.derived.petShop
    ? latest.derived.petShop.find((x) => x.id === card.dataset.shoppet) : null;
  if (pt && pt.owned) return;
  act('buyShopPet', { petId: card.dataset.shoppet });
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
      btn.innerHTML = `+${q.rewardCoins || 40} ${COIN_ICON_HTML}`;
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
    : `Today's reward: +${daily.nextReward} ${COIN_ICON_HTML}`;
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

// ===== Buddy profile modal (click your buddy up top) =====
const RENAME_COST = 10000;
let buddyProfileEsc = null;

function closeBuddyProfile() {
  const modal = el('buddy-profile-modal');
  if (modal) modal.classList.add('hidden');
  if (buddyProfileEsc) { document.removeEventListener('keydown', buddyProfileEsc); buddyProfileEsc = null; }
}

function openBuddyProfile() {
  const modal = el('buddy-profile-modal');
  const body = el('buddy-profile-body');
  const d = latest && latest.derived;
  const st = latest && latest.state;
  if (!modal || !body || !d || !st) return;
  const pet = st.pet || {};
  const species = sprites.normalizeSpeciesId(pet.species || 'kala');
  const rpg = d.rpg || {};
  const bs = rpg.battle || {};
  const col = d.collection || {};
  const kit = col.activeKit || null;
  const battleBase = '../../assets/battle/';
  const faceSrc = PET_PREVIEW_PNG[species] || '';
  const xpNow = Math.floor(pet.xp || 0);
  const xpNext = Math.max(1, d.nextLevelXp || 1);
  const xpPct = Math.min(100, Math.round((xpNow / xpNext) * 100));
  const renameFree = !!(st.milestones && st.milestones.rename60);
  const renameLabel = renameFree ? '\u270F\uFE0F Rename (Free \u2014 60-day milestone!)' : `\u270F\uFE0F Rename \u2014 ${RENAME_COST.toLocaleString()}g`;

  const kitHtml = kit
    ? [['Active Skill', kit.skill], ['Battle Talent', kit.talent], ['Collection Passive', kit.passive]].map(([label, item]) => `
        <div class="jb-bp-item" title="${item ? (item.desc || '').replace(/"/g, '&quot;') : ''}">
          ${item && item.iconUrl ? `<img src="${battleBase}${item.iconUrl}" alt="" draggable="false" />` : '<span class="jb-bp-emoji">\uD83D\uDC3E</span>'}
          <div class="jb-bp-item-txt">
            <span class="jb-bp-label">${label}</span>
            <span class="jb-bp-name">${item ? item.name : '\u2014'}</span>
          </div>
        </div>`).join('')
    : '<div class="jb-bp-item"><span class="jb-bp-emoji">\uD83E\uDD5A</span><div class="jb-bp-item-txt"><span class="jb-bp-label">Egg Charm</span><span class="jb-bp-name">Hatch to unlock skills!</span></div></div>';

  const invSlots = Array.from({ length: 8 }, () => '<div class="bp-inv-slot" title="Gear slot \u2014 coming in a future update!">\uD83D\uDD12</div>').join('');

  body.innerHTML = `
    <div class="bp-profile-head">
      <img class="bp-face pixelated" src="${faceSrc}" alt="" draggable="false" />
      <div class="bp-profile-id">
        <div class="bp-profile-name">${pet.name || 'Buddy'} <span class="bp-profile-lvl">LV ${pet.level || 1}</span></div>
        <div class="bp-profile-sub">\u23F3 ${rpg.daysPlayed || 0} day${(rpg.daysPlayed || 0) === 1 ? '' : 's'} played \u00b7 \u2694\uFE0F ${bs.wins || 0}W / ${bs.losses || 0}L \u00b7 \uD83D\uDC3E ${col.count || 1} buddy collected</div>
      </div>
    </div>
    <div class="bp-section-title">\u2B50 Character Stats</div>
    <div class="bp-stats-grid">
      <div class="bp-stat"><span>\u2694\uFE0F ATK</span><b>${bs.atk || 0}</b></div>
      <div class="bp-stat"><span>\uD83D\uDEE1\uFE0F DEF</span><b>${bs.def || 0}</b></div>
      <div class="bp-stat"><span>\uD83D\uDCA8 SPD</span><b>${bs.spd || 0}</b></div>
    </div>
    <div class="bp-xp-row">
      <span class="jb-bp-label">EXP Progress</span>
      <div class="bp-xp-track"><div class="bp-xp-fill" style="width:${xpPct}%"></div></div>
      <span class="bp-xp-num">${xpNow.toLocaleString()} / ${xpNext.toLocaleString()} (${xpPct}%)</span>
    </div>
    <div class="bp-section-title">\u2694\uFE0F Battle Kit</div>
    <div class="jb-bp-kit bp-kit-grid">${kitHtml}</div>
    <div class="bp-section-title">\uD83C\uDF92 Inventory <small class="muted">\u2014 gear slots coming soon</small></div>
    <div class="bp-inv-grid">${invSlots}</div>
    <div class="bp-section-title">\u270F\uFE0F Rename</div>
    <div class="bp-rename-row">
      <input id="bp-rename-input" class="name-input" maxlength="16" value="${(pet.name || 'Buddy').replace(/"/g, '&quot;')}" autocomplete="off" />
      <button id="bp-rename-btn" class="btn btn-amber">${renameLabel}</button>
    </div>
    ${renameFree ? '' : `<p class="muted small" style="margin:6px 0 0;">\uD83D\uDCB0 Renaming costs 10,000 gold \u00b7 free forever after the 60-day milestone!</p>`}
  `;

  const renameBtn = body.querySelector('#bp-rename-btn');
  const renameInput = body.querySelector('#bp-rename-input');
  if (renameBtn && renameInput) {
    renameBtn.addEventListener('click', async () => {
      const name = (renameInput.value || '').trim();
      if (!name) return;
      const res = await act('rename', { name });
      if (res && res.ok !== false) {
        const snap = await api.getState();
        if (snap) render(snap);
        openBuddyProfile();
      }
    });
  }
  on('bp-close', 'click', () => closeBuddyProfile());

  modal.classList.remove('hidden');
  if (buddyProfileEsc) document.removeEventListener('keydown', buddyProfileEsc);
  buddyProfileEsc = (e) => { if (e.key === 'Escape') closeBuddyProfile(); };
  document.addEventListener('keydown', buddyProfileEsc);
}

const brandBadgeEl = document.querySelector('.brand-badge');
if (brandBadgeEl) brandBadgeEl.addEventListener('click', () => openBuddyProfile());
