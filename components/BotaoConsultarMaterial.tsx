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
  /**
   * Chamado quando o leitor fecha, para quem tem uma ação seguinte óbvia.
   *
   * O visualizador devolve o foco a quem o abriu, como manda o padrão de
   * diálogo modal — e no treino isso virava armadilha: fechado o PDF, o foco
   * voltava para "Consultar Material" e o Enter seguinte reabria o leitor em
   * vez de avançar, que é o que a tela promete logo abaixo ("Próxima questão
   * · Enter"). Quem consultou o material terminou com esta questão.
   */
  aoFechar?: () => void;
}

export default function BotaoConsultarMaterial({
  arquivoOrigem,
  pagina,
  origem,
  rotulo = "Consultar Material",
  compacto = false,
  aoFechar,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const caminho = caminhoPdf(arquivoOrigem);

  // Sem PDF publicado, não há o que consultar.
  if (!caminho) return null;

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        /* O compacto existe para as listas em que vinte destes vêm em
           sequência — mas ali é justamente onde o dedo erra. No celular ele
           também tem 44 px; a partir de `sm`, onde há mouse, volta ao desenho
           enxuto que a lista pede. */
        className={`alvo-toque rounded-lg border border-current/30 font-medium transition hover:bg-current/10 ${
          compacto ? "px-2.5 py-1 text-xs sm:min-h-0" : "mt-3 px-3 text-sm"
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
          devolverFoco={aoFechar}
        />
      )}
    </>
  );
}
