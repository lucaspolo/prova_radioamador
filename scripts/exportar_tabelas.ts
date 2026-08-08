/**
 * Exporta as tabelas de `lib/referencia.ts` para JSON, para o gerador Python.
 *
 * Por que existe: o passe de tabela do `processar_pdfs.py` precisa das linhas
 * uma a uma — cada faixa do plano de bandas, cada unidade da federação — e o
 * texto cru dessas páginas não serve. O pdfplumber lê a Tabela II do Ato 3448
 * com as colunas embaralhadas ("PP 8 AAA a YZZ" numa linha, o nome do estado na
 * seguinte), e pedir ao modelo que refaça o pareamento UF -> prefixo a partir
 * disso é pedir para ele errar um dado regulatório.
 *
 * A transcrição correta já existe em `lib/referencia.ts`, e `referencia.test.ts`
 * abre o PDF e confere linha a linha. Exportar dali é usar o dado que já passou
 * pela conferência, em vez de refazê-la pior.
 *
 * O JSON é versionado, como `lib/mapa-pdfs.json`: quem regera o banco não
 * precisa rodar Node antes do Python. Reexporte com `npm run tabelas` depois de
 * mexer em `lib/referencia.ts`.
 */

import { writeFileSync } from "node:fs";
import { TABELAS } from "../lib/referencia";

const DESTINO = new URL("tabelas_referencia.json", import.meta.url);

const conteudo = TABELAS.map((t) => ({
  id: t.id,
  titulo: t.titulo,
  colunas: t.colunas,
  arquivo: t.fonte.arquivo,
  paginas: t.fonte.paginas,
  referencia: t.fonte.referencia,
  linhas: t.linhas.map((l) => l.celulas),
}));

writeFileSync(DESTINO, JSON.stringify(conteudo, null, 2) + "\n", "utf8");
console.log(
  `${conteudo.length} tabelas, ${conteudo.reduce((n, t) => n + t.linhas.length, 0)} linhas -> ${DESTINO.pathname}`,
);
