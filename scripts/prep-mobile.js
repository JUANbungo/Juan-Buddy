'use strict';

const fs = require('fs');
const path = require('path');
const { decodePNG, scaleImage, encodeImagePNG } = require('./make-icons-from-png');

const root = path.join(__dirname, '..');
const mobile = path.join(root, 'mobile');

fs.mkdirSync(path.join(mobile, 'icons'), { recursive: true });

fs.copyFileSync(path.join(root, 'src', 'pet', 'sprites.js'), path.join(mobile, 'sprites.js'));
fs.copyFileSync(path.join(root, 'src', 'engine', 'engine.js'), path.join(mobile, 'engine.js'));
fs.copyFileSync(path.join(root, 'src', 'pet', 'motivation.js'), path.join(mobile, 'motivation.js'));
fs.copyFileSync(path.join(root, 'src', 'pet', 'sfx.js'), path.join(mobile, 'sfx.js'));
fs.copyFileSync(path.join(root, 'src', 'pet', 'bgm.js'), path.join(mobile, 'bgm.js'));

fs.mkdirSync(path.join(mobile, 'sprites'), { recursive: true });
fs.cpSync(path.join(root, 'assets', 'sprites'), path.join(mobile, 'sprites'), { recursive: true });
fs.cpSync(path.join(root, 'assets', 'bgm'), path.join(mobile, 'bgm'), { recursive: true });

const icon = decodePNG(Buffer.from(require(path.join(root, 'assets', 'icons.js')).ICON_PNG_BASE64, 'base64'));
for (const size of [180, 192, 512]) {
  fs.writeFileSync(path.join(mobile, 'icons', `icon-${size}.png`), encodeImagePNG(scaleImage(icon, size)));
}

console.log('Prepared mobile/: sprites.js, engine.js, motivation.js, sfx.js, bgm.js, sprites/, bgm/, icons/');
