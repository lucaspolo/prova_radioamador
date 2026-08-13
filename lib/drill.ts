import { embaralharSimples } from "./prioridade";
import { TABELAS, type FonteTabela, type TabelaReferencia } from "./referencia";

/**
 * Drill relâmpago das tabelas: fonético, Código Q e prefixos por UF.
 *
 * O que se treina aqui não é a prova — é o que o radioamador usa no ar.
 * Soletrar o indicativo sem hesitar, entender QRM de ouvido, reconhecer de
 * onde vem um PT7. A prova cobra uma vez; a operação cobra todo dia.
 *
 * A regra que governa este arquivo é a de `lib/referencia.ts`, e é o motivo de
 * ele existir separado da UI: **nada é escrito à mão**. Toda pergunta, toda
 * resposta e todo distrator saem de células de `TABELAS`, que por sua vez são
 * cópias literais dos PDFs conferidas por `testes/referencia.test.ts` contra a
 * fonte. `testes/drill.test.ts` fecha o cerco: exige que `alvo` e `resposta`
 * de cada carta existam na linha de onde a carta diz ter vindo.
 *
 * A escala RST fica de fora, como fica das tabelas (`RST_SEM_FONTE`): a fonte
 * é material de terceiros ainda não publicado aqui. No dia em que for, o RST
 * entra no drill de graça — basta virar tabela.
 */

export type BaralhoId = "fonetico" | "codigo-q" | "prefixos";

export const BARALHOS: { id: BaralhoId; rotulo: string }[] = [
  { id: "fonetico", rotulo: "Fonético" },
  { id: "codigo-q", rotulo: "Código Q" },
  { id: "prefixos", rotulo: "Prefixos" },
];

export interface Carta {
  /** Único no baralho; serve de chave de React e de identidade no teste. */
  id: string;
  baralho: BaralhoId;
  /**
   * Conjunto de respostas do mesmo formato, de onde saem os distratores.
   * Alternativa fora do formato se elimina sozinha — "Alfa" no meio de três
   * siglas não é distrator, é enfeite —, e a pergunta vira decoração.
   */
  grupo: string;
  /** Linha de origem, para uma rodada não perguntar a ida e a volta dela. */
  linha: string;
  /** O termo perguntado, literal da tabela. */
  alvo: string;
  enunciado: string;
  resposta: string;
  fonte: FonteTabela;
}

export interface Pergunta {
  carta: Carta;
  /** A resposta e os distratores, já embaralhados. */
  alternativas: string[];
}

export const TAMANHO_RODADA = 10;
/** Quatro alternativas quando o grupo dá; menos, se for um grupo pequeno. */
const ALTERNATIVAS = 4;

function tabela(id: string): TabelaReferencia {
  const t = TABELAS.find((x) => x.id === id);
  if (!t) throw new Error(`Tabela ausente em lib/referencia.ts: ${id}`);
  return t;
}

/**
 * A série de prefixo de uma célula da Tabela II: "PT 8 AA a ZZ · PT 8 AAA a
 * YZZ" tem uma série, "PT 8"; São Paulo tem duas, "PY 2" e "PR 2".
 */
function seriesDe(celula: string): string[] {
  const series = celula
    .split("·")
    .map((parte) => parte.trim().split(/\s+/).slice(0, 2).join(" "));
  return [...new Set(series)];
}

function cartasFonetico(): Carta[] {
  const t = tabela("fonetico");
  return t.linhas.flatMap(({ celulas: [letra, palavra] }, i) => [
    {
      id: `fonetico:palavra:${letra}`,
      baralho: "fonetico" as const,
      grupo: "fonetico:palavra",
      linha: `fonetico:${i}`,
      alvo: letra,
      enunciado: `Como se soletra a letra “${letra}” no alfabeto fonético?`,
      resposta: palavra,
      fonte: t.fonte,
    },
    {
      id: `fonetico:letra:${palavra}`,
      baralho: "fonetico" as const,
      grupo: "fonetico:letra",
      linha: `fonetico:${i}`,
      alvo: palavra,
      enunciado: `“${palavra}” soletra qual letra?`,
      resposta: letra,
      fonte: t.fonte,
    },
  ]);
}

