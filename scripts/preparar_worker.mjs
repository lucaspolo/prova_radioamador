#!/usr/bin/env node
/**
 * Publica o worker do pdf.js em public/.
 *
 * O react-pdf carrega o pdf.js num Web Worker. O padrão é buscá-lo numa CDN,
 * o que quebraria offline e prenderia o app a um serviço externo; aqui ele é
 * copiado da versão instalada em node_modules e servido do próprio site.
 *
 * Roda automaticamente antes de `npm run dev` e `npm run build`. É gerado, e
 * não versionado, para nunca ficar defasado do pdfjs-dist instalado.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

try {
  const pdfjs = dirname(require.resolve("pdfjs-dist/package.json"));
  const origem = join(pdfjs, "build", "pdf.worker.min.mjs");
  const destino = join(RAIZ, "public", "pdf.worker.min.mjs");
  mkdirSync(join(RAIZ, "public"), { recursive: true });
  copyFileSync(origem, destino);
  const versao = require("pdfjs-dist/package.json").version;
  console.log(`worker do pdf.js ${versao} publicado em public/`);
} catch (e) {
  console.error("ERRO ao publicar o worker do pdf.js:", e.message);
  process.exit(1);
}
