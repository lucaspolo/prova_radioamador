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
  temas,
  quantidade,
  classe,
  onImprimir,
}: {
  /** As matérias escolhidas na tela: uma bateria, ou a prova completa. */
  temas: Tema[];
  /** Questões por matéria. */
  quantidade: number;
  classe: Classe;
  onImprimir: (desafio: Desafio) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const rotuloMaterias = temas.map((t) => ROTULO_CURTO[t]).join(", ");
  const [aviso, setAviso] = useState<string | null>(null);
  /**
   * Só a semente é estado; o desafio e o link saem dela mais a configuração
   * ATUAL da tela.
   *
   * Antes, os dois eram congelados no clique enquanto a descrição ao lado
   * seguia as props vivas: criar o link, trocar para a Classe A e mandar no
   * grupo enviava `c=B` com o texto dizendo "Classe A", e "Imprimir em branco"
   * saía com a configuração velha. O organizador mandava um link diferente do
   * que estava lendo. Derivar resolve na raiz — link, descrição, texto de
   * compartilhamento e folha impressa não têm como divergir.
   */
  const [semente, setSemente] = useState<string | null>(null);
  const desafio: Desafio | null = semente
    ? { semente, temas, quantidade, classe }
    : null;
  // `window` não existe na geração do HTML; o link só é montado no navegador,
  // e só depois de a semente existir — que também só nasce num clique.
  const link =
    desafio && typeof window !== "undefined"
      ? linkDoDesafio(
          desafio,
          `${window.location.origin}${window.location.pathname}`,
        )
      : null;

  function criar() {
    setSemente(sementeLegivel());
    setAviso(null);
  }

  async function compartilhar() {
    if (!link) return;
    const texto = `Desafio ${semente} — ${rotuloMaterias}, ${quantidade} questões por matéria, Classe ${classe}:\n${link}`;
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

  // Recolhido por padrão: organizar prova para outras pessoas é o que menos se
  // faz nesta tela. O rótulo fechado precisa anunciar as DUAS saídas — quem
  // procura "imprimir a prova" não adivinharia que ela mora atrás de
  // "desafiar".
  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        aria-expanded={false}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-borda bg-superficie px-4 py-3 text-left transition hover:border-slate-400 dark:hover:border-slate-500"
      >
        <span>
          <span className="font-semibold">Desafiar o radioclube</span>
          <span className="block text-sm text-slate-500 dark:text-slate-400">
            Um link com a mesma bateria para todos — ou a prova impressa, em
            branco e com gabarito. Vale para uma matéria ou para a prova
            completa.
          </span>
        </span>
        <span aria-hidden="true" className="shrink-0 text-slate-400">
          ▼
        </span>
      </button>
    );
  }

  return (
    <section className="rounded-xl border-2 border-slate-300 p-4 dark:border-slate-700">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold">Desafiar o radioclube</h3>
        <button
          onClick={() => setAberto(false)}
          aria-expanded={true}
          className="text-xs font-medium text-slate-500 underline dark:text-slate-400"
        >
          recolher
        </button>
      </div>
      <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
        Um link, a mesma bateria para todos: {rotuloMaterias}, {quantidade}{" "}
        questões {temas.length > 1 ? "por matéria " : ""}da Classe {classe}, em
        modo prova e com o cronômetro oficial. As questões saem da semente do
        link, e não do histórico de cada um — por isso dá para comparar os
        resultados.
      </p>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        A mesma bateria também sai <strong>impressa</strong>: folha em branco
        para marcar V ou F à caneta e gabarito em página separada. Quem faltou à
        aula responde pelo link e cai nas mesmas questões.
      </p>

      {link === null ? (
        <button
          onClick={criar}
          className="mt-3 rounded-lg border-2 border-slate-300 px-4 py-2 text-sm font-semibold transition hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
        >
          Criar a bateria
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
              className="rounded-lg border border-borda bg-superficie px-3 py-1.5 font-medium transition hover:border-slate-400 dark:hover:border-slate-500"
            >
              Compartilhar link
            </button>
            {/* Papel e link são a mesma bateria: o curso presencial aplica
                impresso, e quem faltou faz pelo celular caindo nas mesmas
                questões. */}
            <button
              onClick={() => desafio && onImprimir(desafio)}
              className="rounded-lg border border-borda bg-superficie px-3 py-1.5 font-medium transition hover:border-slate-400 dark:hover:border-slate-500"
            >
              Imprimir em branco
            </button>
            <button
              onClick={criar}
              className="rounded-lg border border-borda bg-superficie px-3 py-1.5 font-medium transition hover:border-slate-400 dark:hover:border-slate-500"
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
