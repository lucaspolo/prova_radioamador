// Gera out/sw.js depois do build (hook postbuild).
//
// O service worker não pode ser escrito à mão com lista fixa: os chunks do
// Next levam hash no nome e mudam a cada build. Este script varre o export
// pronto, monta a lista de pré-cache e injeta uma versão derivada do conteúdo
// — build novo troca a versão, o worker novo assume e limpa o cache antigo.
//
// Estratégias, decididas por rota:
// - navegação (HTML): rede primeiro, cache como reserva offline;
// - /_next/static e /pdfs: cache primeiro (nomes com hash são imutáveis, e os
//   PDFs somam ~5 MB — baixam uma vez, ficam para leitura offline);
// - demais GETs (trechos.json, worker do pdf.js): rede primeiro com reserva.
//
// Os PDFs ficam num cache próprio que sobrevive a deploys: o conteúdo deles
// não muda com o build, e re-baixar 5 MB a cada versão puniria quem estuda
// no celular.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const RAIZ = join(import.meta.dirname, "..");
const OUT = join(RAIZ, "out");

function arquivos(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const caminho = join(dir, e.name);
    return e.isDirectory() ? arquivos(caminho) : [caminho];
  });
}

// Casca do app: página, manifesto, ícones, assets com hash, worker do pdf.js
// e os trechos de origem. Os PDFs ficam de fora do pré-cache (entram no cache
// próprio quando abertos); banco_questoes.json também — ele é embutido no
// bundle JS e nunca é buscado pela aplicação.
const precache = ["/", "/manifest.webmanifest", "/trechos.json", "/pdf.worker.min.mjs"];
for (const abs of arquivos(join(OUT, "_next", "static"))) {
  precache.push("/" + relative(OUT, abs).replaceAll("\\", "/"));
}
for (const nome of readdirSync(OUT)) {
  if (nome.startsWith("icone-")) precache.push(`/${nome}`);
}

// A versão precisa mudar quando o conteúdo muda. Os arquivos de _next/static
// têm hash no nome, então a lista basta; index.html e trechos.json não têm —
// entram pelo conteúdo.
const versao = createHash("sha1")
  .update(JSON.stringify(precache.sort()))
  .update(readFileSync(join(OUT, "index.html")))
  .update(readFileSync(join(OUT, "trechos.json")))
  .digest("hex")
  .slice(0, 12);

const sw = `// Gerado por scripts/gerar_sw.mjs — não editar à mão.
const CACHE = "radioamador-${versao}";
const CACHE_PDFS = "radioamador-pdfs-v1";
const PRECACHE = ${JSON.stringify(precache, null, 1)};

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(
        chaves
          .filter((k) => k !== CACHE && k !== CACHE_PDFS)
          .map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

function cachePrimeiro(req, nomeCache) {
  return caches.match(req).then(
    (hit) => hit || fetch(req).then((resp) => {
      const copia = resp.clone();
      caches.open(nomeCache).then((c) => c.put(req, copia));
      return resp;
    })
  );
}

function redePrimeiro(req, fallback) {
  return fetch(req)
    .then((resp) => {
      const copia = resp.clone();
      caches.open(CACHE).then((c) => c.put(fallback ?? req, copia));
      return resp;
    })
    .catch(() => caches.match(fallback ?? req));
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;

  // App de rota única: qualquer navegação cai na casca em "/".
  if (e.request.mode === "navigate") {
    e.respondWith(redePrimeiro(e.request, "/"));
    return;
  }
  if (url.pathname.startsWith("/pdfs/")) {
    e.respondWith(cachePrimeiro(e.request, CACHE_PDFS));
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(cachePrimeiro(e.request, CACHE));
    return;
  }
  e.respondWith(redePrimeiro(e.request));
});
`;

writeFileSync(join(OUT, "sw.js"), sw);
const kb = Math.round(
  precache.reduce((s, p) => s + statSync(join(OUT, p === "/" ? "index.html" : p)).size, 0) / 1024,
);
console.log(`sw.js gerado: versão ${versao}, ${precache.length} arquivos no pré-cache (~${kb} KB)`);
