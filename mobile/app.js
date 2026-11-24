'use strict';

const engine = window.JBEngine;
const sprites = window.JBSprites;

const SAVE_KEY = 'juanbuddy-mobile-save';

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return engine.defaultState();
    const saved = JSON.parse(raw);
    const d = engine.defaultState();
    return {
      ...d, ...saved,
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

let state = loadState();

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (err) { /* storage full */ }
}
setInterval(save, 15000);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

const awaySeconds = engine.addOfflineProgress(state);
if (awaySeconds > 5) {
  setTimeout(() => showToast(`While you were away: ${Math.floor(awaySeconds / 60)} min passed 💤`, 2500), 400);
}

const $ = (id) => document.getElementById(id);

let toastTimer = null;
function showToast(msg, ms) {
  if (!msg) return;
  const t = $('m-toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), ms || 2200);
}

function run(action, payload) {
  let result = { ok: false, message: 'Unknown action.' };
  switch (action) {
    case 'feed': result = engine.feed(state, payload && payload.foodId); break;
    case 'play': result = engine.play(state); break;
    case 'pat': result = engine.petPat(state); break;
    case 'toggleWork': result = engine.toggleWork(state); break;
    case 'toggleSleep': result = engine.toggleSleep(state); break;
    case 'startActivity': result = engine.startActivity(state, payload && payload.activityId); break;
    case 'cheer':
      state.coins += Math.max(0, Math.round((payload && payload.coins) || 10));
      result = { ok: true, message: '' };
      break;
    default: break;
  }
  showToast(result.message);
  render(engine.derivedStats(state));
  return result;
}

$('m-play').addEventListener('click', () => run('play'));
$('m-cheer').addEventListener('click', () => {
  const def = sprites.getPetById(state.pet.species);
  const api = window.JBMotivation;
  if (!api) return;
  const ev = api.fallbackEvent({
    name: state.pet.name || def.name, country: def.country, flag: def.flag,
  });
  run('cheer', { coins: ev.bonusCoins });
  showToast(`\u2728 ${def.flag || ''} ${ev.native}\n${ev.romanization ? '(' + ev.romanization + ') ' : ''}${ev.translation}\n+${ev.bonusCoins} coins`, 6000);
  maybeNotify();
});

if ('Notification' in window) {
  const askPermission = () => {
    if (Notification.permission === 'default') Notification.requestPermission();
  };
  document.addEventListener('click', askPermission, { once: true });
}

let notifStamps = {};
function maybeNotify() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const now = Date.now();
  const send = (key, body) => {
    if (now - (notifStamps[key] || 0) < 30 * 60 * 1000) return;
    notifStamps[key] = now;
    try { new Notification('Juan Buddy', { body }); } catch (err) { /* notifications optional */ }
  };
  if (state.meters.hunger < 15) send('hunger', `${state.pet.name} is really hungry! Time to feed.`);
  if (state.meters.energy < 10) send('energy', `${state.pet.name} is exhausted. Time for a nap.`);
}

let quoteCountdown = 15 * 60;
setInterval(() => {
  quoteCountdown -= 1;
  if (quoteCountdown <= 0) {
    quoteCountdown = 15 * 60;
    const def = sprites.getPetById(state.pet.species);
    const api = window.JBMotivation;
    if (api) {
      const ev = api.fallbackEvent({ name: state.pet.name || def.name, country: def.country, flag: def.flag });
      run('cheer', { coins: ev.bonusCoins });
      showToast(`\u2728 ${ev.native}\n+${ev.bonusCoins} coins \ud83d\udcc5`, 5000);
    }
  }
  maybeNotify();
}, 1000);

$('m-work').addEventListener('click', () => run('toggleWork'));
$('m-sleep').addEventListener('click', () => run('toggleSleep'));

$('m-food-search').addEventListener('input', () => renderFoods());

const petStateFor = (now) => {
  if (state.flags.sleeping) return 'SLEEP';
  if (state.effects.eatUntil > now) return 'EAT';
  if (state.effects.happyUntil > now) return 'HAPPY';
  return state.activity || state.flags.working ? 'WALK' : 'IDLE';
};

const petCanvas = $('m-pet');
const petCtx = petCanvas.getContext('2d');
const particles = [];
let lastPat = 0;
let currentSpecies = null;

