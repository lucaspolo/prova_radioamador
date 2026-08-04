import { renderToStaticMarkup } from "react-dom/server";
import TelaInicio from "@/components/TelaInicio";
import TelaSimulado from "@/components/TelaSimulado";
import TelaResultado from "@/components/TelaResultado";
import Dashboard from "@/components/Dashboard";
import { sortearSimulado, BANCO } from "@/lib/questoes";
import { VERSAO_HISTORICO, montarRegistro, type Historico } from "@/lib/historico";
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

// --- Rótulo de procedência ------------------------------------------------
// 207 das 604 questões vieram da ementa, não de um trecho. Chamar a página de
// "Fonte" nesses casos mandaria o leitor procurar no PDF uma frase que não
// está lá — e duvidar do banco inteiro ao não encontrá-la.
{
  const daEmenta = BANCO.find((q) => q.origem === "ementa")!;
  const doDocumento = BANCO.find((q) => q.origem === "documento")!;

  const render = (q: typeof daEmenta) => {
    const html = renderToStaticMarkup(
      <TelaResultado
        respostas={[{ questao: q, respondeu: !q.resposta_correta, acertou: false }]}
        onReiniciar={() => {}}
      />,
    );
    return html;
  };

  const hE = render(daEmenta);
  checar("questão da ementa não é rotulada como Fonte", !hE.includes("Fonte:"));
  checar("questão da ementa convida a estudar o tema", hE.includes("Estude o tema em:"));

  const hD = render(doDocumento);
  checar("questão extraída do documento é rotulada como Fonte", hD.includes("Fonte:"));
  checar("questão do documento não usa o rótulo de tema", !hD.includes("Estude o tema em:"));
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

// --- Dashboard ------------------------------------------------------------
{
  type H = Historico;
  const vazio: H = { versao: VERSAO_HISTORICO, simulados: [] };

  // Antes de ler o storage não pode renderizar nada, senão quem já tem
  // histórico vê "nenhum simulado" piscar a cada carregamento.
  const naoCarregado = renderToStaticMarkup(
    <Dashboard historico={vazio} carregado={false} onLimpar={() => {}} />,
  );
  checar("Dashboard não renderiza antes de ler o storage", naoCarregado === "");

  const semDados = renderToStaticMarkup(
    <Dashboard historico={vazio} carregado onLimpar={() => {}} />,
  );
  checar("histórico vazio mostra convite ao primeiro simulado", semDados.includes("primeiro simulado"));

  // Um simulado só de Eletrônica com 6 de 20 (30%) fica abaixo do corte.
  const fraco = sortearSimulado("Conhecimentos de Eletrônica e Eletricidade", 20);
  const h: H = {
    versao: VERSAO_HISTORICO,
    simulados: [
      montarRegistro(
        "Conhecimentos de Eletrônica e Eletricidade",
        fraco.map((q, i) => ({ questao: q, respondeu: q.resposta_correta, acertou: i < 6 })),
      ),
    ],
  };
  const comDados = renderToStaticMarkup(
    <Dashboard historico={h} carregado onLimpar={() => {}} />,
  );
  checar("mostra o percentual da matéria (6/20 = 30%)", comDados.includes("30%"));
  checar("cita a linha de corte de 55%", comDados.includes("55%"));
  checar("alerta a matéria abaixo do corte", comDados.includes("Abaixo da linha de corte"));
  checar("aponta Eletrônica como a matéria fraca", comDados.includes("<strong>Eletrônica</strong>"));
  checar("matérias sem dados aparecem como tal", comDados.includes("sem dados"));
  checar("oferece limpar histórico", comDados.includes("Limpar histórico"));

  // Acima do corte, sem alerta.
  const forte = sortearSimulado("Legislação de Telecomunicações", 20);
  const h2: H = {
    versao: VERSAO_HISTORICO,
    simulados: [
      montarRegistro(
        "Legislação de Telecomunicações",
        forte.map((q, i) => ({ questao: q, respondeu: q.resposta_correta, acertou: i < 18 })),
      ),
    ],
  };
  const bom = renderToStaticMarkup(<Dashboard historico={h2} carregado onLimpar={() => {}} />);
  checar("90% não dispara alerta de matéria fraca", bom.includes("90%") && !bom.includes("Abaixo da linha de corte"));
}

console.log(`\n${falhas === 0 ? "TODOS OS TESTES DE RENDER PASSARAM" : falhas + " FALHA(S)"}`);
process.exit(falhas === 0 ? 0 : 1);
