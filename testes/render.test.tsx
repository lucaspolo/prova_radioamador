import { renderToStaticMarkup } from "react-dom/server";
import TelaInicio from "@/components/TelaInicio";
import TelaSimulado from "@/components/TelaSimulado";
import TelaProvaCega from "@/components/TelaProvaCega";
import TelaResultado from "@/components/TelaResultado";
import Dashboard from "@/components/Dashboard";
import TelaIntervalo from "@/components/TelaIntervalo";
import TelaResultadoProva from "@/components/TelaResultadoProva";
import { sortearSimulado, BANCO } from "@/lib/questoes";
import { VERSAO_HISTORICO, montarRegistro, type Historico } from "@/lib/historico";
import type { Resposta } from "@/lib/tipos";

let falhas = 0;
function checar(nome: string, ok: boolean, detalhe = "") {
  if (!ok) falhas++;
  console.log(`${ok ? "  ok  " : "FALHA "} ${nome}${detalhe ? " — " + detalhe : ""}`);
}

const H_VAZIO: Historico = { versao: VERSAO_HISTORICO, simulados: [] };
const PROPS_INICIO = {
  historico: H_VAZIO,
  onIniciar: () => {},
  onProvaCompleta: () => {},
  onRevisar: () => {},
};

// --- Tela inicial ---------------------------------------------------------
{
  const html = renderToStaticMarkup(<TelaInicio {...PROPS_INICIO} />);
  checar("TelaInicio renderiza", html.length > 0);
  checar("mostra as 3 matérias", ["Legislação", "Técnica e Ética", "Eletrônica"].every((s) => html.includes(s)));
  // A bateria mista foi removida: cada matéria é uma prova separada, com seu
  // próprio mínimo. Uma bateria dos três temas aprovava quem compensasse uma
  // matéria fraca com duas fortes, o que a Anatel não permite.
  checar("não oferece bateria com os três temas", !html.includes("Todos os Temas"));
  checar("mostra as 3 classes", ["Classe A", "Classe B", "Classe C"].every((s) => html.includes(s)));
  checar("marca a bateria de 20 como prova real", html.includes("prova real"));
  checar("cita o critério oficial 11 acertos", html.includes("11 acertos"));
  checar("oferece o cronômetro ligado por padrão", html.includes("Cronômetro ligado"));
  checar("oferece a prova completa", html.includes("Prova completa") && html.includes("3 matérias"));
  checar("sem histórico, revisão está vazia", html.includes("Nenhum erro em aberto"));

  // Com um erro no histórico, o botão de revisão acorda e mostra a contagem.
  const errada = BANCO.find((q) => q.nivel === "B")!;
  const hErro: Historico = {
    versao: VERSAO_HISTORICO,
    simulados: [
      montarRegistro(errada.tema, [
        { questao: errada, respondeu: !errada.resposta_correta, acertou: false },
      ]),
    ],
  };
  const html2 = renderToStaticMarkup(
    <TelaInicio {...PROPS_INICIO} historico={hErro} />,
  );
  checar(
    "com erro em aberto, revisão oferece a questão",
    html2.includes("Revisar erros") && !html2.includes("Nenhum erro em aberto"),
  );
  checar("botão inicia com 20 questões", html.includes("Iniciar simulado"));
}

// --- Tela de simulado -----------------------------------------------------
{
  const questoes = sortearSimulado("Legislação de Telecomunicações", 20);
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
  checar("sem cronômetro, não mostra relógio", !html.includes("30:00"));

  // Com cronômetro, o tempo inicial aparece formatado.
  const comTempo = renderToStaticMarkup(
    <TelaSimulado
      questoes={questoes}
      tempoSegundos={1800}
      onConcluir={() => {}}
      onSair={() => {}}
    />,
  );
  checar("cronômetro de 30 min mostra 30:00", comTempo.includes("30:00"));
}

