'use strict';

const fs = require('fs');
const path = require('path');
const { readPNG, scaleImage, encodeImagePNG } = require('./make-icons-from-png');

const root = path.join(__dirname, '..');
const base = path.join(root, 'android', 'app', 'src', 'main', 'res');
const img = readPNG(path.join(root, process.argv[2] || 'new-icon.png'));

const densities = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
for (const [d, size] of Object.entries(densities)) {
  const folder = path.join(base, `mipmap-${d}`);
  if (!fs.existsSync(folder)) continue;
  const square = encodeImagePNG(scaleImage(img, size));
  fs.writeFileSync(path.join(folder, 'ic_launcher.png'), square);
  fs.writeFileSync(path.join(folder, 'ic_launcher_round.png'), square);
  const outer = Math.round((size * 108) / 72);
  const scaled = scaleImage(img, Math.round(outer * 0.6));
  const canvas = Buffer.alloc(outer * outer * 4);
  const off = Math.floor((outer - scaled.width) / 2);
  for (let y = 0; y < scaled.height; y++) {
    scaled.pixels.copy(
      canvas,
      (y + off) * outer * 4 + off * 4,
      y * scaled.width * 4,
      (y + 1) * scaled.width * 4,
    );
  }
  fs.writeFileSync(path.join(folder, 'ic_launcher_foreground.png'), encodeImagePNG({ width: outer, height: outer, pixels: canvas }));
}

console.log('Android launcher icons updated from', path.basename(process.argv[2] || 'new-icon.png'));
