"use client";

import type { Escolhas } from "@/lib/bateria";

interface Props {
  escolhas: Escolhas;
  marcadas: ReadonlySet<number>;
  atual: number;
  onIr: (indice: number) => void;
}

/**
 * A grade de questões da prova cega: onde você está, o que já respondeu e o
 * que deixou marcado para rever.
 *
 * Os três estados se distinguem por forma e por texto, não só por cor — o
 * mesmo cuidado que o dashboard já toma com as séries do gráfico.
 */
export default function FolhaRespostas({
  escolhas,
  marcadas,
  atual,
  onIr,
}: Props) {
  return (
    <section aria-label="folha de respostas">
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        <span className="font-semibold tracking-wide uppercase">
          Folha de respostas
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border-2 border-slate-400 bg-slate-900 dark:bg-slate-100" />
          respondida
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border-2 border-dashed border-slate-400" />
          em branco
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-amber-700 dark:text-amber-400">⚑</span>
          marcada
        </span>
      </div>

      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
        {escolhas.map((escolha, i) => {
          const respondida = escolha !== null;
          const marcada = marcadas.has(i);
          const ehAtual = i === atual;
          return (
            <button
              key={i}
              onClick={() => onIr(i)}
              // Tabindex rotativo: a grade inteira é UMA parada de Tab (a
              // célula atual), senão até 30 botões separavam a questão do
              // "Encerrar" para quem navega por teclado. Dentro da folha,
              // ← / → já andam pelas questões — e movem esta parada junto.
              tabIndex={ehAtual ? 0 : -1}
              aria-current={ehAtual ? "true" : undefined}
              aria-label={`Questão ${i + 1}, ${
                respondida ? "respondida" : "em branco"
              }${marcada ? ", marcada para revisar" : ""}`}
              className={`relative rounded-lg border-2 py-2 text-sm font-medium tabular-nums transition ${
                respondida
                  ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                  : "border-dashed border-slate-400 text-slate-500 hover:border-slate-500 dark:border-slate-600 dark:text-slate-400"
              } ${
                ehAtual
                  ? "ring-2 ring-sky-500 ring-offset-2 ring-offset-[var(--background)]"
                  : ""
              }`}
            >
              {i + 1}
              {marcada && (
                <span
                  aria-hidden="true"
                  className="absolute -top-1 -right-1 text-amber-700 dark:text-amber-400"
                >
                  ⚑
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
