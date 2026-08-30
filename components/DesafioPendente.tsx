"use client";

import { ROTULO_CURTO } from "@/lib/constantes";
import { minutosDoDesafio, type Desafio } from "@/lib/desafio";
import Icone from "./Icone";

/**
 * O desafio que chegou por link e ficou para depois.
 *
 * "Deixar para depois" era um beco: a tela de desafio saía para a home e não
 * restava pista nenhuma de que havia um desafio esperando — a URL ainda
 * trazia `?desafio=…`, mas a única forma de voltar era recarregar a página ou
 * reabrir a mensagem no WhatsApp. Quem só queria ver o app antes de encarar
 * 30 minutos cronometrados perdia o desafio.
 *
 * Uma faixa, e não um cartão: a bateria em curso é que tem prazo e merece o
 * peso do topo; o desafio espera enquanto o link existir.
 */
export default function DesafioPendente({
  desafio,
  onAbrir,
}: {
  desafio: Desafio;
  onAbrir: () => void;
}) {
  return (
    <button
      onClick={onAbrir}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-borda bg-superficie px-4 py-3 text-left transition hover:border-slate-400 dark:hover:border-slate-500"
    >
      <span className="min-w-0 text-sm">
        <span className="font-semibold">
          Desafio <span className="font-mono">{desafio.semente}</span>
        </span>{" "}
        <span className="text-slate-600 dark:text-slate-400">
          · {desafio.temas.map((t) => ROTULO_CURTO[t]).join(", ")} ·{" "}
          {desafio.quantidade} questões · {minutosDoDesafio(desafio)} min
        </span>
      </span>
      <Icone nome="seta-direita" className="h-4 w-4 shrink-0" />
    </button>
  );
}
