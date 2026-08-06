"use client";

import { useState } from "react";
import { COR_TEMA, PERCENTUAL_CORTE, ROTULO_CURTO } from "@/lib/constantes";
import { estatisticasPorTema, resumo, type Historico } from "@/lib/historico";
import { useSuspeitas } from "@/hooks/useSuspeitas";
import Evolucao from "./Evolucao";
import ExportarImportar from "./ExportarImportar";
import PainelPreferencias from "./Preferencias";
import Suspeitas from "./Suspeitas";

interface Props {
  historico: Historico;
  carregado: boolean;
  onLimpar: () => void;
  /** Mescla um histórico importado ao local; devolve quantos eram novos. */
  onImportar: (outro: Historico) => number;
}

export default function Dashboard({
  historico,
  carregado,
  onLimpar,
  onImportar,
}: Props) {
  const [confirmando, setConfirmando] = useState(false);
  const suspeitas = useSuspeitas();

  // Enquanto o storage não foi lido, não renderiza nada: evita piscar
  // "nenhum simulado" para quem já tem histórico.
  if (!carregado) return null;

  const geral = resumo(historico);
  if (geral.simulados === 0) {
    return (
      <section className="space-y-4">
        <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Seu desempenho por matéria aparece aqui depois do primeiro simulado.
        </div>
        {/* Quem chega num aparelho novo precisa do importar ANTES do primeiro
            simulado — é justamente o momento de trazer o backup. E ajustar
            tema e tamanho de texto não deveria exigir ter estudado antes. */}
        <ExportarImportar historico={historico} onImportar={onImportar} />
        <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
          <PainelPreferencias />
        </div>
      </section>
    );
  }

  const estatisticas = estatisticasPorTema(historico);
  const atencao = estatisticas
    .filter((e) => e.respondidas > 0 && e.percentual < PERCENTUAL_CORTE)
    .sort((a, b) => a.percentual - b.percentual);

  return (
    <section className="space-y-5 rounded-xl border border-slate-300 p-5 dark:border-slate-700">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
          Seu desempenho
        </h2>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {geral.simulados} {geral.simulados === 1 ? "simulado" : "simulados"} ·{" "}
          {geral.respondidas} questões · {geral.percentual}%
        </span>
      </div>

      <div className="space-y-4">
        {estatisticas.map((e) => {
          const aprovando = e.percentual >= PERCENTUAL_CORTE;
          return (
            <div key={e.tema}>
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <span className={`font-medium ${COR_TEMA[e.tema].texto}`}>
                  {ROTULO_CURTO[e.tema]}
                </span>
                <span
                  className={
                    e.respondidas === 0
                      ? "text-slate-400 dark:text-slate-500"
                      : aprovando
                        ? "font-medium text-emerald-600 dark:text-emerald-400"
                        : "font-medium text-rose-600 dark:text-rose-400"
                  }
                >
                  {e.respondidas === 0
                    ? "sem dados"
                    : `${e.percentual}% · ${e.acertos}/${e.respondidas}`}
                </span>
              </div>

              {/* A linha vertical marca os 55% exigidos para aprovação. */}
              <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className={`h-full rounded-full ${COR_TEMA[e.tema].barra}`}
                  style={{ width: `${e.percentual}%` }}
                />
                <div
                  className="absolute inset-y-0 w-px bg-slate-900/60 dark:bg-white/70"
                  style={{ left: `${PERCENTUAL_CORTE}%` }}
                  aria-hidden
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        A marca vertical é a linha de corte mais exigente das três classes:{" "}
        {PERCENTUAL_CORTE}% (11 de 20 na Classe B; A e C aprovam com 53%).
      </p>

      {atencao.length > 0 && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Abaixo da linha de corte:{" "}
          <strong>{atencao.map((e) => ROTULO_CURTO[e.tema]).join(", ")}</strong>.
          É onde o estudo rende mais agora.
        </p>
      )}

      <Evolucao historico={historico} />
      <Suspeitas suspeitas={suspeitas} />

      <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
        <PainelPreferencias />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
        <ExportarImportar historico={historico} onImportar={onImportar} />
        {confirmando ? (
          <span className="flex items-center gap-3 text-sm">
            <span className="text-slate-600 dark:text-slate-400">
              Apagar todo o histórico?
            </span>
            <button
              onClick={() => {
                onLimpar();
                setConfirmando(false);
              }}
              className="font-medium text-rose-600 underline-offset-4 hover:underline dark:text-rose-400"
            >
              Apagar
            </button>
            <button
              onClick={() => setConfirmando(false)}
              className="text-slate-500 underline-offset-4 hover:underline dark:text-slate-400"
            >
              Cancelar
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirmando(true)}
            className="text-sm text-slate-500 underline-offset-4 hover:underline dark:text-slate-400"
          >
            Limpar histórico
          </button>
        )}
      </div>
    </section>
  );
}
