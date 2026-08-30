"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MotivoFim, Questao, Resposta } from "@/lib/tipos";
import { COR_TEMA, ROTULO_CURTO } from "@/lib/constantes";
import type { Escolhas } from "@/lib/bateria";
import {
  contarRespondidas,
  folhaVazia,
  pendencias,
  proximaEmBranco,
  respostasDe,
} from "@/lib/bateria";
import { useCronometro } from "@/hooks/useCronometro";
import { useGuardaDeSaida } from "@/hooks/useGuardaDeSaida";
import FolhaRespostas from "./FolhaRespostas";
import Icone from "./Icone";

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
  const proximaVazia = proximaEmBranco(escolhas, indice);
  const pendente = pendencias(escolhas, marcadas);

  const responder = useCallback(
    (valor: boolean | null) => {
      // Trocar de ideia faz parte da prova real: aqui não há gabarito à vista
      // para a troca ser trapaça. Mas responder é IDEMPOTENTE — tocar de novo
      // no que já está escolhido não apaga.
      //
      // Era um alterna: o segundo toque em "Verdadeiro" devolvia a questão a
      // em branco, e o único aviso era o preenchimento sumir. Dois botões com
      // `aria-pressed` exclusivo são um grupo de rádio, e rádio não desmarca
      // ao re-tocar; num público de 40 a 70 anos, sob cronômetro, o toque
      // repetido por tremor ou por conferir vira questão em branco — que
      // conta como erro. Apagar continua existindo, e com nome: "Limpar
      // resposta", Backspace e 0.
      setEscolhas((anteriores) => {
        if (anteriores[indice] === valor) return anteriores;
        const proximas = [...anteriores];
        proximas[indice] = valor;
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
          Questão {indice + 1} de {questoes.length} —{" "}
          {ROTULO_CURTO[questao.tema]}
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
        <div
          className={`mb-4 flex items-center justify-between text-xs font-semibold uppercase ${cor.texto}`}
        >
          <span>{ROTULO_CURTO[questao.tema]}</span>
          {marcadas.has(indice) && (
            <span className="text-amber-700 dark:text-amber-400">
              <Icone nome="bandeira" className="mr-1 h-3 w-3 align-[-1px]" />
              marcada
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

      {/* Estas duas são ações POR QUESTÃO numa prova cronometrada, e eram as
          menores da tela: 20 px de altura. Errar o toque aqui custa segundos
          que a prova está contando — daí os 44 px, com o padding lateral
          devolvido à margem para o texto não sair do lugar. */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 text-sm">
        <button
          onClick={() => responder(null)}
          disabled={escolhida === null}
          className="alvo-toque -mx-2 rounded-lg px-2 text-slate-500 underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:opacity-60 dark:text-slate-400"
        >
          Limpar resposta
        </button>
        <button
          onClick={marcar}
          aria-pressed={marcadas.has(indice)}
          className={`alvo-toque -mx-2 rounded-lg px-2 text-left underline-offset-4 hover:underline ${
            marcadas.has(indice)
              ? "font-medium text-amber-700 dark:text-amber-400"
              : "text-slate-500 dark:text-slate-400"
          }`}
        >
          <Icone nome="bandeira" className="mr-1 h-3.5 w-3.5 align-[-2px]" />
          {marcadas.has(indice)
            ? "Marcada para revisar — toque para desfazer"
            : "Marcar para revisar"}
        </button>
      </div>

      {/* Navegação.
          `disabled:opacity-40` deixava o "Anterior" da questão 1 a 2,53:1 — a
          WCAG isenta controle desabilitado do critério de contraste, mas um
          botão que não dá para ver não informa nem que existe, e é ele que diz
          "você está no começo". A 60% chega a ~4,6:1 e continua lendo como
          apagado ao lado do irmão ativo. */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => ir(indice - 1)}
          disabled={indice === 0}
          className="rounded-xl border-2 border-slate-300 py-3 font-semibold transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:hover:border-slate-500"
        >
          <Icone nome="seta-esquerda" className="mr-1 h-4 w-4 align-[-3px]" />
          Anterior
        </button>
        <button
          onClick={() => ir(indice + 1)}
          disabled={indice + 1 >= questoes.length}
          className="rounded-xl border-2 border-slate-300 py-3 font-semibold transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:hover:border-slate-500"
        >
          Próxima
          <Icone nome="seta-direita" className="ml-1 h-4 w-4 align-[-3px]" />
        </button>
      </div>

      {proximaVazia !== null && (
        <button
          onClick={() => ir(proximaVazia)}
          className="alvo-toque w-full justify-center text-sm text-slate-500 underline-offset-4 hover:underline dark:text-slate-400"
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
            pendente.primeira !== null ? setConfirmando(true) : encerrar("manual")
          }
          className="w-full rounded-xl bg-slate-900 px-6 py-4 font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
        >
          Encerrar e ver o gabarito
        </button>
      ) : (
        /* A confirmação só olhava as em branco: com tudo respondido e duas
           questões marcadas, "Encerrar" ia direto ao gabarito e a bandeira
           não servia para nada. E dizia quantas eram sem dizer QUAIS — o
           número sozinho não permite decidir se vale voltar.

           `role="alert"` porque o botão que tinha o foco desmonta aqui: sem
           isso, o leitor de tela não anuncia nada e o foco cai no body. */
        <div
          role="alert"
          className="rounded-xl border-2 border-amber-500 bg-amber-50 p-4 dark:bg-amber-950/40"
        >
          <div className="space-y-1 text-sm font-medium">
            {pendente.emBranco.length > 0 && (
              <p>
                <ListaDeQuestoes
                  rotulo={
                    pendente.emBranco.length === 1
                      ? "1 questão em branco:"
                      : `${pendente.emBranco.length} questões em branco:`
                  }
                  indices={pendente.emBranco}
                  onIr={(i) => {
                    setConfirmando(false);
                    ir(i);
                  }}
                />{" "}
                <span className="font-normal">
                  Em branco conta como erro, igual à prova real.
                </span>
              </p>
            )}
            {pendente.marcadas.length > 0 && (
              <p>
                <ListaDeQuestoes
                  rotulo={
                    pendente.marcadas.length === 1
                      ? "1 marcada para revisar:"
                      : `${pendente.marcadas.length} marcadas para revisar:`
                  }
                  indices={pendente.marcadas}
                  onIr={(i) => {
                    setConfirmando(false);
                    ir(i);
                  }}
                />
              </p>
            )}
          </div>
          {/* Pesos invertidos: o sólido é o que dá para desfazer. "Encerrar"
              é irreversível — a prova acaba e o gabarito aparece —, e estava
              com o peso do botão principal, ao lado de um contornado. */}
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              onClick={() => encerrar("manual")}
              className="rounded-lg border-2 border-slate-400 px-4 py-2 text-sm font-semibold transition hover:border-slate-500"
            >
              Encerrar mesmo assim
            </button>
            <button
              autoFocus
              onClick={() => {
                setConfirmando(false);
                if (pendente.primeira !== null) ir(pendente.primeira);
              }}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
            >
              Voltar e responder
            </button>
          </div>
        </div>
      )}

      {/* Mesma confirmação do "Encerrar" logo acima, e pela mesma razão: o
          link ficava a 24 px do botão principal e apagava a prova inteira num
          toque. Sem nada respondido, sai direto. */}
      {!confirmandoSaida ? (
        <div className="text-center">
          <button
            onClick={() =>
              respondidas > 0 ? setConfirmandoSaida(true) : onSair([])
            }
            className="alvo-toque px-3 text-sm text-slate-500 underline-offset-4 hover:underline dark:text-slate-400"
          >
            Abandonar a prova
          </button>
        </div>
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

/**
 * Os números das questões pendentes, cada um levando à sua.
 *
 * "Faltam 14 questões em branco" não permite decidir nada: quem está a três
 * minutos do fim precisa saber SE são as difíceis do começo ou as últimas que
 * nem leu. Com os números — e podendo tocar neles — a confirmação vira uma
 * ferramenta em vez de um aviso.
 */
function ListaDeQuestoes({
  rotulo,
  indices,
  onIr,
}: {
  rotulo: string;
  indices: number[];
  onIr: (indice: number) => void;
}) {
  // Passar de uma dúzia de números vira parede de dígitos, e a decisão já foi
  // tomada muito antes do décimo terceiro.
  const MOSTRAR = 12;
  const visiveis = indices.slice(0, MOSTRAR);
  return (
    <>
      {rotulo}{" "}
      {visiveis.map((i, n) => (
        <span key={i}>
          {n > 0 && ", "}
          <button
            onClick={() => onIr(i)}
            className="font-bold tabular-nums underline underline-offset-2"
          >
            {i + 1}
          </button>
        </span>
      ))}
      {indices.length > MOSTRAR && ` e mais ${indices.length - MOSTRAR}`}.
    </>
  );
}
