import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  agruparEmCapitulos,
  divergente,
  gravarRevisoes,
  lerRevisoes,
  montarExportacao,
  ordenar,
  ordenarCapitulos,
  revisoesDoArquivo,
  type Revisoes,
} from "@/lib/conferencia";
import { criarDestacador } from "@/lib/destaque-pdf";
import { caminhoPdf } from "@/lib/pdfs";
import { BANCO } from "@/lib/questoes";
import mapa from "@/lib/mapa-pdfs.json";
import ocrVisao from "@/lib/ocr-visao.json";
import trechosJson from "../public/trechos.json";
import type { Questao, Trecho } from "@/lib/tipos";

const RAIZ = join(import.meta.dirname ?? __dirname, "..");
const TRECHOS = trechosJson as Record<string, Trecho>;
const OCR = ocrVisao as string[];
const POR_OCR: ReadonlySet<string> = new Set(OCR);

let falhas = 0;
function checar(nome: string, ok: boolean, detalhe = "") {
  if (!ok) falhas++;
  console.log(`${ok ? "  ok  " : "FALHA "} ${nome}${detalhe ? " — " + detalhe : ""}`);
}

// localStorage falso, já que este teste roda em Node e não no navegador.
class StorageFalso {
  private dados = new Map<string, string>();
  public recusar = false;
  getItem(k: string) {
    return this.dados.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (this.recusar) throw new Error("QuotaExceededError");
    this.dados.set(k, v);
  }
  removeItem(k: string) {
    this.dados.delete(k);
  }
  clear() {
    this.dados.clear();
  }
}
const storage = new StorageFalso();
(globalThis as unknown as { window: unknown }).window = { localStorage: storage };

// --- lib/ocr-visao.json aponta para arquivos que existem -------------------
{
  console.log(`PDFs lidos por OCR de visão: ${OCR.length}\n`);

  const origens = new Set(BANCO.map((q) => q.arquivo_origem));
  const forasteiros = OCR.filter((a) => !origens.has(a));
  checar(
    "todo arquivo de ocr-visao.json é referenciado pelo banco",
    forasteiros.length === 0,
    forasteiros.join("; "),
  );

  // Sem PDF publicado a tela não tem o que abrir ao lado da questão, e o aviso
  // de "transcrito por OCR" apontaria para o nada.
  const semPdf = OCR.filter(
    (a) => !(a in (mapa as Record<string, string>)) || !existsSync(join(RAIZ, "public", caminhoPdf(a) ?? "")),
  );
  checar(
    "todo arquivo de ocr-visao.json tem PDF publicado",
    semPdf.length === 0,
    semPdf.join("; "),
  );

  // O arquivo é gerado por `npm run conferencia` e versionado; se ele ficar
  // vazio, a tela perde a ordem que faz a revisão começar pelo que mais erra.
  checar("ocr-visao.json não está vazio", OCR.length > 0);
}

