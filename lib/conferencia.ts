import type { Questao, Trecho } from "./tipos";
import { localizarPassagem } from "./trechos";

/**
 * A conferência do banco: a ordem de leitura e o que o revisor anota.
 *
 * Duas saídas consomem isto. `scripts/relatorio_conferencia.ts` escreve o
 * Markdown, que serve para ler no GitHub e para diferenciar duas regerações;
 * a tela `/conferencia` serve para revisar de fato, com o PDF ao lado. Ordem
 * diferente entre as duas seria ordem errada numa delas, então a ordenação
 * mora aqui e não em nenhuma das pontas.
 *
 * As funções de ordem são puras de propósito: o que exige ler PDF do disco
 * (quais arquivos vieram por OCR de visão) fica no script, que sabe fazer isso,
 * e chega aqui como parâmetro.
 */

// --- Ordem dos capítulos ----------------------------------------------------

export interface Capitulo {
  arquivo: string;
  questoes: Questao[];
  porOcr: boolean;
  /** Fração das questões que vieram da ementa, e não de um trecho. */
  daEmenta: number;
}

/**
 * Ordena os capítulos por onde vale mais a pena gastar a primeira hora.
 *
 * 1. **Digitalizados primeiro.** São os que só existem para o gerador através
 *    do OCR de visão, cujo modo de falha é errar *normalizando* — devolver
 *    português plausível que se afastou da fonte, sem nada no resultado
 *    denunciando. Os dois erros graves conhecidos saíram daí, e são 91 questões
 *    em 10 páginas: o melhor retorno por minuto de leitura.
 * 2. **Depois, menos questões de ementa primeiro.** Questão de ementa não tem
 *    texto de origem — a conferência dela é contra o que você sabe do assunto,
 *    e não contra a página aberta. Deixar para o fim mantém a leitura no mesmo
 *    modo pelo maior tempo possível, e joga a Cartilha (415 das 647) para
 *    depois dos atos, que são conferíveis linha a linha.
 * 3. O nome, só para a saída não depender da ordem em que os arquivos entraram.
 */
export function ordenarCapitulos(a: Capitulo, b: Capitulo): number {
  return (
    Number(b.porOcr) - Number(a.porOcr) ||
    a.daEmenta - b.daEmenta ||
    a.arquivo.localeCompare(b.arquivo, "pt-BR")
  );
}

/**
 * Ordem das questões dentro de um arquivo: a página, e só.
 *
 * Os desempates existem para a saída ser estável entre execuções — dentro de
 * uma página o `id` é um hash e não significa nada. `documento` antes de
 * `ementa` porque são duas conferências diferentes: a primeira se faz contra o
 * PDF aberto na página, a segunda contra o que você sabe do assunto.
 *
 * Agrupar por trecho foi descartado de propósito. Sob a ordem de página os
 * trechos se interrompem 79 vezes (o passe de tabela espalha questões do mesmo
 * trecho por páginas diferentes), então agrupar por trecho quebraria a leitura
 * linear, que é justamente o motivo do relatório.
 */
export function ordenar(a: Questao, b: Questao): number {
  return (
    a.pagina - b.pagina ||
    a.origem.localeCompare(b.origem) ||
    (a.trecho_id ?? "").localeCompare(b.trecho_id ?? "") ||
    a.id.localeCompare(b.id)
  );
}

/**
 * Agrupa o banco em capítulos, um por PDF, já na ordem de leitura.
 *
 * `porOcrDeVisao` chega pronto porque descobri-lo custa abrir os PDFs: o script
 * mede em disco, a tela lê de `lib/ocr-visao.json`. Os dois passam o mesmo
 * conjunto, e por isso as duas saídas saem na mesma ordem.
 */
export function agruparEmCapitulos(
  questoes: Questao[],
  porOcrDeVisao: ReadonlySet<string>,
): Capitulo[] {
  const capitulos: Capitulo[] = [];
  for (const arquivo of new Set(questoes.map((q) => q.arquivo_origem))) {
    const doArquivo = questoes
      .filter((q) => q.arquivo_origem === arquivo)
      .sort(ordenar);
    capitulos.push({
      arquivo,
      questoes: doArquivo,
      porOcr: porOcrDeVisao.has(arquivo),
      daEmenta:
        doArquivo.filter((q) => q.origem === "ementa").length /
        doArquivo.length,
    });
  }
  return capitulos.sort(ordenarCapitulos);
}