function drawPet(now) {
  petCtx.clearRect(0, 0, petCanvas.width, petCanvas.height);
  petCtx.save();
  petCtx.globalAlpha = 0.22;
  petCtx.fillStyle = '#000';
  petCtx.beginPath();
  petCtx.ellipse(120, 214, 56, 9, 0, 0, Math.PI * 2);
  petCtx.fill();
  petCtx.restore();

  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.y += p.vy * 2.4;
    p.x += Math.sin(p.wobble += 0.06) * 0.6;
    p.life -= 0.01;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    petCtx.save();
    petCtx.globalAlpha = Math.min(1, p.life);
    petCtx.font = `${p.size}px sans-serif`;
    petCtx.textAlign = 'center';
    petCtx.fillStyle = p.kind === 'heart' ? '#ff6b81' : p.kind === 'coin' ? '#ffd166' : '#fff';
    petCtx.fillText(p.kind === 'heart' ? '❤' : p.kind === 'coin' ? '🪙' : 'z', p.x, p.y);
    petCtx.restore();
  }

  const speciesId = state.pet.species || 'kala';
  if (speciesId !== currentSpecies) {
    currentSpecies = speciesId;
    const def = sprites.getPetById(speciesId);
    if (def) setTimeout(() => showToast(`${def.greeting} — ${def.name} the ${def.species}!`, 2400), 100);
  }
  const bank = sprites.ensurePetSprites(speciesId);
  if (!bank) return;

  const anim = petStateFor(now);
  const frame = Math.floor(now / 170) % sprites.FRAMES_PER_STATE;
  const sprite = bank[anim] && bank[anim][frame % bank[anim].length];
  if (!sprite) return;

  const yOff = anim === 'HAPPY' || anim === 'WALK' ? Math.round(Math.sin(now / 260) * 4) : 0;
  petCtx.imageSmoothingEnabled = false;
  petCtx.drawImage(sprite, 120 - 112, 214 - 224 + yOff, 224, 224);

  if (anim === 'SLEEP' && Math.random() < 0.02) particles.push({ kind: 'z', x: 150, y: 30, vy: -0.5, life: 1, size: 16, wobble: 0 });
  if ((state.flags.working || state.activity) && Math.random() < 0.012) {
    particles.push({ kind: 'coin', x: 120 + (Math.random() < 0.5 ? -40 : 40), y: 60, vy: -0.5, life: 1, size: 18, wobble: 0 });
  }
}

petCanvas.addEventListener('click', () => {
  const now = performance.now();
  if (now - lastPat < 800) return;
  lastPat = now;
  particles.push({ kind: 'heart', x: 140, y: 40, vy: -0.6, life: 1, size: 20, wobble: 0 });
  run('pat');
});

const FOOD_EMOJI = { pad_thai: '🍜', bamboo_stalks: '🎍', khao_lam: '🎋', mango_sticky_rice: '🥭' };
let foodFilter = 'all';
let foodQuery = '';
const foodCards = {};
let chipsBuilt = false;

function regionGroup(country) {
  if (country === 'Philippines') return 'ph';
  if (country === 'India') return 'india';
  return ['Thailand', 'Vietnam', 'Laos', 'Cambodia', 'Malaysia', 'Indonesia', 'Singapore', 'Myanmar', 'Brunei'].includes(country) ? 'asean' : 'world';
}

function buildFoodFilters() {
  if (chipsBuilt) return;
  chipsBuilt = true;
  const bar = $('m-food-filters');
  for (const [key, label] of [['all', '✨ All'], ['ph', '🇵🇭 PH'], ['asean', '🌴 ASEAN'], ['india', '🇮🇳 India'], ['world', '🌏 World']]) {
    const chip = document.createElement('button');
    chip.className = 'filter-chip';
    chip.textContent = label;
    chip.addEventListener('click', () => {
      foodFilter = key;
      buildFoodFilters();
      renderFoods();
    });
    bar.appendChild(chip);
  }
  for (const chip of bar.children) {
    const label = chip.textContent;
    const key = label.includes('All') ? 'all' : label.includes('PH') ? 'ph' : label.includes('India') ? 'india' : label.includes('ASEAN') ? 'asean' : 'world';
    chip.classList.toggle('on', foodFilter === key);
  }
}

