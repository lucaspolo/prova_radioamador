import type { Questao, Resposta } from "./tipos";

/**
 * A folha de respostas de uma bateria: uma entrada por questão, na ordem
 * sorteada, `null` para em branco.
 *
 * O simulado guardava as respostas num array que só crescia, o que amarrava a
 * bateria a um caminho de mão única — a resposta da questão N era o N-ésimo
 * item, então pular ou voltar corrompia a correspondência. Indexar pela
 * posição da questão é o que permite navegar livremente, trocar de ideia e
 * deixar em branco de propósito, como na prova real.
 */
export type Escolhas = (boolean | null)[];

export function folhaVazia(total: number): Escolhas {
  return Array.from({ length: total }, () => null);
}

/**
 * Converte a folha no formato que o resultado e o histórico consomem.
 *
 * Questão em branco vira `respondeu: null, acertou: false`: como na prova real,
 * não responder conta como erro.
 */
export function respostasDe(questoes: Questao[], escolhas: Escolhas): Resposta[] {
  return questoes.map((questao, i) => {
    const escolha = escolhas[i] ?? null;
    return {
      questao,
      respondeu: escolha,
      acertou: escolha === questao.resposta_correta,
    };
  });
}

export function contarRespondidas(escolhas: Escolhas): number {
  return escolhas.filter((e) => e !== null).length;
}

export function contarEmBranco(escolhas: Escolhas): number {
  return escolhas.filter((e) => e === null).length;
}

/**
 * A próxima questão em branco a partir de `de` (exclusive), dando a volta no
 * fim da folha. Devolve `null` quando não sobrou nenhuma — inclusive quando a
 * única em branco é a própria `de`, porque saltar para onde já se está não
 * ajuda ninguém.
 */
export function proximaEmBranco(escolhas: Escolhas, de: number): number | null {
  const total = escolhas.length;
  for (let passo = 1; passo <= total; passo++) {
    const i = (de + passo) % total;
    if (i !== de && escolhas[i] === null) return i;
  }
  return null;
}