// --- O que o revisor anota --------------------------------------------------

export const CHAVE_CONFERENCIA = "prova-radioamador:conferencia";

/**
 * Versão do formato. A 2 acrescentou `revisoes` à exportação — ver `Exportacao`.
 *
 * Subir o número não pede migração de nada: `lerRevisoes()` nunca leu este campo
 * (o envelope no storage só existe para o dia em que a forma mudar de verdade), e
 * `revisoesDoArquivo()` decide pelo que o arquivo tem, e não pelo que ele diz ter.
 * O número serve para quem lê o JSON de fora saber qual formato esperar.
 */
export const VERSAO_CONFERENCIA = 2;

/**
 * O veredito do revisor sobre uma questão.
 *
 * `V` e `F` são a resposta dele, dada por conta própria: divergir do gabarito é
 * o sinal que a conferência existe para produzir. `P` é o que não é nem um nem
 * outro — enunciado ambíguo, transcrição de OCR corrompida, questão que não tem
 * resposta possível. Sem o terceiro estado, esses casos só teriam como sair
 * disfarçados de divergência, e o agente do outro lado não saberia distinguir
 * "o gabarito está invertido" de "esta pergunta não deveria existir".
 */
export type Veredito = "V" | "F" | "P";

const VEREDITOS: readonly Veredito[] = ["V", "F", "P"];

export interface Revisao {
  /**
   * `null` quando há nota mas ainda não há decisão.
   *
   * Quem escreve "conferir a tabela do anexo" e passa adiante registrou algo que
   * não pode sumir por falta de clique — mas também não decidiu nada, e contar
   * essa questão como revisada inflaria o progresso com trabalho que não foi
   * feito. Os dois estados existem porque são dois estados.
   */
  veredito: Veredito | null;
  nota: string;
  /** ISO da marcação; diz o que foi revisado antes de qual regeração do banco. */
  em: string;
  /**
   * ISO de quando a triagem deste achado foi dada por lida — ausente enquanto
   * não foi.
   *
   * O veredito sobrevive no navegador de uma rodada para a outra, então um
   * achado já decidido em `scripts/conferencia_triado.json` continuaria pesando
   * no contador e voltando em toda exportação. Este campo encerra o assunto sem
   * mexer no veredito: o que o revisor concluiu continua escrito e visível na
   * tela, e o histórico de por que aquilo foi resolvido está no repositório, com
   * muito mais detalhe do que caberia aqui.
   */
  visto?: string;
}

/** Revisões por `id` de questão. O `id` é hash da afirmação e sobrevive a regerações. */
export type Revisoes = Record<string, Revisao>;

function revisaoValida(x: unknown): x is Revisao {
  if (typeof x !== "object" || x === null) return false;
  const r = x as Record<string, unknown>;
  const veredito =
    r.veredito === null || VEREDITOS.includes(r.veredito as Veredito);
  const visto = r.visto === undefined || typeof r.visto === "string";
  return (
    veredito &&
    visto &&
    typeof r.nota === "string" &&
    typeof r.em === "string"
  );
}

/**
 * Lê as revisões gravadas no navegador.
 *
 * Defensivo como `lerSuspeitas()`, e pelo mesmo motivo: o storage é editável
 * pelo usuário e sobrevive a versões do app. Aqui o cuidado pesa mais, porque
 * uma revisão é trabalho de horas — descartar o arquivo inteiro por causa de uma
 * entrada estragada seria pior que ignorar a entrada. Por isso a validação é
 * item a item, e o que não passa some sozinho.
 */
export function lerRevisoes(): Revisoes {
  if (typeof window === "undefined") return {};
  try {
    const bruto = window.localStorage.getItem(CHAVE_CONFERENCIA);
    if (!bruto) return {};
    const dados = JSON.parse(bruto) as unknown;
    if (typeof dados !== "object" || dados === null || Array.isArray(dados)) {
      return {};
    }
    const envelope = dados as { revisoes?: unknown };
    const cru = envelope.revisoes;
    if (typeof cru !== "object" || cru === null || Array.isArray(cru)) return {};

    const limpo: Revisoes = {};
    for (const [id, r] of Object.entries(cru)) {
      if (revisaoValida(r)) limpo[id] = r;
    }
    return limpo;
  } catch {
    return {};
  }
}

