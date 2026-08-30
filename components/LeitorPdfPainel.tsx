"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "@/lib/pdf-worker";
import { criarDestacador } from "@/lib/destaque-pdf";

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;

/** Quantas páginas antes e depois da visível já são renderizadas. */
const MARGEM_PAGINAS = 2;

interface Props {
  caminho: string;
  nomeExibicao: string;
  /** Página que a questão selecionada aponta. */
  pagina: number;
  /** Texto da passagem de origem, para grifar. Null quando não há. */
  passagem: string | null;
  /** Se o PDF foi transcrito por OCR de visão — não tem camada de texto. */
  porOcr: boolean;
}

/**
 * O PDF ao lado da lista de conferência, em rolagem contínua.
 *
 * Diferente do `VisualizadorPdf`, que é o modal de consulta do simulado: lá se
 * abre uma página, se lê e se fecha, no celular. Aqui se passa uma hora com o
 * documento aberto comparando frase por frase, e uma questão frequentemente
 * cita algo que atravessa duas páginas — virar página com seta quebraria a
 * comparação no meio.
 */
export default function LeitorPdfPainel({
  caminho,
  nomeExibicao,
  pagina,
  passagem,
  porOcr,
}: Props) {
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [erro, setErro] = useState<string | null>(null);
  const [largura, setLargura] = useState(560);
  const [visiveis, setVisiveis] = useState<Set<number>>(new Set([1]));
  const [proporcao, setProporcao] = useState(1.414); // A4 retrato, até medir

  const rolagem = useRef<HTMLDivElement>(null);
  const paginas = useRef(new Map<number, HTMLDivElement>());

  // A página renderiza na largura da coluna, e não da janela: o painel divide
  // a tela com a lista de questões.
  useEffect(() => {
    const alvo = rolagem.current;
    if (!alvo) return;
    const observador = new ResizeObserver(([entrada]) => {
      setLargura(Math.max(entrada.contentRect.width - 32, 240));
    });
    observador.observe(alvo);
    return () => observador.disconnect();
  }, []);

  /**
   * Só monta as páginas por perto.
   *
   * A Cartilha tem 65 páginas. Montar 65 canvas de uma vez trava a aba por
   * vários segundos, e 63 deles seriam desenhados para ninguém ver. O
   * placeholder guarda a altura pela proporção medida na primeira página, para
   * a barra de rolagem não encolher e dar solavanco quando as vizinhas entram.
   */
  useEffect(() => {
    const raiz = rolagem.current;
    if (!raiz || totalPaginas === 0) return;

    const observador = new IntersectionObserver(
      (entradas) => {
        setVisiveis((atuais) => {
          const novas = new Set(atuais);
          let mudou = false;
          for (const e of entradas) {
            const n = Number((e.target as HTMLElement).dataset.pagina);
            if (!e.isIntersecting) continue;
            for (let p = n - MARGEM_PAGINAS; p <= n + MARGEM_PAGINAS; p++) {
              if (p >= 1 && p <= totalPaginas && !novas.has(p)) {
                novas.add(p);
                mudou = true;
              }
            }
          }
          return mudou ? novas : atuais;
        });
      },
      { root: raiz, rootMargin: "200px 0px" },
    );

    for (const el of paginas.current.values()) observador.observe(el);
    return () => observador.disconnect();
  }, [totalPaginas]);

  const irPara = useCallback((n: number) => {
    const alvo = paginas.current.get(n);
    if (alvo) alvo.scrollIntoView({ block: "start" });
  }, []);

  /**
   * O que de fato é renderizado: o que o observador já viu, mais a janela em
   * volta da página da questão.
   *
   * A segunda parte é derivada, e não guardada no estado, porque ela é função
   * pura da questão selecionada — gravá-la num efeito só criaria um render a
   * mais entre trocar de questão e o painel mostrar a página certa.
   */
  const montadas = useMemo(() => {
    const janela = new Set(visiveis);
    for (let p = pagina - MARGEM_PAGINAS; p <= pagina + MARGEM_PAGINAS; p++) {
      if (p >= 1 && p <= totalPaginas) janela.add(p);
    }
    return janela;
  }, [visiveis, pagina, totalPaginas]);

  // Trocar de questão leva o painel à página dela. Quando o documento acabou de
  // ser trocado, `totalPaginas` só chega no onLoadSuccess — daí a dependência.
  useEffect(() => {
    if (totalPaginas === 0) return;
    // A página alvo pode ter acabado de ser montada neste mesmo render: rolar
    // só depois que o React pôs o placeholder dela no DOM.
    const id = requestAnimationFrame(() => irPara(pagina));
    return () => cancelAnimationFrame(id);
  }, [pagina, totalPaginas, irPara]);

  const destacar = criarDestacador(passagem);

  if (erro) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-xs text-center">
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
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-800">
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium" title={nomeExibicao}>
            {nomeExibicao}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {totalPaginas > 0
              ? `p. ${pagina} de ${totalPaginas}`
              : "Carregando…"}
          </div>
        </div>

        <button
          onClick={() => irPara(pagina)}
          className="rounded-lg border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          title="Voltar para a página da questão"
        >
          ↩ p. {pagina}
        </button>
        <Controle
          onClick={() => setZoom((z) => Math.max(z - 0.25, ZOOM_MIN))}
          desabilitado={zoom <= ZOOM_MIN}
          rotulo="Diminuir zoom"
        >
          −
        </Controle>
        <span className="w-10 text-center text-xs tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
        <Controle
          onClick={() => setZoom((z) => Math.min(z + 0.25, ZOOM_MAX))}
          desabilitado={zoom >= ZOOM_MAX}
          rotulo="Aumentar zoom"
        >
          +
        </Controle>
        <a
          href={caminho}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          title="Abrir em nova aba"
        >
          ↗
        </a>
      </div>

      {porOcr && (
        <p className="border-b border-amber-300 bg-amber-50 px-3 py-1.5 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Digitalizado: sem camada de texto. Não há o que grifar aqui — compare
          a citação da esquerda com a imagem à direita.
        </p>
      )}

      <div
        ref={rolagem}
        className="flex-1 overflow-auto bg-slate-200 p-4 dark:bg-slate-950"
      >
        <Document
          file={caminho}
          onLoadSuccess={async (pdf) => {
            setTotalPaginas(pdf.numPages);
            setVisiveis(new Set([1]));
            const vp = (await pdf.getPage(1)).getViewport({ scale: 1 });
            setProporcao(vp.height / vp.width);
          }}
          onLoadError={(e) => setErro(e.message)}
          loading={
            <p className="py-12 text-center text-sm text-slate-500">
              Carregando documento…
            </p>
          }
          className="flex flex-col items-center gap-4"
        >
          {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((n) => (
            <div
              key={n}
              data-pagina={n}
              ref={(el) => {
                if (el) paginas.current.set(n, el);
                else paginas.current.delete(n);
              }}
              className="scroll-mt-2 shadow-lg"
              style={
                montadas.has(n)
                  ? undefined
                  : {
                      width: largura * zoom,
                      height: largura * zoom * proporcao,
                      background: "white",
                    }
              }
            >
              {montadas.has(n) && (
                <Page
                  pageNumber={n}
                  width={largura * zoom}
                  renderTextLayer
                  renderAnnotationLayer={false}
                  customTextRenderer={destacar ?? undefined}
                />
              )}
            </div>
          ))}
        </Document>
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
      className="h-7 w-7 rounded-lg border border-slate-300 text-sm leading-none hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30 dark:border-slate-700 dark:hover:bg-slate-800"
    >
      {children}
    </button>
  );
}
