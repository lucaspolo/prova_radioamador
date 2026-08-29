"use client";

import { FORMATO, ROTULO_CURTO } from "@/lib/constantes";
import { minutosDoDesafio, type Desafio } from "@/lib/desafio";
import { codigoDaBateria } from "@/lib/semente";
import type { Questao, Tema } from "@/lib/tipos";

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
  baterias,
  link,
  onVoltar,
}: {
  desafio: Desafio;
  /** Uma bateria por matéria, na ordem em que serão aplicadas. */
  baterias: { tema: Tema; questoes: Questao[] }[];
  link: string;
  onVoltar: () => void;
}) {
  const formato = FORMATO[desafio.classe];
  const minutos = minutosDoDesafio(desafio);

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
            {baterias.length > 1
              ? `São ${baterias.length} matérias, uma folha cada — exames separados, como a Anatel aplica. `
              : ""}
            {/* `break-all`: o link de três matérias tem 100+ caracteres e, sem
                poder quebrar, estourava a tela em 111 px a 390 px — a página
                inteira passava a rolar de lado. */}
            É a mesma bateria do link{" "}
            <span className="font-mono break-all">{link}</span>:
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

      {/* --- Uma folha por matéria: são exames separados, e é assim que se
             aplica. A primeira não leva quebra de página; as demais, sim. --- */}
      {baterias.map(({ tema, questoes }, indice) => (
        <section
          key={`folha-${tema}`}
          className={indice > 0 ? "pagina-nova" : undefined}
        >
          <header className="border-b-2 border-current pb-3">
            <h1 className="text-xl font-bold">
              {ROTULO_CURTO[tema]} — Classe {desafio.classe}
            </h1>
            <p className="mt-1 text-sm">
              {questoes.length} questões · {minutos} min
              {baterias.length > 1 &&
                ` · matéria ${indice + 1} de ${baterias.length}`}
            </p>
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

          <Rodape desafio={desafio} questoes={questoes} link={link} />
        </section>
      ))}

      {/* --- Gabaritos, sempre em folha própria ----------------------------- */}
      {baterias.map(({ tema, questoes }) => (
        <section key={`gabarito-${tema}`} className="pagina-nova">
          <header className="border-b-2 border-current pb-3">
            <h1 className="text-xl font-bold">
              Gabarito · {ROTULO_CURTO[tema]} — Classe {desafio.classe}
            </h1>
            <p className="mt-1 text-sm">
              {questoes.length} questões · desafio{" "}
              <span className="font-mono font-bold">{desafio.semente}</span> ·
              bateria{" "}
              <span className="font-mono font-bold">
                {codigoDaBateria(questoes.map((q) => q.id))}
              </span>
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
      ))}
    </div>
  );
}

/**
 * O rastro no rodapé de cada folha: semente, código da bateria e link.
 *
 * O código é por matéria, como o do resultado — é o que permite conferir que a
 * folha impressa e a tela de quem respondeu pelo link são a mesma prova.
 */
function Rodape({
  desafio,
  questoes,
  link,
}: {
  desafio: Desafio;
  questoes: Questao[];
  link: string;
}) {
  return (
    <p className="mt-4 text-xs">
      Desafio <span className="font-mono font-bold">{desafio.semente}</span> ·
      bateria{" "}
      <span className="font-mono font-bold">
        {codigoDaBateria(questoes.map((q) => q.id))}
      </span>{" "}
      · {link}
    </p>
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
