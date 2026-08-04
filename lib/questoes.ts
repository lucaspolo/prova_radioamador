import bancoBruto from "@/public/banco_questoes.json";
import type { EscolhaTema, Questao, Tema } from "./tipos";
import { TEMAS } from "./constantes";

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

/** Embaralhamento Fisher-Yates: cada permutação com a mesma probabilidade. */
function embaralhar<T>(itens: T[]): T[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/**
 * Sorteia uma bateria.
 *
 * Com "todos", distribui as vagas igualmente entre os três temas — assim uma
 * bateria de 60 reproduz a prova real (20 de cada) em vez de refletir o
 * desequilíbrio do banco, em que Legislação tem bem mais questões que os
 * demais. As sobras da divisão vão para os primeiros temas.
 */
export function sortearSimulado(
  escolha: EscolhaTema,
  quantidade: number,
): Questao[] {
  if (escolha !== "todos") {
    const doTema = BANCO.filter((q) => q.tema === escolha);
    return embaralhar(doTema).slice(0, quantidade);
  }

  const base = Math.floor(quantidade / TEMAS.length);
  const sobra = quantidade % TEMAS.length;

  const selecionadas = TEMAS.flatMap((tema, i) => {
    const vagas = base + (i < sobra ? 1 : 0);
    return embaralhar(BANCO.filter((q) => q.tema === tema)).slice(0, vagas);
  });

  // Reembaralha para os temas não virem agrupados na ordem de apresentação.
  return embaralhar(selecionadas);
}

/** Quantas questões estão disponíveis para uma escolha de tema. */
export function disponiveis(escolha: EscolhaTema): number {
  if (escolha === "todos") return BANCO.length;
  return BANCO.filter((q) => q.tema === escolha).length;
}
