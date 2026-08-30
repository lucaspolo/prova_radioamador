"use client";

import { useState } from "react";
import { resumoDeTexto, type ResumoBateria } from "@/lib/compartilhar";

/**
 * Compartilhar e imprimir o resultado.
 *
 * `navigator.share` abre a folha nativa no celular, que é onde o app é usado;
 * no desktop cai para a área de transferência. A impressão serve ao estudo em
 * papel: com o gabarito completo do modo cego, a folha impressa vira o
 * material de revisão da bateria inteira.
 */
export default function AcoesResultado({ resumo }: { resumo: ResumoBateria }) {
  const [aviso, setAviso] = useState<string | null>(null);

  async function compartilhar() {
    const texto = resumoDeTexto(resumo);
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ text: texto });
        return;
      }
      await navigator.clipboard.writeText(texto);
      setAviso("Resultado copiado");
    } catch {
      // Cancelar a folha de compartilhamento cai aqui e não é erro: só não
      // avisa nada.
      setAviso(null);
      return;
    }
    setTimeout(() => setAviso(null), 2500);
  }

  return (
    <div className="nao-imprimir flex flex-wrap items-center gap-3 text-sm">
      <button
        onClick={compartilhar}
        className="alvo-toque rounded-lg border border-slate-300 px-4 font-medium transition hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
      >
        Compartilhar resultado
      </button>
      <button
        onClick={() => window.print()}
        className="alvo-toque rounded-lg border border-slate-300 px-4 font-medium transition hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
      >
        Imprimir revisão
      </button>
      {aviso && (
        <span aria-live="polite" className="text-slate-500 dark:text-slate-400">
          {aviso}
        </span>
      )}
    </div>
  );
}
