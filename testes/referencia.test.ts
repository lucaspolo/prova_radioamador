import { readFileSync } from "node:fs";
import { TABELAS, type TabelaReferencia } from "@/lib/referencia";
import { caminhoPdf, temPdf } from "@/lib/pdfs";

let falhas = 0;
function checar(nome: string, ok: boolean, detalhe = "") {
  if (!ok) falhas++;
  console.log(`${ok ? "  ok  " : "FALHA "} ${nome}${detalhe ? " — " + detalhe : ""}`);
}

/**
 * Reduz o texto ao que é comparável entre a transcrição e o PDF.
 *
 * A extração do pdf.js quebra palavras em lugares arbitrários ("I ndicativo",
 * "X - Ray", "de fi nição" por causa da ligadura fi) e a mesma tabela usa
 * espaço fino, hífen e travessão sem critério. Descartar tudo que não é letra
 * ou dígito faz a comparação enxergar o conteúdo, não a diagramação.
 */
function norm(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

async function textoDasPaginas(
  arquivoOrigem: string,
  paginas: number[],
): Promise<{ texto: string; totalPaginas: number }> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const publicado = caminhoPdf(arquivoOrigem);
  const dados = new Uint8Array(readFileSync(`public${publicado}`));
  const pdf = await getDocument({ data: dados, useSystemFonts: true }).promise;

  const partes: string[] = [];
  for (const p of paginas) {
    if (p < 1 || p > pdf.numPages) continue;
    const conteudo = await (await pdf.getPage(p)).getTextContent();
    partes.push(
      conteudo.items
        .map((i: unknown) => (i as { str?: string }).str ?? "")
        .join(" "),
    );
  }
  return { texto: partes.join(" "), totalPaginas: pdf.numPages };
}

function trechosDe(linha: TabelaReferencia["linhas"][number]): string[] {
  return linha.trechosFonte ?? [linha.celulas.join(" ")];
}

async function main() {
  // --- Toda tabela aponta para um PDF publicado --------------------------
  for (const t of TABELAS) {
    checar(
      `[${t.id}] a fonte é um PDF publicado`,
      temPdf(t.fonte.arquivo),
      t.fonte.arquivo,
    );
    checar(`[${t.id}] declara ao menos uma página`, t.fonte.paginas.length > 0);
    checar(`[${t.id}] tem linhas`, t.linhas.length > 0);
  }

  const ids = TABELAS.map((t) => t.id);
  checar("ids de tabela são únicos", new Set(ids).size === ids.length);

  for (const t of TABELAS) {
    // A chave não é a primeira coluna: no plano de bandas o nome da faixa se
    // repete de propósito, porque no PDF ele é uma célula mesclada que cobre
    // várias subfaixas. O que não pode repetir é a linha inteira.
    const chaves = t.linhas.map((l) => l.celulas.join("|"));
    checar(
      `[${t.id}] não repete nenhuma linha`,
      new Set(chaves).size === chaves.length,
    );
    checar(
      `[${t.id}] toda linha tem o número de células das colunas`,
      t.linhas.every((l) => l.celulas.length === t.colunas.length),
    );
  }

  // --- A trava: cada linha existe, literalmente, na fonte citada ---------
  // Sem isto as tabelas seriam só mais um texto escrito de memória — que é
  // exatamente o que o README promete que este app não faz.
  for (const t of TABELAS) {
    const { texto, totalPaginas } = await textoDasPaginas(
      t.fonte.arquivo,
      t.fonte.paginas,
    );
    checar(
      `[${t.id}] as páginas citadas existem no PDF`,
      t.fonte.paginas.every((p) => p >= 1 && p <= totalPaginas),
      `${t.fonte.paginas.join(",")} de ${totalPaginas}`,
    );
    // Um PDF só de imagem devolveria pouco texto e tornaria a citação
    // inverificável — dois dos seis PDFs do repositório são assim.
    checar(
      `[${t.id}] as páginas citadas têm camada de texto`,
      texto.length > 200,
      `${texto.length} chars`,
    );

    const alvo = norm(texto);
    const ausentes = t.linhas.flatMap((l) =>
      trechosDe(l).filter((trecho) => !alvo.includes(norm(trecho))),
    );
    checar(
      `[${t.id}] as ${t.linhas.length} linhas conferem com a fonte`,
      ausentes.length === 0,
      ausentes.slice(0, 3).join(" | "),
    );
  }

  // --- O alfabeto fonético publicado é o mesmo que o banco cobra ---------
  {
    const fonetico = TABELAS.find((t) => t.id === "fonetico")!;
    const letras = fonetico.linhas.map((l) => l.celulas[0]);
    checar("o alfabeto fonético tem as 26 letras", letras.length === 26);
    checar(
      "as letras vão de A a Z, sem buraco",
      letras.join("") === "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      letras.join(""),
    );
  }

  // --- O plano de bandas fala das mesmas classes que o app simula --------
  {
    const bandas = TABELAS.find((t) => t.id === "bandas")!;
    const classes = new Set(bandas.linhas.map((l) => l.celulas[2]));
    checar(
      "a coluna de classes só usa os rótulos do Ato",
      [...classes].every((c) =>
        ["Todas as classes", "A", "A e B"].includes(c),
      ),
      [...classes].join(" | "),
    );
    // A Classe A é a única que opera 30, 20 e 17 metros — é o traço mais
    // citado do plano de bandas e serve de sentinela para transcrição torta.
    const so30m = bandas.linhas.find((l) => l.celulas[1].startsWith("10.100"));
    checar("30 metros é exclusiva da Classe A", so30m?.celulas[2] === "A");
  }

  console.log(
    `\n${falhas === 0 ? "TODOS OS TESTES DE REFERÊNCIA PASSARAM" : falhas + " FALHA(S)"}`,
  );
  process.exit(falhas === 0 ? 0 : 1);
}

main();