/** Grava as revisões. Devolve false se o storage recusou (cota, modo privado). */
export function gravarRevisoes(revisoes: Revisoes): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(
      CHAVE_CONFERENCIA,
      JSON.stringify({ versao: VERSAO_CONFERENCIA, revisoes }),
    );
    return true;
  } catch {
    return false;
  }
}

// --- Exportação -------------------------------------------------------------

/**
 * A revisão discorda do banco.
 *
 * `P` sempre conta: quem marcou "problema" está dizendo que a questão não se
 * resolve com V ou F, o que é uma objeção mesmo sem apontar um gabarito
 * alternativo. Sem veredito não há discordância — há uma anotação, que sai na
 * exportação por outro caminho.
 */
export function divergente(q: Questao, r: Revisao): boolean {
  if (r.veredito === null) return false;
  if (r.veredito === "P") return true;
  return (r.veredito === "V") !== q.resposta_correta;
}

/**
 * A revisão ainda pede trabalho de alguém.
 *
 * Divergência e nota são as duas formas de um achado existir. `visto` derruba as
 * duas de uma vez, porque quem deu a triagem por lida está dizendo que aquele
 * achado já teve seu destino escrito no repositório — não que ele nunca existiu.
 */
export function pendente(q: Questao, r: Revisao): boolean {
  if (r.visto) return false;
  return divergente(q, r) || r.nota.trim() !== "";
}

/**
 * Achados que o repositório já decidiu e que ainda aparecem como pendência.
 *
 * É o que o botão "dar por vistas" mexe, calculado antes de mexer para que a
 * tela possa dizer quantos são e o usuário decidir. Um id só entra se as três
 * coisas valerem ao mesmo tempo: há uma questão viva com esse id, há um achado
 * a limpar (divergência ou nota), e `scripts/conferencia_triado.json` já
 * registrou a decisão. Achado novo, que ninguém triou ainda, fica de fora — é
 * exatamente o trabalho que a rodada seguinte existe para produzir, e some-lo
 * junto seria apagar o que a tela acabou de descobrir.
 */
export function achadosTriados(
  questoes: Questao[],
  revisoes: Revisoes,
  triados: ReadonlySet<string>,
): string[] {
  const ids: string[] = [];
  for (const q of questoes) {
    const r = revisoes[q.id];
    if (!r || !triados.has(q.id)) continue;
    if (pendente(q, r)) ids.push(q.id);
  }
  return ids;
}

// --- O que cada gesto do revisor faz ----------------------------------------
//
// Puras e fora do hook de propósito. São as regras de quando um achado nasce,
// morre e reabre — o hook cuida de storage, debounce e do ciclo do React, que
// são outro assunto e não deveriam esconder estas decisões dentro de um
// `setState`.

/** Marca os achados como lidos, sem tocar em veredito nem em nota. */
export function darPorVistas(
  revisoes: Revisoes,
  ids: readonly string[],
  em: string,
): Revisoes {
  const novas = { ...revisoes };
  for (const id of ids) {
    const atual = novas[id];
    if (atual) novas[id] = { ...atual, visto: em };
  }
  return novas;
}

/**
 * Um clique de veredito.
 *
 * Clicar de novo no mesmo veredito desmarca — é como se desfaz um engano de
 * teclado sem ter de escolher outra resposta que também não é a sua. Desmarcar
 * tira a decisão, não o que foi escrito: a justificativa costuma ser o motivo da
 * hesitação, e apagá-la junto faria o clique de desfazer custar a frase que
 * explicava a dúvida.
 *
 * Nos dois caminhos a revisão é remontada sem `visto`, e é isso que dá o caminho
 * de volta: a triagem gravada no repositório decidiu sobre o veredito que estava
 * lá, então mudá-lo faz daquela decisão a resposta a outra pergunta. O achado
 * volta a pendente e é retriado na rodada seguinte.
 */
