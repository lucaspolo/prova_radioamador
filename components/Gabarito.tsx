"use client";

import { useState } from "react";
import type { Resposta } from "@/lib/tipos";
import RevisaoErros from "./RevisaoErros";

interface Props {
  respostas: Resposta[];
  /**
   * Numa bateria cega o usuário nunca viu o gabarito de questão nenhuma —
   * inclusive das que acertou no chute, que são justamente as que vale a pena
   * conferir. Aí a lista abre completa, com filtro para só os erros.
   */
  permitirTodas?: boolean;
  tituloErros?: string;
}

export default function Gabarito({
  respostas,
  permitirTodas = false,
  tituloErros = "Revisão dos erros",
}: Props) {
  const [filtro, setFiltro] = useState<"todas" | "erros" | "marcadas">("todas");
  const erradas = respostas.filter((r) => !r.acertou);
  const marcadas = respostas.filter((r) => r.marcada);

  if (!permitirTodas) {
    if (erradas.length === 0) return null;
    return (
      <section>
        <h2 className="rotulo-secao mb-3">
          {tituloErros} ({erradas.length})
        </h2>
        <RevisaoErros itens={erradas} />
      </section>
    );
  }

  const itens =
    filtro === "erros" ? erradas : filtro === "marcadas" ? marcadas : respostas;
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="rotulo-secao">
          Gabarito
        </h2>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <FiltroBotao
            ativo={filtro === "todas"}
            onClick={() => setFiltro("todas")}
            rotulo={`Todas (${respostas.length})`}
          />
          <FiltroBotao
            ativo={filtro === "erros"}
            onClick={() => setFiltro("erros")}
            rotulo={`Só os erros (${erradas.length})`}
          />
          {/* Só existe quando houve dúvida assumida na prova. É o filtro que
              responde "o que eu chutei e passou?", que é o motivo de o
              gabarito de uma prova cega abrir completo. */}
          {marcadas.length > 0 && (
            <FiltroBotao
              ativo={filtro === "marcadas"}
              onClick={() => setFiltro("marcadas")}
              rotulo={`Marcadas (${marcadas.length})`}
            />
          )}
        </div>
      </div>
      {itens.length > 0 ? (
        <RevisaoErros itens={itens} />
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {filtro === "marcadas"
            ? "Nenhuma questão marcada nesta bateria."
            : "Nenhum erro nesta bateria."}
        </p>
      )}
    </section>
  );
}

function FiltroBotao({
  ativo,
  onClick,
  rotulo,
}: {
  ativo: boolean;
  onClick: () => void;
  rotulo: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={ativo}
      className={`alvo-toque rounded-full border px-4 font-medium transition ${
        ativo
          ? "border-slate-900 bg-rebaixado font-semibold dark:border-slate-100"
          : "border-slate-300 text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:text-slate-300"
      }`}
    >
      {rotulo}
    </button>
  );
}
