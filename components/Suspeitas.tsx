"use client";

import { useState } from "react";
import { useSuspeitas } from "@/hooks/useSuspeitas";
import { BANCO } from "@/lib/questoes";
import { urlDeReporte } from "@/lib/reportar";

/**
 * As questões que o usuário marcou como suspeitas durante o estudo.
 *
 * O banco é gerado por LLM e revisado por amostragem; quem estuda por ele é
 * quem mais olha cada questão de perto. Daqui sai o formulário de revisão já
 * preenchido — sem login, que era o pedágio da issue no GitHub.
 */
export default function Suspeitas({
  suspeitas,
}: {
  suspeitas: ReturnType<typeof useSuspeitas>;
}) {
  const [aberto, setAberto] = useState(false);
  if (!suspeitas.carregado || suspeitas.ids.length === 0) return null;

  const porId = new Map(BANCO.map((q) => [q.id, q]));

  return (
    <div className="rounded-lg border border-amber-300 p-3 dark:border-amber-900">
      <button
        onClick={() => setAberto((a) => !a)}
        className="flex w-full items-center justify-between text-sm font-medium text-amber-700 dark:text-amber-300"
      >
        <span>⚑ Questões marcadas como suspeitas ({suspeitas.ids.length})</span>
        <span aria-hidden>{aberto ? "▴" : "▾"}</span>
      </button>
      {aberto && (
        <ul className="mt-3 space-y-2">
          {suspeitas.ids.map((id) => {
            const q = porId.get(id);
            return (
              <li key={id} className="text-sm">
                <p className="text-slate-700 dark:text-slate-300">
                  {q
                    ? q.afirmacao
                    : "Questão removida numa atualização do banco."}
                </p>
                <button
                  onClick={() => suspeitas.alternar(id)}
                  className="mt-0.5 text-xs text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
                >
                  Desmarcar
                </button>
                {/* Sem a questão no banco não há o que reportar: ela já saiu
                    numa atualização, que era o desfecho desejado. */}
                {q && (
                  <a
                    href={urlDeReporte(q)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-0.5 ml-3 text-xs text-slate-500 underline underline-offset-2 dark:text-slate-400"
                  >
                    Reportar o erro
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
