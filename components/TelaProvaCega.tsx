"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MotivoFim, Questao, Resposta } from "@/lib/tipos";
import { COR_TEMA, ROTULO_CURTO } from "@/lib/constantes";
import type { Escolhas } from "@/lib/bateria";
import {
  contarEmBranco,
  contarRespondidas,
  folhaVazia,
  proximaEmBranco,
  respostasDe,
} from "@/lib/bateria";
import { useCronometro } from "@/hooks/useCronometro";
import { useGuardaDeSaida } from "@/hooks/useGuardaDeSaida";
import FolhaRespostas from "./FolhaRespostas";

interface Props {
  questoes: Questao[];
  /** Segundos de prova; null desliga o cronômetro. */
  tempoSegundos?: number | null;
  /** Folha, posição e marcações de uma prova retomada. */
  escolhasIniciais?: Escolhas | null;
  indiceInicial?: number;
  marcadasIniciais?: number[];
  onConcluir: (respostas: Resposta[], motivo: MotivoFim) => void;
  /**
   * Sair no meio. A prova cega nunca entrega parcial: aqui existe veredito, e
   * meia prova registrada como bateria falsearia a prontidão.
   */
  onSair: (parcial: Resposta[]) => void;
  /** Avisa a cada mudança, para a prova sobreviver a fechar a aba. */
  onProgresso?: (
    escolhas: Escolhas,
    indice: number,
    marcadas: number[],
  ) => void;
}

