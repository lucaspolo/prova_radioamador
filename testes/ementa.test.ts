import { readFileSync } from "node:fs";
import {
  EMENTA,
  FONTE_EMENTA,
  blocosDaClasse,
  lerAssunto,
  questoesDoTopico,
  secoesDoTopico,
  topicoPorId,
  topicos,
} from "@/lib/ementa";
import { caminhoPdf, temPdf } from "@/lib/pdfs";
import { rotuloDoTopico, secaoPorRef } from "@/lib/secoes";
import { BANCO } from "@/lib/questoes";
import { CLASSES } from "@/lib/constantes";

let falhas = 0;
function checar(nome: string, ok: boolean, detalhe = "") {
  if (!ok) falhas++;
  console.log(`${ok ? "  ok  " : "FALHA "} ${nome}${detalhe ? " — " + detalhe : ""}`);
}

/**
 * Mesma normalização de `referencia.test.ts`: descarta tudo que não é letra ou
 * dígito. É o que faz a comparação enxergar o conteúdo e não a diagramação —
 * o pdf.js entrega as ligaduras quebradas ("arti fi cial", "Kirchho ff") e a
 * pontuação de lista que a transcrição não reproduz.
 */
function norm(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

async function textoDasPaginas(
  arquivoOrigem: string,
  paginas: number[],
): Promise<string> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const dados = new Uint8Array(readFileSync(`public${caminhoPdf(arquivoOrigem)}`));
  const pdf = await getDocument({ data: dados, useSystemFonts: true }).promise;
  const partes: string[] = [];
  for (const p of paginas) {
    if (p < 1 || p > pdf.numPages) continue;
    const conteudo = await (await pdf.getPage(p)).getTextContent();
    partes.push(
      conteudo.items
        .map((i: unknown) => (i as { str?: string }).str ?? "")
        .join(" "),
    );
  }
  return partes.join(" ");
}

async function main() {
  // --- A transcrição bate com o Ato ---------------------------------------
  //
  // O ponto do arquivo inteiro. Se a Anatel republicar o Ato com outra
  // redação, é aqui que se descobre — em vez de o app seguir ensinando o
  // programa da prova do ano passado, calado.
  checar("a fonte da ementa é um PDF publicado", temPdf(FONTE_EMENTA.arquivo));
  const bruto = await textoDasPaginas(FONTE_EMENTA.arquivo, [
    FONTE_EMENTA.pagina,
    FONTE_EMENTA.pagina + 1,
  ]);
  const fonte = norm(bruto);

  checar(
    `o item 11.4 está na p. ${FONTE_EMENTA.pagina}`,
    fonte.includes(norm("O conteúdo programático dos testes de avaliação")),
  );

  for (const bloco of EMENTA) {
    checar(
      `[${bloco.titulo}] o cabeçalho está no Ato`,
      fonte.includes(norm(bloco.titulo)),
    );
    if (bloco.cumulativo) {
      checar(
        `[${bloco.titulo}] a frase de cumulatividade está no Ato`,
        fonte.includes(norm(bloco.cumulativo)),
        bloco.cumulativo,
      );
    }
    for (const t of bloco.topicos) {
      if (t.titulo !== null) {
        checar(
          `[${t.id}] o título está no Ato`,
          fonte.includes(norm(t.titulo)),
          t.titulo,
        );
      }
      checar(
        `[${t.id}] o texto está no Ato`,
        fonte.includes(norm(t.texto)),
        t.texto.slice(0, 60),
      );
    }
  }

  // --- Os endereços apontam para algo que existe --------------------------
  const todos = topicos();
  const ids = todos.map((t) => t.id);
  checar("os ids são únicos", new Set(ids).size === ids.length);
  checar(
    "os ids servem de slug de URL",
    ids.every((id) => /^[a-z0-9-]+$/.test(id)),
    ids.filter((id) => !/^[a-z0-9-]+$/.test(id)).join(", "),
  );

  for (const t of todos) {
    for (const ref of t.secoes) {
      checar(
        `[${t.id}] a seção existe`,
        secaoPorRef(ref) !== null,
        `${ref.arquivo} · ${ref.titulo}`,
      );
    }
  }

  // Rótulo de tópico com typo renderia zero questões, calado — e o tópico
  // pareceria descoberto pelo banco quando na verdade só está mal endereçado.
  const doBanco = new Set(
    BANCO.filter((q) => q.origem === "ementa" && q.topico).map((q) =>
      rotuloDoTopico(q.topico!),
    ),
  );
  for (const t of todos) {
    for (const rotulo of t.topicos) {
      checar(
        `[${t.id}] o tópico existe no banco`,
        doBanco.has(rotulo),
        rotulo,
      );
    }
  }

  // Cobertura reversa: regerar o banco não pode deixar assunto órfão, que
  // existiria nas questões e não apareceria em tópico nenhum da ementa.
  const enderecados = new Set(todos.flatMap((t) => t.topicos));
  for (const rotulo of doBanco) {
    checar(
      "o tópico do banco está endereçado na ementa",
      enderecados.has(rotulo),
      rotulo,
    );
  }

  // --- Tópico endereçado rende bateria ------------------------------------
  for (const t of todos) {
    if (t.secoes.length === 0 && t.topicos.length === 0) continue;
    checar(
      `[${t.id}] as referências rendem questões`,
      CLASSES.some((c) => questoesDoTopico(t, c).length > 0),
    );
    checar(
      `[${t.id}] as seções declaradas resolvem todas`,
      secoesDoTopico(t).length === t.secoes.length,
    );
  }

  // --- Classes ------------------------------------------------------------
  //
  // Eletrônica é cumulativa: um bloco na C, dois na B, três na A. Se um dia
  // um bloco perder a classe errada, a página some conteúdo sem avisar.
  for (const classe of CLASSES) {
    const blocos = blocosDaClasse(classe);
    const eletronica = blocos.filter((b) =>
      b.titulo.includes("ELETRÔNICA"),
    ).length;
    const esperado = { C: 1, B: 2, A: 3 }[classe];
    checar(
      `[${classe}] blocos de Eletrônica`,
      eletronica === esperado,
      `${eletronica}, esperado ${esperado}`,
    );
    checar(
      `[${classe}] Técnica e Legislação estão presentes`,
      blocos.length === eletronica + 2,
    );
  }

  // --- Leitura da query string --------------------------------------------
  const algum = todos[0];
  checar(
    "lerAssunto resolve um id válido",
    lerAssunto(`?assunto=${algum.id}`)?.id === algum.id,
  );
  checar("lerAssunto recusa id desconhecido", lerAssunto("?assunto=nada") === null);
  checar("lerAssunto recusa query vazia", lerAssunto("") === null);
  checar(
    "lerAssunto ignora o link de desafio",
    lerAssunto("?desafio=abc&t=legislacao&n=20&c=B") === null,
  );
  checar("topicoPorId recusa id desconhecido", topicoPorId("nada") === null);

  console.log(falhas === 0 ? "\nTudo certo." : `\n${falhas} falha(s).`);
  if (falhas > 0) process.exit(1);
}

void main();
