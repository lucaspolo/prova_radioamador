/**
 * As contas que a ementa de Eletrônica cobra, como funções puras.
 *
 * Duas regras valem para o arquivo inteiro:
 *
 * 1. **Nunca `NaN`, nunca `Infinity`, nunca exceção.** Entrada inválida ou
 *    resultado indefinido devolvem `null`, que a tela mostra como "—". Um
 *    `NaN` escapando para o JSX vira "NaN" na cara do usuário.
 * 2. **Unidades de base do SI na fronteira das funções** (V, A, Ω, W, Hz, H,
 *    F, m). Converter pF, µH e MHz é trabalho da tela, não do miolo da conta.
 *
 * Onde a Cartilha ensina uma regra prática diferente da fórmula exata — o caso
 * de λ ≈ 300/f — as duas existem aqui, separadas e nomeadas, porque a prova
 * cobra a regra prática e a física é a física.
 */

function finito(n: number | undefined | null): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

// --- Lei de Ohm e potência (Cartilha p. 54, seções 1.2 e 1.3) -------------

export interface Eletricas {
  /** Tensão, em volts. */
  v: number;
  /** Corrente, em ampères. */
  i: number;
  /** Resistência, em ohms. */
  r: number;
  /** Potência, em watts. */
  p: number;
}

/**
 * Completa as quatro grandezas a partir de duas quaisquer.
 *
 * Devolve `null` com menos de duas conhecidas, com valor negativo em
 * resistência ou potência, ou quando o par informado não determina o resto —
 * resistência zero com tensão conhecida deixa a corrente indefinida.
 */
export function resolverOhm(dado: Partial<Eletricas>): Eletricas | null {
  const v = finito(dado.v) ? dado.v : null;
  const i = finito(dado.i) ? dado.i : null;
  const r = finito(dado.r) ? dado.r : null;
  const p = finito(dado.p) ? dado.p : null;

  const conhecidos = [v, i, r, p].filter((x) => x !== null).length;
  if (conhecidos < 2) return null;
  if ((r !== null && r < 0) || (p !== null && p < 0)) return null;

  let V = v;
  let I = i;
  let R = r;
  let P = p;

  if (V === null && I !== null && R !== null) V = R * I;
  if (V === null && P !== null && I !== null && I !== 0) V = P / I;
  if (V === null && P !== null && R !== null) V = Math.sqrt(P * R);

  if (I === null && V !== null && R !== null) {
    if (R === 0) return null;
    I = V / R;
  }
  if (I === null && P !== null && V !== null && V !== 0) I = P / V;
  if (I === null && P !== null && R !== null && R !== 0) I = Math.sqrt(P / R);

  if (R === null && V !== null && I !== null && I !== 0) R = V / I;
  if (P === null && V !== null && I !== null) P = V * I;

  // Uma segunda passada fecha os pares que dependiam de um valor derivado
  // acima (informar só P e R, por exemplo, resolve I antes de V).
  if (V === null && I !== null && R !== null) V = R * I;
  if (R === null && V !== null && I !== null && I !== 0) R = V / I;
  if (P === null && V !== null && I !== null) P = V * I;

  if (V === null || I === null || R === null || P === null) return null;
  if (![V, I, R, P].every(Number.isFinite)) return null;
  return { v: V, i: I, r: R, p: P };
}

/** Série: a equivalente é a soma (Cartilha p. 55, seção 2.3). */
export function resistoresEmSerie(valores: number[]): number | null {
  if (valores.length === 0 || !valores.every(finito)) return null;
  if (valores.some((r) => r < 0)) return null;
  return valores.reduce((a, b) => a + b, 0);
}

/** Paralelo: sempre menor que a menor do grupo (Cartilha p. 55, seção 2.3). */
export function resistoresEmParalelo(valores: number[]): number | null {
  if (valores.length === 0 || !valores.every(finito)) return null;
  if (valores.some((r) => r <= 0)) return null;
  return 1 / valores.reduce((soma, r) => soma + 1 / r, 0);
}

