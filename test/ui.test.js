'use strict';

const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed += 1;
  } else {
    failed += 1;
    console.error(`  FAIL: ${msg}`);
  }
}

const root = path.join(__dirname, '..');

function htmlIds(html) {
  return new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]));
}

console.log('dashboard ui ids');
{
  const js = fs.readFileSync(path.join(root, 'src', 'dashboard', 'dashboard.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'src', 'dashboard', 'index.html'), 'utf8');
  const ids = new Set();
  for (const m of js.matchAll(/el\('([a-z0-9-]+)'\)/g)) ids.add(m[1]);
  for (const m of js.matchAll(/getElementById\((['"`])([^'"`]+)\1\)/g)) {
    if (/^[a-z0-9-]+$/.test(m[2])) ids.add(m[2]);
  }
  const present = htmlIds(html);
  const missing = [...ids].filter((id) => !present.has(id));
  assert(missing.length === 0, `dashboard.js references missing ids: ${missing.join(', ') || 'none'}`);
}

console.log('pet ui ids');
{
  const js = fs.readFileSync(path.join(root, 'src', 'pet', 'pet.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'src', 'pet', 'index.html'), 'utf8');
  const ids = new Set();
  for (const m of js.matchAll(/getElementById\((['"`])([^'"`]+)\1\)/g)) {
    if (/^[a-z0-9-]+$/.test(m[2])) ids.add(m[2]);
  }
  const present = htmlIds(html);
  const missing = [...ids].filter((id) => !present.has(id));
  assert(missing.length === 0, `pet.js references missing ids: ${missing.join(', ') || 'none'}`);
}

console.log('mobile ui ids');
{
  const js = fs.readFileSync(path.join(root, 'mobile', 'app.js'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'mobile', 'index.html'), 'utf8');
  const ids = new Set();
  for (const m of js.matchAll(/\$\('([a-z0-9-]+)'\)/g)) ids.add(m[1]);
  for (const m of js.matchAll(/getElementById\((['"`])([^'"`]+)\1\)/g)) {
    if (/^[a-z0-9-]+$/.test(m[2])) ids.add(m[2]);
  }
  const present = htmlIds(html);
  const missing = [...ids].filter((id) => !present.has(id));
  assert(missing.length === 0, `mobile/app.js references missing ids: ${missing.join(', ') || 'none'}`);
}

console.log('sprite asset coverage');
{
  const sprites = fs.readFileSync(path.join(root, 'src', 'pet', 'sprites.js'), 'utf8');
  const rosterIds = [...sprites.matchAll(/id: '([a-z_]+)', name:/g)].map((m) => m[1]);
  const dir = path.join(root, 'assets', 'sprites');
  const files = fs.existsSync(dir) ? new Set(fs.readdirSync(dir)) : new Set();
  const states = ['idle', 'walk', 'happy', 'eat', 'sleep'];
  let pngCount = 0;
  for (const id of rosterIds) {
    for (const st of states) {
      if (files.has(`${id}_${st}.png`)) pngCount += 1;
    }
  }
  assert(pngCount >= 45, `expected 45+ PNG sprites, found ${pngCount}`);
  for (const file of files) {
    if (file.endsWith('.png')) assert(/^[a-z]+_[a-z]+\.png$/.test(file), `bad sprite filename: ${file}`);
  }
  assert(rosterIds.length >= 14, 'roster has at least 14 pets');
}

console.log('food icon asset coverage');
{
  const sprites = fs.readFileSync(path.join(root, 'src', 'pet', 'sprites.js'), 'utf8');
  const foodIds = new Set([...sprites.matchAll(/id: '([a-z_]+)', name:.*?flag:/g)].map((m) => m[1]));
  const dir = path.join(root, 'assets', 'sprites', 'food');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  for (const file of files) {
    const id = file.replace(/\.png$/, '');
    assert(foodIds.has(id), `food PNG ${file} has no matching DELICACIES id`);
  }
  assert(files.length >= 14, `expected 14+ food PNGs, found ${files.length}`);
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
