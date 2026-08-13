import {
  bateriasDoDesafio,
  lerDesafio,
  linkDoDesafio,
  minutosDoDesafio,
  paramsDoDesafio,
  type Desafio,
} from "@/lib/desafio";
import {
  codigoDaBateria,
  hashDeTexto,
  mulberry32,
  normalizarSemente,
  randDaSemente,
  sementeLegivel,
} from "@/lib/semente";
import { disponiveis, sortearDesafio } from "@/lib/questoes";
import { FORMATO, TEMAS } from "@/lib/constantes";

let falhas = 0;
function checar(nome: string, ok: boolean, detalhe = "") {
  if (!ok) falhas++;
  console.log(`${ok ? "  ok  " : "FALHA "} ${nome}${detalhe ? " — " + detalhe : ""}`);
}

/**
 * O desafio por link só vale se for MESMO o mesmo: duas pessoas, dois
 * aparelhos, um link, uma bateria. Sem servidor, a única garantia disso é a
 * reprodutibilidade do sorteio — e é o que este arquivo cobra.
 */

// --- O gerador -------------------------------------------------------------
{
  const a = Array.from({ length: 8 }, mulberry32(42));
  const b = Array.from({ length: 8 }, mulberry32(42));
  const c = Array.from({ length: 8 }, mulberry32(43));
  checar("mesma semente, mesma sequência", a.join() === b.join());
  checar("semente diferente, sequência diferente", a.join() !== c.join());
  checar(
    "os valores ficam em [0, 1)",
    a.every((n) => n >= 0 && n < 1),
    a.slice(0, 3).join(", "),
  );
}

{
  checar("hash é estável", hashDeTexto("PY2-SP") === hashDeTexto("PY2-SP"));
  checar("hash distingue textos", hashDeTexto("PY2-SP") !== hashDeTexto("PY2-RJ"));
  // Quem digita o link à mão não pode receber outra bateria por causa da caixa.
  checar(
    "a semente normaliza caixa e espaços",
    normalizarSemente(" py2-sp ") === "PY2-SP",
  );
  const x = Array.from({ length: 5 }, randDaSemente("py2-sp"));
  const y = Array.from({ length: 5 }, randDaSemente("PY2-SP"));
  checar("semente em minúsculas dá o mesmo sorteio", x.join() === y.join());

  const legivel = sementeLegivel(mulberry32(1));
  checar("semente legível tem 6 caracteres", legivel.length === 6, legivel);
  checar(
    "semente legível não usa caracteres ambíguos",
    !/[O0I1]/.test(sementeLegivel(mulberry32(7), 200)),
  );
}

// --- A bateria do desafio --------------------------------------------------
const TEMA = TEMAS[0];
const SEMENTE = "PY2-SP";

{
  const ids = () =>
    sortearDesafio(TEMA, 20, "B", SEMENTE).map((q) => q.id).join();
  checar("mesma semente reproduz a bateria", ids() === ids());
  // A ordem também: uma bateria com as mesmas questões embaralhadas não é a
  // mesma prova para quem compara pergunta a pergunta.
  const primeira = sortearDesafio(TEMA, 20, "B", SEMENTE);
  const segunda = sortearDesafio(TEMA, 20, "B", SEMENTE);
  checar(
    "a ordem das questões também é a mesma",
    primeira.every((q, i) => q.id === segunda[i].id),
  );
  checar(
    "semente diferente, bateria diferente",
    sortearDesafio(TEMA, 20, "B", "OUTRA").map((q) => q.id).join() !== ids(),
  );
  checar(
    "a bateria respeita tema, classe e quantidade",
    primeira.length === 20 &&
      primeira.every((q) => q.tema === TEMA && q.nivel === "B"),
  );
  checar(
    "nenhuma questão se repete na bateria",
    new Set(primeira.map((q) => q.id)).size === primeira.length,
  );
  // Classe A é a única que sorteia o nível "A"; o desafio herda essa regra.
  checar(
    "desafio de Classe B nunca sorteia questão exclusiva da A",
    sortearDesafio(TEMAS[2], 20, "B", SEMENTE).every((q) => q.nivel === "B"),
  );

  // O histórico não é parâmetro: `sortearDesafio` não tem como consultá-lo, e
  // é isso que faz a bateria ser a mesma para quem estudou e para quem não.
  checar(
    "o sorteio do desafio não recebe histórico",
    sortearDesafio.length === 4,
    `aridade ${sortearDesafio.length}`,
  );
}

// --- O código da bateria ---------------------------------------------------
{
  const bateria = sortearDesafio(TEMA, 20, "B", SEMENTE);
  const ids = bateria.map((q) => q.id);
  checar(
    "o código é estável para a mesma bateria",
    codigoDaBateria(ids) === codigoDaBateria([...ids]),
  );
  // É o que denuncia banco divergente entre dois aparelhos.
  checar(
    "trocar uma questão muda o código",
    codigoDaBateria(ids) !== codigoDaBateria([...ids.slice(1), "outra"]),
  );
  checar(
    "a ordem faz parte do código",
    codigoDaBateria(ids) !== codigoDaBateria([...ids].reverse()),
  );
}

