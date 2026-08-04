import { localizarPassagem } from "@/lib/trechos";
import { BANCO } from "@/lib/questoes";
import type { Trecho } from "@/lib/tipos";
import trechosJson from "../public/trechos.json";

const TRECHOS = trechosJson as Record<string, Trecho>;

let falhas = 0;
function checar(nome: string, ok: boolean, detalhe = "") {
  if (!ok) falhas++;
  console.log(`${ok ? "  ok  " : "FALHA "} ${nome}${detalhe ? " — " + detalhe : ""}`);
}

const comTrecho = BANCO.filter((q) => q.trecho_id);
const doDocumento = BANCO.filter((q) => q.origem === "documento");

// --- Integridade do vínculo questão -> trecho -----------------------------
{
  checar(
    "toda questão de documento tem trecho de origem",
    comTrecho.length === doDocumento.length,
    `${comTrecho.length} com trecho, ${doDocumento.length} de documento`,
  );

  // Questão da ementa não nasceu de um texto; apontar para um trecho seria
  // inventar uma origem que não existe.
  checar(
    "questão da ementa não aponta para trecho",
    BANCO.filter((q) => q.origem === "ementa").every((q) => !q.trecho_id),
  );

  checar(
    "todo trecho_id existe em trechos.json",
    comTrecho.every((q) => TRECHOS[q.trecho_id!] !== undefined),
  );

  const referenciados = new Set(comTrecho.map((q) => q.trecho_id));
  checar(
    "trechos.json não carrega trecho órfão",
    Object.keys(TRECHOS).every((k) => referenciados.has(k)),
    `${Object.keys(TRECHOS).length} trechos, ${referenciados.size} referenciados`,
  );

  // O trecho precisa ser o do mesmo arquivo e da mesma página que a questão
  // declara; divergir aqui exibiria um texto que não é a fonte.
  checar(
    "arquivo e página do trecho batem com os da questão",
    comTrecho.every((q) => {
      const t = TRECHOS[q.trecho_id!];
      return t.arquivo === q.arquivo_origem && t.pagina === q.pagina;
    }),
  );

  checar(
    "todo trecho tem texto",
    Object.values(TRECHOS).every((t) => t.texto.trim().length > 100),
  );
}

// --- Localização da passagem ----------------------------------------------
{
  const texto = [
    "Art. 5º A potência máxima autorizada na faixa de 60 metros é de",
    "25 W e.i.r.p., observada a proteção aos serviços primários.",
    "",
    "Art. 6º O indicativo de chamada deve ser transmitido ao início e ao",
    "final de cada comunicação.",
  ].join("\n");

  const p = localizarPassagem(
    texto,
    "Na faixa de 60 metros, a potência máxima autorizada é de 25 W e.i.r.p.",
  );
  checar("acha a passagem correspondente", p !== null);
  if (p) {
    const achado = texto.slice(p.inicio, p.fim);
    checar("a passagem contém o número decisivo", achado.includes("25 W"), achado.slice(0, 50));
    checar(
      "não devolve o trecho inteiro",
      p.fim - p.inicio < texto.length,
      `${p.fim - p.inicio} de ${texto.length} caracteres`,
    );
  }

  checar(
    "afirmação sem relação não é destacada",
    localizarPassagem(texto, "O multímetro mede resistência elétrica em ohms.") === null,
  );
  checar("texto vazio não quebra", localizarPassagem("", "qualquer coisa") === null);
  checar("afirmação vazia não quebra", localizarPassagem(texto, "") === null);
}

// --- Comportamento sobre o banco real -------------------------------------
{
  let comDestaque = 0;
  let foraDosLimites = 0;

  for (const q of comTrecho) {
    const t = TRECHOS[q.trecho_id!];
    const p = localizarPassagem(t.texto, q.afirmacao);
    if (!p) continue;
    comDestaque++;
    if (p.inicio < 0 || p.fim > t.texto.length || p.inicio >= p.fim) foraDosLimites++;
  }

  checar("nenhuma passagem cai fora do texto", foraDosLimites === 0);

  // O destaque é um atalho, não uma garantia: quando o casamento é fraco a
  // função devolve null e a interface mostra o trecho inteiro sem grifo. O que
  // não pode acontecer é o atalho quase nunca funcionar.
  const taxa = comDestaque / comTrecho.length;
  checar(
    "a maioria das questões recebe destaque",
    taxa > 0.6,
    `${comDestaque} de ${comTrecho.length} (${(taxa * 100).toFixed(0)}%)`,
  );
}

console.log(`\n${falhas === 0 ? "TODOS OS TESTES DE TRECHOS PASSARAM" : falhas + " FALHA(S)"}`);
process.exit(falhas === 0 ? 0 : 1);
