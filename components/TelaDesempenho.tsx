"use client";

import { useEffect, useRef, useState } from "react";
import type { Classe } from "@/lib/tipos";
import {
  CLASSE_PADRAO,
  COR_TEMA,
  PERCENTUAL_CORTE,
  ROTULO_CURTO,
} from "@/lib/constantes";
import { estatisticasPorTema, resumo, type Historico } from "@/lib/historico";
import { prontidao } from "@/lib/prontidao";
import { cobertura } from "@/lib/questoes";
import { lerPreferencias } from "@/lib/preferencias";
import { useSuspeitas } from "@/hooks/useSuspeitas";
import Evolucao from "./Evolucao";
import ExportarImportar from "./ExportarImportar";
import Suspeitas from "./Suspeitas";

interface Props {
  historico: Historico;
  carregado: boolean;
  onLimpar: () => void;
  /** Mescla um histórico importado ao local; devolve quantos eram novos. */
  onImportar: (outro: Historico) => number;
  onVoltar: () => void;
}

/**
 * O acompanhamento de desempenho, em tela própria.
 *
 * Vive numa etapa da máquina de estados, e não numa rota, pelo mesmo motivo da
 * consulta rápida: o service worker responde toda navegação com a casca de `/`
 * (`scripts/gerar_sw.mjs`), então um deep link para `/desempenho` sem rede
 * renderizaria a home. Ficando em `/`, a tela já está pré-cacheada sem nenhuma
 * linha a mais no gerador.
 *
 * Saiu da tela inicial porque quem abre o app para fazer um simulado rolava
 * uma parede de gráficos antes de chegar à escolha da prova. O que ficou lá é
 * uma linha de resumo (`ResumoDesempenho`), que traz o diagnóstico acionável
 * — qual matéria está abaixo do corte — e leva para cá.
 */
