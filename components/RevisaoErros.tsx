"use client";

import type { Resposta } from "@/lib/tipos";
import { COR_TEMA, ROTULO_CURTO } from "@/lib/constantes";
import BotaoConsultarMaterial from "./BotaoConsultarMaterial";
import BotaoSuspeita from "./BotaoSuspeita";
import TrechoOrigem from "./TrechoOrigem";
import Icone from "./Icone";

/**
 * A lista de questões de uma bateria já corrigida, com explicação, fonte e
 * trecho de origem. Compartilhada pela tela de resultado avulsa, pela da prova
 * completa e pelo gabarito do modo prova cega.
 *
 * Recebe os itens já filtrados por quem chama: só os erros, na revisão, ou a
 * bateria inteira, no gabarito. Por isso cada item se identifica — não dá mais
 * para assumir que tudo aqui é erro.
 */
export default function RevisaoErros({ itens }: { itens: Resposta[] }) {
  if (itens.length === 0) return null;

  return (
    <div className="space-y-3">
      {itens.map((r) => {
        const emBranco = r.respondeu === null;
        return (
          <div
            key={r.questao.id}
            className="rounded-xl border border-borda bg-superficie p-4"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span
                className={`text-xs font-semibold uppercase ${COR_TEMA[r.questao.tema].texto}`}
              >
                {ROTULO_CURTO[r.questao.tema]}
              </span>
              <span className="flex items-center gap-1.5">
                {/* A dúvida assumida durante a prova vale tanto quanto o
                  veredito: é ela que distingue o acerto do chute. */}
                {r.marcada && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    <Icone nome="bandeira" className="mr-1 h-3 w-3 align-[-1px]" />
                    marcada
                  </span>
                )}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    r.acertou
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      : emBranco
                        ? "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                  }`}
                >
                  {r.acertou ? "Acertou" : emBranco ? "Em branco" : "Errou"}
                </span>
              </span>
            </div>
            <p className="leading-relaxed font-medium">{r.questao.afirmacao}</p>
            {/* O gabarito primeiro, em negrito, e o que a pessoa marcou depois,
                em cinza — antes era o contrário, e o olho ia direto ao vermelho
                da resposta errada enquanto o "Falso" a memorizar era o texto
                mais apagado do cartão. Quem revisa precisa levar embora a
                resposta certa, não o próprio erro. */}
            <p className="mt-2 text-sm">
              <span className="font-semibold">
                Gabarito: {r.questao.resposta_correta ? "Verdadeiro" : "Falso"}
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                {" · "}
                {emBranco
                  ? "você deixou em branco"
                  : `você marcou ${r.respondeu ? "Verdadeiro" : "Falso"}`}
                {r.acertou && !emBranco ? " — correto" : ""}
              </span>
            </p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              {r.questao.explicacao_curta}
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {r.questao.origem === "documento"
                ? "Fonte: "
                : "Estude o tema em: "}
              {r.questao.arquivo_origem} · página {r.questao.pagina}
            </p>
            {/* No papel, botão não clica: a folha impressa fica com a
                afirmação, o gabarito, a explicação e a fonte. */}
            <div className="nao-imprimir">
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
                <BotaoSuspeita questao={r.questao} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
