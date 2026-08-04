"use client";

import { useState } from "react";
import type { EscolhaTema } from "@/lib/tipos";
import {
  COR_TEMA,
  MINIMO_APROVACAO,
  QUESTOES_POR_MATERIA,
  ROTULO_CURTO,
  TAMANHOS,
  TEMAS,
} from "@/lib/constantes";
import { contarPorTema, disponiveis } from "@/lib/questoes";

interface Props {
  onIniciar: (escolha: EscolhaTema, quantidade: number) => void;
}

export default function TelaInicio({ onIniciar }: Props) {
  const [escolha, setEscolha] = useState<EscolhaTema>("todos");
  const [quantidade, setQuantidade] = useState(QUESTOES_POR_MATERIA);
  const contagem = contarPorTema();
  const total = disponiveis(escolha);

  // Não dá para sortear mais questões do que existem no tema escolhido.
  const limite = Math.min(quantidade, total);

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
          Matéria
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <BotaoTema
            ativo={escolha === "todos"}
            titulo="Todos os Temas"
            detalhe={`${contagem["Legislação de Telecomunicações"] + contagem["Técnica e ética operacional"] + contagem["Conhecimentos de Eletrônica e Eletricidade"]} questões · divididas igualmente`}
            classes="border-slate-300 dark:border-slate-700"
            onClick={() => setEscolha("todos")}
          />
          {TEMAS.map((tema) => (
            <BotaoTema
              key={tema}
              ativo={escolha === tema}
              titulo={ROTULO_CURTO[tema]}
              detalhe={`${contagem[tema]} questões`}
              classes={`${COR_TEMA[tema].borda} ${COR_TEMA[tema].texto}`}
              onClick={() => setEscolha(tema)}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
          Quantidade de questões
        </h2>
        <div className="flex flex-wrap gap-2">
          {TAMANHOS.map((n) => (
            <button
              key={n}
              onClick={() => setQuantidade(n)}
              disabled={n > total}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                quantidade === n
                  ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                  : "border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
              }`}
            >
              {n}
              {n === QUESTOES_POR_MATERIA && (
                <span className="ml-1.5 text-xs opacity-70">prova real</span>
              )}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          A prova da Anatel tem {QUESTOES_POR_MATERIA} questões por matéria e
          exige {MINIMO_APROVACAO} acertos para aprovação.
        </p>
      </section>

      <button
        onClick={() => onIniciar(escolha, limite)}
        className="w-full rounded-xl bg-slate-900 px-6 py-4 text-base font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
      >
        Iniciar simulado · {limite} questões
      </button>
    </div>
  );
}

function BotaoTema({
  ativo,
  titulo,
  detalhe,
  classes,
  onClick,
}: {
  ativo: boolean;
  titulo: string;
  detalhe: string;
  classes: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border-2 p-4 text-left transition ${classes} ${
        ativo
          ? "ring-2 ring-slate-900 ring-offset-2 ring-offset-[var(--background)] dark:ring-slate-100"
          : "opacity-70 hover:opacity-100"
      }`}
    >
      <div className="font-semibold">{titulo}</div>
      <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
        {detalhe}
      </div>
    </button>
  );
}
