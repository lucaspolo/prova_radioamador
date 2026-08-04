"use client";

import { useCallback, useEffect, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

/**
 * O worker é servido pelo próprio site, e não por CDN: assim o visualizador
 * funciona offline e não depende de terceiros. O arquivo é publicado em
 * public/ por scripts/preparar_worker.mjs, antes de `dev` e de `build`.
 */
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface Props {
  caminho: string;
  nomeExibicao: string;
  paginaInicial: number;
  onFechar: () => void;
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;

export default function VisualizadorPdf({
  caminho,
  nomeExibicao,
  paginaInicial,
  onFechar,
}: Props) {
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [pagina, setPagina] = useState(paginaInicial);
  const [zoom, setZoom] = useState(1);
  const [erro, setErro] = useState<string | null>(null);
  const [largura, setLargura] = useState(700);

  // Ajusta a página renderizada à largura da janela, sem estourar o modal.
  useEffect(() => {
    function medir() {
      setLargura(Math.min(window.innerWidth - 64, 800));
    }
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  const irPara = useCallback(
    (n: number) => {
      if (totalPaginas > 0) setPagina(Math.min(Math.max(n, 1), totalPaginas));
    },
    [totalPaginas],
  );

  // Esc fecha; setas navegam. O modal captura as setas para que elas não
  // cheguem à tela do simulado por baixo.
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
      else if (e.key === "ArrowLeft") {
        e.preventDefault();
        irPara(pagina - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        irPara(pagina + 1);
      }
    }
    window.addEventListener("keydown", aoTeclar, true);
    return () => window.removeEventListener("keydown", aoTeclar, true);
  }, [onFechar, irPara, pagina]);

  // Impede a página de fundo de rolar enquanto o modal está aberto.
  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = anterior;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Material de consulta: ${nomeExibicao}`}
      onClick={onFechar}
    >
      {/* Barra de controles */}
      <div
        className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-slate-900 px-4 py-3 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{nomeExibicao}</div>
          <div className="text-xs text-slate-400">
            {totalPaginas > 0
              ? `Página ${pagina} de ${totalPaginas}`
              : "Carregando…"}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Controle
            onClick={() => irPara(pagina - 1)}
            desabilitado={pagina <= 1}
            rotulo="Página anterior"
          >
            ‹
          </Controle>
          <Controle
            onClick={() => irPara(pagina + 1)}
            desabilitado={pagina >= totalPaginas}
            rotulo="Próxima página"
          >
            ›
          </Controle>
          <Controle
            onClick={() => setZoom((z) => Math.max(z - 0.25, ZOOM_MIN))}
            desabilitado={zoom <= ZOOM_MIN}
            rotulo="Diminuir zoom"
          >
            −
          </Controle>
          <span className="w-12 text-center text-xs tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <Controle
            onClick={() => setZoom((z) => Math.min(z + 0.25, ZOOM_MAX))}
            desabilitado={zoom >= ZOOM_MAX}
            rotulo="Aumentar zoom"
          >
            +
          </Controle>
          <button
            onClick={onFechar}
            className="ml-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20"
          >
            Fechar
            <span className="ml-1.5 text-xs opacity-60">Esc</span>
          </button>
        </div>
      </div>

      {/* Documento */}
      <div
        className="flex-1 overflow-auto p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {erro ? (
          <div className="mx-auto mt-12 max-w-md rounded-xl bg-white p-6 text-center dark:bg-slate-900">
            <p className="font-medium text-rose-600 dark:text-rose-400">
              Não foi possível abrir o PDF.
            </p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {erro}
            </p>
            <a
              href={caminho}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block text-sm underline underline-offset-4"
            >
              Abrir em nova aba
            </a>
          </div>
        ) : (
          <Document
            file={caminho}
            onLoadSuccess={({ numPages }) => {
              setTotalPaginas(numPages);
              // A página gravada na questão pode não existir se o PDF mudar.
              setPagina((p) => Math.min(Math.max(p, 1), numPages));
            }}
            onLoadError={(e) => setErro(e.message)}
            loading={
              <p className="mt-12 text-center text-sm text-white/70">
                Carregando documento…
              </p>
            }
            className="flex justify-center"
          >
            <Page
              pageNumber={pagina}
              width={largura * zoom}
              renderTextLayer
              renderAnnotationLayer={false}
              className="shadow-2xl"
              loading={
                <p className="mt-12 text-center text-sm text-white/70">
                  Renderizando página…
                </p>
              }
            />
          </Document>
        )}
      </div>
    </div>
  );
}

function Controle({
  children,
  onClick,
  desabilitado,
  rotulo,
}: {
  children: React.ReactNode;
  onClick: () => void;
  desabilitado?: boolean;
  rotulo: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={desabilitado}
      aria-label={rotulo}
      title={rotulo}
      className="h-9 w-9 rounded-lg bg-white/10 text-lg leading-none hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}
