import type { Questao } from "./tipos";

export const REPO = "lucaspolo/prova_radioamador";

/** Limite prático de URL nos navegadores; acima disso o GitHub pode recusar. */
const MAX_URL = 8000;

/**
 * Monta a URL de abertura de issue já preenchida com o que identifica a
 * questão.
 *
 * O banco é gerado por LLM e revisado por amostragem — quem estuda por ele é
 * quem mais olha cada questão de perto. Marcar como suspeita já existia, mas a
 * marca morria no `localStorage` do aparelho: a observação certa sobre um
 * gabarito errado nunca chegava a quem pode corrigir o banco. Este é o
 * caminho de volta.
 *
 * O corpo leva tudo que é preciso para conferir sem ter o aparelho em mãos: o
 * id (que é determinístico, derivado da afirmação, e sobrevive a regenerações
 * do banco), a fonte e a página.
 */
export function urlDeReporte(q: Questao): string {
  const resumo =
    q.afirmacao.length > 60 ? `${q.afirmacao.slice(0, 60).trimEnd()}…` : q.afirmacao;

  const corpo = [
    "<!-- Descreva abaixo o que parece errado. Quanto mais específico, melhor. -->",
    "",
    "**O que parece errado:**",
    "",
    "",
    "---",
    "",
    `- **Id:** \`${q.id}\``,
    `- **Matéria:** ${q.tema}`,
    `- **Nível:** ${q.nivel === "A" ? "acréscimo da Classe A" : "até a Classe B"}`,
    `- **Procedência:** ${q.origem === "documento" ? "extraída de um trecho do documento" : "gerada a partir da ementa"}`,
    `- **Fonte:** ${q.arquivo_origem}, página ${q.pagina}`,
    "",
    "**Afirmação:**",
    "",
    `> ${q.afirmacao}`,
    "",
    `**Gabarito atual:** ${q.resposta_correta ? "Verdadeiro" : "Falso"}`,
    "",
    "**Explicação atual:**",
    "",
    `> ${q.explicacao_curta}`,
  ].join("\n");

  const parametros = new URLSearchParams({
    title: `Questão suspeita: ${resumo}`,
    labels: "questao",
    body: corpo,
  });

  const url = `https://github.com/${REPO}/issues/new?${parametros}`;
  if (url.length <= MAX_URL) return url;

  // Afirmação e explicação são curtas no banco (média de ~120 e ~102 chars),
  // mas uma regeneração futura pode alongá-las. Melhor uma issue enxuta que o
  // GitHub aceita do que um link que não abre.
  const enxuto = new URLSearchParams({
    title: `Questão suspeita: ${resumo}`,
    labels: "questao",
    body: `Id: \`${q.id}\`\nFonte: ${q.arquivo_origem}, página ${q.pagina}\n\n**O que parece errado:**\n`,
  });
  return `https://github.com/${REPO}/issues/new?${enxuto}`;
}
