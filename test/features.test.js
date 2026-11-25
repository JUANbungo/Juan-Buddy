'use strict';

const path = require('path');

global.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
global.atob = (s) => Buffer.from(s, 'base64').toString('binary');
global.document = {
  getElementById: () => null,
  createElement: () => ({
    getContext: () => new Proxy({}, { get: () => () => ({}) }),
    width: 0,
    height: 0,
  }),
};

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

function fastForwardToHatch(state) {
  state.pet.xp = 13;
  engine.feed(state, 'pandesal');
  engine.tick(state, 1, false);
}

console.log('features.test.js');

check('new game starts as egg with no species', () => {
  const s = engine.defaultState();
  assert(s.pet.stage === 'egg', `stage=${s.pet.stage}`);
  assert(s.pet.species === null, 'species should be null in egg stage');
});

check('egg hatches at xp >= 14 into a random roster species', () => {
  const s = engine.defaultState();
  fastForwardToHatch(s);
  assert(s.pet.stage !== 'egg', 'should have hatched');
  assert(s.pet.level >= 2, `level=${s.pet.level}`);
  assert(typeof s.pet.species === 'string' && s.pet.species.length > 0, 'species should be set');
});

check('hatch queues a stage event message', () => {
  const s = engine.defaultState();
  state_wait(s);
  function state_wait(st) {
    st.pet.xp = 13;
    engine.feed(st, 'pandesal');
  }
  const events = engine.tick(s, 1, false);
  const joined = JSON.stringify(events);
  assert(joined.includes('atched') || joined.includes('AMAZING'), `no hatch event: ${joined}`);
});

check('level-ups only move stages upward (adult never demotes to egg)', () => {
  const s = engine.defaultState();
  s.pet.stage = 'adult';
  s.pet.level = 2;
  engine.applyLevelUps ? engine.applyLevelUps(s) : null;
  assert(s.pet.stage === 'adult', `stage=${s.pet.stage}`);
});

check('neglect to death while app active (non-egg)', () => {
  const s = engine.defaultState();
  s.pet.stage = 'baby';
  s.pet.species = 'kala';
  s.meters.hunger = 0;
  s.meters.energy = 0;
  const events = engine.tick(s, engine.DEATH_SECONDS + 5, false);
  assert(s.dead, 'pet should be dead');
  assert(s.dead.cause === 'starvation' || s.dead.cause === 'exhaustion', `cause=${s.dead && s.dead.cause}`);
  assert(JSON.stringify(events).indexOf('assed away') !== -1, 'death event should fire');
});

check('egg is immune to neglect death', () => {
  const s = engine.defaultState();
  s.meters.hunger = 0;
  s.meters.energy = 0;
  engine.tick(s, engine.DEATH_SECONDS + 5, false);
  assert(!s.dead, 'egg should not die');
});

check('dead gates all care actions', () => {
  const s = engine.defaultState();
  s.pet.stage = 'adult';
  s.pet.species = 'kala';
  s.dead = { cause: 'starvation', at: Date.now(), level: 5, species: 'kala' };
  for (const [name, res] of [
    ['feed', engine.feed(s, 'pandesal')],
    ['play', engine.play(s)],
    ['pat', engine.petPat(s)],
    ['toggleWork', engine.toggleWork(s)],
    ['toggleSleep', engine.toggleSleep(s)],
  ]) {
    assert(res && res.ok === false, `${name} should be gated when dead`);
  }
});

check('claimDaily streak advances once per day', () => {
  const s = engine.defaultState();
  const first = engine.claimDaily(s);
  assert(first.ok === true, 'first claim should succeed');
  const again = engine.claimDaily(s);
  assert(again.ok === false, 'second same-day claim should fail');
  assert(s.daily.streak === 1, `streak=${s.daily.streak}`);
  const y = new Date(Date.now() - 86400000);
  s.daily.last = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
  const next = engine.claimDaily(s);
  assert(next.ok === true, 'claim on the next day should succeed');
  assert(s.daily.streak === 2, `streak after yesterday claim=${s.daily.streak}`);
});

