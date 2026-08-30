"use client";

import { COR_TEMA, PERCENTUAL_CORTE, ROTULO_CURTO } from "@/lib/constantes";
import {
  estatisticasRecentesPorTema,
  frequencia,
  resumo,
  type Historico,
} from "@/lib/historico";
import Icone from "./Icone";

interface Props {
  historico: Historico;
  carregado: boolean;
  onAbrir: () => void;
}

/**
 * O desempenho reduzido a uma linha, na tela inicial.
 *
 * O painel inteiro virou tela própria (`TelaDesempenho`) para a home ser sobre
 * fazer a prova. O que não podia sumir é o diagnóstico acionável: qual matéria
 * está abaixo do corte é apoio à decisão imediatamente seguinte, que é
 * escolher a matéria da bateria.
 *
 * A linha dizia "12 simulados · 57%" e, quando havia, "⚠ Técnica e Ética
 * abaixo do corte". Os dois números eram sobre o passado inteiro: o 57% não
 * existe no exame — a aprovação é matéria a matéria —, e o alerta olhava a
 * média da vida toda, então uma matéria a 63% acumulado podia estar em 50% na
 * última bateria sem aparecer, e outra corrigida há duas semanas continuava
 * marcada. Agora são as TRÊS matérias, cada uma com o resultado das últimas
 * baterias dela: é essa a decisão que a linha apoia.
 *
 * Não retorna `null` enquanto o storage não foi lido. Um bloco de 400px
 * aparecendo depois da hidratação é ruído; uma linha aparecendo é um salto de
 * layout bem onde o polegar já está indo. A garantia contra número inventado é
 * outra: antes de ler, renderiza só o que não depende de dado nenhum — o HTML
 * estático e o primeiro render do cliente são idênticos, e os números entram
 * na mesma linha, sem refluxo.
 */
export default function ResumoDesempenho({
  historico,
  carregado,
  onAbrir,
}: Props) {
  const geral = carregado ? resumo(historico) : null;
  const recentes =
    geral && geral.simulados > 0 ? estatisticasRecentesPorTema(historico) : [];
  const freq = geral && geral.simulados > 0 ? frequencia(historico) : null;

  return (
    <button
      onClick={onAbrir}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-borda bg-superficie px-4 py-3 text-left text-sm transition hover:border-slate-400 dark:hover:border-slate-500"
    >
      <span className="min-w-0">
        {geral === null ? (
          "Seu desempenho"
        ) : geral.simulados === 0 ? (
          // Quem chega num aparelho novo não tem histórico que o faça procurar
          // uma tela de desempenho. Sem esta linha nomear o backup, restaurar
          // vira algo indescobrível atrás de um ícone de menu.
          <>Nenhum simulado ainda · importar um backup</>
        ) : (
          <>
            {/* Uma matéria por vez, na cor dela, com o corte como referência.
                A matéria ainda sem bateria aparece com um travessão em vez de
                sumir: "ainda não fiz Eletrônica" é a informação mais acionável
                que esta linha pode dar a quem está começando. */}
            <span className="flex flex-wrap gap-x-2 gap-y-0.5">
              {recentes.map((e) => (
                <span key={e.tema} className={COR_TEMA[e.tema].texto}>
                  <span className="font-medium">{ROTULO_CURTO[e.tema]}</span>{" "}
                  {e.baterias === 0 ? (
                    <span className="text-slate-600 dark:text-slate-400">
                      —
                    </span>
                  ) : (
                    <>
                      {e.percentual}%
                      {e.percentual < PERCENTUAL_CORTE && (
                        // A cor sozinha não diz nada, e aqui ela já significa
                        // "matéria": o alerta vem em ícone e em texto.
                        <span className="text-amber-700 dark:text-amber-300">
                          <Icone
                            nome="alerta"
                            className="ml-1 h-3.5 w-3.5 align-[-2px]"
                          />
                          <span className="sr-only"> abaixo do corte</span>
                        </span>
                      )}
                    </>
                  )}
                </span>
              ))}
            </span>
            {/* A segunda linha só existe quando tem o que dizer: uma sequência
                de dois dias ou mais, ou um sumiço longo o bastante para as
                lacunas conhecidas começarem a esquecer. Nos outros casos o
                cartão continua de uma linha, que é o normal da home. */}
            {freq !== null && <FrequenciaEmTexto frequencia={freq} />}
          </>
        )}
      </span>
      <span aria-hidden className="shrink-0 text-slate-400">
        <Icone nome="seta-direita" className="h-4 w-4" />
      </span>
    </button>
  );
}

/**
 * O ritmo de estudo em texto: "3 dias seguidos", "há 5 dias".
 *
 * Sóbrio de propósito — sem selo, sem chama, sem confete. O público é adulto e
 * está estudando para uma prova da Anatel; o valor está em enxergar o próprio
 * ritmo, não em ser premiado por ele. Pela mesma razão a sequência aceita
 * terminar ontem: cortá-la à meia-noite transformaria o número num cobrador.
 */
function FrequenciaEmTexto({
  frequencia: f,
}: {
  frequencia: { diasDesdeUltima: number | null; diasSeguidos: number };
}) {
  const partes: string[] = [];
  if (f.diasSeguidos >= 2) partes.push(`${f.diasSeguidos} dias seguidos`);
  if (f.diasDesdeUltima !== null && f.diasDesdeUltima >= 3) {
    partes.push(
      `última bateria há ${f.diasDesdeUltima} dias — o que você errou está esquecendo`,
    );
  }
  if (partes.length === 0) return null;
  return (
    <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-400">
      {partes.join(" · ")}
    </span>
  );
}
