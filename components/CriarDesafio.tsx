"use client";

import { useState } from "react";
import type { Classe, Tema } from "@/lib/tipos";
import { ROTULO_CURTO } from "@/lib/constantes";
import { linkDoDesafio, type Desafio } from "@/lib/desafio";
import { sementeLegivel } from "@/lib/semente";

/**
 * Gera o link que faz o radioclube inteiro responder à mesma bateria.
 *
 * O link carrega a configuração escolhida logo acima (matéria, quantidade,
 * classe) mais uma semente curta e ditável — sem O/0 e sem I/1, porque ela vai
 * ser passada no ar tanto quanto colada num grupo.
 *
 * A semente só é gerada no clique: sortear no render divergiria entre o HTML
 * da build e o do navegador.
 */
export default function CriarDesafio({
  tema,
  quantidade,
  classe,
  onImprimir,
}: {
  tema: Tema;
  quantidade: number;
  classe: Classe;
  onImprimir: (desafio: Desafio) => void;
}) {
  const [link, setLink] = useState<string | null>(null);
  const [desafio, setDesafio] = useState<Desafio | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const semente = desafio?.semente ?? null;

  function criar() {
    const novo: Desafio = {
      semente: sementeLegivel(),
      tema,
      quantidade,
      classe,
    };
    const base = `${window.location.origin}${window.location.pathname}`;
    setDesafio(novo);
    setLink(linkDoDesafio(novo, base));
    setAviso(null);
  }

  async function compartilhar() {
    if (!link) return;
    const texto = `Desafio ${semente} — ${ROTULO_CURTO[tema]}, ${quantidade} questões, Classe ${classe}:\n${link}`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ text: texto });
        return;
      }
      await navigator.clipboard.writeText(link);
      setAviso("Link copiado");
    } catch {
      // Cancelar a folha de compartilhamento cai aqui, e não é erro.
      setAviso(null);
      return;
    }
    setTimeout(() => setAviso(null), 2500);
  }

  return (
    <section className="rounded-xl border-2 border-slate-300 p-4 dark:border-slate-700">
      <h3 className="font-semibold">Desafiar o radioclube</h3>
      <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
        Um link, a mesma bateria para todos: {ROTULO_CURTO[tema]},{" "}
        {quantidade} questões da Classe {classe}, em modo prova e com o
        cronômetro oficial. As questões saem da semente do link, e não do
        histórico de cada um — por isso dá para comparar os resultados. Dá para
        imprimir a mesma bateria em branco, para aplicar em papel.
      </p>

      {link === null ? (
        <button
          onClick={criar}
          className="mt-3 rounded-lg border-2 border-slate-300 px-4 py-2 text-sm font-semibold transition hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
        >
          Criar link do desafio
        </button>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="text-sm">
            Semente <span className="font-mono font-bold">{semente}</span>
          </div>
          <input
            type="text"
            readOnly
            value={link}
            aria-label="Link do desafio"
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded-lg border-2 border-slate-300 bg-transparent px-3 py-2 font-mono text-xs dark:border-slate-700"
          />
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <button
              onClick={() => void compartilhar()}
              className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium transition hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
            >
              Compartilhar link
            </button>
            {/* Papel e link são a mesma bateria: o curso presencial aplica
                impresso, e quem faltou faz pelo celular caindo nas mesmas
                questões. */}
            <button
              onClick={() => desafio && onImprimir(desafio)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium transition hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
            >
              Imprimir em branco
            </button>
            <button
              onClick={criar}
              className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium transition hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
            >
              Outra semente
            </button>
            {aviso && (
              <span
                aria-live="polite"
                className="text-slate-500 dark:text-slate-400"
              >
                {aviso}
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
