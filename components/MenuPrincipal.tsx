"use client";

import { useEffect, useRef, useState } from "react";
import Preferencias from "./Preferencias";

/** As telas que o menu alcança. */
export type TelaDoMenu = "inicio" | "desempenho" | "ferramentas";

interface Props {
  /** Tela atual, para marcá-la na lista. */
  atual: TelaDoMenu;
  onInicio: () => void;
  onDesempenho: () => void;
  onFerramentas: () => void;
}

/**
 * O único menu do app: para onde ir e como a interface se parece.
 *
 * É um *disclosure*, não um modal, e a razão é o próprio conteúdo: tema e
 * tamanho de texto são pré-visualizações ao vivo da página inteira. Um modal
 * com fundo escurecido faria o `A+` mudar seis palavras dentro do painel e
 * mais nada visível — e ver o efeito é o ponto de um controle de fonte. De
 * quebra, sem modal não há trava de rolagem nem armadilha de foco para acertar.
 *
 * Também não usa `role="menu"`: ele exigiria `menuitem*` com navegação por
 * setas e obrigaria os grupos de tema e texto a virar `menuitemradio`,
 * perdendo o `aria-pressed` que eles já usam. O padrão certo aqui é o de
 * navegação por disclosure — um botão com `aria-expanded` e um contêiner.
 *
 * O gatilho leva a palavra "Menu" ao lado do glifo. Um hambúrguer sem rótulo
 * é bem menos descoberto, e a consulta rápida — que era um cartão descrito na
 * tela inicial — passou a morar aqui dentro.
 */
export default function MenuPrincipal({
  atual,
  onInicio,
  onDesempenho,
  onFerramentas,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const gatilho = useRef<HTMLButtonElement>(null);
  const primeiro = useRef<HTMLButtonElement>(null);

  function fechar(devolverFoco: boolean) {
    setAberto(false);
    if (devolverFoco) gatilho.current?.focus();
  }

  useEffect(() => {
    if (!aberto) return;
    primeiro.current?.focus();

    // `pointerdown` e não `click`: assim o controle que se tocou fora do menu
    // ainda recebe o próprio clique. A referência é a caixa INTEIRA, gatilho
    // incluído — se fosse só o painel, tocar no gatilho aberto fecharia aqui e
    // reabriria no `click` seguinte.
    function foraDaCaixa(e: PointerEvent) {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("pointerdown", foraDaCaixa);
    return () => document.removeEventListener("pointerdown", foraDaCaixa);
  }, [aberto]);

  return (
    <div
      ref={caixa}
      className="nao-imprimir relative shrink-0"
      // Escape preso ao invólucro, e não em `window`: o visualizador de PDF
      // escuta Escape em fase de captura sem interromper a propagação, então
      // um ouvinte global aqui fecharia as duas camadas de uma vez. Assim o
      // handler só roda com o foco dentro do menu — e o `stopPropagation`
      // ainda blinda os atalhos de tecla das telas de bateria.
      onKeyDown={(e) => {
        if (e.key !== "Escape" || !aberto) return;
        e.stopPropagation();
        fechar(true);
      }}
      // Sair do menu por Tab fecha. A guarda do `relatedTarget` é necessária:
      // o Safari do iOS costuma reportá-lo nulo, e sem ela o menu fecharia em
      // toques inocentes.
      onBlur={(e) => {
        if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget)) {
          setAberto(false);
        }
      }}
    >
      <button
        ref={gatilho}
        type="button"
        aria-expanded={aberto}
        aria-controls="menu-principal"
        onClick={() => (aberto ? fechar(true) : setAberto(true))}
        className="flex items-center gap-2 rounded-xl border-2 border-slate-300 px-3 py-2 text-sm font-medium transition hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
      >
        <span aria-hidden className="text-lg leading-none">
          ☰
        </span>
        Menu
      </button>

      {aberto && (
        <div
          id="menu-principal"
          tabIndex={-1}
          // Fundo opaco é obrigatório: o painel cobre o resumo de desempenho e
          // a escolha de classe. A largura em `rem` acompanha a escala de
          // fonte, e o `min` com `vw` impede que estoure num telefone estreito
          // quando o texto está no tamanho grande.
          className="absolute top-full right-0 z-40 mt-2 max-h-[70vh] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-xl border border-slate-300 bg-[var(--background)] p-4 shadow-lg dark:border-slate-700"
        >
          <PainelMenu
            atual={atual}
            refPrimeiro={primeiro}
            onInicio={() => {
              setAberto(false);
              onInicio();
            }}
            onDesempenho={() => {
              setAberto(false);
              onDesempenho();
            }}
            onFerramentas={() => {
              setAberto(false);
              onFerramentas();
            }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * O conteúdo do painel, separado do gatilho.
 *
 * Export nomeado porque `testes/render.test.tsx` roda em
 * `renderToStaticMarkup`, sem DOM e sem clique: o menu fechado é tudo o que um
 * render estático enxerga. Sem isto, o que está dentro dele ficaria sem
 * cobertura nenhuma.
 */
export function PainelMenu({
  atual = "inicio",
  refPrimeiro,
  onInicio,
  onDesempenho,
  onFerramentas,
}: {
  atual?: TelaDoMenu;
  refPrimeiro?: React.Ref<HTMLButtonElement>;
  onInicio: () => void;
  onDesempenho: () => void;
  onFerramentas: () => void;
}) {
  return (
    <>
      <div className="space-y-3">
        {/* O caminho de volta. Sem ele, sair de Desempenho ou da Consulta
            rápida exigia rolar duas telas longas até o "Voltar ao início" do
            rodapé — e o menu, que é a navegação do app, só levava para longe. */}
        <ItemMenu
          ref={refPrimeiro}
          ativo={atual === "inicio"}
          titulo="Simulado"
          detalhe="Escolher a classe e a matéria e começar uma bateria."
          onClick={onInicio}
        />
        <ItemMenu
          ativo={atual === "desempenho"}
          titulo="Desempenho"
          detalhe="Acertos por matéria contra a linha de corte, evolução e backup do histórico."
          onClick={onDesempenho}
        />
        <ItemMenu
          ativo={atual === "ferramentas"}
          titulo="Consulta rápida"
          detalhe="Alfabeto fonético, código Q, plano de bandas, prefixos e as calculadoras da ementa. Funciona sem rede."
          onClick={onFerramentas}
        />
      </div>

      <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-800">
        <Preferencias />
      </div>
    </>
  );
}

function ItemMenu({
  ref,
  ativo,
  titulo,
  detalhe,
  onClick,
}: {
  ref?: React.Ref<HTMLButtonElement>;
  ativo: boolean;
  titulo: string;
  detalhe: string;
  onClick: () => void;
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-current={ativo ? "page" : undefined}
      // A tela atual só troca a cor da borda. Preenchida, como nos seletores
      // da tela inicial, o subtítulo em cinza ficaria ilegível.
      className={`w-full rounded-xl border-2 px-4 py-3 text-left transition ${
        ativo
          ? "border-slate-900 dark:border-slate-100"
          : "border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
      }`}
    >
      <div className="font-semibold">{titulo}</div>
      <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
        {detalhe}
      </div>
    </button>
  );
}
