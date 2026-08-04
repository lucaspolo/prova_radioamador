import { renderToStaticMarkup } from "react-dom/server";
import TelaInicio from "@/components/TelaInicio";
import TelaSimulado from "@/components/TelaSimulado";
import TelaResultado from "@/components/TelaResultado";
import { sortearSimulado } from "@/lib/questoes";
import type { Resposta } from "@/lib/tipos";

let falhas = 0;
function checar(nome: string, ok: boolean, detalhe = "") {
  if (!ok) falhas++;
  console.log(`${ok ? "  ok  " : "FALHA "} ${nome}${detalhe ? " — " + detalhe : ""}`);
}

// --- Tela inicial ---------------------------------------------------------
{
  const html = renderToStaticMarkup(<TelaInicio onIniciar={() => {}} />);
  checar("TelaInicio renderiza", html.length > 0);
  checar("mostra as 3 matérias + Todos", ["Todos os Temas", "Legislação", "Técnica e Ética", "Eletrônica"].every((s) => html.includes(s)));
  checar("marca a bateria de 20 como prova real", html.includes("prova real"));
  checar("cita o critério oficial 11 acertos", html.includes("11 acertos"));
  checar("botão inicia com 20 questões", html.includes("Iniciar simulado"));
}

// --- Tela de simulado -----------------------------------------------------
{
  const questoes = sortearSimulado("todos", 20);
  const html = renderToStaticMarkup(
    <TelaSimulado questoes={questoes} onConcluir={() => {}} onSair={() => {}} />,
  );
  checar("TelaSimulado renderiza", html.length > 0);
  checar("mostra posição na bateria", html.includes("Questão 1 de 20"));
  checar("oferece Verdadeiro e Falso", html.includes("Verdadeiro") && html.includes("Falso"));
  checar("exibe o enunciado da 1ª questão", html.includes(questoes[0].afirmacao.slice(0, 40)));
  checar(
    "não vaza a resposta antes de responder",
    !html.includes(questoes[0].explicacao_curta.slice(0, 40)),
  );
  checar("permite abandonar", html.includes("Abandonar simulado"));
}

// --- Tela de resultado ----------------------------------------------------
{
  const questoes = sortearSimulado("todos", 20);
  // 12 acertos de 20 = 60% -> aprovado pelo critério oficial (mínimo 11).
  const respostas: Resposta[] = questoes.map((q, i) => ({
    questao: q,
    respondeu: i < 12 ? q.resposta_correta : !q.resposta_correta,
    acertou: i < 12,
  }));
  const html = renderToStaticMarkup(
    <TelaResultado respostas={respostas} onReiniciar={() => {}} />,
  );
  checar("TelaResultado renderiza", html.length > 0);
  checar("placar 12/20", html.includes("12") && html.includes("/20"));
  checar("percentual 60%", html.includes("60%"));
  checar("veredito Aprovado com 12 de 20", html.includes("Aprovado") && !html.includes("Reprovado"));
  checar("lista os 8 erros para revisão", html.includes("Revisão dos erros (8)"));
  checar("mostra desempenho por matéria", html.includes("Desempenho por matéria"));

  // Reprovação: 10 de 20 fica abaixo do mínimo de 11.
  const reprova: Resposta[] = questoes.map((q, i) => ({
    questao: q,
    respondeu: i < 10 ? q.resposta_correta : !q.resposta_correta,
    acertou: i < 10,
  }));
  const html2 = renderToStaticMarkup(
    <TelaResultado respostas={reprova} onReiniciar={() => {}} />,
  );
  checar("10 de 20 reprova (mínimo é 11)", html2.includes("Reprovado"));

  // 11 de 20 é exatamente a nota de corte oficial.
  const corte: Resposta[] = questoes.map((q, i) => ({
    questao: q,
    respondeu: i < 11 ? q.resposta_correta : !q.resposta_correta,
    acertou: i < 11,
  }));
  const html3 = renderToStaticMarkup(
    <TelaResultado respostas={corte} onReiniciar={() => {}} />,
  );
  checar("11 de 20 aprova (nota de corte exata)", html3.includes("Aprovado") && !html3.includes("Reprovado"));
}

console.log(`\n${falhas === 0 ? "TODOS OS TESTES DE RENDER PASSARAM" : falhas + " FALHA(S)"}`);
process.exit(falhas === 0 ? 0 : 1);
