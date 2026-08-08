/**
 * Gera `relatorios/conferencia.md`: as questões do banco em ordem de leitura,
 * cada uma ao lado do texto que a produziu.
 *
 * Por que existe: as travas automáticas cobrem o que dá para derivar do texto —
 * que a linha da tabela está na página, que toda faixa tem questão, que o
 * gabarito é booleano. Nenhuma delas responde "esta afirmação é verdadeira?".
 * Os dois erros graves que já saíram deste banco (o "W" lido como "Y" no Ato
 * 3445 e as colunas trocadas da Tabela II, que inverteram treze gabaritos) só
 * apareceram porque alguém leu uma questão e desconfiou. Este relatório é o
 * caminho manual: dá para abrir um PDF, ir descendo as páginas e conferir tudo
 * o que o banco cobra daquela página de uma vez.
 *
 * O arquivo é derivado de dois JSON já versionados e por isso fica fora do
 * histórico (`relatorios/` está no .gitignore). Regere com `npm run conferencia`.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { caminhoPdf } from "../lib/pdfs";
import { localizarPassagem } from "../lib/trechos";
import type { Questao, Trecho } from "../lib/tipos";

import banco from "../public/banco_questoes.json";
import trechos from "../public/trechos.json";

const QUESTOES = banco as Questao[];
const TRECHOS = trechos as Record<string, Trecho>;

const DESTINO = new URL("../relatorios/conferencia.md", import.meta.url);

// --- Escape -----------------------------------------------------------------

/**
 * Neutraliza a marcação que mudaria o enunciado na tela.
 *
 * Não é preciosismo: 23 questões escrevem `20 V_rms`, e sem escapar o par de
 * sublinhados vira itálico e some da frase. Um relatório que existe para
 * conferir o enunciado não pode mostrar um enunciado diferente do que o app
 * mostra. Medido no banco de 2026-08: 45 com `|`, 23 com `_`, 7 com `*`, 6 com
 * `<`, 3 com colchetes.
 */
