"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import ItemConferencia from "./ItemConferencia";
import { useConferencia } from "@/hooks/useConferencia";
import {
  achadosTriados,
  agruparEmCapitulos,
  divergente,
  mesclarRevisoes,
  montarExportacao,
  pendente,
  revisoesDoArquivo,
  type Veredito,
} from "@/lib/conferencia";
import { IDS_TRIADOS, TRIAGENS } from "@/lib/triagem";
import { TEMAS } from "@/lib/constantes";
import { caminhoPdf } from "@/lib/pdfs";
import { BANCO } from "@/lib/questoes";
import { carregarTrechos, localizarPassagem } from "@/lib/trechos";
import ocrVisao from "@/lib/ocr-visao.json";
import type { Nivel, Tema, Trecho } from "@/lib/tipos";

/**
 * O pdf.js depende de DOM, Canvas e Worker, e quebraria a geração estática —
 * mesma razão de `BotaoConsultarMaterial`. Aqui o painel também é a parte
 * pesada da tela, e adiá-lo deixa a lista aparecer antes.
 */
const LeitorPdfPainel = dynamic(() => import("./LeitorPdfPainel"), {
  ssr: false,
  loading: () => (
    <p className="p-6 text-center text-sm text-slate-500">Abrindo PDF…</p>
  ),
});

const POR_OCR: ReadonlySet<string> = new Set(ocrVisao as string[]);

type Filtro = "todas" | "pendentes" | "divergentes" | "anotadas" | "triadas";

const FILTROS: { chave: Filtro; rotulo: string }[] = [
  { chave: "todas", rotulo: "todas" },
  { chave: "pendentes", rotulo: "não revisadas" },
  { chave: "divergentes", rotulo: "divergentes" },
  { chave: "anotadas", rotulo: "com nota" },
  { chave: "triadas", rotulo: "já triadas" },
];

/**
 * A tela de conferência do banco: questões à esquerda, o PDF que as gerou à
 * direita, já na página certa e com a passagem grifada.
 *
 * As travas automáticas cobrem o que dá para derivar do texto — que a linha da
 * tabela está na página, que toda faixa tem questão, que o gabarito é booleano.
 * Nenhuma delas responde "esta afirmação é verdadeira?". Os dois erros graves
 * que já saíram deste banco (o "W" lido como "Y" no Ato 3445, as colunas
 * trocadas da Tabela II) só apareceram porque alguém leu uma questão e
 * desconfiou. Esta tela existe para baratear o desconfiar: o veredito é um
 * clique, a fonte está ao lado, e o que sai no fim é um JSON que vira entrada
 * de `scripts/correcoes.json`.
 */
