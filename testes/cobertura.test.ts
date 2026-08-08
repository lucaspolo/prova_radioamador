import { BANCO } from "@/lib/questoes";
import { TABELAS } from "@/lib/referencia";

let falhas = 0;
function checar(nome: string, ok: boolean, detalhe = "") {
  if (!ok) falhas++;
  console.log(`${ok ? "  ok  " : "FALHA "} ${nome}${detalhe ? " — " + detalhe : ""}`);
}

function norm(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/x[ -]?ray/g, "x-ray");
}

// Texto pesquisável de cada questão: a cobertura vale se a letra/código é
// objeto da afirmação ou aparece corrigida na explicação (nas falsas, a
// palavra certa mora na explicação).
const TEXTOS = BANCO.map((q) => norm(`${q.afirmacao} ${q.explicacao_curta}`));

// --- Alfabeto fonético da UIT: as 26 letras (Cartilha, pp. 34-35) ----------
{
  const FONETICO: Record<string, string> = {
    A: "alfa", B: "bravo", C: "charlie", D: "delta", E: "echo", F: "foxtrot",
    G: "golf", H: "hotel", I: "india", J: "juliett", K: "kilo", L: "lima",
    M: "mike", N: "november", O: "oscar", P: "papa", Q: "quebec", R: "romeo",
    S: "sierra", T: "tango", U: "uniform", V: "victor", W: "whiskey",
    X: "x-ray", Y: "yankee", Z: "zulu",
  };

  // Só conta questão que é de fato sobre soletração, senão "Lima" (cidade) ou
  // "papa" em outro contexto dariam cobertura falsa.
  const deAlfabeto = TEXTOS.filter((t) => /fonetic|soletra/.test(t));
  const faltam = Object.entries(FONETICO)
    .filter(([, palavra]) =>
      !deAlfabeto.some((t) => new RegExp(`\\b${palavra}\\b`).test(t)),
    )
    .map(([letra]) => letra);

  checar(
    "todas as 26 letras do alfabeto fonético têm questão",
    faltam.length === 0,
    faltam.length ? `faltam: ${faltam.join(" ")}` : `${deAlfabeto.length} questões de soletração`,
  );
}

// --- Código Q: os 28 usuais do radioamadorismo (Cartilha, p. 36) -----------
{
  const CODIGOS = [
    // os 11 da tabela da Cartilha
    "QRA", "QRG", "QTH", "QSL", "QRO", "QTC", "QRM", "QRP", "QRV", "QRT", "QSA",
    // demais usuais da série QRA-QUZ reservada ao radioamadorismo
    "QRH", "QRI", "QRK", "QRL", "QRN", "QRQ", "QRS", "QRU", "QRX", "QRZ",
    "QSB", "QSD", "QSK", "QSO", "QSP", "QSY", "QTR",
  ];
  checar("a lista cobre os 28 códigos usuais", CODIGOS.length === 28);

  const faltam = CODIGOS.filter(
    (c) => !TEXTOS.some((t) => new RegExp(`\\b${c.toLowerCase()}\\b`).test(t)),
  );
  checar(
    "todos os 28 códigos Q usuais têm questão",
    faltam.length === 0,
    faltam.length ? `faltam: ${faltam.join(" ")}` : "cobertura completa",
  );

  // Cada código precisa ser OBJETO de uma questão, não só citado de passagem
  // na explicação de outra: a afirmação é o que o simulado exercita.
  const soDePassagem = CODIGOS.filter(
    (c) => !BANCO.some((q) => new RegExp(`\\b${c}\\b`).test(q.afirmacao)),
  );
  checar(
    "cada código aparece na afirmação de alguma questão",
    soDePassagem.length === 0,
    soDePassagem.length ? `só de passagem: ${soDePassagem.join(" ")}` : "",
  );
}

// As duas listas seguintes não são redigitadas aqui: saem de `lib/referencia.ts`,
// que `testes/referencia.test.ts` já confere linha a linha contra o PDF. Assim a
// tabela que o app mostra na consulta rápida e a lista que o simulado precisa
// exercitar são o mesmo dado — se a Anatel mudar uma faixa, muda num lugar só.
//
// O recorte é Legislação: faixa e prefixo são matéria dessa prova. Sem ele,
// "em 30 MHz o comprimento de onda é 30 m" — cálculo de Eletrônica — daria
// cobertura falsa à faixa de 30 metros.
const LEGISLACAO = BANCO.filter((q) => q.tema === "Legislação de Telecomunicações")
  .map((q) => norm(`${q.afirmacao} ${q.explicacao_curta}`));

