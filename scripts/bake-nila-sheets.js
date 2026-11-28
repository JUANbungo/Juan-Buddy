'use strict';

const fs = require('fs');
const path = require('path');
const sprites = require('../src/pet/sprites.js');

const OUT = path.join(__dirname, '..', 'assets', 'pets', 'sprites', 'nila');
fs.mkdirSync(OUT, { recursive: true });

const ANIM_OF = { IDLE: 'idle', SLEEP: 'sleeping', WALK: 'walking', EAT: 'working' };
const WARDROBE = { head: null, neck: null, back: null, weapon: null, armor: null, relic: null };

const pet = sprites.getPetById('nila');
if (!pet || pet.id !== 'nila') throw new Error('nila not found in roster');

function bake(state) {
  const frames = [];
  for (let f = 0; f < sprites.FRAMES_PER_STATE; f += 1) {
    const g = new sprites.PixelGrid(32, 32);
    pet.drawFrame(g, state, f, WARDROBE);
    frames.push(g.grid.map((row) => row.slice()));
  }
  return frames;
}

const out = {};
for (const [state, anim] of Object.entries(ANIM_OF)) {
  const baked = bake(state);
  const doubled = [];
  for (const fr of baked) { doubled.push(fr); doubled.push(fr); }
  out[anim] = { grid: doubled, colors: collectColors(doubled) };
}

function collectColors(frames) {
  const set = new Set();
  for (const fr of frames) for (const row of fr) for (const c of row) if (c) set.add(c);
  return [...set];
}

fs.writeFileSync(path.join(OUT, 'nila_grid.json'), JSON.stringify(out));
console.log('baked nila anims:', Object.keys(out).join(', '));
