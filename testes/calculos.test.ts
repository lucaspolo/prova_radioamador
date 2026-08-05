import {
  analisarNumero,
  aplicarGanho,
  comprimentoDeOnda,
  comprimentoPratico,
  dbPotencia,
  dbTensao,
  dbmParaWatts,
  decodificarResistor,
  frequenciaDeComprimento,
  frequenciaRessonancia,
  meiaOnda,
  quartoDeOnda,
  reatanciaCapacitiva,
  reatanciaIndutiva,
  resistoresEmParalelo,
  resistoresEmSerie,
  resolverOhm,
  wattsParaDbm,
} from "@/lib/calculos";

let falhas = 0;
function checar(nome: string, ok: boolean, detalhe = "") {
  if (!ok) falhas++;
  console.log(`${ok ? "  ok  " : "FALHA "} ${nome}${detalhe ? " — " + detalhe : ""}`);
}

function perto(a: number | null, b: number, tol = 1e-9): boolean {
  return a !== null && Math.abs(a - b) <= tol;
}

// --- Lei de Ohm: os exemplos da própria Cartilha (p. 54) ------------------
{
  // "uma lâmpada com 110 V e 2,5 A dissipa P = 110 × 2,5 = 275 W"
  const lampada = resolverOhm({ v: 110, i: 2.5 });
  checar("lâmpada de 110 V e 2,5 A dissipa 275 W", perto(lampada?.p ?? null, 275, 1e-9));
  checar("e apresenta 44 Ω", perto(lampada?.r ?? null, 44, 1e-9));

  // "chuveiro que dissipa 2 kW com 200 V: R = V²/P = 20 Ω"
  const chuveiro = resolverOhm({ v: 200, p: 2000 });
  checar("chuveiro de 2 kW em 200 V tem 20 Ω", perto(chuveiro?.r ?? null, 20, 1e-9));
  checar("e puxa 10 A", perto(chuveiro?.i ?? null, 10, 1e-9));

  // Qualquer par das quatro grandezas descreve o mesmo circuito.
  const alvo = { v: 12, i: 3, r: 4, p: 36 };
  const pares: Partial<typeof alvo>[] = [
    { v: 12, i: 3 },
    { v: 12, r: 4 },
    { v: 12, p: 36 },
    { i: 3, r: 4 },
    { i: 3, p: 36 },
    { r: 4, p: 36 },
  ];
  checar(
    "os seis pares possíveis descrevem o mesmo circuito",
    pares.every((par) => {
      const r = resolverOhm(par);
      return (
        r !== null &&
        perto(r.v, alvo.v, 1e-9) &&
        perto(r.i, alvo.i, 1e-9) &&
        perto(r.r, alvo.r, 1e-9) &&
        perto(r.p, alvo.p, 1e-9)
      );
    }),
  );

  checar("uma grandeza só não resolve", resolverOhm({ v: 12 }) === null);
  checar("resistência negativa não existe", resolverOhm({ v: 12, r: -4 }) === null);
  checar(
    "resistência zero deixa a corrente indefinida",
    resolverOhm({ v: 12, r: 0 }) === null,
  );
  checar("nada informado não resolve", resolverOhm({}) === null);
}

// --- Associação de resistores (Cartilha p. 55) ----------------------------
{
  checar("três de 20 Ω em série dão 60 Ω", resistoresEmSerie([20, 20, 20]) === 60);
  checar("100 + 80 + 20 em série dão 200 Ω", resistoresEmSerie([100, 80, 20]) === 200);
  checar(
    "dez de 100 Ω em paralelo dão 10 Ω",
    perto(resistoresEmParalelo(Array(10).fill(100)), 10, 1e-9),
  );
  checar(
    "quatro de 16 Ω em paralelo dão 4 Ω",
    perto(resistoresEmParalelo([16, 16, 16, 16]), 4, 1e-9),
  );
  checar(
    "paralelo é sempre menor que a menor do grupo",
    (resistoresEmParalelo([10, 1000]) ?? Infinity) < 10,
  );
  checar("lista vazia não tem equivalente", resistoresEmSerie([]) === null);
  checar("resistência zero em paralelo é inválida", resistoresEmParalelo([0, 10]) === null);
}

// --- Código de cores: os exemplos da Cartilha (p. 55) --------------------
{
  // "Vermelha (2), verde (5), marrom (10¹) → 25 × 10¹ = 250 Ω"
  checar(
    "vermelho-verde-marrom = 250 Ω",
    decodificarResistor(["vermelho", "verde", "marrom"])?.ohms === 250,
  );
  // "Azul (6), amarelo (4), vermelho (10²) → 64 × 10² = 6400 Ω"
  checar(
    "azul-amarelo-vermelho = 6400 Ω",
    decodificarResistor(["azul", "amarelo", "vermelho"])?.ohms === 6400,
  );

  const kilo = decodificarResistor(["marrom", "preto", "vermelho", "ouro"]);
  checar("marrom-preto-vermelho-ouro = 1 kΩ", kilo?.ohms === 1000);
  checar("com tolerância de 5%", kilo?.tolerancia === 5);

  const cinco = decodificarResistor(["marrom", "preto", "preto", "marrom", "marrom"]);
  checar("cinco faixas: marrom-preto-preto-marrom-marrom = 1 kΩ ±1%",
    cinco?.ohms === 1000 && cinco?.tolerancia === 1);

  checar(
    "ouro não é dígito",
    decodificarResistor(["ouro", "preto", "vermelho", "ouro"]) === null,
  );
  checar("duas faixas não decodificam", decodificarResistor(["marrom", "preto"]) === null);
  checar(
    "tolerância inexistente invalida",
    decodificarResistor(["marrom", "preto", "vermelho", "laranja"]) === null,
  );
}

