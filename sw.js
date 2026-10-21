// Guarda o app no aparelho para abrir rápido e funcionar com internet fraca.
// Ao publicar uma versão nova, troque o número abaixo (e o VERSAO no index.html).
const CACHE = "prontuarios-v10";
const SHELL = ["./", "./index.html", "./config.js", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const put = (res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); } return res; };
  // Arquivos do próprio app: tenta a internet primeiro (pega atualizações), usa a cópia se estiver sem rede.
  if (url.origin === location.origin) {
    e.respondWith(fetch(req, { cache: "no-cache" }).then(put).catch(() => caches.match(req).then((m) => m || caches.match("./index.html"))));
    return;
  }
  // Fontes e biblioteca do Firebase não mudam: usa a cópia guardada.
  if (/^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|www\.gstatic\.com\/firebasejs\/)/.test(req.url)) {
    e.respondWith(caches.match(req).then((m) => m || fetch(req).then(put)));
  }
});