export function aoMarcar(
  revisoes: Revisoes,
  id: string,
  veredito: Veredito,
  em: string,
): Revisoes {
  const atual = revisoes[id];
  const novas = { ...revisoes };
  if (atual?.veredito === veredito) {
    if (atual.nota.trim()) {
      novas[id] = { veredito: null, nota: atual.nota, em: atual.em };
    } else {
      delete novas[id];
    }
  } else {
    novas[id] = { veredito, nota: atual?.nota ?? "", em };
  }
  return novas;
}

/**
 * Uma justificativa escrita.
 *
 * A nota pode existir sem veredito, e nesse caso o veredito fica `null` em vez
 * de virar "problema": quem escreve "conferir contra o anexo" antes de decidir
 * registrou algo que não pode sumir, mas não decidiu nada — chutar "P" por ele
 * inflaria a contagem de problemas com trabalho não feito. Apagar a nota de uma
 * revisão que não tinha veredito não deixa revisão nenhuma.
 *
 * Também limpa `visto`, pelo mesmo motivo de `aoMarcar`: frase nova é assunto
 * novo, e a decisão registrada era sobre a frase velha.
 */
export function aoAnotar(
  revisoes: Revisoes,
  id: string,
  nota: string,
  em: string,
): Revisoes {
  const atual = revisoes[id];
  const novas = { ...revisoes };
  if (!atual?.veredito && !nota.trim()) {
    delete novas[id];
  } else {
    novas[id] = { veredito: atual?.veredito ?? null, nota, em: atual?.em ?? em };
  }
  return novas;
}

export interface ItemExportado {
  id: string;
  afirmacao: string;
  explicacao_curta: string;
  gabarito: boolean;
  veredito: Veredito | null;
  divergencia: boolean;
  justificativa: string;
  revisadoEm: string;
  arquivo_origem: string;
  pagina: number;
  tema: string;
  origem: string;
  /** Se a citação abaixo é transcrição do modelo, e não bytes do PDF. */
  por_ocr_de_visao: boolean;
  trecho_id?: string;
  /** A passagem do trecho mais parecida com a afirmação, quando localizada. */
  passagem?: string;
}

export interface Exportacao {
  app: "prova-radioamador";
  versao: number;
  exportadoEm: string;
  resumo: {
    total: number;
    revisadas: number;
    divergencias: number;
    problemas: number;
    comNota: number;
    /** Notas escritas em questões que ainda não têm veredito. */
    semVeredito: number;
    /** Achados retidos por já terem decisão no repositório. Ver `vistas`. */
    jaVistas: number;
    porArquivo: Record<string, { total: number; revisadas: number }>;
  };
  itens: ItemExportado[];
  /**
   * Ids retidos de `itens` por terem sido dados por vistos.
   *
   * Saem por nome, e não só por contagem, por duas razões: quem processa o
   * arquivo consegue conferir contra `scripts/conferencia_triado.json` que
   * nenhum achado foi engolido por engano, e a importação consegue restaurar as
   * marcas — sem isso, recuperar um backup ressuscitaria todos os achados já
   * encerrados.
   */
  vistas: string[];
  /**
   * Mapa compacto `id -> veredito` de tudo que foi revisado.
   *
   * É a lente do relatório: quem processa o arquivo cruza isto com os achados já
   * triados sem carregar nota nem data. Como backup ele não basta — um veredito
   * não é uma revisão —, e esse trabalho passou para `revisoes`.
   */
  estado: Record<string, Veredito>;
  /**
   * As revisões como estão no navegador, para continuar em outra máquina.
   *
   * O resto do arquivo é relatório: existe para virar conserto em
   * `scripts/correcoes.json`, e por isso guarda só o que precisa de ação. Levar a
   * revisão para outro computador é o problema oposto — o que não vira achado
   * ainda é trabalho, e perdê-lo é refazer horas de leitura.
   *
   * Reconstruir a revisão a partir do relatório foi o que se tentou antes, e a
   * conta não fecha: a nota de um achado dado por visto não sai em `itens` (ele é
   * retido de propósito), e uma nota sem veredito não tem onde caber em `estado`.
   * As duas sumiam calado. Este campo é o storage tal e qual — sem projeção, não
   * há o que reconstruir e não há o que perder.
   *
   * Custa ~95 bytes por questão revisada — com o banco inteiro revisado o arquivo
   * sai de 25 KB para 114 KB — e duplica `estado`, o que é barato ao lado de
   * reler 900 questões. Os dois campos ficam porque são dois leitores: o agente
   * que tria quer o resumo, e a skill manda lê-lo por script justamente para o
   * tamanho não importar; a outra máquina quer o original.
   */
  revisoes: Revisoes;
}

