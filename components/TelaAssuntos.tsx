"use client";

import { useEffect, useRef, useState } from "react";
import type { Classe, Questao } from "@/lib/tipos";
import { CLASSE_PADRAO } from "@/lib/constantes";
import type { Historico } from "@/lib/historico";
import { desempenhoPorQuestao } from "@/lib/prioridade";
import { lerPreferencias } from "@/lib/preferencias";
import { listarAssuntos } from "@/lib/secoes";

interface Props {
  historico: Historico;
  onEstudar: (questoes: Questao[]) => void;
  onVoltar: () => void;
}

/**
 * Estudar por assunto: as seções reais dos PDFs (questões de documento) e os
 * tópicos da ementa, com o desempenho de quem estuda em cada um. É o que
 * transforma "Eletrônica em 48%" em "o fraco é propagação" — e a bateria sai
 * só dali.
 */
export default function TelaAssuntos({ historico, onEstudar, onVoltar }: Props) {
  const [classe, setClasse] = useState<Classe>(CLASSE_PADRAO);
  const titulo = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titulo.current?.focus();
    // Mesmo padrão de hidratação do resto do app: a classe preferida define
    // o acervo, e o storage só existe no cliente.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClasse(lerPreferencias().classe);
  }, []);

  const desempenho = desempenhoPorQuestao(historico);
  const assuntos = listarAssuntos(classe);

  // Agrupa preservando a ordem da lib: documentos primeiro, ementa depois.
  const porGrupo = new Map<string, typeof assuntos>();
  for (const a of assuntos) {
    const lista = porGrupo.get(a.grupo);
    if (lista) lista.push(a);
    else porGrupo.set(a.grupo, [a]);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 ref={titulo} tabIndex={-1} className="text-xl font-bold">
          Estudar por assunto
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          As seções do material oficial e os tópicos da ementa, com o seu
          aproveitamento em cada um. A bateria sai só do assunto escolhido, em
          modo treino e sem cronômetro.
        </p>
      </div>

      {[...porGrupo.entries()].map(([grupo, doGrupo]) => (
        <section key={grupo}>
          <h3 className="mb-2 text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
            {grupo}
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {doGrupo.map(({ titulo, secao, questoes }) => {
              let vistas = 0;
              let acertosAgora = 0;
              for (const q of questoes) {
                const d = desempenho.get(q.id);
                if (!d) continue;
                vistas++;
                if (!d.errouNaUltima) acertosAgora++;
              }
              return (
                <button
                  key={titulo}
                  onClick={() => onEstudar(questoes)}
                  className="rounded-xl border-2 border-slate-300 px-4 py-3 text-left transition hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">{titulo}</span>
                    {secao && (
                      <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                        pp. {secao.paginaInicio}
                        {secao.paginaFim !== secao.paginaInicio &&
                          `–${secao.paginaFim}`}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                    {questoes.length}{" "}
                    {questoes.length === 1 ? "questão" : "questões"}
                    {vistas > 0 && ` · viu ${vistas}, sabe ${acertosAgora}`}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <button
        onClick={onVoltar}
        className="w-full rounded-xl border-2 border-slate-300 px-6 py-3 font-semibold transition hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
      >
        Voltar ao início
      </button>
    </div>
  );
}
