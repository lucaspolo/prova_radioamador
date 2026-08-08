/**
 * Grifa, dentro do PDF renderizado, a passagem que gerou a questão.
 *
 * O `localizarPassagem()` de `lib/trechos.ts` já acha a passagem no texto
 * extraído; o que falta é reencontrá-la na camada de texto que o pdf.js desenha
 * por cima da página. Isso é mais fácil do que parece, porque as duas pontas
 * vêm do mesmo lugar: `public/trechos.json` foi extraído desse mesmo PDF pelo
 * pdfplumber, então uma linha da camada de texto costuma ser literalmente uma
 * substring do trecho. A regra abaixo aposta nisso e não tenta mais que isso.
 *
 * Onde não funciona, e de propósito: os dois PDFs digitalizados não têm camada
 * de texto nenhuma — o `customTextRenderer` nem chega a ser chamado, e a tela
 * diz o motivo em vez de deixar parecer que o destaque falhou.
 */

/**
 * Mesma base do `normalizar()` de `lib/trechos.ts`, mais o colapso de espaços.
 *
 * O espaço extra é o que separa os dois extratores: o pdfplumber junta a linha
 * pelas posições dos caracteres e o pdf.js entrega os fragmentos como o PDF os
 * guardou, então a mesma frase sai com espaçamento diferente nos dois. Sem
 * colapsar, quase nada casaria.
 */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Abaixo disto o casamento é ruído: "de", "art.", "50," aparecem na página
 * inteira, e grifar cada ocorrência pintaria a página de amarelo, o que é o
 * mesmo que não grifar nada. É o espírito do MIN_COBERTURA de `lib/trechos.ts`.
 */
const MIN_CARACTERES = 8;

/** O que o pdf.js entrega por fragmento da camada de texto. */
export interface ItemDeTexto {
  str: string;
}

/**
 * Escapa o que viraria markup.
 *
 * O retorno do `customTextRenderer` é inserido como HTML. Sem isto, um `<` no
 * texto do PDF abriria uma tag e sumiria da tela — e num relatório que existe
 * para conferir o que está escrito na página, texto que some é o pior defeito
 * possível.
 */
function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Devolve o renderizador de texto do `<Page>` para uma passagem.
 *
 * Sem passagem (questão de ementa, trecho ausente, casamento fraco) devolve
 * null, e quem chama passa `undefined` ao `<Page>` — assim o pdf.js usa o
 * caminho rápido dele, sem função por fragmento.
 */
export function criarDestacador(
  passagem: string | null | undefined,
): ((item: ItemDeTexto) => string) | null {
  if (!passagem) return null;
  const alvo = normalizar(passagem);
  if (alvo.length < MIN_CARACTERES) return null;

  return (item: ItemDeTexto) => {
    const seguro = escapar(item.str);
    const normalizado = normalizar(item.str);
    if (normalizado.length < MIN_CARACTERES || !alvo.includes(normalizado)) {
      return seguro;
    }
    return `<mark class="destaque-conferencia">${seguro}</mark>`;
  };
}
