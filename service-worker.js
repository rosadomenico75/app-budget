// Service worker per App Budget.
// Nota: modificare CACHE_VERSION ogni volta che si aggiorna index.html/manifest/icone,
// cosi' il service worker scarica la nuova versione invece di servire quella vecchia in cache.
// I dati dell'utente (localStorage) NON sono toccati da questo file: aggiornare l'app
// non cancella mai i movimenti/tag gia' inseriti.
const CACHE_VERSION = 'v1';
const PRECACHE_NAME = `budget-app-precache-${CACHE_VERSION}`;
const RUNTIME_CACHE_NAME = `budget-app-runtime-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== PRECACHE_NAME && key !== RUNTIME_CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    // File dell'app: cache-first, con aggiornamento della cache in background.
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req)
          .then((res) => {
            if (res && res.status === 200) {
              caches.open(PRECACHE_NAME).then((cache) => cache.put(req, res.clone()));
            }
            return res;
          })
          .catch(() => cached || caches.match('./index.html'));
        return cached || network;
      })
    );
  } else {
    // Risorse esterne (es. libreria OCR da CDN): network-first, con fallback alla cache
    // per farle funzionare offline dopo il primo utilizzo.
    event.respondWith(
      caches.open(RUNTIME_CACHE_NAME).then((cache) =>
        cache.match(req).then((cached) => {
          const network = fetch(req)
            .then((res) => {
              if (res && res.status === 200) cache.put(req, res.clone());
              return res;
            })
            .catch(() => cached);
          return cached || network;
        })
      )
    );
  }
});
