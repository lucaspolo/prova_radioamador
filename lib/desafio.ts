import type { Classe, Tema } from "./tipos";
import { CLASSES, TEMAS, tempoDaBateria } from "./constantes";
import { disponiveis } from "./questoes";
import { normalizarSemente } from "./semente";

/**
 * Desafio por link: o endereço é a bateria.
 *
 * O caso é o do radioclube — turma que estuda junto e quer fazer a MESMA
 * bateria para comparar depois, no ar ou no grupo de mensagens. Dá para
 * atender sem servidor, sem conta e sem placar central: tudo que define a
 * bateria cabe na query string, e o sorteio é reprodutível (`lib/semente.ts`).
 *
 * É o que substitui o leaderboard sem trair o desenho do app — estático,
 * privado, dados só no aparelho. O "placar" é o grupo comparando os textos que
 * cada um compartilhou.
 *
 * A leitura é intencionalmente desconfiada: a query string é entrada de fora,
 * pode vir editada à mão ou truncada por um mensageiro, e um parâmetro
 * inválido tem de virar "não há desafio aqui" — nunca uma bateria estranha,
 * nunca uma tela quebrada.
 */
export interface Desafio {
  /** Texto curto que semeia o sorteio; é o que identifica o desafio. */
  semente: string;
  tema: Tema;
  quantidade: number;
  classe: Classe;
}

/**
 * Fatia curta e estável do tema na URL. O índice em `TEMAS` seria menor, mas
 * um link já compartilhado tem de continuar valendo se a ordem do array mudar
 * um dia — e "t=legislacao" se lê sem decodificar nada.
 */
const SLUG_TEMA: Record<Tema, string> = {
  "Legislação de Telecomunicações": "legislacao",
  "Técnica e ética operacional": "tecnica",
  "Conhecimentos de Eletrônica e Eletricidade": "eletronica",
};

const TEMA_DO_SLUG = new Map(
  TEMAS.map((t) => [SLUG_TEMA[t], t] as [string, Tema]),
);

/** Semente aceitável: curta, sem espaço e sem nada que exija escapar. */
const SEMENTE_VALIDA = /^[A-Za-z0-9_-]{1,40}$/;

/** Os parâmetros do desafio, para colar depois de `?`. */
export function paramsDoDesafio(d: Desafio): string {
  return new URLSearchParams({
    desafio: d.semente,
    t: SLUG_TEMA[d.tema],
    n: String(d.quantidade),
    c: d.classe,
  }).toString();
}

/** O link completo. `base` é a origem + caminho, sem query. */
export function linkDoDesafio(d: Desafio, base: string): string {
  return `${base}?${paramsDoDesafio(d)}`;
}

/**
 * O desafio contido numa query string, ou null se não houver um válido.
 *
 * A quantidade é limitada ao que existe no acervo do tema — e o limite é
 * determinístico, então dois aparelhos com o mesmo link chegam ao mesmo
 * número mesmo que ele venha absurdo.
 */
export function lerDesafio(busca: string): Desafio | null {
  const p = new URLSearchParams(busca);
  const semente = p.get("desafio");
  if (!semente || !SEMENTE_VALIDA.test(semente)) return null;

  const tema = TEMA_DO_SLUG.get(p.get("t") ?? "");
  if (!tema) return null;

  const classe = CLASSES.find((c) => c === p.get("c"));
  if (!classe) return null;

  const pedidas = Number(p.get("n"));
  if (!Number.isInteger(pedidas) || pedidas < 1) return null;
  const quantidade = Math.min(pedidas, disponiveis(tema, classe));
  if (quantidade < 1) return null;

  return { semente: normalizarSemente(semente), tema, quantidade, classe };
}

/**
 * Minutos do desafio, sempre no ritmo oficial da classe.
 *
 * Desafio é cronometrado e cego por construção: sem o mesmo relógio e sem o
 * mesmo sigilo do gabarito, comparar os resultados não significaria nada.
 */
export function minutosDoDesafio(d: Desafio): number {
  return Math.round(tempoDaBateria(d.classe, d.quantidade) / 60);
}
