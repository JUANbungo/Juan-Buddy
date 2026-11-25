'use strict';

(function (root, factory) {
  const api = factory(typeof module !== 'undefined' && module.exports ? require('../pet/sprites.js') : root.JBSprites);
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.JBEngine = api;
})(typeof self !== 'undefined' ? self : this, function (spritesApi) {
const DELICACIES = spritesApi.DELICACIES;

const FOODS = Object.fromEntries(DELICACIES.map((d) => [d.id, {
  id: d.id,
  name: d.name,
  country: d.country,
  flag: d.flag,
  cost: d.cost,
  hunger: d.hunger,
  happiness: d.happy,
  energy: d.energy,
  buff: d.buff || null,
}]));

const BUFF_DURATION_MS = 10 * 60 * 1000;

const UPGRADES = {
  bed: {
    id: 'bed', name: 'Cozy Bed', max: 5, baseCost: 30, growth: 1.8,
    desc: 'Energy drains 12% slower per level.',
  },
  toys: {
    id: 'toys', name: 'Toy Box', max: 5, baseCost: 45, growth: 1.8,
    desc: 'Playing gives 25% more happiness per level.',
  },
  job: {
    id: 'job', name: 'Job Promotion', max: 10, baseCost: 60, growth: 2.1,
    desc: 'Earns +60% coins per level while working.',
  },
  feeder: {
    id: 'feeder', name: 'Auto-Feeder', max: 1, baseCost: 150, growth: 1,
    desc: 'Automatically feeds a Snack when hunger drops below 20.',
  },
};

const ACTIVITIES = {
  walk: {
    id: 'walk', name: 'Tara, Lakwatsa!', icon: '🚶',
    desc: 'A quick stroll around the barangay.',
    duration: 20, energy: 8, coins: [5, 9], xp: 4, cooldown: 30,
  },
  cook: {
    id: 'cook', name: 'Cook Adobo', icon: '🍳',
    desc: 'Simmer a pot of adobo to sell.',
    duration: 30, energy: 12, coins: [9, 15], xp: 6, cooldown: 45,
  },
  videoke: {
    id: 'videoke', name: 'Videoke Night', icon: '🎤',
    desc: 'Belt out power ballads. Standing ovation.',
    duration: 45, energy: 18, coins: [14, 22], xp: 9, cooldown: 60,
  },
  study: {
    id: 'study', name: 'Study Session', icon: '📚',
    desc: 'Cram for exams. Brain gains.',
    duration: 60, energy: 20, coins: [20, 32], xp: 12, cooldown: 90,
  },
  fish: {
    id: 'fish', name: 'Fishing Trip', icon: '🎣',
    desc: 'Patience may land a big, lucky catch.',
    duration: 90, energy: 25, coins: [28, 45], xp: 16, cooldown: 120, lucky: 0.15,
  },
};

const MAX_METERS = 100;
const OFFLINE_CAP_SECONDS = 8 * 60 * 60;
const LEVEL_XP_BASE = 40;
const LEVEL_XP_GROWTH = 1.6;

const STAGES = [
  { id: 'egg', name: 'Egg', minLevel: 1, scale: 0.42 },
  { id: 'baby', name: 'Baby', minLevel: 2, scale: 0.62 },
  { id: 'teen', name: 'Teen', minLevel: 6, scale: 0.8 },
  { id: 'adult', name: 'Adult', minLevel: 10, scale: 1 },
];
const DEATH_SECONDS = 30 * 60;

const SKINS = {
  classic: { id: 'classic', name: 'Classic', cost: 0, tint: null },
  golden: { id: 'golden', name: 'Golden Shine', cost: 300, tint: 'rgba(255, 200, 60, 0.34)' },
  sakura: { id: 'sakura', name: 'Sakura Glow', cost: 450, tint: 'rgba(255, 130, 180, 0.30)' },
  midnight: { id: 'midnight', name: 'Midnight Aura', cost: 600, tint: 'rgba(40, 60, 160, 0.38)' },
};

const ACHIEVEMENTS = [
  { id: 'first_feed', icon: '🍜', name: 'First Bite', desc: 'Feed your buddy', check: (s) => s.stats.feedCount >= 1 },
  { id: 'feast_10', icon: '😋', name: 'Little Foodie', desc: 'Feed 10 meals', check: (s) => s.stats.feedCount >= 10 },
  { id: 'feast_40', icon: '👨‍🍳', name: 'Gourmet Buddy', desc: 'Feed 40 meals', check: (s) => s.stats.feedCount >= 40 },
  { id: 'playful_10', icon: '🎾', name: 'Playtime!', desc: 'Play 10 times', check: (s) => s.stats.playCount >= 10 },
  { id: 'worker_10', icon: '💼', name: 'Hard Worker', desc: 'Work 10 minutes total', check: (s) => s.stats.workSeconds >= 600 },
  { id: 'rich_500', icon: '🪙', name: 'Coin Collector', desc: 'Earn 500 coins total', check: (s) => s.stats.coinsEarned >= 500 },
  { id: 'rich_2500', icon: '💰', name: 'Idle Tycoon', desc: 'Earn 2,500 coins total', check: (s) => s.stats.coinsEarned >= 2500 },
  { id: 'hatch', icon: '🐣', name: 'Hello World!', desc: 'Hatch your buddy', check: (s) => !!s.pet.species && s.pet.stage !== 'egg' },
  { id: 'teen', icon: '🌟', name: 'Growing Up', desc: 'Reach Teen form', check: (s) => ['teen', 'adult'].includes(s.pet.stage) },
  { id: 'adult', icon: '👑', name: 'Fully Evolved', desc: 'Reach Adult form', check: (s) => s.pet.stage === 'adult' },
  { id: 'streak_3', icon: '🔥', name: 'Loyal Friend', desc: '3-day login streak', check: (s) => (s.daily ? s.daily.streak : 0) >= 3 },
  { id: 'streak_7', icon: '💚', name: 'Best Buddy Forever', desc: '7-day login streak', check: (s) => (s.daily ? s.daily.streak : 0) >= 7 },
];

const WEATHER_POOL = ['clear', 'clear', 'cloudy', 'clear', 'rainy', 'cloudy', 'clear', 'stormy', 'cloudy', 'clear', 'snowy', 'clear'];
const WEATHERS = {
  clear: { id: 'clear', icon: '☀️', label: 'Sunny' },
  cloudy: { id: 'cloudy', icon: '☁️', label: 'Cloudy' },
  rainy: { id: 'rainy', icon: '🌧️', label: 'Rainy' },
  stormy: { id: 'stormy', icon: '⛈️', label: 'Stormy' },
  snowy: { id: 'snowy', icon: '❄️', label: 'Snowy' },
};

function xpForNextLevel(level) {
  return Math.round(LEVEL_XP_BASE * Math.pow(LEVEL_XP_GROWTH, level - 1));
}

function defaultState() {
  return {
    version: 2,
    pet: { name: 'Buddy', species: null, stage: 'egg', level: 1, xp: 0 },
    meters: { hunger: 80, energy: 90, happiness: 85 },
    coins: 20,
    flags: { sleeping: false, working: false },
    upgrades: { bed: 0, toys: 0, job: 1, feeder: 0 },
    activity: null,
    activityCooldowns: {},
    effects: { happyUntil: 0, eatUntil: 0, xpMulUntil: 0, xpMul: 1, buffUntil: 0, buffLabel: null },
    stats: { feedCount: 0, playCount: 0, coinsEarned: 0, workSeconds: 0 },
    achievements: [],
    daily: { last: null, streak: 0, best: 0 },
    skin: 'classic',
    skinsOwned: ['classic'],
    neglect: 0,
    dead: null,
    lastSeen: Date.now(),
  };
}

function ensureState(state) {
  const fresh = defaultState();
  for (const key of ['stats', 'achievements', 'daily', 'skin', 'skinsOwned', 'neglect', 'dead']) {
    if (state[key] === undefined) state[key] = fresh[key];
  }
  if (!state.pet) state.pet = fresh.pet;
  if (state.pet.stage === undefined) {
    state.pet.stage = state.pet.species ? 'adult' : 'egg';
  }
  if (state.pet.stage !== 'egg' && !state.pet.species) state.pet.species = 'kala';
  if (!(state.pet.name)) state.pet.name = fresh.pet.name;
  if (!state.dead) state.dead = null;
  return state;
}

function stageForLevel(level) {
  let stage = STAGES[0];
  for (const st of STAGES) {
    if (level >= st.minLevel) stage = st;
  }
  return stage;
}

function stageOf(state) {
  return STAGES.find((st) => st.id === state.pet.stage) || STAGES[0];
}

function clamp100(value) {
  if (value < 0) return 0;
  if (value > MAX_METERS) return MAX_METERS;
  return value;
}

function upgradeCost(id, currentLevel) {
  const u = UPGRADES[id];
  return Math.round(u.baseCost * Math.pow(u.growth, currentLevel));
}

function coinRate(state) {
  const job = state.upgrades.job;
  const petBonus = 1 + (state.pet.level - 1) * 0.1;
  let rate = 0.5 * Math.pow(1.6, job - 1) * petBonus;
  if (state.meters.happiness < 25) rate *= 0.6;
  return rate;
}

function statusText(state) {
  const m = state.meters;
  if (state.dead) return 'Passed away...';
  const danger = (state.neglect || 0) > 0.4 * DEATH_SECONDS;
  if (state.flags.sleeping) return 'Sleeping zZz';
  if (state.activity) return ACTIVITIES[state.activity.id].name;
  if (state.flags.working) return 'Working hard';
  if (m.hunger < 20) return 'Hungry!';
  if (m.energy < 20) return 'Tired...';
  if (m.happiness < 25) return 'Feeling sad';
  if (danger) return '⚠ Needs care NOW!';
  return 'Chilling';
}

function tick(state, dtSeconds, offline) {
  const dt = Math.max(0, Math.min(dtSeconds, offline ? OFFLINE_CAP_SECONDS : 3600));
  if (dt === 0) return [];
  const scale = offline ? 0.35 : 1;
  const m = state.meters;
  const f = state.flags;
  const bedFactor = Math.pow(0.88, state.upgrades.bed);
  const events = [];

  if (state.dead) {
    state.lastSeen = Date.now();
    return events;
  }

  careLevel(state);

  const careScale = state.pet.stage === 'egg' ? 0.35 : 1;

  let energyDrain = 0.035 * bedFactor * (f.working ? 2.2 : 1);
  let hungerDrain = 0.045 * (f.working ? 1.6 : 1);
  let happinessDrain = 0.025;
  if (m.hunger < 25) happinessDrain += 0.03;
  if (m.energy < 20) happinessDrain += 0.02;

  if (f.sleeping) {
    m.energy = clamp100(m.energy + 0.55 * dt);
    hungerDrain = 0.02;
  } else if (f.working) {
    const gained = coinRate(state) * dt * (offline ? 0.5 : 1);
    state.coins += gained;
    state.stats.coinsEarned += gained;
    state.stats.workSeconds += offline ? dt * 0.5 : dt;
    state.pet.xp += 0.05 * dt * (offline ? 1 : currentXpMul(state));
  }

  m.hunger = clamp100(m.hunger - hungerDrain * dt * scale * careScale);
  if (!f.sleeping) m.energy = clamp100(m.energy - energyDrain * dt * scale * careScale);
  m.happiness = clamp100(m.happiness - happinessDrain * dt * scale * careScale);

  if (f.working && m.energy <= 2) {
    f.working = false;
  }

  if (!offline && state.pet.stage !== 'egg') {
    const inDanger = m.hunger <= 0 || m.energy <= 0;
    if (inDanger) {
      state.neglect = Math.min(DEATH_SECONDS, (state.neglect || 0) + dt);
      if (state.neglect >= DEATH_SECONDS) {
        state.dead = {
          cause: m.hunger <= 0 ? 'starvation' : 'exhaustion',
          at: Date.now(),
          level: state.pet.level,
          species: state.pet.species,
        };
        f.working = false;
        f.sleeping = false;
        state.activity = null;
        events.push({ ok: true, message: `🕊️ ${state.pet.name} passed away... Start a new game to try again.` });
        return events;
      }
    } else if (state.neglect > 0) {
      state.neglect = Math.max(0, state.neglect - dt * 0.7);
    }
  }

  if (state.activity && Date.now() >= state.activity.endsAt) {
    events.push(completeActivity(state));
  }

  if (!offline && state.upgrades.feeder >= 1 && !f.sleeping && m.hunger < 20) {
    const cheapest = DELICACIES.reduce((a, d) => (d.cost > 0 && d.cost < a.cost ? d : a));
    applyFood(state, FOODS[cheapest.id], { free: true });
  }

  applyLevelUps(state);
  drainStageEvents(state, events);
  checkAchievements(state, events);
  state.lastSeen = Date.now();
  return events;
}

function careLevel(state) {
  const dangerRatio = stageOf(state).id === 'egg' ? 0 : Math.max(0, state.neglect || 0) / DEATH_SECONDS;
  return dangerRatio;
}

function drainStageEvents(state, out) {
  if (Array.isArray(state.stageEvents)) {
    for (const msg of state.stageEvents) out.push({ ok: true, message: msg });
    state.stageEvents = null;
  }
}

function checkAchievements(state, out) {
  for (const ach of ACHIEVEMENTS) {
    if (state.achievements.includes(ach.id)) continue;
    let done = false;
    try {
      done = !!ach.check(state);
    } catch (err) {
      done = false;
    }
    if (done) {
      state.achievements.push(ach.id);
      out.push({ ok: true, message: `🏆 Achievement: ${ach.name} — ${ach.desc}!` });
    }
  }
}

function completeActivity(state) {
  const a = ACTIVITIES[state.activity.id];
  const [lo, hi] = a.coins;
  let coins = lo + Math.random() * (hi - lo);
  let message = `${a.icon} ${a.name} done! +${Math.round(coins)} coins, +${a.xp} XP`;
  const luckyNow = a.lucky && Math.random() < a.lucky;
  if (luckyNow) {
    coins *= 3;
    message = `🍀 LUCKY! ${a.name} jackpot! +${Math.round(coins)} coins, +${a.xp} XP`;
  }
  state.coins += coins;
  state.pet.xp += a.xp * currentXpMul(state);
  state.activity = null;
  state.activityCooldowns[a.id] = Date.now() + a.cooldown * 1000;
  state.effects.happyUntil = Date.now() + 5000;
  return message;
}

function startActivity(state, id) {
  const gate = deadGate(state);
  if (gate) return gate;
  const a = ACTIVITIES[id];
  if (!a) return { ok: false, message: 'Unknown activity.' };
  if (state.activity) return { ok: false, message: 'Already busy with an activity!' };
  if (state.flags.sleeping) return { ok: false, message: 'Wake up first!' };
  if (state.meters.energy < a.energy) return { ok: false, message: `Not enough energy (needs ${a.energy} ⚡).` };
  const cd = state.activityCooldowns[id] || 0;
  if (Date.now() < cd) {
    return { ok: false, message: `${a.name} is on cooldown (${Math.ceil((cd - Date.now()) / 1000)}s).` };
  }
  state.meters.energy = clamp100(state.meters.energy - a.energy);
  state.activity = { id, endsAt: Date.now() + a.duration * 1000 };
  state.flags.working = false;
  return { ok: true, message: `${a.icon} ${a.name} started!` };
}

function applyLevelUps(state) {
  let need = xpForNextLevel(state.pet.level);
  while (state.pet.xp >= need) {
    state.pet.xp -= need;
    state.pet.level += 1;
    need = xpForNextLevel(state.pet.level);
  }
  const curIdx = Math.max(0, STAGES.findIndex((st) => st.id === state.pet.stage));
  const levelStageIdx = STAGES.findIndex((st) => st.id === stageForLevel(state.pet.level).id);
  const readyToHatch = state.pet.stage === 'egg' && state.pet.xp >= 14;
  let targetIdx = Math.max(levelStageIdx, curIdx);
  if (readyToHatch) {
    targetIdx = Math.max(targetIdx, 1);
    state.pet.level = Math.max(state.pet.level, 2);
  }
  if (targetIdx !== curIdx) {
    const target = STAGES[targetIdx];
    if (state.pet.stage === 'egg' && !state.pet.species) {
      const roster = spritesApi.PET_ROSTER || [];
      const pick = roster[Math.floor(Math.random() * roster.length)];
      state.pet.species = pick ? pick.id : 'kala';
    }
    state.stageEvents = state.stageEvents || [];
    if (state.pet.stage === 'egg') {
      const def = spritesApi.getPetById(state.pet.species);
      state.stageEvents.push(`🐣 Your egg hatched! ${state.pet.name} is a ${def ? def.name : 'Buddy'}!`);
    } else {
      state.stageEvents.push(`🌟 ${state.pet.name} evolved into ${target.name} form!`);
      state.coins += 25;
      state.stats.coinsEarned += 25;
    }
    state.pet.stage = target.id;
    state.effects.happyUntil = Math.max(state.effects.happyUntil, Date.now() + 8000);
  }
}

function deadGate(state) {
  if (state.dead) return { ok: false, message: `🕊️ ${state.pet.name} has passed away. Start a new game in the ✨ Life tab.` };
  return null;
}

function currentXpMul(state) {
  return state.effects.xpMulUntil && Date.now() < state.effects.xpMulUntil
    ? state.effects.xpMul || 1
    : 1;
}

function applyFood(state, food, opts) {
  const free = !!(opts && opts.free);
  if (state.meters.hunger >= 99) return { ok: false, message: `${state.pet.name} is full!` };
  if (!free) {
    if (state.coins < food.cost) return { ok: false, message: `Not enough coins for ${food.name}.` };
    state.coins -= food.cost;
  }
  const speciesPet = spritesApi.getPetById(state.pet.species);
  const isFavorite = speciesPet && speciesPet.favoriteFood === food.id;
  const happyGain = food.happiness * (isFavorite ? 1.5 : 1);
  state.meters.hunger = clamp100(state.meters.hunger + food.hunger);
  state.meters.happiness = clamp100(state.meters.happiness + happyGain);
  if (food.energy) state.meters.energy = clamp100(state.meters.energy + food.energy);
  state.pet.xp += isFavorite ? 4 : 2;
  if (food.buff && food.buff.stat === 'EXP') {
    state.effects.xpMul = 1 + food.buff.val / 100;
    state.effects.xpMulUntil = Date.now() + BUFF_DURATION_MS;
  } else if (food.buff) {
    state.effects.buffLabel = food.buff.label;
    state.effects.buffUntil = Date.now() + BUFF_DURATION_MS;
  }
  state.effects.eatUntil = Math.max(state.effects.eatUntil, Date.now() + 6000);
  state.stats.feedCount += 1;
  applyLevelUps(state);
  const flavor = isFavorite ? ` ${food.flag || ''} CulturalFavorite! 💛` : '';
  return { ok: true, message: `${state.pet.name} enjoyed ${food.name}!${flavor}` };
}

function feed(state, foodId, opts) {
  const gate = deadGate(state);
  if (gate) return gate;
  const food = FOODS[foodId];
  if (!food) return { ok: false, message: 'Unknown food.' };
  if (state.flags.sleeping) return { ok: false, message: `${state.pet.name} is sleeping...` };
  return applyFood(state, food, opts);
}

function play(state) {
  const gate = deadGate(state);
  if (gate) return gate;
  if (state.flags.sleeping) return { ok: false, message: `${state.pet.name} is sleeping...` };
  if (state.meters.energy < 8) return { ok: false, message: 'Too tired to play.' };
  state.meters.energy = clamp100(state.meters.energy - 8);
  state.meters.happiness = clamp100(state.meters.happiness + 10 * (1 + 0.25 * state.upgrades.toys));
  state.stats.playCount += 1;
  state.pet.xp += 4 * currentXpMul(state);
  state.effects.happyUntil = Math.max(state.effects.happyUntil, Date.now() + 5000);
  applyLevelUps(state);
  return { ok: true, message: `You played with ${state.pet.name}!` };
}

function petPat(state) {
  const gate = deadGate(state);
  if (gate) return gate;
  if (state.flags.sleeping) return { ok: false, message: 'Shh... sleeping.' };
  state.meters.happiness = clamp100(state.meters.happiness + 1.5);
  return { ok: true, message: '' };
}

function toggleWork(state) {
  const gate = deadGate(state);
  if (gate) return gate;
  if (state.flags.sleeping) return { ok: false, message: 'Wake up first!' };
  if (!state.flags.working && state.meters.energy < 15) {
    return { ok: false, message: 'Too tired to work.' };
  }
  state.flags.working = !state.flags.working;
  state.flags.sleeping = false;
  return { ok: true, message: state.flags.working ? 'Time to earn coins!' : 'Work shift over.' };
}

function toggleSleep(state) {
  const gate = deadGate(state);
  if (gate) return gate;
  if (state.flags.sleeping) {
    state.flags.sleeping = false;
    return { ok: true, message: `${state.pet.name} woke up!` };
  }
  state.flags.sleeping = true;
  state.flags.working = false;
  return { ok: true, message: `${state.pet.name} went to sleep.` };
}

function buyUpgrade(state, id) {
  const gate = deadGate(state);
  if (gate) return gate;
  const u = UPGRADES[id];
  if (!u) return { ok: false, message: 'Unknown upgrade.' };
  const lvl = state.upgrades[id];
  if (lvl >= u.max) return { ok: false, message: `${u.name} is maxed out.` };
  const cost = upgradeCost(id, lvl);
  if (state.coins < cost) return { ok: false, message: `Not enough coins (need ${cost}).` };
  state.coins -= cost;
  state.upgrades[id] = lvl + 1;
  return { ok: true, message: `${u.name} upgraded to level ${lvl + 1}!` };
}

function addOfflineProgress(state) {
  const elapsed = (Date.now() - state.lastSeen) / 1000;
  const effective = Math.min(elapsed, OFFLINE_CAP_SECONDS);
  if (effective < 5) return 0;
  tick(state, effective, true);
  return effective;
}

function phaseOf(now) {
  const h = new Date(now).getHours();
  if (h >= 5 && h < 8) return { id: 'dawn', icon: '🌅', label: 'Dawn', tint: 'rgba(255, 160, 90, 0.16)' };
  if (h >= 8 && h < 17) return { id: 'day', icon: '🌤️', label: 'Day', tint: 'rgba(255, 255, 220, 0.10)' };
  if (h >= 17 && h < 20) return { id: 'dusk', icon: '🌇', label: 'Dusk', tint: 'rgba(255, 100, 80, 0.18)' };
  return { id: 'night', icon: '🌙', label: 'Night', tint: 'rgba(30, 40, 110, 0.30)' };
}

function weatherFor(now) {
  const d = new Date(now);
  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  return WEATHERS[WEATHER_POOL[seed % WEATHER_POOL.length]];
}

function todayKey(now) {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dailyReward(state) {
  return 10 + Math.min(7, ((state.daily && state.daily.streak) || 0) + 1) * 5;
}

function claimDaily(state) {
  const gate = deadGate(state);
  if (gate) return gate;
  const today = todayKey(Date.now());
  const yesterday = todayKey(Date.now() - 86400000);
  const dc = state.daily;
  if (dc.last === today) return { ok: false, message: '📅 Daily bonus claimed today! Come back tomorrow.' };
  dc.streak = dc.last === yesterday ? dc.streak + 1 : 1;
  dc.best = Math.max(dc.best || 0, dc.streak);
  dc.last = today;
  const reward = 10 + Math.min(7, dc.streak) * 5;
  state.coins += reward;
  state.stats.coinsEarned += reward;
  state.effects.happyUntil = Math.max(state.effects.happyUntil, Date.now() + 5000);
  const events = [];
  checkAchievements(state, events);
  fireStageEvents(state, events);
  return { ok: true, message: `🔥 Day ${dc.streak} streak! +${reward} coins bonus!${events.length ? '\n' + events[events.length - 1].message : ''}` };
}

function fireStageEvents(state, out) {
  if (Array.isArray(state.stageEvents)) {
    for (const msg of state.stageEvents) out.push({ ok: true, message: msg });
    state.stageEvents = null;
  }
}

function buySkin(state, skinId) {
  const skin = SKINS[skinId];
  if (!skin) return { ok: false, message: 'Unknown skin.' };
  if (state.skinsOwned.includes(skinId)) return setSkin(state, skinId);
  if (state.coins < skin.cost) return { ok: false, message: `Not enough coins (need ${skin.cost}).` };
  state.coins -= skin.cost;
  state.skinsOwned.push(skinId);
  state.skin = skinId;
  return { ok: true, message: `${skin.name} skin unlocked & equipped!` };
}

function setSkin(state, skinId) {
  const skin = SKINS[skinId];
  if (!skin || !state.skinsOwned.includes(skinId)) return { ok: false, message: 'You do not own this skin yet.' };
  state.skin = skinId;
  return { ok: true, message: `${skin.name} skin equipped!` };
}

function saveCode(state) {
  const payload = {
    v: 2,
    pet: state.pet,
    meters: state.meters,
    coins: Math.floor(state.coins),
    flags: state.flags,
    upgrades: state.upgrades,
    stats: state.stats,
    achievements: state.achievements,
    daily: state.daily,
    skin: state.skin,
    skinsOwned: state.skinsOwned,
  };
  return 'JB2.' + btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}

function parseSaveCode(code) {
  try {
    if (typeof code !== 'string' || !code.startsWith('JB2.')) return null;
    const json = decodeURIComponent(escape(atob(code.slice(4))));
    const payload = JSON.parse(json);
    if (!payload || payload.v !== 2 || !payload.pet) return null;
    return payload;
  } catch (err) {
    return null;
  }
}

function importSave(state, code) {
  const payload = parseSaveCode(code);
  if (!payload) return { ok: false, message: 'Invalid save code.' };
  const kept = state.dead || payload.dead ? state.dead : null;
  state.pet = payload.pet;
  state.meters = payload.meters || state.meters;
  state.coins = typeof payload.coins === 'number' ? payload.coins : state.coins;
  if (payload.flags) state.flags = payload.flags;
  if (payload.upgrades) state.upgrades = payload.upgrades;
  if (payload.stats) state.stats = payload.stats;
  if (Array.isArray(payload.achievements)) state.achievements = payload.achievements;
  if (payload.daily) state.daily = payload.daily;
  if (payload.skin) state.skin = payload.skin;
  if (Array.isArray(payload.skinsOwned)) state.skinsOwned = payload.skinsOwned;
  state.activity = null;
  state.activityCooldowns = {};
  state.neglect = 0;
  state.dead = kept;
  ensureState(state);
  return { ok: true, message: `Save imported! Welcome back, ${state.pet.name}.` };
}

function newGame(state) {
  if (!state.dead) return { ok: false, message: 'Your buddy is still alive! (Reset progress in footer if you really want to start over.)' };
  const kept = { achievements: state.achievements, daily: state.daily, skinsOwned: state.skinsOwned };
  const fresh = defaultState();
  Object.keys(state).forEach((key) => { delete state[key]; });
  Object.assign(state, fresh);
  state.achievements = kept.achievements;
  state.daily = kept.daily;
  state.skinsOwned = kept.skinsOwned;
  return { ok: true, message: '🌱 A new egg awaits! Take good care of your next buddy.' };
}

function derivedStats(state) {
  const now = Date.now();
  const stage = stageOf(state);
  const nextStage = STAGES.find((st) => st.minLevel > state.pet.level) || null;
  return {
    coinRate: state.flags.working ? coinRate(state) : 0,
    statusText: statusText(state),
    nextLevelXp: xpForNextLevel(state.pet.level),
    activities: Object.values(ACTIVITIES).map((a) => ({
      ...a,
      active: state.activity ? state.activity.id === a.id : false,
      endsAt: state.activity ? state.activity.endsAt : 0,
      cooldownRemainingMs: Math.max(0, (state.activityCooldowns[a.id] || 0) - now),
    })),
    xpMulUntil: state.effects.xpMulUntil || 0,
    xpMul: currentXpMul(state),
    buffLabel: state.effects.buffUntil && now < state.effects.buffUntil ? state.effects.buffLabel : null,
    upgradeCosts: {
      bed: upgradeCost('bed', state.upgrades.bed),
      toys: upgradeCost('toys', state.upgrades.toys),
      job: upgradeCost('job', state.upgrades.job),
      feeder: upgradeCost('feeder', state.upgrades.feeder),
    },
    stage: {
      id: stage.id,
      name: stage.name,
      scale: stage.scale,
      next: nextStage ? { id: nextStage.id, name: nextStage.name, atLevel: nextStage.minLevel } : null,
    },
    phase: phaseOf(now),
    weather: weatherFor(now),
    daily: {
      streak: (state.daily && state.daily.streak) || 0,
      best: (state.daily && state.daily.best) || 0,
      claimedToday: (state.daily && state.daily.last) === todayKey(now),
      nextReward: dailyReward(state),
    },
    achievements: ACHIEVEMENTS.map((a) => ({
      id: a.id, icon: a.icon, name: a.name, desc: a.desc,
      unlocked: Array.isArray(state.achievements) && state.achievements.includes(a.id),
    })),
    skins: Object.values(SKINS).map((sk) => ({
      ...sk,
      owned: Array.isArray(state.skinsOwned) && state.skinsOwned.includes(sk.id),
      equipped: state.skin === sk.id,
    })),
    danger: Math.max(0, Math.min(1, (state.neglect || 0) / DEATH_SECONDS)),
    dead: state.dead,
    stats: state.stats,
  };
}

return {
  FOODS,
  DELICACIES,
  UPGRADES,
  ACTIVITIES,
  OFFLINE_CAP_SECONDS,
  defaultState,
  tick,
  feed,
  play,
  petPat,
  toggleWork,
  toggleSleep,
  buyUpgrade,
  startActivity,
  upgradeCost,
  coinRate,
  statusText,
  derivedStats,
  addOfflineProgress,
  xpForNextLevel,
  currentXpMul,
  ensureState,
  stageOf,
  stageForLevel,
  claimDaily,
  buySkin,
  setSkin,
  saveCode,
  parseSaveCode,
  importSave,
  newGame,
  SKINS,
  ACHIEVEMENTS,
  STAGES,
  DEATH_SECONDS,
};

});
