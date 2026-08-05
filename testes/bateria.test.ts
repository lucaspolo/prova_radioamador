import {
  contarEmBranco,
  contarRespondidas,
  folhaVazia,
  proximaEmBranco,
  respostasDe,
  type Escolhas,
} from "@/lib/bateria";
import type { Questao } from "@/lib/tipos";

let falhas = 0;
function checar(nome: string, ok: boolean, detalhe = "") {
  if (!ok) falhas++;
  console.log(`${ok ? "  ok  " : "FALHA "} ${nome}${detalhe ? " — " + detalhe : ""}`);
}

function questao(id: string, correta: boolean): Questao {
  return {
    id,
    tema: "Legislação de Telecomunicações",
    arquivo_origem: "teste.pdf",
    afirmacao: `Afirmação ${id}`,
    resposta_correta: correta,
    explicacao_curta: "porque sim",
    pagina: 1,
    origem: "documento",
    nivel: "B",
  };
}

const questoes = [
  questao("q0", true),
  questao("q1", false),
  questao("q2", true),
  questao("q3", false),
];

// --- folhaVazia ------------------------------------------------------------
{
  const folha = folhaVazia(4);
  checar("folha nasce do tamanho da bateria", folha.length === 4);
  checar("folha nasce toda em branco", folha.every((e) => e === null));
  checar("bateria de zero questões não quebra", folhaVazia(0).length === 0);
}

// --- respostasDe: a conversão que alimenta resultado e histórico -----------
{
  // Respondeu fora de ordem, deixou a segunda em branco e errou a última.
  const escolhas: Escolhas = [true, null, true, true];
  const respostas = respostasDe(questoes, escolhas);

  checar("uma resposta por questão", respostas.length === questoes.length);
  checar(
    "a ordem das questões é preservada",
    respostas.map((r) => r.questao.id).join(",") === "q0,q1,q2,q3",
    respostas.map((r) => r.questao.id).join(","),
  );
  checar("acerto é reconhecido", respostas[0].acertou && respostas[0].respondeu === true);
  checar(
    "em branco vira não respondida e conta como erro",
    respostas[1].respondeu === null && respostas[1].acertou === false,
  );
  checar("erro é reconhecido", respostas[3].respondeu === true && !respostas[3].acertou);
  checar(
    "placar bate com as escolhas",
    respostas.filter((r) => r.acertou).length === 2,
    String(respostas.filter((r) => r.acertou).length),
  );

  // A folha inteira em branco é o pior caso do tempo esgotado: zero acertos,
  // nenhuma resposta perdida pelo caminho.
  const zerada = respostasDe(questoes, folhaVazia(questoes.length));
  checar(
    "folha em branco vira bateria completa sem acertos",
    zerada.length === 4 &&
      zerada.every((r) => r.respondeu === null && !r.acertou),
  );

  // Uma folha mais curta que a bateria (não deveria acontecer, mas não pode
  // derrubar o resultado no meio de uma prova).
  const curta = respostasDe(questoes, [true]);
  checar(
    "folha curta é completada com brancos",
    curta.length === 4 && curta[3].respondeu === null,
  );
}

// --- contagens -------------------------------------------------------------
{
  const escolhas: Escolhas = [true, null, false, null];
  checar("conta respondidas", contarRespondidas(escolhas) === 2);
  checar("conta em branco", contarEmBranco(escolhas) === 2);
  checar(
    "as duas contagens fecham o total",
    contarRespondidas(escolhas) + contarEmBranco(escolhas) === escolhas.length,
  );
  checar("false conta como respondida", contarRespondidas([false]) === 1);
}

// --- proximaEmBranco: o salto da folha de respostas ------------------------
{
  checar(
    "acha a próxima em branco à frente",
    proximaEmBranco([true, null, null, true], 0) === 1,
  );
  checar(
    "dá a volta no fim da folha",
    proximaEmBranco([null, true, true, true], 2) === 0,
  );
  checar(
    "folha cheia não tem para onde saltar",
    proximaEmBranco([true, false, true, false], 1) === null,
  );
  checar(
    "não salta para a questão em que já se está",
    proximaEmBranco([true, null, true, true], 1) === null,
  );
  checar("folha vazia devolve null", proximaEmBranco([], 0) === null);
}

console.log(`\n${falhas === 0 ? "TODOS OS TESTES DE BATERIA PASSARAM" : falhas + " FALHA(S)"}`);
process.exit(falhas === 0 ? 0 : 1);