function renderFoods() {
  buildFoodFilters();
  const grid = $('m-food-grid');
  const favDef = sprites.getPetById(state.pet.species);
  for (const del of sprites.DELICACIES) {
    let card = foodCards[del.id];
    if (!card) {
      card = document.createElement('div');
      card.className = 'food-card';
      const icon = document.createElement('canvas');
      icon.width = 16; icon.height = 16;
      try {
        const cctx = icon.getContext('2d');
        cctx.imageSmoothingEnabled = false;
        cctx.drawImage(sprites.ensureFoodSprite(del.id), 0, 0, 16, 16);
        card.appendChild(icon);
      } catch (err) {
        const fb = document.createElement('div');
        fb.style.fontSize = '20px';
        fb.textContent = FOOD_EMOJI[del.id] || '🍽';
        card.appendChild(fb);
      }
      const mid = document.createElement('div');
      mid.innerHTML = '<div class="f-name"></div><div class="f-meta"></div><div class="f-fav-tag"></div>';
      const btn = document.createElement('button');
      btn.className = 'btn f-feed';
      btn.addEventListener('click', () => run('feed', { foodId: del.id }));
      card.appendChild(mid);
      card.appendChild(btn);
      card._els = {
        name: mid.querySelector('.f-name'),
        meta: mid.querySelector('.f-meta'),
        fav: mid.querySelector('.f-fav-tag'),
        btn,
      };
      grid.appendChild(card);
      foodCards[del.id] = card;
    }
    const group = regionGroup(del.country);
    const show = (foodFilter === 'all' || foodFilter === group)
      && (!foodQuery || del.name.toLowerCase().includes(foodQuery) || del.country.toLowerCase().includes(foodQuery));
    card.style.display = show ? '' : 'none';
    const isFav = favDef && favDef.favoriteFood === del.id;
    card.classList.toggle('fav', isFav);
    card._els.name.textContent = `${del.flag || ''} ${del.name}`;
    card._els.meta.textContent = `🍖${del.hunger} · 💖${del.happy}${del.energy ? ` · ⚡${del.energy}` : ''}${del.buff ? ` · ${del.buff.label}` : ''} · ${del.country}`;
    card._els.fav.textContent = isFav ? `★ ${favDef.name}'s favorite!` : '';
    card._els.btn.textContent = del.cost === 0 ? 'FREE' : `🪙${del.cost}`;
    card._els.btn.disabled = state.flags.sleeping || state.coins < del.cost || state.meters.hunger >= 99;
  }
}

const activityCards = {};

function renderActivities(d) {
  const list = $('m-activities');
  for (const a of d.activities) {
    let row = activityCards[a.id];
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
      row.querySelector('.a-btn').addEventListener('click', () => run('startActivity', { activityId: a.id }));
      list.appendChild(row);
      activityCards[a.id] = row;
    }
    row.querySelector('.a-name').textContent = `${a.icon} ${a.name}`;
    row.querySelector('.a-desc').textContent = a.desc;
    row.querySelector('.a-rewards').textContent = `⚡${a.energy} · 🪙${a.coins[0]}–${a.coins[1]} · +${a.xp} XP · ${a.duration}s`;
    const btn = row.querySelector('.a-btn');
    if (a.active) {
      btn.disabled = true;
      btn.textContent = 'Busy...';
    } else if (a.cooldownRemainingMs > 0) {
      btn.disabled = true;
      btn.textContent = `${Math.ceil(a.cooldownRemainingMs / 1000)}s`;
    } else {
      btn.disabled = state.flags.sleeping || state.meters.energy < a.energy;
      btn.textContent = 'Start';
    }
    const prog = row.querySelector('.activity-progress');
    if (a.active) {
      prog.classList.add('on');
      prog.querySelector('.pfill').style.width =
        `${Math.round(Math.max(0, Math.min(100, 100 - ((a.endsAt - Date.now()) / (a.duration * 1000)) * 100)))}%`;
    } else {
      prog.classList.remove('on');
    }
    row.classList.toggle('active', a.active);
  }
}

const buddyTiles = {};
let buddiesBuilt = false;

