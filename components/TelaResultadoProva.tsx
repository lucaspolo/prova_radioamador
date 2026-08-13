"use client";

import type { Classe, Resposta, Tema } from "@/lib/tipos";
import { COR_TEMA, FORMATO, ROTULO_CURTO } from "@/lib/constantes";
import Gabarito from "./Gabarito";
import AcoesResultado from "./AcoesResultado";
import AvisoGravacaoRecusada from "./AvisoGravacaoRecusada";

export interface MateriaConcluida {
  tema: Tema;
  respostas: Resposta[];
}

interface Props {
  classe: Classe;
  materias: MateriaConcluida[];
  onReiniciar: () => void;
  /** O navegador recusou gravar o registro de alguma matéria no histórico. */
  gravacaoRecusada?: boolean;
}

/**
 * O veredito da prova completa: aprovado somente com o mínimo em CADA matéria.
 *
 * É o critério oficial que a antiga bateria mista escondia — média entre
 * matérias não existe na prova da Anatel.
 */
export default function TelaResultadoProva({
  classe,
  materias,
  onReiniciar,
  gravacaoRecusada = false,
}: Props) {
  const formato = FORMATO[classe];
  const porMateria = materias.map((m) => {
    const acertos = m.respostas.filter((r) => r.acertou).length;
    return { ...m, acertos, aprovado: acertos >= formato.minimo };
  });
  const aprovadoGeral = porMateria.every((m) => m.aprovado);
  const reprovadas = porMateria.filter((m) => !m.aprovado);
  // A prova completa é cega: o gabarito das três matérias só aparece aqui, e
  // aparece inteiro — inclusive o das questões acertadas no chute.
  const todas = materias.flatMap((m) => m.respostas);

  return (
    <div className="space-y-8">
      <div
        className={`rounded-2xl border-2 p-8 text-center ${
          aprovadoGeral
            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
            : "border-rose-500 bg-rose-50 dark:bg-rose-950/40"
        }`}
      >
        <div className="text-xs font-semibold tracking-wide uppercase opacity-70">
          Prova completa — Classe {classe}
        </div>
        <div
          className={`mt-3 text-3xl font-bold ${
            aprovadoGeral
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-rose-700 dark:text-rose-300"
          }`}
        >
          {aprovadoGeral ? "Aprovado" : "Reprovado"}
        </div>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {aprovadoGeral
            ? `Mínimo de ${formato.minimo} acertos atingido nas três matérias.`
            : `A aprovação exige ${formato.minimo} de ${formato.questoes} em cada matéria — faltou em ${reprovadas.map((m) => ROTULO_CURTO[m.tema]).join(" e ")}.`}
        </p>
      </div>

      {gravacaoRecusada && <AvisoGravacaoRecusada />}

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
          Resultado por matéria
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {porMateria.map((m) => (
            <div
              key={m.tema}
              className={`rounded-xl border-2 p-4 text-center ${
                m.aprovado
                  ? "border-emerald-300 dark:border-emerald-900"
                  : "border-rose-300 dark:border-rose-900"
              }`}
            >
              <div
                className={`text-xs font-semibold uppercase ${COR_TEMA[m.tema].texto}`}
              >
                {ROTULO_CURTO[m.tema]}
              </div>
              <div className="mt-2 text-3xl font-bold">
                {m.acertos}
                <span className="text-base font-normal opacity-50">
                  /{m.respostas.length}
                </span>
              </div>
              <div
                className={`mt-1 text-sm font-semibold ${
                  m.aprovado
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {m.aprovado ? "Aprovado" : "Reprovado"}
              </div>
            </div>
          ))}
        </div>
      </section>

      <AcoesResultado
        resumo={{
          classe,
          acertos: porMateria.reduce((s, m) => s + m.acertos, 0),
          total: todas.length,
          aprovado: aprovadoGeral,
          materias: porMateria.map((m) => ({
            tema: m.tema,
            acertos: m.acertos,
            total: m.respostas.length,
            aprovado: m.aprovado,
          })),
        }}
      />

      <Gabarito respostas={todas} permitirTodas />

      <button
        onClick={onReiniciar}
        className="nao-imprimir w-full rounded-xl bg-slate-900 px-6 py-4 font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
      >
        Voltar ao início
      </button>
    </div>
  );
}