/**
 * Monta o arquivo que sai no "Baixar revisão".
 *
 * O detalhe vai só do que precisa de ação — divergência, "problema", ou
 * justificativa escrita mesmo com o veredito conferindo ("o gabarito está certo
 * mas o enunciado é ambíguo" é achado que vale). As 400 questões que passaram
 * limpo não têm o que dizer, e enfiá-las no arquivo só afogaria as sete que têm.
 *
 * Cada item sai autocontido, com afirmação, gabarito e a passagem de origem já
 * localizada: quem receber o arquivo escreve a entrada de `scripts/correcoes.json`
 * sem abrir mais nada. O que o resumo perde em detalhe, ele devolve em cobertura
 * — `porArquivo` diz onde a revisão parou.
 *
 * `estado` é o único campo que fala de tudo, e existe para o arquivo ser backup:
 * são ~20 bytes por questão, e sem ele limpar o storage no meio da revisão
 * perderia horas sem volta.
 */
export function montarExportacao(
  questoes: Questao[],
  revisoes: Revisoes,
  trechos: Record<string, Trecho>,
  porOcrDeVisao: ReadonlySet<string>,
  exportadoEm: string,
): Exportacao {
  const porArquivo: Record<string, { total: number; revisadas: number }> = {};
  const itens: ItemExportado[] = [];
  const vistas: string[] = [];
  const estado: Record<string, Veredito> = {};
  const backup: Revisoes = {};
  let divergencias = 0;
  let problemas = 0;
  let comNota = 0;
  let semVeredito = 0;

  for (const q of questoes) {
    const arquivo = (porArquivo[q.arquivo_origem] ??= {
      total: 0,
      revisadas: 0,
    });
    arquivo.total++;

    const r = revisoes[q.id];
    if (!r) continue;

    // Antes de qualquer filtro: o backup é do que existe, e não do que interessa
    // ao relatório. Todo `continue` daqui para baixo tira a questão do relatório,
    // e é exatamente aí que a revisão se perdia.
    backup[q.id] = r;

    if (r.veredito !== null) {
      arquivo.revisadas++;
      estado[q.id] = r.veredito;
    } else {
      semVeredito++;
    }

    const diverge = divergente(q, r);
    const nota = r.nota.trim();

    // Achado já triado e dado por visto sai da contagem inteira, e não só da
    // lista: um resumo que continuasse dizendo "9 divergências" para nove
    // assuntos encerrados mediria o histórico, não o que falta fazer.
    if (r.visto && (diverge || nota)) {
      vistas.push(q.id);
      continue;
    }

    if (diverge) divergencias++;
    if (r.veredito === "P") problemas++;
    if (nota) comNota++;

    // Sem divergência e sem nota não há achado: a questão passou.
    if (!diverge && !nota) continue;

    const trecho = q.trecho_id ? trechos[q.trecho_id] : undefined;
    const passagem = trecho
      ? localizarPassagem(trecho.texto, q.afirmacao)
      : null;

    itens.push({
      id: q.id,
      afirmacao: q.afirmacao,
      explicacao_curta: q.explicacao_curta,
      gabarito: q.resposta_correta,
      veredito: r.veredito,
      divergencia: diverge,
      justificativa: nota,
      revisadoEm: r.em,
      arquivo_origem: q.arquivo_origem,
      pagina: q.pagina,
      tema: q.tema,
      origem: q.origem,
      por_ocr_de_visao: porOcrDeVisao.has(q.arquivo_origem),
      ...(q.trecho_id ? { trecho_id: q.trecho_id } : {}),
      ...(trecho && passagem
        ? { passagem: trecho.texto.slice(passagem.inicio, passagem.fim) }
        : {}),
    });
  }

  return {
    app: "prova-radioamador",
    versao: VERSAO_CONFERENCIA,
    exportadoEm,
    resumo: {
      total: questoes.length,
      revisadas: Object.keys(estado).length,
      divergencias,
      problemas,
      comNota,
      semVeredito,
      jaVistas: vistas.length,
      porArquivo,
    },
    itens,
    vistas,
    estado,
    revisoes: backup,
  };
}

