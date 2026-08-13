"use client";

import { FORMATO, ROTULO_CURTO } from "@/lib/constantes";
import { minutosDoDesafio, type Desafio } from "@/lib/desafio";
import { codigoDaBateria } from "@/lib/semente";
import type { Questao } from "@/lib/tipos";

/**
 * A bateria em papel: folha em branco para responder à caneta e gabarito em
 * página separada.
 *
 * Curso presencial de radioclube ainda aplica simulado impresso, e hoje quem
 * prepara a turma recorta PDF na mão. O app já sabe sortear no formato oficial
 * da classe; faltava a saída.
 *
 * A bateria vem sempre de uma semente (`lib/desafio.ts`), e não de um sorteio
 * qualquer: assim o papel e o link são a MESMA prova — quem faltou à aula faz
 * pelo celular, e o instrutor corrige os dois com o mesmo gabarito.
 */
export default function TelaImpressao({
  desafio,
  questoes,
  link,
  onVoltar,
}: {
  desafio: Desafio;
  questoes: Questao[];
  link: string;
  onVoltar: () => void;
}) {
  const formato = FORMATO[desafio.classe];
  const codigo = codigoDaBateria(questoes.map((q) => q.id));
  const cabecalho = `${ROTULO_CURTO[desafio.tema]} · ${questoes.length} questões · ${minutosDoDesafio(desafio)} min`;

  return (
    <div className="space-y-6">
      <div className="nao-imprimir space-y-3">
        <div className="rounded-xl border-2 border-slate-300 p-4 dark:border-slate-700">
          <h2 className="font-semibold">Bateria em papel</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            A folha sai em branco, para marcar V ou F à caneta; o gabarito, com
            as explicações, sai em página separada — dá para entregar uma coisa
            e guardar a outra.
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            É a mesma bateria do link <span className="font-mono">{link}</span>:
            quem faltou responde pelo celular e cai exatamente nestas questões.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              onClick={() => window.print()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              Imprimir
            </button>
            <button
              onClick={onVoltar}
              className="rounded-lg border-2 border-slate-300 px-4 py-2 text-sm font-semibold transition hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
            >
              Voltar ao início
            </button>
          </div>
        </div>
      </div>

      {/* --- Folha de prova ------------------------------------------------ */}
      <section>
        <header className="border-b-2 border-current pb-3">
          <h1 className="text-xl font-bold">
            Simulado de Radioamador — Classe {desafio.classe}
          </h1>
          <p className="mt-1 text-sm">{cabecalho}</p>
          <p className="text-sm">
            Mínimo para aprovação: {formato.minimo} de {formato.questoes} na
            prova real da Classe {desafio.classe}.
          </p>
          {/* O instrutor recolhe as folhas: sem identificação, vira pilha. */}
          <dl className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            <Campo rotulo="Nome" />
            <Campo rotulo="Indicativo" />
            <Campo rotulo="Data" />
          </dl>
        </header>

        <ol className="mt-4">
          {questoes.map((q, i) => (
            <li
              key={q.id}
              className="flex gap-3 border-b border-current/20 py-2.5 text-sm"
            >
              <span className="w-6 shrink-0 text-right font-semibold tabular-nums">
                {i + 1}.
              </span>
              <span className="flex shrink-0 gap-2 font-mono text-xs">
                <Quadrado letra="V" />
                <Quadrado letra="F" />
              </span>
              <span className="leading-snug">{q.afirmacao}</span>
            </li>
          ))}
        </ol>

        <p className="mt-4 text-xs">
          Desafio <span className="font-mono font-bold">{desafio.semente}</span>{" "}
          · bateria <span className="font-mono font-bold">{codigo}</span> ·{" "}
          {link}
        </p>
      </section>

      {/* --- Gabarito, sempre em folha própria ------------------------------ */}
      <section className="pagina-nova">
        <header className="border-b-2 border-current pb-3">
          <h1 className="text-xl font-bold">
            Gabarito — Classe {desafio.classe}
          </h1>
          <p className="mt-1 text-sm">
            {cabecalho} · desafio{" "}
            <span className="font-mono font-bold">{desafio.semente}</span> ·
            bateria <span className="font-mono font-bold">{codigo}</span>
          </p>
        </header>

        <ol className="mt-4">
          {questoes.map((q, i) => (
            <li
              key={q.id}
              className="flex gap-3 border-b border-current/20 py-2 text-sm"
            >
              <span className="w-6 shrink-0 text-right font-semibold tabular-nums">
                {i + 1}.
              </span>
              <span className="w-4 shrink-0 font-bold">
                {q.resposta_correta ? "V" : "F"}
              </span>
              <span className="leading-snug">{q.explicacao_curta}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Campo({ rotulo }: { rotulo: string }) {
  return (
    <div>
      <dt className="text-xs opacity-70">{rotulo}</dt>
      <dd className="mt-3 border-b border-current" />
    </div>
  );
}

function Quadrado({ letra }: { letra: string }) {
  return (
    <span className="flex items-center gap-1">
      {letra}
      <span
        aria-hidden
        className="inline-block h-3.5 w-3.5 border border-current align-middle"
      />
    </span>
  );
}
