/* Keeps a copy of the ride page so a reload with no signal still opens it.
   Navigations are served from the cache first: waiting on the network would
   hang on weak signal near the Round Tops. A new deploy changes VERSION, the
   browser installs this again, and the next load gets the new page.
   VERSION is the SHA-1 of the page this worker belongs to. */
const VERSION = "ride-b9438ed4bb10";
self.addEventListener("install", e => {
  e.waitUntil((async () => {
    /* Skip the HTTP cache: GitHub Pages sends max-age=600, so a page fetched
       in the last ten minutes is the previous build. Store it only if it is
       this build. Any failure fails the install, and the old worker keeps
       its good copy. */
    const res = await fetch(new Request("./", { cache: "no-cache" }));
    if (!res.ok) throw new Error("page " + res.status);
    const sum = await crypto.subtle.digest("SHA-1", await res.clone().arrayBuffer());
    const hex = Array.from(new Uint8Array(sum), b => b.toString(16).padStart(2, "0")).join("");
    if ("ride-" + hex.slice(0, 12) !== VERSION) throw new Error("page is not this build");
    await (await caches.open(VERSION)).put("./", res);
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    if (await (await caches.open(VERSION)).match("./"))
      for (const k of await caches.keys())
        if (k !== VERSION && k.startsWith("ride-")) await caches.delete(k);
    await self.clients.claim();
  })());
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
