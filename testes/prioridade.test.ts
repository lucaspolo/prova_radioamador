import {
  amostrarPonderado,
  desempenhoPorQuestao,
  peso,
  type Desempenho,
} from "@/lib/prioridade";
import { VERSAO_HISTORICO, type Historico, type SimuladoSalvo } from "@/lib/historico";
import { sortearSimulado, acervo } from "@/lib/questoes";
import type { Tema } from "@/lib/tipos";

let falhas = 0;
function checar(nome: string, ok: boolean, detalhe = "") {
  if (!ok) falhas++;
  console.log(`${ok ? "  ok  " : "FALHA "} ${nome}${detalhe ? " — " + detalhe : ""}`);
}

const TEMA: Tema = "Conhecimentos de Eletrônica e Eletricidade";
// O acervo da classe padrão (B), que é o que `sortearSimulado` sorteia sem
// classe explícita — o acréscimo técnico da Classe A fica de fora.
const doTema = acervo("B").filter((q) => q.tema === TEMA);

/** Média de quantas questões de `alvo` aparecem numa bateria de 20. */
function mediaDe(h: Historico, alvo: string[], rodadas = 400): number {
  const conjunto = new Set(alvo);
  let soma = 0;
  for (let i = 0; i < rodadas; i++) {
    soma += sortearSimulado(TEMA, 20, h).filter((q) => conjunto.has(q.id)).length;
  }
  return soma / rodadas;
}

/** Monta um histórico em que `erradas` foram erradas e `certas` acertadas. */
function historicoCom(
  rodadas: { erradas: string[]; certas: string[] }[],
): Historico {
  const simulados: SimuladoSalvo[] = rodadas.map((r, i) => ({
    id: `sim-${i}`,
    data: new Date(2026, 0, i + 1).toISOString(),
    escolha: TEMA,
    total: r.erradas.length + r.certas.length,
    acertos: r.certas.length,
    itens: [
      ...r.erradas.map((id) => ({ questaoId: id, tema: TEMA, acertou: false })),
      ...r.certas.map((id) => ({ questaoId: id, tema: TEMA, acertou: true })),
    ],
  }));
  // O histórico é guardado do mais recente para o mais antigo.
  return { versao: VERSAO_HISTORICO, simulados: simulados.reverse() };
}

// --- Escala de pesos ------------------------------------------------------
{
  const nunca = peso(undefined);
  const errouAgora = peso({ vistas: 1, erros: 1, errouNaUltima: true, simuladosAtras: 5 });
  const acertouUma = peso({ vistas: 1, erros: 0, errouNaUltima: false, simuladosAtras: 5 });
  const dominada = peso({ vistas: 4, erros: 0, errouNaUltima: false, simuladosAtras: 5 });

  checar("errada pesa mais que inédita", errouAgora > nunca, `${errouAgora} > ${nunca}`);
  checar("inédita pesa mais que já acertada", nunca > acertouUma, `${nunca} > ${acertouUma}`);
  checar("dominada é a de menor peso", dominada < acertouUma, `${dominada} < ${acertouUma}`);
  checar("nenhum peso é zero ou negativo", [nunca, errouAgora, acertouUma, dominada].every((p) => p > 0));

  const recem = peso({ vistas: 1, erros: 1, errouNaUltima: true, simuladosAtras: 0 });
  checar("questão recém-vista é despriorizada, mesmo errada", recem < errouAgora, `${recem} < ${errouAgora}`);
}

// --- Resumo do histórico --------------------------------------------------
{
  const [a, b, c] = doTema.slice(0, 3).map((q) => q.id);
  // Ordem cronológica: primeiro errou a, depois acertou a e errou b.
  const h = historicoCom([
    { erradas: [a], certas: [c] },
    { erradas: [b], certas: [a] },
  ]);
  const d = desempenhoPorQuestao(h);

  checar("conta as aparições", d.get(a)!.vistas === 2, String(d.get(a)?.vistas));
  checar("conta os erros", d.get(a)!.erros === 1, String(d.get(a)?.erros));
  checar("usa a resposta mais recente para errouNaUltima", d.get(a)!.errouNaUltima === false);
  checar("marca quem errou por último", d.get(b)!.errouNaUltima === true);
  checar("distância em simulados do mais recente é 0", d.get(b)!.simuladosAtras === 0);
  checar("questão nunca vista não entra no mapa", d.get(doTema[50].id) === undefined);
}

// --- Regime inicial: quase tudo inédito -----------------------------------
{
  // 10 erradas há alguns simulados; as outras 143 do tema, intocadas.
  const erradas = doTema.slice(0, 10).map((q) => q.id);
  const h = historicoCom([
    { erradas, certas: [] },
    { erradas: [], certas: [] },
    { erradas: [], certas: [] },
  ]);

  const media = mediaDe(h, erradas);
  const uniforme = (20 * erradas.length) / doTema.length;
  checar(
    "no início, erradas já vêm acima do acaso",
    media > uniforme * 1.5,
    `média ${media.toFixed(1)} vs ${uniforme.toFixed(1)} uniforme`,
  );
  // Enquanto a maior parte do banco é inédita, cobrir conteúdo novo importa
  // tanto quanto revisar erro: é correto que as erradas não dominem ainda.
  checar(
    "mas conteúdo inédito ainda tem espaço",
    media < 6,
    `média ${media.toFixed(1)} de 20`,
  );
}

