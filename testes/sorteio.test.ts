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

console.log(`\n${falhas === 0 ? "TODOS OS TESTES PASSARAM" : falhas + " FALHA(S)"}`);
process.exit(falhas === 0 ? 0 : 1);
