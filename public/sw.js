// Simple Service Worker for PWA Compliance
const CACHE_NAME = 'teacher-portal-v2';
const urlsToCache = [
  '/teacher.html',
  '/manifest.json',
  '/pwa-logo.png'
];

self.addEventListener('install', event => {
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', event => {
  // Clean up old caches
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    }).then(() => clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Bypassing Supabase API calls
  if (event.request.url.includes('supabase.co')) return;
  
  // Network-First Strategy for app logic and pages
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // If valid response, clone it to cache
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
        }
        return response;
      })
      .catch(() => caches.match(event.request)) // Fallback to cache if offline
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
