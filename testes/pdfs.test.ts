import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { caminhoPdf, temPdf, TAMANHO_MATERIAL_MB } from "@/lib/pdfs";
import { BANCO } from "@/lib/questoes";
import mapa from "@/lib/mapa-pdfs.json";
import { RESUMO_ARQUIVO, ROTULO_ARQUIVO } from "@/lib/secoes";

const RAIZ = join(import.meta.dirname ?? __dirname, "..");

let falhas = 0;
function checar(nome: string, ok: boolean, detalhe = "") {
  if (!ok) falhas++;
  console.log(`${ok ? "  ok  " : "FALHA "} ${nome}${detalhe ? " — " + detalhe : ""}`);
}

// --- Todo arquivo_origem do banco tem PDF publicado -----------------------
{
  const origens = [...new Set(BANCO.map((q) => q.arquivo_origem))].sort();
  console.log(`Arquivos referenciados pelo banco: ${origens.length}\n`);

  const semPdf = origens.filter((o) => !temPdf(o));
  checar(
    "todo arquivo_origem resolve para um PDF publicado",
    semPdf.length === 0,
    semPdf.join("; "),
  );

  // O caminho precisa existir em disco, não só no mapa.
  const inexistentes = origens
    .map((o) => ({ origem: o, caminho: caminhoPdf(o) }))
    .filter(({ caminho }) => !caminho || !existsSync(join(RAIZ, "public", caminho)));
  checar(
    "todo PDF referenciado existe em public/pdfs/",
    inexistentes.length === 0,
    inexistentes.map((x) => x.origem).join("; "),
  );

  // Um PDF vazio ou truncado abriria como erro no visualizador.
  const vazios = origens
    .map((o) => caminhoPdf(o)!)
    .filter((c) => statSync(join(RAIZ, "public", c)).size < 10_000);
  checar("nenhum PDF publicado está vazio ou truncado", vazios.length === 0, vazios.join("; "));
}

// --- O tamanho anunciado bate com o material publicado --------------------
{
  // `MaterialOffline` avisa quantos MB o pré-download custa, e esse número é
  // escrito à mão — o navegador não sabe o tamanho antes de baixar. Trocar um
  // PDF sem atualizá-lo faria o app prometer 6 MB e consumir 20 da franquia de
  // quem estuda no celular.
  const bytes = Object.values(mapa as Record<string, string>)
    .map((alvo) => join(RAIZ, "public", "pdfs", alvo))
    .filter((c) => existsSync(c))
    .reduce((s, c) => s + statSync(c).size, 0);
  const real = bytes / 1048576;
  checar(
    "TAMANHO_MATERIAL_MB acompanha os PDFs publicados",
    Math.abs(real - TAMANHO_MATERIAL_MB) < 0.5,
    `declarado ${TAMANHO_MATERIAL_MB} MB, real ${real.toFixed(2)} MB em ${Object.keys(mapa).length} arquivos`,
  );
}

// --- Todo PDF publicado se apresenta na lista de material -----------------
{
  // `npm run pdfs` publica o que estiver no diretório de origem, e a lista de
  // "Material oficial" mostra todos. Sem rótulo, a linha exibe o nome cru do
  // arquivo ("SEI_ANATEL - 15307586 - Ato_orginal.pdf"); sem resumo, o
  // candidato não tem como saber qual dos doze abrir.
  const semRotulo = Object.keys(mapa).filter((a) => !ROTULO_ARQUIVO[a]);
  const semResumo = Object.keys(mapa).filter((a) => !RESUMO_ARQUIVO[a]);
  checar("todo PDF publicado tem rótulo", semRotulo.length === 0, semRotulo.join("; "));
  checar("todo PDF publicado tem resumo", semResumo.length === 0, semResumo.join("; "));
}

// --- Nomes seguros para URL ----------------------------------------------
{
  const alvos = Object.values(mapa as Record<string, string>);
  const inseguros = alvos.filter((n) => !/^[a-z0-9-]+\.pdf$/.test(n));
  checar(
    "nomes publicados são seguros em URL (sem espaço, acento ou maiúscula)",
    inseguros.length === 0,
    inseguros.join("; "),
  );

  checar(
    "não há colisão de nomes publicados",
    new Set(alvos).size === alvos.length,
  );
}

// --- Comportamento com arquivo desconhecido -------------------------------
{
  checar("arquivo desconhecido devolve null", caminhoPdf("nao-existe.pdf") === null);
  checar("temPdf é false para desconhecido", temPdf("nao-existe.pdf") === false);
}

// --- O worker do pdf.js foi publicado ------------------------------------
{
  const worker = join(RAIZ, "public", "pdf.worker.min.mjs");
  checar("worker do pdf.js está em public/", existsSync(worker));
  if (existsSync(worker)) {
    checar("worker não está vazio", statSync(worker).size > 100_000);
  }
}

// --- As páginas apontadas existem dentro do PDF --------------------------
{
  // Confere o maior número de página citado por PDF contra a contagem real,
  // lendo o /Count do catálogo. Uma página inexistente abriria o modal em
  // branco.
  const porArquivo = new Map<string, number>();
  for (const q of BANCO) {
    porArquivo.set(
      q.arquivo_origem,
      Math.max(porArquivo.get(q.arquivo_origem) ?? 0, q.pagina),
    );
  }

  const problemas: string[] = [];
  for (const [origem, maxPagina] of porArquivo) {
    const caminho = caminhoPdf(origem);
    if (!caminho) continue;
    const bytes = readFileSync(join(RAIZ, "public", caminho));
    const texto = bytes.toString("latin1");
    const contagens = [...texto.matchAll(/\/Type\s*\/Pages[\s\S]{0,200}?\/Count\s+(\d+)/g)].map(
      (m) => Number(m[1]),
    );
    const total = contagens.length > 0 ? Math.max(...contagens) : 0;
    if (total > 0 && maxPagina > total) {
      problemas.push(`${origem}: cita p.${maxPagina} mas tem ${total}`);
    }
  }
  checar(
    "nenhuma questão aponta para página além do fim do PDF",
    problemas.length === 0,
    problemas.join("; "),
  );
}

console.log(`\n${falhas === 0 ? "TODOS OS TESTES DE PDF PASSARAM" : falhas + " FALHA(S)"}`);
process.exit(falhas === 0 ? 0 : 1);
