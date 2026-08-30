"use client";

import { useRef } from "react";
import type { Classe, Resposta, Tema } from "@/lib/tipos";
import {
  aprovadoNaMateria,
  COR_TEMA,
  FORMATO,
  minimoEquivalente,
  ROTULO_CURTO,
} from "@/lib/constantes";
import Gabarito, { type GabaritoApi } from "./Gabarito";
import ProximoPasso, { type Passo } from "./ProximoPasso";
import AcoesResultado from "./AcoesResultado";
import AvisoGravacaoRecusada from "./AvisoGravacaoRecusada";
import Icone from "./Icone";

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
  /**
   * Bateria de desafio. Chega aqui pelo mesmo motivo que chega ao resultado de
   * uma matéria só: é o código que prova que a prova foi a mesma, e o link que
   * leva o resto do radioclube a fazê-la.
   */
  desafio?: { semente: string; link: string; codigo: string };
  onRefazer?: () => void;
  onRevisarErros?: () => void;
}

/**
 * O veredito de uma bateria de várias matérias: aprovado somente com o mínimo
 * em CADA uma.
 *
 * É o critério oficial que uma bateria mista esconderia — média entre matérias
 * não existe na prova da Anatel. Com as três matérias no tamanho oficial, isto
 * é a prova completa; com duas, ou com bateria curta, o veredito é por matéria
 * do mesmo jeito, pela proporção equivalente ao mínimo oficial.
 */
