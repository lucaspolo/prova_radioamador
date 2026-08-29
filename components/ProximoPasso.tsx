"use client";

import type { ReactNode } from "react";

export interface Passo {
  rotulo: string;
  detalhe: string;
  onClick: () => void;
}

/**
 * O que fazer com o resultado que acabou de sair.
 *
 * Sem este bloco, a tela de resultado terminava em beco: depois do veredito
 * vinham "Compartilhar", "Imprimir" e a lista de erros, e a única navegação
 * era um "Novo simulado" a três ou nove mil pixels de rolagem, que voltava
 * para a home com matéria e quantidade no padrão. Quem acabou de errar seis
 * questões estava no momento de maior disposição para corrigi-las — e o app
 * pedia que ele reconfigurasse tudo antes.
 *
 * Fica logo abaixo do cartão de veredito, acima do gabarito, porque é ali que
 * o olho está. A primeira ação é a que o resultado pede: revisar os erros
 * quando há erros, repetir quando não há.
 */
export default function ProximoPasso({
  passos,
  children,
}: {
  passos: Passo[];
  children?: ReactNode;
}) {
  if (passos.length === 0) return null;
  const [principal, ...demais] = passos;

  return (
    <section className="nao-imprimir">
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
        E agora?
      </h2>
      {children}
      <button
        onClick={principal.onClick}
        className="w-full rounded-xl bg-slate-900 px-6 py-4 text-left transition hover:bg-slate-700 dark:bg-slate-100 dark:hover:bg-white"
      >
        <span className="block font-semibold text-white dark:text-slate-900">
          {principal.rotulo}
        </span>
        <span className="mt-0.5 block text-sm text-slate-300 dark:text-slate-600">
          {principal.detalhe}
        </span>
      </button>
      {demais.length > 0 && (
        <div
          className={`mt-3 grid gap-3 ${demais.length > 1 ? "sm:grid-cols-2" : ""}`}
        >
          {demais.map((p) => (
            <button
              key={p.rotulo}
              onClick={p.onClick}
              className="rounded-xl border-2 border-slate-300 px-4 py-3 text-left transition hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
            >
              <span className="block font-semibold">{p.rotulo}</span>
              <span className="mt-0.5 block text-sm text-slate-600 dark:text-slate-400">
                {p.detalhe}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
