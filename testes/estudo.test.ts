import {
  mesclar,
  validar,
  MAX_SIMULADOS,
  VERSAO_HISTORICO,
  type Historico,
  type SimuladoSalvo,
} from "@/lib/historico";
import { lerSuspeitas, gravarSuspeitas } from "@/lib/suspeitas";
import { acervo, questoesParaRevisao, BANCO } from "@/lib/questoes";
import { REPO, urlDeReporte } from "@/lib/reportar";
import { resumoDeTexto, URL_PROJETO } from "@/lib/compartilhar";
import {
  FATOR_ESCALA,
  gravarPreferencias,
  lerPreferencias,
  PREFERENCIAS_PADRAO,
  validarPreferencias,
} from "@/lib/preferencias";

let falhas = 0;
function checar(nome: string, ok: boolean, detalhe = "") {
  if (!ok) falhas++;
  console.log(`${ok ? "  ok  " : "FALHA "} ${nome}${detalhe ? " — " + detalhe : ""}`);
}

function simulado(id: string, data: string, itens: SimuladoSalvo["itens"] = []): SimuladoSalvo {
  return {
    id,
    data,
    escolha: "Legislação de Telecomunicações",
    total: itens.length,
    acertos: itens.filter((i) => i.acertou).length,
    itens,
  };
}

function h(...simulados: SimuladoSalvo[]): Historico {
  return { versao: VERSAO_HISTORICO, simulados };
}

// --- mesclar: a união de dois aparelhos -----------------------------------
{
  const local = h(simulado("a", "2026-08-03"), simulado("b", "2026-08-01"));
  const backup = h(simulado("b", "2026-08-01"), simulado("c", "2026-08-02"));

  const unido = mesclar(local, backup);
  checar("mescla une sem duplicar por id", unido.simulados.length === 3);
  checar(
    "mescla ordena do mais recente ao mais antigo",
    unido.simulados.map((s) => s.id).join("") === "acb",
    unido.simulados.map((s) => s.id).join(","),
  );

  // Reimportar o próprio arquivo não pode mudar nada.
  const denovo = mesclar(unido, backup);
  checar("reimportar o mesmo arquivo é neutro", denovo.simulados.length === 3);

  // Em conflito de id, o registro local prevalece.
  const meu = simulado("x", "2026-08-04", [
    { questaoId: "q1", tema: "Legislação de Telecomunicações", acertou: true },
  ]);
  const estranho = simulado("x", "2026-08-04");
  const vence = mesclar(h(meu), h(estranho));
  checar("em empate de id, o registro local vence", vence.simulados[0].itens.length === 1);

  // O teto continua valendo depois da união.
  const muitos = h(
    ...Array.from({ length: MAX_SIMULADOS }, (_, i) =>
      simulado(`m${i}`, `2026-07-${String((i % 28) + 1).padStart(2, "0")}`),
    ),
  );
  const estourado = mesclar(muitos, h(simulado("novo", "2026-08-05")));
  checar(
    "união respeita o teto de simulados",
    estourado.simulados.length === MAX_SIMULADOS &&
      estourado.simulados[0].id === "novo",
  );
}

// --- validar: a porta de entrada de arquivos externos ---------------------
{
  checar("lixo não passa", validar("banana") === null && validar(null) === null);
  checar("versão desconhecida não passa", validar({ versao: 99, simulados: [] }) === null);
  const misto = validar({
    versao: VERSAO_HISTORICO,
    simulados: [simulado("ok", "2026-08-01"), { id: 123, quebrado: true }],
  });
  checar(
    "registro malformado é descartado em silêncio",
    misto !== null && misto.simulados.length === 1 && misto.simulados[0].id === "ok",
  );
}

// --- questoesParaRevisao: só os erros em aberto ---------------------------
{
  const [a, b, c] = acervo("B").slice(0, 3);
  const historico = h(
    // Mais recente: corrigiu a questão A, errou a B.
    simulado("s2", "2026-08-02", [
      { questaoId: a.id, tema: a.tema, acertou: true },
      { questaoId: b.id, tema: b.tema, acertou: false },
    ]),
    // Antes: tinha errado A e C; C nunca mais apareceu.
    simulado("s1", "2026-08-01", [
      { questaoId: a.id, tema: a.tema, acertou: false },
      { questaoId: c.id, tema: c.tema, acertou: false },
    ]),
  );

  const revisao = questoesParaRevisao(historico, "B");
  const ids = new Set(revisao.map((q) => q.id));
  checar("erro corrigido sai da revisão", !ids.has(a.id));
  checar("erro recente entra", ids.has(b.id));
  checar("erro antigo nunca corrigido continua", ids.has(c.id));
  checar("nada além dos erros em aberto", revisao.length === 2);

  // Um erro numa questão exclusiva da Classe A não entra na revisão da B.
  const qa = BANCO.find((q) => q.nivel === "A")!;
  const comA = h(
    simulado("s3", "2026-08-03", [
      { questaoId: qa.id, tema: qa.tema, acertou: false },
    ]),
  );
  checar(
    "revisão respeita o acervo da classe",
    questoesParaRevisao(comA, "B").length === 0 &&
      questoesParaRevisao(comA, "A").length === 1,
  );

  checar("histórico vazio revisa nada", questoesParaRevisao(h(), "B").length === 0);
}

// --- suspeitas: sem navegador, degrada em silêncio ------------------------
{
  checar("ler sem navegador devolve lista vazia", lerSuspeitas().length === 0);
  checar("gravar sem navegador só sinaliza", gravarSuspeitas(["x"]) === false);
}

