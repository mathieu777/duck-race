/*
 * Service worker — mise en cache de l'application pour un usage hors ligne.
 *
 * Stratégie : réseau d'abord, cache en secours.
 * Pour publier une nouvelle version, incrémentez CACHE_VERSION.
 */
const CACHE_VERSION = 'v5';
const CACHE_PREFIX = 'duck-race-';
const CACHE = `${CACHE_PREFIX}${CACHE_VERSION}`;
// Ancien nom du projet : on supprime aussi les caches créés sous ce nom
const LEGACY_CACHE_PREFIX = 'course-canards-';

// Tout ce qu'il faut pour jouer hors ligne. Un fichier oublié ici = un jeu cassé sans réseau :
// chaque nouveau module JavaScript, police ou image doit être ajouté à cette liste.
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/config.js',
  './js/store.js',
  './js/input.js',
  './js/race.js',
  './js/sprites.js',
  './js/fx.js',
  './js/scene.js',
  './js/icons.js',
  './js/ui.js',
  './js/main.js',
  './fonts/dynapuff-latin-wght-normal.woff2',
  './fonts/figtree-latin-wght-normal.woff2',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  // Le stockage du cache est partagé par tout le domaine (tous les projets d'un même compte github.io) :
  // on ne supprime donc que les anciens caches de ce jeu, jamais ceux d'un autre site.
  const isOldCacheOfThisGame = (key) =>
    key !== CACHE && (key.startsWith(CACHE_PREFIX) || key.startsWith(LEGACY_CACHE_PREFIX));

  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter(isOldCacheOfThisGame).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // On ne met en cache que les GET du même domaine
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html')))
  );
});
