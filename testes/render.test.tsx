import { readFileSync } from "node:fs";
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
import TelaEstudar, { TodosOsBlocos } from "@/components/TelaEstudar";
import Relampago from "@/components/Relampago";
import TelaDesafio from "@/components/TelaDesafio";
import TelaAssuntoPouso from "@/components/TelaAssuntoPouso";
import DesafioPendente from "@/components/DesafioPendente";
import TelaImpressao from "@/components/TelaImpressao";
import TelaIntervalo from "@/components/TelaIntervalo";
import TelaResultadoProva from "@/components/TelaResultadoProva";
import { ATALHOS_DA_PROVA } from "@/lib/atalhos";
import { BARALHOS } from "@/lib/drill";
import { sortearDesafio, sortearSimulado, BANCO } from "@/lib/questoes";
import { codigoDaBateria } from "@/lib/semente";
import {
  VERSAO_HISTORICO,
  montarRegistro,
  type Historico,
  type SimuladoSalvo,
} from "@/lib/historico";
import { ROTULO_CURTO, TEMAS } from "@/lib/constantes";
import { ROTULO_ARQUIVO } from "@/lib/secoes";
import Fonte from "@/components/Fonte";
import { topicos } from "@/lib/ementa";
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
  onRevisar: () => {},
  onAssuntos: () => {},
  onImprimir: () => {},
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
  // A prova completa deixou de ser um botão à parte: virou selecionar as três
  // matérias, que é o que ela sempre foi. Um segundo caminho para a mesma
  // bateria, com formato fixo, era o que havia a mais.
  checar(
    "as três matérias se selecionam de uma vez",
    html.includes("todas as 3"),
  );
  checar(
    "não há mais botão separado de prova completa",
    !html.includes("Prova completa"),
  );
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
  // E só depois que a cobertura avança: para quem viu 20 de 350, "330 que você
  // nunca viu" é uma obviedade ocupando um cartão inteiro, e o controle não
  // muda nada — quase toda questão sorteada já vai ser inédita.
  checar(
    "com uma bateria só, ainda não oferece o modo inéditas",
    !html2.includes("Priorizar inéditas"),
  );
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
  // O link do desafio nasce da configuração escolhida logo acima — e a semente
  // só é sorteada no clique: sortear no render divergiria entre a build e o
  // navegador.
  checar("oferece criar o desafio", html.includes("Desafiar o radioclube"));
  checar("não sorteia semente na renderização", !html.includes("?desafio="));

  // A tela é longa, e a ordem é o que a organiza: primeiro a bateria de hoje,
  // depois os outros modos de estudo, e por último organizar prova para os
  // outros — o que menos se faz aqui.
  checar(
    "o desafio fica depois dos atalhos de estudo",
    html.indexOf("Desafiar o radioclube") > html.indexOf("Estudar por assunto"),
  );
  checar(
    "o desafio nasce recolhido",
    !html.includes("Criar a bateria") && !html.includes("Semente"),
  );
  // Quem procura "imprimir a prova" não adivinharia que ela mora atrás de
  // "desafiar": o rótulo fechado anuncia as duas saídas.
  checar(
    "o rótulo fechado anuncia a prova impressa",
    html.includes("prova impressa"),
  );

  // Primeira visita: os dois regimes abertos, porque a descrição do NÃO
  // escolhido é justamente a que falta para decidir.
  checar(
    "na primeira visita, os regimes vêm abertos",
    html.includes("Gabarito e explicação a cada questão"),
  );
  // Com histórico, vira uma linha — e só porque regime e cronômetro passaram a
  // ser lembrados: recolher sem lembrar esconderia um controle de toda sessão.
  checar(
    "com histórico, como conduzir vem recolhido num resumo",
    html2.includes("ajustar") &&
      !html2.includes("Gabarito e explicação a cada questão") &&
      html2.includes("cronômetro 30 min"),
  );
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
  // São 91 assuntos em dez telas de celular, e a ementa de Eletrônica começava
  // a sete telas de rolagem: cada grupo vira destino de um atalho no topo.
  checar(
    "cada grupo tem âncora e atalho",
    (html.match(/<section id="grupo-/g) ?? []).length >= 5 &&
      html.includes('aria-label="Ir para um grupo de assuntos"'),
  );
  checar(
    "o atalho diz quantos assuntos há no grupo",
    /Cartilha do Radioamador<span[^>]*>\s*\d+/.test(html),
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

// --- Material de estudo ---------------------------------------------------
{
  const html = renderToStaticMarkup(<TelaEstudar />);
  checar("TelaEstudar renderiza", html.includes("Material de estudo"));
  checar(
    "declara de onde a ementa saiu",
    html.includes("Ato nº 3448/2026, item 11.4"),
  );
  // O valor da página é ser o texto da Anatel, e não um resumo nosso: se o
  // item chegar parafraseado à tela, ela deixa de valer mais do que o README.
  checar(
    "traz o item da ementa palavra por palavra",
    contem(
      html,
      "Diagrama de blocos de receptores, transmissores, transceptores e repetidoras.",
    ),
  );
  checar(
    "aponta o trecho do material que cobre o item",
    html.includes("Cartilha do Radioamador"),
  );
  // O rótulo dos blocos de Eletrônica usava slate-400/500: 2,51:1 no claro e
  // 3,95:1 no escuro, os dois abaixo dos 4,5:1 de AA. É o mesmo degrau de
  // rótulo do resto do app, e agora usa a classe dele.
  checar(
    "os rótulos de bloco passam em AA nos dois temas",
    !html.includes("text-slate-400 dark:text-slate-500"),
  );
  checar(
    "leva à bateria do assunto",
    html.includes("assunto=tec-antenas") && /Treinar/.test(html),
  );
  // Sem escolha gravada a classe é a B, e o acréscimo exclusivo da A não é
  // programa dela — mostrá-lo faria estudar o que não cai.
  checar(
    "na Classe B, o bloco exclusivo da Classe A fica de fora",
    !html.includes("ELETRÔNICA DE RF"),
  );
  checar(
    "oferece os documentos inteiros para baixar",
    html.includes("Baixar") && html.includes("Ato 3448/2026"),
  );
  // Mesma regra da consulta rápida: sem service worker controlando, baixar
  // não deixaria nada no cache e a seção não pode nem aparecer.
  checar(
    "sem service worker, o pré-download não aparece",
    !html.includes("Material para consulta offline"),
  );
  checar(
    "a leitura termina com uma saída para a prova",
    html.includes("Agora teste seus conhecimentos"),
  );

  // A tela só mostra os blocos da classe escolhida; a ementa inteira só sai
  // sob renderização estática por este export.
  const todos = renderToStaticMarkup(<TodosOsBlocos />);
  const links = todos.match(/assunto=/g) ?? [];
  checar(
    "os 36 tópicos da ementa rendem bateria",
    links.length === 36,
    `${links.length} links`,
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
  // A ação da vez — responder, e depois avançar — mora numa barra que se cola
  // ao rodapé no celular. É o que tira a rolagem do caminho: sem ela, o
  // "Próxima questão" nascia fora da tela em questões longas.
  checar(
    "V e F ficam na barra de ação",
    /class="sticky bottom-0[^"]*"><div class="grid grid-cols-2/.test(html),
  );
  // A confirmação de abandono nasce fechada: quem ainda não respondeu nada não
  // tem o que confirmar, e ver a caixa de aviso antes da primeira resposta
  // seria alarme falso.
  checar(
    "abandonar não pede confirmação antes da primeira resposta",
    !html.includes("Abandonar apaga"),
  );
  checar("sem cronômetro, não mostra relógio", !html.includes("30:00"));
  // O alvo do foco a cada questão. Sem ele, quem responde pelo teclado ou
  // pelo toque não recebe anúncio nenhum ao trocar de questão — e o efeito
  // que rola a tela de volta ao topo não teria onde pousar o foco.
  checar(
    "a questão tem um título que recebe o foco",
    html.includes('<h2 tabindex="-1" class="sr-only">Questão 1 de 20 — Legislação'),
  );

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
  // Aqui o título do foco também carrega o estado: com navegação livre, "em
  // branco ou já respondida?" é a pergunta que o leitor de tela precisa ouvir
  // ao chegar numa questão.
  checar(
    "a questão tem um título com posição e estado",
    html.includes(
      '<h2 tabindex="-1" class="sr-only">Questão 1 de 20 — Legislação, em branco</h2>',
    ),
  );
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
  //
  // Conta só as CÉLULAS (o `aria-label` de cada uma), e não todo `tabindex`
  // da tela: o título que recebe o foco a cada questão também é -1, e um
  // contador global reprovaria essa adição sem que nada da folha mudasse.
  const celulasForaDoTab = (
    html.match(/tabindex="-1" aria-label="Questão \d+,/g) ?? []
  ).length;
  checar(
    "a folha é uma única parada de Tab",
    celulasForaDoTab === questoes.length - 1,
  );
  checar("permite navegar entre as questões", html.includes("Anterior") && html.includes("Próxima"));
  checar("permite marcar para revisar", html.includes("Marcar para revisar"));
  checar("permite encerrar e ver o gabarito", html.includes("Encerrar e ver o gabarito"));
  checar("permite abandonar", html.includes("Abandonar a prova"));
  checar(
    "abandonar não pede confirmação antes da primeira resposta",
    !html.includes("Abandonar apaga"),
  );
  // Uma prova retomada monta com a folha e a posição de onde parou.
  const retomada = renderToStaticMarkup(
    <TelaProvaCega
      questoes={questoes}
      escolhasIniciais={questoes.map((_, i) => (i < 4 ? true : null))}
      indiceInicial={4}
      marcadasIniciais={[1]}
      onConcluir={() => {}}
      onSair={() => {}}
    />,
  );
  checar(
    "prova retomada abre na questão em que parou",
    retomada.includes("Questão 5 de 20"),
  );
  checar(
    "e com as respostas que já tinha",
    retomada.includes("4 de 20 respondidas"),
  );
  checar(
    "e com as marcações que já tinha",
    retomada.includes("Questão 2, respondida, marcada para revisar"),
  );

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

// --- Desafio por link -----------------------------------------------------
{
  const desafio = {
    semente: "PY2-SP",
    temas: [TEMAS[0]],
    quantidade: 20,
    classe: "B" as const,
  };
  const html = renderToStaticMarkup(
    <TelaDesafio desafio={desafio} onComecar={() => {}} onIgnorar={() => {}} />,
  );
  checar("a tela do desafio se anuncia", html.includes("Desafio recebido"));
  checar("mostra a semente", html.includes("PY2-SP"));
  // Quem clica num link precisa saber que vai entrar numa prova cronometrada
  // ANTES de o cronômetro começar.
  checar(
    "avisa o formato antes de começar",
    html.includes("modo prova") && html.includes("30 min"),
  );
  // "Agora não" soava definitivo, e era: a home não mostrava que o desafio
  // existia, então a única volta era recarregar o link.
  checar(
    "deixa adiar sem perder o desafio",
    html.includes("Deixar para depois") && html.includes("Começar o desafio"),
  );

  // Desafio de prova completa: as três matérias, com a quantidade POR matéria.
  const completo = renderToStaticMarkup(
    <TelaDesafio
      desafio={{ ...desafio, temas: TEMAS }}
      onComecar={() => {}}
      onIgnorar={() => {}}
    />,
  );
  checar(
    "desafio de três matérias lista as três",
    ["Legislação", "Técnica e Ética", "Eletrônica"].every((s) =>
      completo.includes(s),
    ),
  );
  checar(
    "e diz que a quantidade é por matéria",
    completo.includes("em cada matéria") && completo.includes("60 questões no total"),
  );

  // No resultado, o código da bateria é o que denuncia banco divergente.
  const questoes = sortearDesafio(TEMAS[0], 5, "B", "PY2-SP");
  const respostas: Resposta[] = questoes.map((q) => ({
    questao: q,
    respondeu: q.resposta_correta,
    acertou: true,
  }));
  const resultado = renderToStaticMarkup(
    <TelaResultado
      respostas={respostas}
      onReiniciar={() => {}}
      classe="B"
      cega
      desafio={{
        semente: "PY2-SP",
        link: "https://exemplo.app/?desafio=PY2-SP&t=legislacao&n=5&c=B",
        codigo: codigoDaBateria(questoes.map((q) => q.id)),
      }}
    />,
  );
  checar(
    "o resultado do desafio mostra semente e código",
    resultado.includes("PY2-SP") &&
      resultado.includes(codigoDaBateria(questoes.map((q) => q.id))),
  );
  const semDesafio = renderToStaticMarkup(
    <TelaResultado respostas={respostas} onReiniciar={() => {}} classe="B" />,
  );
  checar(
    "bateria comum não mostra código de bateria",
    !semDesafio.includes("bateria "),
  );
}

// --- Bateria em papel -----------------------------------------------------
{
  const desafio = {
    semente: "PY2-SP",
    temas: [TEMAS[0]],
    quantidade: 20,
    classe: "B" as const,
  };
  const questoes = sortearDesafio(TEMAS[0], 20, "B", "PY2-SP");
  const html = renderToStaticMarkup(
    <TelaImpressao
      desafio={desafio}
      baterias={[{ tema: TEMAS[0], questoes }]}
      link="https://exemplo.app/?desafio=PY2-SP&t=legislacao&n=20&c=B"
      onVoltar={() => {}}
    />,
  );
  checar(
    "a folha traz cabeçalho com classe, matéria e tempo",
    html.includes("Classe B") &&
      html.includes("Legislação") &&
      html.includes("30 min"),
  );
  // Instrutor recolhe folha: sem identificação, vira pilha.
  checar(
    "tem onde escrever nome, indicativo e data",
    ["Nome", "Indicativo", "Data"].every((s) => html.includes(s)),
  );
  checar(
    "traz as 20 questões numeradas",
    questoes.every((q) => contem(html, q.afirmacao)) && html.includes("20."),
  );
  // A folha do aluno é em branco: nada de gabarito misturado ao enunciado.
  const folha = html.split("pagina-nova")[0];
  checar(
    "a folha do aluno não traz explicação nenhuma",
    questoes.every((q) => !contem(folha, q.explicacao_curta)),
  );
  checar(
    "o gabarito sai em página própria",
    html.includes("pagina-nova") && html.includes("Gabarito"),
  );
  checar(
    "o gabarito traz resposta e explicação de cada questão",
    questoes.every((q) => contem(html, q.explicacao_curta)),
  );
  // Papel e link têm de ser rastreáveis um ao outro.
  checar(
    "folha e gabarito citam a semente e o código da bateria",
    html.split("PY2-SP").length - 1 >= 2 &&
      html.includes(codigoDaBateria(questoes.map((q) => q.id))),
  );
  checar(
    "os controles não vão para o papel",
    html.includes("nao-imprimir") && html.includes("Imprimir"),
  );

  // Prova completa em papel: uma folha por matéria e um gabarito por matéria —
  // são exames separados, e é assim que se aplica.
  const duas = [
    { tema: TEMAS[0], questoes: sortearDesafio(TEMAS[0], 5, "B", "PY2-SP") },
    { tema: TEMAS[1], questoes: sortearDesafio(TEMAS[1], 5, "B", "PY2-SP") },
  ];
  const completa = renderToStaticMarkup(
    <TelaImpressao
      desafio={{ ...desafio, temas: [TEMAS[0], TEMAS[1]], quantidade: 5 }}
      baterias={duas}
      link="https://exemplo.app/?desafio=PY2-SP&t=legislacao,tecnica&n=5&c=B"
      onVoltar={() => {}}
    />,
  );
  checar(
    "cada matéria tem sua folha e seu gabarito",
    (completa.match(/pagina-nova/g) ?? []).length === 3,
    `${(completa.match(/pagina-nova/g) ?? []).length} quebras de página`,
  );
  checar(
    "as folhas se identificam pela matéria",
    completa.includes("Legislação") && completa.includes("Técnica e Ética"),
  );
  checar(
    "a folha da segunda matéria não traz as questões da primeira",
    duas[0].questoes.every(
      (q) => !contem(completa.split("pagina-nova")[1] ?? "", q.afirmacao),
    ),
  );
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
  // O cartão de erro diz o gabarito primeiro e o que a pessoa fez depois; para
  // a questão em branco, "você deixou em branco" — sem afirmar a causa, que só
  // o cabeçalho do resultado conhece (encerrar à mão também deixa brancos).
  checar(
    "questão em branco aparece como deixada em branco",
    html4.includes("você deixou em branco"),
  );
  checar(
    "o gabarito vem antes do que foi respondido",
    html4.indexOf("Gabarito:") < html4.indexOf("você deixou em branco"),
  );

  // "E agora?": o resultado tem de oferecer o próximo passo, e o primeiro é
  // revisar os erros — a ação com prazo, enquanto o erro está fresco.
  const comAcoes = renderToStaticMarkup(
    <TelaResultado
      respostas={comBranco}
      onReiniciar={() => {}}
      onRefazer={() => {}}
      onRevisarErros={() => {}}
      onEstudarAssunto={() => {}}
      tema="Legislação de Telecomunicações"
    />,
  );
  checar("o resultado oferece o próximo passo", comAcoes.includes("E agora?"));
  checar(
    "revisar os erros é a primeira ação",
    comAcoes.includes("Revisar os 5 erros agora"),
  );
  checar("oferece refazer a mesma bateria", comAcoes.includes("Refazer"));
  checar(
    "e estudar por assunto",
    comAcoes.includes("Estudar por assunto"),
  );
  checar(
    "o próximo passo vem antes do gabarito",
    comAcoes.indexOf("E agora?") < comAcoes.indexOf("Revisão dos erros"),
  );
  // Sem erro nenhum não há o que revisar, e o bloco não inventa uma ação.
  const semErros = renderToStaticMarkup(
    <TelaResultado
      respostas={questoes.slice(0, 10).map((q) => ({
        questao: q,
        respondeu: q.resposta_correta,
        acertou: true,
      }))}
      onReiniciar={() => {}}
      onRevisarErros={() => {}}
    />,
  );
  checar(
    "sem erros, não oferece revisar",
    !semErros.includes("Revisar") && !semErros.includes("E agora?"),
  );

  // Quantos acertos faltaram, em vez de deixar a conta para quem errou:
  // "40%, critério 55%" obriga a converter percentual em questões.
  const reprovadoHtml = renderToStaticMarkup(
    <TelaResultado
      respostas={questoes.slice(0, 10).map((q, i) => ({
        questao: q,
        respondeu: i < 4 ? q.resposta_correta : !q.resposta_correta,
        acertou: i < 4,
      }))}
      onReiniciar={() => {}}
    />,
  );
  checar(
    "o veredito diz quantos acertos faltaram",
    reprovadoHtml.includes("2 acertos faltaram para o mínimo de 6 de 10"),
  );
  checar(
    "e quantos sobraram quando passou",
    html4.includes("4 acertos de folga — o mínimo era 11 de 20"),
  );

  // Prova cega: a dúvida assumida separa o acerto sólido do chute.
  const comMarcadas = renderToStaticMarkup(
    <TelaResultado
      cega
      respostas={questoes.slice(0, 10).map((q, i) => ({
        questao: q,
        respondeu: q.resposta_correta,
        acertou: true,
        ...(i < 3 ? { marcada: true } : {}),
      }))}
      onReiniciar={() => {}}
    />,
  );
  checar(
    "o resultado conta os acertos que vieram de dúvida",
    comMarcadas.includes("como dúvida e acertou 3"),
  );
  checar(
    "e o gabarito filtra as marcadas",
    comMarcadas.includes("Marcadas (3)"),
  );

  // A revisão em lotes precisa dizer o que sobrou e oferecer o próximo lote:
  // sem isso, terminar 20 de 91 parece ter terminado a revisão.
  const revisaoParcial = renderToStaticMarkup(
    <TelaResultado
      modo="revisao"
      respostas={questoes.slice(0, 20).map((q, i) => ({
        questao: q,
        respondeu: i < 14 ? q.resposta_correta : !q.resposta_correta,
        acertou: i < 14,
      }))}
      onReiniciar={() => {}}
      restantesRevisao={71}
      onContinuarRevisao={() => {}}
    />,
  );
  checar(
    "a revisão diz quantos erros continuam em aberto",
    revisaoParcial.includes("Ainda há 71 erros em aberto"),
  );
  checar(
    "e oferece o próximo lote",
    revisaoParcial.includes("Continuar revisando · 71 erros em aberto"),
  );
  // Zerou a lista: não há próximo lote a oferecer.
  const revisaoZerada = renderToStaticMarkup(
    <TelaResultado
      modo="revisao"
      respostas={questoes.slice(0, 5).map((q) => ({
        questao: q,
        respondeu: q.resposta_correta,
        acertou: true,
      }))}
      onReiniciar={() => {}}
      restantesRevisao={0}
      onContinuarRevisao={() => {}}
    />,
  );
  checar(
    "sem erro em aberto, não oferece continuar",
    !revisaoZerada.includes("Continuar revisando"),
  );

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
      quantidade={20}
      proximoTema="Técnica e ética operacional"
      cronometrado
      restantes={2}
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
    aprova.includes("Aprovado") && aprova.includes("atingido nas 3 matérias"),
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
  // A marca de corte é a informação central desta tela — "passei nesta
  // matéria?" —, e era um fio de 1px a 60% de opacidade DENTRO da trilha, que
  // media 2,1 a 3,2:1 sobre as barras (a WCAG 1.4.11 pede 3:1 para elemento
  // gráfico). Cor cheia, 2px e saindo da trilha em cima e embaixo.
  checar(
    "a marca de corte é opaca e tem 2 px",
    comDados.includes("w-0.5") &&
      comDados.includes("bg-slate-900 dark:bg-white") &&
      !comDados.includes("bg-slate-900/60"),
  );
  // Com a marca legível, a legenda para de precisar de três linhas dizendo
  // qual traço é qual.
  checar(
    "a legenda do corte cabe em uma frase",
    comDados.includes("A marca vertical é o corte da Classe B: 11 de 20 (55%).") &&
      !comDados.includes("A e C aprovam com"),
  );
  // O tracejado do sparkline media 2,63:1 no claro e 2,27:1 no escuro — no
  // tema escuro ele praticamente sumia, e é ele que diz se a linha da matéria
  // está por cima ou por baixo do corte.
  checar(
    "o tracejado do corte tem contraste nos dois temas",
    !comDados.includes("stroke-slate-400 dark:stroke-slate-600"),
  );

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
  // A linha passou a trazer as TRÊS matérias com o resultado recente de cada
  // uma: o alerta é a matéria que está abaixo do corte agora, não a que ficou
  // abaixo em algum momento da média da vida toda.
  checar(
    "com uma matéria fraca, o resumo a nomeia",
    resumoFraco.includes("30%") &&
      resumoFraco.includes("Eletrônica") &&
      resumoFraco.includes("abaixo do corte"),
  );

  const resumoBom = renderToStaticMarkup(
    <ResumoDesempenho historico={h2} carregado onAbrir={() => {}} />,
  );
  checar(
    "tudo acima do corte não vira alerta",
    resumoBom.includes("90%") && !resumoBom.includes("abaixo do corte"),
  );

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
  // Cada matéria carrega o próprio alerta, porque cada uma é um exame
  // separado: contar ("2 matérias abaixo do corte") escondia justamente quais.
  checar(
    "cada matéria fraca carrega o próprio alerta",
    (resumoDuas.match(/abaixo do corte/g) ?? []).length === 2,
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
  // O material abre a lista: é a ordem do estudo — ler o que a prova cobra
  // antes de responder — e o único destino do menu que ninguém adivinha
  // existir. Os outros três a pessoa encontra sozinha.
  checar(
    "o material de estudo é o primeiro item",
    painel.indexOf("Material de estudo") < painel.indexOf("Simulado"),
  );
  // "Automático" carrega um hífen condicional (`\u00ad`), invisível quando a
  // palavra cabe: numa célula de 78 px com a fonte grande ela pede 94, e
  // truncar em "Automátic" era o defeito de origem. O leitor de tela recebe o
  // nome sem ele, pelo `aria-label`.
  checar(
    "o menu traz o tema",
    ["Claro", "Escuro"].every((s) => painel.includes(s)) &&
      painel.replace(/\u00ad/g, "").includes("Automático"),
  );
  checar(
    "o nome do tema chega inteiro ao leitor de tela",
    painel.includes('aria-label="Tema automático"'),
  );
  checar("o menu traz o tamanho de texto", painel.includes("A−") && painel.includes("A+"));
  // Os quatro destinos eram irmãos soltos dentro do <header>: sem marco e sem
  // lista, a árvore de acessibilidade não tinha como dizer que aquilo era um
  // menu, nem quantos itens tinha.
  checar(
    "os destinos são uma lista dentro de um marco",
    painel.includes('aria-label="Menu principal"') &&
      painel.includes("<ul") &&
      (painel.match(/<li>/g) ?? []).length === 4,
  );
  // Tema e Texto eram rótulos soltos: "Automático, botão alternável" não diz
  // automático de quê.
  checar(
    "os grupos de preferência têm nome",
    painel.includes('aria-labelledby="rotulo-tema"') &&
      painel.includes('aria-labelledby="rotulo-texto"'),
  );
  // As descrições eram texto de landing page: 40 palavras para achar
  // "Desempenho", e 416 px dos 601 do painel só em cartões.
  checar(
    "cada destino se explica em uma linha",
    !painel.includes("A ementa oficial da prova, o trecho do PDF") &&
      painel.includes("Ementa oficial, trechos do PDF e documentos da Anatel"),
  );
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
  // A marca do ícone instalado passou a existir na interface: era o melhor
  // desenho do produto e não aparecia em pixel nenhum dela.
  checar("o cabeçalho traz a antena", home.includes('cx="12"') && home.includes("#f59e0b"));
  // Glifo não é ícone: cada plataforma desenha o seu, o peso não acompanha o
  // texto e alguns viram emoji colorido no celular — a bandeira do "marcar
  // para revisar" chegava a competir com o vermelho de erro.
  checar(
    "nenhum glifo Unicode sobrou na interface",
    !/[☰⚑▼▲‹⚠]/.test(home),
  );
  // O rótulo de seção era a mesma ideia escrita de oito jeitos.
  checar(
    "os rótulos de seção usam um degrau só",
    (home.match(/rotulo-secao/g) ?? []).length >= 3 &&
      !home.includes("tracking-wide text-slate-500 uppercase"),
  );
  // Um preenchimento sólido por tela: o que avança a tarefa. Antes, classe,
  // quantidade, regime, aba e filtro usavam o mesmo preto do "Iniciar", e o
  // olho não separava estado de comando.
  checar(
    "só a ação principal é bloco cheio",
    (home.match(/bg-slate-900/g) ?? []).length === 1,
  );
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
  // A decisão principal da tela — classe, matéria e quantidade — precisa dizer
  // ao leitor de tela o que está escolhido. Antes, só o regime e os toggles
  // tinham estado; os três grupos que definem a bateria não tinham nenhum.
  checar(
    "classe, matéria e quantidade anunciam o que está escolhido",
    (home.match(/aria-pressed="(true|false)"/g) ?? []).length >= 10,
  );
  checar(
    "e cada grupo tem nome",
    home.includes('aria-label="Classe da prova"') &&
      home.includes('aria-label="Matérias da bateria"') &&
      home.includes('aria-label="Questões por bateria"'),
  );
  // O material tem de ser descobrível de fora do menu: quem instala o app não
  // desconfia que existe uma ementa oficial — e é a ementa, e não o nome da
  // tela, que a linha precisa prometer.
  checar(
    "a home aponta para o material de estudo",
    home.includes('href="/estudar"') && home.includes("Ementa oficial e PDFs"),
  );
}

// --- Questões em branco aparecem em todas as telas de veredito --------------
// Na prova completa, a cronometrada, quem estourou o tempo não descobria por
// que perdeu pontos: o aviso existia só no resultado de uma matéria.
{
  const questoes = sortearSimulado("Legislação de Telecomunicações", 10);
  const comBranco = questoes.map((q, i) => ({
    questao: q,
    respondeu: i < 6 ? q.resposta_correta : null,
    acertou: i < 6,
  }));
  const intervalo = renderToStaticMarkup(
    <TelaIntervalo
      classe="B"
      tema="Legislação de Telecomunicações"
      respostas={comBranco}
      quantidade={10}
      proximoTema="Técnica e ética operacional"
      cronometrado
      restantes={2}
      motivoFim="tempo"
      onProsseguir={() => {}}
      onAbandonar={() => {}}
    />,
  );
  checar(
    "o intervalo avisa das questões em branco",
    intervalo.includes("4 questões ficaram sem resposta"),
  );
  checar(
    "e diz que foi o tempo, quando foi",
    intervalo.includes("Tempo esgotado"),
  );
  const consolidado = renderToStaticMarkup(
    <TelaResultadoProva
      classe="B"
      materias={[
        { tema: "Legislação de Telecomunicações", respostas: comBranco },
      ]}
      onReiniciar={() => {}}
    />,
  );
  checar(
    "o consolidado mostra as em branco por matéria",
    consolidado.includes("4") && consolidado.includes("em branco"),
  );
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

// --- Área de toque --------------------------------------------------------
// O app é usado no celular por gente de 40 a 70 anos, com o polegar. Havia
// controles de 16 px de altura em lugares caros: "Marcar como suspeita" em
// cada cartão do gabarito, e "Limpar resposta" / "Marcar para revisar" dentro
// de uma prova cronometrada, onde errar o toque custa segundos contados.
//
// O teste não mede pixel — isso é o navegador que faz, e foi medido lá: zero
// controles abaixo de 44 px em todas as telas. Aqui a asserção é a regra: os
// controles que eram pequenos carregam a marca da área de toque, e ela existe
// com os 44 px que promete.
{
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  checar(
    "a área de toque existe e vale 44 px",
    /@utility alvo-toque \{[^}]*min-height: 2\.75rem/.test(css),
  );
  // O tom de rótulo era o slate-500: 4,86:1 sobre o branco da superfície, ou
  // seja 0,36 de margem sobre o mínimo de AA — margem que evaporava assim que
  // o rótulo caía num cartão tinto (4,33:1 sobre o rose-50 do feedback e o
  // emerald-50 do veredito). Agora é o mesmo tom do apoio, como já era no
  // tema escuro.
  checar(
    "o tom de rótulo tem margem sobre AA em qualquer superfície",
    /--texto-3: #475569/.test(css) && !/--texto-3: #64748b/.test(css),
  );

  /** A classe do primeiro controle cujo texto contém o rótulo. */
  function classeDoControle(markup: string, rotulo: string): string | null {
    const re = /<(button|a|summary)\b([^>]*)>([\s\S]*?)<\/\1>/g;
    for (const m of markup.matchAll(re)) {
      const texto = m[3].replace(/<[^>]*>/g, "").replace(/\s+/g, " ");
      if (texto.includes(rotulo)) return /class="([^"]*)"/.exec(m[2])?.[1] ?? "";
    }
    return null;
  }
  const temArea = (markup: string, rotulo: string) => {
    const cls = classeDoControle(markup, rotulo);
    return cls !== null && (cls.includes("alvo-toque") || cls.includes("min-h-11"));
  };

  const questoes = sortearDesafio(TEMAS[0], 5, "B", "PY2-SP");
  const cega = renderToStaticMarkup(
    <TelaProvaCega questoes={questoes} onConcluir={() => {}} onSair={() => {}} />,
  );
  checar("na prova, limpar a resposta tem área de dedo", temArea(cega, "Limpar resposta"));
  checar("na prova, marcar para revisar tem área de dedo", temArea(cega, "Marcar para revisar"));
  checar("na prova, abandonar tem área de dedo", temArea(cega, "Abandonar a prova"));
  // A folha de respostas é uma grade de 20 a 90 células: se alguma encolher,
  // a prova inteira vira um campo minado para o polegar.
  checar(
    "as células da folha de respostas têm 44 px",
    (cega.match(/min-h-11/g) ?? []).length >= questoes.length,
  );

  const respostas: Resposta[] = questoes.map((q, i) => ({
    questao: q,
    respondeu: i === 0 ? !q.resposta_correta : q.resposta_correta,
    acertou: i !== 0,
  }));
  const resultado = renderToStaticMarkup(
    <TelaResultado respostas={respostas} onReiniciar={() => {}} classe="B" cega />,
  );
  // O botão de suspeita só existe depois que o hook lê o localStorage, então
  // não aparece no render estático — aqui a asserção olha a fonte. Era o pior
  // alvo do app: 255x16 px, repetido em cada cartão do gabarito.
  const fonteSuspeita = readFileSync(
    new URL("../components/BotaoSuspeita.tsx", import.meta.url),
    "utf8",
  );
  checar(
    "no gabarito, marcar suspeita tem área de dedo",
    (fonteSuspeita.match(/alvo-toque/g) ?? []).length === 2,
  );
  checar("os filtros do gabarito têm área de dedo", temArea(resultado, "Só os erros"));
  checar(
    "compartilhar e imprimir têm área de dedo",
    temArea(resultado, "Compartilhar resultado") && temArea(resultado, "Imprimir revisão"),
  );

  const inicio = renderToStaticMarkup(<TelaInicio {...PROPS_INICIO} />);
  checar("a escolha de quantidade tem área de dedo", temArea(inicio, "40"));
  checar("o atalho das três matérias tem área de dedo", temArea(inicio, "todas as 3"));

  // O link do cabeçalho é a exceção que confirma a regra: são dois pedaços de
  // texto com um espaço entre eles, e `display: flex` descarta nós de texto em
  // branco — virava "PDFs daAnatel". Ali os 44 px vêm de padding, e o que o
  // teste guarda é o espaço.
  const home = renderToStaticMarkup(<Home />);
  checar("o link do material não perdeu o espaço", home.includes("PDFs da"));
}


// --- Prova cega: o que o render estático não alcança ----------------------
// Responder, marcar, abrir o leitor e a caixa de confirmação só existem depois
// de um clique, e este arquivo renderiza o primeiro quadro. As regras abaixo
// foram verificadas no navegador; aqui ficam presas à fonte, que é onde uma
// regressão apareceria.
{
  const fonte = (arquivo: string) =>
    readFileSync(new URL(`../components/${arquivo}`, import.meta.url), "utf8");

  // Dois botões com `aria-pressed` exclusivo são um grupo de rádio, e rádio
  // não desmarca ao re-tocar. Era um alterna: o segundo toque em "Verdadeiro"
  // devolvia a questão a em branco — que conta como erro — e o único aviso era
  // o preenchimento sumir.
  const cega = fonte("TelaProvaCega.tsx");
  checar(
    "responder é idempotente",
    !cega.includes("anteriores[indice] === valor ? null : valor") &&
      cega.includes("if (anteriores[indice] === valor) return anteriores;"),
  );
  // Apagar continua existindo, e com nome.
  checar(
    "apagar continua tendo controle próprio",
    cega.includes("Limpar resposta") && cega.includes('k === "backspace"'),
  );
  // A confirmação só olhava as em branco, e o botão que tinha o foco desmonta
  // ao abri-la: sem `role="alert"`, o leitor de tela não anuncia nada.
  checar(
    "encerrar confirma também com questões marcadas",
    cega.includes("pendente.primeira !== null") &&
      cega.includes("marcadas para revisar"),
  );
  checar("a confirmação é anunciada", cega.includes('role="alert"'));

  // Roving focus só funciona se o foco rodar junto com a parada de Tab: as
  // setas moviam o `tabindex` e deixavam o foco na célula antiga, então o
  // Enter seguinte devolvia a prova para ela.
  const folha = fonte("FolhaRespostas.tsx");
  checar(
    "a seta leva o foco junto na folha",
    folha.includes("grade.current?.contains(document.activeElement)") &&
      folha.includes("celulaAtual.current?.focus"),
  );

  // WCAG 2.1.1: caixa que rola sem parada de teclado é conteúdo inalcançável.
  checar(
    "a caixa do trecho é alcançável pelo teclado",
    /tabIndex=\{0\}[\s\S]{0,80}aria-label="Trecho de origem"/.test(
      fonte("TrechoOrigem.tsx"),
    ),
  );
  checar(
    "a página do documento é alcançável pelo teclado",
    /tabIndex=\{0\}[\s\S]{0,80}aria-label="Página do documento"/.test(
      fonte("VisualizadorPdf.tsx"),
    ),
  );

  // Consultar o material e marcar a suspeita são ações terminais da questão;
  // com o foco parado nelas, o Enter seguinte reabria o PDF ou desmarcava —
  // enquanto o botão logo abaixo anuncia "Próxima questão · Enter".
  const treino = fonte("TelaSimulado.tsx");
  checar(
    "depois de consultar ou marcar, o Enter volta a avançar",
    (treino.match(/voltarAoAvancar/g) ?? []).length === 3,
  );
  // Fora do treino o leitor segue o padrão de diálogo modal: o foco volta a
  // quem o abriu.
  checar(
    "o leitor só desvia o foco quando pedem",
    fonte("VisualizadorPdf.tsx").includes("if (destino) destino();\n        else anterior?.focus?.();"),
  );
}


// --- Fim de fluxo: para onde se vai depois --------------------------------
// O app terminava cada caminho despejando o candidato na home: acabou o
// assunto, home; reprovou numa matéria da prova completa, role e filtre você
// mesmo; deixou o desafio para depois, ele some.
{
  // O "Treinar" de /estudar caía direto na questão 1 de 37 — sem dizer antes
  // que seriam 37, e sem volta ao material que não fosse "Abandonar". É a
  // mesma tela de pouso que o desafio tem, e pela mesma razão.
  const topico = topicos().find((t) => t.titulo !== null)!;
  const pouso = renderToStaticMarkup(
    <TelaAssuntoPouso topico={topico} quantidade={37} onComecar={() => {}} />,
  );
  checar("o pouso do assunto diz o tamanho da bateria", pouso.includes("37 questões"));
  checar(
    "o pouso diz o regime antes de começar",
    pouso.includes("modo treino") && pouso.includes("sem cronômetro"),
  );
  checar("o pouso traz o item da ementa", contem(pouso, topico.texto.slice(0, 40)));
  checar(
    "o pouso deixa voltar ao material",
    pouso.includes('href="/estudar"') && pouso.includes("Voltar ao material"),
  );

  // "Deixar para depois" era um beco: a home não mostrava que havia um
  // desafio, e a única forma de voltar era recarregar ou reabrir a mensagem.
  const pendente = { semente: "PY2-SP", temas: [TEMAS[0]], quantidade: 10, classe: "B" as const };
  const faixa = renderToStaticMarkup(<DesafioPendente desafio={pendente} onAbrir={() => {}} />);
  checar(
    "a faixa identifica o desafio pendente",
    faixa.includes("PY2-SP") && faixa.includes("10 questões"),
  );

  // O consolidado dizia onde se reprovou e o gabarito ficava mil pixels
  // abaixo, numa lista única com dois filtros só.
  const porMateria = TEMAS.map((t) => {
    const qs = sortearDesafio(t, 5, "B", "PY2-SP");
    return {
      tema: t,
      respostas: qs.map((q, i) => ({
        questao: q,
        respondeu: i < 3 ? q.resposta_correta : !q.resposta_correta,
        acertou: i < 3,
      })),
    };
  });
  const consolidado = renderToStaticMarkup(
    <TelaResultadoProva classe="B" materias={porMateria} onReiniciar={() => {}} />,
  );
  checar(
    "cada matéria do consolidado leva aos erros dela",
    (consolidado.match(/ver os 2 erros/g) ?? []).length === 3,
  );
  checar(
    "o gabarito ganha filtro por matéria quando há mais de uma",
    consolidado.includes('aria-label="Filtrar o gabarito por matéria"'),
  );
  // Numa bateria de matéria só, o filtro não filtraria nada.
  const umaMateria = renderToStaticMarkup(
    <TelaResultado respostas={porMateria[0].respostas} onReiniciar={() => {}} classe="B" cega />,
  );
  checar(
    "com uma matéria só, não há filtro por matéria",
    !umaMateria.includes('aria-label="Filtrar o gabarito por matéria"'),
  );
  // "Novo simulado" voltava à home com tudo por escolher. Repetir já existe,
  // com esse nome, no "E agora?".
  checar(
    "o CTA do resultado não promete um simulado novo",
    !umaMateria.includes("Novo simulado") && umaMateria.includes("Voltar ao início"),
  );

  // Terminar um assunto largava o candidato na home: quem queria fazer três
  // seguidos reabria a lista de dez telas três vezes.
  const assunto = renderToStaticMarkup(
    <TelaResultado
      respostas={porMateria[0].respostas}
      onReiniciar={() => {}}
      classe="B"
      modo="assunto"
      onOutroAssunto={() => {}}
      onEstudarAssunto={() => {}}
    />,
  );
  checar("o assunto oferece o próximo assunto", assunto.includes("Escolher outro assunto"));
  checar("e não se oferece a si mesmo de novo", !assunto.includes(">Estudar por assunto<"));
}


// --- A home diz o que fazer hoje ------------------------------------------
// A linha de resumo dizia o que aconteceu ("12 simulados · 57%"), e nenhum dos
// dois números apoiava a decisão seguinte, que é escolher a matéria: o 57% não
// existe no exame — a aprovação é matéria a matéria — e o alerta era a média
// da vida toda.
{
  const bat = (tema: (typeof TEMAS)[number], acertos: number, quando: string): SimuladoSalvo => ({
    id: `r${tema}${acertos}${quando}`,
    data: quando,
    escolha: tema,
    total: 10,
    acertos,
    itens: Array.from({ length: 10 }, (_, i) => ({
      questaoId: `${tema}-${i}`,
      tema,
      acertou: i < acertos,
      respondeu: true,
    })),
  });
  const hoje = new Date().toISOString();
  const h: Historico = {
    versao: VERSAO_HISTORICO,
    simulados: [bat(TEMAS[0], 9, hoje), bat(TEMAS[1], 4, hoje)],
  };
  const linha = renderToStaticMarkup(
    <ResumoDesempenho historico={h} carregado onAbrir={() => {}} />,
  );
  checar(
    "a linha traz as três matérias, e não a média geral",
    TEMAS.every((t) => linha.includes(ROTULO_CURTO[t])) && !linha.includes("simulados ·"),
  );
  checar("cada matéria vem com o resultado dela", linha.includes("90%") && linha.includes("40%"));
  // A matéria ainda sem bateria aparece com travessão em vez de sumir: "ainda
  // não fiz Eletrônica" é a informação mais acionável para quem está começando.
  checar("a matéria não feita aparece mesmo assim", linha.includes("—"));
  // A cor sozinha não diz nada, e aqui ela já significa "matéria".
  checar("o alerta do corte vem escrito, não só em cor", linha.includes("abaixo do corte"));

  // Antes de ler o storage não pode haver número nenhum: o HTML da build e o
  // primeiro render do cliente têm de ser idênticos.
  const antes = renderToStaticMarkup(
    <ResumoDesempenho historico={h} carregado={false} onAbrir={() => {}} />,
  );
  checar("sem storage lido, nenhum número", !antes.includes("%"));
}


// --- De onde saiu o que está na tela --------------------------------------
// Quatro telas imprimiam o nome do arquivo cru — "Fonte: 2026-06-30
// CARTILHA-RADIOAMADOR-v9 2026-06.pdf · página 49", "SEI_ANATEL - 15307586 -
// Ato_orginal.pdf" — enquanto `ROTULO_ARQUIVO` já existia e a lista de
// material o usava na mesma sessão. E essa linha não fica no app: vai na
// revisão impressa e no que se compartilha no grupo.
{
  const CRUS = /\.pdf|SEI_ANATEL|CARTILHA-RADIOAMADOR|Ato_orginal/;

  // A garantia de raiz: todo arquivo que o banco cita tem rótulo. Sem isto, um
  // PDF novo volta a aparecer cru pelo `?? arquivo` do fallback.
  const semRotulo = [...new Set(BANCO.map((q) => q.arquivo_origem))].filter(
    (a) => !ROTULO_ARQUIVO[a],
  );
  checar(
    "todo arquivo do banco tem nome legível",
    semRotulo.length === 0,
    semRotulo.join(", "),
  );

  const doc = BANCO.find((q) => q.origem === "documento")!;
  const daEmenta = BANCO.find((q) => q.origem === "ementa");
  const linha = renderToStaticMarkup(
    <Fonte arquivo={doc.arquivo_origem} detalhe={`página ${doc.pagina}`} />,
  );
  checar("a fonte usa o rótulo curado", linha.includes(ROTULO_ARQUIVO[doc.arquivo_origem]));
  checar("e não o nome do arquivo", !CRUS.test(linha.replace(/title="[^"]*"/, "")));
  // O nome do arquivo continua acessível para quem for conferir contra o PDF
  // baixado — só sai da leitura.
  checar("o nome do arquivo fica no title", linha.includes(`title="${doc.arquivo_origem}"`));
  checar("o recorte dentro do documento continua", linha.includes(`página ${doc.pagina}`));

  // Questão de ementa não nasce de uma frase do PDF: a página explica o tema,
  // mas não traz o enunciado.
  if (daEmenta) {
    const ementa = renderToStaticMarkup(
      <Fonte arquivo={daEmenta.arquivo_origem} origem="ementa" />,
    );
    checar(
      "a questão de ementa não se diz fonte",
      ementa.includes("Estude o tema em:") && !ementa.includes("Fonte:"),
    );
  }

  // E nas quatro telas que a mostram.
  const erradas: Resposta[] = [
    { questao: doc, respondeu: !doc.resposta_correta, acertou: false },
  ];
  const gabarito = renderToStaticMarkup(
    <TelaResultado respostas={erradas} onReiniciar={() => {}} classe="B" />,
  );
  checar(
    "o gabarito não imprime o nome do arquivo",
    !CRUS.test(gabarito.replace(/title="[^"]*"/g, "")),
  );
  const ferramentas = renderToStaticMarkup(<TelaFerramentas onVoltar={() => {}} />);
  checar(
    "a consulta rápida não imprime o nome do arquivo",
    !CRUS.test(ferramentas.replace(/title="[^"]*"/g, "")),
  );
}


console.log(`\n${falhas === 0 ? "TODOS OS TESTES DE RENDER PASSARAM" : falhas + " FALHA(S)"}`);
process.exit(falhas === 0 ? 0 : 1);
