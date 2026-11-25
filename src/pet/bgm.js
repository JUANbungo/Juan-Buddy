(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.JBBgm = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  const TRACKS = {
    home: { file: 'bgm/04_cozy_home_acoustic.mid', label: 'Cozy Home' },
    night: { file: 'bgm/05_midnight_rooftop_chill.mid', label: 'Midnight Chill' },
    sunset: { file: 'bgm/06_sunset_coffee_town.mid', label: 'Sunset Town' },
    battle: { file: 'bgm/01_boss_thrash_battle.mid', label: 'Battle Thrash' },
    boss: { file: 'bgm/02_doom_boss_ceremony.mid', label: 'Boss Ceremony' },
    final: { file: 'bgm/03_final_boss_shred.mid', label: 'Final Shred' },
  };

  let ctx = null;
  let master = null;
  let enabled = true;
  let volume = 0.5;
  let current = null;
  let parsed = null;
  let timer = null;
  let loopStart = 0;
  const LOOKAHEAD = 0.35;

  try {
    if (typeof localStorage !== 'undefined') {
      enabled = localStorage.getItem('juanbuddy-bgm') !== 'off';
      const v = Number(localStorage.getItem('juanbuddy-bgm-vol'));
      if (!Number.isNaN(v) && v >= 0 && v <= 1) volume = v;
    }
  } catch (err) { /* storage unavailable */ }

  function readVlv(bytes, pos) {
    let value = 0;
    let shift = 0;
    for (;;) {
      const b = bytes[pos.pos++];
      value = (value << 7) | (b & 0x7f);
      if (!(b & 0x80)) break;
      shift += 7;
      if (shift > 28) break;
    }
    return value;
  }

  function parseMidi(buffer) {
    const data = new Uint8Array(buffer);
    let pos = 0;
    function u16() { const v = (data[pos] << 8) | data[pos + 1]; pos += 2; return v; }
    function u32() { const v = ((data[pos] << 24) | (data[pos + 1] << 16) | (data[pos + 2] << 8) | data[pos + 3]) >>> 0; pos += 4; return v; }
    if (u32() !== 0x4d546864) return null;
    u32();
    const format = u16();
    const trackCount = u16();
    const division = u16();
    const tempos = [{ tick: 0, usPq: 500000 }];
    const peaks = [];
    for (let t = 0; t < trackCount; t++) {
      while (pos < data.length && u32() !== 0x4d54726b) continue;
      if (pos > data.length) break;
      const len = u32();
      const end = pos + len;
      const trackPos = { pos };
      let tick = 0;
      let running = 0;
      const open = {};
      const notes = [];
      while (trackPos.pos < end) {
        tick += readVlv(data, trackPos);
        let status = data[trackPos.pos];
        if (status < 0x80) { status = running; } else { trackPos.pos++; running = status; }
        const hi = status & 0xf0;
        const ch = status & 0x0f;
        if (hi === 0x90) {
          const note = data[trackPos.pos++];
          const vel = data[trackPos.pos++];
          if (vel > 0) { open[note] = { tick, vel }; } else if (open[note]) {
            notes.push({ ch, note, vel: open[note].vel, start: open[note].tick, end: tick });
            delete open[note];
          }
        } else if (hi === 0x80) {
          const note = data[trackPos.pos++];
          trackPos.pos++;
          if (open[note]) { notes.push({ ch, note, vel: open[note].vel, start: open[note].tick, end: tick }); delete open[note]; }
        } else if (hi === 0xb0 || hi === 0xa0 || hi === 0xe0) {
          trackPos.pos += 2;
        } else if (hi === 0xc0 || hi === 0xd0) {
          trackPos.pos += 1;
        } else if (status === 0xff) {
          const type = data[trackPos.pos++];
          const l = readVlv(data, trackPos);
          if (type === 0x51 && l === 3) {
            tempos.push({ tick, usPq: (data[trackPos.pos] << 16) | (data[trackPos.pos + 1] << 8) | data[trackPos.pos + 2] });
          }
          trackPos.pos += l;
        } else if (status >= 0xf0) {
          const l = readVlv(data, trackPos);
          trackPos.pos += l;
        } else {
          break;
        }
      }
      pos = end;
      for (const note of Object.keys(open)) {
        notes.push({ ch: 0, note: Number(note), vel: open[note].vel, start: open[note].tick, end: tick });
      }
      if (notes.length) peaks.push(notes);
    }
    tempos.sort((a, b) => a.tick - b.tick);

    function tickToSec(tick) {
      let sec = 0;
      let lastTick = 0;
      let usPq = 500000;
      for (const e of tempos) {
        if (e.tick >= tick) break;
        if (e.tick > lastTick) sec += ((e.tick - lastTick) * usPq) / division / 1e6;
        lastTick = e.tick;
        usPq = e.usPq;
      }
      sec += ((tick - lastTick) * usPq) / division / 1e6;
      return sec;
    }

    const tracks = peaks.map((notes) => notes.map((n) => ({
      ch: n.ch,
      note: n.note,
      vel: n.vel / 127,
      start: tickToSec(n.start),
      dur: Math.max(0.05, tickToSec(n.end) - tickToSec(n.start)),
    })));
    let total = 0;
    for (const tr of tracks) for (const n of tr) total = Math.max(total, n.start + n.dur);
    return { tracks, duration: Math.max(1, total + 0.5), division };
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
      master = ctx.createGain();
      master.gain.value = volume * 0.5;
      master.connect(ctx.destination);
    } catch (err) {
      ctx = null;
    }
    return ctx;
  }

  let noiseBuf = null;
  function noise(ac) {
    if (noiseBuf) return noiseBuf;
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.25, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  function playNote(ac, ev, when) {
    const freq = 440 * Math.pow(2, (ev.note - 69) / 12);
    if (ev.ch === 9) {
      const src = ac.createBufferSource();
      src.buffer = noise(ac);
      const g = ac.createGain();
      const on = ev.dur < 0.12 ? 0.05 : 0.03;
      g.gain.setValueAtTime(on * (0.4 + ev.vel * 0.6), when);
      g.gain.exponentialRampToValueAtTime(0.0001, when + Math.min(0.22, ev.dur));
      src.connect(g);
      g.connect(master);
      src.start(when);
      src.stop(when + Math.min(0.25, ev.dur) + 0.02);
      return;
    }
    const isBass = ev.note < 52;
    const o = ac.createOscillator();
    o.type = isBass ? 'triangle' : 'square';
    o.frequency.setValueAtTime(freq, when);
    const o2 = ac.createOscillator();
    o2.type = 'square';
    o2.frequency.setValueAtTime(freq * 2.005, when);
    const g = ac.createGain();
    const g2 = ac.createGain();
    const peak = (isBass ? 0.16 : 0.1) * (0.35 + ev.vel * 0.65);
    const rel = Math.min(0.6, Math.max(0.08, ev.dur * 0.35));
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + 0.015);
    g.gain.setValueAtTime(peak, when + Math.max(0.02, ev.dur - rel));
    g.gain.exponentialRampToValueAtTime(0.0001, when + ev.dur);
    g2.gain.value = 0.35;
    o.connect(g);
    o2.connect(g2);
    g2.connect(g);
    g.connect(master);
    o.start(when);
    o2.start(when);
    o.stop(when + ev.dur + 0.05);
    o2.stop(when + ev.dur + 0.05);
  }

  function stopTimer() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  function stop() {
    stopTimer();
    stopMp3();
    if (master && ctx) {
      try {
        master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
        master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
      } catch (err) { /* ctx gone */ }
    }
    current = null;
    parsed = null;
    setTimeout(recreateMaster, 420);
  }

  function recreateMaster() {
    if (!ctx) return;
    try {
      const old = master;
      master = ctx.createGain();
      master.gain.value = enabled ? volume * 0.5 : 0;
      master.connect(ctx.destination);
      if (old) old.disconnect();
    } catch (err) { /* ignore */ }
  }

  const MP3_SONGS = [
    { file: 'bgm/mp3/idle_pet_groove.mp3', label: 'Idle Pet Groove' },
    { file: 'bgm/mp3/level_1_1.mp3', label: 'Level 1-1' },
    { file: 'bgm/mp3/level_13.mp3', label: 'Level 13' },
  ];
  let mp3Audio = null;
  let mp3Role = null;
  let mp3Idx = -1;
  let mp3Broken = false;
  let BGM_BASE = '';
  try {
    const cs = (typeof document !== 'undefined' && document.currentScript) ? document.currentScript : null;
    if (cs && cs.src && /^(https?|file):/i.test(cs.src) && cs.src.indexOf('blob:') !== 0) BGM_BASE = cs.src;
  } catch (err) { BGM_BASE = ''; }

  function assetUrls(rel) {
    const urls = [];
    if (BGM_BASE) {
      try { urls.push(new URL('../../assets/' + rel, BGM_BASE).href); } catch (err) { /* ignore */ }
    }
    urls.push(rel);
    return urls;
  }

  function mp3Volume() { return Math.max(0, Math.min(1, volume * 0.5)); }

  function stopMp3() {
    if (mp3Audio) {
      try { mp3Audio.pause(); } catch (err) { /* ignore */ }
      mp3Audio = null;
    }
    mp3Role = null;
  }

  function mp3Supported() { return typeof root.Audio === 'function'; }

  function pickSong() {
    let idx = Math.floor(Math.random() * MP3_SONGS.length);
    if (MP3_SONGS.length > 1 && idx === mp3Idx) idx = (idx + 1) % MP3_SONGS.length;
    return idx;
  }

  function startMp3(idx, role) {
    const song = MP3_SONGS[idx];
    if (!song) return false;
    const urls = assetUrls(song.file);
    stopMp3();
    try {
      const audio = new root.Audio();
      audio.loop = false;
      audio.volume = mp3Volume();
      let u = 0;
      audio.src = urls[0];
      audio.onerror = () => {
        u += 1;
        if (u < urls.length) {
          audio.src = urls[u];
          const r = audio.play();
          if (r && r.catch) r.catch(() => {});
          return;
        }
        mp3Broken = true;
        mp3Audio = null;
        mp3Role = null;
      };
      audio.addEventListener('ended', () => {
        if (!enabled || !mp3Supported() || mp3Broken) return;
        startMp3(pickSong(), role);
      });
      const q = audio.play();
      if (q && typeof q.catch === 'function') q.catch(() => { /* autoplay guard; next gesture restarts */ });
      mp3Audio = audio;
      mp3Idx = idx;
      mp3Role = role;
      current = role;
      return true;
    } catch (err) {
      mp3Broken = true;
      return false;
    }
  }

  function loadTrackFile(file) {
    return new Promise((resolve, reject) => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', file, true);
        xhr.responseType = 'arraybuffer';
        xhr.onload = () => {
          if (!xhr.response || (xhr.status !== 0 && xhr.status !== 200)) { reject(new Error(`http ${xhr.status}`)); return; }
          resolve(xhr.response);
        };
        xhr.onerror = () => reject(new Error('xhr error'));
        xhr.send();
      } catch (err) {
        reject(err);
      }
    }).catch(() => {
      if (typeof fetch === 'function') return fetch(file).then((r) => {
        if (!r.ok) throw new Error(`http ${r.status}`);
        return r.arrayBuffer();
      });
      throw new Error('no loader');
    });
  }

  function play(name) {
    const def = TRACKS[name];
    if (!def || !enabled) return Promise.resolve(false);
    if (mp3Supported() && !mp3Broken) {
      if (mp3Role === name && mp3Audio) return Promise.resolve(true);
      stop();
      current = name;
      return Promise.resolve(startMp3(pickSong(), name));
    }
    if (current === name) return Promise.resolve(true);
    stop();
    current = name;
    const ac = ensureCtx();
    if (!ac) return Promise.resolve(false);
    return assetUrls(def.file).reduce(
      (chain, url) => chain.then((raw) => (raw ? raw : loadTrackFile(url).then((buf) => (parseMidi(buf) ? buf : null)).catch(() => null))),
      Promise.resolve(null)
    )
      .then((raw) => new Promise((resolve, reject) => {
        if (!raw) { resolve(false); return; }
        const m = parseMidi(raw);
        if (!m) { resolve(false); return; }
        parsed = m;
        loopStart = ac.currentTime + 0.15;
        timer = setInterval(() => {
          if (!ctx || !parsed || !enabled) { stopTimer(); return; }
          const now = (ctx.currentTime - loopStart) % parsed.duration;
          for (let ti = 0; ti < parsed.tracks.length; ti++) {
            const tr = parsed.tracks[ti];
            for (let i = 0; i < tr.length; i++) {
              const ev = tr[i];
              let rel = ev.start - now;
              if (rel < -0.001) rel += parsed.duration;
              if (rel >= 0 && rel <= LOOKAHEAD) playNote(ctx, ev, ctx.currentTime + rel);
            }
          }
        }, 90);
        resolve(true);
      }))
      .catch(() => { current = null; return false; });
  }

  function ambientForHour(hour) {
    const h = hour === undefined ? new Date().getHours() : hour;
    if (h >= 20 || h < 6) return 'night';
    if (h >= 17) return 'sunset';
    return 'home';
  }

  function setVolume(v) {
    const val = Math.max(0, Math.min(1, Number(v)));
    if (Number.isNaN(val)) return;
    volume = val;
    try { localStorage.setItem('juanbuddy-bgm-vol', String(volume)); } catch (err) { /* ignore */ }
    if (master && ctx) master.gain.value = volume * 0.5;
    if (mp3Audio) { try { mp3Audio.volume = mp3Volume(); } catch (err) { /* ignore */ } }
  }

  function setEnabled(on) {
    enabled = !!on;
    try { localStorage.setItem('juanbuddy-bgm', on ? 'on' : 'off'); } catch (err) { /* ignore */ }
    if (!enabled) stop();
  }

  function getVolume() { return volume; }
  function getEnabled() { return enabled; }
  function nowPlaying() { return current; }

  return {
    TRACKS,
    MP3_SONGS,
    play,
    stop,
    ambientForHour,
    setVolume,
    getVolume,
    setEnabled,
    getEnabled,
    nowPlaying,
  };
});
