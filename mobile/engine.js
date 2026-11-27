'use strict';

(function (root, factory) {
  const api = factory(
    typeof module !== 'undefined' && module.exports ? require('../pet/sprites.js') : root.JBSprites,
    typeof module !== 'undefined' && module.exports ? require('../pet/battle-skills.js') : root.JBBattleSkills
  );
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.JBEngine = api;
})(typeof self !== 'undefined' ? self : this, function (spritesApi, battleApi) {
const DELICACIES = spritesApi.DELICACIES;
const BS = battleApi || null;

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
  park: {
    id: 'park', name: 'Barangay Park', icon: '🌳',
    desc: 'Run around the park. Fresh air + sniffy trees.',
    duration: 40, energy: 12, coins: [10, 18], xp: 9, cooldown: 60, outdoor: 'park',
  },
  baywalk: {
    id: 'baywalk', name: 'Manila Baywalk', icon: '🌅',
    desc: 'Sunset by the bay. Peak Filipino romanticism.',
    duration: 55, energy: 16, coins: [18, 30], xp: 12, cooldown: 90, outdoor: 'baywalk',
  },
  market: {
    id: 'market', name: 'Floating Market', icon: '🚣',
    desc: 'Bangkok canals full of mangoes and boat noodles.',
    duration: 65, energy: 18, coins: [24, 38], xp: 14, cooldown: 100, outdoor: 'market',
  },
  temple: {
    id: 'temple', name: 'Kyoto Zen Garden', icon: '⛩',
    desc: 'Rake sand, pet a lucky cat, find inner peace.',
    duration: 70, energy: 14, coins: [20, 34], xp: 16, cooldown: 110, outdoor: 'temple',
  },
  terraces: {
    id: 'terraces', name: 'Rice Terraces', icon: '🌾',
    desc: 'Climb the emerald steps of Banaue.',
    duration: 85, energy: 26, coins: [34, 52], xp: 20, cooldown: 130, outdoor: 'terraces',
  },
  beach: {
    id: 'beach', name: 'Boracay Beach', icon: '🏖️',
    desc: 'Powder sand, clear water, pure island bliss.',
    duration: 95, energy: 24, coins: [40, 60], xp: 22, cooldown: 150, outdoor: 'beach',
  },
};

const MAX_METERS = 100;
const OFFLINE_CAP_SECONDS = 24 * 60 * 60;
const OFFLINE_RATE = 0.05;
const LEVEL_XP_BASE = 40;
const LEVEL_XP_GROWTH = 1.6;

const STAGES = [
  { id: 'egg', name: 'Egg', minLevel: 1, scale: 0.42 },
  { id: 'baby', name: 'Baby', minLevel: 2, scale: 0.62 },
  { id: 'teen', name: 'Teen', minLevel: 6, scale: 0.8 },
  { id: 'adult', name: 'Adult', minLevel: 10, scale: 1 },
];
const DEATH_SECONDS = 60 * 60;
const ARENA = {
  GHOST_MS: 60 * 60 * 1000,
  TOMBSTONE_MS: 24 * 60 * 60 * 1000,
  STONE_COST_FIRST: 1000,
  STONE_COST_REPEAT: 24000,
  SPECIAL_STONE_COST: 150000,
};

const ARENA_MONSTER_ALIASES = {
  guard_slime: 'slime',
  cave_bat: 'bat',
  wild_boar: 'boar',
  ridge_wolf: 'wolf',
  kumiho: 'kumiho',
  oni_brute: 'oni',
  ember_wyvern: 'wyvern',
  void_titan: 'titan',
};

const SKINS = {
  classic: { id: 'classic', name: 'Classic', cost: 0, tint: null },
  golden: { id: 'golden', name: 'Golden Shine', cost: 300, tint: 'rgba(255, 200, 60, 0.34)' },
  sakura: { id: 'sakura', name: 'Sakura Glow', cost: 450, tint: 'rgba(255, 130, 180, 0.30)' },
  midnight: { id: 'midnight', name: 'Midnight Aura', cost: 600, tint: 'rgba(40, 60, 160, 0.38)' },
  cosmic: { id: 'cosmic', name: 'Cosmic Mythic', cost: 0, gachaOnly: true, tint: 'rgba(167, 139, 250, 0.40)' },
};

const GACHA = {
  cost: 100,
  multiCost: 900,
  multiCount: 10,
  rates: [
    { id: 'mythic', stars: 5, name: 'Mythic', rate: 0.0001, coins: [10000, 12000], skin: 'cosmic' },
    { id: 'legendary', stars: 4, name: 'Legendary', rate: 0.9999, coins: [1200, 2000], skin: 'golden' },
    { id: 'epic', stars: 3, name: 'Epic', rate: 14, coins: [280, 450] },
    { id: 'rare', stars: 2, name: 'Rare', rate: 30, coins: [80, 160] },
    { id: 'common', stars: 1, name: 'Common', rate: 55, coins: [15, 40] },
  ],
};

const UNLOCKS = [
  { id: 'items', day: 3, icon: '\ud83c\udf92', name: 'Cozy Bag', desc: 'Buy and equip cosmetics & relic gear \u2014 bonuses to STR/DEF/AGI/MAG/LUK' },
  { id: 'battle', day: 7, icon: '\u2694\ufe0f', name: 'Battle Arena', desc: 'Fight monsters, earn glory \u2014 stat points every level up' },
  { id: 'gear', day: 14, icon: '\ud83d\udee1\ufe0f', name: 'Gear Forge', desc: 'Equip weapons, armor and charms \u2014 best gear in the gacha' },
  { id: 'path', day: 30, icon: '\ud83c\udf00', name: 'Destiny Path', desc: 'Commit to Work or Battle mastery \u2014 forever' },
];

const EVOLVE_LEVEL = 10;
const EVO_STONE_ID = 'eq_evo_stone';
const ITEMS = [
  { id: 'eq_kampilan_sword', kind: 'equipment', type: 'Weapon', icon: '\ud83d\udde1\ufe0f', name: 'Kampilan Blade', cost: 900, str: 5 },
  { id: 'eq_rattan_shield', kind: 'equipment', type: 'Armor', icon: '\ud83d\udee1\ufe0f', name: 'Rattan Buckler', cost: 850, def: 5 },
  { id: 'eq_agimat_amulet', kind: 'equipment', type: 'Relic', icon: '\ud83e\ude9c', name: 'Agimat Amulet', cost: 1100, mag: 4, luk: 2 },
  { id: 'eq_bamboo_staff', kind: 'equipment', type: 'Weapon', icon: '\ud83c\udf8b', name: 'Bamboo Sage Staff', cost: 1000, mag: 5 },
  { id: 'eq_lucky_coin_pouch', kind: 'equipment', type: 'Relic', icon: '\ud83e\ude99', name: 'Fortune Coin Pouch', cost: 1300, luk: 6 },
  { id: 'eq_hermes_boots', kind: 'equipment', type: 'Relic', icon: '\ud83d\udc62', name: 'Swift Wind Boots', cost: 1150, agi: 5 },
  { id: 'eq_evo_stone', kind: 'special', type: 'Special', icon: '\ud83d\udd2e', name: 'Ascension Evo Stone', cost: 1500 },
  { id: 'eq_promise_ring', kind: 'special', type: 'Special', icon: '\ud83d\udc8d', name: 'Couple Promise Ring', cost: 2000 },
];
const ITEM_SLOTS = ['Head', 'Neck', 'Back', 'Weapon', 'Armor', 'Relic'];

function itemRarityOf(it) {
  const total = (it.str || 0) + (it.def || 0) + (it.agi || 0) + (it.mag || 0) + (it.luk || 0);
  if (total >= 6) return 'legendary';
  if (total >= 5) return 'epic';
  if (total >= 4) return 'rare';
  return 'common';
}

const ITEM_GACHA_POOL = {
  common: ITEMS.filter((it) => it.kind !== 'special' && itemRarityOf(it) === 'common').map((it) => it.id),
  rare: ITEMS.filter((it) => it.kind !== 'special' && itemRarityOf(it) === 'rare').map((it) => it.id),
  epic: ITEMS.filter((it) => it.kind !== 'special' && itemRarityOf(it) === 'epic').map((it) => it.id),
  legendary: ITEMS.filter((it) => it.kind !== 'special' && itemRarityOf(it) === 'legendary').map((it) => it.id),
};


const MONSTERS = [
  { id: 'slime', name: 'Guard Slime', icon: '\ud83d\udfe2', lvl: 1, hp: 65, atk: 7, def: 2, energy: 8, coins: [12, 20], xp: 6 },
  { id: 'bat', name: 'Cave Bat', icon: '\ud83e\udd87', lvl: 4, hp: 115, atk: 12, def: 5, energy: 12, coins: [22, 34], xp: 12 },
  { id: 'boar', name: 'Wild Boar', icon: '\ud83d\udc17', lvl: 8, hp: 190, atk: 19, def: 9, energy: 16, coins: [38, 55], xp: 20 },
  { id: 'wolf', name: 'Ridge Wolf', icon: '\ud83d\udc3a', lvl: 13, hp: 290, atk: 28, def: 14, energy: 20, coins: [58, 80], xp: 32 },
  { id: 'kumiho', name: 'Kumiho', icon: '\ud83e\udd8a', lvl: 18, hp: 420, atk: 38, def: 20, energy: 26, coins: [80, 115], xp: 48 },
  { id: 'oni', name: 'Oni Brute', icon: '\ud83d\udc79', lvl: 24, hp: 600, atk: 50, def: 28, energy: 32, coins: [115, 160], xp: 70 },
  { id: 'wyvern', name: 'Ember Wyvern', icon: '\ud83d\udc09', lvl: 30, hp: 850, atk: 66, def: 38, energy: 40, coins: [160, 230], xp: 100 },
  { id: 'titan', name: 'Void Titan', icon: '\ud83d\udc7e', lvl: 40, hp: 1300, atk: 88, def: 52, energy: 50, coins: [240, 340], xp: 150 },
];

const GEAR = [
  { id: 'wood_sword', slot: 'weapon', icon: '\ud83d\udde1\ufe0f', name: 'Wooden Sword', cost: 180, atk: 3, rarity: 'common' },
  { id: 'bamboo_katana', slot: 'weapon', icon: '\ud83c\udf8b', name: 'Bamboo Katana', cost: 400, atk: 7, rarity: 'common' },
  { id: 'kris', slot: 'weapon', icon: '\u2694\ufe0f', name: 'Kris Blade', cost: 850, atk: 14, rarity: 'rare' },
  { id: 'sun_lance', slot: 'weapon', icon: '\ud83d\udd28', name: 'Sunforged Lance', cost: 1600, atk: 24, rarity: 'epic' },
  { id: 'straw_hat', slot: 'armor', icon: '\ud83d\udc52', name: 'Straw Hat', cost: 160, def: 3, rarity: 'common' },
  { id: 'barong_vest', slot: 'armor', icon: '\ud83e\udd4b', name: 'Barong Vest', cost: 420, def: 8, rarity: 'common' },
  { id: 'samurai_plate', slot: 'armor', icon: '\ud83d\udee1\ufe0f', name: 'Samurai Plate', cost: 950, def: 16, rarity: 'rare' },
  { id: 'dragon_mail', slot: 'armor', icon: '\ud83d\udc32', name: 'Dragon Mail', cost: 1800, def: 26, rarity: 'epic' },
  { id: 'dream_charm', slot: 'charm', icon: '\ud83e\udd74', name: 'Dream Charm', cost: 260, spd: 4, rarity: 'common' },
  { id: 'moon_ring', slot: 'charm', icon: '\ud83c\udf19', name: 'Moon Ring', cost: 700, spd: 9, rarity: 'rare' },
  { id: 'star_brooch', slot: 'charm', icon: '\ud83c\udf1f', name: 'Star Brooch', cost: 1400, atk: 4, spd: 14, rarity: 'epic' },
  { id: 'void_saber', slot: 'weapon', icon: '\ud83c\udf0c', name: 'Cosmic Saber', gachaOnly: true, rarity: 'mythic', atk: 55, spd: 8 },
  { id: 'cosmic_aegis', slot: 'armor', icon: '\u2728', name: 'Cosmic Aegis', gachaOnly: true, rarity: 'mythic', def: 48, spd: 6 },
  { id: 'starfall_charm', slot: 'charm', icon: '\ud83d\udcab', name: 'Starfall Charm', gachaOnly: true, rarity: 'mythic', atk: 10, def: 10, spd: 14 },
  { id: 'phoenix_blade', slot: 'weapon', icon: '\ud83d\udd25', name: 'Phoenix Blade', gachaOnly: true, rarity: 'legendary', atk: 34, spd: 4 },
  { id: 'sunforged_plate', slot: 'armor', icon: '\u2600\ufe0f', name: 'Sunforged Aegis', gachaOnly: true, rarity: 'legendary', atk: 3, def: 34 },
  { id: 'storm_lance', slot: 'weapon', icon: '\u26a1', name: 'Storm Lance', gachaOnly: true, rarity: 'epic', atk: 20 },
  { id: 'tide_scale', slot: 'armor', icon: '\ud83c\udf0a', name: 'Tide Scale Mail', gachaOnly: true, rarity: 'epic', def: 21, spd: 2 },
  { id: 'wind_bow', slot: 'weapon', icon: '\ud83c\udff9', name: 'Wind Bow', gachaOnly: true, rarity: 'rare', atk: 11, spd: 2 },
  { id: 'shadow_cloak', slot: 'armor', icon: '\ud83c\udf11', name: 'Shadow Cloak', gachaOnly: true, rarity: 'rare', def: 12, spd: 2 },
];

const GEAR_SLOTS = [
  { id: 'weapon', icon: '\ud83d\udde1\ufe0f', name: 'Weapon' },
  { id: 'armor', icon: '\ud83d\udee1\ufe0f', name: 'Armor' },
  { id: 'charm', icon: '\ud83e\udd74', name: 'Charm' },
];

const GEAR_GACHA = {
  cost: 100,
  multiCost: 900,
  multiCount: 10,
  rates: [
    { id: 'mythic', stars: 5, name: 'Mythic', rate: 0.0001 },
    { id: 'legendary', stars: 4, name: 'Legendary', rate: 0.9999 },
    { id: 'epic', stars: 3, name: 'Epic', rate: 14 },
    { id: 'rare', stars: 2, name: 'Rare', rate: 30 },
    { id: 'common', stars: 1, name: 'Common', rate: 55 },
  ],
  pool: {
    mythic: ['void_saber', 'cosmic_aegis', 'starfall_charm'],
    legendary: ['phoenix_blade', 'sunforged_plate'],
    epic: ['storm_lance', 'tide_scale', 'sun_lance', 'dragon_mail', 'star_brooch'],
    rare: ['wind_bow', 'shadow_cloak', 'kris', 'samurai_plate', 'moon_ring'],
    common: ['wood_sword', 'bamboo_katana', 'straw_hat', 'barong_vest', 'dream_charm'],
  },
};

function rollGachaRarity() {
  const roll = Math.random() * 100;
  let acc = 0;
  const ordered = [...GACHA.rates].sort((a, b) => a.rate - b.rate);
  for (const g of ordered) {
    acc += g.rate;
    if (roll < acc) return g;
  }
  return GACHA.rates[4];
}

function pullGacha(state, times) {
  const gate = deadGate(state);
  if (gate) return gate;
  const count = times === GACHA.multiCount ? GACHA.multiCount : 1;
  if (!state.freePulls) state.freePulls = { last: null };
  const freePull = count === 1 && state.freePulls.last !== todayKey(Date.now());
  let cost = count === GACHA.multiCount ? GACHA.multiCost : GACHA.cost;
  if (freePull) cost = 0;
  if (state.coins < cost) {
    return { ok: false, message: `\ud83e\ude99 Not enough coins \u2014 a \u00d7${count} summon costs ${cost}. Work para sa coins!` };
  }
  state.coins -= cost;
  if (freePull) state.freePulls.last = todayKey(Date.now());
  if (!state.gacha) state.gacha = { pulls: 0, fiveStars: 0, mythics: 0 };
  const out = [];
  const results = [];
  let best = null;
  for (let i = 0; i < count; i += 1) {
    const g = rollGachaRarity();
    state.gacha.pulls += 1;
    if (g.id === 'legendary') state.gacha.fiveStars += 1;
    if (g.id === 'mythic') state.gacha.mythics += 1;
    let coins = g.coins[0] + Math.floor(Math.random() * (g.coins[1] - g.coins[0] + 1));
    state.coins += coins;
    state.stats.coinsEarned += coins;
    let skinUnlocked = null;
    if (g.skin && !state.skinsOwned.includes(g.skin)) {
      state.skinsOwned.push(g.skin);
      skinUnlocked = SKINS[g.skin].name;
    }
    let itemUnlocked = null;
    let itemIcon = null;
    if (!state.items) state.items = { owned: [], equipped: { Head: null, Neck: null, Back: null, Weapon: null, Armor: null, Relic: null } };
    const ipool = g.id === 'mythic' ? ITEM_GACHA_POOL.legendary : (ITEM_GACHA_POOL[g.id] || []);
    const iavail = ipool.filter((id) => !state.items.owned.includes(id));
    if (iavail.length > 0) {
      const pick = iavail[Math.floor(Math.random() * iavail.length)];
      state.items.owned.push(pick);
      const idef = ITEMS.find((x) => x.id === pick);
      if (idef) { itemUnlocked = idef.name; itemIcon = idef.icon; }
    } else if (ipool.length > 0 && g.id !== 'common') {
      coins += 150;
    }
    results.push({ rarity: g.id, stars: g.stars, name: g.name, coins, skinUnlocked, itemUnlocked, itemIcon, icon: g.id === 'mythic' ? '\ud83d\udcab' : g.id === 'legendary' ? '\ud83c\udf1f' : g.id === 'epic' ? '\ud83d\udd2e' : '\ud83c\udfb0' });
    if (!best || best.stars < g.stars) best = results[results.length - 1];
  }
  checkAchievements(state, out);
  const starStr = '\u2b50'.repeat(best.stars);
  let msg = `${starStr} ${best.name} pull! +${best.coins} coins`;
  if (best.skinUnlocked) msg = `${starStr} ${best.name}!! \u2014 unlocked ${best.skinUnlocked} skin! +${best.coins} coins`;
  if (best.itemUnlocked) msg = `${starStr} NEW ITEM \u2014 ${best.itemIcon} ${best.itemUnlocked} is now in your Bag! +${best.coins} coins`;
  if (best.rarity === 'mythic') msg = `\ud83c\udfaf \u2b50 MYTHIC!! 0.0001% JACKPOT!! \u2b50 \ud83c\udfaf Unlocked Cosmic Mythic skin + ${best.coins} coins!`;
  if (freePull) msg += ' (FREE daily pull! \ud83c\udf81)';
  out.push({ ok: true, message: msg });
  return { ok: true, results, best, events: out, message: msg, freePull };
}


function rollGearRarity() {
  const roll = Math.random() * 100;
  let acc = 0;
  const ordered = [...GEAR_GACHA.rates].sort((a, b) => a.rate - b.rate);
  for (const g of ordered) {
    acc += g.rate;
    if (roll < acc) return g;
  }
  return GEAR_GACHA.rates[4];
}

function playDaysOf(state, now) {
  const pd = state.playdays;
  if (!pd) return 0;
  let days = pd.count || 0;
  const started = Number(pd.started) || 0;
  if (started) {
    const b = new Date(now || Date.now());
    const a = new Date(started);
    const floorA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    const floorB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    const elapsed = Math.floor((floorB - floorA) / 86400000) + 1;
    if (elapsed > days) days = elapsed;
  }
  return days;
}

function rpgUnlocked(state, unlockId) {
  const def = UNLOCKS.find((u) => u.id === unlockId);
  if (!def) return false;
  return playDaysOf(state) >= def.day;
}

function gearDef(gearId) {
  return GEAR.find((g) => g.id === gearId) || null;
}

function gearBonus(state) {
  const total = { atk: 0, def: 0, spd: 0 };
  for (const slot of ['weapon', 'armor', 'charm']) {
    const g = gearDef(state.gear && state.gear[slot]);
    if (!g) continue;
    total.atk += g.atk || 0;
    total.def += g.def || 0;
    total.spd += g.spd || 0;
  }
  return total;
}

function itemBonus(state) {
  const inv = state.items || { owned: [], equipped: {} };
  const out = { str: 0, def: 0, agi: 0, mag: 0, luk: 0 };
  for (const id of Object.values(inv.equipped || {})) {
    if (!id) continue;
    const it = ITEMS.find((x) => x.id === id);
    if (!it) continue;
    for (const k of ['str', 'def', 'agi', 'mag', 'luk']) out[k] += it[k] || 0;
  }
  return out;
}

function evolvePet(state) {
  if (state.pet.evolved) return false;
  state.pet.evolved = true;
  state.meters.happiness = clampMeter(state, 'happiness', state.meters.happiness + 20);
  state.meters.energy = clampMeter(state, 'energy', state.meters.energy + 20);
  markCollection(state);
  return true;
}

function petBattleStats(state) {
  const lvl = state.pet.level;
  const g = gearBonus(state);
  const ib = itemBonus(state);
  const isBattlePath = state.path === 'battle';
  const evoMul = state.pet.evolved ? 1.25 : 1;
  return {
    atk: Math.round((3 + lvl * 1.5 + (state.allocated ? state.allocated.atk : 0) * 2 + ib.str + Math.round(ib.mag * 0.5)) * evoMul * (isBattlePath ? 1.15 : 1)) + g.atk,
    def: Math.round((2 + lvl * 1.1 + (state.allocated ? state.allocated.def : 0) * 2 + ib.def) * evoMul * (isBattlePath ? 1.1 : 1)) + g.def,
    spd: Math.round((2 + lvl * 0.8 + (state.allocated ? state.allocated.spd : 0) * 2 + ib.agi) * evoMul) + g.spd,
    mag: ib.mag,
    luk: ib.luk,
    evolved: !!state.pet.evolved,
  };
}

function grantMilestones(state) {
  if (!state.milestones) state.milestones = { rename60: false, pathReset100: false, coins150: false, badge300: false };
  const days = playDaysOf(state);
  const M = state.milestones;
  if (days >= 60 && !M.rename60) {
    M.rename60 = true;
    state.stageEvents = state.stageEvents || [];
    state.stageEvents.push('\ud83c\udfC5 60-Day milestone! Free Rename unlocked \u2014 rename your buddy anytime!');
  }
  if (days >= 100 && !M.pathReset100) {
    M.pathReset100 = true;
    state.stageEvents = state.stageEvents || [];
    state.stageEvents.push('\ud83d\udd04 100-Day milestone! FREE Destiny Path reset unlocked \u2014 change Work/Battle path anytime!');
  }
  if (days >= 150 && !M.coins150) {
    M.coins150 = true;
    state.coins += 10000;
    state.stats.coinsEarned += 10000;
    state.stageEvents = state.stageEvents || [];
    state.stageEvents.push('\ud83d\udcb0 150-Day milestone! +10,000 coins gifted by your buddy!');
  }
  if (days >= 300 && !M.badge300) {
    M.badge300 = true;
    state.stageEvents = state.stageEvents || [];
    state.stageEvents.push('\ud83c\udf89 300-DAY ANNIVERSARY! Anniversary Badge earned \u2014 legend status!');
  }
}

function trackPlayday(state) {
  const now = Date.now();
  if (!state.playdays) state.playdays = { last: null, count: 0, started: null };
  if (!state.playdays.started) {
    state.playdays.started = (state.playdays.count || 0) > 0
      ? now - ((state.playdays.count - 1) * 86400000)
      : now;
  }
  const tk = todayKey(now);
  if (state.playdays.last !== tk) {
    state.playdays.last = tk;
    state.playdays.count = (state.playdays.count || 0) + 1;
    grantMilestones(state);
  }
}

function allocateStat(state, statId) {
  const gate = deadGate(state);
  if (gate) return gate;
  if (!rpgUnlocked(state, 'battle')) return { ok: false, message: '\u2694\ufe0f Stats unlock at 7 days played!' };
  if (!['atk', 'def', 'spd'].includes(statId)) return { ok: false, message: 'Unknown stat.' };
  if (!state.statPoints || state.statPoints <= 0) return { ok: false, message: '\ud83d\udcaa No stat points \u2014 level up muna! (Every level up = +2 points.)' };
  state.statPoints -= 1;
  state.allocated = state.allocated || { atk: 0, def: 0, spd: 0 };
  state.allocated[statId] = (state.allocated[statId] || 0) + 1;
  const labels = { atk: 'Attack \u2694\ufe0f', def: 'Defense \ud83d\udee1\ufe0f', spd: 'Speed \ud83d\udca8' };
  return { ok: true, message: `\u2b06\ufe0f ${labels[statId]} +1! ${state.statPoints} point${state.statPoints === 1 ? '' : 's'} left.` };
}

function buyItem(state, itemId) {
  const gate = deadGate(state);
  if (gate) return gate;
  if (!rpgUnlocked(state, 'items')) return { ok: false, message: '\ud83c\udf92 Cozy Bag unlocks at 3 days of play!' };
  const it = ITEMS.find((x) => x.id === itemId);
  if (!it) return { ok: false, message: 'Unknown item.' };
  if (state.items.owned.includes(it.id)) return { ok: false, message: 'Already owned!' };
  if (state.coins < it.cost) return { ok: false, message: `\ud83e\ude99 Not enough coins \u2014 ${it.name} costs ${it.cost}.` };
  state.coins -= it.cost;
  state.items.owned.push(it.id);
  checkAchievements(state, []);
  return { ok: true, message: `\ud83c\udf92 Bought ${it.name}!` };
}

function equipItem(state, itemId) {
  const gate = deadGate(state);
  if (gate) return gate;
  if (!rpgUnlocked(state, 'items')) return { ok: false, message: '\ud83c\udf92 Cozy Bag unlocks at 3 days of play!' };
  const it = ITEMS.find((x) => x.id === itemId);
  if (!it) return { ok: false, message: 'Unknown item.' };
  if (!state.items.owned.includes(it.id)) return { ok: false, message: 'Not owned yet.' };
  const key = it.type;
  if (!ITEM_SLOTS.includes(key)) return { ok: false, message: '\ud83d\udd2e Use this stone from the Bag tab instead!' };
  if (state.items.equipped[key] === it.id) {
    state.items.equipped[key] = null;
    return { ok: true, message: `\ud83d\uddc3\ufe0f Unequipped ${it.name}.` };
  }
  state.items.equipped[key] = it.id;
  checkAchievements(state, []);
  return { ok: true, message: `\u2728 Equipped ${it.name}!` };
}

function useEvoStone(state) {
  const gate = deadGate(state);
  if (gate) return gate;
  if (state.pet.stage === 'egg') return { ok: false, message: '\ud83e\udd5a Hatch your buddy first!' };
  if (state.pet.evolved) return { ok: false, message: '\u2728 Already in Stage 2 form!' };
  const idx = state.items.owned.indexOf(EVO_STONE_ID);
  if (idx === -1) return { ok: false, message: '\ud83d\udd2e You need an Ascension Evo Stone \u2014 grab one in the Bag tab!' };
  state.items.owned.splice(idx, 1);
  evolvePet(state);
  return { ok: true, message: '\ud83d\udcab EVOLUTION! Your buddy ascended to Stage 2 \u2014 base stats +25%!' };
}

function battleMonster(state, monsterId) {
  const gate = deadGate(state);
  if (gate) return gate;
  if (!rpgUnlocked(state, 'battle')) return { ok: false, message: '\u2694\ufe0f Battle Arena unlocks at 7 days played! Keep playing daily \ud83d\udd25' };
  const mon = MONSTERS.find((m) => m.id === monsterId);
  if (!mon) return { ok: false, message: 'Unknown monster.' };
  if (state.pet.stage === 'egg') return { ok: false, message: '\ud83e\udd7a Hatch your buddy first!' };
  if (state.pet.level < mon.lvl) return { ok: false, message: `\ud83d\udc76 Too scary! ${mon.name} needs level ${mon.lvl}.` };
  if (state.meters.energy < mon.energy) return { ok: false, message: `\ud83d\ude34 Not enough energy (needs ${mon.energy}). Sleep muna!` };
  const now = Date.now();
  const cdUntil = state.activityCooldowns.battle || 0;
  if (now < cdUntil) return { ok: false, message: `\ud83d\udcaa Resting... next battle in ${Math.ceil((cdUntil - now) / 1000)}s.` };
  state.meters.energy = Math.max(0, state.meters.energy - mon.energy);
  state.activityCooldowns.battle = now + 20000;
  const bs = petBattleStats(state);
  const petMaxHp = 40 + bs.def * 4 + state.pet.level * 6;
  let petHp = petMaxHp;
  let monHp = mon.hp;
  const hit = (atk, def) => Math.max(1, Math.round((atk - def * 0.5) * (0.8 + Math.random() * 0.4)));
  let rounds = 0;
  const petFirst = bs.spd >= mon.atk * 2;
  while (petHp > 0 && monHp > 0 && rounds < 40) {
    if (petFirst || rounds % 2 === 0) monHp -= hit(bs.atk, mon.def);
    else monHp -= 0;
    if (monHp > 0) petHp -= hit(mon.atk, bs.def);
    rounds += 1;
  }
  const win = monHp <= 0 && petHp > 0;
  const events = [];
  if (win) {
    const coins = mon.coins[0] + Math.floor(Math.random() * (mon.coins[1] - mon.coins[0] + 1)) + (bs.luk || 0) * 3;
    state.coins += coins;
    state.stats.coinsEarned += coins;
    state.pet.xp += mon.xp * currentXpMul(state);
    state.battle.wins += 1;
    state.meters.happiness = clampMeter(state, 'happiness', state.meters.happiness + 4);
    if (!state.items) state.items = { owned: [], equipped: { Head: null, Neck: null, Back: null, Weapon: null, Armor: null, Relic: null } };
    if (!Array.isArray(state.items.owned)) state.items.owned = [];
    const dropChance = Math.min(0.35, 0.12 + (bs.luk || 0) * 0.015);
    const pool = ITEMS.filter((it) => it.kind !== 'special' && !state.items.owned.includes(it.id));
    let dropMsg = '';
    if (Math.random() < dropChance && pool.length > 0) {
      const drop = pool[Math.floor(Math.random() * pool.length)];
      state.items.owned.push(drop.id);
      dropMsg = ` \ud83c\udf81 LOOT DROP: ${drop.icon} ${drop.name} is now in your Bag!`;
    } else {
      state.coins += 5;
      state.stats.coinsEarned += 5;
    }
    events.push({ ok: true, message: `\u2694\ufe0f Victory over ${mon.icon} ${mon.name}! +\ud83e\ude99${coins} +${mon.xp} XP${dropMsg}${petHp < petMaxHp * 0.25 ? ' (naughty scar!)' : ''}` });
  } else {
    state.battle.losses += 1;
    const salvage = Math.max(3, Math.floor(mon.coins[0] * 0.2));
    state.coins += salvage;
    state.stats.coinsEarned += salvage;
    state.meters.happiness = Math.max(0, state.meters.happiness - 3);
    events.push({ ok: true, message: `\ud83d\udc80 ${mon.name} won this round... regroup, feed your buddy, try again! +\ud83e\ude99${salvage} salvage` });
  }
  applyLevelUps(state);
  trackPlayday(state);
  checkAchievements(state, events);
  return { ok: true, win, results: [], message: events[events.length - 1].message, events };
}

function buyGear(state, gearId) {
  const gate = deadGate(state);
  if (gate) return gate;
  if (!rpgUnlocked(state, 'gear')) return { ok: false, message: '\ud83d\udee1\ufe0f Gear Forge unlocks at 14 days played!' };
  const g = gearDef(gearId);
  if (!g) return { ok: false, message: 'Unknown gear.' };
  if (state.gearOwned.includes(g.id)) return { ok: false, message: 'Already owned \u2014 equip it in the Gear tab!' };
  return { ok: false, message: '\ud83c\udfaf Gear is no longer bought \u2014 win it in the Equipment Wish gacha!' };
}

function adminAddGold(state) {
  state.coins += 1000;
  state.stats.coinsEarned += 1000;
  return { ok: true, message: '\ud83d\udedb\ufe0f ADMIN: +1,000 coins added (testing).' };
}

function adminAddExp(state) {
  state.pet.xp += 100;
  applyLevelUps(state);
  return { ok: true, message: `\ud83d\udedb\ufe0f ADMIN: +100 EXP added (testing) \u2014 Lv ${state.pet.level}.` };
}

function equipGear(state, gearId) {
  const gate = deadGate(state);
  if (gate) return gate;
  if (!rpgUnlocked(state, 'gear')) return { ok: false, message: '\ud83d\udee1\ufe0f Gear Forge unlocks at 14 days played!' };
  if (!gearId) return { ok: false, message: 'No gear selected.' };
  const g = gearDef(gearId);
  if (!g) return { ok: false, message: 'Unknown gear.' };
  if (!state.gearOwned.includes(g.id)) return { ok: false, message: 'You do not own that gear yet.' };
  if (state.gear[g.slot] === g.id) {
    state.gear[g.slot] = null;
    return { ok: true, message: `\ud83e\uddf3 Unequipped ${g.name}.` };
  }
  state.gear[g.slot] = g.id;
  return { ok: true, message: `\u2699\ufe0f Equipped ${g.icon} ${g.name}!` };
}

function pullGearGacha(state, times) {
  const gate = deadGate(state);
  if (gate) return gate;
  if (!rpgUnlocked(state, 'gear')) return { ok: false, message: '\ud83c\udfb0 Equipment Wish unlocks at 14 days played!' };
  const count = times === GEAR_GACHA.multiCount ? GEAR_GACHA.multiCount : 1;
  if (!state.freePulls) state.freePulls = { last: null };
  const freePull = count === 1 && state.freePulls.last !== todayKey(Date.now());
  let cost = count === GEAR_GACHA.multiCount ? GEAR_GACHA.multiCost : GEAR_GACHA.cost;
  if (freePull) cost = 0;
  if (state.coins < cost) {
    return { ok: false, message: `\ud83e\ude99 Not enough coins \u2014 a \u00d7${count} Equipment Wish costs ${cost}.` };
  }
  state.coins -= cost;
  if (freePull) state.freePulls.last = todayKey(Date.now());
  if (!state.gearGacha) state.gearGacha = { pulls: 0, fiveStars: 0, mythics: 0 };
  const out = [];
  const results = [];
  let best = null;
  for (let i = 0; i < count; i += 1) {
    const g = rollGearRarity();
    state.gearGacha.pulls += 1;
    if (g.id === 'legendary') state.gearGacha.fiveStars += 1;
    if (g.id === 'mythic') state.gearGacha.mythics += 1;
    const pool = GEAR_GACHA.pool[g.id] || [];
    let gearUnlocked = null;
    let gearIcon = null;
    let coins = g.id === 'common' ? 15 + Math.floor(Math.random() * 26) : 60 + Math.floor(Math.random() * 120);
    if (pool.length > 0) {
      const pickId = pool[Math.floor(Math.random() * pool.length)];
      const pg = gearDef(pickId);
      if (pg) gearIcon = pg.icon;
      if (!state.gearOwned.includes(pickId)) {
        state.gearOwned.push(pickId);
        gearUnlocked = `${pg.icon} ${pg.name}`;
      } else {
        coins += 150;
      }
    }
    state.coins += coins;
    state.stats.coinsEarned += coins;
    results.push({ rarity: g.id, stars: g.stars, name: g.name, coins, gearUnlocked, gearIcon, icon: gearIcon || '\ud83c\udfb0' });
    if (!best || best.stars < g.stars) best = results[results.length - 1];
  }
  checkAchievements(state, out);
  const starStr = '\u2b50'.repeat(best.stars);
  let msg = `${starStr} Equipment Wish: ${best.name}! +\ud83e\ude99${best.coins}`;
  if (best.gearUnlocked) msg = `${starStr} NEW GEAR \u2014 ${best.gearUnlocked}! +\ud83e\ude99${best.coins}`;
  if (best.rarity === 'mythic') msg = `\ud83c\udfaf \u2b50 MYTHIC GEAR!! 0.0001% JACKPOT!! \u2b50 \ud83c\udfaf ${best.gearUnlocked || 'Legendary relic'} + \ud83e\ude99${best.coins}!`;
  if (freePull) msg += ' (FREE daily pull! \ud83c\udf81)';
  out.push({ ok: true, message: msg });
  return { ok: true, results, best, events: out, message: msg, freePull };
}

function choosePath(state, pathId) {
  const gate = deadGate(state);
  if (gate) return gate;
  if (!rpgUnlocked(state, 'path')) return { ok: false, message: '\ud83c\udf00 Destiny Path unlocks at 30 days played!' };
  if (!['work', 'battle'].includes(pathId)) return { ok: false, message: 'Unknown path.' };
  const hadPath = !!state.path;
  const freeReset = hadPath && !!(state.milestones && state.milestones.pathReset100);
  if (hadPath && !freeReset) return { ok: false, message: `\ud83c\udf00 Destiny already chosen: ${state.path === 'work' ? '\ud83d\udcbc Work Master' : '\u2694\ufe0f Battle Master'}! (Path reset unlocks at the 100-day milestone.)` };
  state.path = pathId;
  const msg = freeReset
    ? `\ud83d\udd04 Path RESET free (100-day milestone)! Now: ${pathId === 'work' ? '\ud83d\udcbc Work Master' : '\u2694\ufe0f Battle Master'}!`
    : pathId === 'work'
      ? '\ud83d\udcbc Work Master! +50% coin rate for life \u2014 the idle tycoon road.'
      : '\u2694\ufe0f Battle Master! +15% battle power for life \u2014 the warrior road.';
  return { ok: true, message: msg };
}

const ACHIEVEMENTS = [
  { id: 'first_feed', icon: '🍜', name: 'First Bite', desc: 'Feed your buddy', check: (s) => s.stats.feedCount >= 1 },
  { id: 'feast_10', icon: '😋', name: 'Little Foodie', desc: 'Feed 10 meals', check: (s) => s.stats.feedCount >= 10 },
  { id: 'feast_40', icon: '👨‍🍳', name: 'Gourmet Buddy', desc: 'Feed 40 meals', check: (s) => s.stats.feedCount >= 40 },
  { id: 'playful_10', icon: '🎾', name: 'Playtime!', desc: 'Play 10 times', check: (s) => s.stats.playCount >= 10 },
  { id: 'worker_10', icon: '💼', name: 'Hard Worker', desc: 'Work 10 minutes total', check: (s) => s.stats.workSeconds >= 600 },
  { id: 'rich_500', icon: '💰', name: 'Coin Collector', desc: 'Earn 500 coins total', check: (s) => s.stats.coinsEarned >= 500 },
  { id: 'rich_2500', icon: '💰', name: 'Idle Tycoon', desc: 'Earn 2,500 coins total', check: (s) => s.stats.coinsEarned >= 2500 },
  { id: 'hatch', icon: '🐣', name: 'Hello World!', desc: 'Hatch your buddy', check: (s) => !!s.pet.species && s.pet.stage !== 'egg' },
  { id: 'teen', icon: '🌟', name: 'Growing Up', desc: 'Reach Teen form', check: (s) => ['teen', 'adult'].includes(s.pet.stage) },
  { id: 'adult', icon: '👑', name: 'Fully Evolved', desc: 'Reach Adult form', check: (s) => s.pet.stage === 'adult' },
  { id: 'streak_3', icon: '🔥', name: 'Loyal Friend', desc: '3-day login streak', check: (s) => (s.daily ? s.daily.streak : 0) >= 3 },
  { id: 'streak_7', icon: '💚', name: 'Best Buddy Forever', desc: '7-day login streak', check: (s) => (s.daily ? s.daily.streak : 0) >= 7 },
  { id: 'gacha_1', icon: '🎰', name: 'First Wish', desc: 'Try your luck in the Gacha', check: (s) => !!(s.gacha && s.gacha.pulls >= 1) },
  { id: 'gacha_100', icon: '🎰', name: 'Gacha Addict', desc: '100 summons', check: (s) => !!(s.gacha && s.gacha.pulls >= 100) },
  { id: 'gacha_mythic', icon: '🎯', name: 'Chosen One', desc: 'Pull the 0.0001% Mythic', check: (s) => !!(s.gacha && s.gacha.mythics >= 1) },
  { id: 'battle_1', icon: '⚔️', name: 'First Blood', desc: 'Win your first battle', check: (s) => !!(s.battle && s.battle.wins >= 1) },
  { id: 'battle_25', icon: '🏆', name: 'Monster Hunter', desc: 'Win 25 battles', check: (s) => !!(s.battle && s.battle.wins >= 25) },
  { id: 'gear_1', icon: '🛡️', name: 'Field Ready', desc: 'Equip your first gear', check: (s) => !!(s.gear && (s.gear.weapon || s.gear.armor || s.gear.charm)) },
  { id: 'path_1', icon: '🌀', name: 'Destiny Chosen', desc: 'Commit to a path', check: (s) => !!s.path },
  { id: 'evo_1', icon: '\ud83d\udcab', name: 'Ascended', desc: 'Evolve to Stage 2 form', check: (s) => !!(s.pet && s.pet.evolved) },
  { id: 'items_3', icon: '\ud83c\udf92', name: 'Glammed Up', desc: 'Own 3 cozy items', check: (s) => !!(s.items && s.items.owned.length >= 3) },
  { id: 'perk_1', icon: '\ud83e\uDDF0', name: 'Growth Spurt', desc: 'Claim your first level-up perk', check: (s) => (s.perksClaimed || 0) >= 1 },
  { id: 'perk_epic', icon: '\u2728', name: 'Epic Fate', desc: 'Roll an EPIC perk (1% luck!)', check: (s) => (s.epicPerks || 0) >= 1 },
];

const WEATHER_POOL = ['clear', 'clear', 'cloudy', 'clear', 'rainy', 'cloudy', 'rainy', 'stormy', 'clear', 'cloudy', 'snowy', 'rainy'];
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
    pet: { name: 'Buddy', species: null, stage: 'egg', level: 1, xp: 0, evolved: false },
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
    quests: { last: '', feed: 0, play: 0, clean: 0, feedClaimed: false, playClaimed: false, cleanClaimed: false },
    gacha: { pulls: 0, fiveStars: 0, mythics: 0 },
    playdays: { last: null, count: 0, started: null },
    statPoints: 0,
    allocated: { atk: 0, def: 0, spd: 0 },
    gear: { weapon: null, armor: null, charm: null },
    gearOwned: [],
    gearGacha: { pulls: 0, fiveStars: 0, mythics: 0 },
    path: null,
    battle: { wins: 0, losses: 0 },
    waste: [],
    items: { owned: [], equipped: { Head: null, Neck: null, Back: null, Weapon: null, Armor: null, Relic: null } },
    skin: 'classic',
    skinsOwned: ['classic'],
    settings: { bgmOn: true, bgmVol: 0.5, sfxVol: 0.7, pixelGraphics: true, theme: 'classic', wallPaw: 'auto' },
    perks: { coins: 0, xp: 0, energy: 0, rest: 0 },
    pendingPerk: null,
    perksClaimed: 0,
    epicPerks: 0,
    neglect: 0,
    dead: null,
    arena: { deaths: 0, status: 'alive', ghostUntil: 0, resetAt: 0 },
    collection: { seen: {} },
    lastSeen: Date.now(),
  };
}

