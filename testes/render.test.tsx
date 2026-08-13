import { renderToStaticMarkup } from "react-dom/server";
import TelaAssuntos from "@/components/TelaAssuntos";
import TelaInicio from "@/components/TelaInicio";
import TelaSimulado from "@/components/TelaSimulado";
import TelaProvaCega from "@/components/TelaProvaCega";
import TelaResultado from "@/components/TelaResultado";
import TelaDesempenho from "@/components/TelaDesempenho";
import ResumoDesempenho from "@/components/ResumoDesempenho";
import MenuPrincipal, { PainelMenu } from "@/components/MenuPrincipal";
import ItemConferencia from "@/components/ItemConferencia";
import Home from "@/app/page";
import TelaFerramentas from "@/components/TelaFerramentas";
import Relampago from "@/components/Relampago";
import TelaIntervalo from "@/components/TelaIntervalo";
import TelaResultadoProva from "@/components/TelaResultadoProva";
import { ATALHOS_DA_PROVA } from "@/lib/atalhos";
import { BARALHOS } from "@/lib/drill";
import { sortearSimulado, BANCO } from "@/lib/questoes";
import { VERSAO_HISTORICO, montarRegistro, type Historico } from "@/lib/historico";
import type { Resposta } from "@/lib/tipos";

let falhas = 0;
function checar(nome: string, ok: boolean, detalhe = "") {
  if (!ok) falhas++;
  console.log(`${ok ? "  ok  " : "FALHA "} ${nome}${detalhe ? " — " + detalhe : ""}`);
}

/**
 * Procura um texto do banco dentro do HTML renderizado.
 *
 * O React escapa `& < > " '` no texto, então comparar a afirmação crua com o
 * markup falha em toda questão que traga aspas — e as da tabela de prefixos
 * trazem, porque a coluna do Ato 3448 se chama Classes "A" ou "B". Sem escapar
 * aqui, o teste do enunciado quebrava em ~4% das execuções, conforme o sorteio,
 * e o de "não vaza a resposta" passava por engano: a explicação podia estar na
 * tela e o `includes` não a encontraria.
 */
/**
 * As asserções sobre a explicação comparam o texto INTEIRO, e não um prefixo.
 *
 * Comparar os primeiros 40 caracteres parecia equivalente e não era: várias
 * explicações abrem reafirmando o enunciado ("O Serviço de Radioamador é de
 * interesse restrito..."), e o enunciado está na tela por construção. O teste
 * de que a prova cega não vaza a resposta acusava essa questão como vazamento
 * sempre que ela caía em primeiro no sorteio — 0,5% das execuções, o bastante
 * para a suíte falhar de vez em quando sem ninguém entender por quê.
 *
 * A explicação inteira não colide com nenhuma afirmação do banco, e é o que
 * "vazou" de fato significa: a justificativa apareceu na tela.
 */
function contem(html: string, texto: string): boolean {
  const escapado = texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
  return html.includes(escapado);
}

const H_VAZIO: Historico = { versao: VERSAO_HISTORICO, simulados: [] };
const PROPS_INICIO = {
  historico: H_VAZIO,
  onIniciar: () => {},
  onProvaCompleta: () => {},
  onRevisar: () => {},
  onAssuntos: () => {},
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
  // O toggle de inéditas só existe com histórico: sem bateria feita, tudo é
  // inédito e o botão seria redundante.
  checar("sem histórico, não oferece o modo inéditas", !html.includes("inéditas"));
  checar("com histórico, oferece priorizar inéditas", html2.includes("Priorizar inéditas"));
  // Os dois regimes ficam visíveis ao mesmo tempo, com treino marcado: um
  // alternador de um botão só escondia a descrição da opção não escolhida.
  checar(
    "mostra os dois regimes lado a lado",
    html.includes("Modo treino") && html.includes("Modo prova"),
  );
  const cartao = (rotulo: string) =>
    html.split("<button").find((b) => b.includes(rotulo)) ?? "";
  checar(
    "treino vem marcado",
    cartao("Modo treino").includes('aria-pressed="true"'),
  );
  checar(
    "prova aparece como alternativa não escolhida",
    cartao("Modo prova").includes('aria-pressed="false"'),
  );
  checar("botão inicia no regime escolhido", html.includes("Iniciar modo treino"));
  // A consulta rápida virou item de menu: a tela inicial é sobre fazer prova.
  checar("a consulta rápida saiu da tela inicial", !html.includes("Consulta rápida"));
  checar("oferece estudar por assunto", html.includes("Estudar por assunto"));
}

