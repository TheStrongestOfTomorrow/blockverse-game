const CACHE_NAME = 'blockverse-v1.1';
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
  './js/resource-manager.js',
  'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
];

// Install Event - Cache all core assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching core assets');
      return cache.addAll(ASSETS);
    })
  );
});

// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Stale-While-Revalidate Strategy
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests for complex strategies (keep it simple for core)
  if (!event.request.url.startsWith(self.location.origin) &&
      !event.request.url.includes('three.js') &&
      !event.request.url.includes('peerjs')) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchedResponse = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
          // Fallback if network fails and no cache
          return cachedResponse;
        });

        return cachedResponse || fetchedResponse;
      });
    })
  );
});