// --- compartilhar: o resultado em uma linha -------------------------------
{
  const avulso = resumoDeTexto({
    classe: "B",
    tema: "Legislação de Telecomunicações",
    acertos: 17,
    total: 20,
    aprovado: true,
  });
  checar("traz classe, matéria e placar", avulso.includes("Classe B") && avulso.includes("17/20"));
  checar("calcula o percentual", avulso.includes("(85%)"));
  checar("dá o veredito", avulso.includes("Aprovado"));
  checar("leva o link do projeto", avulso.includes(URL_PROJETO));

  const reprovado = resumoDeTexto({ classe: "C", acertos: 5, total: 15, aprovado: false });
  checar("reprovação também é dita", reprovado.includes("Reprovado") && reprovado.includes("(33%)"));

  // Revisão não tem veredito: dizer "Reprovado" ali seria mentira.
  const revisao = resumoDeTexto({ classe: "B", acertos: 3, total: 8 });
  checar(
    "revisão não emite veredito",
    !revisao.includes("Aprovado") && !revisao.includes("Reprovado"),
  );

  const prova = resumoDeTexto({
    classe: "A",
    acertos: 60,
    total: 90,
    aprovado: false,
    materias: [
      { tema: "Legislação de Telecomunicações", acertos: 25, total: 30, aprovado: true },
      { tema: "Técnica e ética operacional", acertos: 20, total: 30, aprovado: true },
      { tema: "Conhecimentos de Eletrônica e Eletricidade", acertos: 15, total: 30, aprovado: false },
    ],
  });
  checar("prova completa lista as três matérias", prova.split("\n").length === 5);
  checar("e o veredito de cada uma", prova.includes("25/30") && prova.includes("reprovado"));

  checar("bateria vazia não divide por zero", resumoDeTexto({ classe: "B", acertos: 0, total: 0 }).includes("(0%)"));
}

// --- preferências: tema e tamanho de texto --------------------------------
{
  checar(
    "sem navegador, devolve o padrão",
    lerPreferencias().tema === "automatico" &&
      lerPreferencias().escala === "normal",
  );
  checar("gravar sem navegador só sinaliza", gravarPreferencias(PREFERENCIAS_PADRAO) === false);

  checar(
    "lixo cai no padrão",
    validarPreferencias("banana").tema === "automatico" &&
      validarPreferencias(null).escala === "normal",
  );
  checar(
    "valor desconhecido cai no padrão, campo a campo",
    validarPreferencias({ tema: "roxo", escala: "grande" }).tema === "automatico" &&
      validarPreferencias({ tema: "roxo", escala: "grande" }).escala === "grande",
  );
  checar(
    "os três temas e as três escalas são aceitos",
    (["claro", "escuro", "automatico"] as const).every(
      (t) => validarPreferencias({ tema: t }).tema === t,
    ) &&
      (["pequeno", "normal", "grande"] as const).every(
        (e) => validarPreferencias({ escala: e }).escala === e,
      ),
  );
  checar(
    "a escala normal não mexe no tamanho",
    FATOR_ESCALA.normal === 1 &&
      FATOR_ESCALA.pequeno < 1 &&
      FATOR_ESCALA.grande > 1,
  );
}

// --- reportar: a suspeita vira issue --------------------------------------
{
  const q = BANCO[0];
  const url = urlDeReporte(q);
  // Pelo `searchParams`, e não por `decodeURIComponent` da query crua: o
  // espaço é codificado como `+`, que só o parser de query desfaz.
  const params = new URL(url).searchParams;
  const corpo = `${params.get("title")}\n${params.get("body")}\nlabels=${params.get("labels")}`;

  checar("aponta para o repositório do projeto", url.startsWith(`https://github.com/${REPO}/issues/new?`));
  checar("leva o id, que sobrevive a regenerações do banco", corpo.includes(q.id));
  checar("leva a afirmação e o gabarito atual", corpo.includes(q.afirmacao));
  checar("leva a fonte e a página", corpo.includes(q.arquivo_origem) && corpo.includes(`página ${q.pagina}`));
  checar("classifica a issue", corpo.includes("labels=questao"));

  // Acento, & e # no enunciado não podem quebrar a URL nem virar outro
  // parâmetro de query.
  const travessa = {
    ...q,
    afirmacao: "Potência & frequência #1: a estação é operada às 3h?",
  };
  const complicada = urlDeReporte(travessa);
  checar(
    "afirmação com &, # e acento sobrevive à codificação",
    (new URL(complicada).searchParams.get("body") ?? "").includes(travessa.afirmacao),
  );
  checar(
    "e não injeta parâmetro novo na query",
    new URL(complicada).searchParams.get("labels") === "questao",
  );

  // Uma questão anormalmente longa não pode gerar um link que o GitHub recusa.
  const gigante = urlDeReporte({
    ...q,
    afirmacao: "a".repeat(9000),
    explicacao_curta: "b".repeat(9000),
  });
  checar("questão gigante ainda gera link utilizável", gigante.length <= 8000);
  checar("e o link reduzido continua identificando a questão", decodeURIComponent(gigante).includes(q.id));
}

console.log(`\n${falhas === 0 ? "TODOS OS TESTES DE ESTUDO PASSARAM" : falhas + " FALHA(S)"}`);
process.exit(falhas === 0 ? 0 : 1);
