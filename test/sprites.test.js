'use strict';

const assert = require('assert');

global.document = {
  createElement() {
    return {
      width: 32,
      height: 32,
      getContext() {
        return { imageSmoothingEnabled: false, clearRect() {}, fillRect() {} };
      },
    };
  },
};

const sprites = require('../src/pet/sprites.js');

let passed = 0;
let failed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (err) {
    failed += 1;
    console.error(`FAIL: ${name} -> ${err.message}`);
  }
}

check('v2 sheet data covers 37 pets incl. egg and 18 evos', () => {
  const ids = Object.keys(sprites.PET_SHEET_ANIMS);
  assert.strictEqual(ids.length, 37, `expected 37, got ${ids.length}`);
  assert.ok(sprites.PET_SHEET_ANIMS.egg);
  const evos = ids.filter((id) => id.endsWith('_evo'));
  assert.strictEqual(evos.length, 18, `expected 18 evos, got ${evos.length}`);
});

check('roster includes all v2 pets except egg; evos are excluded from hatch pool', () => {
  assert.strictEqual(sprites.PET_ROSTER.length, 37, `roster should be 37 (36 buddies + nila-heavy legacy set), got ${sprites.PET_ROSTER.length}`);
  for (const id of Object.keys(sprites.PET_SHEET_ANIMS)) {
    if (id === 'egg') continue;
    assert.ok(sprites.PET_ROSTER.some((p) => p.id === id), `roster missing ${id}`);
  }
  for (const p of sprites.PET_ROSTER) {
    if (p.id.endsWith('_evo')) assert.strictEqual(p.shopOnly, true, `${p.id} must not be hatchable`);
  }
  assert.ok(sprites.PET_ROSTER.some((p) => p.id === 'kala' && !p.shopOnly), 'base pets hatchable');
});

check('legacy species ids alias to v2 ids everywhere', () => {
  assert.strictEqual(sprites.normalizeSpeciesId('pusa'), 'muning');
  assert.strictEqual(sprites.normalizeSpeciesId('agila'), 'banog');
  assert.strictEqual(sprites.normalizeSpeciesId('uwak'), 'gagak');
  assert.strictEqual(sprites.normalizeSpeciesId('ahas'), 'ran');
  assert.strictEqual(sprites.normalizeSpeciesId('kala'), 'kala');
  assert.strictEqual(sprites.getPetById('pusa').name, 'Muning');
  assert.strictEqual(sprites.getPetById('ahas').name, 'Ran');
  assert.strictEqual(sprites.petSheetAnim('IDLE', 'pusa'), 'idle');
  assert.strictEqual(sprites.petSheetAnim('SLEEP', 'agila'), 'sleeping');
});

check('state to animation mapping with movement anims and idle fallback', () => {
  assert.strictEqual(sprites.petSheetAnim('WALK', 'kala'), 'walking');
  assert.strictEqual(sprites.petSheetAnim('WALK', 'banog'), 'flying');
  assert.strictEqual(sprites.petSheetAnim('WALK', 'gagak_evo'), 'flying');
  assert.strictEqual(sprites.petSheetAnim('WALK', 'ran'), 'slither');
  assert.strictEqual(sprites.petSheetAnim('WALK', 'ran_evo'), 'slither');
  assert.strictEqual(sprites.petSheetAnim('WALK', 'dragon'), 'flying');
  assert.strictEqual(sprites.petSheetAnim('IDLE', 'kala'), 'idle');
  assert.strictEqual(sprites.petSheetAnim('HAPPY', 'kala'), 'idle');
  assert.strictEqual(sprites.petSheetAnim('EAT', 'kala'), 'working');
  assert.strictEqual(sprites.petSheetAnim('SLEEP', 'kala'), 'sleeping');
  assert.strictEqual(sprites.petSheetAnim('IDLE', 'egg'), 'idle');
  assert.strictEqual(sprites.petSheetAnim('SHAKING', 'egg'), 'shaking');
  assert.strictEqual(sprites.petSheetAnim('CRACK', 'egg'), 'crack');
  assert.strictEqual(sprites.petSheetAnim('FIRE_BREATH', 'dragon'), 'fire_breath');
  assert.strictEqual(sprites.petSheetAnim('EAT', 'egg'), 'idle', 'egg falls back to idle');
});

check('fps comes from the v2 manifest (idle 8, sleeping 6, walking/working/flying 10)', () => {
  assert.strictEqual(sprites.petSheetFps('muning', 'idle'), 8);
  assert.strictEqual(sprites.petSheetFps('kala', 'sleeping'), 6);
  assert.strictEqual(sprites.petSheetFps('kala', 'walking'), 10);
  assert.strictEqual(sprites.petSheetFps('kala', 'working'), 10);
  assert.strictEqual(sprites.petSheetFps('banog', 'flying'), 10);
  assert.strictEqual(sprites.petSheetFps('egg', 'shaking'), 12);
});

check('programmatic bank still bakes for legacy pets and evos', () => {
  const bank = sprites.ensurePetSprites('muning');
  assert.ok(bank.IDLE.length >= 1, 'muning IDLE frames exist');
  const evoBank = sprites.ensurePetSprites('kala_evo');
  assert.ok(evoBank.IDLE.length >= 1, 'kala_evo falls back to base frames');
  assert.ok(sprites.ensureFoodSprite('pad_thai'), 'food sprites intact');
});

check('8 frame sheets resolve at 192x192 on disk for every pet/anim pair', () => {
  const fs = require('fs');
  const path = require('path');
  for (const [pid, anims] of Object.entries(sprites.PET_SHEET_ANIMS)) {
    for (const [anim, info] of Object.entries(anims)) {
      const p = path.join(__dirname, '..', 'assets', 'pets', 'sprites', pid, `${pid}_${anim}_sheet.png`);
      assert.ok(fs.existsSync(p), `missing sheet ${p}`);
      assert.strictEqual(info.fr, 8, `${pid}.${anim} should have 8 frames`);
      assert.ok(info.fps >= 6 && info.fps <= 12, `${pid}.${anim} fps out of range`);
    }
  }
});

check('sheet frame loader is inert in Node and gif preview paths are stable', () => {
  assert.strictEqual(sprites.petSheetFrames('muning', 'idle'), null, 'no Image/document in Node');
  assert.strictEqual(sprites.petSheetGif('muning', 'idle'), '../../assets/pets/sprites/muning/muning_idle.gif');
  assert.strictEqual(sprites.petSheetGif('egg', 'shaking'), '../../assets/pets/sprites/egg/egg_shaking.gif');
  assert.strictEqual(sprites.petSheetGif('ghost', 'idle'), null);
});

process.stdout.write(`${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
