"use client";

import { useSuspeitas } from "@/hooks/useSuspeitas";

/**
 * Marca uma questão como suspeita de erro.
 *
 * Quem estuda pelo banco é quem mais olha as questões — este é o canal para
 * registrar a dúvida na hora, sem interromper o simulado. A lista aparece no
 * painel, para conferir depois com calma contra o material.
 */
export default function BotaoSuspeita({ questaoId }: { questaoId: string }) {
  const { ids, carregado, alternar } = useSuspeitas();
  if (!carregado) return null;

  const marcada = ids.includes(questaoId);
  return (
    <button
      onClick={() => alternar(questaoId)}
      className={`mt-2 text-xs underline-offset-2 hover:underline ${
        marcada
          ? "font-medium text-amber-600 dark:text-amber-400"
          : "text-slate-400 dark:text-slate-500"
      }`}
    >
      {marcada
        ? "⚑ Marcada como suspeita — toque para desfazer"
        : "⚑ Achou algo errado? Marcar como suspeita"}
    </button>
  );
}
