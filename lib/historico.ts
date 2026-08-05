import type { Resposta, Tema } from "./tipos";
import { TEMAS } from "./constantes";

export const CHAVE_STORAGE = "prova-radioamador:historico";

/**
 * Versão do formato salvo. Se um dia o formato mudar, um histórico gravado
 * pela versão antiga é descartado em vez de quebrar a leitura.
 */
export const VERSAO_HISTORICO = 1;

/**
 * Teto de simulados guardados. O localStorage costuma ter ~5 MB por origem, e
 * guardar tudo indefinidamente acabaria estourando esse limite sem que o app
 * percebesse. Os mais antigos saem primeiro.
 */
export const MAX_SIMULADOS = 200;

/** Resultado de uma questão dentro de um simulado salvo. */
export interface ItemSalvo {
  questaoId: string;
  tema: Tema;
  acertou: boolean;
}

/**
 * O que originou um registro: uma matéria, ou a revisão de erros. Registros
 * antigos, de quando existia bateria mista, guardam "todos" aqui; nada lê
 * este campo para decidir coisa alguma — as estatísticas saem do tema de
 * cada item —, então não vale queimar o histórico do usuário para limpar.
 */
export type EscolhaRegistro = Tema | "revisao";

export interface SimuladoSalvo {
  id: string;
  /** ISO 8601, em UTC. */
  data: string;
  escolha: EscolhaRegistro;
  total: number;
  acertos: number;
  itens: ItemSalvo[];
}

export interface Historico {
  versao: number;
  simulados: SimuladoSalvo[];
}

export const HISTORICO_VAZIO: Historico = {
  versao: VERSAO_HISTORICO,
  simulados: [],
};

function novoId(): string {
  // randomUUID exige contexto seguro; em http:// numa rede local ele não existe.
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Converte as respostas de um simulado no registro que vai para o storage. */
export function montarRegistro(
  escolha: EscolhaRegistro,
  respostas: Resposta[],
): SimuladoSalvo {
  return {
    id: novoId(),
    data: new Date().toISOString(),
    escolha,
    total: respostas.length,
    acertos: respostas.filter((r) => r.acertou).length,
    itens: respostas.map((r) => ({
      questaoId: r.questao.id,
      tema: r.questao.tema,
      acertou: r.acertou,
    })),
  };
}

/**
 * Valida um histórico vindo de fora do nosso controle — storage sujo, arquivo
 * importado, versão antiga. Devolve null quando o formato não serve; registros
 * individualmente malformados são descartados em silêncio.
 */
export function validar(dados: unknown): Historico | null {
  if (
    typeof dados !== "object" ||
    dados === null ||
    (dados as Historico).versao !== VERSAO_HISTORICO ||
    !Array.isArray((dados as Historico).simulados)
  ) {
    return null;
  }
  const simulados = (dados as Historico).simulados.filter(
    (s): s is SimuladoSalvo =>
      typeof s?.id === "string" &&
      typeof s?.data === "string" &&
      typeof s?.total === "number" &&
      typeof s?.acertos === "number" &&
      Array.isArray(s?.itens),
  );
  return { versao: VERSAO_HISTORICO, simulados };
}

/**
 * Lê e valida o histórico. Qualquer coisa fora do esperado — JSON corrompido,
 * versão diferente, formato inesperado — devolve um histórico vazio, de modo
 * que um storage sujo nunca derrube a aplicação.
 */
export function ler(): Historico {
  if (typeof window === "undefined") return HISTORICO_VAZIO;
  try {
    const bruto = window.localStorage.getItem(CHAVE_STORAGE);
    if (!bruto) return HISTORICO_VAZIO;
    return validar(JSON.parse(bruto)) ?? HISTORICO_VAZIO;
  } catch {
    return HISTORICO_VAZIO;
  }
}

/**
 * Une dois históricos — o local e um importado de outro aparelho.
 *
 * A união é por id de simulado: importar duas vezes o mesmo arquivo, ou
 * importar um backup que contém o que já está aqui, não duplica nada. Em
 * empate de id, o registro local prevalece.
 */
export function mesclar(base: Historico, outro: Historico): Historico {
  const porId = new Map<string, SimuladoSalvo>();
  for (const s of [...outro.simulados, ...base.simulados]) porId.set(s.id, s);
  const simulados = [...porId.values()]
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, MAX_SIMULADOS);
  return { versao: VERSAO_HISTORICO, simulados };
}

/** Grava o histórico. Devolve false se o storage recusou (cota, modo privado). */
export function gravar(historico: Historico): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(CHAVE_STORAGE, JSON.stringify(historico));
    return true;
  } catch {
    return false;
  }
}

export interface EstatisticaTema {
  tema: Tema;
  respondidas: number;
  acertos: number;
  percentual: number;
}

/** Percentual de acerto acumulado por matéria, sobre todos os simulados. */
export function estatisticasPorTema(historico: Historico): EstatisticaTema[] {
  return TEMAS.map((tema) => {
    let respondidas = 0;
    let acertos = 0;
    for (const simulado of historico.simulados) {
      for (const item of simulado.itens) {
        if (item.tema !== tema) continue;
        respondidas++;
        if (item.acertou) acertos++;
      }
    }
    return {
      tema,
      respondidas,
      acertos,
      percentual: respondidas > 0 ? Math.round((acertos / respondidas) * 100) : 0,
    };
  });
}

export interface Resumo {
  simulados: number;
  respondidas: number;
  acertos: number;
  percentual: number;
}

export function resumo(historico: Historico): Resumo {
  const respondidas = historico.simulados.reduce((s, x) => s + x.total, 0);
  const acertos = historico.simulados.reduce((s, x) => s + x.acertos, 0);
  return {
    simulados: historico.simulados.length,
    respondidas,
    acertos,
    percentual: respondidas > 0 ? Math.round((acertos / respondidas) * 100) : 0,
  };
}
