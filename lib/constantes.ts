import type { Classe, Nivel, Tema } from "./tipos";

/**
 * As três matérias. São as mesmas para as três classes: o item 11.3 do Ato
 * nº 3448/2026 repete a distribuição para A, B e C, mudando só o quantitativo.
 */
export const TEMAS: Tema[] = [
  "Legislação de Telecomunicações",
  "Técnica e ética operacional",
  "Conhecimentos de Eletrônica e Eletricidade",
];

export interface FormatoProva {
  /** Questões por matéria na prova real. */
  questoes: number;
  minimo: number;
  minutos: number;
  /** Níveis de conteúdo elegíveis no sorteio desta classe. */
  niveis: Nivel[];
}

/**
 * Formato oficial de cada classe, do item 11.3 do Ato nº 3448/2026.
 *
 * A Classe A é a única que sorteia o nível "A": a ementa dela é a da Classe B
 * mais quatro tópicos técnicos de Eletrônica. A Classe C usa o mesmo acervo da
 * B porque a ementa básica é um subconjunto da dela — o banco cobre mais do que
 * a C exige, e a tela inicial diz isso.
 */
export const FORMATO: Record<Classe, FormatoProva> = {
  C: { questoes: 15, minimo: 8, minutos: 20, niveis: ["B"] },
  B: { questoes: 20, minimo: 11, minutos: 30, niveis: ["B"] },
  A: { questoes: 30, minimo: 16, minutos: 40, niveis: ["B", "A"] },
};

/** A classe padrão do app; é a prova para a qual ele foi construído. */
export const CLASSE_PADRAO: Classe = "B";

export const CLASSES: Classe[] = ["C", "B", "A"];

/**
 * Quantos erros uma sessão de revisão traz por vez.
 *
 * A revisão levava TODOS os erros em aberto de uma vez — 91 questões no
 * histórico de quem estuda há semanas, uma hora de leitura de explicações que
 * só entrava no histórico se fosse até o fim. Vinte é o tamanho da prova real
 * da Classe B: cabe numa sentada, e o resultado convida a continuar enquanto
 * sobrar erro.
 */
export const LOTE_REVISAO = 20;

/** Percentual mínimo para aprovação na classe. */
export function percentualAprovacao(classe: Classe): number {
  const f = FORMATO[classe];
  return Math.round((f.minimo / f.questoes) * 100);
}

/**
 * Passou nesta matéria?
 *
 * O critério oficial é um número absoluto de acertos (11 de 20 na Classe B) e
 * só vale no tamanho oficial. Numa bateria de outro tamanho, compara-se pela
 * proporção equivalente — em inteiros, para não depender de arredondamento.
 */
/**
 * Quantos acertos são precisos numa bateria de `total` questões.
 *
 * No tamanho oficial é o mínimo da norma (11 de 20 na Classe B). Fora dele, é
 * o menor número que satisfaz a mesma proporção — o mesmo critério que
 * `aprovadoNaMateria` aplica, dito como número em vez de sim ou não. Existe
 * porque "faltaram 2 acertos" é acionável e "40%, critério 55%" é uma conta
 * que a pessoa tem de fazer sozinha logo depois de errar.
 */
export function minimoEquivalente(classe: Classe, total: number): number {
  const f = FORMATO[classe];
  if (total === f.questoes) return f.minimo;
  return Math.ceil((f.minimo * total) / f.questoes);
}

export function aprovadoNaMateria(
  classe: Classe,
  acertos: number,
  total: number,
): boolean {
  const f = FORMATO[classe];
  if (total === f.questoes) return acertos >= f.minimo;
  return acertos * f.questoes >= f.minimo * total;
}

/**
 * Fatia curta e estável do tema na URL do desafio. O índice em `TEMAS` seria
 * menor, mas um link já compartilhado tem de continuar valendo se a ordem do
 * array mudar um dia — e "t=legislacao" se lê sem decodificar nada.
 *
 * Mora aqui, e não em `lib/desafio.ts`, porque `lib/questoes.ts` também
 * precisa dela (a semente de cada matéria deriva do slug) e importar o desafio
 * de lá fecharia um ciclo.
 */
