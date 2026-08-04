#!/usr/bin/env node
/**
 * Copia os PDFs de estudo para public/pdfs/ e gera o mapa de nomes.
 *
 * Os arquivos originais têm espaços, acentos e "º" no nome — servi-los assim
 * exigiria codificação de URL em toda referência e quebra fácil. Aqui cada um
 * recebe um nome seguro, e lib/mapa-pdfs.json liga o `arquivo_origem` gravado
 * no banco de questões ao arquivo publicado.
 *
 *   node scripts/copiar_pdfs.mjs [diretorio-de-origem]
 */
import { readdirSync, mkdirSync, copyFileSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const ORIGEM =
  process.argv[2] ||
  process.env.DIRETORIO_PDFS ||
  "/home/lucaspolo/Downloads/materia_estudo_ra";
const DESTINO = join(RAIZ, "public", "pdfs");

/** Nome de arquivo seguro para URL: sem acentos, espaços ou pontuação. */
function apelido(nome) {
  return nome
    .replace(/\.pdf$/i, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove diacríticos
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 80);
}

let pdfs;
try {
  pdfs = readdirSync(ORIGEM).filter((f) => f.toLowerCase().endsWith(".pdf")).sort();
} catch {
  console.error(`ERRO: não consegui ler ${ORIGEM}`);
  console.error("Passe o diretório: node scripts/copiar_pdfs.mjs <caminho>");
  process.exit(1);
}

if (pdfs.length === 0) {
  console.error(`ERRO: nenhum PDF em ${ORIGEM}`);
  process.exit(1);
}

mkdirSync(DESTINO, { recursive: true });

const mapa = {};
const usados = new Set();
for (const nome of pdfs) {
  let slug = apelido(nome);
  // Dois nomes diferentes não podem colidir num mesmo arquivo publicado.
  let n = 2;
  while (usados.has(slug)) slug = `${apelido(nome)}-${n++}`;
  usados.add(slug);

  const destino = join(DESTINO, `${slug}.pdf`);
  copyFileSync(join(ORIGEM, nome), destino);
  mapa[nome] = `${slug}.pdf`;
  const kb = Math.round(statSync(destino).size / 1024);
  console.log(`  ${nome}\n    -> pdfs/${slug}.pdf (${kb} KB)`);
}

writeFileSync(
  join(RAIZ, "lib", "mapa-pdfs.json"),
  JSON.stringify(mapa, null, 2) + "\n",
  "utf8",
);

console.log(`\n${pdfs.length} PDFs copiados. Mapa em lib/mapa-pdfs.json`);