// --- Prefixos de indicativo: as 27 UFs (Ato nº 3448/2026, Tabela II, pp. 8-9) --
{
  const tabela = TABELAS.find((t) => t.id === "prefixos");
  if (!tabela) throw new Error("tabela de prefixos sumiu de lib/referencia.ts");
  const UFS = tabela.linhas.map((l) => l.celulas[0]);
  checar("a tabela cobre as 27 unidades da federação", UFS.length === 27);

  // Citar o estado não basta: "Minas Gerais compõe a Região 1" ensina região, e
  // não o prefixo. O que a Tabela II tem de cobrável é a ligação UF -> prefixo,
  // então a questão só conta se trouxer as duas coisas.
  const RE_PREFIXO = /\bp[pqrstuvwy] ?\d\b/;
  const faltam = UFS.filter(
    (uf) => !LEGISLACAO.some((t) => t.includes(norm(uf)) && RE_PREFIXO.test(t)),
  );

  checar(
    "todas as 27 UFs têm questão ligando a unidade ao seu prefixo",
    faltam.length === 0,
    faltam.length ? `faltam ${faltam.length}: ${faltam.join(", ")}` : "cobertura completa",
  );
}

// --- Plano de bandas: as faixas da Tabela I do Ato nº 926/2024 (pp. 3-4) ------
{
  const tabela = TABELAS.find((t) => t.id === "bandas");
  if (!tabela) throw new Error("tabela de bandas sumiu de lib/referencia.ts");

  // A Tabela I repete a faixa a cada subfaixa (160 metros aparece duas vezes,
  // uma por classe habilitada). Aqui a unidade de cobertura é a faixa.
  const FAIXAS = [...new Set(tabela.linhas.map((l) => l.celulas[0]))];

  const ABREVIACAO: Record<string, string> = {
    metro: "m", centimetro: "cm", milimetro: "mm",
  };
  const numero = (n: string) => n.replace(/\./g, "[.]?").replace(/,/g, "[,.]");

  /** "Faixa de 1,3 metro" -> casa "1,3 metro", "1,3 metros" e "1,3 m". */
  function reNome(faixa: string): RegExp {
    const [valor, unidade] = norm(faixa).replace(/^faixa d[eo]s? /, "").split(" ");
    const base = unidade.replace(/s$/, "");
    return new RegExp(`\\b${numero(valor)} ?(${base}s?|${ABREVIACAO[base] ?? base})\\b`);
  }

  /**
   * Casa a faixa pelos limites da subfaixa, para a questão que dá a frequência
   * sem nomear a faixa. Exige os DOIS extremos e a unidade: só o extremo
   * superior confundiria os 80 metros (3.500 - 3.800 kHz) com o limite de
   * e.i.r.p. dos 9 centímetros (3.400 a 3.500 MHz).
   */
  function reFrequencias(subfaixa: string): RegExp[] {
    const limites = norm(subfaixa).match(/[\d.,]+/g) ?? [];
    const unidade = norm(subfaixa).match(/[kmg]hz/)?.[0];
    if (limites.length < 2 || !unidade) return [];
    return [...limites.map((l) => new RegExp(`\\b${numero(l)}\\b`)), new RegExp(unidade)];
  }

  const faltam = FAIXAS.filter((faixa) => {
    const nome = reNome(faixa);
    const subfaixas = tabela.linhas
      .filter((l) => l.celulas[0] === faixa)
      .map((l) => reFrequencias(l.celulas[1]))
      .filter((res) => res.length > 0);
    return !LEGISLACAO.some(
      (t) => nome.test(t) || subfaixas.some((res) => res.every((re) => re.test(t))),
    );
  });

  checar(
    "todas as faixas do plano de bandas têm questão",
    faltam.length === 0,
    faltam.length
      ? `faltam ${faltam.length} de ${FAIXAS.length}: ${faltam.join(", ")}`
      : `${FAIXAS.length} faixas cobertas`,
  );
}

