export const CHAVE_PREFERENCIAS = "prova-radioamador:preferencias";

/** "automatico" segue o `prefers-color-scheme` do sistema. */
export type PreferenciaTema = "claro" | "escuro" | "automatico";
export type Escala = "pequeno" | "normal" | "grande";

export interface Preferencias {
  tema: PreferenciaTema;
  escala: Escala;
}

export const PREFERENCIAS_PADRAO: Preferencias = {
  tema: "automatico",
  escala: "normal",
};

/** Multiplicador do tamanho de fonte da raiz. */
export const FATOR_ESCALA: Record<Escala, number> = {
  pequeno: 0.9,
  normal: 1,
  grande: 1.15,
};

const TEMAS: PreferenciaTema[] = ["claro", "escuro", "automatico"];
const ESCALAS: Escala[] = ["pequeno", "normal", "grande"];

/** Aceita o que reconhece e ignora o resto, como o resto do storage do app. */
export function validarPreferencias(dados: unknown): Preferencias {
  if (typeof dados !== "object" || dados === null) return PREFERENCIAS_PADRAO;
  const bruto = dados as Partial<Preferencias>;
  return {
    tema: TEMAS.includes(bruto.tema as PreferenciaTema)
      ? (bruto.tema as PreferenciaTema)
      : PREFERENCIAS_PADRAO.tema,
    escala: ESCALAS.includes(bruto.escala as Escala)
      ? (bruto.escala as Escala)
      : PREFERENCIAS_PADRAO.escala,
  };
}

export function lerPreferencias(): Preferencias {
  if (typeof window === "undefined") return PREFERENCIAS_PADRAO;
  try {
    const bruto = window.localStorage.getItem(CHAVE_PREFERENCIAS);
    if (!bruto) return PREFERENCIAS_PADRAO;
    return validarPreferencias(JSON.parse(bruto));
  } catch {
    return PREFERENCIAS_PADRAO;
  }
}

/** Grava. Devolve false se o storage recusou (cota, modo privado). */
export function gravarPreferencias(p: Preferencias): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(CHAVE_PREFERENCIAS, JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
}

/**
 * Cor de fundo de cada tema, para manter a barra do navegador do celular
 * casada com o app. Precisa bater com `--background` em `app/globals.css`.
 */
export const COR_FUNDO = { claro: "#f8fafc", escuro: "#0b1120" } as const;

/**
 * Aplica as preferências ao documento.
 *
 * O atributo `data-tema` só existe quando o usuário escolheu um tema: no
 * automático ele é removido, e aí o `@media (prefers-color-scheme)` volta a
 * mandar. É por isso que o CSS precisa funcionar nos dois sentidos — forçar
 * claro num sistema escuro é tão válido quanto o contrário.
 */
export function aplicarPreferencias(p: Preferencias): void {
  if (typeof document === "undefined") return;
  const raiz = document.documentElement;

  if (p.tema === "automatico") raiz.removeAttribute("data-tema");
  else raiz.setAttribute("data-tema", p.tema);

  raiz.style.setProperty("--escala-fonte", String(FATOR_ESCALA[p.escala]));

  // O `themeColor` do layout é declarado por media query e não sabe do
  // override; sem isto a barra do navegador fica na cor do sistema, destoando
  // do app inteiro.
  const escuro =
    p.tema === "escuro" ||
    (p.tema === "automatico" &&
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((meta) => meta.remove());
  const meta = document.createElement("meta");
  meta.name = "theme-color";
  meta.content = escuro ? COR_FUNDO.escuro : COR_FUNDO.claro;
  document.head.appendChild(meta);
}
