'use strict';

const engine = window.JBEngine;
const sprites = window.JBSprites;
const sfx = window.JBSfx;
if (sprites && sprites.setSheetRoots) sprites.setSheetRoots(['pets/', 'assets/pets/']);
const COIN_ICON_HTML = '<img class="coin-ico pixelated" src="coin_gold_leaf.png" alt="" draggable="false">';

const SAVE_KEY = 'juanbuddy-mobile-save';

const STATE_FILE = { IDLE: 'idle', WALK: 'walk', HAPPY: 'happy', EAT: 'eat', SLEEP: 'sleep' };
const spriteImages = {};

const spriteSingles = {};

function spriteFramesFor(speciesId, anim) {
  for (const st of ['IDLE', 'WALK', 'HAPPY', 'EAT', 'SLEEP']) {
    const key = `${speciesId}_${st}`;
    if (!(key in spriteImages)) {
      const imgs = [];
      for (let f = 0; f < 4; f += 1) {
        const img = new Image();
        img.onerror = () => { img.bad = true; };
        img.src = `sprites/${speciesId}_${STATE_FILE[st]}_${f}.png`;
        imgs.push(img);
      }
      spriteImages[key] = imgs;
    }
  }
  return (spriteImages[`${speciesId}_${anim}`] || []).filter((i) => !i.bad && i.complete && i.naturalWidth > 0);
}

function spriteSingleFor(speciesId, anim) {
  const key = `${speciesId}_${STATE_FILE[anim]}`;
  if (!(key in spriteSingles)) {
    const img = new Image();
    img.onerror = () => { spriteSingles[key] = null; };
    img.src = `sprites/${key}.png`;
    spriteSingles[key] = img;
  }
  const img = spriteSingles[key];
  return img && img.complete && img.naturalWidth > 0 ? img : null;
}

const evoSingles = {};

