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
const i18nSrc = fs.readFileSync(path.join(root, 'src', 'dashboard', 'js', 'i18n.js'), 'utf8');

console.log('i18n module');
const sandboxWindow = {};
const sandboxStorage = { getItem: () => null, setItem: () => {} };
const sandboxDocument = {
  readyState: 'complete',
  addEventListener() {},
  documentElement: {},
  querySelectorAll: () => [],
};
(function () {
  const window = sandboxWindow;
  const localStorage = sandboxStorage;
  const document = sandboxDocument;
  eval(i18nSrc);
})();
const JBI18n = sandboxWindow.JBI18n;

assert(!!JBI18n, 'window.JBI18n is exposed');
assert(Array.isArray(JBI18n.LANGS) && JBI18n.LANGS.length === 7, 'exactly 7 languages offered');
assert(
  ['en', 'fil', 'th', 'id', 'ja', 'zh', 'vi'].every((id) => JBI18n.LANGS.some((l) => l.id === id)),
  'languages are en/fil/th/id/ja/zh/vi'
);
assert(JBI18n.normalize('xx') === 'en', 'unknown language falls back to en');
assert(JBI18n.normalize('fil') === 'fil', 'filipino code accepted');

const LANG_COLUMNS = ['fil', 'th', 'id', 'ja', 'zh', 'vi'];
const keys = Object.keys(JBI18n.DICT);
assert(keys.length > 100, `dictionary is well stocked (${keys.length} keys)`);

let gaps = 0;
for (const [k, row] of Object.entries(JBI18n.DICT)) {
  for (const lang of LANG_COLUMNS) {
    if (typeof row[lang] !== 'string' || !row[lang].length) {
      gaps += 1;
      console.error(`  missing ${lang} for key: ${k.slice(0, 50)}`);
    }
  }
}
assert(gaps === 0, 'every key has a translation in all 6 non-English languages');

console.log('i18n html coverage');
const html = fs.readFileSync(path.join(root, 'src', 'dashboard', 'index.html'), 'utf8');
const decode = (t) => t
  .replace(/&amp;/g, '&')
  .replace(/&middot;/g, '\u00b7')
  .replace(/&mdash;/g, '\u2014')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
const attrs = [...html.matchAll(/data-i18n="([^"]+)"/g)].map((m) => decode(m[1]));
assert(attrs.length > 80, `html uses data-i18n widely (${attrs.length} attrs)`);
const missingInDict = [...new Set(attrs.filter((k) => !(k in JBI18n.DICT)))];
assert(missingInDict.length === 0, `all data-i18n keys exist in dictionary (missing: ${missingInDict.join(' | ')})`);

console.log('i18n script is loaded before dashboard.js');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
const i18nIdx = scripts.indexOf('js/i18n.js');
const dashIdx = scripts.indexOf('dashboard.js');
assert(i18nIdx !== -1, 'i18n.js script tag present');
assert(dashIdx !== -1 && i18nIdx < dashIdx, 'i18n.js loads before dashboard.js');

console.log('new settings ids exist');
for (const id of ['set-fps', 'set-fps-counter', 'set-quality', 'set-bit', 'set-lang', 'splash-lang', 'fps-chip']) {
  assert(html.includes(`id="${id}"`), `html has #${id}`);
}

console.log('engine settings persistence');
const engineSrc = fs.readFileSync(path.join(root, 'src', 'engine', 'engine.js'), 'utf8');
for (const key of ['fpsCap', 'fpsCounter', 'gfxQuality', 'bitMode', 'lang']) {
  assert(engineSrc.includes(key), `engine handles settings key ${key}`);
}

console.log('settings wiring');
const dashSrc = fs.readFileSync(path.join(root, 'src', 'dashboard', 'dashboard.js'), 'utf8');
for (const id of ['set-fps', 'set-fps-counter', 'set-quality', 'set-bit', 'set-lang', 'splash-lang', 'fps-chip']) {
  assert(dashSrc.includes(`'${id}'`), `dashboard.js references #${id}`);
}
assert(dashSrc.includes('function applyQuality'), 'dashboard.js has applyQuality');
assert(dashSrc.includes('function applyBitMode'), 'dashboard.js has applyBitMode');
assert(dashSrc.includes('function tickFps'), 'dashboard.js has tickFps');
assert(dashSrc.includes('wantsSmooth()'), 'dashboard.js centralizes smoothing via wantsSmooth');

console.log('baywalk people + kalesa removed');
assert(!dashSrc.includes('walking_people_4f.png'), 'walking people sprite removed from baywalk');
assert(!dashSrc.includes('kalesa_4f.png'), 'kalesa sprite removed from baywalk');
assert(dashSrc.includes('sea_birds_4f.png'), 'sea birds kept in baywalk');

console.log('battle arena translations');
const arenaSrc = fs.readFileSync(path.join(root, 'src', 'dashboard', 'js', 'battle-arena.js'), 'utf8');
assert(arenaSrc.includes('tr("Choose an enemy below and click Fight!")'), 'arena log string translated');
assert(arenaSrc.includes('Choose your opponent")'), 'arena title translated');
assert(arenaSrc.includes('tr("Selected")'), 'arena Selected translated');

console.log('eco particles setEnabled');
const ecoSrc = fs.readFileSync(path.join(root, 'src', 'dashboard', 'js', 'eco-particles.js'), 'utf8');
assert(ecoSrc.includes('setEnabled'), 'JuanBuddyEco exposes setEnabled');
assert(ecoSrc.includes('isEnabled'), 'JuanBuddyEco exposes isEnabled');

console.log('mobile workflow uploads APK/IPA to releases');
const wf = fs.readFileSync(path.join(root, '.github', 'workflows', 'build.yml'), 'utf8');
assert(wf.includes('softprops/action-gh-release'), 'workflow publishes GitHub releases');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
