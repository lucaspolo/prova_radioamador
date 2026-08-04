import { acervo, sortearSimulado, disponiveis, contarPorTema, BANCO } from "@/lib/questoes";
import { CLASSES, FORMATO, PERCENTUAL_CORTE, percentualAprovacao, tamanhos } from "@/lib/constantes";
import type { Classe, Tema } from "@/lib/tipos";

let falhas = 0;
function checar(nome: string, ok: boolean, detalhe = "") {
  if (!ok) falhas++;
  console.log(`${ok ? "  ok  " : "FALHA "} ${nome}${detalhe ? " — " + detalhe : ""}`);
}

const nivelA = BANCO.filter((q) => q.nivel === "A");
const nivelB = BANCO.filter((q) => q.nivel === "B");
console.log(`Banco: ${BANCO.length} — nível B: ${nivelB.length}, nível A: ${nivelA.length}\n`);

// --- Formato oficial de cada classe (Ato nº 3448/2026, item 11.3) ---------
{
  checar("Classe C: 15 questões, mínimo 8, 20 min",
    FORMATO.C.questoes === 15 && FORMATO.C.minimo === 8 && FORMATO.C.minutos === 20);
  checar("Classe B: 20 questões, mínimo 11, 30 min",
    FORMATO.B.questoes === 20 && FORMATO.B.minimo === 11 && FORMATO.B.minutos === 30);
  checar("Classe A: 30 questões, mínimo 16, 40 min",
    FORMATO.A.questoes === 30 && FORMATO.A.minimo === 16 && FORMATO.A.minutos === 40);

  checar("percentual de corte por classe",
    percentualAprovacao("C") === 53 && percentualAprovacao("B") === 55 && percentualAprovacao("A") === 53,
    `${percentualAprovacao("C")}/${percentualAprovacao("B")}/${percentualAprovacao("A")}`);

  // O dashboard mistura simulados de classes diferentes, então usa o corte
  // mais exigente: quem passa dele passa em qualquer classe.
  checar("linha de corte do dashboard é a mais exigente",
    CLASSES.every((c) => PERCENTUAL_CORTE >= percentualAprovacao(c)));

  // A bateria "prova real" precisa estar entre as opções, senão o rótulo
  // apontaria para um botão que não existe.
  checar("as opções de tamanho incluem a prova real da classe",
    CLASSES.every((c) => tamanhos(c).includes(FORMATO[c].questoes)),
    CLASSES.map((c) => tamanhos(c).join("/")).join("  "));
}

// --- Elegibilidade: o acréscimo da Classe A não cai em B nem em C ---------
{
  checar("o banco tem questões exclusivas da Classe A", nivelA.length > 0, `${nivelA.length}`);

  checar("acervo da Classe A inclui tudo", acervo("A").length === BANCO.length);
  checar("acervo da Classe B exclui o nível A", acervo("B").length === nivelB.length);
  checar("acervo da Classe C é o mesmo da B", acervo("C").length === acervo("B").length);

  checar("nenhuma questão de nível A no acervo da B",
    acervo("B").every((q) => q.nivel === "B"));

  // A garantia que realmente importa: sortear 300 baterias de Classe B e não
  // ver uma única questão do acréscimo técnico da Classe A.
  const idsA = new Set(nivelA.map((q) => q.id));
  let vazou = 0;
  for (let i = 0; i < 300; i++) {
    for (const q of sortearSimulado("todos", 20, undefined, "B")) {
      if (idsA.has(q.id)) vazou++;
    }
  }
  checar("300 baterias de Classe B não trazem conteúdo da Classe A", vazou === 0, `${vazou} vazamentos`);

  // E o simulado de A precisa realmente alcançar o conteúdo novo, senão a
  // classe existiria só no rótulo.
  const tema: Tema = "Conhecimentos de Eletrônica e Eletricidade";
  let comA = 0;
  for (let i = 0; i < 200; i++) {
    if (sortearSimulado(tema, 30, undefined, "A").some((q) => idsA.has(q.id))) comA++;
  }
  checar("simulado de Eletrônica da Classe A cobra o conteúdo novo", comA > 190, `${comA}/200 baterias`);
}

// --- O sorteio continua íntegro em todas as classes ------------------------
{
  for (const classe of CLASSES) {
    const n = FORMATO[classe].questoes * 3;
    const s = sortearSimulado("todos", n, undefined, classe);
    const porTema = TEMAS_DE(s);
    checar(
      `Classe ${classe}: bateria de ${n} traz ${FORMATO[classe].questoes} de cada matéria`,
      s.length === n && porTema.every((k) => k === FORMATO[classe].questoes),
      porTema.join("/"),
    );
    checar(`Classe ${classe}: sem repetição`, new Set(s.map((q) => q.id)).size === s.length);
  }

  function TEMAS_DE(s: { tema: Tema }[]): number[] {
    const temas: Tema[] = [
      "Legislação de Telecomunicações",
      "Técnica e ética operacional",
      "Conhecimentos de Eletrônica e Eletricidade",
    ];
    return temas.map((t) => s.filter((q) => q.tema === t).length);
  }
}

// --- Contagens acompanham a classe ---------------------------------------
{
  const tema: Tema = "Conhecimentos de Eletrônica e Eletricidade";
  const eletA = contarPorTema("A")[tema];
  const eletB = contarPorTema("B")[tema];
  checar("Eletrônica da Classe A tem mais questões que a da B", eletA > eletB, `${eletA} vs ${eletB}`);

  // O acréscimo é só de Eletrônica: a ementa das outras duas matérias é a
  // mesma para as três classes no item 11.4.
  const outras: Tema[] = ["Legislação de Telecomunicações", "Técnica e ética operacional"];
  checar("Legislação e Técnica não mudam entre classes",
    outras.every((t) => contarPorTema("A")[t] === contarPorTema("B")[t]));

  checar("disponiveis() respeita a classe",
    disponiveis("todos", "A") > disponiveis("todos", "B"));
  checar("sem classe, comporta-se como Classe B",
    disponiveis("todos") === disponiveis("todos", "B"));
}

// --- As questões da Classe A são de Eletrônica e vieram da ementa ---------
{
  checar("todo o acréscimo da Classe A é de Eletrônica",
    nivelA.every((q) => q.tema === "Conhecimentos de Eletrônica e Eletricidade"));
  // Elas não saem de um trecho de PDF: são geradas do acréscimo da ementa.
  checar("acréscimo da Classe A não finge ter trecho de origem",
    nivelA.every((q) => q.origem === "ementa" && !q.trecho_id));
}

console.log(`\n${falhas === 0 ? "TODOS OS TESTES DE CLASSE PASSARAM" : falhas + " FALHA(S)"}`);
process.exit(falhas === 0 ? 0 : 1);

export type { Classe };
