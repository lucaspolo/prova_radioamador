"use client";

import { useEffect, useRef } from "react";
import type { Escolhas } from "@/lib/bateria";
import Icone from "./Icone";

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
  const grade = useRef<HTMLDivElement>(null);
  const celulaAtual = useRef<HTMLButtonElement>(null);

  /**
   * O foco segue a parada de Tab.
   *
   * O tabindex rotativo movia a PARADA quando ← / → mudavam de questão, mas
   * não o foco: quem estava na célula 1 continuava lá, agora com
   * `tabindex="-1"`, e o Enter seguinte disparava o clique dela — a prova
   * voltava para a questão 1. Roving focus só funciona se o foco rodar junto.
   *
   * Só quando o foco já está DENTRO da folha: mexer nas setas com o foco no
   * corpo da questão não deve arrastar ninguém para cá.
   */
  useEffect(() => {
    if (grade.current?.contains(document.activeElement)) {
      celulaAtual.current?.focus({ preventScroll: true });
    }
  }, [atual]);

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
          <Icone
            nome="bandeira"
            className="h-3 w-3 text-amber-700 dark:text-amber-400"
          />
          marcada
        </span>
      </div>

      <div ref={grade} className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
        {escolhas.map((escolha, i) => {
          const respondida = escolha !== null;
          const marcada = marcadas.has(i);
          const ehAtual = i === atual;
          return (
            <button
              key={i}
              ref={ehAtual ? celulaAtual : undefined}
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
              className={`relative min-h-11 rounded-lg border-2 text-sm font-medium tabular-nums transition ${
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
                  <Icone nome="bandeira" className="h-3 w-3" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
