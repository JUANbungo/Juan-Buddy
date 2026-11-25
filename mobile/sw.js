'use strict';

const CACHE = 'juanbuddy-v4';
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
