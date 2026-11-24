'use strict';

const engine = require('../src/engine/engine');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed += 1;
  } else {
    failed += 1;
    console.error(`  FAIL: ${msg}`);
  }
}

function approx(a, b, eps, msg) {
  assert(Math.abs(a - b) <= eps, `${msg} (got ${a}, expected ~${b})`);
}

console.log('engine tests');

const fresh = engine.defaultState();
assert(fresh.meters.hunger === 80, 'default hunger');
assert(fresh.coins === 20, 'default coins');
assert(fresh.upgrades.job === 1, 'default job level');

let s = engine.defaultState();
engine.tick(s, 10, false);
assert(s.meters.hunger < 80, 'hunger drains over time');
assert(s.meters.energy < 90, 'energy drains over time');
assert(Math.floor(s.coins) === 20, 'idling earns nothing');

s = engine.defaultState();
s.flags.working = true;
engine.tick(s, 10, false);
assert(s.coins > 20, 'working earns coins');
approx(s.coins - 20, engine.coinRate(s) * 10, 1e-6, 'coins match rate*dt');

s = engine.defaultState();
s.flags.sleeping = true;
const energyBefore = s.meters.energy;
engine.tick(s, 10, false);
assert(s.meters.energy > energyBefore, 'sleeping restores energy');
assert(s.meters.hunger < 80, 'sleeping still drains hunger (slowly)');

s = engine.defaultState();
s.meters.hunger = 50;
let r = engine.feed(s, 'meal');
assert(r.ok && s.meters.hunger === 100, 'meal restores hunger');
assert(s.coins === 20 - engine.FOODS.meal.cost, 'meal costs coins');
s.meters.hunger = 99.5;
r = engine.feed(s, 'snack');
assert(!r.ok, 'refuses to overfeed');
s.coins = 1;
s.meters.hunger = 50;
r = engine.feed(s, 'feast');
assert(!r.ok, 'cannot afford feast');
assert(s.meters.hunger === 50, 'failed feed leaves hunger untouched');

s = engine.defaultState();
s.meters.happiness = 50;
s.meters.energy = 50;
r = engine.play(s);
assert(r.ok && s.meters.happiness > 50, 'play raises happiness');
assert(s.meters.energy === 42, 'play costs 8 energy');
s.meters.energy = 5;
r = engine.play(s);
assert(!r.ok, 'too tired to play');

s = engine.defaultState();
s.flags.sleeping = true;
r = engine.play(s);
assert(!r.ok, 'cannot play while sleeping');
r = engine.toggleWork(s);
assert(!r.ok, 'cannot work while sleeping');

s = engine.defaultState();
s.coins = 10000;
assert(engine.buyUpgrade(s, 'job').ok, 'buy job upgrade');
assert(s.upgrades.job === 2, 'job level increased');
assert(engine.buyUpgrade(s, 'job').ok, 'can buy again');
const cost = engine.upgradeCost('job', s.upgrades.job);
s.coins = cost - 1;
assert(!engine.buyUpgrade(s, 'job').ok, 'insufficient coins rejected');
const t2 = engine.defaultState();
t2.upgrades.job = 10;
t2.coins = 999999;
assert(!engine.buyUpgrade(t2, 'job').ok, 'maxed upgrade rejected');
assert(engine.upgradeCost('bed', 0) === 30, 'bed cost lvl0');
approx(engine.upgradeCost('bed', 1), 30 * 1.8, 0.01, 'bed cost scaling');

s = engine.defaultState();
engine.tick(s, 0, false);
assert(s.meters.hunger === 80, 'zero dt is a no-op');
engine.tick(s, 99999, false);
assert(s.meters.hunger >= 0 && s.meters.hunger <= 100, 'live dt clamp + clamps meters');
assert(s.meters.energy >= 0, 'energy never negative');
const s2 = engine.defaultState();
engine.tick(s2, 3 * 24 * 3600, true);
assert(s2.meters.hunger === 0, 'offline capped at 8h leads to empty hunger');

