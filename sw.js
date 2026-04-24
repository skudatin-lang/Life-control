// ════════════════════════════════════════
//  SERVICE WORKER
//  sw.js  (должен лежать в корне сайта)
//  Версия: v1.0
// ════════════════════════════════════════

const CACHE_NAME = "life-control-v1";

// Файлы, которые кешируем сразу при установке.
// Firebase и Google Fonts загружаются из сети — не кешируем их здесь,
// так как они управляют кешированием самостоятельно.
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/css/main.css",
  "/js/app.js",
  "/js/firebase.js",
  "/js/db.js",
  "/js/storage.js",
  "/js/modal.js",
  "/js/router.js",
  "/js/forms.js",
  "/js/utils.js",
  "/js/calendar.js",
  "/js/theme.js",
  "/js/tabs/dashboard.js",
  "/js/tabs/plan.js",
  "/js/tabs/goals.js",
  "/js/tabs/ideas.js",
  "/js/tabs/diary.js",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/manifest.json"
];

// ── INSTALL: кешируем все файлы приложения ──
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()) // активируем SW немедленно
  );
});

// ── ACTIVATE: удаляем старые кеши ──
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim()) // берём управление всеми вкладками
  );
});

// ── FETCH: стратегия "сначала сеть, потом кеш" ──
// Для Firebase запросов — только сеть (они всегда должны быть актуальными).
// Для статики — сначала кеш, потом сеть.
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // Firebase, Google APIs — только сеть, не трогаем
  if (
    url.hostname.includes("firebaseio.com")    ||
    url.hostname.includes("firestore.googleapis.com") ||
    url.hostname.includes("firebase.googleapis.com")  ||
    url.hostname.includes("googleapis.com")    ||
    url.hostname.includes("gstatic.com")       ||
    url.hostname.includes("google.com")        ||
    url.hostname.includes("fonts.googleapis.com") ||
    url.hostname.includes("fonts.gstatic.com")
  ) {
    return; // браузер обрабатывает сам
  }

  // Для GET-запросов к нашим файлам — Cache First
  if (event.request.method === "GET") {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;

        // Нет в кеше — загружаем из сети и сохраняем
        return fetch(event.request)
          .then(response => {
            // Кешируем только успешные ответы
            if (response && response.status === 200 && response.type === "basic") {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone);
              });
            }
            return response;
          })
          .catch(() => {
            // Офлайн и нет в кеше — показываем index.html (SPA fallback)
            if (event.request.mode === "navigate") {
              return caches.match("/index.html");
            }
          });
      })
    );
  }
});
