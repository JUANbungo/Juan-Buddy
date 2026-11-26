'use strict';

const CACHE = 'juanbuddy-v5';
const ASSETS = [
  './',
  './index.html',
  './mobile.css',
  './app.js',
  './rpg.js',
  './motivation.js',
  './sprites.js',
  './engine.js',
  './sfx.js',
  './bgm.js',
  './bgm/01_boss_thrash_battle.mid',
  './bgm/02_doom_boss_ceremony.mid',
  './bgm/03_final_boss_shred.mid',
  './bgm/04_cozy_home_acoustic.mid',
  './bgm/05_midnight_rooftop_chill.mid',
  './bgm/06_sunset_coffee_town.mid',
  './bgm/mp3/idle_pet_groove.mp3',
  './bgm/mp3/level_1_1.mp3',
  './bgm/mp3/level_13.mp3',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => Promise.all(ASSETS.map((a) => c.add(a).catch(() => {})))));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(event.request, copy));
      return res;
    })),
  );
});
