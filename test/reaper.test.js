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

console.log('reaper (Juan Bungo) tests');

{
  const s = engine.defaultState();
  s.pet.species = 'kala';
  s.pet.stage = 'baby';
  s.coins = 12345;
  s.meters = { hunger: 0, energy: 0, happiness: 0 };
  s.home.owned.push('cozy_bed');
  s.home.wall = 'wall_pastel_cream';
  s.achievements.push('first_feed');
  const res = engine.reaperReset(s);
  assert(res && res.ok, 'reaperReset returns ok');
  assert(s.coins === 20, 'coins reset to 20');
  assert(s.meters.hunger === 80 && s.meters.energy === 90 && s.meters.happiness === 85, 'meters reset to fresh defaults');
  assert(s.pet.stage === 'egg' && !s.pet.species, 'pet back to fresh egg');
  assert(Array.isArray(s.home.owned) && s.home.owned.length === 0, 'home furniture wiped');
  assert(s.home.wall === 'classic', 'wall reset to classic');
  assert(s.achievements.length === 0, 'achievements wiped');
  assert(s.activity === null, 'activity cleared');
}

{
  const s = engine.defaultState();
  const res = engine.reaperReset(s);
  assert(res && res.ok, 'reaperReset is allowed even while alive (reaper-only action)');
  assert(engine.reaperReset !== engine.newGame, 'reaperReset is distinct from newGame');
}

{
  // saveLayout still whitelists the draggable door
  const s = engine.defaultState();
  const res = engine.homeAction(s, { op: 'saveLayout', layout: { door: { x: 263, y: 213 }, cozy_bed: { x: 96, y: 352 }, junk: { x: 1, y: 1 } } });
  assert(res.ok, 'saveLayout ok');
  assert(s.home.layout.door && s.home.layout.door.x === 263 && s.home.layout.door.y === 213, 'door position persisted');
  assert(!s.home.layout.junk, 'unknown layout keys rejected');
  const clamped = engine.homeAction(s, { op: 'saveLayout', layout: { door: { x: 9999, y: -5 } } });
  assert(clamped.ok && s.home.layout.door.x === 400 && s.home.layout.door.y === 150, 'door clamped to stage bounds');
}

console.log(`reaper tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
