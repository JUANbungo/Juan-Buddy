'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PAD_DIR = path.join(__dirname, '..', 'pad');
const FILE_COUNT = 5;
const TOTAL_MB = Math.max(0, Math.round(Number(process.env.PAD_MB) || 500));

if (TOTAL_MB === 0) {
  console.log('PAD_MB=0 — skipping content generation.');
  process.exit(0);
}

const perFile = Math.floor(TOTAL_MB / FILE_COUNT);
const leftovers = TOTAL_MB - perFile * FILE_COUNT;

fs.mkdirSync(PAD_DIR, { recursive: true });

let generated = 0;
for (let i = 0; i < FILE_COUNT; i += 1) {
  const sizeMb = perFile + (i === 0 ? leftovers : 0);
  if (sizeMb <= 0) continue;
  const file = path.join(PAD_DIR, `pack_${String(i + 1).padStart(2, '0')}.dat`);
  const expected = sizeMb * 1024 * 1024;
  try {
    if (fs.existsSync(file) && fs.statSync(file).size === expected) continue;
  } catch (err) { /* regenerate on any stat failure */ }
  const fd = fs.openSync(file, 'w');
  const chunk = crypto.randomBytes(1024 * 1024);
  for (let mb = 0; mb < sizeMb; mb += 1) {
    fs.writeSync(fd, chunk);
  }
  fs.closeSync(fd);
  generated += 1;
}

const existing = fs.readdirSync(PAD_DIR).filter((f) => f.endsWith('.dat'));
const totalBytes = existing.reduce((sum, f) => sum + fs.statSync(path.join(PAD_DIR, f)).size, 0);
console.log(`Pad data ready: ${existing.length} files, ${Math.round(totalBytes / (1024 * 1024))} MB (${generated} newly written).`);
