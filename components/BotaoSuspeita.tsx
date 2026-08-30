"use client";

import { useSuspeitas } from "@/hooks/useSuspeitas";
import { urlDeReporte } from "@/lib/reportar";
import type { Questao } from "@/lib/tipos";
import Icone from "./Icone";

/**
 * Marca uma questão como suspeita de erro.
 *
 * Quem estuda pelo banco é quem mais olha as questões — este é o canal para
 * registrar a dúvida na hora, sem interromper o simulado. A lista aparece no
 * painel, para conferir depois com calma contra o material.
 *
 * Uma vez marcada, aparece também o caminho para levar a observação a quem
 * corrige o banco. São dois passos de propósito: no meio de uma bateria
 * cronometrada, um botão que joga o usuário em outra aba custaria caro.
 */
export default function BotaoSuspeita({
  questao,
  aoAlternar,
}: {
  questao: Questao;
  /**
   * Chamado depois de marcar ou desmarcar, para quem tem uma ação seguinte.
   *
   * Marcar é uma ação terminal: com o foco parado neste botão, o Enter
   * seguinte DESMARCAVA a questão em vez de avançar — e o único sinal era o
   * texto voltar ao normal.
   */
  aoAlternar?: () => void;
}) {
  const { ids, carregado, alternar } = useSuspeitas();
  if (!carregado) return null;

  const marcada = ids.includes(questao.id);
  return (
    <>
      <button
        onClick={() => {
          alternar(questao.id);
          aoAlternar?.();
        }}
        /* -mx-2 devolve o padding lateral à margem: o texto continua alinhado
           com o resto do cartão, mas o dedo tem os 44 px de altura e mais
           8 px de folga de cada lado. */
        className={`alvo-toque -mx-2 mt-1 rounded-lg px-2 text-left text-xs underline-offset-2 hover:underline ${
          marcada
            ? "font-medium text-amber-700 dark:text-amber-400"
            : "text-slate-600 dark:text-slate-400"
        }`}
      >
        <Icone nome="bandeira" className="mr-1 h-3.5 w-3.5 align-[-2px]" />
        {marcada
          ? "Marcada como suspeita — toque para desfazer"
          : "Achou algo errado? Marcar como suspeita"}
      </button>
      {marcada && (
        <a
          href={urlDeReporte(questao)}
          target="_blank"
          rel="noreferrer"
          className="alvo-toque -mx-2 rounded-lg px-2 text-xs text-slate-600 underline underline-offset-2 dark:text-slate-400"
        >
          Reportar o erro — abre um formulário já preenchido, sem login
        </a>
      )}
    </>
  );
}
