"use client";

import { localizarPassagem } from "@/lib/trechos";
import type { Revisao, Veredito } from "@/lib/conferencia";
import type { Triagem } from "@/lib/triagem";
import type { Questao, Trecho } from "@/lib/tipos";

interface Props {
  questao: Questao;
  revisao?: Revisao;
  /** A decisão que o repositório já registrou sobre esta questão, se houver. */
  triagem?: Triagem;
  trecho?: Trecho;
  selecionado: boolean;
  modoCego: boolean;
  onSelecionar: () => void;
  onMarcar: (veredito: Veredito) => void;
  onAnotar: (nota: string) => void;
  onDescarregar: () => void;
  refNota: React.RefObject<HTMLTextAreaElement | null>;
}

const ROTULOS: Record<Veredito, string> = {
  V: "Verdadeira",
  F: "Falsa",
  P: "Problema no enunciado",
};

/**
 * Uma questão na lista de conferência.
 *
 * Só a questão selecionada abre o texto de origem e o campo de justificativa.
 * Não é enfeite: são 903 questões, e 903 textareas montadas de uma vez fazem a
 * aba engasgar a cada tecla digitada. Como a revisão é sempre de uma questão
 * por vez — é o que a coluna do PDF ao lado pressupõe —, o que está fechado não
 * está sendo usado.
 */
export default function ItemConferencia({
  questao: q,
  revisao,
  triagem,
  trecho,
  selecionado,
  modoCego,
  onSelecionar,
  onMarcar,
  onAnotar,
  onDescarregar,
  refNota,
}: Props) {
  const gabarito = q.resposta_correta ? "V" : "F";
  const decidido = revisao?.veredito ?? null;
  // No modo cego o gabarito só aparece depois da decisão — é o que dá sentido a
  // escolher V ou F em vez de julgar uma resposta já escrita na tela.
  const mostrarGabarito = !modoCego || decidido !== null;
  const diverge =
    decidido !== null && (decidido === "P" || decidido !== gabarito);

  const passagem = trecho ? localizarPassagem(trecho.texto, q.afirmacao) : null;

  return (
    <article
      onClick={onSelecionar}
      className={`scroll-mt-4 rounded-lg border p-3 transition ${
        selecionado
          ? "border-sky-500 bg-white ring-1 ring-sky-500 dark:bg-slate-900"
          : "border-slate-200 hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600"
      }`}
    >
      <p className="text-sm leading-relaxed">{q.afirmacao}</p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {(["V", "F", "P"] as const).map((v) => (
          <button
            key={v}
            onClick={(e) => {
              e.stopPropagation();
              onSelecionar();
              onMarcar(v);
            }}
            title={ROTULOS[v]}
            aria-pressed={decidido === v}
            className={`h-7 w-9 rounded-lg border text-sm font-semibold transition ${
              decidido === v
                ? v === "P"
                  ? "border-amber-500 bg-amber-500 text-white"
                  : "border-sky-600 bg-sky-600 text-white"
                : "border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            }`}
          >
            {v === "P" ? "⚑" : v}
          </button>
        ))}

        <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">
          {mostrarGabarito ? (
            <>
              gabarito <strong className="font-semibold">{gabarito}</strong>
            </>
          ) : (
            "gabarito oculto"
          )}
        </span>

        {/* O acervo comum é 9 em cada 10 questões, então ele fica em cinza e o
            acréscimo da Classe A ganha a cor: o que vale a pena saltar aos
            olhos é a exceção, não a regra. */}
        <span
          className={`rounded px-1.5 py-0.5 text-xs font-medium ${
            q.nivel === "A"
              ? "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300"
              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
          }`}
          title={
            q.nivel === "A"
              ? "Acréscimo exclusivo da Classe A — não cai nas provas das classes B e C"
              : "Está no programa até a Classe B — cai nas provas das classes C, B e A"
          }
        >
          {q.nivel === "A" ? "só classe A" : "classes C · B · A"}
        </span>

        {diverge && (
          // Sob triagem o vermelho sai: a divergência continua sendo verdade,
          // mas deixou de ser pendência, e pintá-la de alarme faria a tela
          // pedir de novo um trabalho que já foi feito.
          <span
            className={`rounded px-1.5 py-0.5 text-xs font-medium ${
              triagem
                ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
            }`}
          >
            {decidido === "P" ? "problema" : "divergência"}
          </span>
        )}
        {triagem && (
          <span
            className={`rounded px-1.5 py-0.5 text-xs font-medium ${
              revisao?.visto
                ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
            }`}
            title="Já tem decisão em scripts/conferencia_triado.json"
          >
            ✓ triado · {triagem.decisao}
          </span>
        )}
        {revisao?.nota.trim() && !selecionado && (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            ✎ anotada
          </span>
        )}

        <code
          className="ml-auto cursor-pointer text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          title="Copiar o id — é a chave de scripts/correcoes.json"
          onClick={(e) => {
            e.stopPropagation();
            void navigator.clipboard?.writeText(q.id);
          }}
        >
          {q.id}
        </code>
      </div>

      {selecionado && (
        <div className="mt-3 space-y-3 border-t border-slate-200 pt-3 dark:border-slate-800">
          {triagem && (
            // Vem antes de tudo de propósito. Quem reabre uma questão triada
            // precisa saber o que já foi conferido antes de gastar tempo
            // reconferindo — é para isso que o motivo é escrito por extenso.
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 dark:border-emerald-900 dark:bg-emerald-950/40">
              <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                Já triado — {triagem.decisao}
                {triagem.onde && ` (${triagem.onde})`}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-emerald-900/80 dark:text-emerald-100/70">
                {triagem.motivo}
              </p>
            </div>
          )}

          <p className="text-xs text-slate-500 dark:text-slate-400">
            <strong className="font-semibold">Explicação do banco:</strong>{" "}
            {q.explicacao_curta}
          </p>

          {q.origem === "ementa" ? (
            <p className="text-xs text-amber-700 italic dark:text-amber-300">
              Questão da ementa: não nasceu de um texto. A p. {q.pagina} é o
              capítulo onde estudar o assunto, não a origem do enunciado — a
              conferência aqui é contra o que você sabe da matéria.
            </p>
          ) : !trecho ? (
            <p className="text-xs text-rose-600 dark:text-rose-400">
              Trecho <code>{q.trecho_id}</code> não está em trechos.json.
            </p>
          ) : passagem ? (
            <div>
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                Texto original
              </p>
              <pre className="mt-1 max-h-48 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-2 text-[12px] leading-relaxed whitespace-pre-wrap dark:border-slate-800 dark:bg-slate-950">
                {trecho.texto.slice(passagem.inicio, passagem.fim)}
              </pre>
            </div>
          ) : (
            <details>
              <summary className="cursor-pointer text-xs text-slate-500 dark:text-slate-400">
                Passagem não localizada — ver o trecho inteiro (pp.{" "}
                {trecho.pagina}–{trecho.fim})
              </summary>
              <pre className="mt-1 max-h-48 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-2 text-[12px] leading-relaxed whitespace-pre-wrap dark:border-slate-800 dark:bg-slate-950">
                {trecho.texto}
              </pre>
            </details>
          )}

          <textarea
            ref={refNota}
            value={revisao?.nota ?? ""}
            onChange={(e) => onAnotar(e.target.value)}
            onBlur={onDescarregar}
            onClick={(e) => e.stopPropagation()}
            rows={2}
            placeholder="Justificativa — o que está errado, e contra o que você conferiu."
            className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
        </div>
      )}
    </article>
  );
}