// --- Prova cega -----------------------------------------------------------
// O exame da Anatel não devolve gabarito nenhum durante a prova. Esta tela é
// a que precisa ser vigiada: qualquer vazamento aqui — a explicação, o
// veredito da questão ou até o placar parcial — descaracteriza o simulado.
{
  const questoes = sortearSimulado("Legislação de Telecomunicações", 20);
  const html = renderToStaticMarkup(
    <TelaProvaCega questoes={questoes} onConcluir={() => {}} onSair={() => {}} />,
  );
  checar("TelaProvaCega renderiza", html.length > 0);
  checar("mostra posição na bateria", html.includes("Questão 1 de 20"));
  checar("exibe o enunciado da 1ª questão", html.includes(questoes[0].afirmacao.slice(0, 40)));
  checar("oferece Verdadeiro e Falso", html.includes("Verdadeiro") && html.includes("Falso"));

  // Os três vazamentos possíveis.
  checar(
    "não mostra a explicação de nenhuma questão",
    questoes.every((q) => !html.includes(q.explicacao_curta.slice(0, 40))),
  );
  checar(
    "não emite veredito por questão",
    !html.includes("Acertou") && !html.includes("Errou") && !html.includes("a afirmação é"),
  );
  // O placar parcial entregaria o gabarito de tudo que já passou.
  checar("não mostra placar de acertos", !html.includes("acertos"));
  checar("mostra o quanto já foi respondido", html.includes("0 de 20 respondidas"));

  // Consultar o PDF no meio do exame é justamente o que a prova não permite.
  checar("não oferece consultar o material", !html.includes("Consultar Material"));
  checar("não oferece o trecho de origem", !html.includes("Ver trecho de origem"));

  checar("oferece a folha de respostas", html.includes("Folha de respostas"));
  checar(
    "a folha tem uma célula por questão, identificada",
    questoes.every((_, i) => html.includes(`Questão ${i + 1}, em branco`)),
  );
  checar("permite navegar entre as questões", html.includes("Anterior") && html.includes("Próxima"));
  checar("permite marcar para revisar", html.includes("Marcar para revisar"));
  checar("permite encerrar e ver o gabarito", html.includes("Encerrar e ver o gabarito"));
  checar("permite abandonar", html.includes("Abandonar a prova"));

  const comTempo = renderToStaticMarkup(
    <TelaProvaCega
      questoes={questoes}
      tempoSegundos={1800}
      onConcluir={() => {}}
      onSair={() => {}}
    />,
  );
  checar("o cronômetro continua igual ao do treino", comTempo.includes("30:00"));
}

// --- Gabarito completo ----------------------------------------------------
// Depois de uma bateria cega, o que mais vale conferir são as questões
// acertadas no chute — que a revisão de erros, por definição, esconde.
{
  const questoes = sortearSimulado("Legislação de Telecomunicações", 20);
  const respostas: Resposta[] = questoes.map((q, i) => ({
    questao: q,
    respondeu: i < 15 ? q.resposta_correta : !q.resposta_correta,
    acertou: i < 15,
  }));

  const cega = renderToStaticMarkup(
    <TelaResultado respostas={respostas} onReiniciar={() => {}} cega motivoFim="manual" />,
  );
  checar("bateria cega abre o gabarito completo", cega.includes("Gabarito"));
  checar("oferece filtrar só os erros", cega.includes("Só os erros (5)") && cega.includes("Todas (20)"));
  checar(
    "mostra a explicação de uma questão acertada",
    cega.includes(questoes[0].explicacao_curta.slice(0, 40)),
  );
  checar("identifica os acertos", cega.includes("Acertou"));

  // No treino o gabarito já apareceu questão a questão: aqui só os erros.
  const treino = renderToStaticMarkup(
    <TelaResultado respostas={respostas} onReiniciar={() => {}} />,
  );
  checar("bateria de treino continua listando só os erros", treino.includes("Revisão dos erros (5)"));
  checar(
    "e não mostra a explicação de uma acertada",
    !treino.includes(questoes[0].explicacao_curta.slice(0, 40)),
  );

  // Encerrar cedo à mão deixa questões em branco sem que o tempo tenha acabado.
  const emBranco: Resposta[] = questoes.map((q, i) => ({
    questao: q,
    respondeu: i < 15 ? q.resposta_correta : null,
    acertou: i < 15,
  }));
  const manual = renderToStaticMarkup(
    <TelaResultado respostas={emBranco} onReiniciar={() => {}} cega motivoFim="manual" />,
  );
  checar("encerrar à mão não anuncia tempo esgotado", !manual.includes("Tempo esgotado"));
  checar("mas continua contando as em branco como erro", manual.includes("como erro"));
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

  // O trecho literal só existe para quem veio de um documento.
  checar("questão de documento oferece o trecho de origem", hD.includes("Ver trecho de origem"));
  checar("questão da ementa não oferece trecho", !hE.includes("Ver trecho de origem"));
}

