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

console.log('home & farm tests');

{
  const s = engine.defaultState();
  assert(s.home && s.home.wall === 'classic', 'default wall is classic');
  assert(Array.isArray(s.home.owned) && s.home.owned.length === 0, 'no furniture owned by default');
  assert(s.farm && Array.isArray(s.farm.plots) && s.farm.plots.length === 6, '6 farm plots by default');
  assert(s.farm.fertilizer === 1, 'starts with 1 fertilizer');
}

{
  const s = engine.defaultState();
  s.coins = 1000;
  const buy = engine.homeAction(s, { op: 'buyFurniture', itemId: 'flower_vase' });
  assert(buy.ok && s.home.owned.includes('flower_vase'), 'flower vase purchasable');
  assert(s.coins === 880, 'flower vase costs 120');
  const again = engine.homeAction(s, { op: 'buyFurniture', itemId: 'flower_vase' });
  assert(!again.ok && s.coins === 880, 'furniture is one-time purchase');
  const buyBed = engine.homeAction(s, { op: 'buyFurniture', itemId: 'cozy_bed' });
  assert(buyBed.ok && s.upgrades.bed === engine.UPGRADES.bed.max, 'cozy bed purchase grants max bed upgrade stats');
  const buyToys = engine.homeAction(s, { op: 'buyFurniture', itemId: 'toy_box' });
  assert(buyToys.ok && s.upgrades.toys === engine.UPGRADES.toys.max, 'toy box purchase grants max toys upgrade stats');
  const wall = engine.homeAction(s, { op: 'setWall', wallId: 'wall_sky_clouds' });
  assert(wall.ok && s.home.wall === 'wall_sky_clouds', 'wall switch works');
  const badWall = engine.homeAction(s, { op: 'setWall', wallId: 'nope' });
  assert(!badWall.ok && s.home.wall === 'wall_sky_clouds', 'invalid wall rejected');
  const save = engine.homeAction(s, { op: 'saveLayout', layout: { flower_vase: { x: 200, y: 300 }, junk: { x: -999, y: 999 } } });
  assert(save.ok, 'layout save ok');
  assert(s.home.layout.flower_vase.x === 200 && !s.home.layout.junk, 'layout clamped and unknown items dropped');
}