// --- Regime de estudo continuado: o banco já foi todo visto ---------------
// É aqui que mora o problema que a ponderação resolve. Com tudo já visto, o
// sorteio uniforme repetiria as mesmas questões e o acerto viraria memória do
// enunciado. Nesse ponto o erro precisa dominar de verdade.
{
  const todas = doTema.map((q) => q.id);
  const erradas = todas.slice(0, 10);
  const acertadas = todas.slice(10);
  const h = historicoCom([
    { erradas: [], certas: acertadas.slice(0, 70) },
    { erradas: [], certas: acertadas.slice(70) },
    { erradas, certas: [] },
    { erradas: [], certas: [] },
  ]);

  const media = mediaDe(h, erradas);
  const uniforme = (20 * erradas.length) / doTema.length;
  // Alvo: as erradas ocupam pelo menos um quarto da bateria, várias vezes
  // acima do acaso. Forte o bastante para mudar o estudo, sem estreitar a
  // bateria a um treino nas mesmas dez questões.
  checar(
    "com o banco coberto, erradas ocupam ~1/4 da bateria",
    media >= 4 && media > uniforme * 3,
    `média ${media.toFixed(1)} de 20 (${(media / uniforme).toFixed(1)}× o acaso)`,
  );
  checar(
    "sem virar só as mesmas 10 questões",
    media < 12,
    `média ${media.toFixed(1)} de 20`,
  );
}

// --- Questões dominadas rareiam -------------------------------------------
{
  const dominadas = doTema.slice(0, 15).map((q) => q.id);
  const h = historicoCom([
    { erradas: [], certas: dominadas },
    { erradas: [], certas: dominadas },
    { erradas: [], certas: dominadas },
    { erradas: [], certas: [] },
  ]);

  let soma = 0;
  const RODADAS = 300;
  for (let i = 0; i < RODADAS; i++) {
    soma += sortearSimulado(TEMA, 20, h).filter((q) => dominadas.includes(q.id)).length;
  }
  const media = soma / RODADAS;
  const uniforme = (20 * dominadas.length) / doTema.length;
  checar(
    "questões sempre acertadas aparecem menos que no acaso",
    media < uniforme,
    `média ${media.toFixed(2)} vs ${uniforme.toFixed(2)} uniforme`,
  );
}

// --- Não vira circuito fechado: o banco continua sendo coberto ------------
{
  const erradas = doTema.slice(0, 10).map((q) => q.id);
  const h = historicoCom([{ erradas, certas: [] }, { erradas: [], certas: [] }]);
  const vistas = new Set<string>();
  for (let i = 0; i < 40; i++) {
    for (const q of sortearSimulado(TEMA, 20, h)) vistas.add(q.id);
  }
  checar(
    "40 baterias ainda cobrem a maior parte do banco do tema",
    vistas.size > doTema.length * 0.9,
    `${vistas.size} de ${doTema.length} questões distintas`,
  );
}

// --- Garantias que já valiam continuam valendo ----------------------------
{
  const h = historicoCom([{ erradas: doTema.slice(0, 5).map((q) => q.id), certas: [] }]);

  const s = sortearSimulado(TEMA, 60, h);
  checar("com histórico, ainda sorteia a quantidade exata", s.length === 60);
  checar("sem repetição", new Set(s.map((q) => q.id)).size === 60);
  checar("com histórico, a bateria continua homogênea", s.every((q) => q.tema === TEMA));

  const tudo = sortearSimulado(TEMA, 99999, h);
  checar("pedir além do disponível devolve tudo, sem repetir", tudo.length === doTema.length && new Set(tudo.map((q) => q.id)).size === doTema.length);
}

// --- Sem histórico, comportamento antigo ----------------------------------
{
  const vazio: Historico = { versao: VERSAO_HISTORICO, simulados: [] };
  const s = sortearSimulado(TEMA, 20, vazio);
  checar("histórico vazio: sorteia normalmente", s.length === 20 && s.every((q) => q.tema === TEMA));
  const semArg = sortearSimulado(TEMA, 20);
  checar("sem passar histórico: sorteia normalmente", semArg.length === 20);
}

// --- amostrarPonderado é sempre sem reposição -----------------------------
{
  const itens = Array.from({ length: 50 }, (_, i) => i);
  for (let i = 0; i < 100; i++) {
    const amostra = amostrarPonderado(itens, (n) => (n < 5 ? 100 : 1), 20);
    if (amostra.length !== 20 || new Set(amostra).size !== 20) {
      checar("amostra ponderada nunca repete", false, `iteração ${i}`);
      break;
    }
    if (i === 99) checar("amostra ponderada nunca repete em 100 sorteios", true);
  }

  // Peso extremo não pode quebrar o tamanho pedido.
  const zerado = amostrarPonderado(itens, () => 0, 10);
  checar("peso zero ainda devolve a quantidade pedida", zerado.length === 10);
}

console.log(`\n${falhas === 0 ? "TODOS OS TESTES DE PRIORIDADE PASSARAM" : falhas + " FALHA(S)"}`);
process.exit(falhas === 0 ? 0 : 1);

// Silencia o aviso de import não usado quando o tipo só serve de documentação.
export type { Desempenho };