function formatarTempo(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * A bateria no formato do exame: nenhum gabarito até encerrar.
 *
 * É uma tela separada do simulado de treino de propósito. As duas têm
 * invariantes opostas — o treino avança numa direção só e revela na hora; aqui
 * se navega à vontade e não se revela nada — e fundir as duas encheria de
 * condicionais justamente o handler de teclado e o cronômetro, que são as
 * partes sutis. O que é de fato comum saiu antes para `lib/bateria.ts` e
 * `hooks/useCronometro.ts`.
 *
 * Nada de consultar o PDF, ver o trecho de origem ou ler a explicação durante a
 * prova: é o que o exame não permite. Tudo isso reaparece no resultado.
 */
export default function TelaProvaCega({
  questoes,
  tempoSegundos = null,
  escolhasIniciais = null,
  indiceInicial = 0,
  marcadasIniciais,
  onConcluir,
  onSair,
  onProgresso,
}: Props) {
  const [indice, setIndice] = useState(indiceInicial);
  const [escolhas, setEscolhas] = useState<Escolhas>(
    () => escolhasIniciais ?? folhaVazia(questoes.length),
  );
  const [marcadas, setMarcadas] = useState<ReadonlySet<number>>(
    () => new Set(marcadasIniciais ?? []),
  );
  const [confirmando, setConfirmando] = useState(false);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);
  const topo = useRef<HTMLDivElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);

  const questao = questoes[indice];
  const escolhida = escolhas[indice];
  const respondidas = contarRespondidas(escolhas);
  const emBranco = contarEmBranco(escolhas);
  const proximaVazia = proximaEmBranco(escolhas, indice);

  const responder = useCallback(
    (valor: boolean | null) => {
      // Trocar de ideia e apagar a resposta fazem parte da prova real: aqui
      // não há gabarito à vista para a troca ser trapaça.
      setEscolhas((anteriores) => {
        const proximas = [...anteriores];
        proximas[indice] = anteriores[indice] === valor ? null : valor;
        return proximas;
      });
    },
    [indice],
  );

  const marcar = useCallback(() => {
    setMarcadas((anteriores) => {
      const proximas = new Set(anteriores);
      if (!proximas.delete(indice)) proximas.add(indice);
      return proximas;
    });
  }, [indice]);

  const ir = useCallback(
    (destino: number) => {
      setIndice(Math.min(Math.max(destino, 0), questoes.length - 1));
    },
    [questoes.length],
  );

  const encerrar = useCallback(
    (motivo: MotivoFim) => {
      // As marcações vão junto: no gabarito elas separam o acerto sólido do
      // chute, que é o que mais vale conferir depois de uma prova cega.
      onConcluir(respostasDe(questoes, escolhas, marcadas), motivo);
    },
    [questoes, escolhas, marcadas, onConcluir],
  );

  // Tempo esgotado: como na prova real, o que ficou em branco conta como erro.
  const restante = useCronometro(tempoSegundos, () => encerrar("tempo"));

  // Como o efeito de progresso roda a cada resposta, o callback vai num ref:
  // do contrário, uma função recriada no pai o dispararia sozinho.
  const onProgressoRef = useRef(onProgresso);
  useEffect(() => {
    onProgressoRef.current = onProgresso;
  });

  // Cada mudança vai para o storage; quem grava é quem tem o contexto da
  // bateria (matéria, classe, modo, prazo), em `app/page.tsx`.
  useEffect(() => {
    onProgressoRef.current?.(escolhas, indice, [...marcadas]);
  }, [escolhas, indice, marcadas]);

  // Aqui a guarda vale mais que no treino: são até 40 minutos de prova cega, e
  // o gesto de voltar do Android fechava o app instalado.
  useGuardaDeSaida(respondidas > 0, () => setConfirmandoSaida(true));

  /**
   * Cada questão recomeça no alto da tela — inclusive as alcançadas pela folha
   * de respostas.
   *
   * Aqui doía mais que no treino: com navegação livre, tocar na célula 15 da
   * folha só movia o anel de "atual" e a questão continuava fora da tela, com
   * o cronômetro junto. A prova também herda a rolagem da tela inicial ao
   * começar, e a primeira questão nascia acima da borda.
   */
  useEffect(() => {
    topo.current?.scrollIntoView({ block: "start" });
    // Só quando o foco está solto (setas, atalhos, toque): quem chegou aqui
    // pelo Tab até "Próxima ›" continua de onde estava.
    const ativo = document.activeElement;
    if (!ativo || ativo === document.body) {
      titulo.current?.focus({ preventScroll: true });
    }
  }, [indice]);

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement | null;
      if (alvo?.closest("input, textarea, select")) return;
      // Com um botão em foco, Enter e espaço pertencem a ele — senão o clique
      // do teclado dispararia a ação do botão e a daqui ao mesmo tempo.
      const emBotao = alvo?.closest("button, a") != null;

      const k = e.key.toLowerCase();
      if (k === "v" || k === "1") responder(true);
      else if (k === "f" || k === "2") responder(false);
      else if (k === "m") marcar();
      else if (k === "backspace" || k === "0") responder(null);
      else if (k === "arrowright") ir(indice + 1);
      else if (k === "arrowleft") ir(indice - 1);
      else if (!emBotao && (k === "enter" || k === " ")) {
        e.preventDefault();
        ir(indice + 1);
      }
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [responder, marcar, ir, indice]);

  const cor = COR_TEMA[questao.tema];

  return (
    <div className="space-y-6">
      {/* Progresso — sem placar de acertos: em prova cega, saber quantas
          acertou até agora entregaria o gabarito de tudo que já passou. */}
      <div ref={topo} className="scroll-mt-4">
        {/* Alvo do foco a cada troca de questão. Diz posição e estado, que a
            navegação livre torna fácil de perder — o cartão, por `aria-live`,
            anuncia só a afirmação. */}
        <h2 ref={titulo} tabIndex={-1} className="sr-only">
          Questão {indice + 1} de {questoes.length} — {ROTULO_CURTO[questao.tema]}
          {escolhida === null
            ? ", em branco"
            : escolhida
              ? ", respondida Verdadeiro"
              : ", respondida Falso"}
          {marcadas.has(indice) ? ", marcada para revisar" : ""}
        </h2>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-slate-500 dark:text-slate-400">
            Questão {indice + 1} de {questoes.length}
          </span>
          {tempoSegundos != null && (
            <span
              className={`font-mono font-medium tabular-nums ${
                restante <= 60
                  ? "text-rose-700 dark:text-rose-400"
                  : "text-slate-600 dark:text-slate-300"
              }`}
              aria-label="tempo restante"
            >
              {formatarTempo(restante)}
            </span>
          )}
          <span className="font-medium">
            {respondidas} de {questoes.length} respondidas
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-slate-900 transition-all dark:bg-slate-100"
            style={{ width: `${(respondidas / questoes.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Questão */}
      <div
        className={`rounded-2xl border-2 p-6 ${cor.borda} ${cor.fundo}`}
        aria-live="polite"
      >
        <div className={`mb-4 flex items-center justify-between text-xs font-semibold uppercase ${cor.texto}`}>
          <span>{ROTULO_CURTO[questao.tema]}</span>
          {marcadas.has(indice) && (
            <span className="text-amber-700 dark:text-amber-400">
              ⚑ marcada
            </span>
          )}
        </div>
        <p className="text-lg leading-relaxed font-medium">
          {questao.afirmacao}
        </p>
      </div>

      {/* Resposta — os botões ficam marcados, não somem: dá para ver o que foi
          respondido ao voltar numa questão. */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => responder(true)}
          aria-pressed={escolhida === true}
          className={`rounded-xl border-2 border-emerald-500 py-5 text-lg font-bold transition ${
            escolhida === true
              ? "bg-emerald-500 text-white"
              : "text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
          }`}
        >
          Verdadeiro
          <span aria-hidden className="ml-2 text-xs font-normal">
            V
          </span>
        </button>
        <button
          onClick={() => responder(false)}
          aria-pressed={escolhida === false}
          className={`rounded-xl border-2 border-rose-500 py-5 text-lg font-bold transition ${
            escolhida === false
              ? "bg-rose-500 text-white"
              : "text-rose-700 hover:bg-rose-500/10 dark:text-rose-300"
          }`}
        >
          Falso
          <span aria-hidden className="ml-2 text-xs font-normal">
            F
          </span>
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <button
          onClick={() => responder(null)}
          disabled={escolhida === null}
          className="text-slate-500 underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-400"
        >
          Limpar resposta
        </button>
        <button
          onClick={marcar}
          aria-pressed={marcadas.has(indice)}
          className={`underline-offset-4 hover:underline ${
            marcadas.has(indice)
              ? "font-medium text-amber-700 dark:text-amber-400"
              : "text-slate-500 dark:text-slate-400"
          }`}
        >
          {marcadas.has(indice)
            ? "⚑ Marcada para revisar — toque para desfazer"
            : "⚑ Marcar para revisar"}
        </button>
      </div>

      {/* Navegação */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => ir(indice - 1)}
          disabled={indice === 0}
          className="rounded-xl border-2 border-slate-300 py-3 font-semibold transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:hover:border-slate-500"
        >
          ‹ Anterior
        </button>
        <button
          onClick={() => ir(indice + 1)}
          disabled={indice + 1 >= questoes.length}
          className="rounded-xl border-2 border-slate-300 py-3 font-semibold transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:hover:border-slate-500"
        >
          Próxima ›
        </button>
      </div>

      {proximaVazia !== null && (
        <button
          onClick={() => ir(proximaVazia)}
          className="w-full py-1 text-sm text-slate-500 underline-offset-4 hover:underline dark:text-slate-400"
        >
          Ir para a próxima em branco (questão {proximaVazia + 1})
        </button>
      )}

      <FolhaRespostas
        escolhas={escolhas}
        marcadas={marcadas}
        atual={indice}
        onIr={ir}
      />

      <p className="text-center text-xs text-slate-500 dark:text-slate-400">
        Teclado: V/F responde · ← → navega · M marca · Backspace limpa
      </p>

      {/* Encerrar */}
      {!confirmando ? (
        <button
          onClick={() =>
            emBranco > 0 ? setConfirmando(true) : encerrar("manual")
          }
          className="w-full rounded-xl bg-slate-900 px-6 py-4 font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          Encerrar e ver o gabarito
        </button>
      ) : (
        <div className="rounded-xl border-2 border-amber-500 bg-amber-50 p-4 dark:bg-amber-950/40">
          <p className="text-sm font-medium">
            {emBranco === 1
              ? "Falta 1 questão em branco"
              : `Faltam ${emBranco} questões em branco`}{" "}
            — em branco conta como erro, igual à prova real.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              onClick={() => setConfirmando(false)}
              className="rounded-lg border-2 border-slate-400 px-4 py-2 text-sm font-semibold transition hover:border-slate-500"
            >
              Continuar respondendo
            </button>
            <button
              onClick={() => encerrar("manual")}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
            >
              Encerrar mesmo assim
            </button>
          </div>
        </div>
      )}

      {/* Mesma confirmação do "Encerrar" logo acima, e pela mesma razão: o
          link ficava a 24 px do botão principal e apagava a prova inteira num
          toque. Sem nada respondido, sai direto. */}
      {!confirmandoSaida ? (
        <button
          onClick={() =>
            respondidas > 0 ? setConfirmandoSaida(true) : onSair([])
          }
          className="mx-auto block px-3 py-2 text-sm text-slate-500 underline-offset-4 hover:underline dark:text-slate-400"
        >
          Abandonar a prova
        </button>
      ) : (
        <div className="rounded-xl border-2 border-amber-500 bg-amber-50 p-4 dark:bg-amber-950/40">
          <p className="text-sm font-medium">
            {respondidas === 1
              ? "Abandonar apaga a resposta que você já deu"
              : `Abandonar apaga as ${respondidas} respostas que você já deu`}{" "}
            — só a prova encerrada entra no histórico e mostra o gabarito.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              onClick={() => setConfirmandoSaida(false)}
              className="rounded-lg border-2 border-slate-400 px-4 py-2 text-sm font-semibold transition hover:border-slate-500"
            >
              Continuar a prova
            </button>
            <button
              onClick={() => onSair([])}
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
