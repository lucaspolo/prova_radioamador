"use client";

import { useState } from "react";
import type { Classe, Tema } from "@/lib/tipos";
import {
  CLASSES,
  CLASSE_PADRAO,
  COR_TEMA,
  FORMATO,
  ROTULO_CURTO,
  tamanhos,
  tempoDaBateria,
  TEMAS,
} from "@/lib/constantes";
import { contarPorTema, disponiveis } from "@/lib/questoes";

interface Props {
  onIniciar: (
    tema: Tema,
    quantidade: number,
    classe: Classe,
    cronometrar: boolean,
  ) => void;
}

export default function TelaInicio({ onIniciar }: Props) {
  const [classe, setClasse] = useState<Classe>(CLASSE_PADRAO);
  const [escolha, setEscolha] = useState<Tema>(TEMAS[0]);
  const formato = FORMATO[classe];
  const [quantidade, setQuantidade] = useState(FORMATO[CLASSE_PADRAO].questoes);
  const [cronometrar, setCronometrar] = useState(true);
  const contagem = contarPorTema(classe);
  const total = disponiveis(escolha, classe);
  const opcoes = tamanhos(classe);

  // Não dá para sortear mais questões do que existem no tema escolhido.
  const limite = Math.min(quantidade, total);

  // Trocar de classe muda o formato da prova; a quantidade acompanha, senão
  // ficaria selecionado um número que nem aparece mais entre as opções.
  // Trocar de classe muda o formato da prova; a quantidade acompanha, senão
  // ficaria selecionado um número que nem aparece mais entre as opções.
  function trocarClasse(nova: Classe) {
    setClasse(nova);
    setQuantidade(FORMATO[nova].questoes);
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
          Classe
        </h2>
        <div className="flex gap-2">
          {CLASSES.map((c) => (
            <button
              key={c}
              onClick={() => trocarClasse(c)}
              className={`flex-1 rounded-xl border-2 px-3 py-3 transition ${
                classe === c
                  ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                  : "border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
              }`}
            >
              <div className="text-base font-bold">Classe {c}</div>
              <div className="mt-0.5 text-xs opacity-70">
                {FORMATO[c].questoes} questões · mín. {FORMATO[c].minimo}
              </div>
            </button>
          ))}
        </div>
        {classe === "C" && (
          <p className="mt-3 text-xs text-slate-500 italic dark:text-slate-500">
            A ementa da Classe C é um subconjunto da Classe B, então o banco
            cobre mais do que cai — há questões de cálculo (código de cores,
            Kirchhoff, associação de resistores) que só são cobradas a partir da
            Classe B.
          </p>
        )}
        {classe === "A" && (
          <p className="mt-3 text-xs text-slate-500 italic dark:text-slate-500">
            Inclui o acréscimo técnico da Classe A em Eletrônica. Legislação e
            Técnica e Ética têm a mesma ementa nas três classes — o que muda é o
            número de questões.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
          Matéria
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {TEMAS.map((tema) => (
            <BotaoTema
              key={tema}
              ativo={escolha === tema}
              titulo={ROTULO_CURTO[tema]}
              detalhe={`${contagem[tema]} questões`}
              classes={`${COR_TEMA[tema].borda} ${COR_TEMA[tema].texto}`}
              onClick={() => setEscolha(tema)}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
          Quantidade de questões
        </h2>
        <div className="flex flex-wrap gap-2">
          {opcoes.map((n) => (
            <button
              key={n}
              onClick={() => setQuantidade(n)}
              disabled={n > total}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                quantidade === n
                  ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                  : "border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
              }`}
            >
              {n}
              {n === formato.questoes && (
                <span className="ml-1.5 text-xs opacity-70">prova real</span>
              )}
            </button>
          ))}
        </div>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          A prova da Anatel para a Classe {classe} tem {formato.questoes}{" "}
          questões por matéria, exige {formato.minimo} acertos e dá{" "}
          {formato.minutos} minutos. Cada matéria é uma prova separada — por
          isso o simulado é sempre de uma matéria só.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
          Cronômetro
        </h2>
        <button
          onClick={() => setCronometrar((c) => !c)}
          aria-pressed={cronometrar}
          className={`w-full rounded-xl border-2 p-4 text-left transition ${
            cronometrar
              ? "border-slate-900 dark:border-slate-100"
              : "border-slate-300 opacity-70 hover:opacity-100 dark:border-slate-700"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold">
              {cronometrar ? "Cronômetro ligado" : "Cronômetro desligado"}
            </span>
            {cronometrar && (
              <span className="font-mono text-lg font-bold tabular-nums">
                {Math.round(tempoDaBateria(classe, limite) / 60)} min
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {cronometrar
              ? "No ritmo oficial da prova. Ao esgotar, o que faltar conta como erro — igual à prova real."
              : "Sem limite de tempo; bom para estudar com calma."}
          </p>
        </button>
      </section>

      <button
        onClick={() => onIniciar(escolha, limite, classe, cronometrar)}
        className="w-full rounded-xl bg-slate-900 px-6 py-4 text-base font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
      >
        Iniciar simulado · {limite} questões
      </button>
    </div>
  );
}

function BotaoTema({
  ativo,
  titulo,
  detalhe,
  classes,
  onClick,
}: {
  ativo: boolean;
  titulo: string;
  detalhe: string;
  classes: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border-2 p-4 text-left transition ${classes} ${
        ativo
          ? "ring-2 ring-slate-900 ring-offset-2 ring-offset-[var(--background)] dark:ring-slate-100"
          : "opacity-70 hover:opacity-100"
      }`}
    >
      <div className="font-semibold">{titulo}</div>
      <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
        {detalhe}
      </div>
    </button>
  );
}
