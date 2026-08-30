"use client";

import { ROTULO_CURTO } from "@/lib/constantes";
import { respondidasEm, type Retomada } from "@/lib/bateria-em-curso";

interface Props {
  retomada: Retomada;
  onRetomar: () => void;
  onDescartar: () => void;
}

function minutos(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return m > 0 ? `${m} min` : `${s}s`;
}

/**
 * O convite para voltar à bateria que ficou pela metade.
 *
 * Aparece no topo da tela inicial, acima de tudo, porque é a única coisa da
 * home com prazo: a bateria vale por 12 horas e, se for cronometrada, morre
 * junto com o prazo dela. É um cartão, e não um aviso automático, porque
 * retomar tem de ser escolha — quem quis mesmo recomeçar toca em "Descartar" e
 * a tela volta ao normal.
 */
export default function CartaoRetomar({
  retomada,
  onRetomar,
  onDescartar,
}: Props) {
  const { bateria, restanteSegundos } = retomada;
  const respondidas = respondidasEm(bateria);
  const total = bateria.ids.length;
  const rotulo =
    bateria.modo === "revisao"
      ? "Revisão de erros"
      : bateria.modo === "assunto"
        ? "Estudo por assunto"
        : `${ROTULO_CURTO[bateria.tema]} · Classe ${bateria.classe}`;

  return (
    <section className="rounded-2xl border-2 border-slate-900 p-4 dark:border-slate-100">
      <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
        Bateria em andamento
      </h2>
      <p className="mt-1 font-semibold">
        {rotulo} · {bateria.regime === "cego" ? "modo prova" : "modo treino"}
      </p>
      <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
        {respondidas} de {total} respondidas
        {restanteSegundos !== null && (
          <> · restam {minutos(restanteSegundos)} de cronômetro</>
        )}
        {bateria.materias.length > 0 && (
          <>
            {" "}
            · {bateria.materias.length}{" "}
            {bateria.materias.length === 1
              ? "matéria já concluída"
              : "matérias já concluídas"}
          </>
        )}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
        <button
          onClick={onRetomar}
          className="rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
        >
          Continuar de onde parou
        </button>
        <button
          onClick={onDescartar}
          className="rounded-xl border-2 border-slate-300 px-4 py-3 text-sm font-medium transition hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
        >
          Descartar
        </button>
      </div>
    </section>
  );
}
