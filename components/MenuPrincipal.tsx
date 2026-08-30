"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Preferencias from "./Preferencias";
import Icone from "./Icone";

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
 * O gatilho leva a palavra"Menu" ao lado do glifo. Um hambúrguer sem rótulo
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
  const painel = useRef<HTMLDivElement>(null);

  function fechar(devolverFoco: boolean) {
    setAberto(false);
    if (devolverFoco) gatilho.current?.focus();
  }

  useEffect(() => {
    if (!aberto) return;
    // O primeiro item, seja ele link ou botão — e descoberto pelo DOM, não por
    // uma ref passada ao item que hoje é o primeiro: trocar a ordem da lista é
    // mexida rotineira, e amarrar o foco a um item específico faz o menu abrir
    // sem foco nenhum na primeira reordenação, calado.
    painel.current?.querySelector<HTMLElement>("a, button")?.focus();

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
        // Compacto no celular: a 360 px o gatilho comia a largura que faltava
        // ao título, que quebrava em duas linhas por causa disso.
        className="alvo-toque shrink-0 gap-1.5 rounded-xl border-2 border-slate-300 px-2.5 text-sm font-medium transition hover:border-slate-400 sm:gap-2 sm:px-3 dark:border-slate-700 dark:hover:border-slate-500"
      >
        <Icone nome="menu" className="h-5 w-5" />
        Menu
      </button>

      {aberto && (
        <div
          ref={painel}
          id="menu-principal"
          tabIndex={-1}
          // Fundo opaco é obrigatório: o painel cobre o resumo de desempenho e
          // a escolha de classe. A largura em `rem` acompanha a escala de
          // fonte, e o `min` com `vw` impede que estoure num telefone estreito
          // quando o texto está no tamanho grande.
          // `70vh` cortava justamente o que só existe aqui: em 1280×800 a
          // linha"Texto" virava uma fatia de 10 px, e em 320×568 com fonte
          // grande o painel mostrava dois itens e meio. Agora a altura segue a
          // tela de verdade (`dvh`, que no celular desconta a barra do
          // navegador) e quem rola é a lista de destinos — tema e tamanho de
          // texto ficam presos no rodapé do painel, sempre à vista.
          className="absolute top-full right-0 z-40 mt-2 flex max-h-[calc(100dvh-7rem)] w-[min(20rem,calc(100vw-2rem))] flex-col overscroll-contain rounded-xl border border-borda elevado p-4"
        >
          <PainelMenu
            atual={atual}
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
  onInicio,
  onDesempenho,
  onFerramentas,
}: {
  atual?: TelaDoMenu;
  onInicio: () => void;
  onDesempenho: () => void;
  onFerramentas: () => void;
}) {
  return (
    <>
      <div className="min-h-0 space-y-3 overflow-y-auto">
        {/* Primeiro item, e é o único que é rota e não etapa: `/estudar` tem
            endereço próprio para poder ser lido devagar e mandado para o
            colega. Vem no topo porque é a ordem do estudo — ler o que a prova
            cobra antes de responder —, e porque é o único destino do menu que
            ninguém adivinha existir. Nunca aparece como atual: lá o menu não
            existe, a página tem a própria volta para cá. Sair daqui não custa
            nada, já que o menu só existe fora de bateria e fora de resultado. */}
        <ItemMenu
          ativo={false}
          href="/estudar"
          titulo="Material de estudo"
          detalhe="A ementa oficial da prova, o trecho do PDF que explica cada item e os documentos da Anatel para baixar."
        />
        {/* O caminho de volta. Sem ele, sair de Desempenho ou da Consulta
            rápida exigia rolar duas telas longas até o"Voltar ao início" do
            rodapé — e o menu, que é a navegação do app, só levava para longe. */}
        <ItemMenu
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

      {/* Fora do que rola: são a razão de o menu existir para quem já sabe
          onde ficam as telas, e eram os primeiros a sumir. */}
      <div className="mt-4 shrink-0 border-t border-borda pt-3">
        <Preferencias />
      </div>
    </>
  );
}

function ItemMenu({
  ativo,
  titulo,
  detalhe,
  onClick,
  href,
}: {
  ativo: boolean;
  titulo: string;
  detalhe: string;
  onClick?: () => void;
  /** Presente quando o destino é uma rota, e não uma etapa. */
  href?: string;
}) {
  // A tela atual só troca a cor da borda. Preenchida, como nos seletores da
  // tela inicial, o subtítulo em cinza ficaria ilegível.
  const estilo = `block w-full rounded-xl border-2 px-4 py-3 text-left transition ${
    ativo
      ? "border-slate-900 dark:border-slate-100"
      : "border-borda-controle hover:border-slate-500 dark:hover:border-slate-400"
  }`;

  const conteudo = (
    <>
      <div className="font-semibold">{titulo}</div>
      <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
        {detalhe}
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={estilo}>
        {conteudo}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={ativo ? "page" : undefined}
      className={estilo}
    >
      {conteudo}
    </button>
  );
}