// --- A URL -----------------------------------------------------------------
{
  const d: Desafio = {
    semente: "PY2-SP",
    temas: [TEMA],
    quantidade: 20,
    classe: "B",
  };
  const link = linkDoDesafio(d, "https://exemplo.app/");
  checar(
    "o link traz os quatro parâmetros",
    ["desafio=PY2-SP", "t=legislacao", "n=20", "c=B"].every((s) =>
      link.includes(s),
    ),
    link,
  );
  const lido = lerDesafio(`?${paramsDoDesafio(d)}`);
  checar(
    "ida e volta pela URL preserva o desafio",
    JSON.stringify(lido) === JSON.stringify(d),
    JSON.stringify(lido),
  );
  checar(
    "o tema não viaja como índice do array",
    !paramsDoDesafio(d).includes("t=0"),
  );

  // Entrada de fora é entrada hostil: parâmetro inválido vira "não há desafio",
  // nunca uma bateria estranha nem uma tela quebrada.
  const invalidos: [string, string][] = [
    ["sem parâmetro nenhum", ""],
    ["sem semente", "?t=legislacao&n=20&c=B"],
    ["semente com espaço", "?desafio=py2 sp&t=legislacao&n=20&c=B"],
    ["tema desconhecido", "?desafio=X&t=morse&n=20&c=B"],
    ["classe inexistente", "?desafio=X&t=legislacao&n=20&c=D"],
    ["quantidade zero", "?desafio=X&t=legislacao&n=0&c=B"],
    ["quantidade negativa", "?desafio=X&t=legislacao&n=-5&c=B"],
    ["quantidade não numérica", "?desafio=X&t=legislacao&n=vinte&c=B"],
  ];
  for (const [nome, busca] of invalidos) {
    checar(`URL inválida ignorada: ${nome}`, lerDesafio(busca) === null);
  }

  // Absurdo é limitado, e do mesmo jeito nos dois aparelhos — senão o corte
  // salvaria a tela mas quebraria a comparação.
  const demais = lerDesafio("?desafio=X&t=legislacao&n=99999&c=B");
  checar(
    "quantidade acima do acervo cai para o acervo",
    demais?.quantidade === disponiveis(TEMA, "B"),
    String(demais?.quantidade),
  );
  checar(
    "a semente é normalizada na leitura",
    lerDesafio("?desafio=py2-sp&t=legislacao&n=10&c=B")?.semente === "PY2-SP",
  );
}

// --- Várias matérias no mesmo link -----------------------------------------
// A prova completa é um desafio com os três temas: cada matéria é um exame
// separado, e a quantidade é POR matéria.
{
  const tres: Desafio = {
    semente: "PY2-SP",
    temas: TEMAS,
    quantidade: 20,
    classe: "B",
  };
  const link = linkDoDesafio(tres, "https://exemplo.app/");
  checar(
    "o link lista as três matérias",
    link.includes("t=legislacao,tecnica,eletronica"),
    link,
  );
  const lido = lerDesafio(`?${paramsDoDesafio(tres)}`);
  checar(
    "ida e volta preserva as três",
    JSON.stringify(lido) === JSON.stringify(tres),
    JSON.stringify(lido?.temas),
  );
  checar(
    "as matérias voltam na ordem do exame, não na do link",
    JSON.stringify(
      lerDesafio("?desafio=X&t=eletronica,legislacao&n=10&c=B")?.temas,
    ) === JSON.stringify([TEMAS[0], TEMAS[2]]),
  );
  checar(
    "matéria desconhecida derruba o desafio inteiro",
    lerDesafio("?desafio=X&t=legislacao,morse&n=10&c=B") === null,
  );
  checar(
    "lista de matérias vazia não é desafio",
    lerDesafio("?desafio=X&t=&n=10&c=B") === null,
  );
  // O teto é o da matéria mais escassa: pedir 400 não pode dar baterias de
  // tamanhos diferentes entre as matérias.
  const demais = lerDesafio("?desafio=X&t=legislacao,tecnica&n=999&c=B");
  checar(
    "quantidade absurda cai no acervo da matéria mais escassa",
    demais?.quantidade ===
      Math.min(disponiveis(TEMAS[0], "B"), disponiveis(TEMAS[1], "B")),
    String(demais?.quantidade),
  );

  const baterias = bateriasDoDesafio(tres);
  checar(
    "o desafio rende uma bateria por matéria",
    baterias.length === 3 &&
      baterias.every((b, i) => b.tema === TEMAS[i] && b.questoes.length === 20),
  );
  checar(
    "cada bateria só tem questões da sua matéria",
    baterias.every((b) => b.questoes.every((q) => q.tema === b.tema)),
  );
  // Acrescentar uma matéria ao link não pode reembaralhar as que já estavam
  // lá: a semente de cada matéria deriva do slug dela.
  const so = bateriasDoDesafio({ ...tres, temas: [TEMAS[0]] });
  checar(
    "acrescentar matérias não muda a bateria das outras",
    JSON.stringify(so[0].questoes.map((q) => q.id)) ===
      JSON.stringify(baterias[0].questoes.map((q) => q.id)),
  );
  checar(
    "matérias diferentes não recebem o mesmo sorteio",
    baterias[0].questoes[0].id !== baterias[1].questoes[0].id,
  );
}

// --- O cronômetro ----------------------------------------------------------
{
  const oficial: Desafio = {
    semente: "X",
    temas: [TEMA],
    quantidade: FORMATO.B.questoes,
    classe: "B",
  };
  checar(
    "bateria do tamanho oficial dá o tempo oficial",
    minutosDoDesafio(oficial) === FORMATO.B.minutos,
    `${minutosDoDesafio(oficial)} min`,
  );
  checar(
    "metade das questões, metade do tempo",
    minutosDoDesafio({ ...oficial, quantidade: FORMATO.B.questoes / 2 }) ===
      FORMATO.B.minutos / 2,
  );
}

console.log(
  `\n${falhas === 0 ? "TODOS OS TESTES DE DESAFIO PASSARAM" : falhas + " FALHA(S)"}`,
);
process.exit(falhas === 0 ? 0 : 1);