function escapar(texto: string): string {
  return texto.replace(/[\\`*_[\]<|&]/g, (c) => "\\" + c);
}

/**
 * Cita o texto do PDF preservando as quebras de linha da página.
 *
 * Duas decisões aqui. A primeira: linha em branco encerra um `blockquote`, e 44
 * dos 55 trechos têm uma — por isso toda linha vai prefixada, inclusive as
 * vazias, e termina com os dois espaços que o GFM lê como quebra de linha. Sem
 * isso a citação vira um parágrafo corrido e para de casar com o que está na
 * página, que é a única coisa que ela serve para fazer.
 *
 * A segunda: aqui o escape é mínimo, ao contrário do enunciado. Este texto é
 * cópia do PDF, e encher de contrabarra o que se quer comparar caractere a
 * caractere estraga a comparação. Escapamos só `<` e `&`, os dois que fariam
 * texto *sumir* (tag HTML crua, entidade). O resto no máximo muda o estilo: uma
 * linha começando com "-" vira item de lista dentro da citação, e o conteúdo
 * continua legível e inteiro.
 *
 * A citação nasce dentro de um item de lista aninhado, então vai indentada: em
 * coluna 0 ela encerra a lista, e a linha de origem logo abaixo recomeçaria
 * outra — cada questão sairia partida em dois pedaços soltos.
 */
function citar(texto: string, recuo: string): string {
  return texto
    .split("\n")
    .map((l) => {
      const seguro = l.replace(/[<&]/g, (c) => "\\" + c);
      return seguro.trim() ? `${recuo}> ${seguro}  ` : `${recuo}>`;
    })
    .join("\n");
}

// --- Ordenação --------------------------------------------------------------

/**
 * Ordem de leitura: arquivo, depois página.
 *
 * Os desempates existem só para a saída ser estável entre execuções — dentro de
 * uma página o `id` é um hash e não significa nada. `documento` antes de
 * `ementa` porque são duas conferências diferentes: a primeira se faz contra o
 * PDF aberto na página, a segunda contra o que você sabe do assunto.
 *
 * Agrupar por trecho foi descartado de propósito. Sob a ordem de página os
 * trechos se interrompem 79 vezes (o passe de tabela espalha questões do mesmo
 * trecho por páginas diferentes), então agrupar por trecho quebraria a leitura
 * linear, que é justamente o motivo do relatório.
 */
function ordenar(a: Questao, b: Questao): number {
  return (
    a.arquivo_origem.localeCompare(b.arquivo_origem, "pt-BR") ||
    a.pagina - b.pagina ||
    a.origem.localeCompare(b.origem) ||
    (a.trecho_id ?? "").localeCompare(b.trecho_id ?? "") ||
    a.id.localeCompare(b.id)
  );
}

// --- Montagem ---------------------------------------------------------------

/**
 * Âncora do GitHub para um `## título`.
 *
 * O sublinhado sobrevive — não é pontuação para o slugger, e tirá-lo quebraria
 * os links dos dois arquivos que o têm no nome (`..._2M_220_UHF.pdf`,
 * `SEI_ANATEL - ...`). O ponto, a vírgula e o `º` somem.
 */
function ancora(titulo: string): string {
  return titulo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 _-]/g, "")
    .replace(/ /g, "-");
}

const ordenadas = [...QUESTOES].sort(ordenar);
const arquivos = [...new Set(ordenadas.map((q) => q.arquivo_origem))];

let comPassagem = 0;
let semPassagem = 0;
let daEmenta = 0;

const linhas: string[] = [];

linhas.push("# Conferência do banco de questões");
linhas.push("");
linhas.push(
  `${QUESTOES.length} questões · ${arquivos.length} arquivos · gerado de ` +
    "`public/banco_questoes.json` por `npm run conferencia`",
);
linhas.push("");
linhas.push(
  "> **Como ler.** *Texto original* é a passagem do trecho mais parecida com a " +
    "afirmação, localizada por aproximação — a mesma função que grifa a origem " +
    "no app. Serve para achar o lugar na página, não como prova: o trecho " +
    "inteiro que foi ao modelo está em `public/trechos.json`. Questões marcadas " +
    "*ementa* não nasceram de um texto, e ali a página é só o capítulo onde " +
    "estudar o assunto. O código no fim de cada questão é o `id`, que é a chave " +
    "de `scripts/correcoes.json` — quem achar uma questão errada já tem em mãos " +
    "o que precisa para corrigi-la.",
);
linhas.push("");

for (const arquivo of arquivos) {
  const n = ordenadas.filter((q) => q.arquivo_origem === arquivo).length;
  linhas.push(`- [${arquivo}](#${ancora(arquivo)}) — ${n} questões`);
}
linhas.push("");

for (const arquivo of arquivos) {
  const doArquivo = ordenadas.filter((q) => q.arquivo_origem === arquivo);
  const publicado = caminhoPdf(arquivo);

  linhas.push("");
  linhas.push(`## ${arquivo}`);
  linhas.push("");
  linhas.push(
    `${doArquivo.length} questões` +
      (publicado ? ` · [abrir PDF](../public${publicado})` : ""),
  );

  let paginaAtual = -1;
  for (const q of doArquivo) {
    if (q.pagina !== paginaAtual) {
      paginaAtual = q.pagina;
      linhas.push("");
      linhas.push(`### p. ${q.pagina}`);
      linhas.push("");
    }

    linhas.push(
      `- **[${q.resposta_correta ? "V" : "F"}]** ${escapar(q.afirmacao)}`,
    );
    linhas.push(`  - **Explicação:** ${escapar(q.explicacao_curta)}`);

    if (q.trecho_id) {
      const trecho = TRECHOS[q.trecho_id];
      // Trecho ausente é incoerência entre os dois JSON, não um caso normal:
      // vale dizer alto, e não desenhar uma citação vazia como se estivesse tudo bem.
      if (!trecho) {
        linhas.push(
          `  - **Trecho \`${q.trecho_id}\` não está em public/trechos.json.**`,
        );
        semPassagem++;
      } else {
        const p = localizarPassagem(trecho.texto, q.afirmacao);
        if (p) {
          comPassagem++;
          linhas.push("  - **Texto original:**");
          linhas.push(citar(trecho.texto.slice(p.inicio, p.fim), "    "));
        } else {
          semPassagem++;
          linhas.push(
            "  - **Passagem não localizada** — o trecho inteiro " +
              `(pp. ${trecho.pagina}-${trecho.fim}) está em ` +
              `\`public/trechos.json\`, chave \`${q.trecho_id}\`.`,
          );
        }
      }
    } else {
      daEmenta++;
      linhas.push(
        `  - **Sem texto de origem** — questão da ementa; a p. ${q.pagina} é só ` +
          "o capítulo onde estudar o assunto.",
      );
    }

    linhas.push(
      `  - **Origem:** p. ${q.pagina} · ${q.tema} · ${q.origem}` +
        (q.nivel === "A" ? " · Classe A" : "") +
        ` · \`${q.id}\``,
    );
    linhas.push("");
  }
}

const saida = linhas.join("\n").replace(/\n{3,}/g, "\n\n") + "\n";

// Um relatório que perde questão em silêncio é pior que nenhum: passa a sensação
// de cobertura completa sem ela. Conferir é uma linha.
const escritas = (saida.match(/^- \*\*\[[VF]\]\*\* /gm) ?? []).length;
if (escritas !== QUESTOES.length) {
  console.error(
    `FALHA: ${QUESTOES.length} questões no banco, ${escritas} no relatório.`,
  );
  process.exit(1);
}

mkdirSync(new URL("../relatorios/", import.meta.url), { recursive: true });
writeFileSync(DESTINO, saida, "utf8");

const doDocumento = comPassagem + semPassagem;
console.log(
  `${escritas} questões · ${arquivos.length} arquivos · ` +
    `${comPassagem}/${doDocumento} com passagem localizada · ` +
    `${daEmenta} da ementa (sem texto de origem) -> ${DESTINO.pathname}`,
);
