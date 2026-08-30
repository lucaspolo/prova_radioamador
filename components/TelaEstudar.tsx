"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import mapa from "@/lib/mapa-pdfs.json";
import {
  CLASSES,
  CLASSE_PADRAO,
  FORMATO,
  ROTULO_CURTO,
} from "@/lib/constantes";
import {
  EMENTA,
  FONTE_EMENTA,
  blocosDaClasse,
  linkDoAssunto,
  questoesDoTopico,
  secoesDoTopico,
  type BlocoEmenta,
  type TopicoEmenta,
} from "@/lib/ementa";
import { caminhoPdf } from "@/lib/pdfs";
import { RESUMO_ARQUIVO, ROTULO_ARQUIVO, type Secao } from "@/lib/secoes";
import { gravarPreferencias, lerPreferencias } from "@/lib/preferencias";
import type { Classe, Tema } from "@/lib/tipos";
import BotaoConsultarMaterial from "./BotaoConsultarMaterial";
import MaterialOffline from "./MaterialOffline";

/**
 * O material de estudo: a ementa oficial, o caminho até cada trecho do PDF que
 * a cobre, e a bateria de cada assunto.
 *
 * É rota de verdade (`/estudar`), e não uma etapa da máquina de estados de
 * `app/page.tsx` como as outras telas. O motivo é o uso: isto se lê, se deixa
 * aberto e se manda para o colega do radioclube — tudo coisa que pede um
 * endereço. Custa quatro linhas em `scripts/gerar_sw.mjs` (a rota precisa de
 * casca própria no pré-cache, como `/conferencia`), e paga.
 *
 * Sai de `/` e volta para `/`: o menu do app só aparece fora de bateria e fora
 * de resultado, então navegar para cá nunca descarta simulado em andamento.
 */
export default function TelaEstudar() {
  const [classe, setClasse] = useState<Classe>(CLASSE_PADRAO);

  useEffect(() => {
    // Mesmo padrão de hidratação do resto do app: a classe preferida define o
    // que a ementa cobra, e o storage só existe no cliente.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClasse(lerPreferencias().classe);
  }, []);

  function escolherClasse(nova: Classe) {
    setClasse(nova);
    // Mescla por cima do storage atual, e não do estado local: tema e escala
    // pertencem ao painel de preferências, e gravar o objeto daqui apagaria
    // uma escolha feita lá nesta mesma sessão.
    gravarPreferencias({ ...lerPreferencias(), classe: nova });
  }

  const blocos = blocosDaClasse(classe);

  return (
    <main
      id="conteudo"
      className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12"
    >
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Material de estudo
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Os documentos oficiais da Anatel e a ementa que o exame cobra deles.
          </p>
        </div>
        <Link
          href="/"
          className="shrink-0 rounded-xl border-2 border-slate-300 px-3 py-2 text-sm font-medium transition hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500"
        >
          Simulados
        </Link>
      </header>

      <div className="space-y-8">
        {/* O material antes da ementa: quem chega aqui quase sempre quer o PDF
            — para ler no ônibus, para levar no celular, para mandar ao colega —
            e não a lista do programa. Deixá-lo no rodapé obrigava a rolar 36
            tópicos até o download, e escondia justamente o botão que garante o
            uso offline. A ementa continua logo abaixo, e é ela que diz o que
            procurar dentro desses arquivos. */}
        <MaterialOficial />

        {/* A fonte antes do conteúdo, e não num rodapé: o valor de tudo que vem
            abaixo é ser o texto da Anatel, não o nosso resumo dele. */}
        <section className="rounded-xl border border-borda bg-superficie p-4">
          <h2 className="font-semibold">De onde isto vem</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            O conteúdo programático é o do{" "}
            <strong className="font-medium text-slate-700 dark:text-slate-200">
              {FONTE_EMENTA.referencia}
            </strong>
            , transcrito palavra por palavra — nada aqui é resumo nosso. Cada
            item aponta o trecho do material que o explica.
          </p>
          <BotaoConsultarMaterial
            arquivoOrigem={FONTE_EMENTA.arquivo}
            pagina={FONTE_EMENTA.pagina}
            origem="documento"
            rotulo="Ler a ementa no Ato"
          />
        </section>

        <SeletorClasse classe={classe} onEscolher={escolherClasse} />

        <ListaDeBlocos blocos={blocos} classe={classe} />

        {/* O fim da leitura tem de ter para onde ir. Sem isto a página é um
            documento sem saída, e quem terminou de ler volta ao navegador. */}
        <section className="rounded-2xl border-2 border-slate-900 p-5 dark:border-slate-100">
          <h2 className="text-lg font-bold">Agora teste seus conhecimentos</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Ler cobre o programa; responder mostra o que ficou. A prova é de
            certo ou errado, uma matéria por vez, no tempo e no mínimo de
            acertos da Classe {classe}: {FORMATO[classe].questoes} questões,
            mínimo {FORMATO[classe].minimo}, {FORMATO[classe].minutos} minutos.
          </p>
          <Link
            href="/"
            className="mt-4 block w-full rounded-xl bg-slate-900 px-6 py-4 text-center font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
          >
            Começar uma bateria
          </Link>
        </section>
      </div>
    </main>
  );
}

