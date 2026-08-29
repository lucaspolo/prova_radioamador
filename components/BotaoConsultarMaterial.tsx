"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { caminhoPdf } from "@/lib/pdfs";
import { ROTULO_ARQUIVO } from "@/lib/secoes";
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
  /**
   * Texto do botão. O padrão é o da consulta a partir de uma questão; a página
   * de estudo passa o nome do trecho, porque ali o que se escolhe é ONDE ler.
   */
  rotulo?: string;
  /** Enxuto, para as listas de material onde vários botões vêm em sequência. */
  compacto?: boolean;
}

export default function BotaoConsultarMaterial({
  arquivoOrigem,
  pagina,
  origem,
  rotulo = "Consultar Material",
  compacto = false,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const caminho = caminhoPdf(arquivoOrigem);

  // Sem PDF publicado, não há o que consultar.
  if (!caminho) return null;

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className={`rounded-lg border border-current/30 font-medium transition hover:bg-current/10 ${
          compacto ? "px-2.5 py-1 text-xs" : "mt-3 px-3 py-1.5 text-sm"
        }`}
      >
        {rotulo}
        {/* A p. 1 não se anuncia: abrir um documento na primeira página é só
            abrir o documento, e o sufixo ali seria ruído. */}
        {pagina > 1 && (
          <span className="ml-1.5 font-normal">
            {compacto ? `· p. ${pagina}` : `· página ${pagina}`}
          </span>
        )}
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
          // O rótulo curado, e não o nome do arquivo: o visualizador mostrava
          // "2026-06-30 CARTILHA-RADIOAMADOR-v9 2026-06.pdf" no título e no
          // `aria-label` do diálogo.
          nomeExibicao={ROTULO_ARQUIVO[arquivoOrigem] ?? arquivoOrigem}
          paginaInicial={pagina}
          origem={origem}
          onFechar={() => setAberto(false)}
        />
      )}
    </>
  );
}
