import type { Questao } from "./tipos";

export const REPO = "lucaspolo/prova_radioamador";

/**
 * O formulário de revisão de questões.
 *
 * Antes isto abria uma issue no GitHub já preenchida, e o caminho tinha um
 * pedágio invisível: exigia conta. Quem estuda pelo app é radioamador, não
 * necessariamente alguém com login no GitHub — e a observação mais valiosa
 * sobre um gabarito é justamente a de quem leu a norma e não a de quem
 * programa. O formulário não pede conta nenhuma (contanto que ele fique
 * configurado sem exigir login) e ainda cai numa planilha, onde a triagem se
 * faz em lote em vez de issue por issue.
 *
 * Os `entry.NNNN` saem do próprio Forms, em "Obter link pré-preenchido":
 * preenchido qualquer valor em cada campo, o link gerado nomeia todos. Trocar
 * um campo de lugar no formulário NÃO muda o id dele; apagar e recriar, muda.
 * `testes/estudo.test.ts` confere que todos continuam com cara de id.
 */
const FORMULARIO_ID = "1FAIpQLSdGFsvNagv1yafO1xfr2i-MQGlW5SJAPnE28YAHxDiagrkMvg";

/**
 * Só os campos que o app preenche. O relato (`entry.1782144190`, o único
 * obrigatório do formulário) e o contato (`entry.2078470855`) ficam de fora de
 * propósito: são o que a pessoa escreve, e um campo já preenchido convida a
 * não mexer nele.
 */
const CAMPOS = {
  id: "entry.1116078860",
  afirmacao: "entry.729387439",
  gabarito: "entry.913444748",
  explicacao: "entry.489592719",
  fonte: "entry.943952266",
  classificacao: "entry.751082775",
} as const;

/**
 * Limite prático de URL. Bem abaixo do que o navegador aguenta, porque este
 * link também é colado em mensageiro e alguns truncam sem avisar.
 */
const MAX_URL = 2000;

/** Exposto para o teste conferir que a configuração não ficou pendente. */
export const CONFIG_FORMULARIO = { id: FORMULARIO_ID, campos: CAMPOS };

function classificacao(q: Questao): string {
  const nivel = q.nivel === "A" ? "acréscimo da Classe A" : "até a Classe B";
  const origem =
    q.origem === "documento"
      ? "extraída de um trecho do documento"
      : "gerada a partir da ementa";
  return `${q.tema} · ${nivel} · ${origem}`;
}

/**
 * A URL do formulário já preenchida com o que identifica a questão.
 *
 * O banco é gerado por LLM e revisado por amostragem — quem estuda por ele é
 * quem mais olha cada questão de perto. Marcar como suspeita já existia, mas a
 * marca morria no `localStorage` do aparelho: a observação certa sobre um
 * gabarito errado nunca chegava a quem pode corrigir o banco. Este é o
 * caminho de volta.
 *
 * Leva tudo que é preciso para conferir sem ter o aparelho em mãos: o id (que
 * é determinístico, derivado da afirmação, e sobrevive a regenerações do
 * banco), a fonte e a página.
 */
export function urlDeReporte(q: Questao): string {
  // Do mais identificador para o mais dispensável: se o link estourar, o que
  // cai é o fim da lista. Id e fonte são o que permite achar a questão de
  // novo, e por isso nunca saem.
  const preenchidos: [string, string][] = [
    [CAMPOS.id, q.id],
    [CAMPOS.fonte, `${q.arquivo_origem}, página ${q.pagina}`],
    [CAMPOS.gabarito, q.resposta_correta ? "Verdadeiro" : "Falso"],
    [CAMPOS.classificacao, classificacao(q)],
    [CAMPOS.afirmacao, q.afirmacao],
    [CAMPOS.explicacao, q.explicacao_curta],
  ];

  // Afirmação e explicação são curtas no banco (média de ~120 e ~102 chars),
  // mas uma regeneração futura pode alongá-las. Melhor um formulário enxuto
  // que abre do que um link que o mensageiro corta no meio.
  for (let ate = preenchidos.length; ate >= 2; ate--) {
    const url = montar(preenchidos.slice(0, ate));
    if (url.length <= MAX_URL) return url;
  }
  return montar(preenchidos.slice(0, 2));
}

function montar(campos: [string, string][]): string {
  const parametros = new URLSearchParams([["usp", "pp_url"], ...campos]);
  return `https://docs.google.com/forms/d/e/${FORMULARIO_ID}/viewform?${parametros}`;
}
