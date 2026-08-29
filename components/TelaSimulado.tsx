"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MotivoFim, Questao, Resposta } from "@/lib/tipos";
import { COR_TEMA, ROTULO_CURTO } from "@/lib/constantes";
import type { Escolhas } from "@/lib/bateria";
import { contarRespondidas, folhaVazia, respostasDe } from "@/lib/bateria";
import { useCronometro } from "@/hooks/useCronometro";
import { useGuardaDeSaida } from "@/hooks/useGuardaDeSaida";
import BotaoConsultarMaterial from "./BotaoConsultarMaterial";
import BotaoSuspeita from "./BotaoSuspeita";
import TrechoOrigem from "./TrechoOrigem";

interface Props {
  questoes: Questao[];
  /** Segundos de prova; null desliga o cronômetro. */
  tempoSegundos?: number | null;
  /** Folha e posição de uma bateria retomada; vazias numa bateria nova. */
  escolhasIniciais?: Escolhas | null;
  indiceInicial?: number;
  onConcluir: (respostas: Resposta[], motivo: MotivoFim) => void;
  /**
   * Sair no meio. Recebe o que já foi respondido: em estudo (revisão e
   * assunto) não há veredito a proteger, então essas respostas contam.
   */
  onSair: (parcial: Resposta[]) => void;
  /**
   * Bateria de estudo (revisão ou assunto), onde o parcial é registrado. Muda
   * o que a confirmação de saída promete — e prometer errado aqui é pior que
   * não avisar.
   */
  parcialConta?: boolean;
  /** Avisa a cada mudança, para a bateria sobreviver a fechar a aba. */
  onProgresso?: (escolhas: Escolhas, indice: number) => void;
}

