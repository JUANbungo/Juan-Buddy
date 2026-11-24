'use strict';

const api = window.BuddyAPI;
const { PET_ROSTER, FRAMES_PER_STATE, ensurePetSprites } = require('../pet/sprites.js');

const canvas = document.getElementById('pet-canvas');
const ctx = canvas.getContext('2d');
const bubble = document.getElementById('bubble');

const PX_SCALE = 7;
const FRAME_MS = 170;

let snapshot = null;
let bubbleTimer = null;
const particles = [];
let lastPat = 0;
let patFrameUntil = 0;
let currentSpecies = null;

canvas.width = 240;
canvas.height = 250;

function petStateFor(now) {
  if (!snapshot) return 'IDLE';
  const s = snapshot.state;
  if (s.flags.sleeping) return 'SLEEP';
  if (s.effects && s.effects.eatUntil > now) return 'EAT';
  if (s.effects && s.effects.happyUntil > now) return 'HAPPY';
  return s.activity || s.flags.working ? 'WALK' : 'IDLE';
}

function showBubble(text, ms) {
  bubble.textContent = text;
  bubble.classList.remove('hidden');
  clearTimeout(bubbleTimer);
  if (ms) bubbleTimer = setTimeout(() => bubble.classList.add('hidden'), ms);
}

function spawnParticle(kind, x, y) {
  particles.push({
    kind,
    x: x + (Math.random() * 50 - 25),
    y,
    vy: -(0.5 + Math.random() * 0.5),
    life: 1,
    size: kind === 'z' ? 15 + Math.random() * 8 : 18,
    wobble: Math.random() * Math.PI * 2,
  });
}

function drawParticles() {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.y += p.vy * 2.4;
    p.wobble += 0.06;
    p.x += Math.sin(p.wobble) * 0.6;
    p.life -= 0.01;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    ctx.save();
    ctx.globalAlpha = Math.min(1, p.life);
    ctx.font = `${p.size}px sans-serif`;
    ctx.textAlign = 'center';
    const glyphs = { heart: '❤', coin: '🪙', z: 'z' };
    ctx.fillStyle = p.kind === 'heart' ? '#ff6b81' : p.kind === 'coin' ? '#ffd166' : '#ffffff';
    ctx.fillText(glyphs[p.kind] || '✦', p.x, p.y);
    ctx.restore();
  }
}

function shadow(cx, y) {
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(cx, y, 56, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPet(now) {
  const cx = 120;
  const groundY = 224;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  shadow(cx, groundY);
  drawParticles();

  if (!snapshot) return;

  const speciesId = snapshot.state.pet.species || 'kala';
  if (speciesId !== currentSpecies) {
    currentSpecies = speciesId;
  }
  const bank = ensurePetSprites(speciesId);
  if (!bank) return;

  const state = petStateFor(now);
  const frame = Math.floor(now / FRAME_MS) % FRAMES_PER_STATE;
  const sprite = bank.frames[state][frame];

  const bobbing = state === 'HAPPY' || state === 'WALK';
  const yOff = bobbing ? Math.round(Math.sin(now / 260) * 4) : 0;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const dw = 32 * PX_SCALE;
  const dh = 32 * PX_SCALE;
  ctx.drawImage(sprite, cx - dw / 2, groundY - dh + yOff - 26, dw, dh);
  ctx.restore();

  if (state === 'SLEEP' && frame % 2 === 0 && Math.random() < 0.02) {
    spawnParticle('z', cx + 30, groundY - 190);
  }
  if ((snapshot.state.flags.working || snapshot.state.activity) && Math.floor(now / 3400) % 2 === 0 && frame === 0) {
    spawnParticle('coin', cx + (Math.random() < 0.5 ? -40 : 40), groundY - 160);
  }
  if (now < patFrameUntil) {
    spawnParticle('heart', cx + 20, groundY - 180);
  }
}

canvas.addEventListener('click', async (e) => {
  const now = performance.now();
  if (now - lastPat < 900) return;
  lastPat = now;
  patFrameUntil = now + 700;
  const res = await api.action('pat');
  const name = snapshot ? snapshot.state.pet.name : 'Buddy';
  if (res && res.message) showBubble(res.message, 1500);
  else showBubble(`${name}: hehe~`, 1200);
});

canvas.addEventListener('dblclick', () => api.openDashboard());

window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  api.openDashboard();
});

function statusLine() {
  if (!snapshot) return '';
  const s = snapshot.state;
  if (s.flags.sleeping) return 'zZz... recharging';
  if (s.activity) {
    const info = snapshot.derived.activities.find((a) => a.id === s.activity.id);
    const secs = Math.max(0, Math.ceil((s.activity.endsAt - Date.now()) / 1000));
    return info ? `${info.name} (${secs}s)` : '';
  }
  if (s.flags.working) return `+${snapshot.derived.coinRate.toFixed(1)} coins/s`;
  return snapshot.derived.statusText;
}

function applySnapshot(snap) {
  const speciesBefore = snapshot ? snapshot.state.pet.species : null;
  snapshot = snap;
  if (snap.state.pet.species !== speciesBefore && PET_ROSTER.some((p) => p.id === snap.state.pet.species)) {
    const def = PET_ROSTER.find((p) => p.id === snap.state.pet.species);
    showBubble(def.greeting || 'Hello!', 1800);
    return;
  }
  if (snap.toast) showBubble(snap.toast, 2200);
}

setInterval(() => {
  if (bubble.classList.contains('hidden')) {
    const text = statusLine();
    if (text) showBubble(text, 1800);
  }
}, 5200);

api.onState(applySnapshot);
api.getState().then(applySnapshot);

(function loop() {
  drawPet(performance.now());
  requestAnimationFrame(loop);
})();
