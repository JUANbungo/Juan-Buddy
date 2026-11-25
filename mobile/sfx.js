(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.JBSfx = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let ctx = null;
  let sfxMaster = null;
  let enabled = true;
  let volume = 0.7;
  try {
    if (typeof localStorage !== 'undefined') {
      enabled = localStorage.getItem('juanbuddy-sfx') !== 'off';
      const v = Number(localStorage.getItem('juanbuddy-sfx-vol'));
      if (!Number.isNaN(v) && v >= 0 && v <= 1) volume = v;
    }
  } catch (err) {
    enabled = true;
  }

  function isEnabled() {
    return enabled;
  }

  function setEnabled(on) {
    enabled = !!on;
    try {
      localStorage.setItem('juanbuddy-sfx', on ? 'on' : 'off');
    } catch (err) { /* storage unavailable */ }
  }

  function ensureCtx() {
    if (!enabled) return null;
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    try {
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      sfxMaster = ctx.createGain();
      sfxMaster.gain.value = volume;
      sfxMaster.connect(ctx.destination);
    } catch (err) {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, dur, opts) {
    const ac = ensureCtx();
    if (!ac) return;
    const o = ac.createOscillator();
    const g = ac.createGain();
    const t0 = ac.currentTime + (opts && opts.delay ? opts.delay : 0);
    const vol = opts && opts.vol !== undefined ? opts.vol : 0.14;
    const type = (opts && opts.type) || 'sine';
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (opts && opts.slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, opts.slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(sfxMaster || ac.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  function shimmer(dur, vol) {
    const ac = ensureCtx();
    if (!ac) return;
    const t0 = ac.currentTime;
    const len = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource();
    const g = ac.createGain();
    g.gain.value = vol === undefined ? 0.05 : vol;
    src.buffer = buf;
    src.connect(g);
    g.connect(sfxMaster || ac.destination);
    src.start(t0);
  }

  const SOUNDS = {
    click() {
      tone(620, 0.06, { type: 'square', vol: 0.07, slideTo: 520 });
    },
    coin() {
      tone(900, 0.08, { type: 'triangle', vol: 0.1 });
      tone(1350, 0.12, { type: 'triangle', vol: 0.1, delay: 0.07 });
    },
    feed() {
      tone(260, 0.12, { type: 'sine', vol: 0.13, slideTo: 150 });
      tone(200, 0.12, { type: 'sine', vol: 0.13, delay: 0.13, slideTo: 120 });
      tone(300, 0.1, { type: 'sine', vol: 0.11, delay: 0.27, slideTo: 180 });
    },
    happy() {
      tone(523, 0.09, { type: 'triangle', vol: 0.11 });
      tone(659, 0.09, { type: 'triangle', vol: 0.11, delay: 0.08 });
      tone(784, 0.14, { type: 'triangle', vol: 0.11, delay: 0.16 });
    },
    pat() {
      tone(340, 0.07, { type: 'sine', vol: 0.12, slideTo: 480 });
      shimmer(0.08, 0.02);
    },
    sad() {
      tone(320, 0.14, { type: 'sine', vol: 0.1, slideTo: 240 });
    },
    hatch() {
      shimmer(0.1, 0.06);
      tone(180, 0.06, { type: 'square', vol: 0.09, slideTo: 90 });
      tone(180, 0.06, { type: 'square', vol: 0.09, delay: 0.16, slideTo: 90 });
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.14, { type: 'triangle', vol: 0.13, delay: 0.3 + i * 0.09 }));
      shimmer(0.5, 0.04);
    },
    evolve() {
      [392, 523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.16, { type: 'triangle', vol: 0.13, delay: i * 0.09 }));
      shimmer(0.8, 0.05);
    },
    levelup() {
      [523, 659, 784].forEach((f, i) => tone(f, 0.12, { type: 'square', vol: 0.09, delay: i * 0.1 }));
      tone(1046, 0.2, { type: 'square', vol: 0.09, delay: 0.3 });
    },
    death() {
      tone(392, 0.3, { type: 'sine', vol: 0.13 });
      tone(311, 0.34, { type: 'sine', vol: 0.13, delay: 0.3 });
      tone(233, 0.6, { type: 'sine', vol: 0.13, delay: 0.62, slideTo: 110 });
    },
    achv() {
      tone(1568, 0.12, { type: 'triangle', vol: 0.1 });
      tone(2093, 0.2, { type: 'triangle', vol: 0.1, delay: 0.1 });
    },
    daily() {
      tone(784, 0.1, { type: 'triangle', vol: 0.11 });
      tone(1046, 0.16, { type: 'triangle', vol: 0.11, delay: 0.09 });
      shimmer(0.3, 0.03);
    },
    buy() {
      tone(500, 0.05, { type: 'square', vol: 0.07 });
      tone(900, 0.08, { type: 'triangle', vol: 0.1, delay: 0.05 });
      tone(1350, 0.12, { type: 'triangle', vol: 0.1, delay: 0.12 });
    },
    error() {
      tone(160, 0.14, { type: 'sawtooth', vol: 0.07, slideTo: 120 });
    },
    gachaRiser(dur) {
      tone(200, dur, { type: 'sawtooth', vol: 0.07, slideTo: 1200 });
      shimmer(dur, 0.03);
    },
    gachaChord(freqs, dur, delay) {
      freqs.forEach((f, i) => tone(f, dur, { type: 'triangle', vol: 0.12, delay: delay + i * 0.05 }));
      shimmer(dur + 0.3, 0.045);
    },
  };

  function play(name) {
    if (!enabled) return;
    try {
      const fn = SOUNDS[name];
      if (fn) fn();
    } catch (err) { /* audio unavailable */ }
  }

  function playGacha(rarity) {
    if (!enabled) return;
    try {
      const r = rarity || 'common';
      if (r === 'mythic') {
        SOUNDS.gachaRiser(1.1);
        SOUNDS.gachaChord([523, 659, 784, 1046, 1318, 1568], 0.7, 1.1);
      } else if (r === 'legendary') {
        SOUNDS.gachaRiser(0.8);
        SOUNDS.gachaChord([392, 523, 784, 1046], 0.5, 0.8);
      } else if (r === 'epic') {
        SOUNDS.gachaRiser(0.5);
        SOUNDS.gachaChord([523, 659, 880], 0.4, 0.5);
      } else if (r === 'rare') {
        tone(660, 0.12, { type: 'triangle', vol: 0.11 });
        tone(880, 0.18, { type: 'triangle', vol: 0.11, delay: 0.1 });
      } else {
        tone(440, 0.12, { type: 'triangle', vol: 0.09 });
      }
    } catch (err) { /* audio unavailable */ }
  }

  function setVolume(v) {
    const val = Math.max(0, Math.min(1, Number(v)));
    if (Number.isNaN(val)) return;
    volume = val;
    try { localStorage.setItem('juanbuddy-sfx-vol', String(volume)); } catch (err) { /* ignore */ }
    if (sfxMaster && ctx) sfxMaster.gain.value = volume;
  }

  function getVolume() { return volume; }

  return { play, playGacha, isEnabled, setEnabled, setVolume, getVolume };
});
