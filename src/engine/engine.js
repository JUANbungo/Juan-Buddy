'use strict';

const FOODS = {
  snack: { id: 'snack', name: 'Snack', cost: 5, hunger: 25, happiness: 4, xp: 2 },
  meal: { id: 'meal', name: 'Meal', cost: 15, hunger: 60, happiness: 8, xp: 5 },
  feast: { id: 'feast', name: 'Feast', cost: 40, hunger: 100, happiness: 15, xp: 12 },
};

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

const MAX_METERS = 100;
const OFFLINE_CAP_SECONDS = 8 * 60 * 60;
const LEVEL_XP_BASE = 40;
const LEVEL_XP_GROWTH = 1.6;

function xpForNextLevel(level) {
  return Math.round(LEVEL_XP_BASE * Math.pow(LEVEL_XP_GROWTH, level - 1));
}

function defaultState() {
  return {
    version: 1,
    pet: { name: 'Buddy', level: 1, xp: 0 },
    meters: { hunger: 80, energy: 90, happiness: 85 },
    coins: 20,
    flags: { sleeping: false, working: false },
    upgrades: { bed: 0, toys: 0, job: 1, feeder: 0 },
    lastSeen: Date.now(),
  };
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
  if (state.flags.sleeping) return 'Sleeping zZz';
  if (state.flags.working) return 'Working hard';
  if (m.hunger < 20) return 'Hungry!';
  if (m.energy < 20) return 'Tired...';
  if (m.happiness < 25) return 'Feeling sad';
  return 'Chilling';
}

function tick(state, dtSeconds, offline) {
  const dt = Math.max(0, Math.min(dtSeconds, offline ? OFFLINE_CAP_SECONDS : 3600));
  if (dt === 0) return;
  const scale = offline ? 0.35 : 1;
  const m = state.meters;
  const f = state.flags;
  const bedFactor = Math.pow(0.88, state.upgrades.bed);

  let energyDrain = 0.035 * bedFactor * (f.working ? 2.2 : 1);
  let hungerDrain = 0.045 * (f.working ? 1.6 : 1);
  let happinessDrain = 0.025;
  if (m.hunger < 25) happinessDrain += 0.03;
  if (m.energy < 20) happinessDrain += 0.02;

  if (f.sleeping) {
    m.energy = clamp100(m.energy + 0.55 * dt);
    hungerDrain = 0.02;
  } else if (f.working) {
    state.coins += coinRate(state) * dt * (offline ? 0.5 : 1);
    state.pet.xp += 0.05 * dt;
  }

  m.hunger = clamp100(m.hunger - hungerDrain * dt * scale);
  if (!f.sleeping) m.energy = clamp100(m.energy - energyDrain * dt * scale);
  m.happiness = clamp100(m.happiness - happinessDrain * dt * scale);

  if (f.working && m.energy <= 2) {
    f.working = false;
  }
  if (!offline && state.upgrades.feeder >= 1 && !f.sleeping && m.hunger < 20) {
    applyFood(state, FOODS.snack, { free: true });
  }

  applyLevelUps(state);
  state.lastSeen = Date.now();
}

function applyLevelUps(state) {
  let need = xpForNextLevel(state.pet.level);
  while (state.pet.xp >= need) {
    state.pet.xp -= need;
    state.pet.level += 1;
    need = xpForNextLevel(state.pet.level);
  }
}

function applyFood(state, food, opts) {
  const free = !!(opts && opts.free);
  if (state.meters.hunger >= 99) return { ok: false, message: `${state.pet.name} is full!` };
  if (!free) {
    if (state.coins < food.cost) return { ok: false, message: `Not enough coins for a ${food.name}.` };
    state.coins -= food.cost;
  }
  state.meters.hunger = clamp100(state.meters.hunger + food.hunger);
  state.meters.happiness = clamp100(state.meters.happiness + food.happiness);
  state.pet.xp += food.xp;
  applyLevelUps(state);
  return { ok: true, message: `${state.pet.name} enjoyed a ${food.name}!` };
}

function feed(state, foodId, opts) {
  const food = FOODS[foodId];
  if (!food) return { ok: false, message: 'Unknown food.' };
  if (state.flags.sleeping) return { ok: false, message: `${state.pet.name} is sleeping...` };
  return applyFood(state, food, opts);
}

function play(state) {
  if (state.flags.sleeping) return { ok: false, message: `${state.pet.name} is sleeping...` };
  if (state.meters.energy < 8) return { ok: false, message: 'Too tired to play.' };
  state.meters.energy = clamp100(state.meters.energy - 8);
  state.meters.happiness = clamp100(state.meters.happiness + 10 * (1 + 0.25 * state.upgrades.toys));
  state.pet.xp += 4;
  applyLevelUps(state);
  return { ok: true, message: `You played with ${state.pet.name}!` };
}

function petPat(state) {
  if (state.flags.sleeping) return { ok: false, message: 'Shh... sleeping.' };
  state.meters.happiness = clamp100(state.meters.happiness + 1.5);
  return { ok: true, message: '' };
}

function toggleWork(state) {
  if (state.flags.sleeping) return { ok: false, message: 'Wake up first!' };
  if (!state.flags.working && state.meters.energy < 15) {
    return { ok: false, message: 'Too tired to work.' };
  }
  state.flags.working = !state.flags.working;
  state.flags.sleeping = false;
  return { ok: true, message: state.flags.working ? 'Time to earn coins!' : 'Work shift over.' };
}

function toggleSleep(state) {
  if (state.flags.sleeping) {
    state.flags.sleeping = false;
    return { ok: true, message: `${state.pet.name} woke up!` };
  }
  state.flags.sleeping = true;
  state.flags.working = false;
  return { ok: true, message: `${state.pet.name} went to sleep.` };
}

function buyUpgrade(state, id) {
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

function derivedStats(state) {
  return {
    coinRate: state.flags.working ? coinRate(state) : 0,
    statusText: statusText(state),
    nextLevelXp: xpForNextLevel(state.pet.level),
    upgradeCosts: {
      bed: upgradeCost('bed', state.upgrades.bed),
      toys: upgradeCost('toys', state.upgrades.toys),
      job: upgradeCost('job', state.upgrades.job),
      feeder: upgradeCost('feeder', state.upgrades.feeder),
    },
  };
}

module.exports = {
  FOODS,
  UPGRADES,
  OFFLINE_CAP_SECONDS,
  defaultState,
  tick,
  feed,
  play,
  petPat,
  toggleWork,
  toggleSleep,
  buyUpgrade,
  upgradeCost,
  coinRate,
  statusText,
  derivedStats,
  addOfflineProgress,
  xpForNextLevel,
};
