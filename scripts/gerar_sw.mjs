// Gera out/sw.js depois do build (hook postbuild).
//
// O service worker não pode ser escrito à mão com lista fixa: os chunks do
// Next levam hash no nome e mudam a cada build. Este script varre o export
// pronto, monta a lista de pré-cache e injeta uma versão derivada do conteúdo
// — build novo troca a versão, o worker novo assume e limpa o cache antigo.
//
// Estratégias, decididas por rota:
// - navegação (HTML): rede primeiro, cache como reserva offline;
// - /_next/static: cache primeiro (nomes com hash são imutáveis);
// - /pdfs: cache primeiro também, mas honrando Range — o pdf.js lê por faixa,
//   e cache-primeiro cru devolve o arquivo inteiro para quem pediu um pedaço
//   (ver `comFaixa`). Os PDFs somam ~5 MB: baixam uma vez, ficam para leitura
//   offline;
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

// Casca do app: páginas, manifesto, ícones, assets com hash, worker do pdf.js
// e os trechos de origem. Os PDFs ficam de fora do pré-cache (entram no cache
// próprio quando abertos); banco_questoes.json também — ele é embutido no
// bundle JS e nunca é buscado pela aplicação. /conferencia entra porque é a
// única rota real além de /: fora do pré-cache, o deep link offline caía no
// fallback da casca e renderizava a home.
const precache = [
  "/",
  "/conferencia",
  "/manifest.webmanifest",
  "/trechos.json",
  "/pdf.worker.min.mjs",
];
for (const abs of arquivos(join(OUT, "_next", "static"))) {
  precache.push("/" + relative(OUT, abs).replaceAll("\\", "/"));
}
for (const nome of readdirSync(OUT)) {
  if (nome.startsWith("icone-")) precache.push(`/${nome}`);
}

// A versão precisa mudar quando o conteúdo muda. Os arquivos de _next/static
// têm hash no nome, então a lista basta; os HTML e trechos.json não têm —
// entram pelo conteúdo.
const versao = createHash("sha1")
  .update(JSON.stringify(precache.sort()))
  .update(readFileSync(join(OUT, "index.html")))
  .update(readFileSync(join(OUT, "conferencia.html")))
  .update(readFileSync(join(OUT, "trechos.json")))
  .digest("hex")
  .slice(0, 12);

const sw = `// Gerado por scripts/gerar_sw.mjs — não editar à mão.
const CACHE = "radioamador-${versao}";
const CACHE_PDFS = "radioamador-pdfs-v1";
const PRECACHE = ${JSON.stringify(precache, null, 1)};

self.addEventListener("install", (e) => {
  // Sem skipWaiting: a versão nova instala e fica esperando até o usuário
  // aceitar recarregar (o app mostra o convite fora de bateria). Assumir no
  // meio do uso apagava o cache dos chunks antigos com abas abertas, e um
  // import() tardio — o visualizador de PDF é dinâmico — quebrava.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
});

self.addEventListener("message", (e) => {
  if (e.data && e.data.tipo === "assumir") self.skipWaiting();
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

// O PDF tem de honrar Range, ou o pdf.js quebra.
//
// \`caches.match()\` casa só pela URL: o header Range é ignorado, e o cache
// devolve o arquivo inteiro para quem pediu um pedaço. O pdf.js pede o último
// pedaço da Cartilha (9.855 bytes a partir do byte 1.507.328), recebe 1.517.183,
// e aborta com "Bad end offset: 3024511" — a soma dos dois. Cache-primeiro cru
// não serve para arquivo que se lê por faixa.
//
// A busca na rede é sempre da URL sem o header, de propósito: o Cache Storage
// recusa guardar 206, e é o arquivo inteiro que interessa para a leitura
// offline. O recorte sai de \`blob.slice()\`, que é uma vista e não uma cópia —
// fatiar 23 pedaços não relê 1,5 MB vinte e três vezes.
async function comFaixa(req, nomeCache) {
  const cache = await caches.open(nomeCache);
  let inteiro = await cache.match(req.url);
  if (!inteiro) {
    inteiro = await fetch(req.url);
    if (inteiro.ok) await cache.put(req.url, inteiro.clone());
  }

  const faixa = req.headers.get("range");
  const m = faixa && /^bytes=(\\d*)-(\\d*)$/.exec(faixa);
  if (!m || !inteiro.ok) return inteiro;

  const blob = await inteiro.blob();
  const total = blob.size;
  // "bytes=-500" são os últimos 500, e não os 500 primeiros.
  const inicio = m[1] ? Number(m[1]) : Math.max(0, total - Number(m[2] || 0));
  const fim = m[1] && m[2] ? Math.min(Number(m[2]), total - 1) : total - 1;
  if (inicio > fim) return inteiro;

  return new Response(blob.slice(inicio, fim + 1), {
    status: 206,
    statusText: "Partial Content",
    headers: {
      "Content-Type": inteiro.headers.get("Content-Type") || "application/pdf",
      "Content-Length": String(fim - inicio + 1),
      "Content-Range": \`bytes \${inicio}-\${fim}/\${total}\`,
      "Accept-Ranges": "bytes",
    },
  });
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

  // Duas cascas: /conferencia tem página própria no pré-cache; todo o resto
  // da navegação cai na casca de "/" (o app é de rota única fora dela).
  if (e.request.mode === "navigate") {
    const casca = url.pathname.startsWith("/conferencia") ? "/conferencia" : "/";
    e.respondWith(redePrimeiro(e.request, casca));
    return;
  }
  if (url.pathname.startsWith("/pdfs/")) {
    e.respondWith(comFaixa(e.request, CACHE_PDFS));
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
  precache.reduce((s, p) => {
    const arquivo = p === "/" ? "index.html" : p === "/conferencia" ? "conferencia.html" : p;
    return s + statSync(join(OUT, arquivo)).size;
  }, 0) / 1024,
);
console.log(`sw.js gerado: versão ${versao}, ${precache.length} arquivos no pré-cache (~${kb} KB)`);
