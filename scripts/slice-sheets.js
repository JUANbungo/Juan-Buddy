'use strict';

const fs = require('fs');
const path = require('path');
const { decodePNG, encodeImagePNG } = require('./make-icons-from-png');

const root = path.join(__dirname, '..');
const srcDir = process.argv[2] || path.join(root, 'assets', 'sheets-src');
const outDir = path.join(root, 'assets', 'sprites');
const STATES = ['idle', 'walk', 'happy', 'eat', 'sleep'];
const FRAMES = 4;
const CELL = 128;

function crop(img, col, row) {
  const out = Buffer.alloc(CELL * CELL * 4);
  for (let y = 0; y < CELL; y += 1) {
    const src = ((row * CELL + y) * img.width + col * CELL) * 4;
    img.pixels.copy(out, y * CELL * 4, src, src + CELL * 4);
  }
  return { width: CELL, height: CELL, pixels: out };
}

fs.mkdirSync(srcDir, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });
let count = 0;
for (const file of fs.readdirSync(srcDir).sort()) {
  const m = file.match(/^([a-z]+)_sheet\.png$/);
  if (!m) continue;
  const id = m[1];
  const sheet = decodePNG(fs.readFileSync(path.join(srcDir, file)));
  if (sheet.width !== CELL * FRAMES || sheet.height !== CELL * STATES.length) {
    console.error(`SKIP ${file}: unexpected size ${sheet.width}x${sheet.height}`);
    continue;
  }
  for (let r = 0; r < STATES.length; r += 1) {
    for (let c = 0; c < FRAMES; c += 1) {
      const out = path.join(outDir, `${id}_${STATES[r]}_${c}.png`);
      fs.writeFileSync(out, encodeImagePNG(crop(sheet, c, r)));
      count += 1;
    }
  }
  console.log(`sliced ${id}: ${FRAMES * STATES.length} frames`);
}
console.log(`Done: ${count} frame PNGs in ${outDir}`);
