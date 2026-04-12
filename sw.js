// ══════════════════════════════════════
// BMCS Service Worker · 牛市冷却系统
// 路径: lincoln0102.github.io/option/
// ══════════════════════════════════════
const CACHE_NAME = 'bmcs-v1';
const BASE = '/option/';

const ASSETS = [
  BASE + 'tradewisdom.html',
  BASE + 'manifest.json',
  BASE + 'icon-192.png',
  BASE + 'icon-512.png',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return Promise.allSettled(
        ASSETS.map(function(url) {
          var req = url.startsWith('http') ? new Request(url, { mode: 'no-cors' }) : url;
          return cache.add(req).catch(function() {
            console.warn('[SW] 缓存失败，跳过:', url);
          });
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k)   { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      if (cached) return cached;
      return fetch(e.request).then(function(response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(c) { c.put(e.request, clone); });
        }
        return response;
      }).catch(function() {
        if (e.request.destination === 'document') {
          return caches.match(BASE + 'tradewisdom.html');
        }
      });
    })
  );
});
