"use client";

import { useImperativeHandle, useRef, useState, type Ref } from "react";
import { COR_TEMA, ROTULO_CURTO, TEMAS } from "@/lib/constantes";
import type { Resposta, Tema } from "@/lib/tipos";
import RevisaoErros from "./RevisaoErros";

interface Props {
  respostas: Resposta[];
  /**
   * Numa bateria cega o usuário nunca viu o gabarito de questão nenhuma —
   * inclusive das que acertou no chute, que são justamente as que vale a pena
   * conferir. Aí a lista abre completa, com filtro para só os erros.
   */
  permitirTodas?: boolean;
  tituloErros?: string;
  ref?: Ref<GabaritoApi>;
}

/**
 * O que o gabarito aceita de fora.
 *
 * Existe para o consolidado da prova completa, onde o cartão vermelho de uma
 * matéria fica a mil pixels do primeiro item do gabarito dela: clicar no
 * cartão filtra e rola até aqui. É um método, e não uma prop de estado, porque
 * o pedido é um EVENTO — pedir duas vezes a mesma matéria tem de rolar de
 * novo, e sincronizar isso por efeito seria estado duplicado.
 */
export interface GabaritoApi {
  focarMateria: (tema: Tema) => void;
}

export default function Gabarito({
  respostas,
  permitirTodas = false,
  tituloErros = "Revisão dos erros",
  ref,
}: Props) {
  const [filtro, setFiltro] = useState<"todas" | "erros" | "marcadas">("todas");
  const [tema, setTema] = useState<Tema | null>(null);
  const secao = useRef<HTMLElement>(null);

  // As matérias presentes, na ordem canônica — nunca na ordem em que caíram no
  // sorteio, que muda de bateria para bateria.
  const temasPresentes = TEMAS.filter((t) =>
    respostas.some((r) => r.questao.tema === t),
  );

  useImperativeHandle(ref, () => ({
    focarMateria(t: Tema) {
      setTema(t);
      setFiltro("erros");
      secao.current?.scrollIntoView({ block: "start" });
    },
  }));

  const base =
    tema === null
      ? respostas
      : respostas.filter((r) => r.questao.tema === tema);
  const erradas = base.filter((r) => !r.acertou);
  const marcadas = base.filter((r) => r.marcada);

  if (!permitirTodas) {
    if (erradas.length === 0) return null;
    return (
      <section>
        <h2 className="rotulo-secao mb-3">
          {tituloErros} ({erradas.length})
        </h2>
        <RevisaoErros itens={erradas} />
      </section>
    );
  }

  const itens =
    filtro === "erros" ? erradas : filtro === "marcadas" ? marcadas : base;
  return (
    <section ref={secao}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="rotulo-secao">Gabarito</h2>
        <div className="flex flex-wrap gap-1.5 text-xs">
          <FiltroBotao
            ativo={filtro === "todas"}
            onClick={() => setFiltro("todas")}
            rotulo={`Todas (${base.length})`}
          />
          <FiltroBotao
            ativo={filtro === "erros"}
            onClick={() => setFiltro("erros")}
            rotulo={`Só os erros (${erradas.length})`}
          />
          {/* Só existe quando houve dúvida assumida na prova. É o filtro que
              responde "o que eu chutei e passou?", que é o motivo de o
              gabarito de uma prova cega abrir completo. */}
          {marcadas.length > 0 && (
            <FiltroBotao
              ativo={filtro === "marcadas"}
              onClick={() => setFiltro("marcadas")}
              rotulo={`Marcadas (${marcadas.length})`}
            />
          )}
        </div>
      </div>
      {/* Filtro por matéria: numa prova completa o gabarito é uma lista única
          de 30 a 90 questões, e "faltou em Técnica e Ética" não tinha como
          virar "ver essas questões". Só aparece quando há mais de uma matéria
          — numa bateria de matéria só, seria um filtro que não filtra nada. */}
      {temasPresentes.length > 1 && (
        <div
          role="group"
          aria-label="Filtrar o gabarito por matéria"
          className="mb-3 flex flex-wrap gap-1.5 text-xs"
        >
          <FiltroBotao
            ativo={tema === null}
            onClick={() => setTema(null)}
            rotulo="Todas as matérias"
          />
          {temasPresentes.map((t) => {
            const doTema = respostas.filter((r) => r.questao.tema === t);
            const erros = doTema.filter((r) => !r.acertou).length;
            return (
              <FiltroBotao
                key={t}
                ativo={tema === t}
                onClick={() => setTema(tema === t ? null : t)}
                cor={COR_TEMA[t].texto}
                rotulo={`${ROTULO_CURTO[t]} · ${erros} ${erros === 1 ? "erro" : "erros"}`}
              />
            );
          })}
        </div>
      )}
      {itens.length > 0 ? (
        <RevisaoErros itens={itens} />
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {filtro === "marcadas" ? "Nenhuma questão marcada" : "Nenhum erro"}
          {tema === null ? " nesta bateria." : ` em ${ROTULO_CURTO[tema]}.`}
        </p>
      )}
    </section>
  );
}

function FiltroBotao({
  ativo,
  onClick,
  rotulo,
  cor,
}: {
  ativo: boolean;
  onClick: () => void;
  rotulo: string;
  /** Classe de cor da matéria, quando o chip é de matéria. */
  cor?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={ativo}
      className={`alvo-toque rounded-full border px-4 font-medium transition ${
        ativo
          ? "border-slate-900 bg-rebaixado font-semibold dark:border-slate-100"
          : "border-slate-300 hover:border-slate-400 dark:border-slate-700"
      } ${cor ?? (ativo ? "" : "text-slate-600 dark:text-slate-300")}`}
    >
      {rotulo}
    </button>
  );
}
