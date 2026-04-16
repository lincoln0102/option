// ══════════════════════════════════════
// BMCS Service Worker · 牛市冷却系统
// 策略：网络优先（Network First）
// 更新文件后普通刷新即可看到新版本
// ══════════════════════════════════════
const CACHE_NAME = 'bmcs-v7';
const BASE = '/option/';
const ASSETS = [
  BASE + 'tradewisdom.html',
  BASE + 'manifest.json',
  BASE + 'icon-192.png',
  BASE + 'icon-512.png',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap'
];

// ── 安装：预缓存静态资源 ──
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
  // 立即激活新 SW，不等待旧页面关闭
  self.skipWaiting();
});

// ── 激活：清除旧版本缓存 ──
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys
          .filter(function(k) { return k !== CACHE_NAME; })
          .map(function(k) {
            console.log('[SW] 清除旧缓存:', k);
            return caches.delete(k);
          })
      );
    })
  );
  // 立即接管所有已打开的页面
  self.clients.claim();
});

// ── 请求拦截：网络优先策略 ──
self.addEventListener('fetch', function(e) {
  if (e.request.method !== 'GET') return;

  var url = e.request.url;

  // 字体和外部资源：缓存优先（不经常变化，节省流量）
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        return cached || fetch(e.request).then(function(response) {
          if (response && response.status === 200) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function(c) { c.put(e.request, clone); });
          }
          return response;
        });
      })
    );
    return;
  }

  // Firebase / API 请求：直接走网络，不缓存
  if (url.includes('firebase') || url.includes('firestore') || url.includes('googleapis.com/identitytoolkit')) {
    return; // 不拦截，让浏览器直接处理
  }

  // ★ 核心 HTML 和本地资源：网络优先 ★
  // 先去网络拿最新版本，失败时才用缓存（离线保底）
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then(function(response) {
        // 网络成功：更新缓存，返回最新内容
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(c) { c.put(e.request, clone); });
        }
        return response;
      })
      .catch(function() {
        // 网络失败（离线）：用缓存兜底
        return caches.match(e.request).then(function(cached) {
          if (cached) return cached;
          // 最终兜底：返回主页面
          if (e.request.destination === 'document') {
            return caches.match(BASE + 'tradewisdom.html');
          }
        });
      })
  );
});

// ── 收到主线程消息：强制刷新缓存 ──
self.addEventListener('message', function(e) {
  if (e.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (e.data === 'CLEAR_CACHE') {
    caches.keys().then(function(keys) {
      keys.forEach(function(k) { caches.delete(k); });
    });
  }
});
