import bruto from "@/scripts/conferencia_triado.json";

/**
 * O que a triagem do repositório já decidiu sobre cada achado.
 *
 * `scripts/conferencia_triado.json` é a memória da skill `processar-conferencia`:
 * todo achado que sai de uma rodada de conferência entra lá com a decisão e o
 * motivo, inclusive os que viraram conserto. A tela lê esse arquivo por um
 * motivo prático — sem ele, um achado decidido volta a aparecer como pendência
 * em toda exportação seguinte, porque o veredito fica no navegador e ninguém
 * avisou o navegador de que o assunto acabou.
 *
 * O arquivo é escrito à mão, e não gerado como `lib/ocr-visao.json`. Por isso a
 * leitura é defensiva: uma entrada com decisão desconhecida é ignorada em vez de
 * derrubar a tela. Para o descarte não ser silencioso, `testes/conferencia.test.ts`
 * confere que toda entrada do arquivo sobreviveu à leitura.
 */

export type Decisao = "corrigido" | "descartado" | "adiado";

const DECISOES: readonly Decisao[] = ["corrigido", "descartado", "adiado"];

export interface Triagem {
  decisao: Decisao;
  /** Onde o conserto foi escrito, quando houve conserto. */
  onde?: string;
  /** O que foi conferido e contra o quê. É o campo que faz a triagem valer. */
  motivo: string;
}

function ler(): Record<string, Triagem> {
  const achados = (bruto as { achados?: unknown }).achados;
  if (typeof achados !== "object" || achados === null) return {};

  const limpo: Record<string, Triagem> = {};
  for (const [id, valor] of Object.entries(achados)) {
    if (typeof valor !== "object" || valor === null) continue;
    const a = valor as Record<string, unknown>;
    if (!DECISOES.includes(a.decisao as Decisao)) continue;
    if (typeof a.motivo !== "string") continue;
    limpo[id] = {
      decisao: a.decisao as Decisao,
      motivo: a.motivo,
      ...(typeof a.onde === "string" ? { onde: a.onde } : {}),
    };
  }
  return limpo;
}

export const TRIAGENS: Readonly<Record<string, Triagem>> = ler();

/** Os ids que já têm decisão registrada, para as funções puras de `conferencia.ts`. */
export const IDS_TRIADOS: ReadonlySet<string> = new Set(Object.keys(TRIAGENS));

/** Quantos achados o arquivo declara, tenham eles sobrevivido à leitura ou não. */
export function achadosDeclarados(): number {
  const achados = (bruto as { achados?: unknown }).achados;
  if (typeof achados !== "object" || achados === null) return 0;
  return Object.keys(achados).length;
}
