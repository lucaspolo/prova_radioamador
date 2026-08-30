"use client";

import { PERCENTUAL_CORTE, ROTULO_CURTO } from "@/lib/constantes";
import { estatisticasPorTema, resumo, type Historico } from "@/lib/historico";

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
  const atencao =
    geral && geral.simulados > 0
      ? estatisticasPorTema(historico)
          .filter((e) => e.respondidas > 0 && e.percentual < PERCENTUAL_CORTE)
          .sort((a, b) => a.percentual - b.percentual)
      : [];

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
            {geral.simulados} {geral.simulados === 1 ? "simulado" : "simulados"}{" "}
            · {geral.percentual}%
            {atencao.length > 0 && (
              // A cor sozinha não diz nada: o alerta vem escrito.
              <span className="text-amber-700 dark:text-amber-300">
                {" · "}
                <span aria-hidden>⚠ </span>
                {atencao.length === 1
                  ? `${ROTULO_CURTO[atencao[0].tema]} abaixo do corte`
                  : `${atencao.length} matérias abaixo do corte`}
              </span>
            )}
          </>
        )}
      </span>
      <span aria-hidden className="shrink-0 text-slate-400">
        ›
      </span>
    </button>
  );
}
