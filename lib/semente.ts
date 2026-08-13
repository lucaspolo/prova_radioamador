/**
 * Aleatoriedade reprodutível — a peça que faz o desafio por link existir sem
 * servidor.
 *
 * `Math.random()` não tem semente em JavaScript, e sem semente não há como dois
 * aparelhos sortearem a mesma bateria a partir de um link. O mulberry32 é um
 * gerador de 32 bits de uma linha só: mesma semente, mesma sequência, em
 * qualquer navegador e em qualquer versão — que é exatamente a garantia de que
 * o radioclube inteiro responde às mesmas questões, na mesma ordem.
 *
 * O que ele não é: fonte de aleatoriedade criptográfica. Aqui isso é
 * irrelevante — o "segredo" da bateria é público por construção, está no link.
 */

/** Gerador determinístico de 32 bits (mulberry32). */
export function mulberry32(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a de 32 bits: semente legível ("PY2-SP") vira número. */
export function hashDeTexto(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * A semente como o app a entende: maiúsculas e sem espaços nas pontas.
 *
 * Quem digita o link à mão não deve receber outra bateria por ter escrito
 * "py2-sp" em vez de "PY2-SP" — o link é para ser passado no ar, e no ar não
 * existe caixa alta.
 */
export function normalizarSemente(semente: string): string {
  return semente.trim().toUpperCase();
}

/** O gerador de uma semente de texto. */
export function randDaSemente(semente: string): () => number {
  return mulberry32(hashDeTexto(normalizarSemente(semente)));
}

// Sem O/0 e sem I/1: a semente é ditada por rádio e anotada no papel.
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Uma semente curta, legível e fácil de ditar. */
export function sementeLegivel(
  rand: () => number = Math.random,
  tamanho = 6,
): string {
  let s = "";
  for (let i = 0; i < tamanho; i++) {
    s += ALFABETO[Math.floor(rand() * ALFABETO.length)];
  }
  return s;
}

/**
 * A impressão digital de uma bateria: hash dos ids na ordem em que caíram.
 *
 * Serve para o grupo perceber que está comparando coisas diferentes. O banco
 * de questões muda entre deploys (questão corrigida, questão nova), e duas
 * pessoas com o mesmo link em versões diferentes do app receberiam baterias
 * diferentes sem nenhum sinal disso. Com o código no resultado, a divergência
 * aparece antes da discussão sobre quem foi melhor.
 */
export function codigoDaBateria(ids: string[]): string {
  return hashDeTexto(ids.join("|")).toString(36).toUpperCase().padStart(7, "0");
}