// --- Coerência: o prefixo citado é mesmo o da UF nomeada ---------------------
//
// Cobertura sem conferência não serve: o passe de tabela monta a questão falsa
// trocando o valor de uma linha pelo de outra ("em Rondônia, PU 8 TAA a VZZ",
// que é de Roraima), e se o modelo trocasse e rotulasse VERDADEIRA o app
// ensinaria um dado regulatório errado com cara de gabarito.
//
// Só a afirmação entra. A explicação de uma questão falsa cita o prefixo alheio
// de propósito, para dizer de quem ele é, e olhá-la aqui acusaria toda falsa
// bem escrita.
{
  const tabela = TABELAS.find((t) => t.id === "prefixos");
  if (!tabela) throw new Error("tabela de prefixos sumiu de lib/referencia.ts");

  // "PY 2 AA a ZZ" e "PU 8 JAA a LZZ": prefixo, dígito da região e a faixa de
  // sufixos. Tolera o espaço que some na quebra de linha do PDF. O "e" no lugar
  // do "a" é do próprio Ato, na linha de São Paulo.
  const TOKEN = /p[pqrstuvwy] ?\d ?[a-z]{2,3} [ae] [a-z]{2,3}/g;
  // Onde a frase deixa de falar das classes A/B e passa a falar da C.
  const VIRA_C = /classes? ?["'“]?c["'”]?/;
  const CITA_AB = /classes? ?["'“]?[ab]["'”]?/;
  const achatar = (t: string) => norm(t).replace(/\s+/g, " ");
  const tokens = (t: string) =>
    new Set((achatar(t).match(TOKEN) ?? []).map((x) => x.replace(/\s+/g, " ")));

  // As duas colunas, separadas. Fundi-las era o buraco: todo prefixo da questão
  // "em São Paulo a Classe C usa PY 2 AAA a YZZ" é de São Paulo, e o teste
  // passava — mas PY 2 AAA a YZZ é das classes A/B, e a questão estava marcada
  // como verdadeira. Treze questões assim entraram no banco.
  // A UF é casada COM acento e com fronteira de palavra. Sem o acento, "Pará"
  // vira "para" e casa com a preposição de "para a Classe C": quase toda
  // questão de prefixo aparecia com duas UFs e caía na exceção logo abaixo,
  // pulada em silêncio. O contador de conferidas é o que denuncia isso.
  const LETRA = "a-záàâãéêíóôõúüç";
  const comAcento = (t: string) => t.toLowerCase().replace(/\s+/g, " ");
  const nomeia = (texto: string, uf: string) =>
    new RegExp(`(^|[^${LETRA}])${uf}([^${LETRA}]|$)`).test(comAcento(texto));

  const porUf = new Map(
    tabela.linhas.map((l) => [
      comAcento(l.celulas[0]),
      { ab: tokens(l.celulas[1]), c: tokens(l.celulas[2]) },
    ]),
  );
  const universo = new Set(
    [...porUf.values()].flatMap((x) => [...x.ab, ...x.c]),
  );

  const inventados: string[] = [];
  const alheios: string[] = [];
  let conferidas = 0;

  for (const q of BANCO) {
    const citados = tokens(q.afirmacao);
    if (citados.size === 0) continue;

    for (const t of citados) {
      if (!universo.has(t)) inventados.push(`${t} (${q.id})`);
    }

    // Com duas UFs na mesma afirmação não dá para saber a quem o prefixo se
    // refere sem interpretar a frase; essas ficam de fora.
    const afirmacao = achatar(q.afirmacao);
    const citadas = [...porUf.keys()].filter((uf) => nomeia(q.afirmacao, uf));
    // "Mato Grosso" é nome inteiro dentro de "Mato Grosso do Sul": vale a mais
    // específica, senão a única questão sobre o Sul nunca seria conferida.
    const nomeadas = citadas.filter(
      (uf) => !citadas.some((outra) => outra !== uf && outra.includes(uf)),
    );
    if (nomeadas.length !== 1) continue;
    conferidas++;

    const daUf = porUf.get(nomeadas[0])!;
    const fora = [...citados].filter((t) => !daUf.ab.has(t) && !daUf.c.has(t));

    // A que classe a frase atribui cada prefixo. O que vem antes de "classe C"
    // é reivindicado para A/B; o que vem depois, para a C. Sem a marca da C,
    // mas com a de A/B, a frase inteira fala de A/B.
    const corte = afirmacao.search(VIRA_C);
    const trocados: string[] = [];
    if (corte >= 0) {
      for (const t of tokens(afirmacao.slice(0, corte))) {
        if (daUf.c.has(t)) trocados.push(`${t} é da C`);
      }
      for (const t of tokens(afirmacao.slice(corte))) {
        if (daUf.ab.has(t)) trocados.push(`${t} é de A/B`);
      }
    } else if (CITA_AB.test(afirmacao)) {
      for (const t of citados) {
        if (daUf.c.has(t)) trocados.push(`${t} é da C`);
      }
    }

    // Nos dois sentidos. Só cobrar a verdadeira deixaria passar o inverso — a
    // afirmação correta marcada como falsa —, que foi exatamente o erro que
    // entrou no plano de bandas: a falsa era montada trocando o valor por
    // outro da MESMA chave, e o resultado era verdadeiro.
    if (q.resposta_correta && (fora.length || trocados.length)) {
      alheios.push(
        `V errada — ${nomeadas[0]}: ${fora[0] ?? trocados[0]} (${q.id})`,
      );
    }
    // Uma falsa precisa errar em alguma coisa: prefixo de outra UF ou prefixo
    // na classe errada. Sem nenhum dos dois, ela é verdadeira e o gabarito está
    // invertido.
    if (!q.resposta_correta && fora.length === 0 && trocados.length === 0) {
      alheios.push(`F sem erro nenhum — ${nomeadas[0]} (${q.id})`);
    }
  }

  checar(
    "nenhuma questão cita prefixo que não existe na Tabela II",
    inventados.length === 0,
    inventados.length ? inventados.slice(0, 4).join("; ") : "",
  );
  checar(
    "gabarito de prefixo confere com a Tabela II, UF e classe",
    alheios.length === 0,
    alheios.length
      ? `${alheios.length}: ` + alheios.slice(0, 4).join("; ")
      : `${conferidas} questões conferidas contra a Tabela II`,
  );
}

// --- Coerência: subfaixa e classes conferem com a Tabela I -------------------
//
// Este teste nasceu de um gabarito errado que passou. A regra que monta a
// questão falsa trocava o valor "pelo de outra linha da tabela", e numa faixa
// com mais de uma subfaixa a linha vizinha é da MESMA faixa: saía "na Faixa de
// 4 milímetros, a radiofrequência é 77,5 - 78 GHz" marcada como falsa, sendo
// que 77,5 - 78 GHz é subfaixa dos 4 milímetros. Cinco questões assim entraram
// no banco antes de alguém reparar.
//
// Só entram as questões que nomeiam UMA faixa, dão um par de frequências e
// declaram as classes. Exigir as classes é o que torna a regra utilizável: sem
// isso, "o segmento 434,000-435,000 MHz é de entradas de repetidoras" — correto,
// e vindo das tabelas detalhadas do Ato 926, não da Tabela I — e a conta de
// eletrônica "30 MHz corresponde a 10 m" caem aqui como falsos alarmes.
{
  const tabela = TABELAS.find((t) => t.id === "bandas");
  if (!tabela) throw new Error("tabela de bandas sumiu de lib/referencia.ts");

  const achatar = (t: string) => norm(t).replace(/\s+/g, " ");
  /** "1.800" e "5.351,5" viram "1800" e "5351.5": comparáveis como escritos. */
  const numeros = (t: string) =>
    (t.match(/\d[\d.,]*/g) ?? []).map((n) => n.replace(/\./g, "").replace(/,/g, "."));

  type Classes = "TODAS" | "AB" | "A" | null;
  const classesDaCelula = (c: string): Classes => {
    const t = achatar(c);
    return t.includes("todas") ? "TODAS" : t.includes("a e b") ? "AB" : t === "a" ? "A" : null;
  };
  const classesDitas = (t: string): Classes =>
    t.includes("todas as classes") ? "TODAS"
    : /classes? a e b\b|\bclasse b\b/.test(t) ? "AB"
    : /\bclasse a\b/.test(t) ? "A"
    : null;

  const linhas = tabela.linhas
    .map((l) => ({
      faixa: achatar(l.celulas[0]),
      limites: numeros(l.celulas[1]).slice(0, 2),
      classes: classesDaCelula(l.celulas[2]),
    }))
    .filter((l) => l.limites.length === 2);

  const divergentes: string[] = [];
  let avaliadas = 0;

  for (const q of BANCO) {
    const a = achatar(q.afirmacao);
    const nomeadas = linhas.filter((l) => a.includes(l.faixa));
    const ditas = classesDitas(a);
    if (ditas === null) continue;
    const faixas = new Set(nomeadas.map((l) => l.faixa));
    if (faixas.size !== 1) continue;

    const n = numeros(q.afirmacao);
    const pares = new Set(n.slice(0, -1).map((x, i) => `${x}|${n[i + 1]}`));
    if (pares.size === 0) continue;

    avaliadas++;
    const verdadeira = nomeadas.some(
      (l) => pares.has(`${l.limites[0]}|${l.limites[1]}`) && l.classes === ditas,
    );
    if (verdadeira !== q.resposta_correta) {
      divergentes.push(`${q.id} (gabarito ${q.resposta_correta ? "V" : "F"})`);
    }
  }

  checar(
    "gabarito de subfaixa e classes confere com a Tabela I",
    divergentes.length === 0,
    divergentes.length
      ? divergentes.slice(0, 5).join("; ")
      : `${avaliadas} questões conferidas contra a Tabela I`,
  );
}

console.log(`\n${falhas === 0 ? "TODOS OS TESTES DE COBERTURA PASSARAM" : falhas + " FALHA(S)"}`);
process.exit(falhas === 0 ? 0 : 1);
