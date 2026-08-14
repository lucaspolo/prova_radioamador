import mapa from "./mapa-pdfs.json";

/**
 * Liga o `arquivo_origem` gravado no banco de questões ao PDF publicado em
 * public/pdfs/. O mapa é gerado por `npm run pdfs`, que renomeia os arquivos
 * para nomes seguros em URL.
 */
const MAPA: Record<string, string> = mapa;

/** Caminho público do PDF, ou null se ele não foi publicado. */
export function caminhoPdf(arquivoOrigem: string): string | null {
  const alvo = MAPA[arquivoOrigem];
  return alvo ? `/pdfs/${alvo}` : null;
}

/** Se há um PDF disponível para consulta. */
export function temPdf(arquivoOrigem: string): boolean {
  return caminhoPdf(arquivoOrigem) !== null;
}

/**
 * Quanto o material inteiro pesa, para avisar quem vai baixar no celular.
 *
 * Escrito à mão porque o navegador não sabe o tamanho antes de baixar, e
 * embutir 12 números no bundle para somar seria pior. `npm run pdfs` imprime o
 * tamanho de cada arquivo, e `testes/pdfs.test.ts` soma os publicados e
 * reprova se este valor tiver ficado para trás — trocar um PDF sem atualizar
 * aqui não passa calado.
 */
export const TAMANHO_MATERIAL_MB = 6.4;
