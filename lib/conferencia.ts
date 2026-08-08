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
export const VERSAO_CONFERENCIA = 1;

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
}

/** Revisões por `id` de questão. O `id` é hash da afirmação e sobrevive a regerações. */
export type Revisoes = Record<string, Revisao>;

function revisaoValida(x: unknown): x is Revisao {
  if (typeof x !== "object" || x === null) return false;
  const r = x as Record<string, unknown>;
  const veredito =
    r.veredito === null || VEREDITOS.includes(r.veredito as Veredito);
  return veredito && typeof r.nota === "string" && typeof r.em === "string";
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
    porArquivo: Record<string, { total: number; revisadas: number }>;
  };
  itens: ItemExportado[];
  /** Mapa compacto `id -> veredito` de tudo que foi revisado; serve de backup. */
  estado: Record<string, Veredito>;
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
  const estado: Record<string, Veredito> = {};
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

    if (r.veredito !== null) {
      arquivo.revisadas++;
      estado[q.id] = r.veredito;
    } else {
      semVeredito++;
    }

    const diverge = divergente(q, r);
    const nota = r.nota.trim();
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
      porArquivo,
    },
    itens,
    estado,
  };
}

/**
 * Recupera revisões a partir do `estado` de um arquivo exportado.
 *
 * O que volta é menos do que saiu: `estado` guarda o veredito, não a
 * justificativa — quem tinha as notas eram os `itens`, e esses só trazem o que
 * era achado. Por isso as duas fontes se somam aqui, com o item mandando na
 * justificativa quando existir.
 */
export function revisoesDoArquivo(dados: unknown): Revisoes | null {
  if (typeof dados !== "object" || dados === null) return null;
  const d = dados as { estado?: unknown; itens?: unknown; exportadoEm?: unknown };

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

  return revisoes;
}