export default function TelaConferencia() {
  const conferencia = useConferencia();
  const {
    revisoes,
    carregado,
    marcar,
    anotar,
    darPorVistas,
    descarregar,
    substituir,
  } = conferencia;

  const [trechos, setTrechos] = useState<Record<string, Trecho>>({});
  const [arquivoFiltro, setArquivoFiltro] = useState("");
  const [temaFiltro, setTemaFiltro] = useState<Tema | "">("");
  // O filtro de classes é pelo `nivel`, e não uma opção por classe: C e B
  // sorteiam o mesmo acervo (nível "B") e a Classe A sorteia o banco inteiro,
  // então "filtrar pela C", "pela B" e "pela A" seriam três nomes para duas
  // listas — uma delas o banco todo. O que separa questões é o nível, e as
  // opções o dizem na língua das classes.
  const [nivelFiltro, setNivelFiltro] = useState<Nivel | "">("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [modoCego, setModoCego] = useState(false);
  const [selBruto, setSel] = useState(0);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const refNota = useRef<HTMLTextAreaElement>(null);
  const refLista = useRef<HTMLDivElement>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    carregarTrechos()
      .then(setTrechos)
      .catch(() => setMensagem("Não foi possível carregar trechos.json."));
  }, []);

  const capitulos = useMemo(() => agruparEmCapitulos(BANCO, POR_OCR), []);

  /**
   * A lista achatada, já na ordem de leitura dos capítulos.
   *
   * Achatada porque o J/K precisa de um índice, e porque os cabeçalhos de
   * arquivo e de página são derivados na renderização: guardar a árvore
   * obrigaria a percorrê-la para descobrir "qual é a próxima questão".
   */
  const linhas = useMemo(() => {
    const filtradas = capitulos
      .flatMap((c) => c.questoes)
      .filter((q) => {
        if (arquivoFiltro && q.arquivo_origem !== arquivoFiltro) return false;
        if (temaFiltro && q.tema !== temaFiltro) return false;
        if (nivelFiltro && q.nivel !== nivelFiltro) return false;
        const r = revisoes[q.id];
        if (filtro === "triadas") return IDS_TRIADOS.has(q.id);
        if (filtro === "pendentes") return !r?.veredito;
        // Divergência e nota dadas por vistas saem das duas lentes de trabalho:
        // são assunto encerrado, e continuam achaveis em "já triadas".
        if (filtro === "divergentes")
          return !!r && !r.visto && divergente(q, r);
        if (filtro === "anotadas") return !!r && !r.visto && !!r.nota.trim();
        return true;
      });

    // Cada questão já sai sabendo se abre um arquivo ou uma página nova. É uma
    // comparação com a anterior, e não um acumulador percorrendo a lista: sob
    // filtro a primeira questão de cada arquivo muda, e um contador que se
    // atualiza enquanto o React desenha erraria na segunda passada.
    return filtradas.map((q, i) => {
      const anterior = filtradas[i - 1];
      const trocouArquivo = anterior?.arquivo_origem !== q.arquivo_origem;
      return {
        q,
        trocouArquivo,
        trocouPagina: trocouArquivo || anterior?.pagina !== q.pagina,
      };
    });
  }, [capitulos, arquivoFiltro, temaFiltro, nivelFiltro, filtro, revisoes]);

  // O índice é preso à lista no momento da leitura: trocar de filtro pode
  // encurtá-la, e corrigir isso num efeito custaria um render com o painel
  // apontando para uma questão que não está mais na tela.
  const sel = Math.min(selBruto, Math.max(linhas.length - 1, 0));
  const atual = linhas[sel]?.q;

  const passagem = useMemo(() => {
    if (!atual?.trecho_id) return null;
    const trecho = trechos[atual.trecho_id];
    if (!trecho) return null;
    const p = localizarPassagem(trecho.texto, atual.afirmacao);
    return p ? trecho.texto.slice(p.inicio, p.fim) : null;
  }, [atual, trechos]);

  const irPara = useCallback((indice: number) => {
    setSel(indice);
    // O cartão selecionado abre o texto de origem, então cresce: rolar depois
    // que o React remontou, ou a posição calculada é a do cartão fechado.
    requestAnimationFrame(() => {
      refLista.current
        ?.querySelector(`[data-indice="${indice}"]`)
        ?.scrollIntoView({ block: "nearest" });
    });
  }, []);

  /**
   * Atalhos, porque 903 questões no mouse é uma revisão que não acontece.
   *
   * Ignorados enquanto o foco está num campo: digitar "vff" numa justificativa
   * tem de escrever "vff", e não marcar três vereditos.
   */
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement | null;
      const digitando =
        alvo instanceof HTMLTextAreaElement ||
        alvo instanceof HTMLInputElement ||
        alvo instanceof HTMLSelectElement;

      if (digitando) {
        if (e.key === "Escape") alvo.blur();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const q = linhas[sel]?.q;
      const tecla = e.key.toLowerCase();

      if (tecla === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        irPara(Math.min(sel + 1, linhas.length - 1));
      } else if (tecla === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        irPara(Math.max(sel - 1, 0));
      } else if (q && (tecla === "v" || tecla === "f" || tecla === "p")) {
        e.preventDefault();
        marcar(q.id, tecla.toUpperCase() as Veredito);
        // Marcar e seguir: a próxima questão é quase sempre o próximo passo, e
        // quem quiser justificar aperta Enter antes de andar.
        irPara(Math.min(sel + 1, linhas.length - 1));
      } else if (e.key === "Enter" && q) {
        e.preventDefault();
        refNota.current?.focus();
      }
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [linhas, sel, marcar, irPara]);

  // O progresso é sempre sobre o banco inteiro, e não sobre o filtro: um
  // denominador que muda conforme a lente não mede coisa nenhuma.
  const revisadas = useMemo(
    () => BANCO.filter((q) => revisoes[q.id]?.veredito).length,
    [revisoes],
  );
  const achados = useMemo(() => {
    let divergencias = 0;
    let anotadas = 0;
    for (const q of BANCO) {
      const r = revisoes[q.id];
      if (!r || !pendente(q, r)) continue;
      if (divergente(q, r)) divergencias++;
      if (r.nota.trim()) anotadas++;
    }
    return { divergencias, anotadas };
  }, [revisoes]);

  /**
   * Achados que o repositório já resolveu e que ainda pesam na tela.
   *
   * Recalculado a cada mudança nas revisões porque é o rótulo do botão: assim
   * que ele age, a contagem cai a zero e ele some sozinho.
   */
  const triadosPendentes = useMemo(
    () => achadosTriados(BANCO, revisoes, IDS_TRIADOS),
    [revisoes],
  );

  function baixar() {
    descarregar();
    const dados = montarExportacao(
      BANCO,
      revisoes,
      trechos,
      POR_OCR,
      new Date().toISOString(),
    );
    const blob = new Blob([JSON.stringify(dados, null, 1)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `conferencia-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMensagem(
      `${dados.itens.length} ${dados.itens.length === 1 ? "achado" : "achados"} em ${dados.resumo.revisadas} questões revisadas.`,
    );
  }

  /**
   * Recebe a revisão feita em outra máquina.
   *
   * Mescla em vez de substituir, e a diferença aparece justamente no caso que a
   * importação existe para atender: quem revisa nos dois computadores tem
   * trabalho dos dois lados, e importar não pode ser escolher um. A regra inteira
   * está em `mesclarRevisoes`; aqui só se conta ao usuário o que ela mexeu, que é
   * o que substitui a confirmação que esta tela não dá.
   */
  async function importar(arquivo: File) {
    try {
      const recuperadas = revisoesDoArquivo(JSON.parse(await arquivo.text()));
      if (!recuperadas) {
        setMensagem("Arquivo não reconhecido — exporte pela própria tela.");
        return;
      }
      const m = mesclarRevisoes(revisoes, recuperadas);
      substituir(m.revisoes);

      if (!m.novas && !m.atualizadas) {
        setMensagem("Nada novo: o que veio no arquivo já estava aqui.");
        return;
      }
      const partes: string[] = [];
      if (m.novas) {
        partes.push(
          `${m.novas} ${m.novas === 1 ? "revisão nova" : "revisões novas"}`,
        );
      }
      if (m.atualizadas) {
        partes.push(`${m.atualizadas} atualizada${m.atualizadas === 1 ? "" : "s"}`);
      }
      if (m.mantidas) {
        partes.push(`${m.mantidas} mantida${m.mantidas === 1 ? "" : "s"} daqui`);
      }
      setMensagem(partes.join(" · ") + ".");
    } catch {
      setMensagem("Arquivo não reconhecido — exporte pela própria tela.");
    }
  }

  const caminho = atual ? caminhoPdf(atual.arquivo_origem) : null;

  if (!carregado) {
    return <p className="p-8 text-sm text-slate-500">Carregando revisão…</p>;
  }

  return (
    // `fixed inset-0` porque as duas colunas precisam de uma altura *definida*
    // para rolarem por dentro. O `<body>` do layout é `min-h-full`, e mínimo não
    // é altura: sob ele o `min-h-0 flex-1` não resolve nada, as 903 questões
    // esticam o documento para 82.000 px e quem rola é a página inteira — o
    // cabeçalho com o progresso e os filtros sai de vista no primeiro
    // `scrollIntoView`, que é justamente o que a tela faz a cada questão.
    // Cobrir o rodapé do layout é o preço, e aqui ele não faz falta.
    <div className="bg-background fixed inset-0 z-10 flex flex-col">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-200 px-4 py-2 text-sm dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div
            className="h-2 w-32 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
            role="progressbar"
            aria-valuenow={revisadas}
            aria-valuemax={BANCO.length}
          >
            <div
              className="h-full bg-sky-600"
              style={{ width: `${(revisadas / BANCO.length) * 100}%` }}
            />
          </div>
          <span className="tabular-nums">
            {revisadas}/{BANCO.length}
          </span>
        </div>

        <span className="text-xs text-slate-500 dark:text-slate-400">
          {achados.divergencias} divergências · {achados.anotadas} com nota
        </span>

        {triadosPendentes.length > 0 && (
          <button
            onClick={() => {
              darPorVistas(triadosPendentes);
              setMensagem(
                `${triadosPendentes.length} ${triadosPendentes.length === 1 ? "achado já triado saiu" : "achados já triados saíram"} da pendência. Os vereditos continuam gravados.`,
              );
            }}
            title="Marca como lidos os achados que já têm decisão em scripts/conferencia_triado.json. O veredito e a nota continuam onde estão."
            className="rounded-lg border border-emerald-600 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950"
          >
            Dar {triadosPendentes.length} triadas por vistas
          </button>
        )}

        <select
          value={arquivoFiltro}
          onChange={(e) => setArquivoFiltro(e.target.value)}
          className="max-w-48 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="">todos os arquivos</option>
          {capitulos.map((c) => (
            <option key={c.arquivo} value={c.arquivo}>
              {c.arquivo} ({c.questoes.length})
            </option>
          ))}
        </select>

        <select
          value={temaFiltro}
          onChange={(e) => setTemaFiltro(e.target.value as Tema | "")}
          className="max-w-40 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="">todos os temas</option>
          {TEMAS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <select
          value={nivelFiltro}
          onChange={(e) => setNivelFiltro(e.target.value as Nivel | "")}
          className="max-w-48 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="">todas as classes</option>
          <option value="B">valem para C, B e A</option>
          <option value="A">só o acréscimo da Classe A</option>
        </select>

        <div className="flex gap-1">
          {FILTROS.map((f) => (
            <button
              key={f.chave}
              onClick={() => setFiltro(f.chave)}
              className={`rounded-lg px-2 py-1 text-xs ${
                filtro === f.chave
                  ? "bg-sky-600 text-white"
                  : "border border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              }`}
            >
              {f.rotulo}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <input
            type="checkbox"
            checked={modoCego}
            onChange={(e) => setModoCego(e.target.checked)}
          />
          modo cego
        </label>

        <div className="ml-auto flex items-center gap-3">
          {mensagem && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {mensagem}
            </span>
          )}
          {conferencia.storageRecusou && (
            <span className="text-xs text-rose-700 dark:text-rose-400">
              O navegador recusou gravar — baixe a revisão agora.
            </span>
          )}
          <button
            onClick={() => arquivoRef.current?.click()}
            title="Recebe um arquivo baixado aqui ou em outro computador. Nada é apagado: o que existe só neste navegador continua, e o arquivo manda no que os dois têm."
            className="text-xs text-slate-500 underline-offset-4 hover:underline dark:text-slate-400"
          >
            Importar
          </button>
          <input
            ref={arquivoRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importar(f);
              e.target.value = "";
            }}
          />
          <button
            onClick={baixar}
            title="Baixa os achados para virarem conserto, e junto a revisão inteira — é este arquivo que se leva para continuar em outro computador."
            className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700"
          >
            Baixar revisão
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div ref={refLista} className="min-h-0 overflow-auto px-4 py-3">
          {linhas.length === 0 ? (
            <p className="mt-8 text-center text-sm text-slate-500">
              Nenhuma questão neste filtro.
            </p>
          ) : (
            <ul className="space-y-2">
              {linhas.map(({ q, trocouArquivo, trocouPagina }, i) => {
                return (
                  <li key={q.id} data-indice={i}>
                    {trocouArquivo && (
                      <h2 className="mt-4 mb-1 flex items-center gap-2 text-sm font-semibold">
                        <span className="min-w-0 truncate">
                          {q.arquivo_origem}
                        </span>
                        {POR_OCR.has(q.arquivo_origem) && (
                          <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                            OCR de visão
                          </span>
                        )}
                      </h2>
                    )}
                    {trocouArquivo && POR_OCR.has(q.arquivo_origem) && (
                      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                        Sem camada de texto: toda citação abaixo é a leitura do
                        modelo, e não os bytes do PDF. Se uma delas não bater
                        com a página, o conserto é uma entrada em{" "}
                        <code>scripts/erratas_ocr.json</code>.
                      </p>
                    )}
                    {trocouPagina && (
                      <h3 className="mt-3 mb-1 text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
                        p. {q.pagina}
                      </h3>
                    )}
                    <ItemConferencia
                      questao={q}
                      revisao={revisoes[q.id]}
                      triagem={TRIAGENS[q.id]}
                      trecho={q.trecho_id ? trechos[q.trecho_id] : undefined}
                      selecionado={i === sel}
                      modoCego={modoCego}
                      onSelecionar={() => setSel(i)}
                      onMarcar={(v) => marcar(q.id, v)}
                      onAnotar={(nota) => anotar(q.id, nota)}
                      onDescarregar={descarregar}
                      refNota={refNota}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="hidden min-h-0 border-l border-slate-200 lg:block dark:border-slate-800">
          {atual && caminho ? (
            <LeitorPdfPainel
              key={caminho}
              caminho={caminho}
              nomeExibicao={atual.arquivo_origem}
              pagina={atual.pagina}
              passagem={passagem}
              porOcr={POR_OCR.has(atual.arquivo_origem)}
            />
          ) : (
            <p className="p-6 text-center text-sm text-slate-500">
              Sem PDF publicado para esta questão.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
