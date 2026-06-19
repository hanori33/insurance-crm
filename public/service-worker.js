const CACHE_NAME = "insurance-crm-v5";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/boplan192.png",
  "/boplan512.png"
];

const STATIC_PATHS = new Set(APP_SHELL);
const SENSITIVE_PATH_PREFIXES = [
  "/api/",
  "/rest/v1/",
  "/auth/v1/",
  "/storage/v1/",
  "/functions/v1/"
];

function isSensitiveRequest(request, url) {
  if (request.headers.has("authorization")) return true;
  if (SENSITIVE_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    return true;
  }

  return ["token", "signature", "sig", "expires"].some((key) =>
    url.searchParams.has(key)
  );
}

function isStaticAsset(url) {
  return (
    STATIC_PATHS.has(url.pathname) ||
    url.pathname.startsWith("/static/")
  );
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return null;
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;
  if (isSensitiveRequest(event.request, requestUrl)) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok && response.type === "basic") {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put("/", responseToCache));
          }
          return response;
        })
        .catch(() => caches.match("/"))
    );
    return;
  }

  if (!isStaticAsset(requestUrl)) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          if (!response || !response.ok || response.type !== "basic") {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        })
        .catch(() => caches.match("/"));
    })
  );
});
