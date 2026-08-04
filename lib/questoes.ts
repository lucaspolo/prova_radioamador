import bancoBruto from "@/public/banco_questoes.json";
import type { EscolhaTema, Questao, Tema } from "./tipos";
import { TEMAS } from "./constantes";
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

/** Quantas questões existem em cada tema. */
export function contarPorTema(): Record<Tema, number> {
  const contagem = Object.fromEntries(TEMAS.map((t) => [t, 0])) as Record<
    Tema,
    number
  >;
  for (const q of BANCO) contagem[q.tema] += 1;
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
): Questao[] {
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
      BANCO.filter((q) => q.tema === escolha),
      quantidade,
    );
  }

  const base = Math.floor(quantidade / TEMAS.length);
  const sobra = quantidade % TEMAS.length;

  const selecionadas = TEMAS.flatMap((tema, i) =>
    sortear(
      BANCO.filter((q) => q.tema === tema),
      base + (i < sobra ? 1 : 0),
    ),
  );

  // Reembaralha para os temas não virem agrupados na ordem de apresentação.
  return embaralharSimples(selecionadas);
}

/** Quantas questões estão disponíveis para uma escolha de tema. */
export function disponiveis(escolha: EscolhaTema): number {
  if (escolha === "todos") return BANCO.length;
  return BANCO.filter((q) => q.tema === escolha).length;
}
