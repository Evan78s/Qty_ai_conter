/*
 * 鵲太醫 PWA Service Worker（保守策略）
 * - 只预缓存应用外壳（首屏 HTML + 图标），保证离线可打开壳
 * - API 请求一律直连网络，绝不缓存（避免数据陈旧）
 * - 静态资源：网络优先，失败回退缓存
 * - 激活时清理旧缓存，配合后台升级即时生效
 */
const CACHE = 'qty-shell-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/logo.ico', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // 只处理同源 GET
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  // API / 安装向导：直连网络，不缓存
  if (url.pathname.startsWith('/api/')) return;

  e.respondWith(
    fetch(req).then((res) => {
      // 成功响应时顺手更新静态资源缓存（不含 API）
      if (res.ok && !url.pathname.startsWith('/api/')) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req).then((hit) => hit || caches.match('/index.html')))
  );
});
