import type { Classe, Questao, Tema } from "./tipos";
import { CLASSES, SLUG_TEMA, TEMAS, tempoDaBateria } from "./constantes";
import { disponiveis, sortearDesafio } from "./questoes";
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
  /**
   * As matérias do desafio, na ordem de `TEMAS`. Uma só é uma bateria; as três
   * são a prova completa. Cada matéria é um exame separado, com seu próprio
   * cronômetro e seu próprio mínimo — como a Anatel aplica.
   */
  temas: Tema[];
  /** Questões **por matéria**: duas matérias com 20 são 20 + 20. */
  quantidade: number;
  classe: Classe;
}

const TEMA_DO_SLUG = new Map(
  TEMAS.map((t) => [SLUG_TEMA[t], t] as [string, Tema]),
);

/** Semente aceitável: curta, sem espaço e sem nada que exija escapar. */
const SEMENTE_VALIDA = /^[A-Za-z0-9_-]{1,40}$/;

/**
 * Os parâmetros do desafio, para colar depois de `?`.
 *
 * Montados à mão, e não com `URLSearchParams.toString()`, por causa da
 * vírgula: o serializador a escaparia como `%2C`, e `t=legislacao%2Ctecnica`
 * é ilegível num link que se dita no ar. A vírgula é caractere permitido na
 * query (RFC 3986), e os slugs são ASCII puro — não há o que escapar.
 */
export function paramsDoDesafio(d: Desafio): string {
  return [
    `desafio=${encodeURIComponent(d.semente)}`,
    `t=${d.temas.map((t) => SLUG_TEMA[t]).join(",")}`,
    `n=${d.quantidade}`,
    `c=${d.classe}`,
  ].join("&");
}

/** O link completo. `base` é a origem + caminho, sem query. */
export function linkDoDesafio(d: Desafio, base: string): string {
  return `${base}?${paramsDoDesafio(d)}`;
}

/**
 * O desafio contido numa query string, ou null se não houver um válido.
 *
 * A quantidade é limitada ao que existe na matéria mais escassa do desafio — e
 * o limite é determinístico, então dois aparelhos com o mesmo link chegam ao
 * mesmo número mesmo que ele venha absurdo.
 */
export function lerDesafio(busca: string): Desafio | null {
  const p = new URLSearchParams(busca);
  const semente = p.get("desafio");
  if (!semente || !SEMENTE_VALIDA.test(semente)) return null;

  const pedidos = (p.get("t") ?? "").split(",").filter(Boolean);
  const temas = pedidos.map((slug) => TEMA_DO_SLUG.get(slug));
  // Slug desconhecido derruba o desafio inteiro em vez de sumir calado: quem
  // recebeu o link faria uma prova menor do que a dos colegas sem saber.
  if (temas.length === 0 || temas.some((t) => t === undefined)) return null;
  const emOrdem = TEMAS.filter((t) => temas.includes(t));

  const classe = CLASSES.find((c) => c === p.get("c"));
  if (!classe) return null;

  const pedidas = Number(p.get("n"));
  if (!Number.isInteger(pedidas) || pedidas < 1) return null;
  const teto = Math.min(...emOrdem.map((t) => disponiveis(t, classe)));
  const quantidade = Math.min(pedidas, teto);
  if (quantidade < 1) return null;

  return {
    semente: normalizarSemente(semente),
    temas: emOrdem,
    quantidade,
    classe,
  };
}

/**
 * Minutos de CADA matéria, sempre no ritmo oficial da classe.
 *
 * Desafio é cronometrado e cego por construção: sem o mesmo relógio e sem o
 * mesmo sigilo do gabarito, comparar os resultados não significaria nada.
 */
export function minutosDoDesafio(d: Desafio): number {
  return Math.round(tempoDaBateria(d.classe, d.quantidade) / 60);
}

/** As baterias do desafio, uma por matéria, na ordem em que serão aplicadas. */
export function bateriasDoDesafio(
  d: Desafio,
): { tema: Tema; questoes: Questao[] }[] {
  return d.temas.map((tema) => ({
    tema,
    questoes: sortearDesafio(tema, d.quantidade, d.classe, d.semente),
  }));
}
