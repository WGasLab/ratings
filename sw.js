// Keeps the rating pages and their songs on the phone. Cache first; Safari asks media in byte ranges, so a
// stored song is answered as 206 Partial Content, sliced from the stored copy (a whole 200 would not play).
const CACHE = "ratings-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = url.origin + url.pathname.replace(/index\.html$/, "");
    const hit = await cache.match(key);
    if (hit) return req.headers.has("range") ? partial(hit, req.headers.get("range")) : hit;
    try {
      const res = await fetch(req);
      if (res.ok && res.status === 200 && (req.mode === "navigate" || key.endsWith("/"))) cache.put(key, res.clone());  // the page, for offline
      return res;
    } catch (err) {
      return new Response("Not saved on this phone yet: open it once with internet.", { status: 503, headers: { "Content-Type": "text/plain" } });
    }
  })());
});
async function partial(res, range) {
  const buf = await res.arrayBuffer(), m = /bytes=(\d*)-(\d*)/.exec(range) || [];
  const start = m[1] ? Number(m[1]) : 0, end = m[2] ? Math.min(Number(m[2]), buf.byteLength - 1) : buf.byteLength - 1;
  return new Response(buf.slice(start, end + 1), { status: 206, headers: { "Content-Type": res.headers.get("Content-Type") || "audio/mpeg",
    "Content-Range": `bytes ${start}-${end}/${buf.byteLength}`, "Content-Length": String(end - start + 1), "Accept-Ranges": "bytes" } });
}
