import { readFileSync } from "node:fs";
import { listarAssuntos, secaoDe, SECOES } from "@/lib/secoes";
import { caminhoPdf, temPdf } from "@/lib/pdfs";
import { BANCO } from "@/lib/questoes";
import ocrVisao from "@/lib/ocr-visao.json";

let falhas = 0;
function checar(nome: string, ok: boolean, detalhe = "") {
  if (!ok) falhas++;
  console.log(`${ok ? "  ok  " : "FALHA "} ${nome}${detalhe ? " — " + detalhe : ""}`);
}

// A mesma normalização agressiva de referencia.test.ts: o extrator espaça e
// acentua diferente do texto curado, e o que importa é a sequência de
// caracteres significativos.
function normalizar(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

async function textoDaFaixa(
  arquivoOrigem: string,
  inicio: number,
  fim: number,
): Promise<string> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const dados = new Uint8Array(readFileSync(`public${caminhoPdf(arquivoOrigem)}`));
  const pdf = await getDocument({ data: dados, useSystemFonts: true }).promise;
  const partes: string[] = [];
  for (let p = inicio; p <= Math.min(fim, pdf.numPages); p++) {
    const conteudo = await (await pdf.getPage(p)).getTextContent();
    partes.push(
      conteudo.items
        .map((i: unknown) => (i as { str?: string }).str ?? "")
        .join(" "),
    );
  }
  return partes.join(" ");
}

async function main() {
  // --- Sanidade do mapa ---------------------------------------------------
  for (const s of SECOES) {
    checar(
      `[${s.titulo}] faixa válida e PDF publicado`,
      s.paginaInicio >= 1 && s.paginaInicio <= s.paginaFim && temPdf(s.arquivo),
      `${s.arquivo} pp. ${s.paginaInicio}-${s.paginaFim}`,
    );
  }
  const rotulos = SECOES.map((s) => `${s.arquivo}|${s.titulo}`);
  checar("título único por arquivo", new Set(rotulos).size === rotulos.length);

  // --- Toda questão de documento tem seção --------------------------------
  // É a garantia de cobertura da curadoria: uma página nova fora do mapa
  // (banco regenerado, PDF trocado) derruba o teste em vez de sumir da UI.
  const semSecao = BANCO.filter(
    (q) => q.origem === "documento" && secaoDe(q) === null,
  );
  checar(
    "toda questão de documento cai numa seção",
    semSecao.length === 0,
    semSecao
      .slice(0, 5)
      .map((q) => `${q.arquivo_origem} p.${q.pagina}`)
      .join("; "),
  );
  checar(
    "questão da ementa nunca tem seção",
    BANCO.filter((q) => q.origem === "ementa").every((q) => secaoDe(q) === null),
  );

  // --- A âncora existe na faixa declarada ---------------------------------
  // O mesmo espírito de referencia.test.ts: o mapa é escrito à mão, e a
  // honestidade dele se prova abrindo o PDF. Os digitalizados não têm camada
  // de texto onde procurar — ficam de fora pela mesma fonte de verdade que o
  // app usa (lib/ocr-visao.json).
  const porOcr = new Set<string>(ocrVisao);
  for (const s of SECOES) {
    if (porOcr.has(s.arquivo)) continue;
    const texto = normalizar(
      await textoDaFaixa(s.arquivo, s.paginaInicio, s.paginaFim),
    );
    const ancora = normalizar(s.ancora ?? s.titulo);
    checar(
      `[${s.titulo}] âncora na faixa pp. ${s.paginaInicio}-${s.paginaFim}`,
      texto.includes(ancora),
      s.ancora ?? s.titulo,
    );
  }

  // --- listarAssuntos: seções ∪ tópicos, só assunto com bateria -----------
  const assuntos = listarAssuntos("B");
  checar("há assuntos para estudar", assuntos.length > 10, String(assuntos.length));
  checar(
    "todo assunto listado tem questões",
    assuntos.every((a) => a.questoes.length > 0),
  );
  checar(
    "as questões de cada seção caem na faixa dela",
    assuntos.every(
      (a) =>
        !a.secao ||
        a.questoes.every(
          (q) =>
            q.arquivo_origem === a.secao!.arquivo &&
            q.pagina >= a.secao!.paginaInicio &&
            q.pagina <= a.secao!.paginaFim,
        ),
    ),
  );
  checar(
    "classe A não perde assunto em relação à B",
    listarAssuntos("A").length >= assuntos.length,
  );

  // --- Tópicos da ementa: a outra metade do assunto -----------------------
  checar(
    "toda questão de ementa tem topico",
    BANCO.filter((q) => q.origem === "ementa").every((q) => !!q.topico),
  );
  checar(
    "nenhuma questão de documento tem topico",
    BANCO.filter((q) => q.origem === "documento").every((q) => !q.topico),
  );
  const daEmenta = assuntos.filter((a) => !a.secao);
  checar("os tópicos da ementa viram assuntos", daEmenta.length > 10, String(daEmenta.length));
  checar(
    "todo grupo de ementa se declara como tal",
    daEmenta.every((a) => a.grupo.startsWith("Ementa")),
  );
  // Toda questão de ementa do acervo aparece em exatamente um assunto.
  const idsListados = daEmenta.flatMap((a) => a.questoes.map((q) => q.id));
  const doAcervoEmenta = BANCO.filter(
    (q) => q.origem === "ementa" && q.nivel === "B",
  );
  checar(
    "nenhuma questão de ementa fica órfã de assunto",
    idsListados.length === doAcervoEmenta.length &&
      new Set(idsListados).size === idsListados.length,
    `${idsListados.length} listadas de ${doAcervoEmenta.length}`,
  );
  // As fusões de rótulo: os dois nomes do alfabeto fonético são UM assunto.
  const foneticos = daEmenta.filter((a) =>
    a.titulo.toLowerCase().includes("fonétic"),
  );
  checar(
    "os dois tópicos de fonético fundem num assunto só",
    foneticos.length === 1 && foneticos[0].questoes.length >= 30,
    foneticos.map((a) => `${a.titulo}(${a.questoes.length})`).join(", "),
  );

  console.log(
    `\n${falhas === 0 ? "TODOS OS TESTES DE SEÇÕES PASSARAM" : falhas + " FALHA(S)"}`,
  );
  process.exit(falhas === 0 ? 0 : 1);
}

void main();
