/*
 * Juan Bungo Reaper Event — secret hazard boss for Juan Buddy.
 *
 * Trigger : hunger <= 0 && happiness <= 0 && energy <= 0  ->  666-second doom countdown
 * Survive : bring all three meters back above 0 before the timer ends -> banish
 * Fail    : timer hits 0 -> scythe attack -> full save reset -> title screen
 *
 * Sprite strips (8-bit pixel art, rendered with imageSmoothingEnabled = false):
 *   assets/reaper/sprites_1x/juan_bungo_idle.png            8f 48x48  8fps
 *   assets/reaper/sprites_1x/juan_bungo_attack.png          8f 48x48 12fps
 *   assets/reaper/sprites_1x/juan_bungo_laugh_redeyes.png   8f 48x48 10fps
 *   assets/reaper/sprites_1x/crow_orbit.png                 6f 24x24 10fps
 *   assets/reaper/sprites_1x/crow_feathers.png              6f 16x16  8fps
 *   assets/reaper/sprites_1x/scythe_slash_fx.png            5f 64x64 14fps
 *   assets/reaper/sprites_1x/reaper_warning_icon.png        4f 16x16  6fps
 *
 * BGM: assets/audio/Lurching Doom.mp3 — 2.5s fade-in on spawn, 2.0s fade-out on
 * despawn/reset (handled by JBBgm.playReaperMusic / stopReaperMusic).
 *
 * Debug: window.triggerJuanBungo(testSeconds = 666)
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.JuanBungoReaper = api;
  root.triggerJuanBungo = function (testSeconds) { return api.spawn(testSeconds || 666); };
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  // ---------------------------------------------------------------- constants
  const STAGE_W = 480;
  const STAGE_H = 360;
  const SPRITE_DIR = 'assets/reaper/sprites_1x/';

  const SPRITES = {
    idle:    { file: 'juan_bungo_idle.png',          frames: 8, fw: 48, fh: 48, fps: 8  },
    attack:  { file: 'juan_bungo_attack.png',        frames: 8, fw: 48, fh: 48, fps: 12 },
    laugh:   { file: 'juan_bungo_laugh_redeyes.png', frames: 8, fw: 48, fh: 48, fps: 10 },
    crow:    { file: 'crow_orbit.png',               frames: 6, fw: 24, fh: 24, fps: 10 },
    feather: { file: 'crow_feathers.png',            frames: 6, fw: 16, fh: 16, fps: 8  },
    slash:   { file: 'scythe_slash_fx.png',          frames: 5, fw: 64, fh: 64, fps: 14 },
    warning: { file: 'reaper_warning_icon.png',      frames: 4, fw: 16, fh: 16, fps: 6  },
  };

  const TAUNTS = ['Heh... heh... heh...', 'Oras mo na...', 'Walang takas...', '666...'];
  const MILESTONES = [333, 66, 10];

  const ARRIVE_MS = 1400;
  const BANISH_MS = 1600;
  const LOCK_MS = 1200;
  const APPROACH_MS = 700;
  const ATTACK_MS = 700; // 8 frames @ 12fps ≈ 667ms
  const GAMEOVER_MS = 3500;

  // ------------------------------------------------------------------- state
  let stageCanvas = null;
  let overlay = null;
  let octx = null;
  let wrap = null;
  let banner = null;
  let bannerText = null;
  let bannerTimer = null;
  let warnIconCanvas = null;
  let vignette = null;
  let blocker = null;
  let gameoverEl = null;
  let toastEl = null;
  let onReapReset = null;
  let inited = false;

  const images = {}; // key -> Image | null (null = failed, use fallback art)

  const ev = {
    phase: 'off',        // off | arrive | active | banish | laugh-lock | attack | gameover
    t0: 0,               // phase start (performance.now)
    endsAt: 0,           // doom deadline (ms epoch of performance.now)
    seconds: 666,
    forced: false,       // spawned via triggerJuanBungo
    firedMilestones: {},
    nextLaughAt: 0,
    laughUntil: 0,
    laughIdx: 0,
    taunt: '',
    rx: 240, ry: 300,    // reaper feet position
    homeX: 240, homeY: 300,
    crows: [],
    feathers: [],
    featherRefill: true,
    flashUntil: 0,
    shakeUntil: 0,
    prevWrapTransform: null,
    resetStarted: false,
  };

  // ------------------------------------------------------------- asset loader
  function scriptBase() {
    try {
      const scripts = document.getElementsByTagName('script');
      for (let i = scripts.length - 1; i >= 0; i -= 1) {
        const s = scripts[i];
        if (s.src && /juanBungoReaper\.js/.test(s.src)) return s.src;
      }
    } catch (err) { /* ignore */ }
    return '';
  }

  function assetUrls(file) {
    const urls = [];
    const base = scriptBase();
    if (base) {
      // script lives at <root>/src/dashboard/js/ -> root assets are three levels up
      try { urls.push(new URL('../../../' + SPRITE_DIR + file, base).href); } catch (err) { /* ignore */ }
      try { urls.push(new URL('../../' + SPRITE_DIR + file, base).href); } catch (err) { /* ignore */ }
    }
    urls.push('../../' + SPRITE_DIR + file); // page-relative (page at <root>/src/dashboard/)
    urls.push('./' + SPRITE_DIR + file); // spec-relative fallback (works on Pages root / APK webDir)
    return urls;
  }

  function loadSprites() {
    Object.keys(SPRITES).forEach((key) => {
      const def = SPRITES[key];
      const urls = assetUrls(def.file);
      const img = new Image();
      let u = 0;
      img.onload = () => { images[key] = img; };
      img.onerror = () => {
        u += 1;
        if (u < urls.length) img.src = urls[u];
        else images[key] = null; // graceful fallback art
      };
      img.src = urls[0];
    });
  }

  // --------------------------------------------------------------- dom layers
  function ensureDom() {
    if (!wrap) {
      wrap = stageCanvas.parentElement || document.body;
      const pos = root.getComputedStyle(wrap).position;
      if (pos === 'static') wrap.style.position = 'relative';
    }

    // overlay canvas (reaper / crows / feathers / flash), mirrors the stage rect
    if (!overlay) {
      overlay = document.createElement('canvas');
      overlay.id = 'jb-reaper-overlay';
      overlay.width = STAGE_W;
      overlay.height = STAGE_H;
      const st = overlay.style;
      st.position = 'absolute';
      st.pointerEvents = 'none';
      st.imageRendering = 'pixelated';
      st.zIndex = '4';
      wrap.appendChild(overlay);
      octx = overlay.getContext('2d');
    }

    // eerie dark-crimson vignette (never blocks clicks)
    if (!vignette) {
      vignette = document.createElement('div');
      vignette.id = 'jb-reaper-vignette';
      const st = vignette.style;
      st.position = 'absolute';
      st.inset = '0';
      st.pointerEvents = 'none';
      st.zIndex = '3';
      st.background = 'radial-gradient(ellipse at center, rgba(40,0,10,0) 42%, rgba(70,0,16,0.42) 78%, rgba(20,0,6,0.7) 100%)';
      st.opacity = '0';
      st.transition = 'opacity 1.2s ease';
      wrap.appendChild(vignette);
    }

    // crimson warning banner (top of stage, pointer-events none)
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'jb-reaper-banner';
      banner.style.cssText = [
        'position:absolute', 'top:6px', 'left:3%', 'right:3%',
        'display:flex', 'align-items:center', 'justify-content:center', 'gap:7px',
        'padding:5px 10px', 'text-align:center',
        'background:rgba(30,2,8,0.92)', 'border:2px solid #ff2b4a', 'border-radius:6px',
        'box-shadow:0 0 14px rgba(255,43,74,0.55), inset 0 0 10px rgba(255,43,74,0.25)',
        'color:#ff5566', 'font:bold 10px/1.35 "Courier New", monospace',
        'text-shadow:0 0 6px rgba(255,43,74,0.8)', 'letter-spacing:0.5px',
        'pointer-events:none', 'z-index:6', 'opacity:0', 'transition:opacity 0.6s ease',
      ].join(';');
      warnIconCanvas = document.createElement('canvas');
      warnIconCanvas.width = 16;
      warnIconCanvas.height = 16;
      warnIconCanvas.style.cssText = 'width:24px;height:24px;image-rendering:pixelated;flex:0 0 auto;';
      bannerText = document.createElement('span');
      bannerText.textContent = 'JUAN BUNGO HAS ARRIVED! REVIVE HUNGER, HAPPINESS & ENERGY';
      bannerTimer = document.createElement('b');
      bannerTimer.id = 'jb-reaper-timer';
      bannerTimer.style.cssText = 'color:#ffdd55;text-shadow:0 0 6px rgba(255,120,60,0.9);white-space:nowrap;';
      banner.appendChild(warnIconCanvas);
      banner.appendChild(bannerText);
      banner.appendChild(bannerTimer);
      wrap.appendChild(banner);
    }

    // control blocker for the reap sequence
    if (!blocker) {
      blocker = document.createElement('div');
      blocker.id = 'jb-reaper-blocker';
      blocker.style.cssText = 'position:fixed;inset:0;z-index:9000;display:none;background:transparent;';
      document.body.appendChild(blocker);
    }

    // game over overlay
    if (!gameoverEl) {
      gameoverEl = document.createElement('div');
      gameoverEl.id = 'jb-reaper-gameover';
      gameoverEl.style.cssText = [
        'position:fixed', 'inset:0', 'z-index:9100', 'display:none',
        'align-items:center', 'justify-content:center', 'flex-direction:column', 'gap:14px',
        'background:rgba(8,0,2,0.94)', 'color:#ff2b4a',
        'font:bold 15px/1.6 "Courier New", monospace', 'text-align:center',
        'text-shadow:0 0 10px rgba(255,43,74,0.9)', 'letter-spacing:1px', 'padding:20px',
      ].join(';');
      const l1 = document.createElement('div');
      l1.textContent = 'SOUL REAPED BY JUAN BUNGO';
      l1.style.cssText = 'font-size:22px;animation:none;';
      const l2 = document.createElement('div');
      l2.textContent = 'YOUR JOURNEY HAS BEEN RESET';
      gameoverEl.appendChild(l1);
      gameoverEl.appendChild(l2);
      document.body.appendChild(gameoverEl);
    }

    // relief / info toast
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.id = 'jb-reaper-toast';
      toastEl.style.cssText = [
        'position:absolute', 'bottom:12px', 'left:50%', 'transform:translateX(-50%)',
        'padding:7px 14px', 'background:rgba(8,26,12,0.94)', 'border:2px solid #57d35f',
        'max-width:90%', 'overflow:hidden', 'text-overflow:ellipsis',
        'border-radius:6px', 'color:#7dff9e', 'font:bold 11px/1.4 "Courier New", monospace',
        'pointer-events:none', 'z-index:6', 'opacity:0', 'transition:opacity 0.4s ease',
        'white-space:nowrap',
      ].join(';');
      wrap.appendChild(toastEl);
    }
  }

  function syncOverlayRect() {
    if (!overlay || !stageCanvas) return;
    const wr = wrap.getBoundingClientRect();
    const cr = stageCanvas.getBoundingClientRect();
    overlay.style.left = (cr.left - wr.left) + 'px';
    overlay.style.top = (cr.top - wr.top) + 'px';
    overlay.style.width = cr.width + 'px';
    overlay.style.height = cr.height + 'px';
    // mirror the stage DPR so pixel art stays crisp on hidpi/retina + mobile
    const dpr = Math.max(1, Math.min(3, (root.devicePixelRatio || 1)));
    const bw = Math.round(STAGE_W * dpr);
    if (overlay.width !== bw) {
      overlay.width = bw;
      overlay.height = Math.round(STAGE_H * dpr);
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    octx.imageSmoothingEnabled = false;
  }

  // ------------------------------------------------------------ sprite helpers
  function frameIndex(def, now, offset) {
    const f = Math.floor((now / 1000) * def.fps + (offset || 0));
    return f % def.frames;
  }

  function drawStrip(key, now, cx, cy, dw, dh, flip, alpha, offset) {
    const def = SPRITES[key];
    const img = images[key];
    octx.save();
    octx.imageSmoothingEnabled = false;
    if (alpha !== undefined) octx.globalAlpha = alpha;
    octx.translate(cx, cy);
    if (flip) octx.scale(-1, 1);
    if (img) {
      const f = frameIndex(def, now, offset);
      octx.drawImage(img, f * def.fw, 0, def.fw, def.fh, -dw / 2, -dh / 2, dw, dh);
    } else {
      fallbackArt(key, now, dw);
    }
    octx.restore();
  }

  // Procedural 8-bit-ish fallback art so the event still works before/without the
  // sprite pack files (also handy on very old webviews with strict CSP on images).
  function fallbackArt(key, now, size) {
    const t = now / 1000;
    if (key === 'idle' || key === 'laugh' || key === 'attack') {
      const laugh = key === 'laugh';
      const lunge = key === 'attack';
      octx.save();
      octx.translate(lunge ? size * 0.08 : 0, 0);
      // cloak
      octx.fillStyle = '#141018';
      octx.beginPath();
      octx.moveTo(-size * 0.32, size * 0.48);
      octx.lineTo(-size * 0.18, -size * 0.1);
      octx.lineTo(-size * 0.2, -size * 0.34);
      octx.quadraticCurveTo(0, -size * 0.62, size * 0.2, -size * 0.34);
      octx.lineTo(size * 0.18, -size * 0.1);
      octx.lineTo(size * 0.32, size * 0.48);
      octx.closePath();
      octx.fill();
      // hood rim
      octx.fillStyle = '#241a2c';
      octx.beginPath();
      octx.ellipse(0, -size * 0.3, size * 0.2, size * 0.17, 0, Math.PI, 0);
      octx.fill();
      // eyes
      octx.fillStyle = laugh ? '#ff2b4a' : '#c81e3a';
      const blink = laugh || Math.sin(t * 6) > -0.7;
      if (blink) {
        const er = size * (laugh ? 0.05 : 0.038);
        octx.shadowColor = 'rgba(255,43,74,0.95)';
        octx.shadowBlur = laugh ? 12 : 7;
        octx.beginPath();
        octx.ellipse(-size * 0.075, -size * 0.28, er, er * 1.25, 0, 0, Math.PI * 2);
        octx.ellipse(size * 0.075, -size * 0.28, er, er * 1.25, 0, 0, Math.PI * 2);
        octx.fill();
        octx.shadowBlur = 0;
      }
      // scythe on attack
      if (lunge) {
        octx.strokeStyle = '#8a8f98';
        octx.lineWidth = Math.max(2, size * 0.04);
        octx.beginPath();
        octx.moveTo(size * 0.1, size * 0.2);
        octx.lineTo(size * 0.42, -size * 0.42);
        octx.stroke();
        octx.strokeStyle = '#e8ecf2';
        octx.beginPath();
        octx.arc(size * 0.12, -size * 0.42, size * 0.3, -Math.PI * 0.15, Math.PI * 0.55);
        octx.stroke();
      }
      octx.restore();
    } else if (key === 'crow') {
      const flap = Math.sin(t * 14) * 0.5 + 0.5;
      octx.fillStyle = '#101014';
      octx.beginPath();
      octx.ellipse(0, 0, size * 0.26, size * 0.16, 0, 0, Math.PI * 2);
      octx.fill();
      octx.beginPath();
      octx.ellipse(-size * 0.02, -size * 0.12, size * 0.11, size * 0.09, 0, 0, Math.PI * 2);
      octx.fill();
      octx.beginPath();
      octx.moveTo(-size * 0.05, -size * 0.12);
      octx.lineTo(-size * 0.22, -size * (0.12 + 0.16 * flap));
      octx.lineTo(size * 0.06, -size * 0.08);
      octx.closePath();
      octx.fill();
      octx.fillStyle = '#ff5566';
      octx.fillRect(size * 0.16, -size * 0.14, size * 0.05, size * 0.04);
    } else if (key === 'feather') {
      octx.fillStyle = '#17131c';
      octx.beginPath();
      octx.ellipse(0, 0, size * 0.1, size * 0.2, Math.sin(t * 3) * 0.6, 0, Math.PI * 2);
      octx.fill();
      octx.strokeStyle = '#2c2334';
      octx.lineWidth = 1;
      octx.beginPath();
      octx.moveTo(0, -size * 0.18);
      octx.lineTo(0, size * 0.18);
      octx.stroke();
    } else if (key === 'slash') {
      const k = (t * 14) % 1;
      octx.strokeStyle = `rgba(255,235,240,${1 - k})`;
      octx.lineWidth = Math.max(2, size * 0.07);
      octx.beginPath();
      octx.arc(0, 0, size * (0.18 + 0.3 * k), -1.1, 0.9);
      octx.stroke();
      octx.strokeStyle = `rgba(255,43,74,${0.8 - k})`;
      octx.beginPath();
      octx.arc(0, 0, size * (0.24 + 0.3 * k), -0.9, 1.1);
      octx.stroke();
    } else if (key === 'warning') {
      octx.fillStyle = '#ff2b4a';
      octx.fillRect(2, 2, 12, 12);
      octx.fillStyle = '#1a0208';
      octx.fillRect(5, 6, 2, 3);
      octx.fillRect(9, 6, 2, 3);
      octx.fillRect(6, 11, 4, 1);
    }
  }

  // -------------------------------------------------------------- crowd parts
  function ensureCrows() {
    if (ev.crows.length) return;
    const n = 3 + Math.floor(Math.random() * 2); // 3-4 crows
    for (let i = 0; i < n; i += 1) {
      ev.crows.push({
        angle: (Math.PI * 2 * i) / n + Math.random() * 0.8,
        speed: 1.1 + Math.random() * 0.7,      // rad/s
        rx: 58 + Math.random() * 22,           // ellipse radii
        ry: 18 + Math.random() * 12,
        yOff: -34 - Math.random() * 22,
        size: 30 + Math.random() * 12,
        off: Math.random() * 6,
      });
    }
  }

  function spawnFeather() {
    ev.feathers.push({
      x: 10 + Math.random() * (STAGE_W - 20),
      y: -12,
      vy: 14 + Math.random() * 18,
      sway: Math.random() * Math.PI * 2,
      swayAmp: 8 + Math.random() * 14,
      swaySpeed: 1.2 + Math.random() * 1.6,
      size: 14 + Math.random() * 10,
      off: Math.random() * 6,
      alpha: 0.9,
    });
  }

  // ----------------------------------------------------------------- lifecycle
  function startMusic() {
    try {
      if (root.JBBgm && typeof root.JBBgm.playReaperMusic === 'function') root.JBBgm.playReaperMusic();
    } catch (err) { /* never freeze on audio */ }
  }

  function stopMusic() {
    try {
      if (root.JBBgm && typeof root.JBBgm.stopReaperMusic === 'function') root.JBBgm.stopReaperMusic();
    } catch (err) { /* ignore */ }
  }

  function setLayers(active) {
    if (vignette) vignette.style.opacity = active ? '1' : '0';
    if (banner) banner.style.opacity = active ? '1' : '0';
  }

  function showToast(msg, ms) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.style.opacity = '1';
    root.clearTimeout(showToast._t);
    showToast._t = root.setTimeout(() => { toastEl.style.opacity = '0'; }, ms || 3000);
  }

  // natural = true when spawned by the real meter watcher (recovery/banish applies).
  // forced (debug via triggerJuanBungo) always runs the full doom sequence.
  function spawn(testSeconds, natural) {
    if (!inited) return { ok: false, message: 'Reaper not initialised yet.' };
    ensureDom();
    if (ev.phase !== 'off' && ev.phase !== 'banish') return { ok: false, message: 'Juan Bungo is already here!' };
    ev.phase = 'arrive';
    ev.t0 = root.performance.now();
    ev.seconds = Math.max(1, Math.round(testSeconds || 666));
    ev.endsAt = ev.t0 + ev.seconds * 1000;
    ev.forced = !natural;
    ev.firedMilestones = {};
    ev.nextLaughAt = ev.t0 + 6000 + Math.random() * 4000;
    ev.laughUntil = 0;
    ev.resetStarted = false;
    ev.feathers = [];
    ev.featherRefill = true;
    ev.crows = [];
    setLayers(true);
    startMusic();
    return { ok: true, message: `Juan Bungo has arrived. ${ev.seconds}s on the clock.` };
  }

  function banish(silent) {
    if (ev.phase !== 'active' && ev.phase !== 'arrive') return;
    ev.phase = 'banish';
    ev.t0 = root.performance.now();
    ev.featherRefill = false;
    setLayers(false);
    stopMusic();
    if (!silent) showToast('Juan Bungo vanished... Your buddy survived!', 3200);
  }

  function startReap(now) {
    ev.phase = 'laugh-lock';
    ev.t0 = now;
    ev.laughUntil = now + LOCK_MS;
    ev.taunt = 'ORAS MO NA!';
    if (blocker) blocker.style.display = 'block';
    ev.featherRefill = false;
  }

  function cleanupAll() {
    ev.phase = 'off';
    ev.crows = [];
    ev.feathers = [];
    ev.featherRefill = false;
    setLayers(false);
    if (blocker) blocker.style.display = 'none';
    if (gameoverEl) gameoverEl.style.display = 'none';
    if (wrap) wrap.style.transform = ev.prevWrapTransform || '';
    ev.prevWrapTransform = null;
  }

  function beginReset() {
    if (ev.resetStarted) return;
    ev.resetStarted = true;
    cleanupAll();
    stopMusic();
    if (typeof onReapReset === 'function') {
      try { onReapReset(); } catch (err) { /* ignore */ }
    }
  }

  // ------------------------------------------------------------- meter watcher
  function metersAllZero(s) {
    const m = s && s.meters;
    if (!m) return false;
    return m.hunger <= 0 && m.happiness <= 0 && m.energy <= 0;
  }

  function metersAllAlive(s) {
    const m = s && s.meters;
    if (!m) return false;
    return m.hunger > 0 && m.happiness > 0 && m.energy > 0;
  }

  // ---------------------------------------------------------------------- tick
  function tick(now, snapshot, pet) {
    if (!inited) return;

    // ---- trigger watcher (runs even before spawn) ----
    if (ev.phase === 'off' && snapshot && snapshot.state) {
      const s = snapshot.state;
      const alive = s.pet && s.pet.stage !== 'egg' && !s.dead;
      if (alive && metersAllZero(s)) spawn(666, true);
    }

    if (ev.phase === 'off') return;
    ensureDom();
    syncOverlayRect();

    const s2 = snapshot && snapshot.state;
    const petDead = !!(s2 && (s2.dead || (s2.pet && s2.pet.stage === 'egg')));
    if (petDead && (ev.phase === 'active' || ev.phase === 'arrive')) {
      banish(true); // buddy is gone on its own; the reaper loses interest
    }

    const dtMs = 16;
    const px = pet && typeof pet.x === 'number' ? pet.x : 240;
    const py = pet && typeof pet.y === 'number' ? pet.y : 312;

    // ---- phase transitions ----
    if (ev.phase === 'arrive') {
      if (now - ev.t0 >= ARRIVE_MS) { ev.phase = 'active'; ev.t0 = now; }
    } else if (ev.phase === 'banish') {
      if (now - ev.t0 >= BANISH_MS) cleanupAll();
    } else if (ev.phase === 'active') {
      const remainingMs = ev.endsAt - now;
      const remaining = Math.max(0, Math.ceil(remainingMs / 1000));
      // survive condition — only for natural spawns (debug/forced spawns run the
      // full doom sequence regardless of meters so it can be tested anytime)
      if (!ev.forced && s2 && metersAllAlive(s2)) {
        banish(false);
      } else if (remaining <= 0) {
        startReap(now);
      } else {
        // milestone laughs
        for (const m of MILESTONES) {
          if (remaining <= m && !ev.firedMilestones[m]) {
            ev.firedMilestones[m] = true;
            ev.laughUntil = now + 2500;
            ev.laughIdx += 1;
            ev.taunt = TAUNTS[ev.laughIdx % TAUNTS.length];
          }
        }
        // random laugh bursts every 6-10s
        if (now > ev.nextLaughAt && now > ev.laughUntil) {
          ev.nextLaughAt = now + 6000 + Math.random() * 4000;
          ev.laughUntil = now + 2000 + Math.random() * 1000;
          ev.laughIdx += 1;
          ev.taunt = TAUNTS[ev.laughIdx % TAUNTS.length];
        }
      }
    } else if (ev.phase === 'laugh-lock') {
      if (now - ev.t0 >= LOCK_MS) {
        ev.phase = 'attack';
        ev.t0 = now;
        ev.homeX = ev.rx;
        ev.homeY = ev.ry;
        ev.flashUntil = now + APPROACH_MS + 400;
        ev.shakeUntil = now + APPROACH_MS + ATTACK_MS;
        if (wrap && !ev.prevWrapTransform) {
          ev.prevWrapTransform = wrap.style.transform || '';
        }
      }
    } else if (ev.phase === 'attack') {
      if (now - ev.t0 >= APPROACH_MS + ATTACK_MS) {
        ev.phase = 'gameover';
        ev.t0 = now;
        if (gameoverEl) gameoverEl.style.display = 'flex';
        stopMusic(); // 2.0s fade-out under the 3.5s overlay
      }
    } else if (ev.phase === 'gameover') {
      if (now - ev.t0 >= GAMEOVER_MS) {
        beginReset();
        return;
      }
    }

    // ---- reaper position ----
    if (ev.phase === 'arrive' || ev.phase === 'active' || ev.phase === 'banish') {
      ev.homeX = Math.max(70, Math.min(STAGE_W - 60, px + 118));
      ev.homeY = Math.max(246, Math.min(344, py));
    }
    let rx = ev.homeX;
    let ry = ev.homeY;
    let alpha = 1;
    if (ev.phase === 'arrive') {
      const k = Math.min(1, (now - ev.t0) / ARRIVE_MS);
      alpha = k;
      ry -= (1 - k) * 26;
    } else if (ev.phase === 'banish') {
      const k = Math.max(0, 1 - (now - ev.t0) / BANISH_MS);
      alpha = k;
      ry -= (1 - k) * 30;
    } else if (ev.phase === 'attack') {
      const k = Math.min(1, (now - ev.t0) / APPROACH_MS);
      const ease = k * k * (3 - 2 * k); // smoothstep lunge
      rx = ev.homeX + (px - ev.homeX) * ease;
      ry = ev.homeY + (py - ev.homeY) * ease;
    }
    ev.rx = rx;
    ev.ry = ry;
    const bob = Math.sin(now / 800) * 4;
    const reaperCy = ry - 52 + bob; // sprite center (48px frame drawn at ~110px)
    const reaperSize = 112;

    // ---- crows ----
    if (ev.phase === 'active' || ev.phase === 'arrive' || ev.phase === 'laugh-lock' || ev.phase === 'attack') {
      ensureCrows();
      for (const c of ev.crows) c.angle += (c.speed * dtMs) / 1000;
    } else if (ev.phase === 'banish') {
      for (const c of ev.crows) {
        c.angle += (c.speed * dtMs * 2.4) / 1000;
        c.rx += 0.9; // disperse outward
        c.ry += 0.3;
      }
    }

    // ---- feathers ----
    if (ev.featherRefill && ev.feathers.length < 25 && Math.random() < 0.4) spawnFeather();
    for (let i = ev.feathers.length - 1; i >= 0; i -= 1) {
      const f = ev.feathers[i];
      f.y += (f.vy * dtMs) / 1000;
      f.sway += (f.swaySpeed * dtMs) / 1000;
      if (!ev.featherRefill) f.alpha -= dtMs / 900;
      if (f.y > STAGE_H + 16 || f.alpha <= 0) ev.feathers.splice(i, 1);
    }

    // ================================ draw ================================
    octx.clearRect(0, 0, STAGE_W, STAGE_H);

    // feathers behind everything (soft rain)
    for (const f of ev.feathers) {
      const fx = f.x + Math.sin(f.sway) * f.swayAmp;
      drawStrip('feather', now, fx, f.y, f.size, f.size, false, Math.max(0, f.alpha * 0.9), f.off);
    }

    // crows behind the reaper (top half of the ellipse)
    for (const c of ev.crows) {
      const cyy = Math.sin(c.angle);
      if (cyy < 0) {
        const cx2 = rx + Math.cos(c.angle) * c.rx;
        const cy2 = ry + c.yOff + cyy * c.ry;
        const flip = Math.cos(c.angle) * c.speed < 0;
        drawStrip('crow', now, cx2, cy2, c.size, c.size, flip, alpha, c.off);
      }
    }

    // Juan Bungo
    let mode = 'idle';
    const laughing = (ev.phase === 'laugh-lock') || (ev.laughUntil && now < ev.laughUntil);
    if (laughing) mode = 'laugh';
    else if (ev.phase === 'attack' && now - ev.t0 >= APPROACH_MS) mode = 'attack';
    drawStrip(mode, now, rx, reaperCy, reaperSize, reaperSize, false, alpha, 0);

    // crows in front (bottom half of the ellipse)
    for (const c of ev.crows) {
      const cyy = Math.sin(c.angle);
      if (cyy >= 0) {
        const cx2 = rx + Math.cos(c.angle) * c.rx;
        const cy2 = ry + c.yOff + cyy * c.ry;
        const flip = Math.cos(c.angle) * c.speed < 0;
        drawStrip('crow', now, cx2, cy2, c.size, c.size, flip, alpha, c.off);
      }
    }

    // floating pixel taunt
    if (laughing && ev.taunt) {
      octx.save();
      octx.imageSmoothingEnabled = false;
      octx.font = 'bold 11px "Courier New", monospace';
      octx.textAlign = 'center';
      octx.fillStyle = 'rgba(20,2,8,0.85)';
      const tw = octx.measureText(ev.taunt).width;
      octx.fillRect(rx - tw / 2 - 8, reaperCy - reaperSize / 2 - 26, tw + 16, 18);
      octx.fillStyle = '#ff5566';
      octx.fillText(ev.taunt, rx, reaperCy - reaperSize / 2 - 13);
      octx.restore();
    }

    // scythe slash fx over the buddy during the attack
    if (ev.phase === 'attack' && now - ev.t0 >= APPROACH_MS) {
      drawStrip('slash', now, px, py - 34, 88, 88, false, 1, 0);
    }

    // crimson screen flash
    if (now < ev.flashUntil) {
      const k = Math.max(0, 1 - (ev.flashUntil - now) / 400);
      octx.fillStyle = `rgba(255,20,50,${0.55 * (1 - k * 0.5) * (0.4 + 0.6 * Math.sin(now / 40) ** 2)})`;
      octx.fillRect(0, 0, STAGE_W, STAGE_H);
    }

    // camera shake (whole playground wrap) during the attack
    if (now < ev.shakeUntil && wrap) {
      const m = Math.min(4, (ev.shakeUntil - now) / 60);
      wrap.style.transform = `${ev.prevWrapTransform || ''} translate(${(Math.random() * 2 - 1) * m}px, ${(Math.random() * 2 - 1) * m}px)`;
    } else if (ev.prevWrapTransform !== null && wrap) {
      wrap.style.transform = ev.prevWrapTransform;
      if (ev.phase !== 'attack') ev.prevWrapTransform = null;
    }

    // ---- banner text ----
    if (banner) {
      const remaining = ev.phase === 'active' || ev.phase === 'arrive' || ev.phase === 'banish'
        ? Math.max(0, Math.ceil((ev.endsAt - now) / 1000))
        : 0;
      const mm = Math.floor(remaining / 60);
      const ss = remaining % 60;
      const txt = `${mm}:${ss < 10 ? '0' : ''}${ss} (${remaining}s)`;
      if (bannerTimer.textContent !== txt) bannerTimer.textContent = txt;
      banner.style.opacity = (ev.phase !== 'off' && ev.phase !== 'banish' && ev.phase !== 'gameover') ? '1' : '0';
      if (warnIconCanvas) {
        const wctx = warnIconCanvas.getContext('2d');
        wctx.imageSmoothingEnabled = false;
        wctx.clearRect(0, 0, 16, 16);
        const wimg = images.warning;
        if (wimg) {
          const def = SPRITES.warning;
          wctx.drawImage(wimg, frameIndex(def, now, 0) * 16, 0, 16, 16, 0, 0, 16, 16);
        } else {
          // fallback: blinking crimson skull square
          wctx.fillStyle = '#ff2b4a';
          wctx.fillRect(2, 2, 12, 12);
          wctx.fillStyle = '#1a0208';
          wctx.fillRect(5, 6, 2, 3);
          wctx.fillRect(9, 6, 2, 3);
          wctx.fillRect(6, 11, 4, 1);
        }
      }
    }
  }

  // --------------------------------------------------------------------- init
  function init(opts) {
    const o = opts || {};
    stageCanvas = o.canvas || (document && document.getElementById('dash-pet'));
    if (!stageCanvas) return false;
    onReapReset = o.onReapReset || null;
    ensureDom();
    loadSprites();
    inited = true;
    return true;
  }

  return {
    init,
    tick,
    spawn,
    banish,
    isActive: () => ev.phase !== 'off',
    phase: () => ev.phase,
    // true while Juan Bungo owns the speakers (arrive/active) — bgm.js checks
    // this so the Music toggle switches between Lurching Doom and normal BGM
    wantsMusic: () => ev.phase === 'arrive' || ev.phase === 'active',
    remainingSeconds: () => (ev.phase === 'off' ? 0 : Math.max(0, Math.ceil((ev.endsAt - root.performance.now()) / 1000))),
  };
});
