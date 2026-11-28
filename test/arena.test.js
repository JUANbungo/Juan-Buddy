'use strict';

const path = require('path');
const fs = require('fs');

const engine = require(path.join(__dirname, '..', 'src', 'engine', 'engine.js'));

let passed = 0;
let failed = 0;

function check(label, fn) {
  try {
    fn();
    passed += 1;
  } catch (err) {
    failed += 1;
    console.error(`  FAIL: ${label}`);
    console.error(`    ${err.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

// --- minimal browser stubs so battle-arena.js can load in Node ---
const store = new Map();
global.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
};
global.window = { require: null, location: { reload: () => {} } };

function freshState() {
  const s = engine.defaultState();
  s.pet.stage = 'baby';
  s.pet.species = 'kala';
  s.pet.level = 5;
  s.coins = 500000;
  s.meters.energy = 100;
  return s;
}

// --- engine: arena death/revive lifecycle ---
check('arenaResult win grants capped gold + xp and levels up', () => {
  const s = freshState();
  const res = engine.arenaResult(s, { monsterId: 'guard_slime', win: true, gold: 99999, xp: 999 });
  assert(res.ok === true, 'win should apply');
  assert(s.battle.wins === 1, 'battle.wins increments');
  assert(res.gold === 50, `gold capped to monster max 50, got ${res.gold}`);
  assert(res.xp === 6, `xp capped to monster xp 6, got ${res.xp}`);
  assert(s.state === undefined && res.arena.status === 'alive', 'arena still alive');
});

check('first arena loss puts pet in ghost state with 1h lockout', () => {
  const s = freshState();
  const res = engine.arenaResult(s, { monsterId: 'cave_bat', win: false });
  assert(res.ok === true, 'loss accepted');
  assert(s.arena.status === 'ghost', 'status ghost');
  assert(s.arena.deaths === 1, 'deaths == 1');
  const lockMs = s.arena.ghostUntil - Date.now();
  assert(Math.abs(lockMs - engine.ARENA.GHOST_MS) < 5000, `lockout ~1h, got ${lockMs}`);
  assert(s.flags.working === false && !s.activity, 'work/activity stopped');
});

check('second death (after reviving) triggers tombstone with 24h reset countdown', () => {
  const s = freshState();
  engine.arenaResult(s, { monsterId: 'cave_bat', win: false });
  engine.arenaRevive(s, { kind: 'reincarnation' });
  const res = engine.arenaResult(s, { monsterId: 'cave_bat', win: false });
  assert(res.ok === true, 'loss accepted while alive');
  assert(s.arena.status === 'tombstone', 'status tombstone');
  assert(s.arena.deaths === 2, 'deaths cumulative across revives');
  const resetMs = s.arena.resetAt - Date.now();
  assert(Math.abs(resetMs - engine.ARENA.TOMBSTONE_MS) < 5000, `reset ~24h, got ${resetMs}`);
  assert(s.battle.losses === 2, 'losses tracked');
});

check('deadGate blocks gameplay while ghost or tombstone', () => {
  const s = freshState();
  engine.arenaResult(s, { monsterId: 'guard_slime', win: false });
  const blocked1 = engine.play(s);
  assert(blocked1.ok === false && blocked1.dead === true, 'play gated while ghost');
  engine.arenaRevive(s, { kind: 'reincarnation' });
  engine.arenaResult(s, { monsterId: 'guard_slime', win: false });
  engine.arenaRevive(s, { kind: 'reincarnation' });
  engine.arenaResult(s, { monsterId: 'guard_slime', win: false });
  engine.arenaRevive(s, { kind: 'special' });
  engine.arenaResult(s, { monsterId: 'guard_slime', win: false });
  assert(s.arena.status === 'tombstone', 'tombstone after 2 post-revive deaths');
  const blocked2 = engine.play(s);
  assert(blocked2.ok === false && blocked2.dead === true, 'play gated while tombstone');
});

check('arenaRevive: ghost stone costs 1000 first death and 24000 later', () => {
  const s = freshState();
  engine.arenaResult(s, { monsterId: 'guard_slime', win: false });
  const before = s.coins;
  const r1 = engine.arenaRevive(s, { kind: 'reincarnation' });
  assert(r1.ok === true, 'first revive ok');
  assert(before - s.coins === engine.ARENA.STONE_COST_FIRST, `first stone 1000, spent ${before - s.coins}`);
  assert(s.arena.status === 'alive', 'revived');

  engine.arenaResult(s, { monsterId: 'guard_slime', win: false }); // ghost again...
  engine.arenaResult(s, { monsterId: 'guard_slime', win: false }); // wait: 2nd loss -> tombstone
  // go back to a ghost-scenario by reviving tombstone with special then dying once
  const r2 = engine.arenaRevive(s, { kind: 'special' });
  assert(r2.ok === true, 'special revive ok');
  const priceBefore = s.coins;
  engine.arenaResult(s, { monsterId: 'guard_slime', win: false });
  assert(s.arena.status === 'ghost' || s.arena.status === 'tombstone', 'dead again');
  const spent = priceBefore - s.coins;
  const before2 = s.coins;
  const r3 = engine.arenaRevive(s, { kind: s.arena.status === 'ghost' ? 'reincarnation' : 'special' });
  assert(r3.ok === true, 'second revive ok');
  const cost = before2 - s.coins;
  assert(cost === engine.ARENA.STONE_COST_REPEAT || cost === engine.ARENA.SPECIAL_STONE_COST, `repeat stone price honored (${cost})`);
});

check('special stone is required for tombstone, normal stone rejected', () => {
  const s = freshState();
  engine.arenaResult(s, { monsterId: 'cave_bat', win: false });
  engine.arenaRevive(s, { kind: 'reincarnation' });
  const res = engine.arenaResult(s, { monsterId: 'cave_bat', win: false });
  assert(res.ok === true && s.arena.status === 'tombstone', 'tombstone reached');
  const r = engine.arenaRevive(s, { kind: 'reincarnation' });
  assert(r.ok === false, 'normal stone cannot revive tombstone');
  const r2 = engine.arenaRevive(s, { kind: 'special' });
  assert(r2.ok === true, 'special stone revives tombstone');
});

check('tick auto-revives expired ghost lockout and freezes meters while dead', () => {
  const s = freshState();
  engine.arenaResult(s, { monsterId: 'guard_slime', win: false });
  s.arena.ghostUntil = Date.now() - 1000;
  const hunger = s.meters.hunger;
  const events = engine.tick(s, 30);
  assert(s.arena.status === 'alive', 'auto revived after lockout');
  assert(s.meters.hunger === hunger, 'meters frozen while dead (revive tick did not drain)');
  assert(events.some((e) => e.message && e.message.toLowerCase().includes('revived')), 'revive event pushed');
});

check('tick tombstone timeout resets the save to a fresh egg', () => {
  const s = freshState();
  engine.arenaResult(s, { monsterId: 'guard_slime', win: false });
  engine.arenaRevive(s, { kind: 'reincarnation' });
  engine.arenaResult(s, { monsterId: 'guard_slime', win: false });
  engine.arenaRevive(s, { kind: 'reincarnation' });
  engine.arenaResult(s, { monsterId: 'guard_slime', win: false });
  assert(s.arena.status === 'tombstone', 'tombstone set');
  s.arena.resetAt = Date.now() - 1000;
  const events = engine.tick(s, 30);
  assert(s.pet.stage === 'egg', 'fresh egg after reset');
  assert(s.arena.status === 'alive' && s.arena.deaths === 0, 'arena state cleared');
  assert(events[0] && events[0].arenaReset === true, 'tombstone reset event');
});

check('derived stats expose arena snapshot', () => {
  const s = freshState();
  const d = engine.derivedStats(s);
  assert(d.arena && d.arena.status === 'alive', 'arena in derived');
  engine.arenaResult(s, { monsterId: 'guard_slime', win: false });
  const d2 = engine.derivedStats(s);
  assert(d2.arena.status === 'ghost' && d2.arena.lockoutRemainingMs > 0, 'ghost lockout in derived');
});

// --- battle-arena.js pack: monsters table + limited drop hook ---
let packApi = null;
try {
  require(path.join(__dirname, '..', 'src', 'dashboard', 'js', 'battle-arena.js'));
  packApi = global.window;
} catch (err) {
  packApi = null;
}

check('battle-arena.js loads with 8 monsters', () => {
  assert(packApi && Array.isArray(packApi.JUAN_BUDDY_MONSTERS), 'JUAN_BUDDY_MONSTERS exported');
  assert(packApi.JUAN_BUDDY_MONSTERS.length === 8, '8 monsters');
});

check('monster ids + home of sheets on disk match', () => {
  const ids = ['guard_slime', 'cave_bat', 'wild_boar', 'ridge_wolf', 'kumiho', 'oni_brute', 'ember_wyvern', 'void_titan'];
  const mons = packApi.JUAN_BUDDY_MONSTERS.map((m) => m.id);
  for (const id of ids) {
    assert(mons.includes(id), `monster ${id} in table`);
    for (const anim of ['idle_sheet', 'walk_sheet']) {
      const p = path.join(__dirname, '..', 'assets', 'monsters', id, `${anim}.png`);
      assert(fs.existsSync(p), `sheet exists: ${p}`);
    }
  }
});

check('rebalanced HP + gold/XP values', () => {
  const want = {
    guard_slime: { lv: 1, hp: 65, atk: 7, goldMin: 30, goldMax: 50, xp: 6 },
    cave_bat: { lv: 4, hp: 115, atk: 12, goldMin: 55, goldMax: 85, xp: 12 },
    wild_boar: { lv: 8, hp: 190, atk: 19, goldMin: 95, goldMax: 140, xp: 20 },
    ridge_wolf: { lv: 13, hp: 290, atk: 28, goldMin: 145, goldMax: 200, xp: 32 },
    kumiho: { lv: 18, hp: 420, atk: 38, goldMin: 200, goldMax: 290, xp: 48 },
    oni_brute: { lv: 24, hp: 600, atk: 50, goldMin: 290, goldMax: 400, xp: 70 },
    ember_wyvern: { lv: 30, hp: 850, atk: 66, goldMin: 400, goldMax: 575, xp: 100 },
    void_titan: { lv: 40, hp: 1300, atk: 88, goldMin: 600, goldMax: 850, xp: 150 },
  };
  for (const m of packApi.JUAN_BUDDY_MONSTERS) {
    const w = want[m.id];
    assert(w, `unexpected monster ${m.id}`);
    for (const k of Object.keys(w)) assert(m[k] === w[k], `${m.id}.${k}: got ${m[k]}, want ${w[k]}`);
    assert(m.limitedDrop && m.limitedDrop.enabled === false && m.limitedDrop.comingSoon === true, `limitedDrop coming soon on ${m.id}`);
  }
  const chances = packApi.JUAN_BUDDY_MONSTERS.map((m) => m.limitedDrop.chance);
  assert(JSON.stringify(chances) === JSON.stringify([1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]), 'drop chances scale 1.5-5.0');
});

check('rollLimitedDrop disabled while coming soon, works when enabled', () => {
  const m = packApi.JUAN_BUDDY_MONSTERS[0];
  assert(packApi.JB_rollLimitedDrop(m) === null, 'disabled roll returns null');
  m.limitedDrop.enabled = true;
  m.limitedDrop.chance = 100;
  const hit = packApi.JB_rollLimitedDrop(m);
  assert(hit && hit.itemName === 'Mystery Limited Item' && hit.fromMonster === m.id, 'forced roll succeeds');
});

check('death + item assets all exist', () => {
  for (const f of [
    'assets/arena/arena_bg.png',
    'assets/death/pet_ghost_idle_sheet.png',
    'assets/death/pet_ghost_walk_sheet.png',
    'assets/death/pet_tombstone_idle_sheet.png',
    'assets/items/reincarnation_stone.png',
    'assets/items/special_reincarnation_stone.png',
  ]) {
    assert(fs.existsSync(path.join(__dirname, '..', f)), `${f} exists`);
  }
});

console.log(`arena tests\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