export default function TelaDesempenho({
  historico,
  carregado,
  onLimpar,
  onImportar,
  onVoltar,
}: Props) {
  const [confirmando, setConfirmando] = useState(false);
  const [classePreferida, setClassePreferida] = useState<Classe>(CLASSE_PADRAO);
  // Uma instância só do hook para a tela inteira: `Suspeitas` e
  // `ExportarImportar` mexem na mesma lista, e duas instâncias vivas teriam
  // cada uma o seu estado — importar um backup e depois desmarcar qualquer
  // suspeita gravaria a lista velha por cima das importadas.
  const suspeitas = useSuspeitas();
  const titulo = useRef<HTMLHeadingElement>(null);

  // Chegou-se aqui por um item de menu que sumiu da tela; sem isto o foco
  // volta ao <body> e quem navega por teclado ou leitor recomeça do topo.
  useEffect(() => {
    titulo.current?.focus();
    // Mesmo padrão de hidratação do resto do app: o storage só existe no
    // cliente, e a classe preferida define o acervo da cobertura.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClassePreferida(lerPreferencias().classe);
  }, []);

  const geral = resumo(historico);
  const abrangencia = cobertura(historico, classePreferida);
  const aptidao = prontidao(historico, classePreferida);
  const estatisticas = estatisticasPorTema(historico);
  const atencao = estatisticas
    .filter((e) => e.respondidas > 0 && e.percentual < PERCENTUAL_CORTE)
    .sort((a, b) => a.percentual - b.percentual);

  return (
    <div className="space-y-6">
      <div>
        <h2 ref={titulo} tabIndex={-1} className="text-xl font-bold">
          Seu desempenho
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Acertos por matéria contra a linha de corte oficial, tendência das
          últimas baterias e backup do histórico.
        </p>
      </div>

      {/* Enquanto o storage não foi lido não há número nenhum para mostrar, e
          inventar um seria pior do que esperar: a moldura da tela fica, os
          dados entram no primeiro efeito. */}
      {!carregado ? null : geral.simulados === 0 ? (
        <section className="space-y-4">
          <div className="rounded-xl border border-dashed border-borda p-5 text-center text-sm text-slate-500 dark:text-slate-400">
            Seu desempenho por matéria aparece aqui depois do primeiro simulado.
          </div>
          {/* Quem chega num aparelho novo precisa do importar ANTES do primeiro
              simulado — é justamente o momento de trazer o backup. */}
          <ExportarImportar
            historico={historico}
            onImportar={onImportar}
            suspeitas={suspeitas}
          />
        </section>
      ) : (
        <section className="space-y-5 rounded-xl border border-borda bg-superficie p-5">
          <div className="flex items-baseline justify-between">
            <h3 className="rotulo-secao">
              Por matéria
            </h3>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {geral.simulados}{" "}
              {geral.simulados === 1 ? "simulado" : "simulados"} ·{" "}
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
                          ? "text-slate-500 dark:text-slate-400"
                          : aprovando
                            ? "font-medium text-emerald-700 dark:text-emerald-400"
                            : "font-medium text-rose-700 dark:text-rose-400"
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
              <strong>
                {atencao.map((e) => ROTULO_CURTO[e.tema]).join(",")}
              </strong>
              . É onde o estudo rende mais agora.
            </p>
          )}

          {/*"Passaria hoje?", na forma honesta: fatos da janela recente por
              matéria contra o corte da classe — a prova exige o mínimo nas
              TRÊS, e é a mais fraca que decide. Treino com gabarito imediato
              não é prova cega, então o texto diz o que aconteceu, nunca"você
              passaria". */}
          <div>
            <h4 className="rotulo-secao mb-2">
              Últimas baterias · corte da Classe {classePreferida}
            </h4>
            <ul className="space-y-1 text-sm">
              {aptidao.map((p) => (
                <li
                  key={p.tema}
                  className="flex items-baseline justify-between gap-2"
                >
                  <span className={`font-medium ${COR_TEMA[p.tema].texto}`}>
                    {ROTULO_CURTO[p.tema]}
                  </span>
                  {p.baterias === 0 ? (
                    <span className="text-slate-500 dark:text-slate-400">
                      nenhuma bateria ainda
                    </span>
                  ) : (
                    <span
                      className={
                        p.acimaDoCorte === p.baterias
                          ? "font-medium text-emerald-700 dark:text-emerald-400"
                          : p.acimaDoCorte === 0
                            ? "font-medium text-rose-700 dark:text-rose-400"
                            : "font-medium text-amber-700 dark:text-amber-400"
                      }
                    >
                      acima do corte em {p.acimaDoCorte} de {p.baterias}
                      {!p.soOficiais && (
                        <span className="font-normal text-slate-500 dark:text-slate-400">
                          {" "}
                          · baterias menores que a prova
                        </span>
                      )}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* O sorteio ponderado não garante visitar o banco inteiro; este
              número transforma"será que já vi tudo?" em plano — o modo"só
              inéditas" da tela inicial fecha o resto. A classe é a preferida
              (a mesma da tela inicial), lida no efeito como todo storage. */}
          <div>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="font-medium">
                Cobertura do banco · Classe {classePreferida}
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                viu {abrangencia.vistas} de {abrangencia.total}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-slate-900 dark:bg-slate-100"
                style={{
                  width: `${abrangencia.total > 0 ? Math.round((abrangencia.vistas / abrangencia.total) * 100) : 0}%`,
                }}
              />
            </div>
          </div>

          <Evolucao historico={historico} />
          <Suspeitas suspeitas={suspeitas} />

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-borda pt-3">
            <ExportarImportar
              historico={historico}
              onImportar={onImportar}
              suspeitas={suspeitas}
            />
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
                  className="font-medium text-rose-700 underline-offset-4 hover:underline dark:text-rose-400"
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
      )}

      <button
        onClick={onVoltar}
        className="w-full rounded-xl bg-slate-900 px-6 py-4 font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
      >
        Voltar ao início
      </button>
    </div>
  );
}
