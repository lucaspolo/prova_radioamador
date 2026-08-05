"use client";

import { useRef, useState } from "react";
import { COR_TEMA, PERCENTUAL_CORTE, ROTULO_CURTO, TEMAS } from "@/lib/constantes";
import {
  estatisticasPorTema,
  resumo,
  validar,
  type Historico,
} from "@/lib/historico";
import { useSuspeitas } from "@/hooks/useSuspeitas";
import { BANCO } from "@/lib/questoes";
import { urlDeReporte } from "@/lib/reportar";
import {
  aplicarPreferencias,
  gravarPreferencias,
  lerPreferencias,
  validarPreferencias,
  type Preferencias,
} from "@/lib/preferencias";
import PainelPreferencias from "./Preferencias";
import type { Tema } from "@/lib/tipos";

interface Props {
  historico: Historico;
  carregado: boolean;
  onLimpar: () => void;
  /** Mescla um histórico importado ao local; devolve quantos eram novos. */
  onImportar: (outro: Historico) => number;
}

export default function Dashboard({
  historico,
  carregado,
  onLimpar,
  onImportar,
}: Props) {
  const [confirmando, setConfirmando] = useState(false);
  const suspeitas = useSuspeitas();

  // Enquanto o storage não foi lido, não renderiza nada: evita piscar
  // "nenhum simulado" para quem já tem histórico.
  if (!carregado) return null;

  const geral = resumo(historico);
  if (geral.simulados === 0) {
    return (
      <section className="space-y-4">
        <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Seu desempenho por matéria aparece aqui depois do primeiro simulado.
        </div>
        {/* Quem chega num aparelho novo precisa do importar ANTES do primeiro
            simulado — é justamente o momento de trazer o backup. E ajustar
            tema e tamanho de texto não deveria exigir ter estudado antes. */}
        <ExportarImportar historico={historico} onImportar={onImportar} />
        <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
          <PainelPreferencias />
        </div>
      </section>
    );
  }

  const estatisticas = estatisticasPorTema(historico);
  const atencao = estatisticas
    .filter((e) => e.respondidas > 0 && e.percentual < PERCENTUAL_CORTE)
    .sort((a, b) => a.percentual - b.percentual);

  return (
    <section className="space-y-5 rounded-xl border border-slate-300 p-5 dark:border-slate-700">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
          Seu desempenho
        </h2>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {geral.simulados} {geral.simulados === 1 ? "simulado" : "simulados"} ·{" "}
          {geral.respondidas} questões · {geral.percentual}%
        </span>
      </div>

      <div className="space-y-4">
        {estatisticas.map((e) => {
          const aprovando = e.percentual >= PERCENTUAL_CORTE;
          return (
            <div key={e.tema}>
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <span className={`font-medium ${COR_TEMA[e.tema].texto}`}>
                  {ROTULO_CURTO[e.tema]}
                </span>
                <span
                  className={
                    e.respondidas === 0
                      ? "text-slate-400 dark:text-slate-500"
                      : aprovando
                        ? "font-medium text-emerald-600 dark:text-emerald-400"
                        : "font-medium text-rose-600 dark:text-rose-400"
                  }
                >
                  {e.respondidas === 0
                    ? "sem dados"
                    : `${e.percentual}% · ${e.acertos}/${e.respondidas}`}
                </span>
              </div>

              {/* A linha vertical marca os 55% exigidos para aprovação. */}
              <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className={`h-full rounded-full ${COR_TEMA[e.tema].barra}`}
                  style={{ width: `${e.percentual}%` }}
                />
                <div
                  className="absolute inset-y-0 w-px bg-slate-900/60 dark:bg-white/70"
                  style={{ left: `${PERCENTUAL_CORTE}%` }}
                  aria-hidden
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        A marca vertical é a linha de corte mais exigente das três classes:{" "}
        {PERCENTUAL_CORTE}% (11 de 20 na Classe B; A e C aprovam com 53%).
      </p>

      {atencao.length > 0 && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Abaixo da linha de corte:{" "}
          <strong>{atencao.map((e) => ROTULO_CURTO[e.tema]).join(", ")}</strong>.
          É onde o estudo rende mais agora.
        </p>
      )}

      <Evolucao historico={historico} />
      <Suspeitas suspeitas={suspeitas} />

      <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
        <PainelPreferencias />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
        <ExportarImportar historico={historico} onImportar={onImportar} />
        {confirmando ? (
          <span className="flex items-center gap-3 text-sm">
            <span className="text-slate-600 dark:text-slate-400">
              Apagar todo o histórico?
            </span>
            <button
              onClick={() => {
                onLimpar();
                setConfirmando(false);
              }}
              className="font-medium text-rose-600 underline-offset-4 hover:underline dark:text-rose-400"
            >
              Apagar
            </button>
            <button
              onClick={() => setConfirmando(false)}
              className="text-slate-500 underline-offset-4 hover:underline dark:text-slate-400"
            >
              Cancelar
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirmando(true)}
            className="text-sm text-slate-500 underline-offset-4 hover:underline dark:text-slate-400"
          >
            Limpar histórico
          </button>
        )}
      </div>
    </section>
  );
}

// --- Evolução por matéria --------------------------------------------------

interface Ponto {
  data: string;
  pct: number;
}

/**
 * A série de cada matéria: percentual por simulado, do mais antigo ao mais
 * recente. Revisões ficam de fora — são só questões difíceis por construção,
 * e o percentual delas não é comparável ao de uma bateria normal.
 */
function seriePorTema(historico: Historico, tema: Tema): Ponto[] {
  const pontos: Ponto[] = [];
  for (const s of historico.simulados) {
    if (s.escolha === "revisao") continue;
    const doTema = s.itens.filter((i) => i.tema === tema);
    if (doTema.length === 0) continue;
    const certos = doTema.filter((i) => i.acertou).length;
    pontos.push({ data: s.data, pct: Math.round((certos / doTema.length) * 100) });
  }
  // O histórico é guardado do mais recente para o mais antigo.
  return pontos.reverse().slice(-12);
}

/**
 * Tendência das últimas baterias, uma linha por matéria contra o corte.
 *
 * Três gráficos de série única, e não um com três linhas: a identidade fica no
 * rótulo em texto de cada linha (nunca só na cor), e a escala 0–100 fixa faz as
 * três serem comparáveis entre si e com a linha de corte tracejada.
 */
function Evolucao({ historico }: { historico: Historico }) {
  const series = TEMAS.map((tema) => ({ tema, pontos: seriePorTema(historico, tema) }))
    .filter((s) => s.pontos.length >= 2);
  if (series.length === 0) return null;

  // Geometria do viewBox: x de 4 a 96, y de 4 (100%) a 32 (0%).
  const X0 = 4, X1 = 96, Y0 = 4, Y1 = 32;
  const x = (i: number, n: number) => X0 + ((X1 - X0) * i) / (n - 1);
  const y = (pct: number) => Y1 - ((Y1 - Y0) * pct) / 100;

  return (
    <div>
      <div className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
        Evolução — últimas baterias de cada matéria (linha tracejada ={" "}
        {PERCENTUAL_CORTE}%)
      </div>
      <div className="space-y-3">
        {series.map(({ tema, pontos }) => (
          <div key={tema} className="flex items-center gap-3">
            <span
              className={`w-24 shrink-0 text-xs font-medium ${COR_TEMA[tema].texto}`}
            >
              {ROTULO_CURTO[tema]}
            </span>
            <svg
              viewBox="0 0 100 36"
              preserveAspectRatio="none"
              className="h-10 min-w-0 flex-1"
              role="img"
              aria-label={`${ROTULO_CURTO[tema]}: de ${pontos[0].pct}% a ${pontos[pontos.length - 1].pct}% nas últimas ${pontos.length} baterias`}
            >
              <line
                x1={X0}
                x2={X1}
                y1={y(PERCENTUAL_CORTE)}
                y2={y(PERCENTUAL_CORTE)}
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
                className="stroke-slate-400 dark:stroke-slate-600"
                strokeWidth="1"
              />
              <polyline
                fill="none"
                points={pontos
                  .map((p, i) => `${x(i, pontos.length)},${y(p.pct)}`)
                  .join(" ")}
                vectorEffect="non-scaling-stroke"
                className={COR_TEMA[tema].linha}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {/* Ponto final desenhado como segmento nulo com ponta redonda:
                  um <circle> distorceria com preserveAspectRatio="none". */}
              <path
                d={`M ${x(pontos.length - 1, pontos.length)} ${y(pontos[pontos.length - 1].pct)} l 0 0.01`}
                vectorEffect="non-scaling-stroke"
                className={COR_TEMA[tema].linha}
                strokeWidth="6"
                strokeLinecap="round"
              />
              {/* Alvos de toque invisíveis, um por ponto, com tooltip nativo. */}
              {pontos.map((p, i) => (
                <rect
                  key={i}
                  x={x(i, pontos.length) - (X1 - X0) / (2 * pontos.length)}
                  y={0}
                  width={(X1 - X0) / pontos.length}
                  height={36}
                  fill="transparent"
                >
                  <title>
                    {`${new Date(p.data).toLocaleDateString("pt-BR")} — ${p.pct}%`}
                  </title>
                </rect>
              ))}
            </svg>
            <span className="w-10 shrink-0 text-right text-xs font-medium tabular-nums">
              {pontos[pontos.length - 1].pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Questões marcadas como suspeitas --------------------------------------

function Suspeitas({
  suspeitas,
}: {
  suspeitas: ReturnType<typeof useSuspeitas>;
}) {
  const [aberto, setAberto] = useState(false);
  if (!suspeitas.carregado || suspeitas.ids.length === 0) return null;

  const porId = new Map(BANCO.map((q) => [q.id, q]));

  return (
    <div className="rounded-lg border border-amber-300 p-3 dark:border-amber-900">
      <button
        onClick={() => setAberto((a) => !a)}
        className="flex w-full items-center justify-between text-sm font-medium text-amber-700 dark:text-amber-300"
      >
        <span>⚑ Questões marcadas como suspeitas ({suspeitas.ids.length})</span>
        <span aria-hidden>{aberto ? "▴" : "▾"}</span>
      </button>
      {aberto && (
        <ul className="mt-3 space-y-2">
          {suspeitas.ids.map((id) => {
            const q = porId.get(id);
            return (
              <li key={id} className="text-sm">
                <p className="text-slate-700 dark:text-slate-300">
                  {q
                    ? q.afirmacao
                    : "Questão removida numa atualização do banco."}
                </p>
                <button
                  onClick={() => suspeitas.alternar(id)}
                  className="mt-0.5 text-xs text-slate-500 underline-offset-2 hover:underline dark:text-slate-400"
                >
                  Desmarcar
                </button>
                {/* Sem a questão no banco não há o que reportar: ela já saiu
                    numa atualização, que era o desfecho desejado. */}
                {q && (
                  <a
                    href={urlDeReporte(q)}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-0.5 ml-3 text-xs text-slate-500 underline underline-offset-2 dark:text-slate-400"
                  >
                    Reportar no GitHub
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// --- Exportar / importar ---------------------------------------------------

interface Envelope {
  app: string;
  versao: number;
  exportadoEm: string;
  historico: Historico;
  suspeitas: string[];
  /** Opcional: backups feitos antes das preferências continuam válidos. */
  preferencias?: Preferencias;
}

function ExportarImportar({
  historico,
  onImportar,
}: {
  historico: Historico;
  onImportar: (outro: Historico) => number;
}) {
  const suspeitas = useSuspeitas();
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
      // é a mesma que protege o storage.
      const bruto =
        typeof dados === "object" && dados !== null && "historico" in dados
          ? (dados as Envelope).historico
          : dados;
      const valido = validar(bruto);
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
