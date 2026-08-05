export const CHAVE_SUSPEITAS = "prova-radioamador:suspeitas";

/**
 * Ids das questões que o usuário marcou como suspeitas de erro.
 *
 * É o canal de qualidade contínuo do banco: quem mais olha as questões é quem
 * estuda por elas. Os ids são determinísticos (derivados da afirmação), então
 * a marca sobrevive a regenerações do banco — e se uma questão marcada for
 * removida numa atualização, a lista denuncia isso em vez de quebrar.
 */
export function lerSuspeitas(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const bruto = window.localStorage.getItem(CHAVE_SUSPEITAS);
    if (!bruto) return [];
    const dados = JSON.parse(bruto) as unknown;
    if (!Array.isArray(dados)) return [];
    return dados.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

/** Grava a lista. Devolve false se o storage recusou (cota, modo privado). */
export function gravarSuspeitas(ids: string[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(CHAVE_SUSPEITAS, JSON.stringify(ids));
    return true;
  } catch {
    return false;
  }
}
