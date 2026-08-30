"use client";

import { useEffect, useState } from "react";
import {
  aplicarAtualizacao,
  assinar,
  haAtualizacao,
} from "@/lib/atualizacao-sw";

/**
 * "Nova versão pronta — recarregue quando quiser."
 *
 * Renderizado só nas telas de menu (início, desempenho, ferramentas): a
 * página decide, e no meio de uma bateria o aviso não aparece — recarregar
 * ali descartaria a bateria em curso. Nada recarrega sozinho: o clique é o
 * consentimento, e o reload espera o worker novo assumir de fato.
 */
export default function AvisoAtualizacao() {
  const [pronta, setPronta] = useState(false);

  useEffect(() => {
    // O anúncio pode ter chegado antes deste mount (o registro é assíncrono e
    // a tela pode ter trocado) — na assinatura, lê o estado já acumulado.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPronta(haAtualizacao());
    return assinar(() => setPronta(true));
  }, []);

  if (!pronta) return null;

  return (
    <div
      role="status"
      className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-sky-500 bg-sky-50 p-4 text-sm dark:bg-sky-950/40"
    >
      <span>
        <span className="font-semibold">Nova versão pronta.</span> Recarregue
        quando quiser — nada muda até lá.
      </span>
      <button
        onClick={aplicarAtualizacao}
        className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
      >
        Recarregar agora
      </button>
    </div>
  );
}
