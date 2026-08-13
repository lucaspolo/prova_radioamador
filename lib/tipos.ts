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

/** As três classes de radioamador, do Ato nº 3448/2026. */
export type Classe = "A" | "B" | "C";

/**
 * Menor classe cujo programa já cobre o conteúdo da questão, entre as que o
 * banco distingue.
 *
 * A ementa do item 11.4 é cumulativa: a de Eletrônica da Classe B inclui "todo
 * o conteúdo" da Classe C, e a da Classe A inclui "todo o conteúdo" da B. Já
 * Legislação e Técnica e Ética têm uma única ementa para as três classes.
 *
 * - `B`: está no programa até a Classe B — logo vale também para a Classe C,
 *   que cobra um subconjunto disso.
 * - `A`: é o acréscimo exclusivo da Classe A (análise de circuitos CA,
 *   eletrônica de RF, teoria técnica de antenas, fenômenos de propagação).
 *   Não pode cair num simulado de Classe B ou C.
 */
export type Nivel = "B" | "A";

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
  nivel: Nivel;
  /**
   * Chave do trecho literal que gerou a afirmação, em public/trechos.json.
   * Ausente quando `origem` é `ementa`: essas questões nascem de um tópico da
   * ementa, e não de um texto — não há trecho a mostrar.
   */
  trecho_id?: string;
  /**
   * O tópico da ementa que dirigiu a geração — o "assunto" da questão. Só as
   * de `origem: "ementa"` têm: as de documento derivam o assunto de
   * arquivo+página (`lib/secoes.ts`), que é fonte melhor — a página existe.
   */
  topico?: string;
  /**
   * Quanto esta questão pesa no sorteio, quando diferente de 1.
   *
   * Existe para a questão que precisa estar no banco mas não pode dominá-lo. O
   * caso que criou o campo é o plano de bandas: são 39 linhas na Tabela I, e
   * uma questão por linha é o que garante que nenhuma faixa fique sem ser
   * cobrada. Só que todas têm a mesma forma — "na Faixa de X, a radiofrequência
   * é Y e podem operar Z" —, e sorteadas por igual encheriam a bateria de
   * variações do mesmo molde, ensinando a reconhecer o padrão em vez do
   * conteúdo.
   *
   * Ausente significa 1. Não confundir com o peso por desempenho de
   * `lib/prioridade.ts`, que muda conforme o usuário acerta ou erra: este é
   * fixo, uma propriedade da questão, e os dois se multiplicam.
   */
  peso?: number;
}

/** Um trecho de PDF, exatamente como foi enviado ao modelo que gerou as questões. */
export interface Trecho {
  arquivo: string;
  /** Página onde o trecho começa. */
  pagina: number;
  /** Última página que o trecho cobre — chunks atravessam páginas. */
  fim: number;
  texto: string;
}

/**
 * Por que a bateria terminou.
 *
 * O resultado precisa saber: no modo cego dá para encerrar antes da hora com
 * questões em branco, e aí anunciar "tempo esgotado" seria mentira.
 */
export type MotivoFim = "tempo" | "manual";

/** Uma questão de um simulado concluído. */
export interface Resposta {
  questao: Questao;
  /**
   * O que o usuário respondeu. `null` = não respondida: o cronômetro esgotou
   * antes. Como na prova real, questão em branco conta como erro.
   */
  respondeu: boolean | null;
  acertou: boolean;
}

