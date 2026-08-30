"use client";

import { useState } from "react";
import type { Classe, MotivoFim, Resposta, Tema } from "@/lib/tipos";
import AvisoEmBranco from "./AvisoEmBranco";
import {
  aprovadoNaMateria,
  FORMATO,
  minimoEquivalente,
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
  /** Por que a matéria terminou — o aviso de questões em branco depende disso. */
  motivoFim?: MotivoFim;
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
  motivoFim = "manual",
  onProsseguir,
  onAbandonar,
}: Props) {
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);
  const formato = FORMATO[classe];
  const acertos = respostas.filter((r) => r.acertou).length;
  // O mínimo absoluto só vale no tamanho oficial; fora dele, a proporção.
  const aprovado = aprovadoNaMateria(classe, acertos, respostas.length);
  const minimo = minimoEquivalente(classe, respostas.length);
  const naoRespondidas = respostas.filter((r) => r.respondeu === null).length;
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
        <div
          className={`text-xs font-semibold uppercase ${COR_TEMA[tema].texto}`}
        >
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
        {/* O mínimo desta bateria em número, e não como proporção a calcular:
            quem acabou de fazer 8 de 10 não deveria precisar converter "11 de
            20 na prova real" para saber com quanto passaria aqui. */}
        <p className="mt-2 font-medium">
          {aprovado
            ? `${acertos - minimo} de folga sobre o mínimo de ${minimo} de ${respostas.length}.`
            : `${minimo - acertos} ${minimo - acertos === 1 ? "acerto faltou" : "acertos faltaram"} para o mínimo de ${minimo} de ${respostas.length}.`}
        </p>
        <AvisoEmBranco naoRespondidas={naoRespondidas} motivoFim={motivoFim} />
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {respostas.length === formato.questoes
            ? `Critério oficial da Classe ${classe}.`
            : `Critério oficial: ${formato.minimo} de ${formato.questoes} — aqui, a proporção equivalente.`}{" "}
          A revisão dos erros fica para o fim.
        </p>
      </div>

      <div className="rounded-xl border border-borda bg-superficie p-5 text-center">
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
        className="w-full rounded-xl bg-slate-900 px-6 py-4 font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
      >
        Iniciar {ROTULO_CURTO[proximoTema]}
      </button>

      {/* Abandonar aqui não descarta o que já foi feito — a matéria concluída
          já entrou no histórico —, mas a tela acabou de prometer que "a
          revisão dos erros fica para o fim", e esse fim nunca chega. A
          confirmação diz as duas coisas: o que fica e o que não será feito. */}
      {!confirmandoSaida ? (
        <div className="text-center">
          <button
            onClick={() => setConfirmandoSaida(true)}
            className="alvo-toque px-3 text-sm text-slate-500 underline-offset-4 hover:underline dark:text-slate-400"
          >
            Abandonar a bateria
          </button>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-amber-500 bg-amber-50 p-4 dark:bg-amber-950/40">
          <p className="text-sm font-medium">
            {ROTULO_CURTO[tema]} fica registrada ({acertos} de{" "}
            {respostas.length}) e os erros vão para a revisão.{" "}
            {restantes === 1
              ? `${ROTULO_CURTO[proximoTema]} não será feita, e o gabarito dela não aparece.`
              : restantes === 2
                ? `${ROTULO_CURTO[proximoTema]} e a outra matéria não serão feitas, e o gabarito delas não aparece.`
                : `${ROTULO_CURTO[proximoTema]} e as outras ${restantes - 1} matérias não serão feitas, e o gabarito delas não aparece.`}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              onClick={() => setConfirmandoSaida(false)}
              className="rounded-lg border-2 border-slate-400 px-4 py-2 text-sm font-semibold transition hover:border-slate-500"
            >
              Continuar a bateria
            </button>
            <button
              onClick={onAbandonar}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
            >
              Abandonar mesmo assim
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
