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

// ==== Full desktop dashboard for GitHub Pages (browser version) ====
const pages = path.join(root, 'pages');
fs.rmSync(pages, { recursive: true, force: true });

const dashDir = path.join(pages, 'src', 'dashboard');
const petDir = path.join(pages, 'src', 'pet');
const engDir = path.join(pages, 'src', 'engine');
fs.mkdirSync(dashDir, { recursive: true });
fs.mkdirSync(petDir, { recursive: true });
fs.mkdirSync(engDir, { recursive: true });

fs.copyFileSync(path.join(root, 'src', 'dashboard', 'index.html'), path.join(dashDir, 'index.html'));
fs.copyFileSync(path.join(root, 'src', 'dashboard', 'dashboard.js'), path.join(dashDir, 'dashboard.js'));
fs.copyFileSync(path.join(root, 'src', 'dashboard', 'dashboard.css'), path.join(dashDir, 'dashboard.css'));
fs.copyFileSync(path.join(root, 'src', 'dashboard', 'browser-api.js'), path.join(dashDir, 'browser-api.js'));
fs.copyFileSync(path.join(root, 'src', 'engine', 'engine.js'), path.join(engDir, 'engine.js'));
for (const f of ['sprites.js', 'sfx.js', 'bgm.js', 'motivation.js']) {
  fs.copyFileSync(path.join(root, 'src', 'pet', f), path.join(petDir, f));
}

fs.cpSync(path.join(root, 'assets'), path.join(pages, 'assets'), {
  recursive: true,
  filter: (src) => !/\.(zip|rar)$/i.test(src),
});

fs.writeFileSync(path.join(pages, 'index.html'), [
  '<!DOCTYPE html>',
  '<html lang="en">',
  '<head>',
  '  <meta charset="UTF-8">',
  '  <meta http-equiv="refresh" content="0; url=src/dashboard/index.html">',
  '  <title>Juan Buddy</title>',
  '</head>',
  '<body>',
  '  <p>Loading Juan Buddy…</p>',
  '  <p><a href="src/dashboard/index.html">Click here</a> if nothing happens.</p>',
  '</body>',
  '</html>',
  '',
].join('\n'));

console.log('Prepared pages/: full desktop dashboard + assets for GitHub Pages');
