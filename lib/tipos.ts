/** Um tema é uma das três matérias da prova Classe B. */
export type Tema =
  | "Técnica e ética operacional"
  | "Legislação de Telecomunicações"
  | "Conhecimentos de Eletrônica e Eletricidade";

/**
 * De onde veio a afirmação.
 *
 * - `documento`: extraída de um trecho do PDF. A página é a fonte literal.
 * - `ementa`: gerada a partir da ementa oficial, num passe complementar que
 *   cobre o que os documentos ensinam mas não exercitam (cálculo) ou tratam
 *   de forma resumida (operação). Aqui a página é o capítulo que trata do
 *   assunto — material para estudar, e não a origem da frase.
 */
export type Origem = "documento" | "ementa";

/** Formato de cada item de public/banco_questoes.json. */
export interface Questao {
  id: string;
  tema: Tema;
  arquivo_origem: string;
  afirmacao: string;
  resposta_correta: boolean;
  explicacao_curta: string;
  /** Página do PDF, usada pelo visualizador da Fase 4. */
  pagina: number;
  origem: Origem;
}

/** Uma questão já respondida dentro de um simulado. */
export interface Resposta {
  questao: Questao;
  respondeu: boolean;
  acertou: boolean;
}

/** Filtro de tema escolhido na tela inicial. */
export type EscolhaTema = Tema | "todos";
