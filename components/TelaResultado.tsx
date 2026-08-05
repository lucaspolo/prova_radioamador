"use client";

import type { Classe, Resposta } from "@/lib/tipos";
import {
  CLASSE_PADRAO,
  COR_TEMA,
  FORMATO,
  percentualAprovacao,
  ROTULO_CURTO,
} from "@/lib/constantes";
import BotaoConsultarMaterial from "./BotaoConsultarMaterial";
import TrechoOrigem from "./TrechoOrigem";

interface Props {
  respostas: Resposta[];
  onReiniciar: () => void;
  classe?: Classe;
}

export default function TelaResultado({
  respostas,
  onReiniciar,
  classe = CLASSE_PADRAO,
}: Props) {
  const formato = FORMATO[classe];
  const corte = percentualAprovacao(classe);
  const total = respostas.length;
  const acertos = respostas.filter((r) => r.acertou).length;
  const percentual = total > 0 ? Math.round((acertos / total) * 100) : 0;
  const aprovado = percentual >= corte;

  // O critério oficial é um número absoluto de acertos por matéria (11 de 20 na
  // Classe B). Numa bateria de outro tamanho ele não se aplica, então
  // comparamos pelo percentual equivalente.
  const bateriaOficial = total === formato.questoes;
  const erradas = respostas.filter((r) => !r.acertou);
  const naoRespondidas = respostas.filter((r) => r.respondeu === null).length;

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
            ? `Classe ${classe} — critério oficial: ${formato.minimo} de ${formato.questoes} acertos.`
            : `Classe ${classe} — critério oficial: ${corte}% (${formato.minimo} de ${formato.questoes} na prova real).`}
        </p>
        {naoRespondidas > 0 && (
          <p className="mt-2 text-sm font-medium text-rose-600 dark:text-rose-400">
            Tempo esgotado: {naoRespondidas}{" "}
            {naoRespondidas === 1
              ? "questão ficou sem resposta e conta"
              : "questões ficaram sem resposta e contam"}{" "}
            como erro, igual à prova real.
          </p>
        )}
      </div>


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
                    {r.respondeu === null
                      ? "Não respondida — o tempo esgotou"
                      : `Você respondeu ${r.respondeu ? "Verdadeiro" : "Falso"}`}
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
                  {r.questao.origem === "documento"
                    ? "Fonte: "
                    : "Estude o tema em: "}
                  {r.questao.arquivo_origem} · página {r.questao.pagina}
                </p>
                <BotaoConsultarMaterial
                  arquivoOrigem={r.questao.arquivo_origem}
                  pagina={r.questao.pagina}
                  origem={r.questao.origem}
                />
                <TrechoOrigem
                  trechoId={r.questao.trecho_id}
                  afirmacao={r.questao.afirmacao}
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