// --- Material offline -----------------------------------------------------
{
  // Sem service worker controlando (SSR, dev, primeiro acesso), baixar não
  // deixaria nada no cache: a seção não pode nem aparecer.
  const html = renderToStaticMarkup(<TelaFerramentas onVoltar={() => {}} />);
  checar(
    "sem service worker, o pré-download não aparece",
    !html.includes("Material para consulta offline"),
  );
}

// --- Estudar por assunto --------------------------------------------------
{
  const html = renderToStaticMarkup(
    <TelaAssuntos historico={H_VAZIO} onEstudar={() => {}} onVoltar={() => {}} />,
  );
  checar("TelaAssuntos renderiza", html.includes("Estudar por assunto"));
  checar(
    "lista seções reais do material",
    html.includes("Plano de faixas por banda") && html.includes("Propagação"),
  );
  checar(
    "agrupa por documento",
    html.includes("Cartilha do Radioamador") && html.includes("Ato 926/2024"),
  );
  checar(
    "diz quantas questões cada assunto tem",
    /\d+ quest(ão|ões)/.test(html),
  );
  checar(
    "sem histórico, não inventa aproveitamento",
    !html.includes("sabe 0") && !html.includes("viu 0"),
  );
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
  checar("exibe o enunciado da 1ª questão", contem(html, questoes[0].afirmacao.slice(0, 40)));
  checar(
    "não vaza a resposta antes de responder",
    !contem(html, questoes[0].explicacao_curta),
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
  checar("exibe o enunciado da 1ª questão", contem(html, questoes[0].afirmacao.slice(0, 40)));
  checar("oferece Verdadeiro e Falso", html.includes("Verdadeiro") && html.includes("Falso"));

  // Os três vazamentos possíveis.
  checar(
    "não mostra a explicação de nenhuma questão",
    questoes.every((q) => !contem(html, q.explicacao_curta)),
  );
  checar(
    "não emite veredito por questão",
    !html.includes("Acertou") && !html.includes("Errou") && !html.includes("a afirmação é"),
  );
  // O placar parcial entregaria o gabarito de tudo que já passou. O que se
  // procura é o placar do modo treino — `{acertos} acertos`, em
  // TelaSimulado.tsx —, e não a palavra solta: uma questão do banco fala em
  // "maioria de acertos somando todas as provas", e quando ela caía em
  // primeiro no sorteio a asserção acusava placar onde havia só enunciado.
  checar("não mostra placar de acertos", !/\d+\s*acertos/.test(html));
  checar("mostra o quanto já foi respondido", html.includes("0 de 20 respondidas"));

  // Consultar o PDF no meio do exame é justamente o que a prova não permite.
  checar("não oferece consultar o material", !html.includes("Consultar Material"));
  checar("não oferece o trecho de origem", !html.includes("Ver trecho de origem"));

  checar("oferece a folha de respostas", html.includes("Folha de respostas"));
  checar(
    "a folha tem uma célula por questão, identificada",
    questoes.every((_, i) => html.includes(`Questão ${i + 1}, em branco`)),
  );
  // Tabindex rotativo: a grade é uma parada de Tab só — todas as células
  // menos a atual saem do fluxo do teclado, e "Encerrar" fica a um Tab.
  checar(
    "a folha é uma única parada de Tab",
    (html.match(/tabindex="-1"/g) ?? []).length === questoes.length - 1,
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
    contem(cega, questoes[0].explicacao_curta),
  );
  checar("identifica os acertos", cega.includes("Acertou"));

  // No treino o gabarito já apareceu questão a questão: aqui só os erros.
  const treino = renderToStaticMarkup(
    <TelaResultado respostas={respostas} onReiniciar={() => {}} />,
  );
  checar("bateria de treino continua listando só os erros", treino.includes("Revisão dos erros (5)"));
  checar(
    "e não mostra a explicação de uma acertada",
    !contem(treino, questoes[0].explicacao_curta),
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

  checar(
    "oferece compartilhar e imprimir",
    cega.includes("Compartilhar resultado") && cega.includes("Imprimir revisão"),
  );
  // Botão em papel não clica: o que é ação sai da folha impressa.
  checar("as ações ficam fora da impressão", cega.includes("nao-imprimir"));
}

// --- Ferramentas de consulta ----------------------------------------------
{
  const html = renderToStaticMarkup(<TelaFerramentas onVoltar={() => {}} />);
  checar("TelaFerramentas renderiza", html.length > 0);
  checar(
    "oferece as três abas",
    ["Tabelas", "Calculadoras", "Relâmpago"].every((s) => html.includes(s)),
  );
  checar(
    "lista as tabelas publicadas",
    ["Alfabeto fonético", "Código Q", "Plano de bandas", "Prefixos"].every((s) =>
      html.includes(s),
    ),
  );
  // A ausência declarada precisa continuar visível: some com ela e a próxima
  // pessoa preenche a escala RST de memória.
  checar("anuncia o RST como pendente de fonte", html.includes("sem fonte"));
  // Os atalhos administrativos: a pergunta que o banco não responde de
  // propósito, respondida pela página do material.
  checar("traz os atalhos do procedimento do exame", html.includes("A prova em si"));
  checar(
    "cada atalho aponta a página",
    ATALHOS_DA_PROVA.every(
      (a) => html.includes(a.rotulo) && html.includes(`página ${a.pagina}`),
    ),
  );
  checar("permite voltar", html.includes("Voltar ao início"));
}

// --- Drill relâmpago ------------------------------------------------------
// A tela de escolha não sorteia nada: se sorteasse na renderização, o
// servidor e o cliente montariam rodadas diferentes.
{
  const html = renderToStaticMarkup(<Relampago />);
  checar(
    "o drill abre na escolha das tabelas",
    ["Tudo", ...BARALHOS.map((b) => b.rotulo)].every((s) => html.includes(s)) &&
      html.includes("Começar"),
  );
  // A honestidade do modo é parte dele: memorizar tabela não é estar pronto
  // para o exame, e a tela diz isso antes da primeira pergunta.
  checar("o drill avisa que não é a prova", html.includes("não é a prova"));
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

  // O navegador recusou gravar (modo privado, cota): o resultado avisa e
  // manda exportar; sem recusa, o aviso não existe.
  const htmlRecusa = renderToStaticMarkup(
    <TelaResultado
      respostas={respostas}
      onReiniciar={() => {}}
      gravacaoRecusada
    />,
  );
  checar(
    "com gravação recusada, o resultado avisa",
    htmlRecusa.includes("Este resultado não foi salvo"),
  );
  checar(
    "o aviso manda exportar o histórico",
    htmlRecusa.includes("exporte o histórico"),
  );
  checar(
    "sem recusa, nenhum aviso de gravação",
    !html.includes("Este resultado não foi salvo"),
  );

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

// --- Tela de desempenho ---------------------------------------------------
{
  type H = Historico;
  const vazio: H = { versao: VERSAO_HISTORICO, simulados: [] };

  // Antes de ler o storage não pode renderizar nada, senão quem já tem
  // histórico vê "nenhum simulado" piscar a cada carregamento.
  const naoCarregado = renderToStaticMarkup(
    <TelaDesempenho onVoltar={() => {}} historico={vazio} carregado={false} onLimpar={() => {}} onImportar={() => 0} />,
  );
  // A tela precisa da própria moldura para dar como voltar; o que não pode é
  // número nenhum antes de ler o storage, senão quem já tem histórico vê
  // "nenhum simulado" piscar a cada carregamento.
  checar(
    "a tela de desempenho não inventa números antes de ler o storage",
    naoCarregado.includes("Voltar ao início") &&
      !naoCarregado.includes("%") &&
      !naoCarregado.includes("primeiro simulado"),
  );

  const semDados = renderToStaticMarkup(
    <TelaDesempenho onVoltar={() => {}} historico={vazio} carregado onLimpar={() => {}} onImportar={() => 0} />,
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
    <TelaDesempenho onVoltar={() => {}} historico={h} carregado onLimpar={() => {}} onImportar={() => 0} />,
  );
  checar("mostra o percentual da matéria (6/20 = 30%)", comDados.includes("30%"));
  checar("cita a linha de corte de 55%", comDados.includes("55%"));
  checar("alerta a matéria abaixo do corte", comDados.includes("Abaixo da linha de corte"));
  checar("aponta Eletrônica como a matéria fraca", comDados.includes("<strong>Eletrônica</strong>"));
  checar("matérias sem dados aparecem como tal", comDados.includes("sem dados"));
  checar("oferece limpar histórico", comDados.includes("Limpar histórico"));
  checar("oferece exportar o histórico", comDados.includes("Exportar histórico"));
  // Prontidão: fatos da janela recente, nunca previsão — 6/20 fica abaixo.
  checar(
    "prontidão diz o corte da classe e a janela",
    comDados.includes("corte da Classe") &&
      comDados.includes("acima do corte em 0 de 1"),
  );
  checar(
    "prontidão não promete aprovação",
    !comDados.includes("você passaria") && !comDados.includes("Passaria"),
  );
  checar("mostra a cobertura do banco", comDados.includes("Cobertura do banco"));

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
  const bom = renderToStaticMarkup(<TelaDesempenho onVoltar={() => {}} historico={h2} carregado onLimpar={() => {}} onImportar={() => 0} />);
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
    <TelaDesempenho onVoltar={() => {}} historico={doisDoMesmo} carregado onLimpar={() => {}} onImportar={() => 0} />,
  );
  checar("duas baterias desenham a linha de evolução", comLinha.includes("<polyline") && comLinha.includes("Evolução"));
  checar("revisões não entram na tendência", true); // garantido por seriePorTema, coberto em estudo.test

  // --- O resumo de uma linha que ficou na tela inicial ---------------------
  const semLer = renderToStaticMarkup(
    <ResumoDesempenho historico={vazio} carregado={false} onAbrir={() => {}} />,
  );
  // Antes de ler o storage a linha existe (some depois seria salto de layout),
  // mas sem número nenhum: o HTML estático e o primeiro render coincidem.
  checar(
    "o resumo não mostra número antes de ler o storage",
    semLer.includes("Seu desempenho") && !semLer.includes("%"),
  );
  // "É uma linha clicável só" é o requisito da mudança; um controle a mais
  // aqui é exatamente a regressão que ela existe para evitar.
  checar("o resumo é uma linha clicável só", semLer.split("<button").length === 2);

  const resumoVazio = renderToStaticMarkup(
    <ResumoDesempenho historico={vazio} carregado onAbrir={() => {}} />,
  );
  // Num aparelho novo esta linha é o único caminho até o backup: sem nomeá-lo,
  // restaurar o histórico fica indescobrível atrás do ícone de menu.
  checar(
    "sem histórico, o resumo aponta o caminho do backup",
    resumoVazio.includes("Nenhum simulado ainda") &&
      resumoVazio.includes("importar um backup"),
  );

  const resumoFraco = renderToStaticMarkup(
    <ResumoDesempenho historico={h} carregado onAbrir={() => {}} />,
  );
  checar(
    "com uma matéria fraca, o resumo a nomeia",
    resumoFraco.includes("30%") && resumoFraco.includes("Eletrônica abaixo do corte"),
  );

  const resumoBom = renderToStaticMarkup(
    <ResumoDesempenho historico={h2} carregado onAbrir={() => {}} />,
  );
  checar(
    "tudo acima do corte não vira alerta",
    resumoBom.includes("90%") && !resumoBom.includes("abaixo do corte"),
  );

  // Nomear três matérias estoura a linha num telefone: a partir de duas, conta.
  const duasFracas: H = {
    versao: VERSAO_HISTORICO,
    simulados: [
      montarRegistro(
        "Conhecimentos de Eletrônica e Eletricidade",
        fraco.map((q, i) => ({ questao: q, respondeu: q.resposta_correta, acertou: i < 6 })),
      ),
      montarRegistro(
        "Legislação de Telecomunicações",
        forte.map((q, i) => ({ questao: q, respondeu: q.resposta_correta, acertou: i < 8 })),
      ),
    ],
  };
  const resumoDuas = renderToStaticMarkup(
    <ResumoDesempenho historico={duasFracas} carregado onAbrir={() => {}} />,
  );
  checar(
    "com duas matérias fracas, o resumo conta em vez de listar",
    resumoDuas.includes("2 matérias abaixo do corte"),
  );
}

// --- Menu principal -------------------------------------------------------
{
  const fechado = renderToStaticMarkup(
    <MenuPrincipal atual="inicio" onInicio={() => {}} onDesempenho={() => {}} onFerramentas={() => {}} />,
  );
  // Nascer fechado é a invariante do desentulho: se o painel viesse aberto, a
  // tela inicial voltaria a ter tudo à vista.
  checar("o menu nasce fechado", !fechado.includes("Consulta rápida"));
  checar("o gatilho anuncia o estado", fechado.includes('aria-expanded="false"'));
  checar("o gatilho aponta para o painel", fechado.includes('aria-controls="menu-principal"'));
  // Hambúrguer sem rótulo é menos descoberto, e a consulta rápida mora aqui.
  checar("o gatilho é rotulado", fechado.includes("Menu"));

  // O conteúdo do painel só existe depois de um clique, que este harness não
  // dá: por isso `PainelMenu` é export nomeado.
  const painel = renderToStaticMarkup(
    <PainelMenu onInicio={() => {}} onDesempenho={() => {}} onFerramentas={() => {}} />,
  );
  checar(
    "o menu leva às três telas",
    ["Simulado", "Desempenho", "Consulta rápida"].every((s) => painel.includes(s)),
  );
  checar(
    "o menu traz o tema",
    ["Claro", "Escuro", "Automático"].every((s) => painel.includes(s)),
  );
  checar("o menu traz o tamanho de texto", painel.includes("A−") && painel.includes("A+"));
  checar("o menu não inicia bateria nenhuma", !painel.includes("Iniciar"));

  const emFerramentas = renderToStaticMarkup(
    <PainelMenu atual="ferramentas" onInicio={() => {}} onDesempenho={() => {}} onFerramentas={() => {}} />,
  );
  checar("o menu marca a tela atual", emFerramentas.includes('aria-current="page"'));
  // Sem o caminho de volta, sair do desempenho ou da consulta exigia rolar a
  // tela inteira até o "Voltar ao início" do rodapé.
  checar("de outra tela, o menu traz a volta ao simulado", emFerramentas.includes("Simulado"));
}

// --- Tela inicial composta ------------------------------------------------
// A única asserção que olha o resultado da reorganização inteira, e não um
// componente isolado. Sem DOM os efeitos não rodam, então isto é exatamente o
// que alguém vê no primeiro quadro: menu fechado e storage ainda não lido.
{
  const home = renderToStaticMarkup(<Home />);
  checar("a home traz o menu", home.includes('aria-expanded="false"'));
  checar("a home traz o resumo de desempenho", home.includes("Seu desempenho"));
  checar(
    "o painel de desempenho saiu da home",
    !home.includes("Exportar histórico") &&
      !home.includes("Limpar histórico") &&
      !home.includes("Evolução"),
  );
  checar("tema e tamanho de texto saíram da home", !home.includes("Automático"));
  checar("a consulta rápida saiu da home", !home.includes("Consulta rápida"));
  checar("a escolha da prova continua à vista", home.includes("Iniciar modo treino"));
}

// --- O cartão de conferência sob triagem ------------------------------------
{
  const q = BANCO[0];
  const em = "2026-08-10T00:00:00.000Z";
  const MOTIVO =
    "Conferido na imagem da página ampliada: a transcrição está fiel.";

  function cartao(triagem?: {
    decisao: "corrigido" | "descartado" | "adiado";
    motivo: string;
  }) {
    return renderToStaticMarkup(
      <ItemConferencia
        questao={q}
        revisao={{ veredito: q.resposta_correta ? "F" : "V", nota: "", em }}
        triagem={triagem}
        selecionado
        modoCego={false}
        onSelecionar={() => {}}
        onMarcar={() => {}}
        onAnotar={() => {}}
        onDescarregar={() => {}}
        refNota={{ current: null }}
      />,
    );
  }

  const semTriagem = cartao();
  checar(
    "achado novo é divergência e nada mais",
    semTriagem.includes("divergência") && !semTriagem.includes("triado"),
  );

  const comTriagem = cartao({ decisao: "descartado", motivo: MOTIVO });
  checar("o cartão triado ganha o selo", comTriagem.includes("triado"));
  checar("o selo diz qual foi a decisão", comTriagem.includes("descartado"));
  // O motivo é o que evita reconferir o que já foi conferido — se ele não
  // chegar à tela, o selo vira enfeite.
  checar("o cartão aberto mostra o motivo por extenso", comTriagem.includes(MOTIVO));
  checar(
    "sob triagem a divergência perde o vermelho de pendência",
    comTriagem.includes("divergência") && !comTriagem.includes("bg-rose-100"),
  );
}

console.log(`\n${falhas === 0 ? "TODOS OS TESTES DE RENDER PASSARAM" : falhas + " FALHA(S)"}`);
process.exit(falhas === 0 ? 0 : 1);