function evoSingleFor(speciesId, anim) {
  const key = `${speciesId}_evo_${STATE_FILE[anim]}`;
  if (!(key in evoSingles)) {
    const img = new Image();
    img.onerror = () => { evoSingles[key] = null; };
    img.src = `sprites/evolutions/single/${key}.png`;
    evoSingles[key] = img;
  }
  const img = evoSingles[key];
  return img && img.complete && img.naturalWidth > 0 ? img : null;
}

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return engine.defaultState();
    const saved = JSON.parse(raw);
    const d = engine.defaultState();
    return engine.ensureState({
      ...d, ...saved,
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
    case 'claimDaily': result = engine.claimDaily(state); break;
    case 'allocateStat': result = engine.allocateStat(state, payload && payload.statId); break;
    case 'battleMonster': result = engine.battleMonster(state, payload && payload.monsterId); break;
    case 'arenaResult': result = engine.arenaResult(state, payload); break;
    case 'arenaRevive': result = engine.arenaRevive(state, payload); break;
    case 'buyGear': result = engine.buyGear(state, payload && payload.gearId); break;
    case 'equipGear': result = engine.equipGear(state, payload && payload.gearId); break;
    case 'pullGearGacha': result = engine.pullGearGacha(state, payload && payload.times); break;
    case 'choosePath': result = engine.choosePath(state, payload && payload.pathId); break;
    case 'cleanWaste': result = engine.cleanWaste(state, payload && payload.index); break;
    case 'newGame':
      result = engine.newGame(state);
      if (result.ok) save();
      break;
    default: break;
  }
  if (sfx) {
    if (!result.ok) sfx.play('error');
    else {
      const soundMap = { feed: 'feed', play: 'happy', pat: 'pat', toggleWork: 'click', toggleSleep: 'click', startActivity: 'click', claimDaily: 'daily', newGame: 'hatch', cheer: 'happy', allocateStat: 'levelup', battleMonster: 'happy', buyGear: 'buy', equipGear: 'happy', pullGearGacha: 'coin', choosePath: 'achv', cleanWaste: 'click' };
      sfx.play(soundMap[action] || 'click');
    }
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

const mNewGameBtn = $('m-new-game');
if (mNewGameBtn) mNewGameBtn.addEventListener('click', () => {
  if (!window.confirm('Start over with a new egg? Your buddy will be gone forever, but your achievements stay.')) return;
  run('newGame');
});

const mDailyBtn = $('m-daily');
if (mDailyBtn) mDailyBtn.addEventListener('click', () => run('claimDaily'));

let mGachaBusy = false;

async function mPullGacha(times) {
  if (mGachaBusy) return;
  mGachaBusy = true;
  const orb = $('m-gacha-orb');
  const frame = $('m-gacha-frame');
  const res = await run('pullGacha', { times });
  if (!res || res.ok === false) { mGachaBusy = false; return; }
  if (sfx) sfx.play('click');
  if (orb) orb.classList.add('spinning');
  if (frame) frame.classList.add('pulling');
  await new Promise((r) => setTimeout(r, times === 10 ? 1500 : 1000));
  if (orb) orb.classList.remove('spinning');
  if (frame) frame.classList.remove('pulling');
  if (res.best && sfx) sfx.playGacha(res.best.rarity);
  if (frame && res.best && res.best.stars >= 3) {
    const cols = ['#fbbf24', '#fb7185', '#a78bfa', '#38bdf8', '#4ade80'];
    for (let i = 0; i < 26; i += 1) {
      const bit = document.createElement('div');
      bit.className = 'confetti-bit';
      bit.style.left = `${Math.random() * 100}%`;
      bit.style.background = cols[i % cols.length];
      bit.style.animationDelay = `${Math.random() * 0.4}s`;
      if (frame) frame.appendChild(bit);
    }
    setTimeout(() => { frame.querySelectorAll('.confetti-bit').forEach((c) => c.remove()); }, 2400);
  }
  if (res.best && res.best.rarity === 'mythic') showToast('\u{1F4AB}\u2728 MYTHIC PULL!!! 0.0001% JACKPOT!! \u2728\u{1F4AB}', 6000);
  mGachaBusy = false;
}

$('m-gacha-1').addEventListener('click', () => mPullGacha(1));
$('m-gacha-10').addEventListener('click', () => mPullGacha(10));

$('m-food-search').addEventListener('input', () => renderFoods());

const petStateFor = () => {
  const t = Date.now();
  if (state.flags.sleeping) return 'SLEEP';
  if (state.effects.eatUntil > t) return 'EAT';
  if (state.effects.happyUntil > t) return 'HAPPY';
  return state.activity || state.flags.working ? 'WALK' : 'IDLE';
};

const eggImg = new Image();
eggImg.onerror = () => { eggImg.bad = true; };
eggImg.src = 'sprites/egg.png';

const petCanvas = $('m-pet');
const petCtx = petCanvas.getContext('2d');
const particles = [];
let lastPat = 0;
let currentSpecies = null;

let eggExciteUntil = 0;
function drawMobileEgg(now) {
  const prog = Math.max(0.04, Math.min(1, (state.pet.xp || 0) / 14));
  const shake = prog > 0.6 ? Math.sin(now / 55) * 3 * prog : 0;
  const eggAnim = prog > 0.92 ? 'crack' : (now < eggExciteUntil || prog > 0.6 ? 'shaking' : 'idle');
  const eggFrames = sprites.petSheetFrames ? sprites.petSheetFrames('egg', eggAnim) : null;
  if (eggFrames && eggFrames.length) {
    const fps = sprites.petSheetFps('egg', eggAnim);
    const fr = eggFrames[Math.floor((now * fps) / 1000) % eggFrames.length];
    const eggH = 104;
    petCtx.save();
    petCtx.imageSmoothingEnabled = false;
    petCtx.drawImage(fr, 120 - eggH / 2, 218 - eggH, eggH, eggH);
    petCtx.restore();
    petCtx.save();
    petCtx.font = '11px sans-serif';
    petCtx.textAlign = 'center';
    petCtx.fillStyle = 'rgba(255,255,255,0.85)';
    petCtx.fillText(prog > 0.8 ? 'crack... crack!' : `keep caring... ${Math.round(prog * 100)}%`, 120, 232);
    petCtx.restore();
    return;
  }
  petCtx.save();
  petCtx.globalAlpha = 0.22;
  petCtx.fillStyle = '#000';
  petCtx.beginPath();
  petCtx.ellipse(120 + shake, 218, 26, 7, 0, 0, Math.PI * 2);
  petCtx.fill();
  petCtx.restore();
  const eggOk = !eggImg.bad && eggImg.complete && eggImg.naturalWidth > 0;
  if (eggOk) {
    const eggH = 88;
    const eggW = eggH * (eggImg.naturalWidth / eggImg.naturalHeight);
    petCtx.save();
    petCtx.translate(120 + shake, 218);
    petCtx.drawImage(eggImg, -eggW / 2, -eggH, eggW, eggH);
    petCtx.restore();
  } else {
    petCtx.save();
    petCtx.translate(120 + shake, 184);
    petCtx.fillStyle = '#f5eede';
    petCtx.strokeStyle = '#6b5d43';
    petCtx.lineWidth = 3;
    petCtx.beginPath();
    petCtx.ellipse(0, 0, 26, 34, 0, 0, Math.PI * 2);
    petCtx.fill();
    petCtx.stroke();
    petCtx.fillStyle = '#ffd97a';
    petCtx.fillRect(-17, -8, 9, 9);
    petCtx.fillRect(5, 10, 8, 8);
    petCtx.fillRect(10, -20, 7, 7);
    petCtx.restore();
  }
  petCtx.save();
  petCtx.font = '11px sans-serif';
  petCtx.textAlign = 'center';
  petCtx.fillStyle = 'rgba(255,255,255,0.85)';
  petCtx.fillText(prog > 0.8 ? 'crack... crack!' : `keep caring... ${Math.round(prog * 100)}%`, 120 + shake, 232);
  petCtx.restore();
}

function drawMobileGrave() {
  petCtx.save();
  petCtx.globalAlpha = 0.22;
  petCtx.fillStyle = '#000';
  petCtx.beginPath();
  petCtx.ellipse(120, 217, 36, 7, 0, 0, Math.PI * 2);
  petCtx.fill();
  petCtx.restore();
  petCtx.fillStyle = '#8b93a8';
  petCtx.strokeStyle = '#4a5164';
  petCtx.lineWidth = 3;
  petCtx.beginPath();
  petCtx.moveTo(95, 214);
  petCtx.lineTo(95, 146);
  petCtx.arc(120, 146, 25, Math.PI, 0);
  petCtx.lineTo(145, 214);
  petCtx.closePath();
  petCtx.fill();
  petCtx.stroke();
  petCtx.fillStyle = '#4a5164';
  petCtx.font = 'bold 18px sans-serif';
  petCtx.textAlign = 'center';
  petCtx.fillText('R.I.P', 120, 182);
}

function drawPet(now) {
  petCtx.clearRect(0, 0, petCanvas.width, petCanvas.height);

  if (state.dead) {
    drawMobileGrave();
    return;
  }

  if (state.waste && state.waste.length) {
    for (const w of state.waste) {
      const wx = Math.round(30 + (w.x - 60) * 0.45);
      const wy = Math.round(194 + (w.y - 240) * 0.25);
      if (w.kind === 'poop') {
        petCtx.font = '15px sans-serif';
        petCtx.textAlign = 'center';
        petCtx.fillText('\uD83D\uDCA9', wx, wy);
      } else {
        petCtx.save();
        petCtx.globalAlpha = 0.55;
        petCtx.fillStyle = '#4fa3e3';
        petCtx.beginPath();
        petCtx.ellipse(wx, wy - 3, 7 + Math.sin(performance.now() / 400 + wx) * 0.8, 2.6, 0, 0, Math.PI * 2);
        petCtx.fill();
        petCtx.restore();
      }
    }
  }
  if (state.pet.stage === 'egg') {
    drawMobileEgg(now);
    return;
  }

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

  const anim = petStateFor();
  const stageDef = engine.stageOf(state);
  const boxSize = Math.round(224 * (stageDef ? stageDef.scale : 1) * (state.pet.evolved ? 0.8 : 1));
  const petLeft = 120 - boxSize / 2;
  const petTop = 214 - boxSize + (anim === 'HAPPY' || anim === 'WALK' ? Math.round(Math.sin(now / 260) * 4) : 0);
  petCtx.imageSmoothingEnabled = false;

  if (sprites.petSheetAnim) {
    const speciesKey = sprites.normalizeSpeciesId(speciesId);
    const v2Try = (pid) => {
      const animName = sprites.petSheetAnim(anim, pid);
      const frames = animName ? sprites.petSheetFrames(pid, animName) : null;
      if (frames && frames.length) {
        const fps = sprites.petSheetFps(pid, animName);
        return frames[Math.floor((now * fps) / 1000) % frames.length];
      }
      return null;
    };
    let fr = null;
    if (state.pet.evolved) fr = v2Try(`${speciesKey}_evo`);
    if (!fr) fr = v2Try(speciesId);
    if (fr) {
      petCtx.drawImage(fr, petLeft, petTop, boxSize, boxSize);
      if (anim === 'SLEEP' && Math.random() < 0.02) particles.push({ kind: 'z', x: 150, y: 30, vy: -0.5, life: 1, size: 16, wobble: 0 });
      return;
    }
  }

  if (state.pet.evolved) {
    const evoSingle = evoSingleFor(speciesId, anim);
    if (evoSingle) {
      petCtx.drawImage(evoSingle, petLeft, petTop, boxSize, boxSize);
      if (anim === 'SLEEP' && Math.random() < 0.02) particles.push({ kind: 'z', x: 150, y: 30, vy: -0.5, life: 1, size: 16, wobble: 0 });
      return;
    }
  }
  const pngs = spriteFramesFor(speciesId, anim);
  if (pngs.length > 0) {
    const img = pngs[Math.floor(now / 170) % pngs.length];
    petCtx.drawImage(img, petLeft, petTop, boxSize, boxSize);
    return;
  }
  const single = spriteSingleFor(speciesId, anim);
  if (single) {
    petCtx.drawImage(single, petLeft, petTop, boxSize, boxSize);
    return;
  }

  const frame = Math.floor(now / 170) % sprites.FRAMES_PER_STATE;
  const sprite = bank[anim] && bank[anim][frame % bank[anim].length];
  if (!sprite) return;
  petCtx.drawImage(sprite, petLeft, petTop, boxSize, boxSize);

  if (anim === 'SLEEP' && Math.random() < 0.02) particles.push({ kind: 'z', x: 150, y: 30, vy: -0.5, life: 1, size: 16, wobble: 0 });
  if ((state.flags.working || state.activity) && Math.random() < 0.012) {
    particles.push({ kind: 'coin', x: 120 + (Math.random() < 0.5 ? -40 : 40), y: 60, vy: -0.5, life: 1, size: 18, wobble: 0 });
  }
}

petCanvas.addEventListener('click', () => {
  const now = performance.now();
  if (now - lastPat < 800) return;
  lastPat = now;
  if (state.pet.stage === 'egg') eggExciteUntil = now + 1400;
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
    card._els.btn.innerHTML = del.cost === 0 ? 'FREE' : `${COIN_ICON_HTML}${del.cost}`;
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
    row.querySelector('.a-rewards').innerHTML = `⚡${a.energy} · ${COIN_ICON_HTML}${a.coins[0]}–${a.coins[1]} · +${a.xp} XP · ${a.duration}s`;
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

  if ($('m-daily') && d.daily) {
    $('m-daily').textContent = d.daily.claimedToday ? '\u2705 Daily claimed — back tomorrow!' : `\ud83c\udf81 Claim Daily (+${d.daily.nextReward})`;
    $('m-daily').disabled = d.daily.claimedToday;
  }

  if ($('m-gacha-rates') && d.gacha && d.gacha.rates) {
    $('m-gacha-rates').textContent = `Rates: ${d.gacha.rates.map((g) => `${'\u2605'.repeat(g.stars)} ${g.name} ${g.rate < 1 ? g.rate : g.rate + '%'}`).join(' \u00b7 ')}`;
    $('m-gacha-stats').textContent = `Pulls: ${d.gacha.pulls} \u00b7 Legendary: ${d.gacha.fiveStars} \u00b7 Mythic: ${d.gacha.mythics} \u2014 good luck!`;
  }

  const overlay = $('m-death-overlay');
  if (overlay) {
    if (s.dead) {
      overlay.classList.remove('hidden');
      $('m-death-cause').textContent = `Cause: ${s.dead.cause} — reached Lv ${s.dead.level}`;
      $('m-death-name').textContent = s.pet.name;
    } else {
      overlay.classList.add('hidden');
    }
  }
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
  if (state.pet.evolved && !globalThis.__evoShown) {
    globalThis.__evoShown = true;
    const def = sprites.EVO_DEFS ? sprites.EVO_DEFS.find((e) => e.id === state.pet.species) : null;
    showToast(`\u2728 EVOLUTION! ${def ? def.evolvedName : 'Stage 2'} unlocked \u2014 base stats +25%!`, 5000);
    if (sfx) sfx.play('evolve');
  } else if (!state.pet.evolved) {
    globalThis.__evoShown = false;
  }
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

// ==== Background music (built-in chiptune MIDI synth) ====
const bgm = window.JBBgm;
if (bgm) {
  const bgmToggle = document.getElementById('m-bgm-toggle');
  const bgmVol = document.getElementById('m-bgm-vol');
  let bgmBattleUntil = 0;
  const paintBgm = () => {
    if (bgmToggle) bgmToggle.textContent = bgm.getEnabled() ? '🎵 Music: On' : '🔇 Music: Off';
  };
  paintBgm();
  if (bgmToggle) bgmToggle.addEventListener('click', () => {
    bgm.setEnabled(!bgm.getEnabled());
    paintBgm();
  });
  if (bgmVol) bgmVol.addEventListener('input', () => bgm.setVolume(Number(bgmVol.value) / 100));
  let bgmStarted = false;
  document.addEventListener('pointerdown', () => {
    if (bgmStarted) return;
    bgmStarted = true;
    bgm.play(bgm.ambientForHour());
    setInterval(() => {
      if (Date.now() >= bgmBattleUntil) bgm.play(bgm.ambientForHour());
    }, 10000);
  });
  window.__jbBgmBattle = () => {
    bgmBattleUntil = Date.now() + 40000;
    bgm.play('battle');
  };
}

