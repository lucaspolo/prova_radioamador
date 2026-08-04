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