export const SLUG_TEMA: Record<Tema, string> = {
  "Legislação de Telecomunicações": "legislacao",
  "Técnica e ética operacional": "tecnica",
  "Conhecimentos de Eletrônica e Eletricidade": "eletronica",
};

/**
 * Segundos de prova para uma bateria de `n` questões, na proporção oficial da
 * classe. Na bateria do tamanho da prova real, dá exatamente o tempo oficial
 * (Classe B: 20 questões em 30 min); nos outros tamanhos, mantém o mesmo
 * ritmo por questão.
 */
export function tempoDaBateria(classe: Classe, n: number): number {
  const f = FORMATO[classe];
  return Math.round((f.minutos * 60 * n) / f.questoes);
}

/**
 * Opções de tamanho de bateria, ancoradas no formato da classe: uma bateria
 * curta, a prova de uma matéria, e os múltiplos até as três matérias. Para a
 * Classe B dá 10/20/40/60, como antes.
 */
export function tamanhos(classe: Classe): number[] {
  const q = FORMATO[classe].questoes;
  return [10, q, q * 2, q * 3];
}

/** Rótulos curtos, para caber nos cartões e nas barras do dashboard. */
export const ROTULO_CURTO: Record<Tema, string> = {
  "Legislação de Telecomunicações": "Legislação",
  "Técnica e ética operacional": "Técnica e Ética",
  "Conhecimentos de Eletrônica e Eletricidade": "Eletrônica",
};

/**
 * Uma cor por tema, reaproveitada no simulado e no dashboard.
 *
 * As classes são escritas por extenso porque o Tailwind varre o código-fonte
 * em busca de literais: um nome montado em tempo de execução, como
 * `bg-${cor}-500`, não seria detectado e a cor não entraria no CSS.
 */
export interface EstiloTema {
  texto: string;
  fundo: string;
  borda: string;
  barra: string;
  /** Stroke de SVG, para o sparkline de evolução. */
  linha: string;
}

export const COR_TEMA: Record<Tema, EstiloTema> = {
  "Legislação de Telecomunicações": {
    texto: "text-sky-700 dark:text-sky-300",
    fundo: "bg-sky-50 dark:bg-sky-950/40",
    borda: "border-sky-300 dark:border-sky-800",
    barra: "bg-sky-600",
    linha: "stroke-sky-600",
  },
  "Técnica e ética operacional": {
    texto: "text-violet-700 dark:text-violet-300",
    fundo: "bg-violet-50 dark:bg-violet-950/40",
    borda: "border-violet-300 dark:border-violet-800",
    barra: "bg-violet-600",
    linha: "stroke-violet-600",
  },
  // Teal, e não âmbar: o âmbar já era a cor de "atenção" (abaixo do corte) e
  // de "marcada para revisar". Na tela de desempenho, a barra da matéria e o
  // aviso de que ela está abaixo do corte ficavam da mesma cor — a cor deixava
  // de significar uma coisa só. Nenhuma família cumpre dois papéis.
  "Conhecimentos de Eletrônica e Eletricidade": {
    texto: "text-teal-700 dark:text-teal-300",
    fundo: "bg-teal-50 dark:bg-teal-950/40",
    borda: "border-teal-300 dark:border-teal-800",
    barra: "bg-teal-600",
    linha: "stroke-teal-600",
  },
};

/**
 * Linha de corte usada no dashboard, que agrega simulados de todas as classes.
 *
 * É o percentual da Classe B (55%), o mais exigente dos três — A e C aprovam
 * com 53%. Usar o mais alto mantém o alerta conservador: quem passa dele passa
 * em qualquer classe.
 */
export const PERCENTUAL_CORTE = percentualAprovacao("B");
