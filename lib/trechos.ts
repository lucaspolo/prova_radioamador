import type { Trecho } from "./tipos";

/**
 * Os trechos ficam num arquivo separado do banco e são buscados sob demanda.
 *
 * Um mesmo trecho gera cerca de oito questões, então embuti-lo em cada uma
 * multiplicaria o banco — que já é carregado inteiro no bundle. Assim os 244 KB
 * de texto só saem da rede quando alguém realmente pede para ver a origem, e
 * abrir o simulado continua custando o mesmo.
 */
let pendente: Promise<Record<string, Trecho>> | null = null;

export function carregarTrechos(): Promise<Record<string, Trecho>> {
  // Uma falha de rede não pode envenenar a promessa em cache: sem limpar,
  // o botão ficaria quebrado para sempre depois de um único erro.
  pendente ??= fetch("/trechos.json")
    .then((r) => {
      if (!r.ok) throw new Error(`trechos.json: HTTP ${r.status}`);
      return r.json() as Promise<Record<string, Trecho>>;
    })
    .catch((e) => {
      pendente = null;
      throw e;
    });
  return pendente;
}

/** Só para os testes: descarta o cache entre cenários. */
export function limparCacheTrechos(): void {
  pendente = null;
}

// --- Localização da passagem ----------------------------------------------

// Palavras curtas e frequentes não distinguem nada; o filtro de tamanho já
// derruba a maioria, e estas passariam por ele.
const VAZIAS = new Set([
  "quando", "porque", "sobre", "podem", "poderá", "devem", "deverá", "dever",
  "sendo", "pelos", "pelas", "dessa", "desse", "desta", "deste", "aquele",
  "aquela", "outros", "outras", "todos", "todas", "mesmo", "mesma", "apenas",
  "ainda", "entre", "cada", "seja", "sejam", "qualquer", "conforme", "casos",
  "caso", "forma", "parte", "partir", "quais", "cujas", "cujos",
]);

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Termos que carregam significado. Números entram mesmo curtos: numa prova de
 * radioamador é justamente "144", "25" ou "11.2" que identificam a passagem.
 */
function termos(texto: string): Set<string> {
  const brutos = normalizar(texto).split(/[^a-z0-9]+/);
  return new Set(
    brutos.filter((t) => (/\d/.test(t) ? t.length >= 2 : t.length >= 5 && !VAZIAS.has(t))),
  );
}

/** Intervalo de caracteres dentro do trecho, ou null se nada casou bem. */
export interface Passagem {
  inicio: number;
  fim: number;
}

/** Quantas linhas seguidas formam a janela avaliada. */
const JANELA = 3;
/** Abaixo disto o casamento é ruído, e destacar enganaria mais do que ajuda. */
const MIN_COBERTURA = 0.3;
const MIN_TERMOS = 2;

/**
 * Acha a passagem do trecho mais parecida com a afirmação.
 *
 * O trecho tem uns 4.500 caracteres — uma parede de texto para ler no celular.
 * A busca é por sobreposição de termos numa janela de linhas: as linhas vêm do
 * PDF já quebradas, e uma frase costuma atravessar duas ou três.
 *
 * É deliberadamente uma aproximação, e a interface diz isso. Errar o destaque
 * custa uma linha grifada sem serventia; o texto continua inteiro na tela.
 */
export function localizarPassagem(
  trecho: string,
  afirmacao: string,
): Passagem | null {
  const alvo = termos(afirmacao);
  if (alvo.size === 0) return null;

  // Guarda o deslocamento de cada linha para devolver posições no texto original.
  const linhas: { inicio: number; fim: number }[] = [];
  let cursor = 0;
  for (const linha of trecho.split("\n")) {
    linhas.push({ inicio: cursor, fim: cursor + linha.length });
    cursor += linha.length + 1;
  }

  let melhor: Passagem | null = null;
  let melhorNota = 0;

  for (let i = 0; i < linhas.length; i++) {
    const fim = Math.min(i + JANELA, linhas.length);
    const janela = trecho.slice(linhas[i].inicio, linhas[fim - 1].fim);
    const presentes = termos(janela);

    let comuns = 0;
    for (const t of alvo) if (presentes.has(t)) comuns++;
    if (comuns < MIN_TERMOS) continue;

    const cobertura = comuns / alvo.size;
    if (cobertura > melhorNota) {
      melhorNota = cobertura;
      melhor = { inicio: linhas[i].inicio, fim: linhas[fim - 1].fim };
    }
  }

  return melhorNota >= MIN_COBERTURA ? melhor : null;
}
