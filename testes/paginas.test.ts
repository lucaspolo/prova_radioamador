import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BANCO } from "@/lib/questoes";
import { caminhoPdf } from "@/lib/pdfs";
import type { Questao, Trecho } from "@/lib/tipos";

let falhas = 0;
function checar(nome: string, ok: boolean, detalhe = "") {
  if (!ok) falhas++;
  console.log(`${ok ? "  ok  " : "FALHA "} ${nome}${detalhe ? " — " + detalhe : ""}`);
}

const RAIZ = join(import.meta.dirname ?? __dirname, "..");

/**
 * A página é o endereço da questão dentro do PDF.
 *
 * `testes/pdfs.test.ts` já garante que ela existe; o que falta é garantir que
 * ela é a página do assunto. O erro que este teste persegue é específico e foi
 * observado no app: apontar para a página onde só está o TÍTULO da seção,
 * quando o texto começa na seguinte. Vários títulos da Cartilha caem na última
 * linha da página — "6.3 Código Q" é a linha final da p.35 e a tabela inteira
 * está na p.36 —, e quem clica em "Consultar Material" cai numa página sem
 * nada do que perguntou.
 */

// Palavras frequentes demais para distinguir uma página de outra. Mesma lista
// de lib/trechos.ts, pelo mesmo motivo.
const VAZIAS = new Set([
  "quando", "porque", "sobre", "podem", "poderá", "devem", "deverá", "dever",
  "sendo", "pelos", "pelas", "dessa", "desse", "desta", "deste", "aquele",
  "aquela", "outros", "outras", "todos", "todas", "mesmo", "mesma", "apenas",
  "ainda", "entre", "cada", "seja", "sejam", "qualquer", "conforme", "casos",
  "caso", "forma", "parte", "partir", "quais", "cujas", "cujos",
]);

function termos(texto: string): Set<string> {
  const brutos = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/);
  return new Set(
    brutos.filter((t) =>
      /\d/.test(t) ? t.length >= 2 : t.length >= 5 && !VAZIAS.has(t),
    ),
  );
}

/** Texto de cada página do PDF, na ordem física — o índice que o app usa. */
async function paginasDe(arquivoOrigem: string): Promise<Set<string>[]> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const publicado = caminhoPdf(arquivoOrigem)!;
  const dados = new Uint8Array(readFileSync(join(RAIZ, "public", publicado)));
  const pdf = await getDocument({ data: dados, useSystemFonts: true }).promise;

  const paginas: Set<string>[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const conteudo = await (await pdf.getPage(n)).getTextContent();
    paginas.push(
      termos(
        conteudo.items
          .map((i: unknown) => (i as { str?: string }).str ?? "")
          .join(" "),
      ),
    );
  }
  return paginas;
}

/** Fração dos termos da questão que aparecem na página. */
function cobertura(alvo: Set<string>, pagina: Set<string> | undefined): number {
  if (!pagina) return -1;
  let comuns = 0;
  for (const t of alvo) if (pagina.has(t)) comuns++;
  return comuns / alvo.size;
}

// Uma questão curta demais não tem termos suficientes para localizar nada.
const MIN_TERMOS = 8;
// Abaixo disto a página apontada praticamente não fala do assunto.
const MAX_NA_APONTADA = 0.3;
// A vizinha só desbanca a apontada se falar claramente do assunto...
const MIN_NA_VIZINHA = 0.5;
// ...e por uma diferença que não seja ruído de extração.
const MARGEM = 0.25;

async function main() {
  const origens = [...new Set(BANCO.map((q) => q.arquivo_origem))].sort();
  const porArquivo = new Map<string, Set<string>[]>();
  for (const o of origens) porArquivo.set(o, await paginasDe(o));
  console.log(
    `Lidos ${origens.length} PDFs, ` +
      `${[...porArquivo.values()].reduce((s, p) => s + p.length, 0)} páginas\n`,
  );

  // --- A página apontada é a do assunto, e não a vizinha -------------------
  const desalinhadas: string[] = [];
  let avaliadas = 0;

  for (const q of BANCO) {
    const paginas = porArquivo.get(q.arquivo_origem)!;
    const alvo = termos(`${q.afirmacao} ${q.explicacao_curta}`);
    if (alvo.size < MIN_TERMOS) continue;
    avaliadas++;

    const aqui = cobertura(alvo, paginas[q.pagina - 1]);
    if (aqui > MAX_NA_APONTADA) continue;

    for (const vizinha of [q.pagina - 1, q.pagina + 1]) {
      const la = cobertura(alvo, paginas[vizinha - 1]);
      if (la >= MIN_NA_VIZINHA && la - aqui >= MARGEM) {
        desalinhadas.push(
          `${q.id} p.${q.pagina} (${aqui.toFixed(2)}) vs p.${vizinha} ` +
            `(${la.toFixed(2)}): ${q.afirmacao.slice(0, 60)}`,
        );
        break;
      }
    }
  }

  console.log(`Questões com termos suficientes para aferir: ${avaliadas}\n`);
  checar(
    "nenhuma questão aponta para a página vizinha à do conteúdo",
    desalinhadas.length === 0,
    desalinhadas.slice(0, 6).join(" | "),
  );

  // --- Questão de trecho aponta para dentro do próprio trecho --------------
  // A página de uma questão "documento" é a fonte literal da afirmação, então
  // tem de cair no intervalo de páginas do chunk que a gerou. Fora dele, ou o
  // trecho está errado ou a página está.
  const trechos: Record<string, Trecho> = JSON.parse(
    readFileSync(join(RAIZ, "public", "trechos.json"), "utf-8"),
  );
  const foraDoTrecho: string[] = [];
  let comTrecho = 0;

  for (const q of BANCO as Questao[]) {
    if (!q.trecho_id) continue;
    const t = trechos[q.trecho_id];
    if (!t) {
      foraDoTrecho.push(`${q.id}: trecho_id ${q.trecho_id} não existe`);
      continue;
    }
    comTrecho++;
    if (q.pagina < t.pagina || q.pagina > Math.max(t.fim, t.pagina)) {
      foraDoTrecho.push(
        `${q.id}: p.${q.pagina} fora do trecho ${t.pagina}–${t.fim}`,
      );
    }
  }

  checar(
    `as ${comTrecho} questões de trecho apontam para dentro do trecho`,
    foraDoTrecho.length === 0,
    foraDoTrecho.slice(0, 4).join(" | "),
  );

  console.log(
    `\n${falhas === 0 ? "TODOS OS TESTES DE PÁGINA PASSARAM" : falhas + " FALHA(S)"}`,
  );
  process.exit(falhas === 0 ? 0 : 1);
}

// tsx compila em CJS, onde não há await de topo.
main();
