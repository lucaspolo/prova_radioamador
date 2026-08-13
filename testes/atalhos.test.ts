import { readFileSync } from "node:fs";
import { ATALHOS_DA_PROVA } from "@/lib/atalhos";
import { caminhoPdf, temPdf } from "@/lib/pdfs";
import { ROTULO_ARQUIVO } from "@/lib/secoes";

let falhas = 0;
function checar(nome: string, ok: boolean, detalhe = "") {
  if (!ok) falhas++;
  console.log(`${ok ? "  ok  " : "FALHA "} ${nome}${detalhe ? " — " + detalhe : ""}`);
}

/**
 * Um atalho que abre a página errada é pior do que atalho nenhum: ele parece
 * uma resposta. Como o mapa é escrito à mão a partir do sumário, a honestidade
 * dele se prova do mesmo jeito que a de `lib/secoes.ts` e `lib/referencia.ts`
 * — abrindo o PDF publicado e exigindo a âncora ali, e só ali.
 */

// A mesma normalização agressiva de secoes.test.ts: o extrator espaça e
// acentua diferente do texto curado (inclusive quebrando ligaduras, "certi fi
// cado"), e o que importa é a sequência de caracteres significativos.
function normalizar(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

async function paginasDe(arquivoOrigem: string): Promise<string[]> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const dados = new Uint8Array(readFileSync(`public${caminhoPdf(arquivoOrigem)}`));
  const pdf = await getDocument({ data: dados, useSystemFonts: true }).promise;
  const paginas: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const conteudo = await (await pdf.getPage(p)).getTextContent();
    paginas.push(
      normalizar(
        conteudo.items
          .map((i: unknown) => (i as { str?: string }).str ?? "")
          .join(" "),
      ),
    );
  }
  return paginas;
}

async function main() {
  checar("há atalhos para o procedimento do exame", ATALHOS_DA_PROVA.length >= 4);

  const rotulos = ATALHOS_DA_PROVA.map((a) => a.rotulo);
  checar("rótulo único por atalho", new Set(rotulos).size === rotulos.length);
  const enderecos = ATALHOS_DA_PROVA.map((a) => `${a.arquivo}|${a.pagina}`);
  checar(
    "nenhuma página apontada duas vezes",
    new Set(enderecos).size === enderecos.length,
  );
  // Sem PDF publicado o botão não renderiza — o atalho sumiria em silêncio.
  const semPdf = ATALHOS_DA_PROVA.filter((a) => !temPdf(a.arquivo));
  checar(
    "todo atalho aponta para um PDF publicado",
    semPdf.length === 0,
    semPdf.map((a) => a.arquivo).join("; "),
  );
  // O agrupamento da UI mostra de qual documento é cada atalho.
  checar(
    "todo documento apontado tem rótulo curto",
    ATALHOS_DA_PROVA.every((a) => !!ROTULO_ARQUIVO[a.arquivo]),
  );

  const porArquivo = new Map<string, string[]>();
  for (const arquivo of new Set(ATALHOS_DA_PROVA.map((a) => a.arquivo))) {
    porArquivo.set(arquivo, await paginasDe(arquivo));
  }

  for (const a of ATALHOS_DA_PROVA) {
    const paginas = porArquivo.get(a.arquivo)!;
    const texto = paginas[a.pagina - 1];
    const ancora = normalizar(a.ancora);
    checar(
      `[${a.rotulo}] a âncora está na p.${a.pagina}`,
      !!texto && texto.includes(ancora),
      a.ancora,
    );
    // O erro que este teste persegue é a paginação deslocada: se a âncora
    // aparecer na vizinha e não na apontada, o alvo andou junto com o PDF.
    if (texto?.includes(ancora)) continue;
    const onde = paginas.findIndex((p) => p.includes(ancora));
    if (onde >= 0) console.log(`       (encontrada na p.${onde + 1})`);
  }

  console.log(
    `\n${falhas === 0 ? "TODOS OS TESTES DE ATALHOS PASSARAM" : falhas + " FALHA(S)"}`,
  );
  process.exit(falhas === 0 ? 0 : 1);
}

void main();
