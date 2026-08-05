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

console.log(`\n${falhas === 0 ? "TODOS OS TESTES DE ESTUDO PASSARAM" : falhas + " FALHA(S)"}`);
process.exit(falhas === 0 ? 0 : 1);