// --- Ordem: a mesma do relatório e das duas telas --------------------------
{
  const capitulos = agruparEmCapitulos(BANCO, POR_OCR);

  checar(
    "agrupa em um capítulo por arquivo do banco",
    capitulos.length === new Set(BANCO.map((q) => q.arquivo_origem)).size,
    `${capitulos.length} capítulos`,
  );
  checar(
    "nenhuma questão se perde no agrupamento",
    capitulos.reduce((n, c) => n + c.questoes.length, 0) === BANCO.length,
  );

  const digitalizados = capitulos.filter((c) => c.porOcr).length;
  checar(
    "os digitalizados vêm primeiro",
    capitulos.slice(0, digitalizados).every((c) => c.porOcr) &&
      capitulos.slice(digitalizados).every((c) => !c.porOcr),
    capitulos.map((c) => (c.porOcr ? "OCR" : "—")).join(" "),
  );

  // Entre os não digitalizados, quem menos depende da ementa vem antes: a
  // conferência contra a página aberta rende mais que a de memória.
  const naoOcr = capitulos.filter((c) => !c.porOcr).map((c) => c.daEmenta);
  checar(
    "entre os demais, menos ementa primeiro",
    naoOcr.every((v, i) => i === 0 || naoOcr[i - 1] <= v),
    naoOcr.map((v) => v.toFixed(2)).join(" "),
  );

  checar(
    "dentro do capítulo a ordem é a da página",
    capitulos.every((c) =>
      c.questoes.every((q, i) => i === 0 || c.questoes[i - 1].pagina <= q.pagina),
    ),
  );

  // A ordem tem de ser total: dois arquivos com o mesmo perfil, ou duas
  // questões na mesma página, não podem sair em ordem diferente a cada
  // execução — o relatório é comparado com `diff` entre regerações.
  const embaralhado = [...BANCO].reverse();
  const outra = agruparEmCapitulos(embaralhado, POR_OCR);
  checar(
    "a ordem não depende da ordem de entrada",
    JSON.stringify(outra.flatMap((c) => c.questoes.map((q) => q.id))) ===
      JSON.stringify(capitulos.flatMap((c) => c.questoes.map((q) => q.id))),
  );

  checar(
    "ordenar() desempata questão idêntica em página por origem",
    ordenar(
      { pagina: 3, origem: "documento", trecho_id: "a", id: "z" } as Questao,
      { pagina: 3, origem: "ementa", trecho_id: "a", id: "a" } as Questao,
    ) < 0,
  );
  checar(
    "ordenarCapitulos() põe OCR à frente mesmo com mais ementa",
    ordenarCapitulos(
      { arquivo: "b", questoes: [], porOcr: true, daEmenta: 1 },
      { arquivo: "a", questoes: [], porOcr: false, daEmenta: 0 },
    ) < 0,
  );
}

// --- Storage: ida e volta, e defesa contra lixo ----------------------------
{
  const revisoes: Revisoes = {
    aaa: { veredito: "V", nota: "", em: "2026-08-08T00:00:00.000Z" },
    bbb: { veredito: "P", nota: "tabela ilegível", em: "2026-08-08T00:01:00.000Z" },
    ccc: { veredito: null, nota: "conferir depois", em: "2026-08-08T00:02:00.000Z" },
  };

  checar("gravar devolve true quando o storage aceita", gravarRevisoes(revisoes));
  checar(
    "ler devolve o que foi gravado",
    JSON.stringify(lerRevisoes()) === JSON.stringify(revisoes),
  );

  storage.recusar = true;
  checar("gravar devolve false quando o storage recusa", !gravarRevisoes(revisoes));
  storage.recusar = false;

  // O storage é editável à mão e sobrevive a versões do app. Uma entrada
  // estragada não pode levar junto o resto de uma revisão de horas.
  storage.setItem(
    "prova-radioamador:conferencia",
    JSON.stringify({
      versao: 1,
      revisoes: {
        boa: { veredito: "F", nota: "ok", em: "x" },
        semVeredito: { veredito: "X", nota: "", em: "x" },
        semNota: { veredito: "V", em: "x" },
        naoObjeto: "V",
      },
    }),
  );
  const limpo = lerRevisoes();
  checar(
    "descarta só as entradas inválidas",
    Object.keys(limpo).join() === "boa",
    Object.keys(limpo).join(),
  );

  storage.setItem("prova-radioamador:conferencia", "{ não é json");
  checar("JSON inválido devolve vazio", Object.keys(lerRevisoes()).length === 0);

  storage.setItem("prova-radioamador:conferencia", JSON.stringify([1, 2, 3]));
  checar("array no lugar do envelope devolve vazio", Object.keys(lerRevisoes()).length === 0);

  storage.clear();
  checar("storage vazio devolve vazio", Object.keys(lerRevisoes()).length === 0);
}

