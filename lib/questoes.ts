import bancoBruto from "@/public/banco_questoes.json";
import type { Classe, EscolhaTema, Questao, Tema } from "./tipos";
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
 * Sorteia uma bateria.
 *
 * Com "todos", distribui as vagas igualmente entre os três temas — assim uma
 * bateria de 60 reproduz a prova real (20 de cada) em vez de refletir o
 * desequilíbrio do banco, em que Legislação tem bem mais questões que os
 * demais. As sobras da divisão vão para os primeiros temas.
 *
 * Quando há histórico, o sorteio é ponderado: o que foi errado volta mais
 * cedo e o que já foi dominado rareia. Sem histórico, cai num embaralhamento
 * uniforme — o comportamento de antes.
 */
export function sortearSimulado(
  escolha: EscolhaTema,
  quantidade: number,
  historico?: Historico,
  classe: Classe = CLASSE_PADRAO,
): Questao[] {
  const elegiveis = acervo(classe);
  const desempenho = historico
    ? desempenhoPorQuestao(historico)
    : new Map<string, Desempenho>();
  const pesoDe = (q: Questao) => peso(desempenho.get(q.id));

  const sortear = (candidatas: Questao[], vagas: number) =>
    desempenho.size === 0
      ? embaralharSimples(candidatas).slice(0, vagas)
      : amostrarPonderado(candidatas, pesoDe, vagas);

  if (escolha !== "todos") {
    return sortear(
      elegiveis.filter((q) => q.tema === escolha),
      quantidade,
    );
  }

  const base = Math.floor(quantidade / TEMAS.length);
  const sobra = quantidade % TEMAS.length;

  const selecionadas = TEMAS.flatMap((tema, i) =>
    sortear(
      elegiveis.filter((q) => q.tema === tema),
      base + (i < sobra ? 1 : 0),
    ),
  );

  // Reembaralha para os temas não virem agrupados na ordem de apresentação.
  return embaralharSimples(selecionadas);
}

/** Quantas questões estão disponíveis para uma escolha de tema, na classe. */
export function disponiveis(
  escolha: EscolhaTema,
  classe: Classe = CLASSE_PADRAO,
): number {
  const elegiveis = acervo(classe);
  if (escolha === "todos") return elegiveis.length;
  return elegiveis.filter((q) => q.tema === escolha).length;
}