function cartasCodigoQ(): Carta[] {
  const t = tabela("codigo-q");
  return t.linhas.flatMap(({ celulas: [codigo, uso] }, i) => [
    {
      id: `codigo-q:uso:${codigo}`,
      baralho: "codigo-q" as const,
      grupo: "codigo-q:uso",
      linha: `codigo-q:${i}`,
      alvo: codigo,
      enunciado: `O que “${codigo}” quer dizer num QSO?`,
      resposta: uso,
      fonte: t.fonte,
    },
    {
      id: `codigo-q:codigo:${codigo}`,
      baralho: "codigo-q" as const,
      grupo: "codigo-q:codigo",
      linha: `codigo-q:${i}`,
      alvo: uso,
      enunciado: `Qual código Q corresponde a “${uso}”?`,
      resposta: codigo,
      fonte: t.fonte,
    },
  ]);
}

/**
 * Só a direção série → UF, e de propósito.
 *
 * Ela é a que se usa no ar ("de onde vem esse PT7?") e é a única sem
 * ambiguidade: cada série pertence a uma UF, mas São Paulo tem duas (PY 2 e
 * PR 2), então perguntar "qual a série de São Paulo?" teria duas respostas
 * certas e uma só marcada como tal. A coluna da classe C fica fora pelo mesmo
 * motivo — "PU 8" é de cinco estados, o que separa é a faixa de sufixos.
 */
function cartasPrefixos(): Carta[] {
  const t = tabela("prefixos");
  return t.linhas.flatMap(({ celulas: [uf, ab] }, i) =>
    seriesDe(ab).map((serie) => ({
      id: `prefixos:uf:${serie}`,
      baralho: "prefixos" as const,
      grupo: "prefixos:uf",
      linha: `prefixos:${i}`,
      alvo: serie,
      enunciado: `Um indicativo “${serie}” é de qual unidade da federação?`,
      resposta: uf,
      fonte: t.fonte,
    })),
  );
}

/** O baralho inteiro, determinístico — a mesma ordem a cada chamada. */
export function baralho(): Carta[] {
  return [...cartasFonetico(), ...cartasCodigoQ(), ...cartasPrefixos()];
}

/**
 * Uma rodada: `quantidade` cartas sorteadas, cada uma com suas alternativas.
 *
 * Nenhuma linha aparece duas vezes na mesma rodada — perguntar "N?" e depois
 * "November?" entrega a resposta de graça e treina o placar, não a memória.
 */
export function sortearRodada(
  baralhos: BaralhoId[] = [],
  quantidade: number = TAMANHO_RODADA,
  rand: () => number = Math.random,
): Pergunta[] {
  const todas = baralho();
  const elegiveis =
    baralhos.length === 0
      ? todas
      : todas.filter((c) => baralhos.includes(c.baralho));

  const porGrupo = new Map<string, string[]>();
  for (const c of todas) {
    const lista = porGrupo.get(c.grupo);
    if (lista) {
      if (!lista.includes(c.resposta)) lista.push(c.resposta);
    } else porGrupo.set(c.grupo, [c.resposta]);
  }

  const escolhidas: Carta[] = [];
  const linhasUsadas = new Set<string>();
  for (const carta of embaralharSimples(elegiveis, rand)) {
    if (escolhidas.length >= quantidade) break;
    if (linhasUsadas.has(carta.linha)) continue;
    linhasUsadas.add(carta.linha);
    escolhidas.push(carta);
  }

  return escolhidas.map((carta) => {
    const outras = (porGrupo.get(carta.grupo) ?? []).filter(
      (r) => r !== carta.resposta,
    );
    const distratores = embaralharSimples(outras, rand).slice(
      0,
      ALTERNATIVAS - 1,
    );
    return {
      carta,
      alternativas: embaralharSimples([carta.resposta, ...distratores], rand),
    };
  });
}