{
  const s = engine.defaultState();
  s.coins = 500;
  const dead = engine.defaultState();
  dead.arena.status = 'ghost';
  dead.arena.ghostUntil = Date.now() + 3600000;
  assert(!engine.homeAction(dead, { op: 'setWall', wallId: 'classic' }).ok, 'dead pets cannot edit home');
  assert(!engine.farmAction(dead, { op: 'plant', plot: 0, cropId: 'berry' }).ok, 'dead pets cannot farm');

  const plant = engine.farmAction(s, { op: 'plant', plot: 0, cropId: 'berry' });
  assert(plant.ok && s.coins === 480, 'berry seeds cost 20');
  const dup = engine.farmAction(s, { op: 'plant', plot: 0, cropId: 'berry' });
  assert(!dup.ok, 'occupied plot rejects planting');

  assert(Object.values(engine.FARM_CROPS).every((c) => c.growMs === 5 * 60000), 'every crop grows in 5 minutes');

  const grew = { ...s.farm.plots[0], plantedAt: Date.now() - 3 * 60000 };
  s.farm.plots[0] = grew;
  const prog = engine.farmProgressOf(grew, s.farm, Date.now());
  assert(prog > 0.55 && prog < 0.65, '3 minutes of a 5 minute crop is ~60%');
  assert(grew.readyAt === undefined, 'growing crop has no readyAt yet');

  engine.farmAction(s, { op: 'water', plot: 0 });
  const progWet = engine.farmProgressOf(s.farm.plots[0], s.farm, Date.now());
  assert(progWet >= 1, 'watering doubles elapsed growth');

  const harvestWatered = engine.farmAction(s, { op: 'harvest', plot: 0 });
  assert(harvestWatered.ok, 'watered crop can be harvested');

  s.farm.plots[1] = { cropId: 'plant', plantedAt: Date.now() - 60000, watered: false };
  const fert = engine.farmAction(s, { op: 'fertilize', plot: 1 });
  assert(fert.ok && s.farm.fertilizer === 0, 'fertilizer consumed');
  assert(engine.farmProgressOf(s.farm.plots[1], s.farm, Date.now()) >= 1, 'fertilizer makes crop ready');

  s.farm.harvests = 0;
  s.farm.snacks = 0;
  s.farm.eco = 0;
  const xpBefore = s.pet.xp;
  const harvest = engine.farmAction(s, { op: 'harvest', plot: 1 });
  assert(harvest.ok && s.farm.harvests === 1, 'harvest succeeds');
  assert(s.coins > 480, 'harvest pays coins');
  assert(s.pet.xp > xpBefore, 'harvest grants xp');
  assert(s.farm.snacks === 2, 'plant yields 2 snacks');
  assert(s.farm.eco === 7, 'plant yields 7 eco');
  assert(!s.farm.plots[1], 'plot cleared after harvest');

  const hive = engine.farmAction(s, { op: 'buyBeehive' });
  assert(hive.ok && s.farm.beehive, 'beehive purchasable');
  const again = engine.farmAction(s, { op: 'buyBeehive' });
  assert(!again.ok, 'beehive is one-time');

  s.coins = 100;
  assert(engine.farmAction(s, { op: 'buyFertilizer' }).ok && s.farm.fertilizer === 1, 'fertilizer purchasable');

  s.farm.snacks = 2;
  s.meters.hunger = 50;
  const snack = engine.farmAction(s, { op: 'eatSnack' });
  assert(snack.ok && s.farm.snacks === 1 && s.meters.hunger > 50, 'harvested snack feeds the pet for free');

  s.farm.plots[2] = { cropId: 'berry', plantedAt: Date.now() - 12 * 60000, watered: false };
  const ready = engine.farmProgressOf(s.farm.plots[2], s.farm, Date.now());
  assert(ready >= 1 && typeof s.farm.plots[2].readyAt === 'number', 'ready crop stamps a backdated readyAt');
  assert(Date.now() - s.farm.plots[2].readyAt > 6 * 60000, 'backdated readyAt reflects time since ready');

  s.farm.plots[3] = { cropId: 'berry', plantedAt: Date.now() - 12 * 60000, watered: false, readyAt: Date.now() - 6 * 60000 };
  const wiltHarvest = engine.farmAction(s, { op: 'harvest', plot: 3 });
  assert(!wiltHarvest.ok && !s.farm.plots[3], 'harvesting a wilted crop fails and clears the plot');

  s.farm.plots[4] = { cropId: 'flower', plantedAt: Date.now() - 12 * 60000, watered: false, readyAt: Date.now() - 6 * 60000 };
  const wiltWater = engine.farmAction(s, { op: 'water', plot: 4 });
  assert(!wiltWater.ok && !s.farm.plots[4], 'wilted crop cannot be watered and gets auto-cleared');

  s.farm.plots[5] = { cropId: 'flower', plantedAt: Date.now() - 12 * 60000, watered: false, readyAt: Date.now() - 6 * 60000 };
  engine.ensureHomeFarm(s);
  assert(!s.farm.plots[5], 'ensureHomeFarm clears wilted plots');

  const freshPlot = { cropId: 'berry', plantedAt: Date.now() - 60000, watered: false };
  engine.ensureHomeFarm({ ...s, farm: { ...s.farm, plots: [freshPlot, null, null, null, null, null] } });
  assert(!freshPlot.readyAt, 'ensureHomeFarm keeps growing crops untouched');
}

{
  const s = engine.defaultState();
  s.home = { wall: 'bogus', owned: ['ghost_item', 'cozy_bed'], layout: null };
  s.farm = { plots: [{ cropId: 'mystery', plantedAt: 'x' }, null, null], beehive: 'yes', fertilizer: -5 };
  s.upgrades.bed = 0;
  s.upgrades.toys = 0;
  engine.ensureHomeFarm(s);
  assert(s.home.wall === 'classic', 'bogus wall resets to classic');
  assert(s.upgrades.bed === engine.UPGRADES.bed.max, 'owned cozy bed backfills max bed upgrade for old saves');
  assert(s.upgrades.toys === 0, 'unowned toy box keeps old upgrade level');
  assert(s.home.owned.length === 1 && s.home.owned[0] === 'cozy_bed', 'unknown furniture filtered');
  assert(s.farm.plots.length === 6, 'plots normalized to 6');
  assert(!s.farm.plots[0], 'invalid plot cleared');
  assert(s.farm.beehive === true && s.farm.fertilizer === 0, 'farm scalars normalized');
}

console.log(`home & farm tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
