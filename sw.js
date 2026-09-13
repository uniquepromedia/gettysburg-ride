/* Keeps a copy of the ride page so a reload with no signal still opens it.
   Navigations are served from the cache first: waiting on the network would
   hang on weak signal near the Round Tops. A new deploy changes VERSION, the
   browser installs this again, and the next load gets the new page. */
const VERSION = "ride-a56b25f36615";
self.addEventListener("install", e => {
  self.skipWaiting();
  e.waitUntil(caches.open(VERSION).then(c => c.add("./").catch(() => {})));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.mode !== "navigate") return;
  e.respondWith(caches.open(VERSION).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(e.request);
      if (res.ok) c.put(e.request, res.clone());
      return res;
    } catch (err) {
      return (await c.match("./")) || Response.error();
    }
  }));
});
