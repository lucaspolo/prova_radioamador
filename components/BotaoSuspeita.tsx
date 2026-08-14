"use client";

import { useSuspeitas } from "@/hooks/useSuspeitas";
import { urlDeReporte } from "@/lib/reportar";
import type { Questao } from "@/lib/tipos";

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
export default function BotaoSuspeita({ questao }: { questao: Questao }) {
  const { ids, carregado, alternar } = useSuspeitas();
  if (!carregado) return null;

  const marcada = ids.includes(questao.id);
  return (
    <>
      <button
        onClick={() => alternar(questao.id)}
        className={`mt-2 text-xs underline-offset-2 hover:underline ${
          marcada
            ? "font-medium text-amber-600 dark:text-amber-400"
            : "text-slate-500 dark:text-slate-400"
        }`}
      >
        {marcada
          ? "⚑ Marcada como suspeita — toque para desfazer"
          : "⚑ Achou algo errado? Marcar como suspeita"}
      </button>
      {marcada && (
        <a
          href={urlDeReporte(questao)}
          target="_blank"
          rel="noreferrer"
          className="mt-1 block text-xs text-slate-500 underline underline-offset-2 dark:text-slate-400"
        >
          Reportar o erro — abre um formulário já preenchido, sem login
        </a>
      )}
    </>
  );
}