function SeletorClasse({
  classe,
  onEscolher,
}: {
  classe: Classe;
  onEscolher: (c: Classe) => void;
}) {
  return (
    <section>
      <h2 className="rotulo-secao mb-2">
        Classe
      </h2>
      <div className="flex gap-2">
        {CLASSES.map((c) => (
          <button
            key={c}
            onClick={() => onEscolher(c)}
            aria-pressed={classe === c}
            className={`flex-1 rounded-xl border-2 px-3 py-3 transition ${
              classe === c
                ? "border-slate-900 bg-rebaixado font-semibold dark:border-slate-100"
                : "border-borda-controle hover:border-slate-500 dark:hover:border-slate-400"
            }`}
          >
            <div className="text-base font-bold">Classe {c}</div>
            <div className="mt-0.5 text-xs opacity-70">
              {FORMATO[c].questoes} questões · mín. {FORMATO[c].minimo}
            </div>
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500 italic dark:text-slate-400">
        Só Eletrônica muda entre as classes, e de forma cumulativa: a B é toda a
        C mais dez tópicos, e a A é toda a B mais quatro. Legislação e Técnica e
        Ética têm uma lista só para as três.
      </p>
    </section>
  );
}

/**
 * Os blocos agrupados por matéria.
 *
 * O cabeçalho do Ato só aparece quando a matéria tem mais de um bloco — o que
 * na prática quer dizer Eletrônica, a única escalonada por classe. Em Técnica e
 * Ética ele repetiria o nome da matéria logo abaixo dela; nas três de
 * Eletrônica é o que distingue o programa da C, o da B e o da A.
 */
function ListaDeBlocos({
  blocos,
  classe,
}: {
  blocos: BlocoEmenta[];
  classe: Classe;
}) {
  const porTema = new Map<Tema, BlocoEmenta[]>();
  for (const b of blocos) {
    const lista = porTema.get(b.tema);
    if (lista) lista.push(b);
    else porTema.set(b.tema, [b]);
  }

  return (
    <>
      {[...porTema.entries()].map(([tema, doTema]) => (
        <section key={tema}>
          <h2 className="rotulo-secao mb-3">
            {ROTULO_CURTO[tema]}
          </h2>
          <div className="space-y-5">
            {doTema.map((bloco) => (
              <Bloco
                key={bloco.titulo}
                bloco={bloco}
                classe={classe}
                mostrarTitulo={doTema.length > 1}
              />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function Bloco({
  bloco,
  classe,
  mostrarTitulo,
}: {
  bloco: BlocoEmenta;
  classe: Classe;
  mostrarTitulo: boolean;
}) {
  return (
    <div>
      {/* Rótulo, e não cabeçalho: a seção é a matéria, e um <h3> aqui
          empurraria os títulos dos tópicos para <h4> só nos blocos que o
          mostram — a hierarquia mudaria de matéria para matéria. */}
      {mostrarTitulo && (
        <p className="mb-2 text-xs font-medium tracking-wide text-slate-400 dark:text-slate-500">
          {bloco.titulo}
        </p>
      )}

      {bloco.cumulativo && (
        <p className="mb-3 rounded-lg border border-dashed border-borda px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
          {bloco.cumulativo}
        </p>
      )}

      <ul className="space-y-3">
        {bloco.topicos.map((t) => (
          <li key={t.id}>
            <Topico topico={t} classe={classe} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Topico({ topico, classe }: { topico: TopicoEmenta; classe: Classe }) {
  const secoes = secoesDoTopico(topico);
  const quantas = questoesDoTopico(topico, classe).length;

  return (
    <article className="rounded-xl border border-borda bg-superficie p-4">
      {topico.titulo && <h3 className="font-semibold">{topico.titulo}</h3>}
      <p
        className={`text-sm text-slate-600 dark:text-slate-300 ${
          topico.titulo ? "mt-1" : ""
        }`}
      >
        {topico.texto}
      </p>

      <OndeEstudar secoes={secoes} />

      <div className="mt-3">
        {quantas > 0 ? (
          <Link
            href={linkDoAssunto(topico)}
            className="inline-block rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white"
          >
            Treinar
            <span className="ml-1.5 font-normal opacity-70">
              {quantas} {quantas === 1 ? "questão" : "questões"}
            </span>
          </Link>
        ) : (
          // A ementa cobra o item mesmo que o banco ainda não o cubra, e é
          // melhor dizer isso do que sumir com o tópico: o buraco é
          // justamente o que quem estuda precisa enxergar.
          <p className="text-xs text-slate-500 italic dark:text-slate-400">
            O banco ainda não tem questões deste item — estude pelo material.
          </p>
        )}
      </div>
    </article>
  );
}

/**
 * Os trechos do material que cobrem o tópico, agrupados por documento.
 *
 * Agrupados porque o título sozinho é ambíguo: "Indicativos de chamada" existe
 * na Cartilha e no Ato 3448, e um botão que não diz de qual documento manda a
 * pessoa para o texto errado. E recolhidos a partir de cinco trechos, porque
 * "Requisitos Técnicos e Operacionais" sozinho referencia quinze — uma parede
 * de botões que enterraria o item seguinte.
 */
function OndeEstudar({ secoes }: { secoes: Secao[] }) {
  if (secoes.length === 0) return null;

  const porArquivo = new Map<string, Secao[]>();
  for (const s of secoes) {
    const lista = porArquivo.get(s.arquivo);
    if (lista) lista.push(s);
    else porArquivo.set(s.arquivo, [s]);
  }

  const lista = (
    <div className="space-y-2">
      {[...porArquivo.entries()].map(([arquivo, doArquivo]) => (
        <div key={arquivo}>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {ROTULO_ARQUIVO[arquivo] ?? arquivo}
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {doArquivo.map((s) => (
              <BotaoConsultarMaterial
                key={s.titulo}
                arquivoOrigem={s.arquivo}
                pagina={s.paginaInicio}
                origem="documento"
                rotulo={s.titulo}
                compacto
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  if (secoes.length <= 4) return <div className="mt-3">{lista}</div>;

  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-xs font-medium text-slate-500 dark:text-slate-400">
        Onde estudar — {secoes.length} trechos do material
      </summary>
      <div className="mt-2">{lista}</div>
    </details>
  );
}

/**
 * Os documentos inteiros, para quem quer ler de ponta a ponta ou levar o
 * arquivo. O pré-download offline mora aqui pelo mesmo motivo: é aqui que o
 * material está — e por isso a seção abre a página, em vez de fechá-la.
 */
function MaterialOficial() {
  // Na ordem de ROTULO_ARQUIVO, que é curada — a Cartilha primeiro, os atos
  // depois —, e não na do mapa, que é a alfabética do sistema de arquivos e
  // abriria a lista pelo ato de indicativos especiais. O `concat` é a rede:
  // PDF publicado sem rótulo declarado aparece pelo nome, em vez de sumir.
  const arquivos = Object.keys(ROTULO_ARQUIVO).concat(
    Object.keys(mapa).filter((a) => !(a in ROTULO_ARQUIVO)),
  );

  return (
    <section className="space-y-3">
      <div>
        <h2 className="rotulo-secao">
          Material oficial
        </h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Os documentos publicados pela Anatel, como saíram dela. Todo o app —
          questões, tabelas e a ementa abaixo — sai destes {arquivos.length}{" "}
          arquivos.
        </p>
      </div>

      <ul className="space-y-2">
        {arquivos.map((arquivo) => {
          const caminho = caminhoPdf(arquivo);
          if (!caminho) return null;
          return (
            <li
              key={arquivo}
              className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 rounded-xl border border-borda bg-superficie px-4 py-3"
            >
              <div className="min-w-0 flex-1 basis-64">
                <div className="text-sm font-medium">
                  {ROTULO_ARQUIVO[arquivo] ?? arquivo}
                </div>
                {RESUMO_ARQUIVO[arquivo] && (
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {RESUMO_ARQUIVO[arquivo]}
                  </p>
                )}
              </div>
              <span className="flex shrink-0 items-center gap-2">
                <BotaoConsultarMaterial
                  arquivoOrigem={arquivo}
                  pagina={1}
                  origem="documento"
                  rotulo="Abrir"
                  compacto
                />
                <a
                  href={caminho}
                  download
                  className="rounded-lg border border-current/30 px-2.5 py-1 text-xs font-medium transition hover:bg-current/10"
                >
                  Baixar
                </a>
              </span>
            </li>
          );
        })}
      </ul>

      <MaterialOffline />
    </section>
  );
}

/**
 * Export nomeado para `testes/render.test.tsx`, que renderiza sem DOM: a lista
 * completa de tópicos, com a ementa das três classes, não depende de estado e
 * é o que mais vale ter sob cobertura aqui.
 */
export function TodosOsBlocos() {
  return <ListaDeBlocos blocos={EMENTA} classe="A" />;
}