/**
 * Recupera as revisões de um arquivo exportado.
 *
 * Dois caminhos, porque há dois formatos no mundo. A partir da versão 2 o
 * arquivo traz `revisoes`, que é o storage tal e qual: nada a deduzir, nada a
 * perder, e é ele que manda quando existe.
 *
 * Abaixo dele fica a reconstrução dos arquivos antigos, que continua valendo
 * para qualquer JSON já baixado — e continua sendo aproximada. `estado` guarda o
 * veredito, não a justificativa; quem tinha as notas eram os `itens`, e esses só
 * trazem o que era achado. As duas fontes se somam, com o item mandando na
 * justificativa. O que ela não alcança é o que motivou a versão 2: a nota de um
 * achado retido em `vistas`, e a revisão que era só nota, sem veredito, e também
 * foi dada por vista — essa não deixa rastro em nenhum dos dois campos.
 *
 * A validação é item a item, e não do arquivo inteiro, pela mesma razão de
 * `lerRevisoes()`: o arquivo é editável, e descartar horas de revisão por causa
 * de uma entrada estragada seria pior do que ignorar a entrada.
 */
export function revisoesDoArquivo(dados: unknown): Revisoes | null {
  if (typeof dados !== "object" || dados === null) return null;
  const d = dados as {
    estado?: unknown;
    itens?: unknown;
    vistas?: unknown;
    exportadoEm?: unknown;
    revisoes?: unknown;
  };

  const backup = d.revisoes;
  if (typeof backup === "object" && backup !== null && !Array.isArray(backup)) {
    const limpo: Revisoes = {};
    for (const [id, r] of Object.entries(backup)) {
      if (revisaoValida(r)) limpo[id] = r;
    }
    return limpo;
  }

  const estado = d.estado;
  if (typeof estado !== "object" || estado === null || Array.isArray(estado)) {
    return null;
  }

  const em = typeof d.exportadoEm === "string" ? d.exportadoEm : "";
  const revisoes: Revisoes = {};
  for (const [id, v] of Object.entries(estado)) {
    if (VEREDITOS.includes(v as Veredito)) {
      revisoes[id] = { veredito: v as Veredito, nota: "", em };
    }
  }

  if (Array.isArray(d.itens)) {
    for (const item of d.itens as ItemExportado[]) {
      if (!item || typeof item.id !== "string") continue;
      if (typeof item.justificativa !== "string") continue;
      // A nota escrita antes de decidir não está em `estado` — ela não tem
      // veredito para guardar lá. Se só atualizássemos o que já veio de
      // `estado`, cada importação apagaria exatamente as anotações em aberto,
      // que são as que ainda pedem trabalho.
      const atual = (revisoes[item.id] ??= { veredito: null, nota: "", em });
      atual.nota = item.justificativa;
      if (typeof item.revisadoEm === "string") atual.em = item.revisadoEm;
    }
  }

  // As marcas de "já visto" voltam por último e por nome. Sem isto, restaurar um
  // backup ressuscitaria todos os achados encerrados de uma vez — e como eles
  // saem de `itens` justamente por estarem encerrados, não haveria de onde
  // deduzi-los.
  if (Array.isArray(d.vistas)) {
    for (const id of d.vistas as unknown[]) {
      // Só marca o que já veio de `estado`: um id visto cuja revisão era só uma
      // nota sem veredito não tem como voltar (a nota saiu com o item retido), e
      // criar a revisão aqui deixaria para trás um registro vazio, sem veredito
      // e sem nota, que a tela não teria como mostrar nem o revisor como desfazer.
      const atual = typeof id === "string" ? revisoes[id] : undefined;
      if (atual) atual.visto = em;
    }
  }

  return revisoes;
}
