"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BARALHOS,
  TAMANHO_RODADA,
  sortearRodada,
  type BaralhoId,
  type Pergunta,
} from "@/lib/drill";
import BotaoConsultarMaterial from "./BotaoConsultarMaterial";
import Fonte from "./Fonte";

/**
 * Drill relâmpago das tabelas.
 *
 * Não é bateria: não grava histórico, não tem cronômetro e não dá veredito de
 * aprovação — o placar da sessão basta. Isto aqui é memorização utilitária (o
 * fonético que se soletra no ar, o QRM que se entende de ouvido, o PT7 que se
 * reconhece), e não simulacro de prova. Misturar as duas coisas estragaria as
 * duas: o desempenho do drill entraria no cálculo de prontidão como se fosse
 * matéria de exame.
 *
 * As perguntas vêm de `lib/drill.ts`, que as deriva das tabelas literais —
 * nenhuma linha de conteúdo mora neste arquivo, de propósito.
 */
export default function Relampago() {
  const [selecao, setSelecao] = useState<BaralhoId[]>([]);
  const [rodada, setRodada] = useState<Pergunta[] | null>(null);
  const [indice, setIndice] = useState(0);
  const [escolhas, setEscolhas] = useState<(string | null)[]>([]);

  const pergunta = rodada?.[indice] ?? null;
  const escolhida = pergunta ? escolhas[indice] : null;
  const respondida = escolhida != null;
  const acertos = (rodada ?? []).filter(
    (p, i) => escolhas[i] === p.carta.resposta,
  ).length;

  const comecar = useCallback(() => {
    const nova = sortearRodada(selecao);
    setRodada(nova);
    setEscolhas(Array(nova.length).fill(null));
    setIndice(0);
  }, [selecao]);

  const responder = useCallback(
    (alternativa: string) => {
      setEscolhas((anteriores) => {
        // Depois do gabarito, trocar a resposta não é treinar.
        if (anteriores[indice] != null) return anteriores;
        const proximas = [...anteriores];
        proximas[indice] = alternativa;
        return proximas;
      });
    },
    [indice],
  );

  const avancar = useCallback(() => {
    if (!respondida) return;
    setIndice((i) => i + 1);
  }, [respondida]);

  // Mesmos atalhos do treino, com a mesma guarda: com um botão em foco, Enter
  // e espaço pertencem a ele — senão quem chega de Tab em "Consultar material"
  // pula a pergunta em vez de acionar o botão.
  useEffect(() => {
    const atual = pergunta;
    if (!atual) return;
    function aoTeclar(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement | null;
      if (alvo?.closest("input, textarea, select")) return;
      const emBotao = alvo?.closest("button, a") != null;

      const n = Number(e.key);
      if (!respondida && n >= 1 && n <= atual!.alternativas.length) {
        responder(atual!.alternativas[n - 1]);
      } else if (
        !emBotao &&
        respondida &&
        (e.key === "Enter" || e.key === " ")
      ) {
        e.preventDefault();
        avancar();
      }
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [pergunta, respondida, responder, avancar]);

  // --- Escolha do baralho ---------------------------------------------------
  if (rodada === null) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          {TAMANHO_RODADA} perguntas sorteadas das tabelas acima — as mesmas
          linhas, conferidas contra os PDFs. Sem histórico e sem veredito de
          aprovação: isto não é a prova, é o que se usa no ar.
        </p>
        <div className="flex flex-wrap gap-2">
          <Chip
            ativo={selecao.length === 0}
            onClick={() => setSelecao([])}
            rotulo="Tudo"
          />
          {BARALHOS.map((b) => (
            <Chip
              key={b.id}
              ativo={selecao.includes(b.id)}
              rotulo={b.rotulo}
              onClick={() =>
                setSelecao((s) =>
                  s.includes(b.id) ? s.filter((x) => x !== b.id) : [...s, b.id],
                )
              }
            />
          ))}
        </div>
        <button
          onClick={comecar}
          className="w-full rounded-xl bg-slate-900 px-6 py-4 font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
        >
          Começar
        </button>
      </div>
    );
  }

  // --- Placar ---------------------------------------------------------------
  if (!pergunta) {
    return (
      <div className="space-y-4">
        <div
          role="status"
          className="rounded-2xl border-2 border-slate-300 p-6 text-center dark:border-slate-700"
        >
          <div className="text-3xl font-bold">
            {acertos} de {rodada.length}
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Placar da sessão, e só. Nada daqui entra no seu desempenho —
            memorizar tabela não é o mesmo que estar pronto para a prova.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={comecar}
            autoFocus
            className="rounded-xl bg-slate-900 px-6 py-4 font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
          >
            De novo
          </button>
          <button
            onClick={() => setRodada(null)}
            className="rounded-xl border-2 border-slate-300 px-6 py-4 font-semibold transition hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
          >
            Trocar as tabelas
          </button>
        </div>
      </div>
    );
  }

  // --- Pergunta -------------------------------------------------------------
  const { carta, alternativas } = pergunta;
  const acertou = escolhida === carta.resposta;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600 dark:text-slate-300">
          Pergunta {indice + 1} de {rodada.length}
        </span>
        <span className="font-medium">{acertos} acertos</span>
      </div>

      <div className="rounded-2xl border-2 border-slate-300 p-5 dark:border-slate-700">
        <p className="text-lg leading-relaxed font-medium">{carta.enunciado}</p>
      </div>

      <ul className="space-y-2">
        {alternativas.map((a, i) => {
          const certa = a === carta.resposta;
          const marcada = a === escolhida;
          const cor = !respondida
            ? "border-slate-300 hover:border-slate-500 dark:border-slate-700 dark:hover:border-slate-400"
            : certa
              ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
              : marcada
                ? "border-rose-500 bg-rose-50 dark:bg-rose-950/40"
                : "border-slate-200 opacity-60 dark:border-slate-800";
          return (
            <li key={a}>
              <button
                onClick={() => responder(a)}
                disabled={respondida}
                className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition disabled:cursor-default ${cor}`}
              >
                <span className="text-xs font-semibold text-slate-500 tabular-nums dark:text-slate-400">
                  {i + 1}
                </span>
                <span>{a}</span>
                {/* Sem isto, quem usa leitor de tela reouve as alternativas
                    sem saber qual delas marcou — a cor não é lida. */}
                {respondida && (certa || marcada) && (
                  <span className="sr-only">
                    {certa ? "resposta certa" : "sua resposta"}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {respondida && (
        <div className="space-y-4">
          <div
            role="status"
            className={`rounded-xl border-2 p-4 ${
              acertou
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
                : "border-rose-500 bg-rose-50 dark:bg-rose-950/40"
            }`}
          >
            <div
              className={`font-bold ${
                acertou
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-rose-700 dark:text-rose-300"
              }`}
            >
              {acertou ? "Acertou" : "Errou"}
              {!acertou && (
                <span className="ml-2 text-sm font-medium opacity-80">
                  — é “{carta.resposta}”
                </span>
              )}
            </div>
            <div className="mt-2 border-t border-current/15 pt-2 text-sm text-slate-600 dark:text-slate-400">
              <Fonte
                arquivo={carta.fonte.arquivo}
                detalhe={`${carta.fonte.referencia}, página ${carta.fonte.paginas[0]}`}
              />
              <div>
                <BotaoConsultarMaterial
                  arquivoOrigem={carta.fonte.arquivo}
                  pagina={carta.fonte.paginas[0]}
                  origem="documento"
                />
              </div>
            </div>
          </div>

          <button
            onClick={avancar}
            autoFocus
            className="w-full rounded-xl bg-slate-900 px-6 py-4 font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
          >
            {indice + 1 >= rodada.length ? "Ver placar" : "Próxima"}
            <span className="ml-2 text-xs font-normal opacity-60">Enter</span>
          </button>
        </div>
      )}
    </div>
  );
}

function Chip({
  ativo,
  rotulo,
  onClick,
}: {
  ativo: boolean;
  rotulo: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={ativo}
      className={`alvo-toque rounded-full border-2 px-4 text-sm font-semibold transition ${
        ativo
          ? "border-slate-900 bg-rebaixado font-semibold dark:border-slate-100"
          : "border-borda-controle hover:border-slate-500 dark:hover:border-slate-400"
      }`}
    >
      {rotulo}
    </button>
  );
}