// --- divergente() -----------------------------------------------------------
{
  const verdadeira = { resposta_correta: true } as Questao;
  const falsa = { resposta_correta: false } as Questao;
  const em = "2026-08-08T00:00:00.000Z";

  checar(
    "V contra gabarito V confere",
    !divergente(verdadeira, { veredito: "V", nota: "", em }),
  );
  checar(
    "F contra gabarito V diverge",
    divergente(verdadeira, { veredito: "F", nota: "", em }),
  );
  checar(
    "V contra gabarito F diverge",
    divergente(falsa, { veredito: "V", nota: "", em }),
  );
  checar(
    "problema sempre diverge",
    divergente(verdadeira, { veredito: "P", nota: "", em }) &&
      divergente(falsa, { veredito: "P", nota: "", em }),
  );
  checar(
    "nota sem veredito não é divergência",
    !divergente(verdadeira, { veredito: null, nota: "conferir", em }),
  );
}

// --- montarExportacao() -----------------------------------------------------
{
  // Questões reais do banco, para o item exportado sair com trecho e página de
  // verdade — é o que o agente do outro lado vai ler.
  const comTrecho = BANCO.filter((q) => q.trecho_id && TRECHOS[q.trecho_id])[0];
  const daEmenta = BANCO.filter((q) => q.origem === "ementa")[0];
  const confere = BANCO.filter(
    (q) => q.id !== comTrecho.id && q.id !== daEmenta.id,
  )[0];
  const em = "2026-08-08T00:00:00.000Z";

  const revisoes: Revisoes = {
    // Diverge do gabarito, sem nota.
    [comTrecho.id]: {
      veredito: comTrecho.resposta_correta ? "F" : "V",
      nota: "",
      em,
    },
    // Confere com o gabarito, mas tem observação.
    [daEmenta.id]: {
      veredito: daEmenta.resposta_correta ? "V" : "F",
      nota: "enunciado ambíguo",
      em,
    },
    // Confere e não tem nada a dizer: não deve aparecer nos itens.
    [confere.id]: {
      veredito: confere.resposta_correta ? "V" : "F",
      nota: "",
      em,
    },
  };

  const saida = montarExportacao(BANCO, revisoes, TRECHOS, POR_OCR, em);

  checar("o resumo conta o banco inteiro", saida.resumo.total === BANCO.length);
  checar("conta as revisões com veredito", saida.resumo.revisadas === 3);
  checar("conta a divergência", saida.resumo.divergencias === 1);
  checar("conta a nota", saida.resumo.comNota === 1);

  const ids = saida.itens.map((i) => i.id).sort();
  checar(
    "exporta a divergência e a nota, e só elas",
    ids.join() === [comTrecho.id, daEmenta.id].sort().join(),
    ids.join(),
  );

  const item = saida.itens.find((i) => i.id === comTrecho.id)!;
  checar("o item traz a afirmação", item.afirmacao === comTrecho.afirmacao);
  checar("o item traz o gabarito", item.gabarito === comTrecho.resposta_correta);
  checar("o item marca a divergência", item.divergencia);
  checar("o item traz o arquivo e a página", item.arquivo_origem === comTrecho.arquivo_origem && item.pagina === comTrecho.pagina);
  checar(
    "o item de documento traz a passagem de origem",
    typeof item.passagem === "string" && item.passagem.length > 0,
  );
  checar(
    "o item diz se a citação veio de OCR de visão",
    item.por_ocr_de_visao === POR_OCR.has(comTrecho.arquivo_origem),
  );

  const daEmentaItem = saida.itens.find((i) => i.id === daEmenta.id)!;
  checar("questão de ementa não inventa passagem", daEmentaItem.passagem === undefined);
  checar("questão de ementa que confere não é divergência", !daEmentaItem.divergencia);

  // `estado` é o que faz do arquivo um backup: sem ele, limpar o navegador no
  // meio da revisão perderia tudo que já conferia.
  checar(
    "estado guarda todas as revisões, inclusive as que conferem",
    Object.keys(saida.estado).length === 3,
  );

  // Nota antes de decidir: fica de fora de `revisadas` e de `estado`, mas o
  // achado precisa sair no arquivo mesmo assim.
  const soNota: Revisoes = {
    [confere.id]: { veredito: null, nota: "conferir contra o anexo", em },
  };
  const parcial = montarExportacao(BANCO, soNota, TRECHOS, POR_OCR, em);
  checar("nota sem veredito não conta como revisada", parcial.resumo.revisadas === 0);
  checar("nota sem veredito é contada à parte", parcial.resumo.semVeredito === 1);
  checar("nota sem veredito ainda sai nos itens", parcial.itens.length === 1);
  checar("nota sem veredito não entra no estado", Object.keys(parcial.estado).length === 0);

  // O ida-e-volta pelo arquivo: importar de volta tem de devolver o que saiu,
  // vereditos e notas — inclusive a nota que ainda não tinha decisão.
  const voltou = revisoesDoArquivo(saida)!;
  checar(
    "importar recupera os três vereditos",
    Object.keys(voltou).length === 3,
    Object.keys(voltou).length + " recuperados",
  );
  checar(
    "importar recupera a justificativa",
    voltou[daEmenta.id]?.nota === "enunciado ambíguo",
  );
  const voltouParcial = revisoesDoArquivo(parcial)!;
  checar(
    "importar recupera a nota sem veredito",
    voltouParcial[confere.id]?.nota === "conferir contra o anexo" &&
      voltouParcial[confere.id]?.veredito === null,
  );
  checar("importar rejeita arquivo estranho", revisoesDoArquivo({ oi: 1 }) === null);
  checar("importar rejeita não-objeto", revisoesDoArquivo("texto") === null);
}

