const CACHE = 'usdclp-v4';
const STATIC = ['/dolar/', '/dolar/style.css', '/dolar/app.js', '/dolar/config.js', '/dolar/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

// Network-first: siempre intenta la red (así los deploys llegan a los clientes)
// y cae al cache solo sin conexión. No intercepta /api/ ni recursos externos (CDN)
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }).catch(() =>
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        // Solo la navegación cae al index; scripts/estilos deben fallar limpio
        if (e.request.mode === 'navigate') return caches.match('/dolar/');
        return Response.error();
      })
    )
  );
});

// Recibir notificación push
self.addEventListener('push', e => {
  if (!e.data) return;
  const data = e.data.json();
  e.waitUntil(
    self.registration.showNotification(data.title || 'USD/CLP Tracker', {
      body:  data.body  || '',
      icon:  data.icon  || '/dolar/icon-192.png',
      badge: data.badge || '/dolar/icon-192.png',
      data:  data.data  || { url: '/dolar/' },
      vibrate: [200, 100, 200],
    })
  );
});

// Click en notificación → abrir la app
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/dolar/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(url));
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});
