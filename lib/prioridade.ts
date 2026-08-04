import type { Historico } from "./historico";

/** O que já se sabe sobre o desempenho do usuário numa questão. */
export interface Desempenho {
  vistas: number;
  erros: number;
  /** Se a última resposta dada àquela questão foi errada. */
  errouNaUltima: boolean;
  /** Quantos simulados atrás ela apareceu pela última vez (0 = o mais recente). */
  simuladosAtras: number;
}

/**
 * Percorre o histórico uma vez e resume o desempenho por questão.
 *
 * `historico.simulados` vem do mais recente para o mais antigo, então o índice
 * do simulado já é a distância em simulados.
 */
export function desempenhoPorQuestao(
  historico: Historico,
): Map<string, Desempenho> {
  const mapa = new Map<string, Desempenho>();

  historico.simulados.forEach((simulado, indice) => {
    for (const item of simulado.itens) {
      const atual = mapa.get(item.questaoId);
      if (!atual) {
        // Primeira vez que encontramos a questão = aparição mais recente.
        mapa.set(item.questaoId, {
          vistas: 1,
          erros: item.acertou ? 0 : 1,
          errouNaUltima: !item.acertou,
          simuladosAtras: indice,
        });
      } else {
        atual.vistas += 1;
        if (!item.acertou) atual.erros += 1;
      }
    }
  });

  return mapa;
}

/**
 * Peso de uma questão no sorteio. Quanto maior, mais provável ser escolhida.
 *
 * A intenção é combater a memorização por reconhecimento: o banco tem cerca de
 * 150 questões no tema mais magro, o que dá poucos simulados de 20 antes de
 * tudo se repetir. Sorteando de forma uniforme, em pouco tempo o usuário passa
 * a acertar por lembrar do enunciado, e não por dominar o assunto.
 *
 * A escala é deliberadamente suave. Pesos muito agressivos criariam um circuito
 * fechado com as mesmas poucas questões erradas, e o resto do banco nunca mais
 * apareceria.
 */
export function peso(desempenho: Desempenho | undefined): number {
  // Nunca respondida: prioridade alta, mas não absoluta — o objetivo é cobrir
  // o banco inteiro sem transformar cada bateria só em conteúdo inédito.
  if (!desempenho) return 4;

  const { vistas, erros, errouNaUltima, simuladosAtras } = desempenho;

  let p: number;
  if (errouNaUltima) {
    // Erro é uma lacuna conhecida; questão inédita é uma incógnita. A lacuna
    // conhecida vem primeiro — daí o dobro do peso de uma questão nunca vista.
    p = 8;
  } else {
    // Acertou por último. Quanto mais acertos consecutivos, menos necessária.
    const taxaErro = erros / vistas;
    p = 1 + taxaErro * 3; // 1 (sempre acertou) .. 4 (erra com frequência)
    if (vistas >= 3 && erros === 0) p = 0.5; // dominada: quase sai do sorteio
  }

  // Evita repetir na bateria seguinte o que acabou de ser visto: mesmo uma
  // questão errada precisa de algum intervalo para o estudo render.
  if (simuladosAtras === 0) p *= 0.35;
  else if (simuladosAtras === 1) p *= 0.7;

  return p;
}

/**
 * Sorteio ponderado sem reposição (algoritmo de Efraimidis–Spirakis).
 *
 * Cada item recebe a chave `random^(1/peso)` e ficam os `quantidade` maiores.
 * Isso produz exatamente uma amostra ponderada sem repetição, num único passe
 * e sem sortear de novo em caso de colisão.
 */
export function amostrarPonderado<T>(
  itens: T[],
  pesos: (item: T) => number,
  quantidade: number,
): T[] {
  if (quantidade >= itens.length) return embaralharSimples(itens);

  return itens
    .map((item) => {
      const p = Math.max(pesos(item), 1e-6); // peso zero nunca sairia
      return { item, chave: Math.random() ** (1 / p) };
    })
    .sort((a, b) => b.chave - a.chave)
    .slice(0, quantidade)
    .map((x) => x.item);
}

/** Fisher-Yates, usado quando não há o que ponderar. */
export function embaralharSimples<T>(itens: T[]): T[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}
