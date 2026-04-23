// Simple Service Worker for PWA Compliance
const CACHE_NAME = 'teacher-portal-v1';
const urlsToCache = [
  '/teacher.html',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

// Listener for Push Notifications (Future Expansion)
self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : {};
  const options = {
    body: data.body || 'New Notification',
    icon: '/vite.svg',
    badge: '/vite.svg',
    vibrate: [100, 50, 100]
  };
  event.waitUntil(
    self.registration.showNotification(data.title || 'School Routine', options)
  );
});
