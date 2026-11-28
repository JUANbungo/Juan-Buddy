'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

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
fs.cpSync(path.join(root, 'src', 'dashboard', 'css'), path.join(dashDir, 'css'), { recursive: true });
fs.cpSync(path.join(root, 'src', 'dashboard', 'js'), path.join(dashDir, 'js'), { recursive: true });
fs.cpSync(path.join(root, 'src', 'dashboard', 'assets'), path.join(dashDir, 'assets'), { recursive: true });
fs.copyFileSync(path.join(root, 'src', 'engine', 'engine.js'), path.join(engDir, 'engine.js'));
for (const f of ['sprites.js', 'sfx.js', 'bgm.js', 'motivation.js', 'battle-skills.js']) {
  fs.copyFileSync(path.join(root, 'src', 'pet', f), path.join(petDir, f));
}

fs.cpSync(path.join(root, 'assets'), path.join(pages, 'assets'), {
  recursive: true,
  filter: (src) => !/\.(zip|rar)$/i.test(src),
});

const bustVersion = String(Math.floor(Date.now() / 1000));
const dashIndex = path.join(dashDir, 'index.html');
const bustHtml = fs
  .readFileSync(dashIndex, 'utf8')
  .replace(/(src="[^"?]+\.js)"/g, `$1?v=${bustVersion}"`)
  .replace(/(href="[^"?]+\.css)"/g, `$1?v=${bustVersion}"`);
fs.writeFileSync(dashIndex, bustHtml);

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

// PWA manifest + app icons (phone home-screen install / iOS Add to Home Screen)
fs.copyFileSync(path.join(root, 'manifest.webmanifest'), path.join(pages, 'manifest.webmanifest'));
fs.cpSync(path.join(root, 'assets', 'branding', 'icons'), path.join(pages, 'assets', 'branding', 'icons'), { recursive: true });

console.log('Prepared pages/: full desktop dashboard + assets for GitHub Pages / APK (webDir)');
