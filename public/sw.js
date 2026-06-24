const CACHE_NAME = "wedding-itinerary-v1";
const SHELL_PATHS = ["/itinerary", "/login"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_PATHS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  if (!isSameOrigin) return;

  if (url.pathname.startsWith("/api/sync")) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (
    url.pathname.startsWith("/itinerary") ||
    url.pathname === "/" ||
    url.pathname === "/login"
  ) {
    event.respondWith(networkFirst(event.request));
  }
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error("Offline and no cached response");
  }
}
