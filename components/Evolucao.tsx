"use client";

import { COR_TEMA, ROTULO_CURTO, TEMAS } from "@/lib/constantes";
import type { Historico } from "@/lib/historico";
import type { Tema } from "@/lib/tipos";

interface Ponto {
  data: string;
  pct: number;
}

/**
 * A série de cada matéria: percentual por simulado, do mais antigo ao mais
 * recente. Revisões ficam de fora — são só questões difíceis por construção,
 * e o percentual delas não é comparável ao de uma bateria normal.
 */
function seriePorTema(historico: Historico, tema: Tema): Ponto[] {
  const pontos: Ponto[] = [];
  for (const s of historico.simulados) {
    if (s.escolha === "revisao") continue;
    const doTema = s.itens.filter((i) => i.tema === tema);
    if (doTema.length === 0) continue;
    const certos = doTema.filter((i) => i.acertou).length;
    pontos.push({
      data: s.data,
      pct: Math.round((certos / doTema.length) * 100),
    });
  }
  // O histórico é guardado do mais recente para o mais antigo.
  return pontos.reverse().slice(-12);
}

/**
 * Tendência das últimas baterias, uma linha por matéria contra o corte.
 *
 * Três gráficos de série única, e não um com três linhas: a identidade fica no
 * rótulo em texto de cada linha (nunca só na cor), e a escala 0–100 fixa faz as
 * três serem comparáveis entre si e com a linha de corte tracejada.
 */
export default function Evolucao({
  historico,
  corte,
}: {
  historico: Historico;
  /** O mesmo corte marcado nas barras acima — os dois gráficos leem a mesma linha. */
  corte: number;
}) {
  const series = TEMAS.map((tema) => ({
    tema,
    pontos: seriePorTema(historico, tema),
  })).filter((s) => s.pontos.length >= 2);
  if (series.length === 0) return null;

  // Geometria do viewBox: x de 4 a 96, y de 4 (100%) a 32 (0%).
  const X0 = 4,
    X1 = 96,
    Y0 = 4,
    Y1 = 32;
  const x = (i: number, n: number) => X0 + ((X1 - X0) * i) / (n - 1);
  const y = (pct: number) => Y1 - ((Y1 - Y0) * pct) / 100;

  return (
    <div>
      <div className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
        Evolução — últimas baterias de cada matéria (linha tracejada = {corte}%)
      </div>
      <div className="space-y-3">
        {series.map(({ tema, pontos }) => (
          <div key={tema} className="flex items-center gap-3">
            <span
              className={`w-24 shrink-0 text-xs font-medium ${COR_TEMA[tema].texto}`}
            >
              {ROTULO_CURTO[tema]}
            </span>
            <svg
              viewBox="0 0 100 36"
              preserveAspectRatio="none"
              className="h-10 min-w-0 flex-1"
              role="img"
              aria-label={`${ROTULO_CURTO[tema]}: de ${pontos[0].pct}% a ${pontos[pontos.length - 1].pct}% nas últimas ${pontos.length} baterias`}
            >
              <line
                x1={X0}
                x2={X1}
                y1={y(corte)}
                y2={y(corte)}
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
                /* Era slate-400/600: 2,63:1 no claro e 2,27:1 no escuro, abaixo
                   dos 3:1 da WCAG 1.4.11 para elemento gráfico — no tema
                   escuro o tracejado praticamente sumia, e é ele que diz se a
                   linha da matéria está por cima ou por baixo do corte. */
                className="stroke-slate-600 dark:stroke-slate-300"
                strokeWidth="1"
              />
              <polyline
                fill="none"
                points={pontos
                  .map((p, i) => `${x(i, pontos.length)},${y(p.pct)}`)
                  .join(" ")}
                vectorEffect="non-scaling-stroke"
                className={COR_TEMA[tema].linha}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {/* Ponto final desenhado como segmento nulo com ponta redonda:
                  um <circle> distorceria com preserveAspectRatio="none". */}
              <path
                d={`M ${x(pontos.length - 1, pontos.length)} ${y(pontos[pontos.length - 1].pct)} l 0 0.01`}
                vectorEffect="non-scaling-stroke"
                className={COR_TEMA[tema].linha}
                strokeWidth="6"
                strokeLinecap="round"
              />
              {/* Alvos de toque invisíveis, um por ponto, com tooltip nativo. */}
              {pontos.map((p, i) => (
                <rect
                  key={i}
                  x={x(i, pontos.length) - (X1 - X0) / (2 * pontos.length)}
                  y={0}
                  width={(X1 - X0) / pontos.length}
                  height={36}
                  fill="transparent"
                >
                  <title>
                    {`${new Date(p.data).toLocaleDateString("pt-BR")} — ${p.pct}%`}
                  </title>
                </rect>
              ))}
            </svg>
            <span className="w-10 shrink-0 text-right text-xs font-medium tabular-nums">
              {pontos[pontos.length - 1].pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
