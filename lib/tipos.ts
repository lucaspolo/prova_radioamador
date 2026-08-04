/** Um tema é uma das três matérias da prova Classe B. */
export type Tema =
  | "Técnica e ética operacional"
  | "Legislação de Telecomunicações"
  | "Conhecimentos de Eletrônica e Eletricidade";

/** Formato de cada item de public/banco_questoes.json. */
export interface Questao {
  id: string;
  tema: Tema;
  arquivo_origem: string;
  afirmacao: string;
  resposta_correta: boolean;
  explicacao_curta: string;
  /** Página do PDF de origem, usada pelo visualizador da Fase 4. */
  pagina: number;
}

/** Uma questão já respondida dentro de um simulado. */
export interface Resposta {
  questao: Questao;
  respondeu: boolean;
  acertou: boolean;
}

/** Filtro de tema escolhido na tela inicial. */
export type EscolhaTema = Tema | "todos";