s = engine.defaultState();
s.lastSeen = Date.now() - 60 * 60 * 1000;
s.flags.working = true;
const coinsBefore = s.coins;
engine.addOfflineProgress(s);
assert(s.coins > coinsBefore, 'offline working earns reduced coins');
assert(s.meters.hunger < 80, 'offline hunger drains');

s = engine.defaultState();
s.pet.xp = 1000;
engine.tick(s, 0.01, false);
assert(s.pet.level > 1, 'level up from xp');
s.pet.xp = engine.xpForNextLevel(s.pet.level) - 1;
const lvl = s.pet.level;
engine.tick(s, 0.01, false);
assert(s.pet.level === lvl, 'no premature level up');

s = engine.defaultState();
s.flags.working = true;
s.meters.energy = 1;
engine.tick(s, 1, false);
assert(!s.flags.working, 'working auto-stops when exhausted');

s = engine.defaultState();
s.upgrades.feeder = 1;
s.meters.hunger = 15;
s.coins = 100;
engine.tick(s, 0.01, false);
assert(s.meters.hunger >= 39.5, 'auto-feeder feeds when hungry');

const d = engine.derivedStats(engine.defaultState());
assert(d.coinRate === 0, 'idle coin rate is 0');
assert(d.statusText === 'Chilling', 'default status text');
assert(d.upgradeCosts.feeder === 150, 'feeder one-time cost');

const w = engine.defaultState();
w.flags.working = true;
assert(engine.derivedStats(w).coinRate > 0, 'working coin rate positive');

console.log('activity tests');

s = engine.defaultState();
r = engine.startActivity(s, 'walk');
assert(r.ok, 'start activity works');
assert(s.activity && s.activity.id === 'walk', 'activity is pending');
assert(s.meters.energy === 90 - engine.ACTIVITIES.walk.energy, 'activity costs energy');
r = engine.startActivity(s, 'cook');
assert(!r.ok, 'only one activity at a time');

s.flags.sleeping = true;
s.activity = null;
r = engine.startActivity(s, 'walk');
assert(!r.ok, 'no activities while sleeping');
s.flags.sleeping = false;

s = engine.defaultState();
s.meters.energy = 5;
r = engine.startActivity(s, 'study');
assert(!r.ok, 'insufficient energy blocks activity');

s = engine.defaultState();
s.activity = { id: 'walk', endsAt: Date.now() - 1000 };
s.flags.working = false;
const coinsAt = s.coins;
const xpAt = s.pet.xp;
const events = engine.tick(s, 1, false);
assert(events.length === 1, 'activity completion produces event');
assert(s.coins > coinsAt, 'completed activity grants coins');
assert(s.pet.xp > xpAt, 'completed activity grants xp');
assert(s.activity === null, 'activity cleared on completion');
assert(s.activityCooldowns.walk > Date.now(), 'cooldown set after completion');
assert(s.effects.happyUntil > Date.now(), 'happy after activity');

const cooledCoins = s.coins;
r = engine.startActivity(s, 'walk');
assert(!r.ok, 'cooldown blocks restart');
s.activityCooldowns.walk = Date.now() - 1;
r = engine.startActivity(s, 'walk');
assert(r.ok, 'activity restarts after cooldown');
engine.tick(s, 1, false);
assert(s.coins >= cooledCoins, 'no reward before completion');
assert(engine.startActivity(s, 'walk').ok === false, 'still busy until timer');

s = engine.defaultState();
assert(s.pet.species === 'kala', 'default species');
const da = engine.derivedStats(engine.defaultState());
assert(da.activities.length === 5, 'five activities offered');
assert(da.activities.every((a) => !a.active), 'no activity active by default');
assert(engine.startActivity(engine.defaultState(), 'nope').ok === false, 'unknown activity rejected');

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