export default function TelaResultadoProva({
  classe,
  materias,
  onReiniciar,
  gravacaoRecusada = false,
  desafio,
  onRefazer,
  onRevisarErros,
}: Props) {
  const formato = FORMATO[classe];
  const porMateria = materias.map((m) => {
    const acertos = m.respostas.filter((r) => r.acertou).length;
    return {
      ...m,
      acertos,
      aprovado: aprovadoNaMateria(classe, acertos, m.respostas.length),
    };
  });
  const provaCompleta =
    materias.length === 3 &&
    materias.every((m) => m.respostas.length === formato.questoes);
  const aprovadoGeral = porMateria.every((m) => m.aprovado);
  const reprovadas = porMateria.filter((m) => !m.aprovado);
  // A prova completa é cega: o gabarito das três matérias só aparece aqui, e
  // aparece inteiro — inclusive o das questões acertadas no chute.
  const todas = materias.flatMap((m) => m.respostas);
  const erradas = todas.filter((r) => !r.acertou);

  // O gabarito responde ao clique nos cartões por matéria: filtra por ela e
  // rola até lá.
  const gabarito = useRef<GabaritoApi>(null);

  const passos: Passo[] = [];
  if (onRevisarErros && erradas.length > 0) {
    passos.push({
      rotulo: `Revisar ${erradas.length === 1 ? "o erro" : `os ${erradas.length} erros`} agora`,
      detalhe:
        "As questões que você errou nas três matérias, em modo treino, com gabarito e explicação.",
      onClick: onRevisarErros,
    });
  }
  if (onRefazer) {
    passos.push({
      rotulo: `Refazer${provaCompleta ? " a prova completa" : ""}`,
      detalhe: "Outro sorteio, mesma configuração.",
      onClick: onRefazer,
    });
  }

  return (
    <div className="space-y-8">
      <div
        className={`rounded-2xl border-2 p-8 text-center ${
          aprovadoGeral
            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
            : "border-rose-500 bg-rose-50 dark:bg-rose-950/40"
        }`}
      >
        <div className="rotulo-secao">
          {provaCompleta ? "Prova completa" : `${materias.length} matérias`} —
          Classe {classe}
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
            ? `Mínimo atingido nas ${materias.length} matérias.`
            : `A aprovação exige ${formato.minimo} de ${formato.questoes} em cada matéria — faltou em ${reprovadas.map((m) => ROTULO_CURTO[m.tema]).join(" e ")}.`}
        </p>
      </div>

      {gravacaoRecusada && <AvisoGravacaoRecusada />}

      <section>
        <h2 className="rotulo-secao mb-3">Resultado por matéria</h2>
        <div
          className={`grid gap-3 ${materias.length > 2 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
        >
          {porMateria.map((m) => {
            const errosDaMateria = m.respostas.filter((r) => !r.acertou).length;
            return (
              /* O cartão é um botão: ele diz onde você reprovou e o gabarito da
               matéria fica mil pixels abaixo, numa lista única de até 90
               questões com dois filtros só. "Faltou em Técnica e Ética" tinha
               de virar "ver essas questões" em um toque. Sem erro nenhum não
               há para onde ir, e aí volta a ser um cartão. */
              <button
                key={m.tema}
                onClick={
                  errosDaMateria > 0
                    ? () => gabarito.current?.focarMateria(m.tema)
                    : undefined
                }
                disabled={errosDaMateria === 0}
                className={`rounded-xl border-2 p-4 text-center transition ${
                  m.aprovado
                    ? "border-emerald-300 dark:border-emerald-900"
                    : "border-rose-300 dark:border-rose-900"
                } ${errosDaMateria > 0 ? "hover:border-slate-500 dark:hover:border-slate-400" : ""}`}
              >
                <div
                  className={`text-xs font-semibold uppercase ${COR_TEMA[m.tema].texto}`}
                >
                  {ROTULO_CURTO[m.tema]}
                </div>
                <div className="mt-2 text-3xl font-bold">
                  {m.acertos}
                  {/* `opacity-50` num texto de 16 px dava 3,36:1 — abaixo dos
                    4,5:1 de AA, e a fração é o que diz de quanto era o total.
                    A cor de rótulo passa nos dois temas, e 18 px param de
                    parecer ruído ao lado de um número de 30. */}
                  <span className="text-lg font-normal text-slate-500 dark:text-slate-400">
                    /{m.respostas.length}
                  </span>
                </div>
                {/* As em branco aparecem por matéria: numa prova cronometrada,
                  saber que quatro ficaram sem resposta explica o placar. */}
                {m.respostas.filter((r) => r.respondeu === null).length > 0 && (
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    {m.respostas.filter((r) => r.respondeu === null).length} em
                    branco
                  </div>
                )}
                <div
                  className={`mt-1 text-sm font-semibold ${
                    m.aprovado
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-rose-700 dark:text-rose-400"
                  }`}
                >
                  {m.aprovado ? "Aprovado" : "Reprovado"}
                </div>
                {/* Quantos faltaram nesta matéria: no consolidado é ela, e não a
                  soma, que decide — e "reprovado" sem número não diz se faltou
                  um acerto ou seis. */}
                <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                  {(() => {
                    const min = minimoEquivalente(classe, m.respostas.length);
                    const d = m.acertos - min;
                    return d >= 0
                      ? `mínimo ${min} · ${d} de folga`
                      : `faltaram ${-d} para ${min}`;
                  })()}
                </div>
                {errosDaMateria > 0 && (
                  <div className="mt-2 text-xs font-semibold">
                    ver{" "}
                    {errosDaMateria === 1
                      ? "o erro"
                      : `os ${errosDaMateria} erros`}
                    <Icone
                      nome="seta-direita"
                      className="ml-0.5 h-3 w-3 align-[-1px]"
                    />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {desafio && (
        <div className="rounded-xl border border-borda bg-superficie p-4 text-sm">
          <div>
            Desafio{" "}
            <span className="font-mono font-bold">{desafio.semente}</span> ·
            bateria{" "}
            <span className="font-mono font-bold">{desafio.codigo}</span>
          </div>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            Compare com quem abriu o mesmo link. Código de bateria diferente
            significa banco de questões diferente — aí não são a mesma prova.
          </p>
        </div>
      )}

      <ProximoPasso passos={passos} />

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
          desafio,
        }}
      />

      <Gabarito respostas={todas} permitirTodas ref={gabarito} />

      <button
        onClick={onReiniciar}
        className="nao-imprimir w-full rounded-xl bg-slate-900 px-6 py-4 font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
      >
        Voltar ao início
      </button>
    </div>
  );
}
