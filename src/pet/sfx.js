(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.JBSfx = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
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

  let SFX_BASE = '';
  try {
    const cs = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript : null;
    if (cs && cs.src && /^(https?|file):/i.test(cs.src) && cs.src.indexOf('blob:') !== 0) SFX_BASE = cs.src;
  } catch (err) { SFX_BASE = ''; }

  function pageRelativeFirst() {
    try {
      if (typeof root.location !== 'undefined' && /^(https?):/i.test(root.location.href)) return true;
    } catch (err) { /* ignore */ }
    return false;
  }

  function wavUrls(rel) {
    const urls = [];
    if (SFX_BASE) {
      try { urls.push(new URL('../../assets/sfx/' + rel, SFX_BASE).href); } catch (err) { /* ignore */ }
    }
    urls.push('assets/sfx/' + rel);
    return pageRelativeFirst() ? urls.slice().reverse() : urls;
  }

  const CRY_IDS = ['banog', 'bantay', 'bao', 'bara', 'chai', 'dragon', 'egg', 'gagak', 'gino', 'kala', 'linh', 'merli', 'misha', 'mochi', 'muning', 'raja', 'ran', 'rimau', 'tala'];
  const CRY_FALLBACK = { nila: 'raja' };

  function cryFor(speciesId) {
    let id = String(speciesId || 'kala').replace(/_evo$/, '');
    if (CRY_IDS.indexOf(id) === -1) id = CRY_FALLBACK[id] || 'kala';
    return `wav_8bit/pet_cries/cry_${id}.wav`;
  }

  const wavCache = {};

  function playWav(rel, vol) {
    if (!enabled || typeof root.Audio !== 'function' || !rel) return false;
    let rec = wavCache[rel];
    if (!rec) {
      rec = { audio: null, urls: wavUrls(rel), idx: 0 };
      wavCache[rel] = rec;
    }
    try {
      if (!rec.audio) {
        rec.audio = new root.Audio();
        rec.audio.preload = 'auto';
        rec.audio.src = rec.urls[0];
        rec.audio.onerror = () => {
          rec.idx += 1;
          if (rec.audio && rec.idx < rec.urls.length) rec.audio.src = rec.urls[rec.idx];
        };
      }
      const v = Math.max(0, Math.min(1, (vol === undefined ? 0.5 : vol) * 1.4 * volume));
      rec.audio.volume = v;
      try { rec.audio.currentTime = 0; } catch (err) { /* ignore */ }
      const q = rec.audio.play();
      if (q && typeof q.catch === 'function') q.catch(() => { /* autoplay guard */ });
      return true;
    } catch (err) { return false; }
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

  function noise(dur, opts) {
    const ac = ensureCtx();
    if (!ac) return;
    const t0 = ac.currentTime + (opts && opts.delay ? opts.delay : 0);
    const len = Math.max(1, Math.floor(ac.sampleRate * dur));
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    const src2 = ac.createBufferSource();
    src2.buffer = buf;
    const f = ac.createBiquadFilter();
    f.type = (opts && opts.filter) || 'lowpass';
    f.frequency.value = (opts && opts.filterFreq) || 1000;
    const g = ac.createGain();
    const vol2 = (opts && opts.vol) || 0.15;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol2, t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src2.connect(f); f.connect(g); g.connect(sfxMaster || ac.destination);
    src2.start(t0);
    src2.stop(t0 + dur + 0.05);
  }

  function barkBursts(count, dur, freqs) {
    for (let i = 0; i < count; i += 1) {
      tone(freqs[0], dur, { type: 'sawtooth', vol: 0.16, slideTo: freqs[1], delay: i * 0.16 });
      noise(dur, { filter: 'bandpass', filterFreq: 700, vol: 0.07, delay: i * 0.16 });
    }
  }

  const PET_VOICES = {
    kala() { tone(110, 0.75, { type: 'sawtooth', vol: 0.16, slideTo: 70 }); noise(0.7, { filter: 'lowpass', filterFreq: 220, vol: 0.07 }); },
    bantay() { barkBursts(2, 0.11, [320, 150]); },
    gino() { barkBursts(2, 0.09, [430, 220]); },
    tala() { tone(320, 0.9, { type: 'sine', vol: 0.15, slideTo: 520 }); tone(500, 0.6, { type: 'sine', vol: 0.13, delay: 0.75, slideTo: 300 }); },
    chai() { tone(200, 0.55, { type: 'square', vol: 0.13, slideTo: 480 }); noise(0.5, { filter: 'bandpass', filterFreq: 900, vol: 0.05, delay: 0.1 }); },
    linh() { tone(480, 0.2, { type: 'triangle', vol: 0.13, slideTo: 780 }); tone(760, 0.34, { type: 'triangle', vol: 0.12, delay: 0.22, slideTo: 340 }); },
    bara() { noise(0.65, { filter: 'highpass', filterFreq: 3800, vol: 0.13 }); },
    rimau() { tone(90, 0.6, { type: 'sawtooth', vol: 0.17, slideTo: 55 }); noise(0.55, { filter: 'lowpass', filterFreq: 300, vol: 0.1 }); },
    misha() { tone(65, 0.8, { type: 'sawtooth', vol: 0.18, slideTo: 45 }); noise(0.75, { filter: 'lowpass', filterFreq: 240, vol: 0.11, delay: 0.15 }); },
    merli() { noise(0.4, { filter: 'lowpass', filterFreq: 900, vol: 0.09 }); tone(760, 0.16, { type: 'triangle', vol: 0.1, delay: 0.18, slideTo: 1150 }); },
    raja() { tone(150, 0.7, { type: 'sawtooth', vol: 0.2, slideTo: 70 }); noise(0.5, { filter: 'lowpass', filterFreq: 500, vol: 0.12, delay: 0.05 }); },
    mochi() { barkBursts(1, 0.07, [900, 480]); },
    bao() { tone(390, 0.16, { type: 'square', vol: 0.11, slideTo: 300 }); tone(390, 0.16, { type: 'square', vol: 0.11, delay: 0.2, slideTo: 300 }); tone(330, 0.2, { type: 'square', vol: 0.1, delay: 0.42, slideTo: 280 }); },
  };

  const VOICE_ALIASES = { pusa: 'muning', agila: 'banog', uwak: 'gagak', ahas: 'ran' };

  function petVoice(species) {
    if (!enabled) return;
    try {
      const fn = PET_VOICES[VOICE_ALIASES[species] || species] || PET_VOICES.bantay;
      fn();
    } catch (err) { /* audio unavailable */ }
  }

  let rain = null;
  let rainTimer = null;

  function noiseBuffer(ac, seconds) {
    const len = Math.max(1, Math.floor(ac.sampleRate * seconds));
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function stopRain() {
    if (rainTimer) { clearTimeout(rainTimer); rainTimer = null; }
    if (rain) {
      try {
        rain.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.5);
        const dead = rain.src;
        setTimeout(() => { try { dead.stop(); dead.disconnect(); } catch (err) { /* gone */ } }, 1800);
      } catch (err) { /* ctx gone */ }
      rain = null;
    }
  }

  function thunderBoom() {
    if (!ctx || !enabled) return;
    try {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(ctx, 1.6);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 150;
      const g = ctx.createGain();
      const t0 = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.08);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.5);
      src.connect(f); f.connect(g); g.connect(sfxMaster || ctx.destination);
      src.start(t0); src.stop(t0 + 1.7);
    } catch (err) { /* audio unavailable */ }
  }

  function scheduleThunder() {
    if (rainTimer) clearTimeout(rainTimer);
    rainTimer = setTimeout(() => {
      if (!rain || rain.mode !== 'storm' || !enabled || !ctx) return;
      thunderBoom();
      scheduleThunder();
    }, 5000 + Math.floor(Math.random() * 11000));
  }

  function setRain(mode) {
    const want = mode === 'rain' || mode === 'storm' ? mode : 'off';
    if ((rain && rain.mode) === want) { ensureCtx(); return; }
    if (want === 'off') { stopRain(); return; }
    const ac = ensureCtx();
    if (!ac) { stopRain(); return; }
    try {
      stopRain();
      const src = ac.createBufferSource();
      src.buffer = noiseBuffer(ac, 2);
      src.loop = true;
      const filter = ac.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = want === 'storm' ? 900 : 1400;
      const gain = ac.createGain();
      gain.gain.value = 0.0001;
      src.connect(filter); filter.connect(gain); gain.connect(sfxMaster || ac.destination);
      src.start();
      rain = { src, gain, mode: want };
      gain.gain.setTargetAtTime(want === 'storm' ? 0.16 : 0.09, ac.currentTime, 1.4);
      if (want === 'storm') scheduleThunder();
    } catch (err) { rain = null; }
  }

  function getRain() { return rain ? rain.mode : 'off'; }

  return { play, playGacha, playWav, cryFor, isEnabled, setEnabled, setVolume, getVolume, setRain, getRain, petVoice, PET_VOICES };
});