// --- Código de cores de resistores (Cartilha p. 55, seção 2.2) ------------

export type CorFaixa =
  | "preto"
  | "marrom"
  | "vermelho"
  | "laranja"
  | "amarelo"
  | "verde"
  | "azul"
  | "violeta"
  | "cinza"
  | "branco"
  | "ouro"
  | "prata"
  | "nenhuma";

const DIGITO: Partial<Record<CorFaixa, number>> = {
  preto: 0,
  marrom: 1,
  vermelho: 2,
  laranja: 3,
  amarelo: 4,
  verde: 5,
  azul: 6,
  violeta: 7,
  cinza: 8,
  branco: 9,
};

const MULTIPLICADOR: Partial<Record<CorFaixa, number>> = {
  preto: 1,
  marrom: 10,
  vermelho: 100,
  laranja: 1_000,
  amarelo: 10_000,
  verde: 100_000,
  azul: 1_000_000,
  violeta: 10_000_000,
  cinza: 100_000_000,
  branco: 1_000_000_000,
  ouro: 0.1,
  prata: 0.01,
};

const TOLERANCIA: Partial<Record<CorFaixa, number>> = {
  marrom: 1,
  vermelho: 2,
  verde: 0.5,
  azul: 0.25,
  violeta: 0.1,
  cinza: 0.05,
  ouro: 5,
  prata: 10,
  nenhuma: 20,
};

export function digitoDe(c: CorFaixa): number | null {
  return DIGITO[c] ?? null;
}
export function multiplicadorDe(c: CorFaixa): number | null {
  return MULTIPLICADOR[c] ?? null;
}
export function toleranciaDe(c: CorFaixa): number | null {
  return TOLERANCIA[c] ?? null;
}

export interface Resistor {
  ohms: number;
  /** Em porcento. `null` quando a faixa de tolerância não foi informada. */
  tolerancia: number | null;
}

/**
 * Decodifica 3, 4 ou 5 faixas, na ordem física.
 *
 * Três faixas é o caso dos exemplos da Cartilha, que omitem a tolerância;
 * quatro é o resistor comum; cinco tem três dígitos significativos.
 */
export function decodificarResistor(faixas: CorFaixa[]): Resistor | null {
  const digitos = faixas.length >= 5 ? 3 : 2;
  if (faixas.length < digitos + 1 || faixas.length > digitos + 2) return null;

  let valor = 0;
  for (let i = 0; i < digitos; i++) {
    const d = digitoDe(faixas[i]);
    if (d === null) return null;
    valor = valor * 10 + d;
  }

  const mult = multiplicadorDe(faixas[digitos]);
  if (mult === null) return null;

  const faixaTolerancia = faixas[digitos + 1];
  const tolerancia =
    faixaTolerancia === undefined ? null : toleranciaDe(faixaTolerancia);
  if (faixaTolerancia !== undefined && tolerancia === null) return null;

  return { ohms: valor * mult, tolerancia };
}

// --- Comprimento de onda e antenas (Cartilha p. 28, seção 2.2) -----------

/** Velocidade da luz no vácuo, em m/s. Valor exato por definição do SI. */
export const C_LUZ = 299_792_458;

/** λ = c / f. O valor físico, em metros, a partir da frequência em hertz. */
export function comprimentoDeOnda(hz: number): number | null {
  if (!finito(hz) || hz <= 0) return null;
  return C_LUZ / hz;
}

/**
 * A regra prática que a Cartilha ensina e a prova cobra: λ(m) ≈ 300 / f(MHz).
 *
 * Difere do valor físico em 0,07% — irrelevante na prática e o que aparece
 * nos exemplos do material (7 MHz → 42,8 m; 145 MHz → 2,07 m).
 */
export function comprimentoPratico(mhz: number): number | null {
  if (!finito(mhz) || mhz <= 0) return null;
  return 300 / mhz;
}