function renderBuddies() {
  const grid = $('m-buddies');
  if (!buddiesBuilt) {
    buddiesBuilt = true;
    for (const p of sprites.PET_ROSTER) {
      const tile = document.createElement('div');
      tile.className = 'buddy-tile';
      tile.dataset.species = p.id;
      const cv = document.createElement('canvas');
      cv.width = 32; cv.height = 32;
      try {
        const cctx = cv.getContext('2d');
        cctx.imageSmoothingEnabled = false;
        cctx.drawImage(sprites.ensurePetSprites(p.id).IDLE[0], 0, 0, 32, 32);
        tile.appendChild(cv);
      } catch (err) { /* skip preview */ }
      const name = document.createElement('span');
      name.className = 'b-name';
      name.textContent = p.name;
      const flag = document.createElement('span');
      flag.className = 'b-flag';
      flag.textContent = `${p.flag || ''} ${p.country}`;
      tile.appendChild(name);
      tile.appendChild(flag);
      tile.addEventListener('click', () => {
        state.pet.species = p.id;
        showToast(`${p.greeting}! ${p.name} joined you!`);
        render(engine.derivedStats(state));
      });
      grid.appendChild(tile);
      buddyTiles[p.id] = tile;
    }
  }
  for (const tile of grid.children) {
    tile.classList.toggle('selected', tile.dataset.species === state.pet.species);
  }
}

function render(d) {
  const s = state;
  $('m-name').textContent = s.pet.name;
  $('m-level').textContent = `Lv ${s.pet.level}`;
  $('m-status').textContent = d.statusText;
  $('m-coins').textContent = Math.floor(s.coins);
  $('m-rate').textContent = s.flags.working ? `+${d.coinRate.toFixed(1)}/s` : '';
  $('m-xpfill').style.width = `${Math.round(Math.min(100, (s.pet.xp / d.nextLevelXp) * 100))}%`;
  $('m-xptext').textContent = `${Math.floor(s.pet.xp)} / ${d.nextLevelXp} XP`;
  $('m-hunger').style.width = `${Math.round(s.meters.hunger)}%`;
  $('m-energy').style.width = `${Math.round(s.meters.energy)}%`;
  $('m-happy').style.width = `${Math.round(s.meters.happiness)}%`;

  $('m-work').textContent = s.flags.working ? '💼 Working...' : '💼 Work';
  $('m-work').classList.toggle('on', s.flags.working);
  $('m-sleep').textContent = s.flags.sleeping ? '😴 Sleeping...' : '😴 Sleep';
  $('m-sleep').classList.toggle('on', s.flags.sleeping);
  $('m-play').disabled = s.flags.sleeping || s.meters.energy < 8;

  const buff = $('m-buff');
  if (d.buffLabel) {
    buff.textContent = `🧪 ${d.buffLabel}`;
    buff.classList.remove('hidden');
  } else if (d.xpMul > 1) {
    buff.textContent = `🧪 +${Math.round((d.xpMul - 1) * 100)}% EXP`;
    buff.classList.remove('hidden');
  } else {
    buff.classList.add('hidden');
  }

  renderFoods();
  renderActivities(d);
  renderBuddies();
}

for (const btn of document.querySelectorAll('nav .tab')) {
  btn.addEventListener('click', () => {
    for (const b of document.querySelectorAll('nav .tab')) b.classList.toggle('on', b === btn);
    for (const section of document.querySelectorAll('main > section')) {
      section.classList.toggle('hidden', section.id !== `tab-${btn.dataset.tab}`);
    }
  });
}

let last = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = (now - last) / 1000;
  last = now;
  const events = engine.tick(state, dt, false);
  if (events.length) showToast(events[events.length - 1]);
  render(engine.derivedStats(state));
  if (now % 30000 < 1000) save();
}, 1000);

(function loop() {
  drawPet(performance.now());
  requestAnimationFrame(loop);
})();

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') save();
  else {
    const away = engine.addOfflineProgress(state);
    if (away > 5) showToast(`While you were away: ${Math.floor(away / 60)} min passed 💤`);
    last = Date.now();
    render(engine.derivedStats(state));
  }
});

render(engine.derivedStats(state));

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline caching optional */ });
}
