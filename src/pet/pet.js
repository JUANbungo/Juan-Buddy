'use strict';

const api = window.BuddyAPI;

const canvas = document.getElementById('pet-canvas');
const ctx = canvas.getContext('2d');
const bubble = document.getElementById('bubble');

let snapshot = null;
let bubbleTimer = null;
const particles = [];
let lastPat = 0;
let blinkAt = performance.now() + 2500;
let blinkHold = 0;
let lastCoinPop = 0;
let lastZ = 0;

const moods = {
  happy: { body: '#ffb64d', bodyDark: '#e8942a', blush: '#ff8f9e', belly: '#ffe3b3' },
  neutral: { body: '#7ddba9', bodyDark: '#53b584', blush: '#ff9fb0', belly: '#d3f5e2' },
  sad: { body: '#8fa0c9', bodyDark: '#6c7ba3', blush: '#c9a0b5', belly: '#dfe6f5' },
  sleep: { body: '#9b8fd8', bodyDark: '#7a6cbf', blush: '#d9a0c0', belly: '#e4defc' },
};

function currentPalette() {
  if (!snapshot) return moods.neutral;
  const s = snapshot.state;
  if (s.flags.sleeping) return moods.sleep;
  const h = s.meters.happiness;
  if (h >= 65) return moods.happy;
  if (h >= 25) return moods.neutral;
  return moods.sad;
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
    x: x + (Math.random() * 40 - 20),
    y,
    vy: -(0.4 + Math.random() * 0.4),
    life: 1,
    size: kind === 'z' ? 12 + Math.random() * 6 : 14,
    wobble: Math.random() * Math.PI * 2,
  });
}

function drawParticles() {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.y += p.vy * 2.2;
    p.wobble += 0.06;
    p.x += Math.sin(p.wobble) * 0.5;
    p.life -= 0.008;
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
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(cx, y, 52, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function roundedBlob(cx, cy, rx, ry, squash, palette) {
  const w = rx * (1 + squash * 0.5);
  const h = ry * (1 - squash * 0.25);
  ctx.beginPath();
  ctx.ellipse(cx, cy, w, h, 0, 0, Math.PI * 2);
  const grad = ctx.createRadialGradient(cx - w * 0.25, cy - h * 0.35, h * 0.2, cx, cy, w * 1.15);
  grad.addColorStop(0, palette.belly);
  grad.addColorStop(0.55, palette.body);
  grad.addColorStop(1, palette.bodyDark);
  ctx.fillStyle = grad;
  ctx.fill();
}

function drawEars(cx, topY, palette) {
  ctx.fillStyle = palette.bodyDark;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + side * 34, topY + 6, 9, 14, side * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFace(cx, bodyY, eyeScaleY, palette, sleeping, working, t) {
  const eyeY = bodyY - 12;
  const eyeDX = 20;

  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(cx + side * eyeDX, eyeY);
    ctx.scale(1, Math.max(0.08, eyeScaleY));
    ctx.fillStyle = '#251d33';
    ctx.beginPath();
    ctx.ellipse(0, 0, 7.5, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    if (eyeScaleY > 0.5) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(side * 2.4 + 1.5, -3, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  ctx.fillStyle = palette.blush;
  ctx.globalAlpha = sleeping ? 0.35 : 0.55;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + side * 34, eyeY + 14, 8, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const mouthY = bodyY + 14;
  ctx.strokeStyle = '#251d33';
  ctx.lineWidth = 3.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (sleeping) {
    ctx.arc(cx, mouthY, 5, 0, Math.PI);
  } else {
    const h = snapshot ? snapshot.state.meters.happiness : 50;
    if (h >= 65) ctx.arc(cx, mouthY - 2, 9, 0.15 * Math.PI, 0.85 * Math.PI);
    else if (h >= 25) {
      ctx.moveTo(cx - 6, mouthY);
      ctx.lineTo(cx + 6, mouthY);
    } else ctx.arc(cx, mouthY + 10, 9, 1.2 * Math.PI, 1.8 * Math.PI);
  }
  ctx.stroke();

  if (working) {
    const sparkleX = cx - 52 + (Math.sin(t * 6) + 1) * 6;
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    for (const [sxx, syy, r] of [[sparkleX, bodyY - 46, 5], [cx + 55, bodyY - 30, 4]]) {
      ctx.beginPath();
      ctx.moveTo(sxx - r, syy);
      ctx.lineTo(sxx + r, syy);
      ctx.moveTo(sxx, syy - r);
      ctx.lineTo(sxx, syy + r);
      ctx.stroke();
    }
  }
}

function drawPet(now) {
  const t = now / 1000;
  const cx = 120;
  const groundY = 190;
  const baseR = 62;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  shadow(cx, groundY + 16);
  drawParticles();

  const palette = currentPalette();
  const sleeping = !!(snapshot && snapshot.state.flags.sleeping);
  const working = !!(snapshot && snapshot.state.flags.working);

  const breathe = Math.sin(t * 2.2) * 0.035;
  const bounce = Math.abs(Math.sin(t * 2.2)) * (snapshot && snapshot.state.meters.happiness > 65 ? 6 : 2);
  const squash = sleeping ? 0.35 * Math.abs(Math.sin(t * 1.2)) : breathe;

  const bodyY = sleeping ? groundY - baseR * 0.25 : groundY - baseR - bounce - 18;

  drawEars(cx, bodyY - baseR * 0.75, palette);
  roundedBlob(cx, bodyY, baseR, baseR * 0.92, squash, palette);

  const blinking = now >= blinkAt && now < blinkAt + 150;
  const eyeScaleY = sleeping || blinking ? 0.12 : 1;

  drawFace(cx, bodyY, eyeScaleY, palette, sleeping, working, t);

  if (now > blinkAt + 2000) {
    blinkAt = now + 1800 + Math.random() * 2600;
  }

  if (sleeping && now - lastZ > 2600) {
    lastZ = now;
    spawnParticle('z', cx + 40, bodyY - 50);
  }
  if (working && now - lastCoinPop > 3400) {
    lastCoinPop = now;
    spawnParticle('coin', cx + (Math.random() * 60 - 30), bodyY - 40);
  }
}

canvas.addEventListener('click', async (e) => {
  const now = performance.now();
  if (now - lastPat < 900) return;
  lastPat = now;
  spawnParticle('heart', 130, 80);
  const res = await api.action('pat');
  if (res && res.message) showBubble(res.message, 1500);
  else showBubble(`${snapshot ? snapshot.state.pet.name : 'Buddy'}: hehe~`, 1200);
});

canvas.addEventListener('dblclick', () => api.openDashboard());

window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  api.openDashboard();
});

function statusLine() {
  if (!snapshot) return '';
  const d = snapshot.derived;
  const s = snapshot.state;
  if (s.flags.sleeping) return 'zZz... recharging';
  if (s.flags.working) return `+${d.coinRate.toFixed(1)} coins/s`;
  return d.statusText;
}

function applySnapshot(snap) {
  snapshot = snap;
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
