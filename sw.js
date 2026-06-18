const CACHE = 'remax-v1';

const PRECACHE = [
  '/',
  '/index.html',
  '/agent.html',
  '/broker.html',
  '/manifest.json',
  '/css/styles.css',
  '/js/utils.js',
  '/js/firebase-config.js',
  '/js/db.js',
  '/js/auth.js',
  '/js/charts.js',
  '/js/mobile.js',
  '/js/agent-app.js',
  '/js/broker-app.js',
  '/js/calendar.js',
  '/img/logo-balloon.svg',
  '/img/icon-192.png',
  '/img/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('firestore.googleapis.com')) return;
  if (e.request.url.includes('accounts.google.com')) return;
  if (e.request.url.includes('firebase')) return;
  if (e.request.url.includes('gstatic.com')) return;
  if (e.request.url.includes('cdn.jsdelivr.net')) return;
  if (e.request.url.includes('chart.js')) return;

  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      if (res.ok && res.type === 'basic') {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }).catch(() => caches.match('/')))
  );
});
