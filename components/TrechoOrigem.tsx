"use client";

import { useEffect, useRef, useState } from "react";
import { carregarTrechos, localizarPassagem } from "@/lib/trechos";
import type { Trecho } from "@/lib/tipos";

interface Props {
  trechoId?: string;
  afirmacao: string;
}

type Estado =
  | { fase: "fechado" }
  | { fase: "carregando" }
  | { fase: "erro" }
  | { fase: "pronto"; trecho: Trecho };

/**
 * Mostra o texto literal do PDF que gerou a questão.
 *
 * Abrir o PDF resolve a dúvida sobre a norma, mas obriga a procurar a frase
 * numa página inteira. Aqui vem o mesmo texto que o modelo leu para escrever a
 * afirmação — é a forma mais direta de conferir se a questão está certa.
 */
export default function TrechoOrigem({ trechoId, afirmacao }: Props) {
  const [estado, setEstado] = useState<Estado>({ fase: "fechado" });
  const destaque = useRef<HTMLElement>(null);

  // Questões geradas a partir da ementa não têm trecho: não há texto de onde
  // a afirmação tenha saído, e forjar um seria mentir sobre a origem.
  if (!trechoId) return null;

  async function abrir() {
    setEstado({ fase: "carregando" });
    try {
      const todos = await carregarTrechos();
      const trecho = todos[trechoId!];
      setEstado(trecho ? { fase: "pronto", trecho } : { fase: "erro" });
    } catch {
      setEstado({ fase: "erro" });
    }
  }

  if (estado.fase === "fechado" || estado.fase === "carregando") {
    return (
      <button
        onClick={abrir}
        disabled={estado.fase === "carregando"}
        className="alvo-toque mt-3 ml-2 rounded-lg border border-current/30 px-3 text-sm font-medium transition hover:bg-current/10 disabled:opacity-60"
      >
        {estado.fase === "carregando" ? "Carregando…" : "Ver trecho de origem"}
      </button>
    );
  }

  if (estado.fase === "erro") {
    return (
      <p className="mt-3 text-xs text-slate-500 italic dark:text-slate-400">
        Não foi possível carregar o trecho de origem.
      </p>
    );
  }

  return (
    <TextoDoTrecho
      trecho={estado.trecho}
      afirmacao={afirmacao}
      refDestaque={destaque}
      onFechar={() => setEstado({ fase: "fechado" })}
    />
  );
}

function TextoDoTrecho({
  trecho,
  afirmacao,
  refDestaque,
  onFechar,
}: {
  trecho: Trecho;
  afirmacao: string;
  refDestaque: React.RefObject<HTMLElement | null>;
  onFechar: () => void;
}) {
  const passagem = localizarPassagem(trecho.texto, afirmacao);

  // Rola a passagem destacada para o centro da caixa. Sem isto, num trecho de
  // 4.500 caracteres o destaque costuma nascer fora da área visível.
  useEffect(() => {
    refDestaque.current?.scrollIntoView({ block: "center" });
  }, [refDestaque]);

  const partes = passagem
    ? [
        trecho.texto.slice(0, passagem.inicio),
        trecho.texto.slice(passagem.inicio, passagem.fim),
        trecho.texto.slice(passagem.fim),
      ]
    : [trecho.texto, "", ""];

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between gap-3">
        <span className="rotulo-secao">
          Trecho de origem ·{" "}
          {trecho.fim > trecho.pagina
            ? `páginas ${trecho.pagina}–${trecho.fim}`
            : `página ${trecho.pagina}`}
        </span>
        <button
          onClick={onFechar}
          className="alvo-toque -my-2 -mr-2 rounded-lg px-2 text-xs text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
        >
          Fechar
        </button>
      </div>

      <div className="mt-1.5 max-h-72 overflow-y-auto overscroll-contain rounded-lg border border-slate-300 bg-white/70 p-3 text-[13px] leading-relaxed whitespace-pre-wrap text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
        {partes[0]}
        {partes[1] && (
          <mark
            ref={refDestaque}
            className="rounded bg-amber-200/70 text-slate-900 dark:bg-amber-400/25 dark:text-amber-50"
          >
            {partes[1]}
          </mark>
        )}
        {partes[2]}
      </div>

      <p className="mt-1.5 text-xs text-slate-500 italic dark:text-slate-400">
        {passagem
          ? "Texto extraído do PDF, como foi lido para elaborar a questão. O destaque é uma aproximação por palavras em comum."
          : "Texto extraído do PDF, como foi lido para elaborar a questão."}
      </p>
    </div>
  );
}