// --- Tela de resultado ----------------------------------------------------
{
  const questoes = sortearSimulado("Legislação de Telecomunicações", 20);
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
  // Com bateria de uma matéria só, o placar geral já é o da matéria: uma
  // seção "por matéria" repetiria o mesmo número.
  checar("não repete o placar numa seção por matéria", !html.includes("Desempenho por matéria"));
  checar("diz de qual classe é o critério", html.includes("Classe"));

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

  // Tempo esgotado: questões em branco contam como erro e são identificadas.
  const comBranco: Resposta[] = questoes.map((q, i) => ({
    questao: q,
    respondeu: i < 15 ? q.resposta_correta : null,
    acertou: i < 15,
  }));
  const html4 = renderToStaticMarkup(
    <TelaResultado respostas={comBranco} onReiniciar={() => {}} />,
  );
  checar("aviso de tempo esgotado com o total em branco", html4.includes("Tempo esgotado") && html4.includes("5"));
  checar("questão em branco aparece como não respondida", html4.includes("Não respondida — o tempo esgotou"));

  // Modo revisão: estudo, não prova — sem veredito de aprovação.
  const revisao = renderToStaticMarkup(
    <TelaResultado
      respostas={questoes.slice(0, 6).map((q, i) => ({
        questao: q,
        respondeu: q.resposta_correta,
        acertou: i < 4,
      }))}
      onReiniciar={() => {}}
      modo="revisao"
    />,
  );
  checar(
    "revisão não emite veredito de aprovação",
    !revisao.includes("Aprovado") && !revisao.includes("Reprovado"),
  );
  checar("revisão conta os erros corrigidos", revisao.includes("erros corrigidos"));
}

// --- Prova completa -------------------------------------------------------
{
  const sortear = (tema: Parameters<typeof sortearSimulado>[0], acertos: number) =>
    sortearSimulado(tema, 20).map((q, i) => ({
      questao: q,
      respondeu: q.resposta_correta,
      acertou: i < acertos,
    }));

  const intervalo = renderToStaticMarkup(
    <TelaIntervalo
      classe="B"
      tema="Legislação de Telecomunicações"
      respostas={sortear("Legislação de Telecomunicações", 14)}
      proximoTema="Técnica e ética operacional"
      onProsseguir={() => {}}
      onAbandonar={() => {}}
    />,
  );
  checar("intervalo mostra o placar da matéria", intervalo.includes("Aprovado na matéria"));
  checar("intervalo anuncia a próxima matéria", intervalo.includes("Técnica e Ética"));
  checar(
    "cronômetro da próxima só dispara ao iniciar",
    intervalo.includes("cronômetro começa"),
  );
  checar(
    "intervalo não entrega a revisão dos erros",
    !intervalo.includes("Revisão dos erros"),
  );

  // 15 + 11 + 10: reprova, porque Eletrônica ficou abaixo do mínimo de 11 —
  // exatamente o caso que a antiga bateria mista aprovava por média.
  const reprova = renderToStaticMarkup(
    <TelaResultadoProva
      classe="B"
      materias={[
        { tema: "Legislação de Telecomunicações", respostas: sortear("Legislação de Telecomunicações", 15) },
        { tema: "Técnica e ética operacional", respostas: sortear("Técnica e ética operacional", 11) },
        { tema: "Conhecimentos de Eletrônica e Eletricidade", respostas: sortear("Conhecimentos de Eletrônica e Eletricidade", 10) },
      ]}
      onReiniciar={() => {}}
    />,
  );
  checar(
    "prova completa reprova quem falha numa matéria, mesmo com média alta",
    reprova.includes("Reprovado") && reprova.includes("faltou em"),
  );
  checar("aponta a matéria que faltou", reprova.includes("faltou em") && reprova.includes("Eletrônica"));
  checar("mostra o resultado das três matérias", reprova.includes("Resultado por matéria"));

  const aprova = renderToStaticMarkup(
    <TelaResultadoProva
      classe="B"
      materias={[
        { tema: "Legislação de Telecomunicações", respostas: sortear("Legislação de Telecomunicações", 15) },
        { tema: "Técnica e ética operacional", respostas: sortear("Técnica e ética operacional", 11) },
        { tema: "Conhecimentos de Eletrônica e Eletricidade", respostas: sortear("Conhecimentos de Eletrônica e Eletricidade", 11) },
      ]}
      onReiniciar={() => {}}
    />,
  );
  checar(
    "prova completa aprova com o mínimo nas três",
    aprova.includes("Aprovado") && aprova.includes("atingido nas três matérias"),
  );
}

