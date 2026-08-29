"use client";

import type { Classe, MotivoFim, Resposta, Tema } from "@/lib/tipos";
import AcoesResultado from "./AcoesResultado";
import AvisoGravacaoRecusada from "./AvisoGravacaoRecusada";
import {
  CLASSE_PADRAO,
  FORMATO,
  percentualAprovacao,
} from "@/lib/constantes";
import Gabarito from "./Gabarito";

interface Props {
  respostas: Resposta[];
  onReiniciar: () => void;
  classe?: Classe;
  /**
   * "revisao" e "assunto" são estudo, não prova: sem veredito de aprovação —
   * na revisão o placar diz quantos erros antigos foram corrigidos; no
   * assunto, quanto da seção você já domina.
   */
  modo?: "prova" | "revisao" | "assunto";
  /** Bateria feita no modo cego: o gabarito abre completo. */
  cega?: boolean;
  motivoFim?: MotivoFim;
  /** Matéria da bateria, para o texto de compartilhamento. */
  tema?: Tema;
  /** O navegador recusou gravar o registro desta bateria no histórico. */
  gravacaoRecusada?: boolean;
  /**
   * Bateria de desafio: o código entra na tela e o link vai junto no
   * compartilhamento, para o grupo comparar a mesma bateria.
   */
  desafio?: { semente: string; link: string; codigo: string };
}

export default function TelaResultado({
  respostas,
  onReiniciar,
  classe = CLASSE_PADRAO,
  modo = "prova",
  cega = false,
  motivoFim = "tempo",
  tema,
  gravacaoRecusada = false,
  desafio,
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
  const naoRespondidas = respostas.filter((r) => r.respondeu === null).length;

  if (modo === "revisao" || modo === "assunto") {
    return (
      <div className="space-y-8">
        <div className="rounded-2xl border-2 border-slate-300 p-8 text-center dark:border-slate-700">
          <div className="text-5xl font-bold">
            {acertos}
            <span className="text-2xl font-normal opacity-50">/{total}</span>
          </div>
          <div className="mt-4 text-lg font-semibold">
            {modo === "assunto"
              ? acertos === total
                ? "Assunto dominado — por hoje"
                : `${acertos} de ${total} no assunto, ${total - acertos} para rever`
              : acertos === total
                ? "Todos os erros corrigidos"
                : `${acertos} ${acertos === 1 ? "erro corrigido" : "erros corrigidos"}, ${total - acertos} para revisar de novo`}
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {modo === "assunto"
              ? "Estudo por assunto não tem veredito de aprovação: o que você errou entra na revisão de erros."
              : "Revisão não tem veredito de aprovação: o que você acertou sai da lista de erros; o que errou volta a aparecer."}
          </p>
        </div>

        {gravacaoRecusada && <AvisoGravacaoRecusada />}

        <AcoesResultado
          resumo={{ classe, tema, acertos, total }}
        />

        <Gabarito respostas={respostas} tituloErros="Ainda em aberto" />

        <button
          onClick={onReiniciar}
          className="nao-imprimir w-full rounded-xl bg-slate-900 px-6 py-4 font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          Voltar ao início
        </button>
      </div>
    );
  }

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
        {/* No modo cego dá para encerrar antes da hora com questões em branco.
            Anunciar "tempo esgotado" nesse caso seria mentira. */}
        {naoRespondidas > 0 && (
          <p className="mt-2 text-sm font-medium text-rose-700 dark:text-rose-400">
            {motivoFim === "tempo" ? "Tempo esgotado: " : ""}
            {naoRespondidas}{" "}
            {naoRespondidas === 1
              ? "questão ficou sem resposta e conta"
              : "questões ficaram sem resposta e contam"}{" "}
            como erro, igual à prova real.
          </p>
        )}
      </div>

      {gravacaoRecusada && <AvisoGravacaoRecusada />}

      {desafio && (
        <div className="rounded-xl border border-slate-300 p-4 text-sm dark:border-slate-700">
          <div>
            Desafio <span className="font-mono font-bold">{desafio.semente}</span>{" "}
            · bateria{" "}
            <span className="font-mono font-bold">{desafio.codigo}</span>
          </div>
          {/* O código é a impressão digital das questões sorteadas. Se dois
              resultados do mesmo desafio trouxerem códigos diferentes, os
              aparelhos estão em versões diferentes do banco — e comparar as
              notas não faria sentido. Melhor descobrir aqui do que na
              discussão sobre quem foi melhor. */}
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            Compare com quem abriu o mesmo link. Código de bateria diferente
            significa banco de questões diferente — aí não são a mesma prova.
          </p>
        </div>
      )}

      <AcoesResultado
        resumo={{ classe, tema, acertos, total, aprovado, desafio }}
      />

      <Gabarito respostas={respostas} permitirTodas={cega} />

      <button
        onClick={onReiniciar}
        className="nao-imprimir w-full rounded-xl bg-slate-900 px-6 py-4 font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
      >
        Novo simulado
      </button>
    </div>
  );
}

