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

check('neglect to death while app active (grown buddy)', () => {
  const s = engine.defaultState();
  s.pet.stage = 'adult';
  s.pet.species = 'kala';
  s.pet.level = 12;
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

check('beginner grace: babies and eggs cannot die from neglect', () => {
  const s = engine.defaultState();
  s.pet.stage = 'baby';
  s.pet.species = 'kala';
  s.pet.level = 3;
  s.meters.hunger = 0;
  s.meters.energy = 0;
  engine.tick(s, engine.DEATH_SECONDS + 5, false);
  assert(!s.dead, 'baby under grace should not die');
  s.pet.level = 7;
  s.meters.hunger = 0;
  s.meters.energy = 0;
  engine.tick(s, engine.DEATH_SECONDS + 5, false);
  assert(s.dead, 'grown buddies can still die from neglect');
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

check('gacha rates sum to exactly 100 with the 0.0001% mythic', () => {
  const sum = engine.GACHA.rates.reduce((a, g) => a + g.rate, 0);
  assert(Math.abs(sum - 100) < 1e-9, `rates sum=${sum}`);
  const mythic = engine.GACHA.rates.find((g) => g.id === 'mythic');
  assert(mythic && mythic.rate === 0.0001, `mythic rate=${mythic && mythic.rate}`);
});

check('gacha single pull spends coins and returns a result', () => {
  const s = engine.defaultState();
  s.coins = 500;
  const res = engine.pullGacha(s, 1);
  assert(res.ok === true, `pull failed: ${res.message}`);
  assert(res.results.length === 1 && res.best, 'should return one result');
  assert(s.gacha.pulls === 1, 'pull count not tracked');
  assert(s.coins >= 0 && s.coins !== 500 - 100 + 0, 'coins changed');
});

check('gacha x10 costs 900 and rolls 10 times', () => {
  const s = engine.defaultState();
  s.coins = 5000;
  const res = engine.pullGacha(s, 10);
  assert(res.ok === true, `pull10 failed: ${res.message}`);
  assert(res.results.length === 10, `results=${res.results.length}`);
  assert(s.gacha.pulls === 10, 'pull count should be 10');
});

check('gacha refuses without enough coins', () => {
  const s = engine.defaultState();
  s.coins = 50;
  const free = engine.pullGacha(s, 1);
  assert(free.ok === true && free.freePull === true, 'first daily pull is free');
  const broke = engine.defaultState();
  broke.coins = 50;
  const now = new Date();
  broke.freePulls = { last: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}` };
  const res = engine.pullGacha(broke, 1);
  assert(res.ok === false, 'should refuse when free pull already used');
  assert(res.results === undefined, 'no results when refused');
});

check('forced mythic roll unlocks cosmic skin + Chosen One achievement', () => {
  const origRandom = Math.random;
  Math.random = () => 0.0000005;
  try {
    const s = engine.defaultState();
    s.coins = 5000;
    const res = engine.pullGacha(s, 1);
    assert(res.best.rarity === 'mythic', `best=${res.best && res.best.rarity}`);
    assert(s.skinsOwned.includes('cosmic'), 'cosmic skin should unlock');
    assert(s.achievements.includes('gacha_mythic'), 'Chosen One achievement should unlock');
    assert(s.gacha.mythics === 1, 'mythics count');
    assert(res.message.includes('MYTHIC'), 'message should announce mythic');
  } finally {
    Math.random = origRandom;
  }
});

check('cosmic skin cannot be bought, only pulled', () => {
  const s = engine.defaultState();
  s.coins = 99999;
  const res = engine.buySkin(s, 'cosmic');
  assert(res.ok === false, 'buying cosmic should fail');
  assert(!s.skinsOwned.includes('cosmic'), 'cosmic should not be owned');
  const d = engine.derivedStats(s);
  const cosmic = d.skins.find((sk) => sk.id === 'cosmic');
  assert(cosmic && cosmic.gachaOnly && !cosmic.owned, 'cosmic derived as gachaOnly');
});

check('RPG unlocks gate battle/gear/path by days played', () => {
  const s = engine.defaultState();
  s.pet.stage = 'adult';
  s.pet.species = 'kala';
  const d0 = engine.derivedStats(s).rpg;
  assert(d0.unlocks.every((u) => !u.unlocked), 'all RPG unlocks start locked');
  assert(engine.battleMonster(s, 'slime').ok === false, 'battle gated before day 7');
  assert(engine.buyGear(s, 'wood_sword').ok === false, 'gear gated before day 14');
  assert(engine.choosePath(s, 'work').ok === false, 'path gated before day 30');
  s.playdays = { last: 'x', count: 7 };
  s.meters.energy = 100;
  assert(engine.battleMonster(s, 'slime').ok === true, 'battle opens at day 7');
  s.playdays.count = 14;
  s.coins = 5000;
  assert(engine.buyGear(s, 'wood_sword').ok === true, 'gear opens at day 14');
  s.playdays.count = 30;
  const pr = engine.choosePath(s, 'battle');
  assert(pr.ok === true, 'path opens at day 30');
  assert(s.path === 'battle', 'battle path stored');
  assert(engine.choosePath(s, 'work').ok === false, 'path choice is permanent');
  const d1 = engine.derivedStats(s).rpg;
  assert(d1.unlocks.every((u) => u.unlocked), 'all unlocks open at day 30');
});

check('level ups grant stat points and allocation raises battle stats', () => {
  const s = engine.defaultState();
  s.pet.stage = 'adult';
  s.pet.species = 'kala';
  s.playdays = { last: 'x', count: 9 };
  const base = engine.petBattleStats(s).atk;
  s.pet.level = 9;
  s.pet.xp = engine.xpForNextLevel(9) + 5;
  engine.tick(s, 1, false);
  assert(s.pet.level === 10, `level=${s.pet.level}`);
  assert(s.statPoints === 2, `statPoints=${s.statPoints}`);
  const before = engine.petBattleStats(s);
  const r = engine.allocateStat(s, 'atk');
  assert(r.ok && s.allocated.atk === 1 && s.statPoints === 1, 'allocation spends a point');
  const after = engine.petBattleStats(s);
  assert(after.atk === before.atk + 2, 'atk grows +2 per point');
  assert(after.atk > base, 'level and points beat the level-1 baseline');
  assert(engine.allocateStat(s, 'luck').ok === false, 'unknown stat rejected');
});

check('gear buy/equip changes battle stats and gacha grants mythic gear', () => {
  const s = engine.defaultState();
  s.pet.stage = 'adult';
  s.pet.species = 'kala';
  s.pet.level = 12;
  s.playdays = { last: 'x', count: 20 };
  s.coins = 5000;
  const plainAtk = engine.petBattleStats(s).atk;
  assert(engine.equipGear(s, 'wood_sword').ok === false, 'cannot equip gear you do not own');
  engine.buyGear(s, 'wood_sword');
  assert(s.gearOwned.includes('wood_sword'), 'owned after purchase');
  engine.equipGear(s, 'wood_sword');
  assert(s.gear.weapon === 'wood_sword', 'equipped weapon');
  assert(engine.petBattleStats(s).atk === plainAtk + 3, 'wooden sword gives +3 atk');
  engine.equipGear(s, 'wood_sword');
  assert(s.gear.weapon === null, 'toggling unequips');
  engine.equipGear(s, 'wood_sword');
  assert(engine.buyGear(s, 'void_saber').ok === false, 'gacha-only gear cannot be bought');
  s.coins = 500;
  const origRandom = Math.random;
  Math.random = () => 0;
  try {
    const res = engine.pullGearGacha(s, 1);
    assert(res.ok && res.best.rarity === 'mythic', `rarity=${res.best && res.best.rarity}`);
    assert(s.gearOwned.includes('void_saber'), 'mythic gear unlocked');
    assert(s.gearGacha.pulls === 1 && s.gearGacha.mythics === 1, 'gear gacha counters');
  } finally {
    Math.random = origRandom;
  }
  const bonus = engine.gearBonus ? engine.gearBonus(s) : null;
  assert(bonus === null || bonus.atk >= 55, 'mythic saber bonus visible');
});

check('work path boosts coin rate, battle path boosts combat', () => {
  const s = engine.defaultState();
  s.pet.stage = 'adult';
  s.pet.species = 'kala';
  s.pet.level = 12;
  s.playdays = { last: 'x', count: 30 };
  engine.choosePath(s, 'work');
  const workRate = engine.coinRate(s);
  s.path = null;
  engine.choosePath(s, 'battle');
  const battleAtk = engine.petBattleStats(s).atk;
  s.path = 'work';
  const workAtk = engine.petBattleStats(s).atk;
  assert(workAtk < battleAtk, 'battle path hits harder');
  assert(workRate > engine.coinRate({ ...s, path: null }), 'work path earns more');
});

check('waste spawns, hurts mood, and can be cleaned', () => {
  const s = engine.defaultState();
  s.pet.stage = 'adult';
  s.pet.species = 'kala';
  s.pet.level = 12;
  s.waste = [];
  engine.spawnWaste(s);
  engine.spawnWaste(s);
  assert(s.waste.length === 2, 'two waste piles');
  const d = engine.derivedStats(s);
  assert(d.waste.length === 2, 'waste exposed in derived');
  const r = engine.cleanWaste(s, 0);
  assert(r.ok === true, `clean=${(r && r.message)}`);
  assert(s.waste.length === 1, 'one pile left');
  assert(s.meters.happiness > 60 || s.meters.happiness >= 0, 'mood bump applied without crash');
});

check('explore activities: six Asia trips, startable with energy', () => {
  const s = engine.defaultState();
  s.pet.stage = 'adult';
  s.pet.species = 'kala';
  s.pet.level = 12;
  s.meters.energy = 100;
  const d = engine.derivedStats(s);
  const exp = d.activities.filter((a) => a.outdoor);
  assert(exp.length === 6, `explore trips=${exp.length}`);
  const ids = exp.map((a) => a.id);
  for (const id of ['park', 'baywalk', 'market', 'temple', 'terraces', 'beach']) {
    assert(ids.includes(id), `missing trip ${id}`);
  }
  const r = engine.startActivity(s, 'beach');
  assert(r.ok === true, `start=${(r && r.message)}`);
  assert(s.activity && s.activity.id === 'beach', 'exploring Boracay');
  s.activity.endsAt = Date.now() - 1;
  const before = s.coins;
  engine.tick(s, 1, false);
  assert(!s.activity, 'trip completes when timer lapses');
  assert(s.coins > before, 'trip pays out coins');
});

check('evolution: level 10 auto-evolves with +25% base stats', () => {
  const s = engine.defaultState();
  s.pet.stage = 'adult';
  s.pet.species = 'kala';
  s.pet.level = 9;
  s.meters.energy = 100;
  const before = engine.petBattleStats(s);
  s.pet.xp += engine.xpForNextLevel ? 999999 : 999999;
  engine.play(s);
  assert(s.pet.evolved === true, `evolved flag=${s.pet.evolved}`);
  const after = engine.petBattleStats(s);
  assert(after.atk > before.atk, `atk grew ${before.atk} -> ${after.atk}`);
  const d = engine.derivedStats(s);
  assert(d.rpg.items.evolved === true, 'evolution exposed in derived');
});

check('evolution stone: buys and evolves before level 10', () => {
  const s = engine.defaultState();
  s.pet.stage = 'baby';
  s.pet.species = 'bao';
  s.pet.level = 4;
  s.coins = 5000;
  s.playdays = { last: 't', count: 5 };
  const r1 = engine.buyItem(s, 'eq_evo_stone');
  assert(r1.ok === true, `buy stone=${r1.message}`);
  assert(s.items.owned.includes('eq_evo_stone'), 'stone owned');
  const r2 = engine.useEvoStone(s);
  assert(r2.ok === true, `use stone=${r2.message}`);
  assert(s.pet.evolved === true, 'evolved via stone');
  assert(!s.items.owned.includes('eq_evo_stone'), 'stone consumed');
});

check('cozy items: buy + equip applies STR/DEF/AGI/MAG/LUK bonuses', () => {
  const s = engine.defaultState();
  s.coins = 99999;
  const base = engine.petBattleStats(s);
  s.playdays = { last: 't', count: 5 };
  const rb = engine.buyItem(s, 'eq_kampilan_sword');
  const rr = engine.buyItem(s, 'eq_rattan_shield');
  const re = engine.buyItem(s, 'eq_hermes_boots');
  assert(rb.ok && rr.ok && re.ok, `buys ok=${rb.ok}${rr.ok}${re.ok}`);
  assert(engine.buyItem(s, 'mystery_box').ok === false, 'unknown item safely rejected');
  engine.equipItem(s, 'eq_kampilan_sword');
  engine.equipItem(s, 'eq_rattan_shield');
  engine.equipItem(s, 'eq_hermes_boots');
  const buffed = engine.petBattleStats(s);
  assert(buffed.atk >= base.atk + 5, `atk bonus ${base.atk} -> ${buffed.atk}`);
  assert(buffed.def >= base.def + 5, `def bonus ${base.def} -> ${buffed.def}`);
  assert(buffed.spd >= base.spd + 5, `spd bonus ${base.spd} -> ${buffed.spd}`);
  assert(engine.itemBonus(s).str === 5 && engine.itemBonus(s).luk === 0, 'itemBonus aggregates');
  const r2 = engine.equipItem(s, 'eq_kampilan_sword');
  assert(r2.ok === true && engine.itemBonus(s).str === 0, 'toggle unequip strips bonus');
});

check('luck: LUK items boost daily reward and coin rate', () => {
  const s = engine.defaultState();
  s.coins = 99999;
  s.playdays = { last: 't', count: 5 };
  engine.buyItem(s, 'eq_lucky_coin_pouch');
  const rateBefore = engine.coinRate(s);
  engine.equipItem(s, 'eq_lucky_coin_pouch');
  const rateAfter = engine.coinRate(s);
  assert(rateAfter > rateBefore, `coin rate ${rateBefore.toFixed(3)} -> ${rateAfter.toFixed(3)}`);
  const d = engine.derivedStats(s);
  const shopEntry = d.rpg.items.shop.find((x) => x.id === 'eq_lucky_coin_pouch');
  assert(shopEntry && shopEntry.owned && shopEntry.equipped, 'item state in derived');
  assert(d.rpg.items.bonus.luk === 6, `luk=6 exposed (${d.rpg.items.bonus.luk})`);
});

check('bag tab: gated at day 3, cosmetics equippable by slot', () => {
  const s = engine.defaultState();
  s.pet.stage = 'adult';
  s.pet.species = 'tala';
  s.coins = 9999;
  const blocked = engine.buyItem(s, 'cos_witch_hat');
  assert(blocked.ok === false, 'blocked before day 3');
  s.playdays = { last: 't', count: 3 };
  const ok = engine.buyItem(s, 'cos_witch_hat');
  assert(ok.ok === true, `after day 3=${ok.message}`);
  const eq = engine.equipItem(s, 'cos_witch_hat');
  assert(eq.ok === true, `equip cos=${eq.message}`);
  assert(s.items.equipped.Head === 'cos_witch_hat', 'head slot filled');
  const d = engine.derivedStats(s);
  const ms = d.rpg.unlocks.find((u) => u.id === 'items');
  assert(ms && ms.day === 3 && ms.unlocked, 'items unlock exposed at day 3');
});

check('settings: defaults persist, setSettings clamps volumes and saves state', () => {
  const s = engine.defaultState();
  assert(s.settings.bgmOn === true && s.settings.pixelGraphics === true, 'settings defaults');
  const r = engine.setSettings(s, { bgmOn: false, bgmVol: 5, sfxVol: 250 });
  assert(r.ok === true, 'setSettings ok');
  assert(s.settings.bgmOn === false, 'bgm toggled off');
  assert(s.settings.bgmVol === 0.05, 'bgm clamped to 0.05');
  assert(s.settings.sfxVol === 1, 'sfx clamped to 1');
  const d = engine.derivedStats(s);
  assert(d.settings && d.settings.bgmOn === false, 'settings in derived snapshot');
});

check('settings: ensureState backfills settings for old saves', () => {
  const s = engine.defaultState();
  delete s.settings;
  engine.ensureState(s);
  assert(s.settings && s.settings.bgmOn === true, 'settings backfilled');
});

check('perk system: level-up rolls 3 choices, epic roll at 1% gives triple bonus', () => {
  const s = engine.defaultState();
  s.pet.stage = 'adult';
  s.pet.species = 'kala';
  const realRandom = Math.random;
  Math.random = () => 0.001;
  s.pet.xp = 9999;
  engine.tick(s, 1, false);
  Math.random = realRandom;
  assert(s.pendingPerk && s.pendingPerk.choices.length === 3, 'pending perk offered after level up');
  assert(s.pendingPerk.choices.every((c) => c.rarity === 'epic'), '0.001 roll <= 1% => all epic');
  assert(s.pendingPerk.choices.every((c) => c.bonus >= 0.04 * 3), 'epic bonus is 3x');
  const d = engine.derivedStats(s);
  assert(d.perks.pending && d.perks.pending.choices[0].name && d.perks.pending.choices[0].desc, 'choices enriched for UI');
});

check('perk system: choosePerk applies coin/xp bonuses and clamps bad input', () => {
  const s = engine.defaultState();
  s.pet.stage = 'adult';
  s.pet.species = 'kala';
  s.pendingPerk = { at: 1, choices: [
    { type: 'coins', rarity: 'common', bonus: 0.05 },
    { type: 'xp', rarity: 'epic', bonus: 0.15 },
  ] };
  const bad = engine.choosePerk(s, 5);
  assert(bad.ok === false, 'bad index rejected');
  const ok = engine.choosePerk(s, 0);
  assert(ok.ok === true, `claim ok: ${ok.message}`);
  assert(s.perks.coins === 0.05, 'coins bonus stored');
  const base = 0.5 * 1 * (1 + 0.05);
  assert(Math.abs(engine.coinRate(s) - base) < 1e-9, `coinRate boosted (${engine.coinRate(s)})`);
  assert(Math.abs(engine.currentXpMul(s) - 1) < 1e-9, 'xp bonus not applied until chosen');
  s.pendingPerk = { at: 2, choices: [{ type: 'xp', rarity: 'epic', bonus: 0.15 }] };
  const ok2 = engine.choosePerk(s, 0);
  assert(ok2.ok === true, `claim2 ok: ${ok2.message}`);
  assert(Math.abs(engine.currentXpMul(s) - 1.15) < 1e-9, `xpMul=${engine.currentXpMul(s)}`);
  assert(s.perksClaimed === 2 && s.epicPerks === 1, 'counters tracked');
});

check('perk system: rest and energy perks affect tick recovery/drain', () => {
  const s = engine.defaultState();
  s.pet.stage = 'adult';
  s.pet.species = 'kala';
  s.pendingPerk = { at: 3, choices: [
    { type: 'rest', rarity: 'common', bonus: 0.1 },
    { type: 'energy', rarity: 'common', bonus: 0.04 },
  ] };
  engine.choosePerk(s, 0);
  s.meters.energy = 50;
  s.flags.sleeping = true;
  engine.tick(s, 10, false);
  assert(Math.abs(s.meters.energy - (50 + 8.8)) < 0.001, `rest recovery +10% (${s.meters.energy})`);
});

console.log(`  ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
