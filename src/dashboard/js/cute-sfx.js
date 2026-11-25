/* Juan Buddy — Cute SFX engine (procedural Web Audio, zero dependencies)
   Exposes window.CuteSfx.play(name). Follows the existing Sound toggle/window.JBSfx state. */
(function (root) {
  'use strict';
  let ctx = null;
  let master = null;
  const UNLOCK_EVENTS = ['pointerdown', 'keydown', 'touchstart'];

  function ac() {
    if (!ctx) {
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = volume();
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (err) { /* autoplay */ } }
    return ctx;
  }

  function volume() {
    const sfx = root.JBSfx;
    if (sfx && typeof sfx.getVolume === 'function') return Math.max(0.05, Math.min(1, sfx.getVolume()));
    return 0.7;
  }

  function allowed() {
    const sfx = root.JBSfx;
    if (sfx && typeof sfx.isEnabled === 'function' && !sfx.isEnabled()) return false;
    return true;
  }

  function unlock() {
    if (!allowed()) return;
    try { ac(); } catch (err) { /* audio unavailable */ }
  }
  for (const ev of UNLOCK_EVENTS) {
    root.addEventListener(ev, unlock, { once: false, passive: true });
  }

  function jitter(base) {
    return base * (0.92 + Math.random() * 0.16);
  }

  function tone(freq, dur, opts) {
    const c = ac();
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = (opts && opts.type) || 'sine';
    o.frequency.setValueAtTime(Math.max(20, freq), c.currentTime);
    if (opts && opts.slide) {
      o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slide), c.currentTime + dur);
    }
    if (opts && opts.slide2) {
      o.frequency.linearRampToValueAtTime(Math.max(20, opts.slide2), c.currentTime + dur);
    }
    const vol = (opts && opts.vol) || 0.2;
    const delay = (opts && opts.delay) || 0;
    const t0 = c.currentTime + delay;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.02, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  function noise(dur, opts) {
    const c = ac();
    if (!c) return;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const filt = c.createBiquadFilter();
    filt.type = (opts && opts.type) || 'bandpass';
    filt.frequency.value = (opts && opts.freq) || 2400;
    filt.Q.value = (opts && opts.q) || 0.8;
    const g = c.createGain();
    const vol = (opts && opts.vol) || 0.12;
    const delay = (opts && opts.delay) || 0;
    const t0 = c.currentTime + delay;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  const SOUNDS = {
    pop() {
      tone(jitter(540), 0.09, { type: 'sine', slide: 300, vol: 0.16 });
      tone(jitter(880), 0.05, { type: 'triangle', vol: 0.07, delay: 0.02 });
    },
    bloop() {
      tone(jitter(300), 0.14, { type: 'sine', slide: 560, vol: 0.16 });
    },
    rustle() {
      noise(0.16, { freq: 3400, vol: 0.07 });
      noise(0.1, { freq: 5200, vol: 0.05, delay: 0.05 });
    },
    chirp() {
      tone(jitter(640), 0.1, { type: 'triangle', slide: 1250, vol: 0.15 });
      tone(jitter(900), 0.12, { type: 'triangle', slide: 1500, vol: 0.1, delay: 0.09 });
      tone(jitter(1100), 0.09, { type: 'sine', vol: 0.07, delay: 0.16 });
    },
    plop() {
      tone(jitter(320), 0.12, { type: 'sine', slide: 110, vol: 0.14 });
    },
    step() {
      noise(0.045, { freq: 900 + Math.random() * 400, vol: 0.035, type: 'lowpass', q: 1.2 });
    },
    munch() {
      tone(jitter(180), 0.06, { type: 'square', vol: 0.07 });
      tone(jitter(150), 0.06, { type: 'square', vol: 0.07, delay: 0.09 });
      tone(jitter(210), 0.08, { type: 'square', vol: 0.06, delay: 0.18 });
      noise(0.05, { freq: 1800, vol: 0.03, delay: 0.04 });
    },
    coin() {
      tone(jitter(988), 0.07, { type: 'square', vol: 0.1 });
      tone(jitter(1319), 0.16, { type: 'square', vol: 0.1, delay: 0.07 });
    },
    sparkle() {
      const base = [1568, 1976, 2349, 2637];
      base.forEach((f, i) => tone(jitter(f), 0.12, { type: 'sine', vol: 0.06, delay: i * 0.05 }));
    },
    stamp() {
      tone(jitter(190), 0.09, { type: 'sine', slide: 70, vol: 0.22 });
      noise(0.05, { freq: 1400, vol: 0.06, delay: 0.01 });
      tone(jitter(784), 0.12, { type: 'triangle', vol: 0.08, delay: 0.1 });
    },
    fanfare() {
      const seq = [523, 659, 784, 1047];
      seq.forEach((f, i) => tone(jitter(f), 0.16, { type: 'square', vol: 0.09, delay: i * 0.12 }));
      tone(1319, 0.34, { type: 'square', vol: 0.1, delay: 0.48 });
      tone(jitter(1568), 0.3, { type: 'triangle', vol: 0.07, delay: 0.56 });
    },
    chime() {
      tone(jitter(880), 0.14, { type: 'sine', vol: 0.1 });
      tone(jitter(1175), 0.16, { type: 'sine', vol: 0.08, delay: 0.09 });
      tone(jitter(1760), 0.2, { type: 'sine', vol: 0.05, delay: 0.2 });
    },
  };

  function play(name) {
    if (!allowed()) return;
    const fn = SOUNDS[name];
    if (!fn) return;
    try { unlock(); fn(); } catch (err) { /* audio unavailable */ }
  }

  root.CuteSfx = { play };
})(typeof self !== 'undefined' ? self : this);
