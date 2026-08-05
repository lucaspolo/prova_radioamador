"use client";

import type { Resposta } from "@/lib/tipos";
import { COR_TEMA, ROTULO_CURTO } from "@/lib/constantes";
import BotaoConsultarMaterial from "./BotaoConsultarMaterial";
import BotaoSuspeita from "./BotaoSuspeita";
import TrechoOrigem from "./TrechoOrigem";

/**
 * A lista de erros de uma bateria, com explicação, fonte e trecho de origem.
 * Compartilhada entre a tela de resultado avulsa e a da prova completa.
 */
export default function RevisaoErros({ erradas }: { erradas: Resposta[] }) {
  if (erradas.length === 0) return null;

  return (
    <div className="space-y-3">
      {erradas.map((r) => (
        <div
          key={r.questao.id}
          className="rounded-xl border border-slate-300 p-4 dark:border-slate-700"
        >
          <div
            className={`mb-2 text-xs font-semibold uppercase ${COR_TEMA[r.questao.tema].texto}`}
          >
            {ROTULO_CURTO[r.questao.tema]}
          </div>
          <p className="leading-relaxed font-medium">{r.questao.afirmacao}</p>
          <p className="mt-2 text-sm">
            <span className="font-semibold text-rose-600 dark:text-rose-400">
              {r.respondeu === null
                ? "Não respondida — o tempo esgotou"
                : `Você respondeu ${r.respondeu ? "Verdadeiro" : "Falso"}`}
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              {" "}
              · o correto é {r.questao.resposta_correta ? "Verdadeiro" : "Falso"}
            </span>
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {r.questao.explicacao_curta}
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">
            {r.questao.origem === "documento" ? "Fonte: " : "Estude o tema em: "}
            {r.questao.arquivo_origem} · página {r.questao.pagina}
          </p>
          <BotaoConsultarMaterial
            arquivoOrigem={r.questao.arquivo_origem}
            pagina={r.questao.pagina}
            origem={r.questao.origem}
          />
          <TrechoOrigem
            trechoId={r.questao.trecho_id}
            afirmacao={r.questao.afirmacao}
          />
          <div>
            <BotaoSuspeita questaoId={r.questao.id} />
          </div>
        </div>
      ))}
    </div>
  );
}
