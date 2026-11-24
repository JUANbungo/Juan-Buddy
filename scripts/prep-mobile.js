'use strict';

const fs = require('fs');
const path = require('path');
const { encodePNG, drawBuddyFace } = require('./generate-icons');

const root = path.join(__dirname, '..');
const mobile = path.join(root, 'mobile');

fs.mkdirSync(path.join(mobile, 'icons'), { recursive: true });

fs.copyFileSync(path.join(root, 'src', 'pet', 'sprites.js'), path.join(mobile, 'sprites.js'));
fs.copyFileSync(path.join(root, 'src', 'engine', 'engine.js'), path.join(mobile, 'engine.js'));

for (const size of [180, 192, 512]) {
  const png = encodePNG(size, size, drawBuddyFace(size));
  fs.writeFileSync(path.join(mobile, 'icons', `icon-${size}.png`), png);
}

console.log('Prepared mobile/: sprites.js, engine.js, icons/icon-{180,192,512}.png');