// --- Comprimento de onda: os exemplos da Cartilha (p. 28) ----------------
{
  checar("7 MHz dá λ ≈ 42,8 m", perto(comprimentoPratico(7), 42.857, 0.01));
  checar("145 MHz dá λ ≈ 2,07 m", perto(comprimentoPratico(145), 2.069, 0.01));
  checar(
    "a regra prática e a física diferem menos de 0,1%",
    Math.abs((comprimentoPratico(14)! - comprimentoDeOnda(14e6)!) / comprimentoDeOnda(14e6)!) < 0.001,
  );
  checar(
    "ida e volta entre frequência e comprimento fecha",
    perto(comprimentoDeOnda(frequenciaDeComprimento(20)!), 20, 1e-6),
  );
  checar("dipolo de meia onda em 14,2 MHz mede ~10,6 m", perto(meiaOnda(14.2), 10.563, 0.01));
  checar("vertical de quarto de onda em 145 MHz mede ~0,52 m", perto(quartoDeOnda(145), 0.517, 0.01));
  checar("frequência zero não tem comprimento", comprimentoDeOnda(0) === null);
  checar("frequência negativa também não", comprimentoPratico(-7) === null);
}

// --- Decibel --------------------------------------------------------------
{
  checar("1 W é 30 dBm", perto(wattsParaDbm(1), 30, 1e-9));
  checar("100 W é 50 dBm", perto(wattsParaDbm(100), 50, 1e-9));
  checar("0 dBm é 1 mW", perto(dbmParaWatts(0), 0.001, 1e-12));
  checar(
    "watts e dBm são inversos",
    perto(dbmParaWatts(wattsParaDbm(37)!), 37, 1e-9),
  );
  checar("dobrar a potência é +3 dB", perto(dbPotencia(50, 100), 3.0103, 1e-4));
  checar("dobrar a tensão é +6 dB", perto(dbTensao(1, 2), 6.0206, 1e-4));
  checar("+3 dB dobra a potência", perto(aplicarGanho(50, 3.0103), 100, 1e-3));
  checar("-3 dB reduz à metade", perto(aplicarGanho(100, -3.0103), 50, 1e-3));
  checar("potência zero não tem dB", dbPotencia(0, 100) === null);
  checar("potência negativa não tem dB", wattsParaDbm(-1) === null);

  // Amarra as duas metades da feature: o teto da Classe A, em dBm.
  checar("o limite de 1.500 W da Classe A é ~61,8 dBm", perto(wattsParaDbm(1500), 61.76, 0.01));
}

// --- Reatâncias e ressonância (Cartilha pp. 58-59) -----------------------
{
  const L = 1e-6; // 1 µH
  const C = 100e-12; // 100 pF
  const f0 = frequenciaRessonancia(L, C)!;
  checar("1 µH com 100 pF ressoa perto de 15,9 MHz", perto(f0 / 1e6, 15.915, 0.01));

  // O que a Cartilha afirma sobre o comportamento, sem constante mágica.
  checar(
    "XL cresce com a frequência",
    reatanciaIndutiva(2e6, L)! > reatanciaIndutiva(1e6, L)!,
  );
  checar(
    "XC cai com a frequência",
    reatanciaCapacitiva(2e6, C)! < reatanciaCapacitiva(1e6, C)!,
  );
  checar(
    "metade da indutância dá metade da reatância",
    perto(reatanciaIndutiva(1e6, L / 2), reatanciaIndutiva(1e6, L)! / 2, 1e-9),
  );
  // Na ressonância as duas reatâncias se igualam: prova que as três fórmulas
  // concordam entre si, sem depender de nenhum valor tabelado.
  const xl = reatanciaIndutiva(f0, L)!;
  const xc = reatanciaCapacitiva(f0, C)!;
  checar("na ressonância XL = XC", Math.abs(xl - xc) / xl < 1e-9, `${xl} vs ${xc}`);

  checar("capacitância zero não ressoa", frequenciaRessonancia(L, 0) === null);
  checar("indutância negativa não ressoa", frequenciaRessonancia(-1, C) === null);
}

// --- Entrada digitada em português ---------------------------------------
{
  checar("vírgula decimal é entendida", analisarNumero("2,5") === 2.5);
  checar("ponto decimal também", analisarNumero("2.5") === 2.5);
  checar("separador de milhar com decimal", analisarNumero("1.500,25") === 1500.25);
  checar("espaços não atrapalham", analisarNumero(" 42 ") === 42);
  checar("negativo passa", analisarNumero("-5") === -5);
  checar("notação científica passa", analisarNumero("1e3") === 1000);
  checar("campo vazio é ausência, não zero", analisarNumero("") === null);
  checar("texto não é número", analisarNumero("abc") === null);
  checar("número quebrado não passa", analisarNumero("1,2,3") === null);
  checar("só o sinal não passa", analisarNumero("-") === null);
}

console.log(`\n${falhas === 0 ? "TODOS OS TESTES DE CÁLCULO PASSARAM" : falhas + " FALHA(S)"}`);
process.exit(falhas === 0 ? 0 : 1);
