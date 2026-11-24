'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { decodePNG, scaleImage, encodeImagePNG } = require('./make-icons-from-png');

const root = path.join(__dirname, '..');

const { ICON_PNG_BASE64, TRAY_PNG_BASE64 } = require(path.join(root, 'assets', 'icons.js'));

const assetsDir = path.join(root, 'assets');
fs.mkdirSync(assetsDir, { recursive: true });
fs.writeFileSync(path.join(assetsDir, 'icon.png'), Buffer.from(ICON_PNG_BASE64, 'base64'));
fs.writeFileSync(path.join(assetsDir, 'tray.png'), Buffer.from(TRAY_PNG_BASE64, 'base64'));

console.log('Wrote assets/icon.png and assets/tray.png from assets/icons.js');
