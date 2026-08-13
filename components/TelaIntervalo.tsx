"use client";

import type { Classe, Resposta, Tema } from "@/lib/tipos";
import {
  aprovadoNaMateria,
  FORMATO,
  ROTULO_CURTO,
  COR_TEMA,
  tempoDaBateria,
} from "@/lib/constantes";

interface Props {
  classe: Classe;
  tema: Tema;
  respostas: Resposta[];
  /** Questões por matéria, que nem sempre é o tamanho oficial. */
  quantidade: number;
  proximoTema: Tema;
  cronometrado: boolean;
  /** Quantas matérias ainda faltam, contando a próxima. */
  restantes: number;
  onProsseguir: () => void;
  onAbandonar: () => void;
}

/**
 * O intervalo entre matérias de uma bateria de várias.
 *
 * Mostra só o placar da matéria concluída — a revisão dos erros fica para o
 * final, como na prova real: durante o exame não se consulta gabarito. O
 * cronômetro da próxima matéria só dispara quando o candidato decidir começar.
 */
export default function TelaIntervalo({
  classe,
  tema,
  respostas,
  quantidade,
  proximoTema,
  cronometrado,
  restantes,
  onProsseguir,
  onAbandonar,
}: Props) {
  const formato = FORMATO[classe];
  const acertos = respostas.filter((r) => r.acertou).length;
  // O mínimo absoluto só vale no tamanho oficial; fora dele, a proporção.
  const aprovado = aprovadoNaMateria(classe, acertos, respostas.length);
  const minutos = Math.round(tempoDaBateria(classe, quantidade) / 60);

  return (
    <div className="space-y-8">
      <div
        className={`rounded-2xl border-2 p-8 text-center ${
          aprovado
            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
            : "border-rose-500 bg-rose-50 dark:bg-rose-950/40"
        }`}
      >
        <div className={`text-xs font-semibold uppercase ${COR_TEMA[tema].texto}`}>
          {ROTULO_CURTO[tema]} — concluída
        </div>
        <div className="mt-3 text-5xl font-bold">
          {acertos}
          <span className="text-2xl font-normal opacity-50">
            /{respostas.length}
          </span>
        </div>
        <div
          className={`mt-3 text-lg font-bold ${
            aprovado
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-rose-700 dark:text-rose-300"
          }`}
        >
          {aprovado ? "Aprovado na matéria" : "Reprovado na matéria"}
        </div>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {respostas.length === formato.questoes
            ? `Mínimo: ${formato.minimo} de ${formato.questoes}.`
            : `Critério oficial: ${formato.minimo} de ${formato.questoes} — aqui, a proporção equivalente.`}{" "}
          A revisão dos erros fica para o fim.
        </p>
      </div>

      <div className="rounded-xl border border-slate-300 p-5 text-center dark:border-slate-700">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Próxima matéria:{" "}
          <strong className={COR_TEMA[proximoTema].texto}>
            {ROTULO_CURTO[proximoTema]}
          </strong>{" "}
          — {quantidade} questões
          {cronometrado ? ` em ${minutos} minutos` : ", sem cronômetro"}.
          {restantes > 1 && ` Ainda faltam ${restantes} matérias.`}
          {cronometrado && " O cronômetro começa quando você iniciar."}
        </p>
      </div>

      <button
        onClick={onProsseguir}
        className="w-full rounded-xl bg-slate-900 px-6 py-4 font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
      >
        Iniciar {ROTULO_CURTO[proximoTema]}
      </button>

      <button
        onClick={onAbandonar}
        className="w-full py-2 text-sm text-slate-500 underline-offset-4 hover:underline dark:text-slate-400"
      >
        Abandonar a bateria
      </button>
    </div>
  );
}
