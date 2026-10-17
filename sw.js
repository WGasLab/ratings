// Keeps the rating pages and their songs on the phone. Pages: the network first, the stored copy only offline (cache
// first kept everyone on the version they first opened: new tests never showed up, 2026-10-17). Songs: the stored copy
// first; Safari asks media in byte ranges, so a stored song is answered as 206 Partial Content, sliced from it.
const CACHE = "ratings-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = url.origin + url.pathname.replace(/index\.html$/, "");
    const offline = () => new Response("Not saved on this phone yet: open it once with internet.", { status: 503, headers: { "Content-Type": "text/plain" } });
    if (req.mode === "navigate" || key.endsWith("/") || key.endsWith(".html")) {  // a page: always the newest when online
      try {
        const res = await fetch(key, { cache: "no-cache", redirect: "manual" });  // a redirect (no closing slash) goes back as is
        if (res.ok && res.status === 200) cache.put(key, res.clone());
        return res;
      } catch (err) {
        return (await cache.match(key)) || offline();
      }
    }
    const hit = await cache.match(key);
    if (hit) return req.headers.has("range") ? partial(hit, req.headers.get("range")) : hit;
    try { return await fetch(req); } catch (err) { return offline(); }
  })());
});
async function partial(res, range) {
  const buf = await res.arrayBuffer(), m = /bytes=(\d*)-(\d*)/.exec(range) || [];
  const start = m[1] ? Number(m[1]) : 0, end = m[2] ? Math.min(Number(m[2]), buf.byteLength - 1) : buf.byteLength - 1;
  return new Response(buf.slice(start, end + 1), { status: 206, headers: { "Content-Type": res.headers.get("Content-Type") || "audio/mpeg",
    "Content-Range": `bytes ${start}-${end}/${buf.byteLength}`, "Content-Length": String(end - start + 1), "Accept-Ranges": "bytes" } });
}
