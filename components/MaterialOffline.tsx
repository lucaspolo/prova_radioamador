"use client";

import { useEffect, useState } from "react";
import mapa from "@/lib/mapa-pdfs.json";
import { ROTULO_ARQUIVO } from "@/lib/secoes";

/**
 * Precisa bater com CACHE_PDFS em scripts/gerar_sw.mjs — é o cache que
 * sobrevive a deploys. O gerador do SW é um script de build e não pode
 * importar daqui; a duplicação fica anotada dos dois lados.
 */
const CACHE_PDFS = "radioamador-pdfs-v1";

const ARQUIVOS = Object.entries(mapa) as [string, string][];

type Estado =
  | { fase: "conferindo" }
  | { fase: "pronto"; baixados: number }
  | { fase: "baixando"; feitos: number }
  | { fase: "completo" }
  | { fase: "erro"; feitos: number };

/**
 * Pré-download do material: os PDFs só entravam no cache quando abertos uma
 * vez, e a interface não contava isso em lugar nenhum — quem instalava o PWA
 * em casa descobria no ônibus que a Cartilha não abre. Um toque baixa os
 * seis (~5 MB) pelo próprio service worker: o fetch de /pdfs/ passa pelo
 * `comFaixa()`, que guarda o arquivo inteiro quando não há header Range.
 *
 * Sem service worker controlando a página (primeiro acesso, dev, navegador
 * sem suporte), baixar não deixaria nada no cache — a seção nem aparece.
 */
export default function MaterialOffline() {
  const [estado, setEstado] = useState<Estado | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller)
      return;
    let vivo = true;
    void contarBaixados().then((baixados) => {
      if (!vivo) return;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEstado(
        baixados >= ARQUIVOS.length
          ? { fase: "completo" }
          : { fase: "pronto", baixados },
      );
    });
    return () => {
      vivo = false;
    };
  }, []);

  if (estado === null) return null;

  async function baixar() {
    let feitos = 0;
    setEstado({ fase: "baixando", feitos });
    for (const [, nome] of ARQUIVOS) {
      try {
        const resp = await fetch(`/pdfs/${nome}`);
        if (!resp.ok) throw new Error(String(resp.status));
        // Ler o corpo até o fim garante que o service worker terminou de
        // guardar o arquivo antes de o contador dizer que sim.
        await resp.blob();
      } catch {
        setEstado({ fase: "erro", feitos });
        return;
      }
      feitos++;
      setEstado({ fase: "baixando", feitos });
    }
    // Conferir no cache, e não confiar no laço: é o cache que vale offline.
    setEstado(
      (await contarBaixados()) >= ARQUIVOS.length
        ? { fase: "completo" }
        : { fase: "erro", feitos },
    );
  }

  return (
    <section className="rounded-xl border border-slate-300 p-4 dark:border-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Material para consulta offline</h3>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {estado.fase === "completo"
              ? "Os seis PDFs estão no aparelho — o material abre sem rede."
              : estado.fase === "baixando"
                ? `Baixando ${Math.min(estado.feitos + 1, ARQUIVOS.length)} de ${ARQUIVOS.length} — ${rotulo(estado.feitos)}…`
                : estado.fase === "erro"
                  ? `A rede falhou depois de ${estado.feitos} de ${ARQUIVOS.length} — os baixados ficam; tente de novo para o resto.`
                  : `Sem isto, cada PDF só fica offline depois de aberto uma vez. São ${ARQUIVOS.length} arquivos, cerca de 5 MB.`}
          </p>
        </div>
        {estado.fase !== "completo" && (
          <button
            onClick={() => void baixar()}
            disabled={estado.fase === "baixando"}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            {estado.fase === "baixando"
              ? `${estado.feitos}/${ARQUIVOS.length}`
              : estado.fase === "erro"
                ? "Tentar de novo"
                : "Baixar tudo"}
          </button>
        )}
      </div>
    </section>
  );
}

function rotulo(indice: number): string {
  const [original] = ARQUIVOS[Math.min(indice, ARQUIVOS.length - 1)];
  return ROTULO_ARQUIVO[original] ?? original;
}

async function contarBaixados(): Promise<number> {
  try {
    const cache = await caches.open(CACHE_PDFS);
    const chaves = await cache.keys();
    const nomes = new Set(
      chaves.map((req) => new URL(req.url).pathname.split("/").pop()),
    );
    return ARQUIVOS.filter(([, nome]) => nomes.has(nome)).length;
  } catch {
    return 0;
  }
}