export function frequenciaDeComprimento(metros: number): number | null {
  if (!finito(metros) || metros <= 0) return null;
  return C_LUZ / metros;
}

/**
 * Dipolo de meia onda e vertical de quarto de onda, a partir da regra prática.
 *
 * Sem fator de encurtamento: a Cartilha (p. 28) traz apenas λ/2 e λ/4, e
 * nenhum dos PDFs oficiais publicados aqui menciona o fator de velocidade do
 * condutor. Quem for cortar fio de verdade ajusta na prática — o app não
 * inventa um número que a fonte não dá.
 */
export function meiaOnda(mhz: number): number | null {
  const lambda = comprimentoPratico(mhz);
  return lambda === null ? null : lambda / 2;
}

export function quartoDeOnda(mhz: number): number | null {
  const lambda = comprimentoPratico(mhz);
  return lambda === null ? null : lambda / 4;
}

// --- Decibel --------------------------------------------------------------

/** Ganho em dB entre duas potências: 10·log10(p2/p1). */
export function dbPotencia(p1: number, p2: number): number | null {
  if (!finito(p1) || !finito(p2) || p1 <= 0 || p2 <= 0) return null;
  return 10 * Math.log10(p2 / p1);
}

/** Ganho em dB entre duas tensões: 20·log10(v2/v1). */
export function dbTensao(v1: number, v2: number): number | null {
  if (!finito(v1) || !finito(v2) || v1 <= 0 || v2 <= 0) return null;
  return 20 * Math.log10(v2 / v1);
}

export function wattsParaDbm(w: number): number | null {
  if (!finito(w) || w <= 0) return null;
  return 10 * Math.log10(w) + 30;
}

export function dbmParaWatts(dbm: number): number | null {
  if (!finito(dbm)) return null;
  return 10 ** ((dbm - 30) / 10);
}

/** Aplica um ganho (ou perda, com dB negativo) a uma potência em watts. */
export function aplicarGanho(w: number, db: number): number | null {
  if (!finito(w) || !finito(db) || w <= 0) return null;
  return w * 10 ** (db / 10);
}

// --- Reatâncias e ressonância (Cartilha pp. 58-59, seções 5.2 a 5.5) ------

/** f = 1 / (2π·√(LC)), com L em henry e C em farad. */
export function frequenciaRessonancia(
  henry: number,
  farad: number,
): number | null {
  if (!finito(henry) || !finito(farad) || henry <= 0 || farad <= 0) return null;
  return 1 / (2 * Math.PI * Math.sqrt(henry * farad));
}

/** XL = 2πfL — cresce com a frequência. */
export function reatanciaIndutiva(hz: number, henry: number): number | null {
  if (!finito(hz) || !finito(henry) || hz <= 0 || henry <= 0) return null;
  return 2 * Math.PI * hz * henry;
}

/** XC = 1/(2πfC) — cai com a frequência. */
export function reatanciaCapacitiva(hz: number, farad: number): number | null {
  if (!finito(hz) || !finito(farad) || hz <= 0 || farad <= 0) return null;
  return 1 / (2 * Math.PI * hz * farad);
}

// --- Entrada do usuário ---------------------------------------------------

/**
 * Lê um número digitado em português.
 *
 * Aceita vírgula ou ponto decimal e ignora separador de milhar e espaços,
 * porque o campo é `type="text"`: no celular em pt-BR um `type="number"`
 * rejeita a vírgula em silêncio, e o usuário digita "2,5" e não vê nada
 * acontecer.
 */
export function analisarNumero(texto: string): number | null {
  const limpo = texto.trim().replace(/\s/g, "");
  if (limpo === "") return null;

  // "1.500,25" é milhar com decimal; "1.500" sozinho é ambíguo, e aqui o
  // ponto vale como decimal (é o que quem digita em teclado numérico espera).
  const normalizado = limpo.includes(",")
    ? limpo.replace(/\./g, "").replace(",", ".")
    : limpo;

  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(normalizado)) return null;
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : null;
}
