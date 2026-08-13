import {
  BARALHOS,
  TAMANHO_RODADA,
  baralho,
  sortearRodada,
  type Carta,
} from "@/lib/drill";
import { TABELAS } from "@/lib/referencia";

let falhas = 0;
function checar(nome: string, ok: boolean, detalhe = "") {
  if (!ok) falhas++;
  console.log(`${ok ? "  ok  " : "FALHA "} ${nome}${detalhe ? " — " + detalhe : ""}`);
}

/**
 * A promessa do drill é a mesma das tabelas: nada escrito de memória. O que
 * este teste persegue é a pergunta plausível e inventada — a que ninguém
 * percebe, porque soa certa. Se `alvo` e `resposta` estão na linha que a carta
 * declara, a pergunta é a tabela; se não estão, é chute com cara de fonte.
 */

/** As células da linha de onde a carta diz ter vindo. */
function linhaDe(c: Carta): string[] | null {
  const [tabelaId, indice] = c.linha.split(":");
  const t = TABELAS.find((x) => x.id === tabelaId);
  return t?.linhas[Number(indice)]?.celulas ?? null;
}

const cartas = baralho();

// --- Sanidade do baralho ---------------------------------------------------
checar("o baralho tem cartas", cartas.length > 50, String(cartas.length));
const ids = cartas.map((c) => c.id);
checar("id único por carta", new Set(ids).size === ids.length);
checar(
  "toda carta declara um baralho conhecido",
  cartas.every((c) => BARALHOS.some((b) => b.id === c.baralho)),
);
checar(
  "todo baralho tem carta",
  BARALHOS.every((b) => cartas.some((c) => c.baralho === b.id)),
);

// --- Nada inventado: cada carta é uma linha da tabela -----------------------
const semLinha = cartas.filter((c) => linhaDe(c) === null);
checar(
  "toda carta aponta para uma linha existente",
  semLinha.length === 0,
  semLinha.slice(0, 3).map((c) => c.id).join("; "),
);

const forjadas = cartas.filter((c) => {
  const celulas = linhaDe(c);
  if (!celulas) return true;
  return !celulas.some((cel) => cel.includes(c.alvo)) ||
    !celulas.some((cel) => cel.includes(c.resposta));
});
checar(
  "alvo e resposta de cada carta saem da própria linha",
  forjadas.length === 0,
  forjadas.slice(0, 3).map((c) => `${c.id}: ${c.alvo} → ${c.resposta}`).join("; "),
);
checar(
  "o enunciado cita o alvo",
  cartas.every((c) => c.enunciado.includes(c.alvo)),
);
// A fonte tem de ser a da tabela: é o que o botão de consulta abre.
checar(
  "cada carta carrega a fonte da tabela de origem",
  cartas.every((c) => {
    const t = TABELAS.find((x) => x.id === c.linha.split(":")[0]);
    return !!t && c.fonte === t.fonte;
  }),
);

// As duas direções do fonético e do código Q existem, e a dos prefixos não —
// "qual a série de São Paulo?" teria duas respostas certas.
for (const [grupo, esperado] of [
  ["fonetico:palavra", 26],
  ["fonetico:letra", 26],
  ["codigo-q:uso", 11],
  ["codigo-q:codigo", 11],
  ["prefixos:uf", 28],
] as const) {
  checar(
    `grupo ${grupo} com ${esperado} cartas`,
    cartas.filter((c) => c.grupo === grupo).length === esperado,
    String(cartas.filter((c) => c.grupo === grupo).length),
  );
}

// --- A rodada --------------------------------------------------------------
// `rand` fixo: afirmação sobre sorteio só se prova com sorteio determinístico.
function randFixo(semente: number): () => number {
  let s = semente;
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

const rodada = sortearRodada([], TAMANHO_RODADA, randFixo(7));
checar(
  `a rodada tem ${TAMANHO_RODADA} perguntas`,
  rodada.length === TAMANHO_RODADA,
  String(rodada.length),
);
checar(
  "toda pergunta traz 4 alternativas distintas",
  rodada.every(
    (p) => p.alternativas.length === 4 && new Set(p.alternativas).size === 4,
  ),
);
checar(
  "a resposta certa está entre as alternativas",
  rodada.every((p) => p.alternativas.includes(p.carta.resposta)),
);
// O distrator também é literal: sai da mesma coluna, nunca de fora da tabela.
const respostasPorGrupo = new Map<string, Set<string>>();
for (const c of cartas) {
  const s = respostasPorGrupo.get(c.grupo) ?? new Set<string>();
  s.add(c.resposta);
  respostasPorGrupo.set(c.grupo, s);
}
checar(
  "todo distrator é resposta de outra carta do mesmo grupo",
  rodada.every((p) =>
    p.alternativas.every((a) => respostasPorGrupo.get(p.carta.grupo)?.has(a)),
  ),
);
const linhas = rodada.map((p) => p.carta.linha);
checar(
  "a rodada não repete a linha (nem a ida e a volta dela)",
  new Set(linhas).size === linhas.length,
);

// --- Filtro por baralho ----------------------------------------------------
const soPrefixos = sortearRodada(["prefixos"], 8, randFixo(3));
checar(
  "filtrar por baralho só traz aquele baralho",
  soPrefixos.length === 8 &&
    soPrefixos.every((p) => p.carta.baralho === "prefixos"),
);
const soQ = sortearRodada(["codigo-q"], 30, randFixo(5));
checar(
  "baralho pequeno devolve o que tem, sem repetir linha",
  soQ.length === 11 && new Set(soQ.map((p) => p.carta.linha)).size === 11,
  String(soQ.length),
);

// Sementes diferentes, rodadas diferentes: o drill não é sempre o mesmo.
const a = sortearRodada([], TAMANHO_RODADA, randFixo(11)).map((p) => p.carta.id);
const b = sortearRodada([], TAMANHO_RODADA, randFixo(29)).map((p) => p.carta.id);
checar("sementes diferentes dão rodadas diferentes", a.join() !== b.join());

console.log(
  `\n${falhas === 0 ? "TODOS OS TESTES DE DRILL PASSARAM" : falhas + " FALHA(S)"}`,
);
process.exit(falhas === 0 ? 0 : 1);
