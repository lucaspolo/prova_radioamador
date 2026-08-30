import type { Classe, Regime, Tema } from "./tipos";
import { CLASSES, CLASSE_PADRAO, TEMAS as TODOS_OS_TEMAS } from "./constantes";

export const CHAVE_PREFERENCIAS = "prova-radioamador:preferencias";

/** "automatico" segue o `prefers-color-scheme` do sistema. */
export type PreferenciaTema = "claro" | "escuro" | "automatico";
export type Escala = "pequeno" | "normal" | "grande";

export interface Preferencias {
  tema: PreferenciaTema;
  escala: Escala;
  /**
   * A classe para a qual o candidato estuda. Quem prepara a C ou a A estuda
   * para ela por semanas — re-selecionar a cada volta ao início era atrito
   * diário.
   */
  classe: Classe;
  /**
   * Regime e cronômetro da bateria.
   *
   * Ficavam de fora por serem "escolha de sessão, um toque cada". Passaram a
   * ser gravados quando a tela inicial recolheu o bloco "Como conduzir" num
   * resumo de uma linha: esconder um controle que a pessoa precisa tocar toda
   * vez seria pior do que a tela comprida. Recolher e lembrar andam juntos —
   * um sem o outro não vale.
   */
  regime: Regime;
  cronometrar: boolean;
  /**
   * Matérias e tamanho da última bateria montada.
   *
   * A classe já era lembrada pela mesma razão ("cada volta ao início
   * recomeçava na B"), e matéria e quantidade tinham ficado de fora — mas quem
   * treina a prova completa a repete todo dia, e quem estuda em blocos de 10
   * reconfigurava a home a cada bateria. Voltar do consolidado das três
   * matérias e reencontrar "Legislação · 20 questões" é começar de novo.
   */
  temas: Tema[];
  quantidade: number;
}

export const PREFERENCIAS_PADRAO: Preferencias = {
  tema: "automatico",
  escala: "normal",
  classe: CLASSE_PADRAO,
  regime: "treino",
  cronometrar: true,
  temas: [TODOS_OS_TEMAS[0]],
  quantidade: 20,
};

/** Multiplicador do tamanho de fonte da raiz. */
export const FATOR_ESCALA: Record<Escala, number> = {
  pequeno: 0.9,
  normal: 1,
  grande: 1.15,
};

const TEMAS: PreferenciaTema[] = ["claro", "escuro", "automatico"];
const ESCALAS: Escala[] = ["pequeno", "normal", "grande"];
const REGIMES: Regime[] = ["treino", "cego"];

function temasValidos(bruto: unknown): Tema[] {
  if (!Array.isArray(bruto)) return PREFERENCIAS_PADRAO.temas;
  const limpos = TODOS_OS_TEMAS.filter((t) => bruto.includes(t));
  return limpos.length > 0 ? limpos : PREFERENCIAS_PADRAO.temas;
}

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
    // Preferência gravada antes de a classe existir não tem o campo: cai no
    // padrão, como qualquer valor que a validação não reconheça.
    classe: CLASSES.includes(bruto.classe as Classe)
      ? (bruto.classe as Classe)
      : PREFERENCIAS_PADRAO.classe,
    regime: REGIMES.includes(bruto.regime as Regime)
      ? (bruto.regime as Regime)
      : PREFERENCIAS_PADRAO.regime,
    // Só `false` desliga: qualquer outro valor (ausente, "sim", null) cai no
    // padrão, que é cronometrar — a prova real tem relógio.
    cronometrar:
      typeof bruto.cronometrar === "boolean"
        ? bruto.cronometrar
        : PREFERENCIAS_PADRAO.cronometrar,
    // Filtra tema a tema em vez de aceitar ou rejeitar a lista inteira: um
    // nome de matéria que saiu do app não deve levar junto os outros dois.
    // Lista vazia não é escolha válida — não existe bateria de zero matérias.
    temas: temasValidos(bruto.temas),
    // A quantidade não é validada contra a lista de opções da tela: elas
    // mudam, e o número gravado continua sendo um pedido legítimo. O que se
    // exige é ser inteiro positivo e caber numa bateria.
    quantidade:
      typeof bruto.quantidade === "number" &&
      Number.isInteger(bruto.quantidade) &&
      bruto.quantidade > 0 &&
      bruto.quantidade <= 200
        ? bruto.quantidade
        : PREFERENCIAS_PADRAO.quantidade,
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
