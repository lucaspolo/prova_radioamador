"use client";

import { ROTULO_CURTO } from "@/lib/constantes";
import { minutosDoDesafio, type Desafio } from "@/lib/desafio";

/**
 * A tela que recebe um desafio: o que vai acontecer, antes de acontecer.
 *
 * Cair num cronômetro de prova cega ao abrir um link seria hostil — quem
 * clicou pode estar no ônibus, sem 30 minutos na mão. O desafio espera aqui.
 */
export default function TelaDesafio({
  desafio,
  onComecar,
  onIgnorar,
}: {
  desafio: Desafio;
  onComecar: () => void;
  onIgnorar: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border-2 border-slate-900 p-6 dark:border-slate-100">
        <div className="rotulo-secao">
          Desafio recebido
        </div>
        <h2 className="mt-1 text-2xl font-bold">
          <span className="font-mono">{desafio.semente}</span>
        </h2>
        <p className="mt-3 leading-relaxed">
          {desafio.temas.map((t) => ROTULO_CURTO[t]).join(" · ")}
        </p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {desafio.quantidade} questões e {minutosDoDesafio(desafio)} min{" "}
          {desafio.temas.length > 1 ? "em cada matéria" : "na matéria"} · Classe{" "}
          {desafio.classe}
          {desafio.temas.length > 1 &&
            ` · ${desafio.quantidade * desafio.temas.length} questões no total`}
        </p>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          Todo mundo que abrir este link responde às mesmas questões, na mesma
          ordem — o sorteio vem da semente, não do seu histórico. Vale como
          bateria normal no seu desempenho.
          {desafio.temas.length > 1 &&
            " Cada matéria é um exame separado, com seu cronômetro e seu mínimo."}
        </p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Corre em <span className="font-medium">modo prova</span>: sem gabarito
          até o fim, com o cronômetro no ritmo oficial da Classe{" "}
          {desafio.classe}. Sem isso, comparar os resultados não diria nada.
        </p>
      </div>

      <button
        onClick={onComecar}
        className="w-full rounded-xl bg-slate-900 px-6 py-4 text-base font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
      >
        Começar o desafio
      </button>
      <button
        onClick={onIgnorar}
        className="w-full rounded-xl border-2 border-slate-300 px-6 py-3 font-medium transition hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
      >
        Agora não — ir para o início
      </button>
    </div>
  );
}
