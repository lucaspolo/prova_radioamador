"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { caminhoPdf } from "@/lib/pdfs";
import type { Origem } from "@/lib/tipos";

/**
 * O visualizador entra por import dinâmico com `ssr: false` porque o pdf.js
 * depende de APIs de navegador (DOM, Canvas, Worker) e quebraria a geração
 * estática. Assim o pacote do pdf.js — que é grande — também só é baixado
 * quando alguém realmente abre um material, e não no carregamento do app.
 */
const VisualizadorPdf = dynamic(() => import("./VisualizadorPdf"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 text-sm text-white">
      Abrindo material…
    </div>
  ),
});

interface Props {
  arquivoOrigem: string;
  pagina: number;
  origem: Origem;
}

export default function BotaoConsultarMaterial({
  arquivoOrigem,
  pagina,
  origem,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const caminho = caminhoPdf(arquivoOrigem);

  // Sem PDF publicado, não há o que consultar.
  if (!caminho) return null;

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="mt-3 rounded-lg border border-current/30 px-3 py-1.5 text-sm font-medium transition hover:bg-current/10"
      >
        Consultar Material
        <span className="ml-1.5 opacity-60">· página {pagina}</span>
      </button>

      {origem === "ementa" && (
        <p className="mt-2 text-xs text-slate-500 italic dark:text-slate-400">
          Esta questão foi elaborada a partir da ementa oficial; a página
          indicada explica o tema, mas não traz este enunciado.
        </p>
      )}

      {aberto && (
        <VisualizadorPdf
          caminho={caminho}
          nomeExibicao={arquivoOrigem}
          paginaInicial={pagina}
          origem={origem}
          onFechar={() => setAberto(false)}
        />
      )}
    </>
  );
}
