import bancoBruto from "@/public/banco_questoes.json";
import type { Classe, Questao, Tema } from "./tipos";
import { CLASSE_PADRAO, FORMATO, TEMAS } from "./constantes";
import type { Historico } from "./historico";
import {
  amostrarPonderado,
  desempenhoPorQuestao,
  embaralharSimples,
  peso,
  type Desempenho,
} from "./prioridade";

/**
 * O JSON é importado estaticamente: vira parte do bundle, sem fetch e sem
 * backend. O cast é seguro porque o script de geração valida o schema e o
 * enum de tema antes de escrever o arquivo.
 */
export const BANCO = bancoBruto as Questao[];

/**
 * O acervo elegível para uma classe.
 *
 * Questões de nível "A" cobrem o acréscimo exclusivo da Classe A (análise de
 * circuitos CA, eletrônica de RF, antenas técnicas). Deixá-las entrar num
 * simulado de B ou C cobraria um conteúdo que a norma não exige dessas classes.
 */
export function acervo(classe: Classe = CLASSE_PADRAO): Questao[] {
  const niveis = FORMATO[classe].niveis;
  return BANCO.filter((q) => niveis.includes(q.nivel));
}

/** Quantas questões existem em cada tema, para a classe escolhida. */
export function contarPorTema(classe: Classe = CLASSE_PADRAO): Record<Tema, number> {
  const contagem = Object.fromEntries(TEMAS.map((t) => [t, 0])) as Record<
    Tema,
    number
  >;
  for (const q of acervo(classe)) contagem[q.tema] += 1;
  return contagem;
}

/**
 * Sorteia uma bateria de uma matéria.
 *
 * Só existe bateria de uma matéria porque a prova real é assim: três exames
 * separados, cada um com seu tempo e seu mínimo de acertos. Uma bateria mista
 * não corresponde a prova nenhuma — e o veredito dela mentia, aprovando quem
 * compensasse uma matéria fraca com duas fortes, o que a Anatel não permite.
 *
 * Quando há histórico, o sorteio é ponderado: o que foi errado volta mais
 * cedo e o que já foi dominado rareia. Sem histórico, cai num embaralhamento
 * uniforme.
 */
export function sortearSimulado(
  tema: Tema,
  quantidade: number,
  historico?: Historico,
  classe: Classe = CLASSE_PADRAO,
  opcoes?: { soIneditas?: boolean },
): Questao[] {
  const candidatas = acervo(classe).filter((q) => q.tema === tema);
  const desempenho = historico
    ? desempenhoPorQuestao(historico)
    : new Map<string, Desempenho>();

  // O peso próprio da questão vale mesmo sem histórico. Aplicá-lo só no ramo
  // ponderado deixaria a primeira bateria de quem acabou de instalar o app —
  // justamente a que forma a impressão do simulado — cheia do molde repetitivo
  // que o campo existe para diluir.
  if (desempenho.size === 0) {
    return amostrarPonderado(candidatas, pesoProprio, quantidade);
  }

  // "Só inéditas": primeiro o que nunca foi visto; faltando para a quantidade
  // pedida, completa com o sorteio ponderado normal sobre as já vistas — uma
  // bateria curta puniria justamente quem está terminando de cobrir o banco.
  // O embaralhamento final desfaz o bloco de inéditas na frente.
  if (opcoes?.soIneditas) {
    const ineditas = candidatas.filter((q) => !desempenho.has(q.id));
    const daFrente = amostrarPonderado(ineditas, pesoProprio, quantidade);
    if (daFrente.length >= quantidade) return daFrente;
    const vistas = candidatas.filter((q) => desempenho.has(q.id));
    const complemento = amostrarPonderado(
      vistas,
      (q) => pesoProprio(q) * peso(desempenho.get(q.id)),
      quantidade - daFrente.length,
    );
    return embaralharSimples([...daFrente, ...complemento]);
  }

  return amostrarPonderado(
    candidatas,
    (q) => pesoProprio(q) * peso(desempenho.get(q.id)),
    quantidade,
  );
}

/** O peso fixo da questão; 1 quando ela não declara nenhum. */
function pesoProprio(q: Questao): number {
  return q.peso ?? 1;
}

/**
 * As questões com erro em aberto: a última resposta dada foi errada.
 *
 * É a matéria-prima do modo "revisar erros". Acertar uma delas na revisão a
 * tira da lista (a revisão também entra no histórico); questões nunca vistas
 * ou acertadas por último ficam de fora. Mistura os três temas de propósito —
 * revisão é estudo, não prova, e não recebe veredito de aprovação.
 */
export function questoesParaRevisao(
  historico: Historico,
  classe: Classe = CLASSE_PADRAO,
): Questao[] {
  const desempenho = desempenhoPorQuestao(historico);
  const abertas = acervo(classe).filter(
    (q) => desempenho.get(q.id)?.errouNaUltima,
  );
  return embaralharSimples(abertas);
}

/** Quantas questões estão disponíveis numa matéria, para a classe. */
export function disponiveis(
  tema: Tema,
  classe: Classe = CLASSE_PADRAO,
): number {
  return acervo(classe).filter((q) => q.tema === tema).length;
}

/**
 * As questões do acervo da classe que o histórico nunca viu, opcionalmente de
 * um tema só.
 *
 * Nada no sorteio ponderado garante cobertura: ele visita >90% de um tema em
 * 40 baterias, mas o resíduo pode ficar de fora indefinidamente — e as
 * questões de peso reduzido são as candidatas naturais. Esta lista transforma
 * "será que já vi tudo?" em número e em bateria dirigida.
 */
export function questoesIneditas(
  historico: Historico,
  classe: Classe = CLASSE_PADRAO,
  tema?: Tema,
): Questao[] {
  const desempenho = desempenhoPorQuestao(historico);
  return acervo(classe).filter(
    (q) => !desempenho.has(q.id) && (tema === undefined || q.tema === tema),
  );
}

/** Quantas questões do acervo da classe o histórico já viu, e o total. */
export function cobertura(
  historico: Historico,
  classe: Classe = CLASSE_PADRAO,
): { vistas: number; total: number } {
  const desempenho = desempenhoPorQuestao(historico);
  const doAcervo = acervo(classe);
  return {
    vistas: doAcervo.filter((q) => desempenho.has(q.id)).length,
    total: doAcervo.length,
  };
}
