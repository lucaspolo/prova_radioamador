import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  achadosTriados,
  agruparEmCapitulos,
  aoAnotar,
  aoMarcar,
  darPorVistas,
  divergente,
  gravarRevisoes,
  lerRevisoes,
  mesclarRevisoes,
  montarExportacao,
  ordenar,
  ordenarCapitulos,
  pendente,
  revisoesDoArquivo,
  type Revisoes,
} from "@/lib/conferencia";
import { achadosDeclarados, IDS_TRIADOS, TRIAGENS } from "@/lib/triagem";
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

// --- As questões protegidas do verificador continuam no banco --------------
{
  const correcoes = JSON.parse(
    readFileSync(join(RAIZ, "scripts", "correcoes.json"), "utf8"),
  ) as Record<string, { acao: string; motivo?: string }>;

  const acoes = new Set(Object.values(correcoes).map((c) => c.acao));
  checar(
    "toda correção usa uma ação conhecida",
    [...acoes].every((a) => ["remover", "editar", "manter"].includes(a)),
    [...acoes].join(", "),
  );

  const protegidas = Object.entries(correcoes).filter(
    ([, c]) => c.acao === "manter",
  );
  const noBanco = new Set(BANCO.map((q) => q.id));

  /**
   * `manter` existe porque o passe --verificar já apagou questão certa: ele
   * descartou o significado de QRA aplicando a convenção da UIT, contra a
   * tabela da Cartilha que a prova cobra. A proteção some do log num arquivo
   * que ninguém lê; o que denuncia a reincidência é isto aqui.
   */
  const sumidas = protegidas.filter(([id]) => !noBanco.has(id));
  checar(
    "toda questão protegida do verificador está no banco",
    sumidas.length === 0,
    sumidas.map(([id]) => id).join("; "),
  );

  // Proteger sem dizer contra o quê é opinião, não conferência: o motivo é o
  // único registro de que alguém abriu a página.
  const semMotivo = protegidas.filter(([, c]) => (c.motivo ?? "").length < 40);
  checar(
    "toda proteção declara onde o fato foi conferido",
    semMotivo.length === 0,
    semMotivo.map(([id]) => id).join("; "),
  );
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

// --- o arquivo leva a revisão para outro computador -------------------------
//
// O relatório guarda só o que precisa de ação, e por isso não servia de bagagem:
// reconstruir a revisão a partir dele perdia a nota do achado já dado por visto e
// perdia inteira a revisão que era só nota. O campo `revisoes` existe para o
// ida-e-volta ser exato, e é isso que se mede aqui — questão a questão, e não por
// contagem, que é o que deixava as duas perdas passarem.
{
  const em = "2026-01-01T00:00:00.000Z";
  const outroDia = "2025-12-01T10:00:00.000Z";
  const [q1, q2, q3, q4] = BANCO;

  const antes: Revisoes = {
    // Achado encerrado: o veredito volta por `estado`, mas a nota saía de `itens`
    // junto com ele.
    [q1.id]: {
      veredito: q1.resposta_correta ? "V" : "F",
      nota: "conferi contra a Tabela II",
      em,
      visto: em,
    },
    // Nota sem veredito e já vista: não cabia em `estado` nem em `itens`.
    [q2.id]: { veredito: null, nota: "voltar aqui depois", em, visto: em },
    // Revisada noutro dia: a data dizia antes de qual regeração isso foi feito, e
    // virava a data da exportação.
    [q3.id]: { veredito: q3.resposta_correta ? "V" : "F", nota: "", em: outroDia },
    // Divergência comum, que o formato antigo já levava.
    [q4.id]: { veredito: q4.resposta_correta ? "F" : "V", nota: "", em },
  };

  const arquivo = montarExportacao(
    BANCO,
    antes,
    TRECHOS,
    POR_OCR,
    "2026-02-02T00:00:00.000Z",
  );
  const depois = revisoesDoArquivo(arquivo)!;

  for (const [rotulo, id] of [
    ["achado dado por visto", q1.id],
    ["nota sem veredito dada por vista", q2.id],
    ["revisada em outro dia", q3.id],
    ["divergência simples", q4.id],
  ] as const) {
    checar(
      `o arquivo devolve a revisão intacta: ${rotulo}`,
      JSON.stringify(depois[id]) === JSON.stringify(antes[id]),
      JSON.stringify(depois[id]),
    );
  }

  checar(
    "o backup não inventa revisão em questão não revisada",
    Object.keys(depois).length === 4,
    Object.keys(depois).length + " no arquivo",
  );
  checar(
    "o relatório continua guardando só o que pede ação",
    // q1 e q2 estão encerrados, q3 confere e não tem nota: sobra a divergência.
    arquivo.itens.length === 1 && arquivo.itens[0]?.id === q4.id,
  );

  // Arquivo da versão 1, que é o que já está baixado por aí: sem `revisoes`, a
  // reconstrução antiga tem de continuar valendo.
  const antigo: Record<string, unknown> = { ...arquivo };
  delete antigo.revisoes;
  const doAntigo = revisoesDoArquivo(antigo)!;
  checar(
    "arquivo sem o campo novo ainda importa pelo caminho antigo",
    doAntigo[q4.id]?.veredito === antes[q4.id].veredito &&
      doAntigo[q1.id]?.visto !== undefined,
  );
  checar(
    "arquivo com `revisoes` estragado cai na reconstrução antiga",
    revisoesDoArquivo({ ...antigo, revisoes: "lixo" })?.[q4.id]?.veredito ===
      antes[q4.id].veredito,
  );
  checar(
    "entrada estragada no backup não derruba as outras",
    Object.keys(
      revisoesDoArquivo({ revisoes: { ...antes, [q1.id]: { veredito: "X" } } })!,
    ).length === 3,
  );
}

// --- mesclarRevisoes() ------------------------------------------------------
//
// Importar substituía tudo, e era isso que tornava a ida-e-volta entre dois
// computadores capaz de apagar trabalho.
{
  const em = "2026-01-01T00:00:00.000Z";
  const [q1, q2, q3] = BANCO;
  const v = (q: Questao): Revisoes[string] => ({
    veredito: q.resposta_correta ? "V" : "F",
    nota: "",
    em,
  });

  const locais: Revisoes = { [q1.id]: v(q1), [q2.id]: v(q2) };
  const doArquivo: Revisoes = {
    [q2.id]: { ...v(q2), nota: "revisto no outro computador" },
    [q3.id]: v(q3),
  };
  const m = mesclarRevisoes(locais, doArquivo);

  checar("o que só existe aqui sobrevive à importação", !!m.revisoes[q1.id]);
  checar("o que só existe no arquivo entra", !!m.revisoes[q3.id]);
  checar(
    "no que os dois têm, o arquivo manda",
    m.revisoes[q2.id]?.nota === "revisto no outro computador",
  );
  checar(
    "a tela consegue dizer o que mexeu",
    m.novas === 1 && m.atualizadas === 1 && m.mantidas === 1,
    `novas ${m.novas}, atualizadas ${m.atualizadas}, mantidas ${m.mantidas}`,
  );
  checar(
    "mesclar não muda o que estava aqui",
    Object.keys(locais).length === 2 && locais[q2.id]?.nota === "",
  );

  // Reimportar o mesmo arquivo é o gesto mais provável de todos — clicar duas
  // vezes, ou voltar ao computador de onde o arquivo saiu.
  const repetido = mesclarRevisoes(m.revisoes, doArquivo);
  checar(
    "reimportar o mesmo arquivo não relata mudança",
    repetido.novas === 0 && repetido.atualizadas === 0,
  );
  checar(
    "reimportar o mesmo arquivo não muda nada",
    JSON.stringify(repetido.revisoes) === JSON.stringify(m.revisoes),
  );

  const emBranco = mesclarRevisoes({}, doArquivo);
  checar(
    "no computador novo a mesclagem é a restauração inteira",
    Object.keys(emBranco.revisoes).length === 2 &&
      emBranco.novas === 2 &&
      emBranco.mantidas === 0,
  );
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

// --- A triagem que o repositório já registrou -------------------------------
{
  const declarados = achadosDeclarados();
  console.log(`\nAchados com decisão registrada: ${declarados}\n`);

  // A leitura de `lib/triagem.ts` é defensiva porque o arquivo é escrito à mão,
  // mas defensiva não pode virar silenciosa: uma decisão com typo que sumisse da
  // tela faria o achado voltar como pendência sem ninguém entender por quê.
  checar(
    "toda entrada de conferencia_triado.json sobrevive à leitura",
    Object.keys(TRIAGENS).length === declarados,
    `${Object.keys(TRIAGENS).length} lidas de ${declarados} declaradas`,
  );

  const rasos = Object.entries(TRIAGENS).filter(
    ([, t]) => t.motivo.trim().length < 40,
  );
  checar(
    "toda triagem diz o que foi conferido e contra o quê",
    rasos.length === 0,
    rasos.map(([id]) => id).join(", "),
  );

  // Um id que não está no banco nem consta como removido é engano de digitação:
  // a decisão foi escrita para uma questão que nunca existiu, e como a tela só
  // consulta a triagem por id, ninguém seria avisado.
  const noBanco = new Set(BANCO.map((q) => q.id));
  const correcoes = JSON.parse(
    readFileSync(join(RAIZ, "scripts/correcoes.json"), "utf8"),
  ) as Record<string, { acao?: string }>;
  const fantasmas = Object.keys(TRIAGENS).filter(
    (id) => !noBanco.has(id) && correcoes[id]?.acao !== "remover",
  );
  checar(
    "todo id triado está no banco ou consta como removido",
    fantasmas.length === 0,
    fantasmas.join(", "),
  );
}

// --- pendente(), achadosTriados() e darPorVistas() ---------------------------
{
  const em = "2026-08-10T00:00:00.000Z";
  const visto = "2026-08-11T00:00:00.000Z";
  const verdadeira = { resposta_correta: true } as Questao;

  checar(
    "divergência sem visto pende",
    pendente(verdadeira, { veredito: "F", nota: "", em }),
  );
  checar(
    "nota sem visto pende, mesmo conferindo",
    pendente(verdadeira, { veredito: "V", nota: "conferir o anexo", em }),
  );
  checar(
    "visto encerra a divergência",
    !pendente(verdadeira, { veredito: "F", nota: "", em, visto }),
  );
  checar(
    "visto encerra também a nota",
    !pendente(verdadeira, { veredito: "V", nota: "conferir", em, visto }),
  );
  checar(
    "quem confere e não anota nunca pendeu",
    !pendente(verdadeira, { veredito: "V", nota: "", em }),
  );

  const triada = BANCO.find((q) => IDS_TRIADOS.has(q.id));
  const nova = BANCO.find((q) => !IDS_TRIADOS.has(q.id));
  checar(
    "o banco tem questão triada e questão sem triagem para o teste",
    !!triada && !!nova,
  );

  if (triada && nova) {
    const revisoes: Revisoes = {
      [triada.id]: {
        veredito: triada.resposta_correta ? "F" : "V",
        nota: "",
        em,
      },
      [nova.id]: { veredito: nova.resposta_correta ? "F" : "V", nota: "", em },
    };

    // O achado novo é o trabalho que a rodada acabou de produzir. Somi-lo junto
    // com os encerrados apagaria exatamente o que se foi buscar na tela.
    const alvos = achadosTriados(BANCO, revisoes, IDS_TRIADOS);
    checar(
      "dá por vista só a divergência que o repositório já decidiu",
      alvos.length === 1 && alvos[0] === triada.id,
      alvos.join(", "),
    );

    const depois = darPorVistas(revisoes, alvos, visto);
    checar(
      "marcar não mexe no veredito nem na nota",
      depois[triada.id].veredito === revisoes[triada.id].veredito &&
        depois[triada.id].nota === "",
    );
    checar("marcar carimba a data", depois[triada.id].visto === visto);
    checar(
      "marcar não encosta no achado que ninguém triou",
      depois[nova.id].visto === undefined,
    );
    checar(
      "marcar id desconhecido não inventa revisão",
      darPorVistas({}, ["id-que-nao-existe"], visto)["id-que-nao-existe"] ===
        undefined,
    );
    checar(
      "depois de marcar não sobra o que dar por visto",
      achadosTriados(BANCO, depois, IDS_TRIADOS).length === 0,
    );

    const saida = montarExportacao(BANCO, depois, TRECHOS, POR_OCR, em);
    checar(
      "o achado visto sai dos itens",
      !saida.itens.some((i) => i.id === triada.id),
    );
    checar(
      "o achado novo continua nos itens",
      saida.itens.some((i) => i.id === nova.id),
    );
    // Retido por nome, e não só por contagem: é o que deixa quem processa o
    // arquivo conferir contra o triado que nada foi engolido por engano.
    checar(
      "o achado visto sai por nome em vistas",
      saida.vistas.join() === triada.id,
      saida.vistas.join(", "),
    );
    checar("o resumo conta os retidos", saida.resumo.jaVistas === 1);
    checar(
      "o visto não conta mais como divergência",
      saida.resumo.divergencias === 1,
      String(saida.resumo.divergencias),
    );
    checar(
      "o visto continua contando como questão revisada",
      saida.resumo.revisadas === 2 && saida.estado[triada.id] !== undefined,
    );

    // Sem isto, restaurar um backup ressuscitaria todo achado já encerrado — e
    // como eles saem de `itens` justamente por estarem encerrados, não haveria
    // de onde deduzi-los.
    const voltou = revisoesDoArquivo(saida)!;
    checar(
      "importar preserva a marca de visto",
      !!voltou[triada.id]?.visto,
    );
    checar(
      "importar não inventa visto no achado novo",
      voltou[nova.id]?.visto === undefined,
    );
    checar(
      "importar não reabre o que já foi encerrado",
      achadosTriados(BANCO, voltou, IDS_TRIADOS).length === 0,
    );

    storage.clear();
    gravarRevisoes(depois);
    checar(
      "o storage preserva a marca de visto",
      lerRevisoes()[triada.id]?.visto === visto,
    );
  }

  // Revisão gravada antes deste campo existir continua válida; `visto` de tipo
  // errado derruba só a entrada estragada, como o resto da leitura.
  storage.clear();
  storage.setItem(
    "prova-radioamador:conferencia",
    JSON.stringify({
      versao: 1,
      revisoes: {
        antiga: { veredito: "V", nota: "", em },
        estragada: { veredito: "V", nota: "", em, visto: 7 },
      },
    }),
  );
  const lidas = lerRevisoes();
  checar("revisão sem o campo visto continua sendo lida", !!lidas.antiga);
  checar("revisão com visto de tipo errado é descartada", !lidas.estragada);
  storage.clear();
}

// --- aoMarcar() e aoAnotar(): quando um achado encerrado reabre --------------
{
  const em = "2026-08-10T00:00:00.000Z";
  const agora = "2026-08-11T00:00:00.000Z";
  const encerrado: Revisoes = {
    x: { veredito: "F", nota: "conferido contra a p.4", em, visto: agora },
  };

  // O caminho de volta prometido no README e na skill: a triagem gravada decidiu
  // sobre o veredito que estava lá, então mudá-lo faz dela resposta a outra
  // pergunta, e o achado volta a pendente.
  const trocado = aoMarcar(encerrado, "x", "V", agora);
  checar("trocar o veredito reabre o achado", trocado.x.visto === undefined);
  checar("trocar o veredito grava o novo", trocado.x.veredito === "V");
  checar(
    "trocar o veredito preserva a justificativa",
    trocado.x.nota === "conferido contra a p.4",
  );

  const desmarcado = aoMarcar(encerrado, "x", "F", agora);
  checar(
    "desmarcar o mesmo veredito também reabre",
    desmarcado.x.visto === undefined && desmarcado.x.veredito === null,
  );
  checar(
    "desmarcar sem nota apaga a revisão inteira",
    aoMarcar({ x: { veredito: "F", nota: "", em } }, "x", "F", agora).x ===
      undefined,
  );

  const reanotado = aoAnotar(encerrado, "x", "outra frase", agora);
  checar("escrever na justificativa reabre", reanotado.x.visto === undefined);
  checar("escrever preserva o veredito", reanotado.x.veredito === "F");
  checar(
    "anotar em questão nova nasce sem veredito",
    aoAnotar({}, "y", "conferir o anexo", agora).y.veredito === null,
  );
  checar(
    "apagar a nota de quem não decidiu apaga a revisão",
    aoAnotar({ x: { veredito: null, nota: "algo", em } }, "x", "  ", agora).x ===
      undefined,
  );
  checar(
    "apagar a nota de quem decidiu mantém o veredito",
    aoAnotar({ x: { veredito: "V", nota: "algo", em } }, "x", "", agora).x
      ?.veredito === "V",
  );

  // Puras: a tela guarda o resultado num setState, e mutar a entrada faria o
  // React não enxergar a mudança.
  const antes = JSON.stringify(encerrado);
  aoMarcar(encerrado, "x", "V", agora);
  aoAnotar(encerrado, "x", "seja o que for", agora);
  checar("nenhuma das duas muta a entrada", JSON.stringify(encerrado) === antes);
}

console.log(`\n${falhas === 0 ? "TODOS OS TESTES DE CONFERÊNCIA PASSARAM" : falhas + " FALHA(S)"}`);
process.exit(falhas === 0 ? 0 : 1);
