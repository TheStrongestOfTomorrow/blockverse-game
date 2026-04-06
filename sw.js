const CACHE_NAME = 'blockverse-v1';
const ASSETS = [
  './',
  './index.html',
  './creator.html',
  './community.html',
  './css/style.css',
  './css/creator.css',
  './css/community.css',
  './js/config.js',
  './js/auth.js',
  './js/avatar.js',
  './js/friends.js',
  './js/ui.js',
  './js/multiplayer.js',
  './js/block-renderer.js',
  './js/world.js',
  './js/player.js',
  './js/tools.js',
  './js/chat.js',
  './js/lobby.js',
  './js/main.js',
  'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching all assets');
      return cache.addAll(ASSETS);
    })
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
