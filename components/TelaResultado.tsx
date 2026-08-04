"use client";

import type { Resposta, Tema } from "@/lib/tipos";
import {
  COR_TEMA,
  MINIMO_APROVACAO,
  PERCENTUAL_APROVACAO,
  QUESTOES_POR_MATERIA,
  ROTULO_CURTO,
  TEMAS,
} from "@/lib/constantes";
import BotaoConsultarMaterial from "./BotaoConsultarMaterial";

interface Props {
  respostas: Resposta[];
  onReiniciar: () => void;
}

export default function TelaResultado({ respostas, onReiniciar }: Props) {
  const total = respostas.length;
  const acertos = respostas.filter((r) => r.acertou).length;
  const percentual = total > 0 ? Math.round((acertos / total) * 100) : 0;
  const aprovado = percentual >= PERCENTUAL_APROVACAO;

  // O critério oficial é 11 de 20 por matéria. Numa bateria de outro tamanho o
  // número absoluto não se aplica, então comparamos pelo percentual (55%).
  const bateriaOficial = total === QUESTOES_POR_MATERIA;
  const erradas = respostas.filter((r) => !r.acertou);

  return (
    <div className="space-y-8">
      <div
        className={`rounded-2xl border-2 p-8 text-center ${
          aprovado
            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
            : "border-rose-500 bg-rose-50 dark:bg-rose-950/40"
        }`}
      >
        <div className="text-5xl font-bold">
          {acertos}
          <span className="text-2xl font-normal opacity-50">/{total}</span>
        </div>
        <div className="mt-2 text-2xl font-semibold">{percentual}%</div>
        <div
          className={`mt-4 text-lg font-bold ${
            aprovado
              ? "text-emerald-700 dark:text-emerald-300"
              : "text-rose-700 dark:text-rose-300"
          }`}
        >
          {aprovado ? "Aprovado" : "Reprovado"}
        </div>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          {bateriaOficial
            ? `Critério oficial: ${MINIMO_APROVACAO} de ${QUESTOES_POR_MATERIA} acertos.`
            : `Critério oficial: ${PERCENTUAL_APROVACAO}% (${MINIMO_APROVACAO} de ${QUESTOES_POR_MATERIA} na prova real).`}
        </p>
      </div>

      {/* Desempenho por matéria, quando a bateria misturou temas */}
      <PorTema respostas={respostas} />

      {erradas.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
            Revisão dos erros ({erradas.length})
          </h2>
          <div className="space-y-3">
            {erradas.map((r) => (
              <div
                key={r.questao.id}
                className="rounded-xl border border-slate-300 p-4 dark:border-slate-700"
              >
                <div
                  className={`mb-2 text-xs font-semibold uppercase ${COR_TEMA[r.questao.tema].texto}`}
                >
                  {ROTULO_CURTO[r.questao.tema]}
                </div>
                <p className="leading-relaxed font-medium">
                  {r.questao.afirmacao}
                </p>
                <p className="mt-2 text-sm">
                  <span className="font-semibold text-rose-600 dark:text-rose-400">
                    Você respondeu {r.respondeu ? "Verdadeiro" : "Falso"}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {" "}
                    · o correto é{" "}
                    {r.questao.resposta_correta ? "Verdadeiro" : "Falso"}
                  </span>
                </p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  {r.questao.explicacao_curta}
                </p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">
                  {r.questao.arquivo_origem} · página {r.questao.pagina}
                </p>
                <BotaoConsultarMaterial
                  arquivoOrigem={r.questao.arquivo_origem}
                  pagina={r.questao.pagina}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      <button
        onClick={onReiniciar}
        className="w-full rounded-xl bg-slate-900 px-6 py-4 font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
      >
        Novo simulado
      </button>
    </div>
  );
}

function PorTema({ respostas }: { respostas: Resposta[] }) {
  const presentes = TEMAS.filter((t) =>
    respostas.some((r) => r.questao.tema === t),
  );
  // Com um único tema, a barra repetiria o placar geral.
  if (presentes.length < 2) return null;

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
        Desempenho por matéria
      </h2>
      <div className="space-y-3">
        {presentes.map((tema: Tema) => {
          const doTema = respostas.filter((r) => r.questao.tema === tema);
          const certas = doTema.filter((r) => r.acertou).length;
          const pct = Math.round((certas / doTema.length) * 100);
          return (
            <div key={tema}>
              <div className="mb-1 flex justify-between text-sm">
                <span className={COR_TEMA[tema].texto}>
                  {ROTULO_CURTO[tema]}
                </span>
                <span className="font-medium">
                  {certas}/{doTema.length} · {pct}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className={`h-full rounded-full ${COR_TEMA[tema].barra}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