check('save code round-trips through export/import', () => {
  const a = engine.defaultState();
  a.pet.stage = 'adult';
  a.pet.species = 'bao';
  a.pet.level = 12;
  a.pet.name = 'RoundTrip';
  a.coins = 777;
  const code = engine.saveCode(a);
  assert(code.startsWith('JB2.'), `code=${code.slice(0, 8)}...`);
  const parsed = engine.parseSaveCode(code);
  assert(parsed && parsed.pet && parsed.pet.name === 'RoundTrip', 'parsed pet name mismatch');
  assert(parsed.pet.species === 'bao', 'parsed species mismatch');
  assert(parsed.coins === 777, 'parsed coins mismatch');
  const b = engine.defaultState();
  const res = engine.importSave(b, code);
  assert(res.ok === true, `import failed: ${res.message}`);
  assert(b.pet.name === 'RoundTrip' && b.pet.stage === 'adult', 'imported state mismatch');
});

check('parseSaveCode rejects garbage', () => {
  assert(engine.parseSaveCode('not-a-code') === null, 'garbage should parse to null');
  const res = engine.importSave(engine.defaultState(), 'JB2.!!!notb64!!!');
  assert(res.ok === false, 'import of garbage should fail gracefully');
});

check('newGame keeps achievements and skins but resets pet', () => {
  const s = engine.defaultState();
  s.dead = { cause: 'starvation', at: Date.now(), level: 8, species: 'mochi' };
  s.pet.name = 'Ghost';
  s.achievements = ['first_feed', 'level_10'];
  s.skinsOwned = ['golden'];
  const res = engine.newGame(s);
  assert(res.ok === true, `newGame failed: ${res.message}`);
  assert(s.pet.stage === 'egg' && s.pet.species === null, 'pet should reset to egg');
  assert(s.pet.name === 'Buddy', 'pet name should reset');
  assert(JSON.stringify(s.achievements) === JSON.stringify(['first_feed', 'level_10']), 'achievements should persist');
  assert(JSON.stringify(s.skinsOwned) === JSON.stringify(['golden']), 'skins should persist');
  assert(!s.dead, 'death should be cleared');
});

check('derivedStats exposes stage/phase/weather/daily/skins/danger/dead', () => {
  const s = engine.defaultState();
  const d = engine.derivedStats(s);
  assert(d.stage && d.stage.id === 'egg' && d.stage.next, 'stage derived missing');
  assert(d.phase && d.phase.tint, 'phase derived missing');
  assert(d.weather && d.weather.id, 'weather derived missing');
  assert(d.daily && typeof d.daily.nextReward === 'number', 'daily derived missing');
  assert(Array.isArray(d.skins) && d.skins.length >= 4, 'skins derived missing');
  assert(typeof d.danger === 'number', 'danger derived missing');
  assert(d.dead === null || d.dead === false, 'dead derived should be falsy');
});

check('ensureState migrates legacy save with species but no stage', () => {
  const legacy = engine.defaultState();
  legacy.pet.species = 'chai';
  delete legacy.pet.stage;
  delete legacy.stats;
  delete legacy.daily;
  delete legacy.neglect;
  engine.ensureState(legacy);
  assert(legacy.pet.stage === 'adult', `migrated stage=${legacy.pet.stage}`);
  assert(Array.isArray(legacy.achievements), 'achievements should be filled');
});

check('skin purchase and equip', () => {
  const s = engine.defaultState();
  s.coins = 5000;
  const buy = engine.buySkin(s, 'golden');
  assert(buy.ok === true, `buy failed: ${buy.message}`);
  assert(s.skinsOwned.includes('golden'), 'skin should be owned');
  const eq = engine.setSkin(s, 'golden');
  assert(eq.ok === true, `equip failed: ${eq.message}`);
  assert(s.skin === 'golden', `skin=${s.skin}`);
  const d = engine.derivedStats(s);
  const golden = d.skins.find((sk) => sk.id === 'golden');
  assert(golden && golden.equipped, 'equipped flag should be set');
});

console.log(`  ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