function formatarTempo(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function TelaSimulado({
  questoes,
  tempoSegundos = null,
  escolhasIniciais = null,
  indiceInicial = 0,
  onConcluir,
  onSair,
  onProgresso,
  parcialConta = false,
}: Props) {
  const [indice, setIndice] = useState(indiceInicial);
  const [escolhas, setEscolhas] = useState<Escolhas>(
    () => escolhasIniciais ?? folhaVazia(questoes.length),
  );
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);
  const topo = useRef<HTMLDivElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);
  const botaoAvancar = useRef<HTMLButtonElement>(null);

  const questao = questoes[indice];
  const escolhida = escolhas[indice];
  const respondida = escolhida !== null;
  const acertos = respostasDe(questoes, escolhas).filter(
    (r) => r.respondeu !== null && r.acertou,
  ).length;
  const respondidas = contarRespondidas(escolhas);

  // Como o efeito de progresso roda a cada resposta, o callback vai num ref:
  // do contrário, uma função recriada no pai o dispararia sozinho.
  const onProgressoRef = useRef(onProgresso);
  useEffect(() => {
    onProgressoRef.current = onProgresso;
  });

  const responder = useCallback(
    (valor: boolean) => {
      // Ignora cliques repetidos depois que a questão já foi respondida: aqui
      // o feedback já apareceu, e trocar a resposta depois de ver o gabarito
      // não é estudar.
      setEscolhas((anteriores) => {
        if (anteriores[indice] !== null) return anteriores;
        const proximas = [...anteriores];
        proximas[indice] = valor;
        return proximas;
      });
    },
    [indice],
  );

  const avancar = useCallback(() => {
    if (escolhida === null) return;
    if (indice + 1 >= questoes.length) {
      onConcluir(respostasDe(questoes, escolhas), "manual");
      return;
    }
    setIndice((i) => i + 1);
  }, [escolhida, indice, questoes, escolhas, onConcluir]);

  // Tempo esgotado: como na prova real, o que não foi respondido conta como
  // erro. A bateria termina na hora, com as faltantes marcadas em branco.
  const restante = useCronometro(tempoSegundos, () => {
    onConcluir(respostasDe(questoes, escolhas), "tempo");
  });

  // Cada mudança vai para o storage; quem grava é quem tem o contexto da
  // bateria (matéria, classe, modo, prazo), em `app/page.tsx`.
  useEffect(() => {
    onProgressoRef.current?.(escolhas, indice);
  }, [escolhas, indice]);

  // Só há o que perder depois da primeira resposta: antes disso, voltar e
  // recarregar continuam saindo direto, sem diálogo nenhum.
  useGuardaDeSaida(respondidas > 0, () => setConfirmandoSaida(true));

  /**
   * Cada questão nova recomeça no alto da tela.
   *
   * A rolagem é da janela e não se desfaz sozinha ao trocar de questão: quem
   * rolou para ler a explicação da anterior, ou para chegar ao botão de
   * avançar, caía na próxima com a afirmação já acima da borda — via o par
   * V/F sem ter lido o que responder.
   *
   * Rola o bloco de progresso, e não o cartão: o contador e o cronômetro
   * fazem parte do que se precisa ver ao começar a questão.
   */
  useEffect(() => {
    topo.current?.scrollIntoView({ block: "start" });
    // O foco vai SEMPRE para o título, e aqui isso é uma proteção, não só
    // acessibilidade: ao avançar, o botão "Próxima questão" some e o par V/F
    // toma o lugar dele no DOM — o foco ficava sobre o "Falso" da questão
    // nova, e o Enter seguinte respondia por conta própria. Nenhum controle
    // desta tela sobrevive à troca de questão, então não há foco de ninguém a
    // roubar (na prova cega, onde "Anterior/Próxima" persistem, a regra é
    // outra).
    titulo.current?.focus({ preventScroll: true });
  }, [indice]);

  /**
   * O foco vai para "Próxima questão" assim que o gabarito aparece.
   *
   * Era `autoFocus`, que o React só honra na montagem do elemento — e aqui o
   * botão nasce dentro de um ramo que troca de conteúdo, não de uma tela nova.
   * Medido em produção: depois de responder, o foco ficava no `body`, o Tab
   * seguinte ia parar no "Pular para o conteúdo" e o comentário do atalho de
   * teclado abaixo descrevia um comportamento que não existia.
   */
  useEffect(() => {
    if (respondida) botaoAvancar.current?.focus({ preventScroll: true });
  }, [respondida, indice]);

  // Atalhos: V / F para responder, Enter ou espaço para avançar. Numa bateria
  // de 20 questões, a mão não precisa sair do teclado.
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement | null;
      if (alvo?.closest("input, textarea, select")) return;
      // Com um botão em foco, Enter e espaço pertencem a ele — senão quem
      // navega por Tab até "Consultar material" ou "Marcar como suspeita"
      // pula de questão em vez de acionar o botão. O botão de avançar tem
      // autoFocus e onClick, então o Enter nele continua avançando, agora
      // pelo clique nativo.
      const emBotao = alvo?.closest("button, a") != null;

      const k = e.key.toLowerCase();
      if (!respondida && (k === "v" || k === "1")) responder(true);
      else if (!respondida && (k === "f" || k === "2")) responder(false);
      else if (!emBotao && respondida && (k === "enter" || k === " ")) {
        e.preventDefault();
        avancar();
      }
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [respondida, responder, avancar]);

  const cor = COR_TEMA[questao.tema];
  const acertou = escolhida === questao.resposta_correta;

  return (
    <div className="space-y-6">
      {/* Progresso */}
      <div ref={topo} className="scroll-mt-4">
        {/* Alvo do foco a cada questão: dá ao leitor de tela a posição na
            bateria antes da afirmação, que o cartão anuncia por `aria-live`.
            Fora do cartão de propósito — dentro dele, a mesma informação seria
            lida duas vezes. */}
        <h2 ref={titulo} tabIndex={-1} className="sr-only">
          Questão {indice + 1} de {questoes.length} — {ROTULO_CURTO[questao.tema]}
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
          <span className="font-medium">{acertos} acertos</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-slate-900 transition-all dark:bg-slate-100"
            style={{ width: `${(indice / questoes.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Questão */}
      <div
        className={`rounded-2xl border-2 p-6 ${cor.borda} ${cor.fundo}`}
        aria-live="polite"
      >
        <div className={`mb-4 text-xs font-semibold uppercase ${cor.texto}`}>
          {ROTULO_CURTO[questao.tema]}
        </div>
        <p className="text-lg leading-relaxed font-medium">
          {questao.afirmacao}
        </p>
      </div>

      {/* Resposta */}
      {respondida && (
        <div className="space-y-4">
          {/* role="status" = região viva educada: o leitor de tela anuncia o
              veredito e a explicação quando o cartão aparece — sem isto, quem
              responde de teclado só ouvia o botão que ganhou o foco. Mesmo
              padrão dos avisos do app (role="alert"/"status"). */}
          <div
            role="status"
            className={`rounded-xl border-2 p-5 ${
              acertou
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
                : "border-rose-500 bg-rose-50 dark:bg-rose-950/40"
            }`}
          >
            <div
              className={`text-lg font-bold ${
                acertou
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-rose-700 dark:text-rose-300"
              }`}
            >
              {acertou ? "Acertou" : "Errou"}
              {/* Sem `opacity`: este pedaço é a informação mais importante do
                  feedback ("a afirmação é FALSA") e a 80% ficava em 3,54:1. */}
              <span className="ml-2 text-sm font-medium">
                — a afirmação é{" "}
                {questao.resposta_correta ? "VERDADEIRA" : "FALSA"}
              </span>
            </div>
            <p className="mt-3 leading-relaxed">{questao.explicacao_curta}</p>

            <div className="mt-4 border-t border-current/15 pt-3 text-sm text-slate-600 dark:text-slate-400">
              {/* Para questões geradas a partir da ementa, a página é o
                  capítulo que trata do tema, e não a origem da afirmação.
                  Chamá-la de "Fonte" faria o leitor procurar no PDF uma frase
                  que não está lá, e duvidar do banco inteiro. */}
              <span className="font-medium">
                {questao.origem === "documento"
                  ? "Fonte:"
                  : "Estude o tema em:"}
              </span>{" "}
              {questao.arquivo_origem}
              <span> · página {questao.pagina}</span>
              <div>
                <BotaoConsultarMaterial
                  arquivoOrigem={questao.arquivo_origem}
                  pagina={questao.pagina}
                  origem={questao.origem}
                />
                <TrechoOrigem
                  trechoId={questao.trecho_id}
                  afirmacao={questao.afirmacao}
                />
                <div>
                  <BotaoSuspeita questao={questao} />
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* A barra de ação, colada no rodapé no celular.
      
          Medido em 390×844: os V/F ficavam no meio da tela com ~350 px vazios
          abaixo, e o "Próxima questão" nascia entre 733 e 925 px — fora da
          tela numa questão de cinco linhas, e sempre fora num celular real,
          onde a barra do navegador come uns 180 px. O resultado era rolar para
          responder e rolar de novo para avançar, vinte vezes por bateria.
      
          Aqui a rolagem passa a ser só para ler: o que aciona a bateria está
          sempre no mesmo lugar, na zona do polegar. Fica no fluxo (`sticky`),
          então no desktop, onde a tela inteira cabe, os botões voltam a
          aparecer na posição natural. */}
      <div className="sticky bottom-0 z-30 -mx-4 border-t border-slate-200 bg-[var(--background)] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 dark:border-slate-800">
        {!respondida ? (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => responder(true)}
              className="rounded-xl border-2 border-emerald-500 py-5 text-lg font-bold text-emerald-700 transition hover:bg-emerald-500 hover:text-white dark:text-emerald-300"
            >
              Verdadeiro
              {/* `aria-hidden` para o leitor de tela não anunciar
                  "VerdadeiroV"; sem `opacity`, que deixava a dica em 2,5:1. */}
              <span aria-hidden className="ml-2 text-xs font-normal">
                V
              </span>
            </button>
            <button
              onClick={() => responder(false)}
              className="rounded-xl border-2 border-rose-500 py-5 text-lg font-bold text-rose-700 transition hover:bg-rose-500 hover:text-white dark:text-rose-300"
            >
              Falso
              <span aria-hidden className="ml-2 text-xs font-normal">
                F
              </span>
            </button>
          </div>
        ) : (
          <button
            onClick={avancar}
            ref={botaoAvancar}
            className="w-full rounded-xl bg-slate-900 px-6 py-4 font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            {indice + 1 >= questoes.length ? "Ver resultado" : "Próxima questão"}
            <span aria-hidden className="ml-2 text-xs font-normal opacity-80">
              Enter
            </span>
          </button>
        )}
      </div>

      {/* Abandonar apaga a bateria inteira — só a bateria concluída entra no
          histórico —, e o link ficava a 24 px do botão principal, na zona do
          polegar. A confirmação segue o padrão do "Encerrar" da prova cega:
          inline, sem modal, com a consequência escrita e a saída segura
          primeiro. Com nada respondido não há o que confirmar. */}
      {!confirmandoSaida ? (
        <button
          onClick={() =>
            respondidas > 0 ? setConfirmandoSaida(true) : onSair([])
          }
          className="mx-auto block px-3 py-2 text-sm text-slate-500 underline-offset-4 hover:underline dark:text-slate-400"
        >
          {parcialConta ? "Parar por aqui" : "Abandonar simulado"}
        </button>
      ) : (
        <div className="rounded-xl border-2 border-amber-500 bg-amber-50 p-4 dark:bg-amber-950/40">
          <p className="text-sm font-medium">
            {parcialConta
              ? `${
                  respondidas === 1
                    ? "A resposta que você já deu fica registrada"
                    : `As ${respondidas} respostas que você já deu ficam registradas`
                } — o que você acertou sai da lista de erros.`
              : `${
                  respondidas === 1
                    ? "Abandonar apaga a resposta que você já deu"
                    : `Abandonar apaga as ${respondidas} respostas que você já deu`
                } — só a bateria concluída entra no histórico.`}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              onClick={() => setConfirmandoSaida(false)}
              className="rounded-lg border-2 border-slate-400 px-4 py-2 text-sm font-semibold transition hover:border-slate-500"
            >
              {parcialConta ? "Continuar estudando" : "Continuar o simulado"}
            </button>
            <button
              onClick={() =>
                onSair(
                  respostasDe(questoes, escolhas).filter(
                    (r) => r.respondeu !== null,
                  ),
                )
              }
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
            >
              {parcialConta ? "Sair mesmo assim" : "Abandonar mesmo assim"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
