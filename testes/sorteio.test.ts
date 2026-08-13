import { sortearSimulado, disponiveis, contarPorTema, acervo, BANCO } from "@/lib/questoes";
import { TEMAS } from "@/lib/constantes";
import type { Tema } from "@/lib/tipos";

let falhas = 0;
function checar(nome: string, ok: boolean, detalhe = "") {
  if (!ok) falhas++;
  console.log(`${ok ? "  ok  " : "FALHA "} ${nome}${detalhe ? " — " + detalhe : ""}`);
}

const contagem = contarPorTema();
console.log("Banco:", BANCO.length, JSON.stringify(contagem, null, 0));
console.log();

// 1. Tamanho exato pedido
for (const n of [10, 20, 40, 60]) {
  const s = sortearSimulado(TEMAS[0], n);
  checar(`pede ${n}, recebe ${s.length}`, s.length === n);
}

// 2. Sem repetição dentro de uma mesma bateria
for (let i = 0; i < 200; i++) {
  const s = sortearSimulado(TEMAS[0], 60);
  if (new Set(s.map((q) => q.id)).size !== s.length) {
    checar("sem questões repetidas na bateria", false, `iteração ${i}`);
    break;
  }
  if (i === 199) checar("sem questões repetidas em 200 baterias de 60", true);
}

for (const tema of TEMAS) {
  const s = sortearSimulado(tema, 20);
  checar(
    `tema único "${tema.slice(0, 22)}" homogêneo`,
    s.length === 20 && s.every((q) => q.tema === tema),
  );
}

// 6. Pedir mais do que existe não estoura nem repete
{
  const tema: Tema = "Conhecimentos de Eletrônica e Eletricidade";
  const s = sortearSimulado(tema, 99999);
  checar(
    "pedir além do disponível devolve o máximo, sem repetir",
    s.length === contagem[tema] && new Set(s.map((q) => q.id)).size === s.length,
    `${s.length} de ${contagem[tema]}`,
  );
}

// 7. Sorteio realmente varia entre chamadas
{
  const a = sortearSimulado(TEMAS[0], 20).map((q) => q.id).join();
  const b = sortearSimulado(TEMAS[0], 20).map((q) => q.id).join();
  checar("duas baterias seguidas diferem", a !== b);
}

// disponiveis() bate com o acervo da classe padrão (B), que exclui o
// acréscimo técnico exclusivo da Classe A.
for (const t of TEMAS) checar(`disponiveis("${t.slice(0, 18)}")`, disponiveis(t) === contagem[t]);
checar(
  "a soma por tema é o acervo da Classe B",
  TEMAS.reduce((a, t) => a + disponiveis(t), 0) === acervo("B").length,
  `${acervo("B").length} de ${BANCO.length} no banco inteiro`,
);

// 10. Integridade do banco consumido pelo app
{
  const ok = BANCO.every(
    (q) =>
      typeof q.id === "string" &&
      TEMAS.includes(q.tema) &&
      typeof q.resposta_correta === "boolean" &&
      q.afirmacao.length > 0 &&
      q.explicacao_curta.length > 0 &&
      Number.isInteger(q.pagina) &&
      q.pagina >= 1 &&
      (q.origem === "documento" || q.origem === "ementa") &&
      (q.nivel === "B" || q.nivel === "A"),
  );
  checar("todas as questões do banco têm formato válido", ok);

  // Os ids são derivados da afirmação, e não sorteados: regerar o banco
  // preserva a ligação com o histórico guardado no navegador.
  checar("ids são únicos", new Set(BANCO.map((q) => q.id)).size === BANCO.length);
  checar(
    "ids são determinísticos (hex de 16 caracteres)",
    BANCO.every((q) => /^[0-9a-f]{16}$/.test(q.id)),
  );

  const daEmenta = BANCO.filter((q) => q.origem === "ementa").length;
  checar(
    "banco mistura questões dos documentos e da ementa",
    daEmenta > 0 && daEmenta < BANCO.length,
    `${BANCO.length - daEmenta} de documentos, ${daEmenta} da ementa`,
  );
}

// --- Peso próprio: a questão repetitiva não toma conta da bateria ----------
//
// As 39 questões do plano de bandas seguem todas o mesmo molde. São necessárias
// — sem uma por linha, faixa fica sem cobrança —, mas no peso 1 seriam 11% do
// acervo de Legislação e cairiam umas duas por bateria de 20, ensinando a
// reconhecer a forma. Com peso 0,3 a média fica abaixo de uma por bateria.
//
// O teste é estatístico, então mede um efeito grosseiro: a folga entre 1,5 e a
// média real (~0,74) é de muitos desvios-padrão em 400 baterias, e o que ele
// pega é o peso ter deixado de ser aplicado, não uma flutuação.
{
  const comPeso = new Set(BANCO.filter((q) => q.peso !== undefined).map((q) => q.id));
  checar("o banco declara questões de peso reduzido", comPeso.size > 0, `${comPeso.size} questões`);

  const tema: Tema = "Legislação de Telecomunicações";
  const noAcervo = acervo().filter((q) => q.tema === tema);
  const proporcaoUniforme = (20 * noAcervo.filter((q) => comPeso.has(q.id)).length) / noAcervo.length;

  const rodadas = 400;
  let total = 0;
  for (let i = 0; i < rodadas; i++) {
    total += sortearSimulado(tema, 20).filter((q) => comPeso.has(q.id)).length;
  }
  const media = total / rodadas;

  checar(
    "questão de peso baixo aparece menos que no sorteio uniforme",
    media < proporcaoUniforme * 0.6,
    `${media.toFixed(2)} por bateria, contra ${proporcaoUniforme.toFixed(2)} se todas pesassem igual`,
  );
  // Reduzir não é excluir: se sumissem, as faixas raras deixariam de ser
  // cobradas e a cobertura que o passe de tabela garante viraria enfeite.
  checar("mas continua aparecendo", media > 0.2, `${media.toFixed(2)} por bateria`);
}

// 9. Modo "só inéditas": cobre o que o sorteio ponderado não garante
{
  const tema: Tema = "Legislação de Telecomunicações";
  const doTema = acervo("B").filter((q) => q.tema === tema);
  // Vistas: todas menos 15 — sobra um resto inédito conhecido.
  const vistas = doTema.slice(0, doTema.length - 15);
  const idsVistas = new Set(vistas.map((q) => q.id));
  const historico = {
    versao: 1,
    simulados: [
      {
        id: "cobertura",
        data: "2026-08-01T00:00:00.000Z",
        escolha: tema,
        total: vistas.length,
        acertos: vistas.length,
        itens: vistas.map((q) => ({
          questaoId: q.id,
          tema: q.tema,
          acertou: true,
        })),
      },
    ],
  };

  const so = sortearSimulado(tema, 10, historico, "B", { soIneditas: true });
  checar(
    "com inéditas de sobra, a bateria sai só delas",
    so.length === 10 && so.every((q) => !idsVistas.has(q.id)),
  );

  const cheia = sortearSimulado(tema, 20, historico, "B", { soIneditas: true });
  checar("faltando inéditas, a bateria ainda sai completa", cheia.length === 20);
  checar(
    "as 15 inéditas restantes entram todas",
    cheia.filter((q) => !idsVistas.has(q.id)).length === 15,
  );
  checar(
    "o completamento não repete questão",
    new Set(cheia.map((q) => q.id)).size === 20,
  );
}

console.log(`\n${falhas === 0 ? "TODOS OS TESTES PASSARAM" : falhas + " FALHA(S)"}`);
process.exit(falhas === 0 ? 0 : 1);
