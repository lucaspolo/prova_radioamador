/**
 * Exporta a ementa de `lib/ementa.ts` para JSON, para o gerador Python.
 *
 * Por que existe: o `processar_pdfs.py` mantinha a própria transcrição do item
 * 11.4 do Ato 3448, em duas strings, e o app não tinha nenhuma — a ementa
 * existia só onde o candidato não a via. Ao trazê-la para o app, manter as
 * duas cópias seria criar a errata: uma republicação do Ato corrigiria uma e
 * deixaria a outra ensinando o programa do ano passado.
 *
 * A transcrição do app é a que passa por conferência — `testes/ementa.test.ts`
 * abre o PDF e exige cada título e cada texto lá dentro —, então é ela que
 * vira fonte. O gerador lê o que já foi conferido em vez de refazer pior.
 *
 * O JSON é versionado, como `scripts/tabelas_referencia.json` e
 * `lib/mapa-pdfs.json`: quem regera o banco não precisa rodar Node antes do
 * Python. Reexporte com `npm run ementa` depois de mexer em `lib/ementa.ts`.
 */

import { writeFileSync } from "node:fs";
import { EMENTA, FONTE_EMENTA } from "../lib/ementa";

const DESTINO = new URL("ementa.json", import.meta.url);

const conteudo = {
  fonte: FONTE_EMENTA,
  blocos: EMENTA.map((b) => ({
    tema: b.tema,
    titulo: b.titulo,
    classes: b.classes,
    // `null` e não ausente: o gerador testa o campo, e um dicionário com
    // chaves diferentes conforme o bloco só rende KeyError.
    cumulativo: b.cumulativo ?? null,
    topicos: b.topicos.map((t) => ({
      id: t.id,
      titulo: t.titulo,
      texto: t.texto,
    })),
  })),
};

writeFileSync(DESTINO, JSON.stringify(conteudo, null, 2) + "\n", "utf8");
console.log(
  `${conteudo.blocos.length} blocos, ${conteudo.blocos.reduce((n, b) => n + b.topicos.length, 0)} tópicos -> ${DESTINO.pathname}`,
);
