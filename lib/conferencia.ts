import type { Questao } from "./tipos";

/**
 * A conferência do banco: a ordem de leitura e o que o revisor anota.
 *
 * Hoje quem consome isto é `scripts/relatorio_conferencia.ts`, que escreve o
 * Markdown. A ordenação sai de lá porque ela vale para qualquer apresentação
 * do mesmo material — ordem diferente entre duas saídas seria ordem errada
 * numa delas.
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
 * `porOcrDeVisao` chega pronto porque descobri-lo custa abrir os PDFs. O script
 * mede em disco e publica o resultado em `lib/ocr-visao.json`; quem não puder
 * pagar essa medição lê o arquivo e passa o mesmo conjunto, o que mantém as
 * duas leituras na mesma ordem.
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
