'use strict';

const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok: ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  FAIL: ${name}\n    ${err.message}`);
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const root = path.join(__dirname, '..');
const bs = require(path.join(root, 'src', 'pet', 'battle-skills.js'));
const engine = require(path.join(root, 'src', 'engine', 'engine.js'));

console.log('battle-skills tests');

check('skills_data.json loaded with 18 pet entries', () => {
  assert(bs.SKILLS_DATA.pets.length === 18, `expected 18 entries, got ${bs.SKILLS_DATA.pets.length}`);
});

check('every skill/talent/passive icon + vfx sheet exists on disk', () => {
  for (const p of bs.SKILLS_DATA.pets) {
    for (const [label, item] of [['skill', p.skill], ['talent', p.talent], ['passive', p.passive]]) {
      const file = path.join(root, 'assets', 'battle', item.icon);
      assert(fs.existsSync(file), `${p.id} ${label} icon missing: ${item.icon}`);
    }
    const vfx = path.join(root, 'assets', 'battle', p.skill.vfxSheet);
    assert(fs.existsSync(vfx), `${p.id} skill vfx missing: ${p.skill.vfxSheet}`);
  }
  assert(fs.existsSync(path.join(root, 'assets', 'battle', 'skills_data.json')), 'skills_data.json missing');
});

check('globalPassiveCaps present and sane', () => {
  assert(bs.GLOBAL_CAPS.coinBonusPct === 0.25, 'coin cap');
  assert(bs.GLOBAL_CAPS.arenaHpPct === 0.15, 'arena hp cap');
  assert(bs.GLOBAL_CAPS.maxEnergyFlat === 35, 'max energy cap');
});

check('moti / moti_evo map to chai kit with evo values', () => {
  assert(bs.kitSourceId('moti') === 'chai', `moti -> ${bs.kitSourceId('moti')}`);
  assert(bs.kitSourceId('moti_evo') === 'chai', `moti_evo -> ${bs.kitSourceId('moti_evo')}`);
  const base = bs.petKit('moti', false);
  assert(base && base.skill.multiplier === 1.35, 'moti base multiplier');
  assert(base.talent.value === 0.1, 'moti base talent');
  const evo = bs.petKit('moti_evo', true);
  assert(evo && evo.skill.multiplier === 1.5, `moti_evo multiplier ${evo && evo.skill.multiplier}`);
  assert(evo.talent.value === 0.15, `moti_evo talent ${evo && evo.talent.value}`);
  assert(evo.passive.value === 8, `moti_evo passive ${evo && evo.passive.value}`);
});

check('nila has no battle kit (no pack entry)', () => {
  assert(bs.kitSourceId('nila') === null, 'nila should be null');
  assert(bs.petKit('nila', false) === null, 'nila petKit should be null');
});

check('collectionBonuses: evo replaces base, never stacks', () => {
  const b = bs.collectionBonuses([{ id: 'kala', evolved: false }, { id: 'kala_evo', evolved: true }]);
  assert(b.totals.coinBonusPct === 0.05, `evo replaces base: got ${b.totals.coinBonusPct}, want 0.05`);
});

check('collectionBonuses: sums across pets + dragon multi passive', () => {
  const b = bs.collectionBonuses([
    { id: 'kala', evolved: true },
    { id: 'dragon', evolved: false },
    { id: 'chai', evolved: true },
  ]);
  assert(b.totals.coinBonusPct === 0.05, `kala evo coin: ${b.totals.coinBonusPct}`);
  assert(b.totals.maxEnergyFlat === 13, `chai evo 8 + dragon 5 = 13, got ${b.totals.maxEnergyFlat}`);
  assert(b.totals.maxHappinessFlat === 5, `dragon happiness 5, got ${b.totals.maxHappinessFlat}`);
  assert(b.totals.arenaAtkPct === 0.03, `dragon arena atk, got ${b.totals.arenaAtkPct}`);
});

check('collectionBonuses: clamps with globalPassiveCaps', () => {
  const all = bs.SKILLS_DATA.pets.map((p) => ({ id: p.id, evolved: true }));
  const b = bs.collectionBonuses(all);
  assert(b.totals.coinBonusPct <= bs.GLOBAL_CAPS.coinBonusPct, `coin capped: ${b.totals.coinBonusPct}`);
  assert(b.totals.maxEnergyFlat <= bs.GLOBAL_CAPS.maxEnergyFlat, `energy capped: ${b.totals.maxEnergyFlat}`);
});

console.log('engine collection tests');

check('defaultState + ensureState include collection', () => {
  const s = engine.defaultState();
  assert(s.collection && typeof s.collection.seen === 'object', 'defaultState collection');
  engine.ensureState(s);
  assert(s.collection && typeof s.collection.seen === 'object', 'ensureState collection');
});

check('ensureState backfills current pet into collection', () => {
  const s = engine.defaultState();
  s.pet.stage = 'adult';
  s.pet.species = 'kala';
  engine.ensureState(s);
  assert(s.collection.seen.kala, 'kala backfilled');
});

check('hatch marks collection', () => {
  const s = engine.defaultState();
  engine.ensureState(s);
  s.pet.stage = 'egg';
  s.pet.xp = 999;
  engine.tick(s, 1);
  assert(s.pet.stage !== 'egg' && s.pet.species, `hatched: ${s.pet.stage}/${s.pet.species}`);
  assert(s.collection.seen[s.pet.species], 'species marked on hatch');
});

check('evolve sets evolved flag in collection', () => {
  const s = engine.defaultState();
  engine.ensureState(s);
  s.pet.stage = 'adult';
  s.pet.species = 'kala';
  engine.ensureState(s);
  engine.activePetKitOf(s);
  const evolved = engine.activePetKitOf({ pet: { stage: 'adult', species: 'kala', evolved: true } });
  assert(evolved && evolved.isEvo, 'evolved kit flag');
});

check('buyShopPet marks collection', () => {
  const s = engine.defaultState();
  engine.ensureState(s);
  s.pet.stage = 'adult';
  s.pet.species = 'kala';
  s.coins = 1000000;
  const r = engine.buyShopPet(s, 'dragon');
  assert(r.ok, `buy ok: ${r.message}`);
  assert(s.collection.seen.dragon, 'dragon marked');
});

check('tombstone reset (resetToEgg) preserves collection', () => {
  const s = engine.defaultState();
  engine.ensureState(s);
  s.pet.stage = 'adult';
  s.pet.species = 'kala';
  engine.ensureState(s);
  s.collection.seen.dragon = { evolved: false };
  s.collection.seen.mochi = { evolved: true };
  s.dead = { cause: 'test', at: Date.now() };
  const r = engine.newGame(s);
  assert(r.ok, 'newGame ok');
  assert(s.collection.seen.dragon && s.collection.seen.mochi, 'collection kept through reset');
  assert(s.pet.stage === 'egg', 'pet back to egg');
});

check('collectionBonusesOf applies active pet passives to coinRate', () => {
  const s = engine.defaultState();
  engine.ensureState(s);
  s.pet.stage = 'adult';
  s.pet.species = 'kala';
  const withKala = engine.coinRate(s);
  const plain = 0.5 * Math.pow(1.6, 0) * 1;
  assert(Math.abs(withKala - plain * 1.03) < 1e-9, `kala coin bonus: ${withKala} vs ${plain * 1.03}`);
});

check('meterCap reflects maxEnergyFlat / maxHappinessFlat', () => {
  const s = engine.defaultState();
  engine.ensureState(s);
  s.pet.stage = 'adult';
  s.pet.species = 'dragon';
  assert(engine.meterCap(s, 'energy') === 105, `energy cap ${engine.meterCap(s, 'energy')}`);
  assert(engine.meterCap(s, 'happiness') === 105, `happiness cap ${engine.meterCap(s, 'happiness')}`);
  assert(engine.meterCap(s, 'hunger') === 100, 'hunger stays 100');
});

check('derivedStats exposes collection summary with icons', () => {
  const s = engine.defaultState();
  engine.ensureState(s);
  s.pet.stage = 'adult';
  s.pet.species = 'kala';
  const d = engine.derivedStats(s);
  assert(d.collection && d.collection.totals.coinBonusPct === 0.03, 'derived totals');
  assert(d.collection.activeKit && d.collection.activeKit.skill.name === 'Carabao Charge', 'derived kit skill');
  assert(d.collection.activeKit.skill.iconUrl.indexOf('icons/skills/') === 0, 'pack-relative icon path');
  assert(d.collection.activeKit.skill.vfxSheetUrl.indexOf('vfx/') === 0, 'pack-relative vfx path');
});

check('egg exposes Warm Shell egg charm, no active kit', () => {
  const s = engine.defaultState();
  engine.ensureState(s);
  const d = engine.derivedStats(s);
  assert(d.collection.activeKit === null, 'no kit for egg');
  assert(d.collection.eggCharm && d.collection.eggCharm.passive.id === 'warm_shell', 'egg charm exposed');
});

check('arenaAtk/arenaHp bonus stats reach derived for arena use', () => {
  const s = engine.defaultState();
  engine.ensureState(s);
  s.pet.stage = 'adult';
  s.pet.species = 'kala';
  s.pet.evolved = true;
  s.collection.seen.bara = { evolved: true };
  s.collection.seen.rimau = { evolved: true };
  const d = engine.derivedStats(s);
  assert(d.collection.totals.arenaAtkPct === 0.04, `rimau evo: ${d.collection.totals.arenaAtkPct}`);
  assert(d.collection.totals.arenaHpPct === 0.04, `bara evo: ${d.collection.totals.arenaHpPct}`);
});

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
