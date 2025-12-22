
const CACHE_NAME = 'task-assist-v2';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
];

// Install SW
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Listen for requests
self.addEventListener('fetch', (event) => {
  // Navigation preload response
  event.respondWith(
    (async () => {
      try {
        const preloadResponse = await event.preloadResponse;
        if (preloadResponse) {
          return preloadResponse;
        }

        // Stale-while-revalidate strategy
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(event.request);
        
        const networkFetch = fetch(event.request).then(response => {
           // Update cache asynchronously
           if (event.request.method === 'GET') {
             cache.put(event.request, response.clone());
           }
           return response;
        });

        return cachedResponse || networkFetch;
      } catch (error) {
        console.log('Fetch failed; returning offline page instead.', error);
        // Fallback or just return error (since it's SPA, index.html is cached)
      }
    })()
  );
});

self.addEventListener('activate', (event) => {
  if (self.registration.navigationPreload) {
    event.waitUntil(self.registration.navigationPreload.enable());
  }
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Background Sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-tasks') {
    event.waitUntil(
      // In a real app, this would iterate over IDB 'outbox' table and send requests
      // For this demo, we just signal to clients
      self.clients.matchAll().then(clients => {
        clients.forEach(client => client.postMessage({ type: 'SYNC_TRIGGERED' }));
      })
    );
  }
});

// Push Notification Handler (FCM Integration point)
self.addEventListener('push', (event) => {
  let title = 'TaskAssist';
  let options = {
    body: 'У вас новое уведомление',
    icon: 'https://picsum.photos/192/192',
    badge: 'https://picsum.photos/96/96',
    vibrate: [100, 50, 100],
    data: {
      url: '/'
    }
  };

  if (event.data) {
    try {
      const data = event.data.json();
      title = data.title || title;
      options = { ...options, ...data };
    } catch (e) {
      options.body = event.data.text();
    }
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const targetUrl = event.notification.data?.url || '/';

  // Focus window if open, otherwise open new
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
