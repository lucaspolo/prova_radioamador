"use client";

import { useRef, useState } from "react";
import { useSuspeitas } from "@/hooks/useSuspeitas";
import { migrar, type Historico } from "@/lib/historico";
import {
  aplicarPreferencias,
  gravarPreferencias,
  lerPreferencias,
  validarPreferencias,
  type Preferencias,
} from "@/lib/preferencias";

/** O que sai no arquivo de backup — e o que o importar aceita de volta. */
export interface Envelope {
  app: string;
  versao: number;
  exportadoEm: string;
  historico: Historico;
  suspeitas: string[];
  /** Opcional: backups feitos antes das preferências continuam válidos. */
  preferencias?: Preferencias;
}

/**
 * As suspeitas chegam por prop, e não de um `useSuspeitas()` daqui: a mesma
 * tela também as lista, e duas instâncias vivas do hook teriam cada uma o seu
 * `ids` — importar um backup e depois desmarcar qualquer suspeita gravaria a
 * lista velha por cima das importadas.
 */
export default function ExportarImportar({
  historico,
  onImportar,
  suspeitas,
}: {
  historico: Historico;
  onImportar: (outro: Historico) => number;
  suspeitas: ReturnType<typeof useSuspeitas>;
}) {
  const arquivoRef = useRef<HTMLInputElement>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  function exportar() {
    const envelope: Envelope = {
      app: "prova-radioamador",
      versao: 1,
      exportadoEm: new Date().toISOString(),
      historico,
      suspeitas: suspeitas.ids,
      preferencias: lerPreferencias(),
    };
    const blob = new Blob([JSON.stringify(envelope, null, 1)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `radioamador-historico-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importar(arquivo: File) {
    try {
      const dados = JSON.parse(await arquivo.text()) as unknown;
      // Aceita o envelope do exportar ou um histórico cru: a validação real
      // é a mesma que protege o storage — inclusive a leitura leniente de
      // versão futura, para um backup de app mais novo não ser recusado.
      const bruto =
        typeof dados === "object" && dados !== null && "historico" in dados
          ? (dados as Envelope).historico
          : dados;
      const valido = migrar(bruto);
      if (!valido) {
        setMensagem("Arquivo não reconhecido — exporte pelo próprio app.");
        return;
      }
      const novos = onImportar(valido);
      if (
        typeof dados === "object" &&
        dados !== null &&
        Array.isArray((dados as Envelope).suspeitas)
      ) {
        suspeitas.mesclarCom(
          (dados as Envelope).suspeitas.filter(
            (x): x is string => typeof x === "string",
          ),
        );
      }
      if (
        typeof dados === "object" &&
        dados !== null &&
        "preferencias" in dados
      ) {
        const prefs = validarPreferencias((dados as Envelope).preferencias);
        gravarPreferencias(prefs);
        aplicarPreferencias(prefs);
      }
      setMensagem(
        novos === 0
          ? "Nada novo: tudo do arquivo já estava aqui."
          : `${novos} ${novos === 1 ? "simulado importado" : "simulados importados"}.`,
      );
    } catch {
      setMensagem("Arquivo não reconhecido — exporte pelo próprio app.");
    }
  }

  return (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
      <button
        onClick={exportar}
        className="text-slate-500 underline-offset-4 hover:underline dark:text-slate-400"
      >
        Exportar histórico
      </button>
      <button
        onClick={() => arquivoRef.current?.click()}
        className="text-slate-500 underline-offset-4 hover:underline dark:text-slate-400"
      >
        Importar
      </button>
      <input
        ref={arquivoRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importar(f);
          e.target.value = "";
        }}
      />
      {mensagem && (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {mensagem}
        </span>
      )}
    </span>
  );
}
