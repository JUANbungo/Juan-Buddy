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
s.coins = 100;
s.meters.hunger = 50;
let r = engine.feed(s, 'pad_thai');
assert(r.ok && s.meters.hunger === 82, 'pad thai restores hunger');
assert(s.coins === 100 - engine.FOODS.pad_thai.cost, 'pad thai costs coins');
s.meters.hunger = 99.5;
r = engine.feed(s, 'pandesal');
assert(!r.ok, 'refuses to overfeed');
s.coins = 1;
s.meters.hunger = 50;
r = engine.feed(s, 'butter_chicken');
assert(!r.ok, 'cannot afford butter chicken');
assert(s.meters.hunger === 50, 'failed feed leaves hunger untouched');
assert(engine.FOODS.samosa.cost === 0, 'samosa is free');

s = engine.defaultState();
s.meters.energy = 40;
r = engine.feed(s, 'masala_chai');
assert(r.ok, 'chai feeds ok');
assert(s.meters.energy > 40, 'chai restores energy');
assert(s.effects.xpMul > 1, 'chai grants EXP buff');
assert(engine.currentXpMul(s) > 1, 'xp multiplier active during buff');

s = engine.defaultState();
s.pet.species = 'kala';
r = engine.feed(s, 'halo_halo');
assert(r.ok && /Cultural/.test(r.message), 'kala loves halo-halo (cultural favorite)');
s = engine.defaultState();
s.pet.species = 'nila';
s.coins = 100;
r = engine.feed(s, 'butter_chicken');
assert(r.ok && /Cultural/.test(r.message), 'nila loves butter chicken (cultural favorite)');

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
assert(s.meters.hunger > 30, 'auto-feeder feeds cheapest food when hungry');

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
assert(s.pet.stage === 'egg' && s.pet.species === null, 'default state starts as mystery egg');
const da = engine.derivedStats(engine.defaultState());
assert(da.activities.length === 5, 'five activities offered');
assert(da.activities.every((a) => !a.active), 'no activity active by default');
assert(engine.startActivity(engine.defaultState(), 'nope').ok === false, 'unknown activity rejected');

console.log('roster and motivation tests');

const spritesMod = require('../src/pet/sprites');
assert(spritesMod.getPetById('raja').country === 'India', 'Raja (India) is in the roster');
assert(spritesMod.getPetById('nila').country === 'India', 'Nila (India) is in the roster');
const requestedIds = ['pad_thai', 'bamboo_stalks', 'halo_halo', 'pandesal', 'mango_sticky_rice', 'pho_bowl', 'nasi_lemak', 'satay', 'kaya_toast', 'samosa', 'butter_chicken'];
assert(requestedIds.every((id) => !!engine.FOODS[id]), 'all requested delicacies exist');
assert(requestedIds.every((id) => engine.FOODS[id].cost >= 0 && engine.FOODS[id].hunger > 0), 'delicacies have valid stats');

const motivation = require('../src/pet/motivation');
const langMap = motivation.COUNTRY_LANG_MAP;
assert(Object.keys(langMap).length >= 11, 'language map covers 11+ countries');
assert(motivation.fallbackEvent({ name: 'Raja', country: 'India', flag: 'in' }).native.length > 0, 'fallback quote for India');
assert(motivation.fallbackEvent({ name: 'Chai', country: 'Thailand' }).romanization.length > 0, 'fallback quote romanization for Thai');
assert(langMap['Philippines'].needsRomanization === false, 'Tagalog needs no romanization');
assert(langMap['Japan'].needsRomanization === true, 'Japanese needs romanization');

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