function ensureState(state) {
  const fresh = defaultState();
  for (const key of ['stats', 'achievements', 'daily', 'gacha', 'playdays', 'allocated', 'gear', 'gearOwned', 'gearGacha', 'battle', 'waste', 'skin', 'skinsOwned', 'neglect', 'dead', 'settings', 'perks', 'items', 'milestones', 'freePulls', 'freeFood', 'quests', 'collection']) {
    if (state[key] === undefined) state[key] = fresh[key];
  }
  if (!state.collection || typeof state.collection !== 'object' || !state.collection.seen || typeof state.collection.seen !== 'object') state.collection = { seen: {} };
  if (typeof state.pet.species === 'string' && state.pet.species && state.pet.stage !== 'egg') {
    const colEntry = state.collection.seen[state.pet.species] || {};
    state.collection.seen[state.pet.species] = { evolved: !!state.pet.evolved || !!colEntry.evolved };
  }
  if (state.pendingPerk === undefined) state.pendingPerk = null;
  if (state.epicPerks === undefined) state.epicPerks = 0;
  if (state.perksClaimed === undefined) state.perksClaimed = 0;
  if (state.settings) {
    for (const k of ['bgmOn', 'pixelGraphics']) if (state.settings[k] === undefined) state.settings[k] = fresh.settings[k];
    for (const k of ['bgmVol', 'sfxVol']) if (typeof state.settings[k] !== 'number' || Number.isNaN(state.settings[k])) state.settings[k] = fresh.settings[k];
    if (state.settings.theme === undefined) state.settings.theme = 'classic';
    if (state.settings.wallPaw === undefined) state.settings.wallPaw = 'auto';
  }
  if (state.statPoints === undefined) state.statPoints = 0;
  if (state.path === undefined) state.path = null;
  if (state.items === undefined) {
    state.items = fresh.items;
  } else {
    if (!Array.isArray(state.items.owned)) state.items.owned = fresh.items.owned;
    state.items.equipped = { ...fresh.items.equipped, ...(state.items.equipped || {}) };
    for (const k of ITEM_SLOTS) if (state.items.equipped[k] === undefined) state.items.equipped[k] = null;
  }
  if (state.pet.evolved === undefined) state.pet.evolved = false;
  if (!state.pet) state.pet = fresh.pet;
  if (state.pet.stage === undefined) {
    state.pet.stage = state.pet.species ? 'adult' : 'egg';
  }
  if (state.pet.stage !== 'egg' && !state.pet.species) state.pet.species = 'kala';
  if (typeof state.pet.species === 'string' && state.pet.species) {
    state.pet.species = spritesApi.normalizeSpeciesId ? spritesApi.normalizeSpeciesId(state.pet.species) : state.pet.species;
  }
  if (!(state.pet.name)) state.pet.name = fresh.pet.name;
  if (!state.dead) state.dead = null;
  if (!state.arena || typeof state.arena !== 'object') state.arena = { deaths: 0, status: 'alive', ghostUntil: 0, resetAt: 0 };
  if (state.arena.status !== 'alive' && state.arena.status !== 'ghost' && state.arena.status !== 'tombstone') state.arena.status = 'alive';
  state.arena.deaths = Math.max(0, Math.round(Number(state.arena.deaths) || 0));
  state.arena.ghostUntil = Math.max(0, Math.round(Number(state.arena.ghostUntil) || 0));
  state.arena.resetAt = Math.max(0, Math.round(Number(state.arena.resetAt) || 0));
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

function normalizeSpecies(id) {
  return spritesApi.normalizeSpeciesId ? spritesApi.normalizeSpeciesId(id) : id;
}

function markCollection(state) {
  if (!state.collection || typeof state.collection !== 'object') state.collection = { seen: {} };
  if (!state.collection.seen || typeof state.collection.seen !== 'object') state.collection.seen = {};
  const sp = state.pet && state.pet.species;
  if (typeof sp !== 'string' || !sp || state.pet.stage === 'egg') return;
  const prev = state.collection.seen[sp] || {};
  state.collection.seen[normalizeSpecies(sp)] = { evolved: !!state.pet.evolved || !!prev.evolved };
}

function collectionOf(state) {
  const seen = state.collection && state.collection.seen ? state.collection.seen : {};
  const list = [];
  const push = (id, evolved) => {
    if (typeof id !== 'string' || !id) return;
    const norm = normalizeSpecies(id);
    const existing = list.find((u) => u.id === norm);
    if (existing) existing.evolved = existing.evolved || !!evolved;
    else list.push({ id: norm, evolved: !!evolved });
  };
  for (const [id, entry] of Object.entries(seen)) push(id, entry && entry.evolved);
  if (state.pet && state.pet.stage !== 'egg') push(state.pet.species, state.pet.evolved);
  return list;
}

function collectionBonusesOf(state) {
  if (!BS || typeof BS.collectionBonuses !== 'function') return { totals: {}, contributors: [] };
  const b = BS.collectionBonuses(collectionOf(state));
  return b && b.totals ? b : { totals: {}, contributors: [] };
}

function activePetKitOf(state) {
  if (!BS || typeof BS.petKit !== 'function' || !state.pet || state.pet.stage === 'egg') return null;
  return BS.petKit(state.pet.species, state.pet.evolved);
}

function meterCap(state, key) {
  const totals = collectionBonusesOf(state).totals;
  if (key === 'energy') return MAX_METERS + Math.round(totals.maxEnergyFlat || 0);
  if (key === 'happiness') return MAX_METERS + Math.round(totals.maxHappinessFlat || 0);
  return MAX_METERS;
}

function clampMeter(state, key, value) {
  return Math.max(0, Math.min(meterCap(state, key), value));
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
  if (state.path === 'work') rate *= 1.5;
  rate *= 1 + perkPct(state, 'coins');
  rate *= 1 + (collectionBonusesOf(state).totals.coinBonusPct || 0);
  rate += itemBonus(state).luk * 0.02;
  return rate;
}

function statusText(state) {
  const m = state.meters;
  if (state.dead) return 'Passed away...';
  if (state.arena && state.arena.status === 'tombstone') return 'Tombstone...';
  if (state.arena && state.arena.status === 'ghost') return 'Ghost...';
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
  const arenaNow = Date.now();
  if (state.arena && state.arena.status !== 'alive') {
    if (state.arena.status === 'ghost' && state.arena.ghostUntil && arenaNow >= state.arena.ghostUntil) {
      state.arena.status = 'alive';
      state.arena.ghostUntil = 0;
      return [{ ok: true, message: `✨ ${state.pet.name} revived on their own after the rest period! Welcome back.` }];
    }
    if (state.arena.status === 'tombstone' && state.arena.resetAt && arenaNow >= state.arena.resetAt) {
      const name = state.pet.name;
      resetToEgg(state);
      state.flags.sleeping = false;
      state.flags.working = false;
      state.activity = null;
      state.activityCooldowns = {};
      return [{ ok: true, message: `🪦 24 hours passed since ${name}'s full death... the Tombstone claimed the save. A fresh egg awaits!`, arenaReset: true }];
    }
    if (offline) state.lastSeen = Date.now();
    return [];
  }
  const scale = offline ? 0.35 : 1;
  const m = state.meters;
  const f = state.flags;
  const bedFactor = Math.pow(0.88, state.upgrades.bed);
  const events = [];

  if (state.dead) {
    state.lastSeen = Date.now();
    return events;
  }

  trackPlayday(state);
  fireStageEvents(state, events);
  careLevel(state);
  if (!f.sleeping && state.pet.stage !== 'egg') {
    const pottyRate = 0.004 + ((state.effects.eatUntil || 0) > Date.now() ? 0.005 : 0);
    if (Math.random() < pottyRate * dt) spawnWaste(state);
  }

  const isBabyGrace = state.pet.stage !== 'egg' && state.pet.level <= 3;
  const careScale = state.pet.stage === 'egg' ? 0.35 : isBabyGrace ? 0.65 : 1;

  let energyDrain = 0.021 * bedFactor * (f.working ? 1.8 : 1) * (1 - Math.min(0.6, perkPct(state, 'energy')));
  let hungerDrain = 0.028 * (f.working ? 1.5 : 1);
  let happinessDrain = 0.017;
  if (m.hunger < 25) happinessDrain += 0.03;
  if (m.energy < 20) happinessDrain += 0.02;
  if ((state.waste || []).length > 0) happinessDrain += 0.02 * state.waste.length;

  const col = collectionBonusesOf(state);
  const decayMul = 1 - Math.min(0.9, col.totals.decayReductionPct || 0);
  energyDrain *= decayMul;
  hungerDrain *= decayMul;
  happinessDrain *= decayMul;

  if (f.sleeping) {
    m.energy = clampMeter(state, 'energy', m.energy + 0.8 * (1 + perkPct(state, 'rest')) * (1 + Math.min(0.9, col.totals.recoverySpeedPct || 0)) * dt);
    hungerDrain = 0.02;
  } else if (offline) {
    const gained = coinRate(state) * OFFLINE_RATE * dt;
    state.coins += gained;
    state.stats.coinsEarned += gained;
    state.stats.workSeconds += dt * OFFLINE_RATE;
    state.pet.xp += 0.05 * OFFLINE_RATE * dt;
  } else if (f.working) {
    const gained = coinRate(state) * dt;
    state.coins += gained;
    state.stats.coinsEarned += gained;
    state.stats.workSeconds += dt;
    state.pet.xp += 0.05 * dt * currentXpMul(state);
  }

  m.hunger = clamp100(m.hunger - hungerDrain * dt * scale * careScale);
  if (!f.sleeping) m.energy = clamp100(m.energy - energyDrain * dt * scale * careScale);
  m.happiness = clamp100(m.happiness - happinessDrain * dt * scale * careScale);

  if (f.working && m.energy <= 2) {
    f.working = false;
  }

  if (!offline && state.pet.stage !== 'egg') {
    const inDanger = m.hunger <= 0 || m.energy <= 0;
    if (inDanger && !isBabyGrace) {
      state.neglect = Math.min(DEATH_SECONDS, (state.neglect || 0) + dt * (state.pet.level <= 6 ? 0.6 : 1));
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
      state.neglect = Math.max(0, state.neglect - dt * 2);
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
  const cdMul = 1 - Math.min(0.9, collectionBonusesOf(state).totals.workCooldownReductionPct || 0);
  state.activityCooldowns[a.id] = Date.now() + a.cooldown * 1000 * cdMul;
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
  const colCost = collectionBonusesOf(state).totals.energyCostReductionPct || 0;
  const cost = Math.max(1, Math.round(a.energy * (1 - Math.min(0.9, colCost))));
  if (state.meters.energy < cost) return { ok: false, message: `Not enough energy (needs ${cost} ⚡).` };
  const cd = state.activityCooldowns[id] || 0;
  if (Date.now() < cd) {
    return { ok: false, message: `${a.name} is on cooldown (${Math.ceil((cd - Date.now()) / 1000)}s).` };
  }
  state.meters.energy = clamp100(state.meters.energy - cost);
  state.activity = { id, endsAt: Date.now() + a.duration * 1000 };
  state.flags.working = false;
  return { ok: true, message: `${a.icon} ${a.name} started!` };
}

function applyLevelUps(state) {
  let need = xpForNextLevel(state.pet.level);
  let levelsGained = 0;
  while (state.pet.xp >= need) {
    state.pet.xp -= need;
    state.pet.level += 1;
    state.statPoints = (state.statPoints || 0) + 2;
    levelsGained += 1;
    need = xpForNextLevel(state.pet.level);
    if (state.pet.level >= EVOLVE_LEVEL && !state.pet.evolved && state.pet.stage !== 'egg') {
      evolvePet(state);
    }
  }
  if (levelsGained > 0 && !state.pendingPerk) {
    state.pendingPerk = rollPerkChoices();
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
      state.pet.species = rollHatchSpecies();
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
    markCollection(state);
    state.effects.happyUntil = Math.max(state.effects.happyUntil, Date.now() + 8000);
  }
}

const HATCH_RARITY_WEIGHTS = { muning: 0.35, banog: 0.35, gagak: 0.35, ran: 0.35 };
function rollHatchSpecies() {
  const roster = (spritesApi.PET_ROSTER || []).filter((pt) => !pt.shopOnly);
  if (!roster.length) return 'kala';
  const total = roster.reduce((sum, pt) => sum + (HATCH_RARITY_WEIGHTS[pt.id] || 1), 0);
  let roll = Math.random() * total;
  for (const pt of roster) {
    roll -= (HATCH_RARITY_WEIGHTS[pt.id] || 1);
    if (roll <= 0) return pt.id;
  }
  return roster[roster.length - 1].id;
}

function deadGate(state) {
  if (state.dead) return { ok: false, message: `🕊️ ${state.pet.name} has passed away. Start a new game in the ✨ Life tab.` };
  const a = state.arena;
  if (a && a.status === 'tombstone') {
    return { ok: false, dead: true, message: `🪦 ${state.pet.name} is dead! Revive with the Special Reincarnation Stone (150,000 gold) — the game resets in ${formatArenaCountdown(a.resetAt - Date.now())}.` };
  }
  if (a && a.status === 'ghost') {
    return { ok: false, dead: true, message: `👻 ${state.pet.name} is dead! Buy a Reincarnation Stone in the Shop to revive (${formatArenaCountdown(a.ghostUntil - Date.now())} left).` };
  }
  return null;
}

function formatArenaCountdown(ms) {
  const total = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
  const h = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function arenaSnapshot(state) {
  const a = state.arena || {};
  const now = Date.now();
  return {
    deaths: a.deaths || 0,
    status: a.status || 'alive',
    ghostUntil: a.ghostUntil || 0,
    resetAt: a.resetAt || 0,
    lockoutRemainingMs: a.status === 'ghost' ? Math.max(0, (a.ghostUntil || 0) - now) : 0,
    resetRemainingMs: a.status === 'tombstone' ? Math.max(0, (a.resetAt || 0) - now) : 0,
  };
}

function arenaResult(state, payload) {
  payload = payload || {};
  const mon = MONSTERS.find((mo) => mo.id === (ARENA_MONSTER_ALIASES[payload.monsterId] || payload.monsterId));
  if (!mon) return { ok: false, message: 'Unknown monster.' };
  const a = state.arena || (state.arena = { deaths: 0, status: 'alive', ghostUntil: 0, resetAt: 0 });
  if (a.status !== 'alive') return { ok: false, message: 'Your buddy cannot fight while dead \u2014 revive first!' };
  if (!payload.win) {
    a.deaths += 1;
    const now = Date.now();
    if (a.deaths >= 2) {
      a.status = 'tombstone';
      a.resetAt = now + ARENA.TOMBSTONE_MS;
      a.ghostUntil = 0;
    } else {
      a.status = 'ghost';
      a.ghostUntil = now + ARENA.GHOST_MS;
      a.resetAt = 0;
    }
    state.battle.losses = (state.battle.losses || 0) + 1;
    state.flags.working = false;
    state.flags.sleeping = false;
    state.activity = null;
    const msg = a.status === 'tombstone'
      ? `🪦 ${state.pet.name} FULLY died fighting ${mon.name}! Buy the Special Reincarnation Stone (150,000 gold) in the Shop — or the game resets in 24h!`
      : `👻 ${state.pet.name} died fighting ${mon.name}! Ghost mode for 1 hour — buy a Reincarnation Stone (1,000 gold) in the Shop to revive instantly.`;
    return { ok: true, arena: arenaSnapshot(state), message: msg };
  }
  const gold = Math.max(0, Math.min(Math.round(Number(payload.gold) || 0), mon.coins[1]));
  const xp = Math.max(0, Math.min(Math.round(Number(payload.xp) || 0), mon.xp));
  const preLevel = state.pet.level;
  if (state.pet.stage !== 'egg') state.pet.xp += xp * currentXpMul(state);
  state.coins += gold;
  state.stats.coinsEarned += gold;
  applyLevelUps(state);
  state.battle.wins = (state.battle.wins || 0) + 1;
  return { ok: true, arena: arenaSnapshot(state), gold, xp, leveledUp: state.pet.level > preLevel, message: gold || xp ? `🏆 Victory over ${mon.name}! +🪙${gold} +${xp} XP` : null };
}

function arenaRevive(state, payload) {
  const a = state.arena || (state.arena = { deaths: 0, status: 'alive', ghostUntil: 0, resetAt: 0 });
  if (a.status === 'alive') return { ok: false, message: `${state.pet.name} is alive and well!` };
  const kind = payload && payload.kind;
  if (a.status === 'ghost' && kind !== 'reincarnation') return { ok: false, message: 'A Reincarnation Stone revives a Ghost — the Special Stone is for Tombstones.' };
  if (a.status === 'tombstone' && kind !== 'special') return { ok: false, message: 'Only the Special Reincarnation Stone can revive a Tombstone.' };
  const price = a.status === 'tombstone' ? ARENA.SPECIAL_STONE_COST : (a.deaths <= 1 ? ARENA.STONE_COST_FIRST : ARENA.STONE_COST_REPEAT);
  if ((state.coins || 0) < price) return { ok: false, message: `🪙 Not enough gold — the stone costs ${price.toLocaleString('en-US')}.` };
  state.coins -= price;
  a.status = 'alive';
  a.ghostUntil = 0;
  a.resetAt = 0;
  return { ok: true, arena: arenaSnapshot(state), message: `✨ ${state.pet.name} was reborn! (-🪙${price.toLocaleString('en-US')})` };
}

const PERK_TYPES = {
  coins: { id: 'coins', icon: '\u{1FA99}', name: 'Golden Touch' },
  xp: { id: 'xp', icon: '\u2B50', name: 'Star Spirit' },
  energy: { id: 'energy', icon: '\u{1F50B}', name: 'Iron Heart' },
  rest: { id: 'rest', icon: '\uD83D\uDE34', name: 'Deep Dreams' },
};
const PERK_COMMON = { coins: 0.05, xp: 0.05, energy: 0.04, rest: 0.1 };
const PERK_EPIC_MUL = 3;
const PERK_EPIC_CHANCE = 0.01;

function perkPct(state, kind) {
  const p = state.perks;
  return p && typeof p[kind] === 'number' ? p[kind] : 0;
}

function currentXpMul(state) {
  const effectMul = state.effects.xpMulUntil && Date.now() < state.effects.xpMulUntil
    ? state.effects.xpMul || 1
    : 1;
  return effectMul * (1 + perkPct(state, 'xp') + (collectionBonusesOf(state).totals.xpBonusPct || 0));
}

function perkDesc(perk) {
  const b = Math.round(perk.bonus * 100);
  if (perk.type === 'coins') return `+${b}% coin earnings (work & battles)`;
  if (perk.type === 'xp') return `+${b}% XP from everything`;
  if (perk.type === 'energy') return `Energy drains ${b}% slower (longer life!)`;
  return `Sleep recovers +${b}% energy`;
}

function perkName(perk) {
  const base = PERK_TYPES[perk.type] ? PERK_TYPES[perk.type].name : perk.type;
  return perk.rarity === 'epic' ? `\u2728 Epic ${base}` : base;
}

function perkIcon(type) {
  return PERK_TYPES[type] ? PERK_TYPES[type].icon : '\uD83E\uDDF0';
}

function rollPerkChoices() {
  const types = ['coins', 'xp', 'energy', 'rest'].sort(() => Math.random() - 0.5).slice(0, 3);
  return {
    at: Date.now(),
    choices: types.map((type) => {
      const epic = Math.random() < PERK_EPIC_CHANCE;
      return { type, rarity: epic ? 'epic' : 'common', bonus: PERK_COMMON[type] * (epic ? PERK_EPIC_MUL : 1) };
    }),
  };
}

function choosePerk(state, index) {
  const gate = deadGate(state);
  if (gate) return gate;
  const pending = state.pendingPerk;
  if (!pending || !Array.isArray(pending.choices) || !pending.choices.length) {
    return { ok: false, message: 'No perk to claim right now \u2014 level up first! \u2B50' };
  }
  const perk = pending.choices[index];
  if (!perk) return { ok: false, message: 'Perk index out of range.' };
  state.perks = state.perks || { coins: 0, xp: 0, energy: 0, rest: 0 };
  state.perks[perk.type] = (state.perks[perk.type] || perkPct(state, perk.type)) + perk.bonus;
  state.pendingPerk = null;
  state.perksClaimed = (state.perksClaimed || 0) + 1;
  if (perk.rarity === 'epic') state.epicPerks = (state.epicPerks || 0) + 1;
  state.achievements = state.achievements || [];
  if (!state.achievements.includes('perk_1')) state.achievements.push('perk_1');
  const label = perkName(perk);
  state.stageEvents = state.stageEvents || [];
  state.stageEvents.push(`${perk.rarity === 'epic' ? '\u2728' : '\uD83E\uDDF0'} Perk claimed: ${label} \u2014 ${perkDesc(perk)}!`);
  return { ok: true, message: `\uD83E\uDDF0 ${label} unlocked: ${perkDesc(perk)}!`, perk };
}

const QUEST_REWARD = { coins: 40, xp: 15 };
function questsOf(state) {
  if (!state.quests) state.quests = { last: '', feed: 0, play: 0, clean: 0, feedClaimed: false, playClaimed: false, cleanClaimed: false };
  const today = todayKey(Date.now());
  const q = state.quests;
  if (q.last !== today) {
    q.last = today;
    q.feed = 0; q.play = 0; q.clean = 0;
    q.feedClaimed = false; q.playClaimed = false; q.cleanClaimed = false;
  }
  return q;
}
function bumpQuest(state, kind) {
  const q = questsOf(state);
  if (q[kind] !== undefined && !q[kind + 'Claimed']) q[kind] += 1;
}
function claimQuest(state, questId) {
  const gate = deadGate(state);
  if (gate) return gate;
  if (!['feed', 'play', 'clean'].includes(questId)) return { ok: false, message: 'Unknown quest.' };
  const q = questsOf(state);
  if (q[questId + 'Claimed']) return { ok: false, message: 'Quest already claimed today.' };
  if (!q[questId]) return { ok: false, message: 'Quest not done yet today!' };
  q[questId + 'Claimed'] = true;
  state.coins += QUEST_REWARD.coins;
  state.stats.coinsEarned += QUEST_REWARD.coins;
  state.pet.xp += QUEST_REWARD.xp;
  applyLevelUps(state);
  return { ok: true, message: `\uD83C\uDF31 Daily quest complete! +${QUEST_REWARD.coins} coins +${QUEST_REWARD.xp} XP` };
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
  const colFood = collectionBonusesOf(state);
  const recMul = 1 + Math.min(0.9, colFood.totals.recoverySpeedPct || 0);
  state.meters.hunger = clamp100(state.meters.hunger + food.hunger);
  state.meters.happiness = clampMeter(state, 'happiness', state.meters.happiness + happyGain);
  if (food.energy) state.meters.energy = clampMeter(state, 'energy', state.meters.energy + food.energy * recMul);
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
  const res = applyFood(state, food, opts);
  if (res && res.ok) bumpQuest(state, 'feed');
  return res;
}

function play(state) {
  const gate = deadGate(state);
  if (gate) return gate;
  if (state.flags.sleeping) return { ok: false, message: `${state.pet.name} is sleeping...` };
  if (state.meters.energy < 8) return { ok: false, message: 'Too tired to play.' };
  state.meters.energy = clamp100(state.meters.energy - 8);
  state.meters.happiness = clampMeter(state, 'happiness', state.meters.happiness + 10 * (1 + 0.25 * state.upgrades.toys));
  state.stats.playCount += 1;
  bumpQuest(state, 'play');
  state.pet.xp += 4 * currentXpMul(state);
  state.effects.happyUntil = Math.max(state.effects.happyUntil, Date.now() + 5000);
  applyLevelUps(state);
  return { ok: true, message: `You played with ${state.pet.name}!` };
}

function petPat(state) {
  const gate = deadGate(state);
  if (gate) return gate;
  if (state.flags.sleeping) return { ok: false, message: 'Shh... sleeping.' };
  state.meters.happiness = clampMeter(state, 'happiness', state.meters.happiness + 1.5);
  let msg = '';
  if (state.pet.stage === 'egg') {
    state.pet.xp += 1;
    applyLevelUps(state);
    const prog = Math.min(100, Math.round((state.pet.xp / 14) * 100));
    msg = state.pet.stage !== 'egg' ? null : `🥚 ${prog}% — keep patting!`;
  }
  return { ok: true, message: msg };
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
  if (effective < 60 || state.dead) return null;
  const coinsBefore = state.coins;
  const xpBefore = state.pet.xp;
  tick(state, effective, true);
  return {
    seconds: effective,
    coins: Math.max(0, state.coins - coinsBefore),
    xp: Math.max(0, state.pet.xp - xpBefore),
  };
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
  const streak = ((state.daily && state.daily.streak) || 0);
  const cycleDay = (streak % 7) + 1;
  return (cycleDay <= 5 ? 15 : cycleDay === 6 ? 50 : 300) + 10;
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
  if (typeof dc.attendance !== 'number') dc.attendance = 0;
  dc.attendance += 1;
  const cycleDay = ((dc.streak - 1) % 7) + 1;
  const streakReward = cycleDay <= 5 ? 15 : cycleDay === 6 ? 50 : 300;
  const attendanceBonus = 10;
  let total = streakReward + attendanceBonus;
  state.coins += total;
  state.stats.coinsEarned += total;
  let extra = '';
  if (dc.attendance >= 30) {
    const gearPool = GEAR.filter((g) => g.rarity === 'rare' || g.rarity === 'epic');
    const gift = gearPool[Math.floor(Math.random() * gearPool.length)];
    dc.attendance = 0;
    if (Math.random() < 0.7) {
      if (!state.gearOwned.includes(gift.id)) {
        state.gearOwned.push(gift.id);
        extra = ` 🎉 30-DAY ATTENDANCE GIFT: ${gift.icon} ${gift.name} unlocked in the Gear Forge!`;
      } else {
        state.coins += 500;
        extra = ' 🎉 30-day attendance gift: +500 bonus coins (gear duplicate)!';
      }
    } else {
      state.coins += 200;
      state.stats.coinsEarned += 200;
      extra = ' 🎁 30-day attendance — gift gods felt shy today: +200 consolation coins!';
    }
  }
  state.effects.happyUntil = Math.max(state.effects.happyUntil, Date.now() + 5000);
  const events = [];
  checkAchievements(state, events);
  fireStageEvents(state, events);
  return { ok: true, message: `🔥 Day ${dc.streak} streak! +${streakReward} coins +${attendanceBonus} attendance!${extra}${events.length ? '\n' + events[events.length - 1].message : ''}` };
}

function fireStageEvents(state, out) {
  if (Array.isArray(state.stageEvents)) {
    for (const msg of state.stageEvents) out.push({ ok: true, message: msg });
    state.stageEvents = null;
  }
}

function claimFreeFood(state) {
  const gate = deadGate(state);
  if (gate) return gate;
  if (!state.freeFood) state.freeFood = { last: null };
  const tk = todayKey(Date.now());
  if (state.freeFood.last === tk) return { ok: false, message: '\ud83c\udf81 Free meal na-claim na today \u2014 balik ka ng 12:00mn!' };
  const foodIds = Object.keys(FOODS);
  const pick = foodIds[Math.floor(Math.random() * foodIds.length)];
  const food = FOODS[pick];
  const res = applyFood(state, food, { free: true });
  if (!res.ok) return res;
  state.freeFood.last = tk;
  return { ok: true, message: `\ud83c\udf81 FREE meal today: ${food.flag || ''} ${food.name}! ${res.message}` };
}

function buySkin(state, skinId) {
  const skin = SKINS[skinId];
  if (!skin) return { ok: false, message: 'Unknown skin.' };
  if (skin.gachaOnly) return { ok: false, message: '\ud83c\udfaf This skin is a gacha exclusive \u2014 try your luck!' };
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
    quests: state.quests,
    skin: state.skin,
    skinsOwned: state.skinsOwned,
    playdays: state.playdays,
    statPoints: state.statPoints,
    allocated: state.allocated,
    gear: state.gear,
    gearOwned: state.gearOwned,
    gearGacha: state.gearGacha,
    path: state.path,
    battle: state.battle,
    waste: state.waste,
    items: state.items,
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
  if (payload.playdays) state.playdays = payload.playdays;
  if (typeof payload.statPoints === 'number') state.statPoints = payload.statPoints;
  if (payload.allocated) state.allocated = payload.allocated;
  if (payload.gear) state.gear = payload.gear;
  if (Array.isArray(payload.gearOwned)) state.gearOwned = payload.gearOwned;
  if (payload.gearGacha) state.gearGacha = payload.gearGacha;
  if (payload.path) state.path = payload.path;
  if (payload.battle) state.battle = payload.battle;
  if (Array.isArray(payload.waste)) state.waste = payload.waste;
  if (payload.items) state.items = payload.items;
  state.activity = null;
  state.activityCooldowns = {};
  state.neglect = 0;
  state.dead = kept;
  ensureState(state);
  return { ok: true, message: `Save imported! Welcome back, ${state.pet.name}.` };
}

function resetToEgg(state) {
  const kept = { achievements: state.achievements, daily: state.daily, skinsOwned: state.skinsOwned, gacha: state.gacha, skin: state.skin, gearGacha: state.gearGacha, itemsOwned: state.items ? state.items.owned : [], collection: state.collection };
  const fresh = defaultState();
  Object.keys(state).forEach((key) => { delete state[key]; });
  Object.assign(state, fresh);
  state.achievements = kept.achievements;
  state.daily = kept.daily;
  state.skinsOwned = kept.skinsOwned;
  state.gacha = kept.gacha;
  state.gearGacha = kept.gearGacha;
  state.skin = kept.skinsOwned.includes(kept.skin) ? kept.skin : 'classic';
  state.items = { owned: kept.itemsOwned || [], equipped: fresh.items.equipped };
  state.collection = kept.collection && kept.collection.seen ? kept.collection : { seen: {} };
}

function newGame(state) {
  if (!state.dead) return { ok: false, message: 'Your buddy is still alive! (Reset progress in footer if you really want to start over.)' };
  resetToEgg(state);
  return { ok: true, message: '🌱 A new egg awaits! Take good care of your next buddy.' };
}

const SHOP_PETS = [
  { id: 'dragon', name: 'Dragon', icon: '\ud83d\udc09', cost: 1000000, desc: 'Legendary Flame Dragon \u2014 Bakunawa kin. NEVER in eggs, only here!' },
  { id: 'nila', name: 'Nila', icon: '\ud83e\udd9a', cost: 1000000, desc: 'Royal Indian Peacock \u2014 Feather Storm royalty. NEVER in eggs, only here!' },
];

function buyShopPet(state, petId) {
  const gate = deadGate(state);
  if (gate) return gate;
  const def = SHOP_PETS.find((pt) => pt.id === petId);
  if (!def) return { ok: false, message: 'Unknown pet.' };
  if (state.pet.species === def.id) return { ok: false, message: `\ud83d\udc09 You already have ${def.name}!` };
  if (state.coins < def.cost) return { ok: false, message: `\ud83e\ude99 Not enough coins \u2014 ${def.name} costs ${def.cost.toLocaleString('en-US')}! Work + battle + invest para sa 1,000,000!` };
  state.coins -= def.cost;
  state.pet.species = def.id;
  markCollection(state);
  checkAchievements(state, []);
  if (state.pet.stage !== 'egg') {
    return { ok: true, message: `\ud83d\udc09 ADOPTED! ${def.name} joins as your active buddy \u2014 same level, same heart, new flames!` };
  }
  return { ok: true, message: `\ud83e\udd63 Dragon egg claimed! It will hatch as ${def.name}!` };
}

function derivedStats(state) {
  const now = Date.now();
  const stage = stageOf(state);
  const nextStage = STAGES.find((st) => st.minLevel > state.pet.level) || null;
  return {
    arena: arenaSnapshot(state),
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
      attendance: (state.daily && state.daily.attendance) || 0,
    },
    rewards: {
      freePullAvailable: !(state.freePulls && state.freePulls.last === todayKey(now)),
      freeFoodAvailable: !(state.freeFood && state.freeFood.last === todayKey(now)),
    },
    quests: (function () {
      const q = questsOf(state);
      return { feed: q.feed, play: q.play, clean: q.clean, feedClaimed: q.feedClaimed, playClaimed: q.playClaimed, cleanClaimed: q.cleanClaimed, rewardCoins: QUEST_REWARD.coins, rewardXp: QUEST_REWARD.xp };
    })(),
    milestones: state.milestones ? { ...state.milestones } : { rename60: false, pathReset100: false, coins150: false, badge300: false },
    petShop: SHOP_PETS.map((pt) => ({
      ...pt,
      owned: state.pet.species === pt.id,
      affordable: state.coins >= pt.cost,
    })),
    achievements: ACHIEVEMENTS.map((a) => ({
      id: a.id, icon: a.icon, name: a.name, desc: a.desc,
      unlocked: Array.isArray(state.achievements) && state.achievements.includes(a.id),
    })),
    skins: Object.values(SKINS).map((sk) => ({
      ...sk,
      owned: Array.isArray(state.skinsOwned) && state.skinsOwned.includes(sk.id),
      equipped: state.skin === sk.id,
    })),
    gacha: {
      pulls: state.gacha ? state.gacha.pulls : 0,
      fiveStars: state.gacha ? state.gacha.fiveStars : 0,
      mythics: state.gacha ? state.gacha.mythics : 0,
      cost: GACHA.cost,
      multiCost: GACHA.multiCost,
      multiCount: GACHA.multiCount,
      rates: GACHA.rates,
    },
    danger: Math.max(0, Math.min(1, (state.neglect || 0) / DEATH_SECONDS)),
    dead: state.dead,
    stats: state.stats,
    waste: (state.waste || []).map((w, i) => ({ ...w, index: i })),
    rpg: rpgStats(state),
    collection: (function () {
      const bonuses = collectionBonusesOf(state);
      const kit = activePetKitOf(state);
      return {
        totals: bonuses.totals,
        caps: BS && BS.GLOBAL_CAPS ? BS.GLOBAL_CAPS : {},
        count: collectionOf(state).length,
        activeKit: kit ? {
          source: kit.source,
          isEvo: kit.isEvo,
          skill: { ...kit.skill },
          talent: { ...kit.talent },
          passive: { ...kit.passive },
        } : null,
        eggCharm: (!kit && state.pet.stage === 'egg' && BS && BS.EGG_CHARM) ? BS.EGG_CHARM : null,
      };
    })(),
    perks: {
      bonuses: state.perks ? { ...state.perks } : { coins: 0, xp: 0, energy: 0, rest: 0 },
      pending: state.pendingPerk && Array.isArray(state.pendingPerk.choices) ? {
        at: state.pendingPerk.at,
        choices: state.pendingPerk.choices.map((c) => ({ ...c, name: perkName(c), desc: perkDesc(c), icon: perkIcon(c.type) })),
      } : null,
      claimed: state.perksClaimed || 0,
      epics: state.epicPerks || 0,
    },
    settings: state.settings ? { ...state.settings } : { bgmOn: true, bgmVol: 0.5, sfxVol: 0.7, pixelGraphics: true },
  };
}

function setSettings(state, payload) {
  if (!state.settings) state.settings = { bgmOn: true, bgmVol: 0.5, sfxVol: 0.7, pixelGraphics: true, theme: 'classic', wallPaw: 'auto' };
  if (!payload || typeof payload !== 'object') return { ok: false, message: 'No settings given.' };
  const t = state.settings;
  if (payload.bgmOn !== undefined) t.bgmOn = !!payload.bgmOn;
  if (payload.pixelGraphics !== undefined) t.pixelGraphics = !!payload.pixelGraphics;
  if (payload.theme !== undefined && ['classic', 'mint', 'sky', 'berry', 'violet', 'sunset'].includes(payload.theme)) t.theme = payload.theme;
  if (payload.wallPaw !== undefined && ['auto', 'cream', 'sky_blue', 'sakura_pink', 'mint_green', 'lavender', 'peach', 'dark_coffee', 'aqua', 'sunshine_yellow', 'periwinkle'].includes(payload.wallPaw)) t.wallPaw = payload.wallPaw;
  for (const k of ['bgmVol', 'sfxVol']) {
    if (payload[k] !== undefined) {
      let v = Number(payload[k]);
      if (!Number.isNaN(v)) {
        if (v > 1) v = v / 100;
        t[k] = Math.max(0, Math.min(1, v));
      }
    }
  }
  return { ok: true, message: 'Settings saved.', settings: { ...t } };
}

const WASTE_CAP = 5;

function spawnWaste(state) {
  if (!state.waste) state.waste = [];
  if (state.waste.length >= WASTE_CAP) return;
  state.waste.push({
    kind: Math.random() < 0.55 ? 'poop' : 'pee',
    x: 60 + Math.floor(Math.random() * 360),
    y: 240 + Math.floor(Math.random() * 52),
    at: Date.now(),
  });
}

function cleanWaste(state, index) {
  const gate = deadGate(state);
  if (gate) return gate;
  if (!state.waste || !state.waste.length) return { ok: false, message: '\u2728 Already squeaky clean!' };
  const idx = typeof index === 'number' ? index : 0;
  const w = state.waste[idx];
  if (!w) return { ok: false, message: '\u2728 Already squeaky clean!' };
  state.waste.splice(idx, 1);
  state.meters.happiness = clampMeter(state, 'happiness', state.meters.happiness + 2);
  state.pet.xp += 1;
  applyLevelUps(state);
  bumpQuest(state, 'clean');
  return { ok: true, message: '\ud83e\uddf9 Squeaky clean! Buddy says salamat.' };
}

function slotKeyOf(it) {
  return it.type;
}

function itemsStats(state) {
  const inv = state.items || { owned: [], equipped: {} };
  const equipped = { ...inv.equipped };
  return {
    unlocked: playDaysOf(state) >= 3 || false,
    bonus: itemBonus(state),
    owned: [...inv.owned],
    equipped,
    evoStoneCount: inv.owned.filter((x) => x === EVO_STONE_ID).length,
    evolved: !!state.pet.evolved,
    evolveAt: EVOLVE_LEVEL,
    slots: ITEM_SLOTS,
    shop: ITEMS.filter((it) => it.kind !== 'equipment').map((it) => ({
      ...it,
      rarity: itemRarityOf(it),
      owned: inv.owned.includes(it.id),
      equipped: equipped[slotKeyOf(it)] === it.id,
    })),
  };
}

function rpgStats(state) {
  const now = Date.now();
  const days = playDaysOf(state);
  const gb = gearBonus(state);
  const bs = petBattleStats(state);
  return {
    daysPlayed: days,
    statPoints: state.statPoints || 0,
    allocated: { ...(state.allocated || { atk: 0, def: 0, spd: 0 }) },
    battle: { ...bs, gearBonus: gb, wins: (state.battle && state.battle.wins) || 0, losses: (state.battle && state.battle.losses) || 0 },
    path: state.path,
    cooldownMs: Math.max(0, (state.activityCooldowns.battle || 0) - now),
    items: itemsStats(state),
    unlocks: UNLOCKS.map((u) => ({ ...u, unlocked: days >= u.day, daysLeft: Math.max(0, u.day - days) })),
    monsters: MONSTERS.map((mo) => ({
      id: mo.id, icon: mo.icon, name: mo.name, lvl: mo.lvl, hp: mo.hp, atk: mo.atk, def: mo.def,
      energy: mo.energy, coins: mo.coins, xp: mo.xp,
      canFight: state.pet.stage !== 'egg' && state.pet.level >= mo.lvl && state.meters.energy >= mo.energy,
    })),
    gear: {
      slots: GEAR_SLOTS,
      equipped: { ...state.gear },
      owned: [...state.gearOwned],
      bonus: gb,
    },
    gearShop: GEAR.map((g) => ({
      ...g,
      owned: state.gearOwned.includes(g.id),
      equipped: state.gear[g.slot] === g.id,
    })),
    gearGacha: {
      cost: GEAR_GACHA.cost, multiCost: GEAR_GACHA.multiCost, multiCount: GEAR_GACHA.multiCount,
      rates: GEAR_GACHA.rates,
      poolPreview: Object.keys(GEAR_GACHA.pool).flatMap((r) => GEAR_GACHA.pool[r].map((id) => ({ rarity: r, item: gearDef(id) }))).filter((x) => x.item).map((x) => ({ rarity: x.rarity, id: x.item.id, icon: x.item.icon, name: x.item.name, slot: x.item.slot })),
      pulls: (state.gearGacha && state.gearGacha.pulls) || 0,
      fiveStars: (state.gearGacha && state.gearGacha.fiveStars) || 0,
      mythics: (state.gearGacha && state.gearGacha.mythics) || 0,
    },
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
  claimFreeFood,
  claimQuest,
  buyShopPet,
  pullGacha,
  adminAddGold,
  adminAddExp,
  buySkin,
  setSkin,
  saveCode,
  parseSaveCode,
  importSave,
  newGame,
  SKINS,
  GACHA,
  GEAR,
  GEAR_GACHA,
  UNLOCKS,
  MONSTERS,
  ITEMS,
  ITEM_SLOTS,
  SHOP_PETS,
  markCollection,
  collectionOf,
  collectionBonusesOf,
  activePetKitOf,
  meterCap,
  EVOLVE_LEVEL,
  EVO_STONE_ID,
  buyItem,
  equipItem,
  useEvoStone,
  itemBonus,
  setSettings,
  choosePerk,
  PERK_TYPES,
  PERK_EPIC_CHANCE,
  allocateStat,
  battleMonster,
  arenaResult,
  arenaRevive,
  arenaSnapshot,
  ARENA,
  buyGear,
  equipGear,
  pullGearGacha,
  choosePath,
  cleanWaste,
  spawnWaste,
  petBattleStats,
  rpgUnlocked,
  ACHIEVEMENTS,
  STAGES,
  DEATH_SECONDS,
};

});
