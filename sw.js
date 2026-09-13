/* Keeps a copy of the ride page so a reload with no signal still opens it.
   Navigations are served from the cache first: waiting on the network would
   hang on weak signal near the Round Tops. A new deploy changes VERSION, the
   browser installs this again, and the next load gets the new page.
   VERSION is the SHA-1 of the page this worker belongs to. */
const VERSION = "ride-4d38d488041e";
/* Named by scope, so another park published beside this one keeps its copy. */
const PREFIX = "ride " + self.registration.scope + " ";
const CACHE = PREFIX + VERSION;
async function fetchThisBuild(url) {
  /* Skip the HTTP cache: GitHub Pages sends max-age=600, so a page fetched
     in the last ten minutes is the previous build. Give up after 30 seconds
     on weak signal, so a stalled update does not block the next one. */
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 30000);
  try {
    const res = await fetch(new Request(url, { cache: "no-cache", signal: ctl.signal }));
    if (!res.ok) return null;
    const sum = await crypto.subtle.digest("SHA-1", await res.clone().arrayBuffer());
    const hex = Array.from(new Uint8Array(sum), b => b.toString(16).padStart(2, "0")).join("");
    return "ride-" + hex.slice(0, 12) === VERSION ? res : null;
  } finally { clearTimeout(timer); }
}
self.addEventListener("install", e => {
  e.waitUntil((async () => {
    /* Store the page only if it is this build. Any failure fails the install,
       and the old worker keeps its good copy. index.html covers a local test
       server, where ./ is a directory listing. */
    const res = (await fetchThisBuild("./")) || (await fetchThisBuild("index.html"));
    if (!res) throw new Error("page is not this build");
    await (await caches.open(CACHE)).put("./", res);
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    if (await (await caches.open(CACHE)).match("./"))
      for (const k of await caches.keys())
        if (k !== CACHE && (k.startsWith(PREFIX) || /^ride-[0-9a-f]{12}$/.test(k))) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", e => {
  if (e.request.mode !== "navigate") return;
  /* One page: every open gets the verified copy, whatever the URL. */
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match("./");
    return hit || fetch(e.request);
  }));
});
