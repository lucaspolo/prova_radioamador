"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Document, Page } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "@/lib/pdf-worker";
import type { Origem } from "@/lib/tipos";
import Icone from "./Icone";

interface Props {
  caminho: string;
  nomeExibicao: string;
  paginaInicial: number;
  origem: Origem;
  onFechar: () => void;
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;

export default function VisualizadorPdf({
  caminho,
  nomeExibicao,
  paginaInicial,
  origem,
  onFechar,
}: Props) {
  const botaoFechar = useRef<HTMLButtonElement>(null);
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

  /**
   * O foco entra no diálogo e volta de onde veio.
   *
   * `role="dialog"` e `aria-modal` descrevem, mas não movem nada: medido, ao
   * abrir o foco continuava no botão atrás do overlay, e ao fechar caía no
   * `body` — quem usa leitor de tela voltava ao topo de uma página de dez mil
   * pixels em vez de ao "Consultar material" que acabou de acionar.
   *
   * `inert` no conteúdo de fundo dá a armadilha de foco sem trocar por
   * `<dialog>.showModal()`, que traria backdrop próprio e desfaria o desfoque
   * desta tela.
   */
  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    botaoFechar.current?.focus();
    const fundo = document.getElementById("conteudo");
    fundo?.setAttribute("inert", "");
    return () => {
      fundo?.removeAttribute("inert");
      anterior?.focus?.();
    };
  }, []);

  /**
   * O diálogo é montado no `body`, e não onde o botão vive.
   *
   * Sem isso, `inert` no `#conteudo` desligaria o próprio diálogo — ele é
   * descendente do main —, e a tela inteira ficava sem receber clique. Com o
   * portal, o fundo fica inerte de verdade: armadilha de foco e conteúdo
   * escondido do leitor de tela, sem trocar por `<dialog>.showModal()`, que
   * traria backdrop próprio no lugar deste desfoque.
   */
  return createPortal(
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
        {/* No celular o título toma a primeira linha inteira e os controles
            descem para a segunda: espremidos na mesma linha, o nome virava
            "20…" e "Página 26 de 65" quebrava em quatro linhas, numa barra de
            109 px — 13% da tela, tirada da página do PDF. */}
        <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
          <div className="truncate text-sm font-medium">{nomeExibicao}</div>
          <div className="text-xs whitespace-nowrap text-slate-400">
            {totalPaginas > 0
              ? `Página ${pagina} de ${totalPaginas}`
              : "Carregando…"}
            {origem === "ementa" && (
              <span className="ml-2 text-amber-300/90">
                · capítulo sobre o tema, não a origem do enunciado
              </span>
            )}
          </div>
        </div>

        <div className="flex w-full items-center justify-between gap-1 sm:w-auto sm:justify-start">
          <Controle
            onClick={() => irPara(pagina - 1)}
            desabilitado={pagina <= 1}
            rotulo="Página anterior"
          >
            <Icone nome="seta-esquerda" className="h-5 w-5" />
          </Controle>
          <Controle
            onClick={() => irPara(pagina + 1)}
            desabilitado={pagina >= totalPaginas}
            rotulo="Próxima página"
          >
            <Icone nome="seta-direita" className="h-5 w-5" />
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
            ref={botaoFechar}
            onClick={onFechar}
            className="ml-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/20"
          >
            Fechar
            {/* A dica só serve a quem tem tecla: no celular era largura
                gasta, e foi ela que empurrou o "Fechar" para fora da tela a
                320 px com fonte grande. */}
            <span className="ml-1.5 hidden text-xs opacity-60 sm:inline">
              Esc
            </span>
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
            <p className="font-medium text-rose-700 dark:text-rose-400">
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
            // `justify-center` centraliza também o que é MAIOR que o
            // container, e aí o excedente da esquerda fica fora de alcance:
            // com zoom em 150% o canvas nascia em -49px e `scrollLeft` já
            // estava no mínimo. `w-max mx-auto` centraliza quando cabe e
            // encosta na borda esquerda quando não cabe.
            className="w-max mx-auto"
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
    </div>,
    document.body,
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
