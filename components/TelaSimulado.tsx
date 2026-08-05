"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Questao, Resposta } from "@/lib/tipos";
import { COR_TEMA, ROTULO_CURTO } from "@/lib/constantes";
import BotaoConsultarMaterial from "./BotaoConsultarMaterial";
import BotaoSuspeita from "./BotaoSuspeita";
import TrechoOrigem from "./TrechoOrigem";

interface Props {
  questoes: Questao[];
  /** Segundos de prova; null desliga o cronômetro. */
  tempoSegundos?: number | null;
  onConcluir: (respostas: Resposta[]) => void;
  onSair: () => void;
}

function formatarTempo(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function TelaSimulado({
  questoes,
  tempoSegundos = null,
  onConcluir,
  onSair,
}: Props) {
  const [indice, setIndice] = useState(0);
  const [respostas, setRespostas] = useState<Resposta[]>([]);
  const [escolhida, setEscolhida] = useState<boolean | null>(null);
  const [restante, setRestante] = useState(tempoSegundos ?? 0);
  const fimRef = useRef<number | null>(null);

  const questao = questoes[indice];
  const acertos = respostas.filter((r) => r.acertou).length;
  const respondida = escolhida !== null;

  const responder = useCallback(
    (valor: boolean) => {
      // Ignora cliques repetidos depois que a questão já foi respondida.
      if (escolhida !== null) return;
      setEscolhida(valor);
      setRespostas((anteriores) => [
        ...anteriores,
        {
          questao,
          respondeu: valor,
          acertou: valor === questao.resposta_correta,
        },
      ]);
    },
    [escolhida, questao],
  );

  const avancar = useCallback(() => {
    if (escolhida === null) return;
    // `respostas` já contém a resposta da questão atual — `responder` é o
    // único ponto que grava. Reanexá-la aqui duplicava a última questão da
    // bateria: o resultado saía com 21 respostas em 20 questões.
    if (indice + 1 >= questoes.length) {
      onConcluir(respostas);
      return;
    }
    setIndice((i) => i + 1);
    setEscolhida(null);
  }, [escolhida, indice, questoes.length, onConcluir, respostas]);

  // O prazo é um instante fixo, não um contador decrementado: se o intervalo
  // atrasar (aba em segundo plano no celular), o relógio continua honesto.
  useEffect(() => {
    if (tempoSegundos == null) return;
    fimRef.current = Date.now() + tempoSegundos * 1000;
    const timer = setInterval(() => {
      setRestante(Math.max(0, Math.ceil((fimRef.current! - Date.now()) / 1000)));
    }, 250);
    return () => clearInterval(timer);
  }, [tempoSegundos]);

  // Tempo esgotado: como na prova real, o que não foi respondido conta como
  // erro. A bateria termina na hora, com as faltantes marcadas em branco.
  useEffect(() => {
    if (tempoSegundos == null || restante > 0) return;
    const faltantes: Resposta[] = questoes
      .slice(respostas.length)
      .map((q) => ({ questao: q, respondeu: null, acertou: false }));
    onConcluir([...respostas, ...faltantes]);
  }, [restante, tempoSegundos, questoes, respostas, onConcluir]);

  // Atalhos: V / F para responder, Enter ou espaço para avançar. Numa bateria
  // de 20 questões, a mão não precisa sair do teclado.
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      if (!respondida && (k === "v" || k === "1")) responder(true);
      else if (!respondida && (k === "f" || k === "2")) responder(false);
      else if (respondida && (k === "enter" || k === " ")) {
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
      <div>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-slate-500 dark:text-slate-400">
            Questão {indice + 1} de {questoes.length}
          </span>
          {tempoSegundos != null && (
            <span
              className={`font-mono font-medium tabular-nums ${
                restante <= 60
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-slate-600 dark:text-slate-300"
              }`}
              aria-label="tempo restante"
            >
              {formatarTempo(restante)}
            </span>
          )}
          {/* `respostas` já inclui a questão atual quando respondida; somar
              a atual de novo dobrava o placar durante a bateria. */}
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
      {!respondida ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => responder(true)}
            className="rounded-xl border-2 border-emerald-500 py-5 text-lg font-bold text-emerald-700 transition hover:bg-emerald-500 hover:text-white dark:text-emerald-300"
          >
            Verdadeiro
            <span className="ml-2 text-xs font-normal opacity-60">V</span>
          </button>
          <button
            onClick={() => responder(false)}
            className="rounded-xl border-2 border-rose-500 py-5 text-lg font-bold text-rose-700 transition hover:bg-rose-500 hover:text-white dark:text-rose-300"
          >
            Falso
            <span className="ml-2 text-xs font-normal opacity-60">F</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div
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
              <span className="ml-2 text-sm font-medium opacity-80">
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
              <span className="opacity-70"> · página {questao.pagina}</span>
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
                  <BotaoSuspeita questaoId={questao.id} />
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={avancar}
            autoFocus
            className="w-full rounded-xl bg-slate-900 px-6 py-4 font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            {indice + 1 >= questoes.length ? "Ver resultado" : "Próxima questão"}
            <span className="ml-2 text-xs font-normal opacity-60">Enter</span>
          </button>
        </div>
      )}

      <button
        onClick={onSair}
        className="w-full py-2 text-sm text-slate-500 underline-offset-4 hover:underline dark:text-slate-400"
      >
        Abandonar simulado
      </button>
    </div>
  );
}
