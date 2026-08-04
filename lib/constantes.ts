import type { Tema } from "./tipos";

/**
 * Parâmetros oficiais da prova, conforme o Ato nº 3448, de 11 de março de 2026
 * (item 11.3). Para a Classe B, cada matéria tem 20 questões "certo ou errado",
 * exige 11 acertos e dispõe de 30 minutos.
 */
export const TEMAS: Tema[] = [
  "Legislação de Telecomunicações",
  "Técnica e ética operacional",
  "Conhecimentos de Eletrônica e Eletricidade",
];

export const QUESTOES_POR_MATERIA = 20;
export const MINIMO_APROVACAO = 11;
export const MINUTOS_POR_MATERIA = 30;

/** Opções de tamanho de bateria oferecidas na tela inicial. */
export const TAMANHOS = [10, 20, 40, 60];

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
}

export const COR_TEMA: Record<Tema, EstiloTema> = {
  "Legislação de Telecomunicações": {
    texto: "text-sky-700 dark:text-sky-300",
    fundo: "bg-sky-50 dark:bg-sky-950/40",
    borda: "border-sky-300 dark:border-sky-800",
    barra: "bg-sky-500",
  },
  "Técnica e ética operacional": {
    texto: "text-violet-700 dark:text-violet-300",
    fundo: "bg-violet-50 dark:bg-violet-950/40",
    borda: "border-violet-300 dark:border-violet-800",
    barra: "bg-violet-500",
  },
  "Conhecimentos de Eletrônica e Eletricidade": {
    texto: "text-amber-700 dark:text-amber-300",
    fundo: "bg-amber-50 dark:bg-amber-950/40",
    borda: "border-amber-300 dark:border-amber-800",
    barra: "bg-amber-500",
  },
};

/**
 * Percentual mínimo para aprovação (11 de 20). Serve de linha de corte no
 * dashboard: abaixo disso, a matéria precisa de estudo.
 */
export const PERCENTUAL_APROVACAO = Math.round(
  (MINIMO_APROVACAO / QUESTOES_POR_MATERIA) * 100,
);