// --- criarDestacador() ------------------------------------------------------
{
  checar("sem passagem não há destacador", criarDestacador(null) === null);
  checar("passagem curta demais não vira destaque", criarDestacador("art. 3") === null);

  // Uma passagem real de um trecho real: as linhas da camada de texto do PDF
  // são substrings dela, que é exatamente a aposta da regra de casamento.
  const trecho = Object.values(TRECHOS).find((t) => t.texto.length > 400)!;
  const linhas = trecho.texto.split("\n").filter((l) => l.trim().length > 20);
  const passagem = linhas.slice(0, 3).join("\n");
  const destacar = criarDestacador(passagem)!;

  checar(
    "grifa a linha que está na passagem",
    destacar({ str: linhas[0] }).startsWith("<mark"),
    linhas[0].slice(0, 60),
  );
  checar(
    "não grifa linha de fora da passagem",
    !destacar({ str: "conteúdo que não existe em lugar nenhum deste trecho" }).includes("<mark"),
  );
  checar(
    "não grifa fragmento curto",
    !destacar({ str: "de" }).includes("<mark"),
  );

  // O retorno é inserido como HTML. Um `<` cru abriria uma tag e o texto
  // sumiria da tela — num relatório para conferir o que está escrito na
  // página, texto que some é o pior defeito possível.
  const perigoso = criarDestacador("uma passagem qualquer bem comprida")!;
  const saida = perigoso({ str: '<script>alert(1)</script> & <b>' });
  checar(
    "escapa < & > no texto do PDF",
    !saida.includes("<script") && saida.includes("&lt;script&gt;") && saida.includes("&amp;"),
    saida,
  );

  const comMarcacao = criarDestacador("texto <b>com</b> marcação & sinais")!;
  checar(
    "escapa também quando grifa",
    comMarcacao({ str: "texto <b>com</b> marcação & sinais" }) ===
      "<mark class=\"destaque-conferencia\">texto &lt;b&gt;com&lt;/b&gt; marcação &amp; sinais</mark>",
    comMarcacao({ str: "texto <b>com</b> marcação & sinais" }),
  );

  // O pdfplumber e o pdf.js espaçam a mesma frase de formas diferentes; sem
  // colapsar espaço quase nada casaria.
  const espacado = criarDestacador("a potência de saída do transmissor")!;
  checar(
    "casa apesar do espaçamento diferente entre extratores",
    espacado({ str: "a  potência   de saída" }).includes("<mark"),
  );
}

console.log(`\n${falhas === 0 ? "TODOS OS TESTES DE CONFERÊNCIA PASSARAM" : falhas + " FALHA(S)"}`);
process.exit(falhas === 0 ? 0 : 1);
