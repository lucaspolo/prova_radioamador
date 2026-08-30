"use client";

import Link from "next/link";
import type { TopicoEmenta } from "@/lib/ementa";
import Icone from "./Icone";

/**
 * A tela que recebe um assunto vindo de `/estudar`: o que vai acontecer,
 * antes de acontecer.
 *
 * O "Treinar" da página de material caía direto na questão 1 de 37 — sem dizer
 * antes que seriam 37 de uma vez, e sem volta ao material que não fosse
 * "Abandonar". É a mesma hostilidade que a tela de desafio existe para evitar,
 * e pela mesma razão: quem clicou pode estar no ônibus.
 *
 * O texto do item da ementa aparece aqui porque é ele que define a bateria —
 * a matéria não é "Eletrônica", é este parágrafo do Ato.
 */
export default function TelaAssuntoPouso({
  topico,
  quantidade,
  onComecar,
}: {
  topico: TopicoEmenta;
  quantidade: number;
  onComecar: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border-2 border-slate-900 p-6 dark:border-slate-100">
        <div className="rotulo-secao">Estudo por assunto</div>
        <h2 className="mt-1 text-2xl font-bold text-balance">
          {topico.titulo ?? "Item da ementa"}
        </h2>
        <p className="mt-3 leading-relaxed">{topico.texto}</p>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          {quantidade} {quantidade === 1 ? "questão" : "questões"} · modo treino
          · sem cronômetro
        </p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          A bateria é a seção inteira, com gabarito e explicação a cada questão.
          Não tem veredito de aprovação: o que você errar entra na revisão de
          erros.
        </p>
      </div>

      <button
        onClick={onComecar}
        className="w-full rounded-xl bg-slate-900 px-6 py-4 text-base font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
      >
        Começar · {quantidade} {quantidade === 1 ? "questão" : "questões"}
      </button>
      {/* Um <Link>, e não um botão: veio de `/estudar`, e voltar para lá é
          navegação de verdade — inclusive para quem abriu o link em outra aba
          e nunca esteve na página de material. */}
      <Link
        href="/estudar"
        className="block w-full rounded-xl border-2 border-slate-300 px-6 py-3 text-center font-medium transition hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
      >
        <Icone nome="seta-esquerda" className="mr-1 h-4 w-4 align-[-3px]" />
        Voltar ao material
      </Link>
    </div>
  );
}