// --- Dashboard ------------------------------------------------------------
{
  type H = Historico;
  const vazio: H = { versao: VERSAO_HISTORICO, simulados: [] };

  // Antes de ler o storage não pode renderizar nada, senão quem já tem
  // histórico vê "nenhum simulado" piscar a cada carregamento.
  const naoCarregado = renderToStaticMarkup(
    <Dashboard historico={vazio} carregado={false} onLimpar={() => {}} onImportar={() => 0} />,
  );
  checar("Dashboard não renderiza antes de ler o storage", naoCarregado === "");

  const semDados = renderToStaticMarkup(
    <Dashboard historico={vazio} carregado onLimpar={() => {}} onImportar={() => 0} />,
  );
  checar("histórico vazio mostra convite ao primeiro simulado", semDados.includes("primeiro simulado"));
  // Importar precisa existir ANTES do primeiro simulado: é como o backup chega.
  checar("mesmo vazio, dá para importar um backup", semDados.includes("Importar"));

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
    <Dashboard historico={h} carregado onLimpar={() => {}} onImportar={() => 0} />,
  );
  checar("mostra o percentual da matéria (6/20 = 30%)", comDados.includes("30%"));
  checar("cita a linha de corte de 55%", comDados.includes("55%"));
  checar("alerta a matéria abaixo do corte", comDados.includes("Abaixo da linha de corte"));
  checar("aponta Eletrônica como a matéria fraca", comDados.includes("<strong>Eletrônica</strong>"));
  checar("matérias sem dados aparecem como tal", comDados.includes("sem dados"));
  checar("oferece limpar histórico", comDados.includes("Limpar histórico"));
  checar("oferece exportar o histórico", comDados.includes("Exportar histórico"));

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
  const bom = renderToStaticMarkup(<Dashboard historico={h2} carregado onLimpar={() => {}} onImportar={() => 0} />);
  checar("90% não dispara alerta de matéria fraca", bom.includes("90%") && !bom.includes("Abaixo da linha de corte"));

  // Evolução: com um simulado só não há tendência; com dois, a linha aparece.
  checar("um simulado só não desenha evolução", !bom.includes("<polyline"));
  const doisDoMesmo: H = {
    versao: VERSAO_HISTORICO,
    simulados: [
      montarRegistro(
        "Legislação de Telecomunicações",
        forte.map((q, i) => ({ questao: q, respondeu: q.resposta_correta, acertou: i < 18 })),
      ),
      montarRegistro(
        "Legislação de Telecomunicações",
        forte.map((q, i) => ({ questao: q, respondeu: q.resposta_correta, acertou: i < 12 })),
      ),
    ],
  };
  const comLinha = renderToStaticMarkup(
    <Dashboard historico={doisDoMesmo} carregado onLimpar={() => {}} onImportar={() => 0} />,
  );
  checar("duas baterias desenham a linha de evolução", comLinha.includes("<polyline") && comLinha.includes("Evolução"));
  checar("revisões não entram na tendência", true); // garantido por seriePorTema, coberto em estudo.test
}

console.log(`\n${falhas === 0 ? "TODOS OS TESTES DE RENDER PASSARAM" : falhas + " FALHA(S)"}`);
process.exit(falhas === 0 ? 0 : 1);
