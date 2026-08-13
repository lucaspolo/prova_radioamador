import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BANCO } from "@/lib/questoes";
import { TEMAS } from "@/lib/constantes";
import type { Trecho } from "@/lib/tipos";

let falhas = 0;
function checar(nome: string, ok: boolean, detalhe = "") {
  if (!ok) falhas++;
  console.log(`${ok ? "  ok  " : "FALHA "} ${nome}${detalhe ? " — " + detalhe : ""}`);
}

const RAIZ = join(import.meta.dirname ?? __dirname, "..");

/**
 * O banco é publicado como dataset aberto, e a documentação dele é promessa a
 * terceiros: quem consome um dataset lê os números e acredita neles. Um total
 * defasado no README não é deselegância — é o consumidor calculando cobertura
 * de ementa em cima de uma base errada.
 *
 * Daí este teste: cada linha da tabela "Números" do README é conferida contra
 * o próprio banco. Regenerar o banco e esquecer o README derruba a suíte.
 */

const README = readFileSync(join(RAIZ, "README.md"), "utf-8");

/** A linha `| rótulo | 123 |` da tabela de números. */
function documentado(rotulo: string): number | null {
  const escapado = rotulo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`^\\|\\s*${escapado}\\s*\\|\\s*(\\d+)\\s*\\|`, "m").exec(
    README,
  );
  return m ? Number(m[1]) : null;
}

function conferir(rotulo: string, real: number) {
  const doc = documentado(rotulo);
  checar(
    `README: ${rotulo} = ${real}`,
    doc === real,
    doc === real
      ? ""
      : doc === null
        ? "linha não encontrada na tabela"
        : `o README diz ${doc}`,
  );
}

const trechos: Record<string, Trecho> = JSON.parse(
  readFileSync(join(RAIZ, "public", "trechos.json"), "utf-8"),
);

conferir("Afirmações", BANCO.length);
conferir(
  'De trecho literal (`origem: "documento"`)',
  BANCO.filter((q) => q.origem === "documento").length,
);
conferir(
  'Da ementa (`origem: "ementa"`)',
  BANCO.filter((q) => q.origem === "ementa").length,
);
conferir(
  'Exclusivas da Classe A (`nivel: "A"`)',
  BANCO.filter((q) => q.nivel === "A").length,
);
for (const tema of TEMAS) {
  conferir(tema, BANCO.filter((q) => q.tema === tema).length);
}
conferir("Trechos em `trechos.json`", Object.keys(trechos).length);
conferir("PDFs de origem", new Set(BANCO.map((q) => q.arquivo_origem)).size);

// --- O endpoint prometido existe de fato -----------------------------------
// A garantia é a regra do Next: o conteúdo de public/ vai inteiro para o
// export. Quando o build já rodou — é a ordem do CI, e pdfs.test.ts depende do
// mesmo —, confere-se o resultado em vez da regra.
for (const arquivo of ["banco_questoes.json", "trechos.json"]) {
  checar(
    `public/${arquivo} existe (é o que vira endpoint)`,
    existsSync(join(RAIZ, "public", arquivo)),
  );
  const exportado = join(RAIZ, "out", arquivo);
  if (existsSync(join(RAIZ, "out"))) {
    checar(`out/${arquivo} publicado pelo export`, existsSync(exportado));
  } else {
    console.log(`  --   out/ ausente: pule o build para conferir ${arquivo}`);
  }
}

// A URL citada no README é a do deploy; se ela mudar, a documentação do
// dataset passa a mandar gente para lugar nenhum.
checar(
  "README aponta o endpoint público",
  README.includes("https://prova-radioamador.vercel.app/banco_questoes.json"),
);
// A licença do dado é a única cessão de direitos do repositório fora do
// LICENSE — sumir com ela em silêncio é o pior desfecho possível.
checar("README declara a licença do dado", README.includes("CC BY 4.0"));

console.log(
  `\n${falhas === 0 ? "TODOS OS TESTES DE DATASET PASSARAM" : falhas + " FALHA(S)"}`,
);
process.exit(falhas === 0 ? 0 : 1);
