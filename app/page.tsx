"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TelaInicio from "@/components/TelaInicio";
import TelaSimulado from "@/components/TelaSimulado";
import TelaProvaCega from "@/components/TelaProvaCega";
import TelaResultado from "@/components/TelaResultado";
import TelaIntervalo from "@/components/TelaIntervalo";
import TelaResultadoProva, {
  type MateriaConcluida,
} from "@/components/TelaResultadoProva";
import AvisoAtualizacao from "@/components/AvisoAtualizacao";
import MenuPrincipal from "@/components/MenuPrincipal";
import TelaAssuntos from "@/components/TelaAssuntos";
import ResumoDesempenho from "@/components/ResumoDesempenho";
import TelaDesempenho from "@/components/TelaDesempenho";
import TelaFerramentas from "@/components/TelaFerramentas";
import TelaDesafio from "@/components/TelaDesafio";
import TelaImpressao from "@/components/TelaImpressao";
import { useHistorico } from "@/hooks/useHistorico";
import {
  questoesParaRevisao,
  sortearDesafio,
  sortearSimulado,
} from "@/lib/questoes";
import {
  bateriasDoDesafio,
  lerDesafio,
  linkDoDesafio,
  type Desafio,
} from "@/lib/desafio";
import { lerAssunto, questoesDoTopico } from "@/lib/ementa";
import { lerPreferencias } from "@/lib/preferencias";
import { codigoDaBateria } from "@/lib/semente";
import { CLASSE_PADRAO, TEMAS, tempoDaBateria } from "@/lib/constantes";
import type {
  Classe,
  MotivoFim,
  Questao,
  Regime,
  Resposta,
  Tema,
} from "@/lib/tipos";

type Etapa =
  | "inicio"
  | "assuntos"
  | "desafio"
  | "impressao"
  | "simulado"
  | "resultado"
  | "intervalo"
  | "resultadoProva"
  | "ferramentas"
  | "desempenho";

/**
 * O que está sendo jogado agora. "avulso" é a bateria escolhida na tela
 * inicial; "revisao" recruta só os erros em aberto e não recebe veredito;
 * "assunto" é o estudo dirigido por uma seção do material, também sem
 * veredito; "desafio" é a bateria de um link, igual à avulsa no registro e no
 * veredito, mas que rende link e código no resultado.
 *
 * Quantas matérias a bateria tem é assunto do `Plano`, não do modo: uma
 * matéria ou as três seguem o mesmo caminho, e a antiga "prova completa" é
 * simplesmente um plano com os três temas no tamanho oficial.
 */
type Modo = "avulso" | "revisao" | "assunto" | "desafio";

/**
 * A bateria combinada: uma matéria por vez, na ordem, cada uma com seu
 * cronômetro e seu mínimo. Nunca uma bateria misturando matérias — a Anatel
 * aplica exames separados, e um veredito sobre a mistura aprovaria quem
 * compensasse matéria fraca com matéria forte.
 */
interface Plano {
  temas: Tema[];
  /** Questões POR matéria. */
  quantidade: number;
  classe: Classe;
  cronometrar: boolean;
  soIneditas: boolean;
  /** Presente quando a bateria veio de um link; muda o sorteio para a semente. */
  desafio: Desafio | null;
}

/**
 * O app é uma máquina de estados numa única rota, e não várias.
 *
 * A alternativa seria passar o estado por query string, mas num export
 * estático isso exigiria `useSearchParams` com Suspense, e sair da página
 * perderia o simulado em andamento. Manter o estado aqui é mais simples e
 * evita perder progresso com o botão voltar.
 *
 * `ferramentas` e `desempenho` são telas cheias, e ainda assim etapas e não
 * rotas: `scripts/gerar_sw.mjs` responde toda navegação com a casca de `/`,
 * então um deep link para elas sem rede renderizaria a home.
 */
export default function Home() {
  const [etapa, setEtapa] = useState<Etapa>("inicio");
  const [modo, setModo] = useState<Modo>("avulso");
  const [regime, setRegime] = useState<Regime>("treino");
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [respostas, setRespostas] = useState<Resposta[]>([]);
  const [temaAtual, setTemaAtual] = useState<Tema>(TEMAS[0]);
  const [classeAtual, setClasseAtual] = useState<Classe>(CLASSE_PADRAO);
  const [tempoSegundos, setTempoSegundos] = useState<number | null>(null);
  const [materiasProva, setMateriasProva] = useState<MateriaConcluida[]>([]);
  const [plano, setPlano] = useState<Plano | null>(null);
  const [motivoFim, setMotivoFim] = useState<MotivoFim>("manual");
  const [desafio, setDesafio] = useState<Desafio | null>(null);
  const [linkDesafio, setLinkDesafio] = useState<string | null>(null);
  const [impressao, setImpressao] = useState<{
    desafio: Desafio;
    baterias: { tema: Tema; questoes: Questao[] }[];
    link: string;
  } | null>(null);
  const { historico, carregado, gravacaoRecusada, registrar, importar, limpar } =
    useHistorico();

  /**
   * O que chega pela query string: um desafio, ou um assunto vindo de
   * `/estudar`.
   *
   * Lida com `URLSearchParams` num efeito — e não com `useSearchParams`, que
   * num export estático exigiria envolver a página em Suspense (ver o
   * comentário acima). Efeito também é o lugar certo por outro motivo:
   * `window` não existe na geração do HTML, e ler ali divergiria do que o
   * navegador renderiza.
   *
   * A URL não é limpa depois: recarregar o link tem de reoferecer a mesma
   * coisa, que é o que se espera de um endereço.
   */
  useEffect(() => {
    const d = lerDesafio(window.location.search);
    if (d) {
      const base = `${window.location.origin}${window.location.pathname}`;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDesafio(d);
      setLinkDesafio(linkDoDesafio(d, base));
      setEtapa("desafio");
      return;
    }

    // O desafio ganha se os dois vierem no mesmo link: ele é bateria combinada
    // com outras pessoas, e trocá-la por um estudo solitário quebraria a
    // comparação. Tópico desconhecido, ou sem questão elegível na classe
    // preferida, fica no início em silêncio — `lerAssunto` já é desconfiado, e
    // uma tela de erro para um link velho não ajudaria ninguém.
    const t = lerAssunto(window.location.search);
    if (!t) return;
    const doTopico = questoesDoTopico(t, lerPreferencias().classe);
    if (doTopico.length > 0) iniciarAssunto(doTopico);
  }, []);

  /**
   * Toda troca de tela recomeça no topo.
   *
   * A rolagem é da janela, e trocar de etapa só troca o conteúdo dentro dela —
   * então a posição da tela anterior fica. Como o botão que leva à etapa
   * seguinte costuma estar embaixo (o "Iniciar" da home vem depois de toda a
   * configuração; o "Imprimir em branco" fica no rodapé), a tela nova abria
   * pelo meio: a prova cega começava com a questão e o cronômetro acima da
   * borda superior, e o que se via era a folha de respostas.
   *
   * Sem `behavior: "smooth"` de propósito: aqui não é navegação dentro da
   * página, é troca de tela — animar seria assistir a página anterior passar.
   */
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [etapa]);

  /**
   * Prepara a matéria de índice `i` do plano e entra na bateria.
   *
   * Recebe o plano por parâmetro, e não do estado: quem chama acabou de
   * montá-lo, e `setPlano` só teria efeito no render seguinte.
   */
  function iniciarMateria(p: Plano, i: number) {
    const tema = p.temas[i];
    setQuestoes(
      p.desafio
        ? sortearDesafio(tema, p.quantidade, p.classe, p.desafio.semente)
        : sortearSimulado(tema, p.quantidade, historico, p.classe, {
            soIneditas: p.soIneditas,
          }),
    );
    setRespostas([]);
    setTemaAtual(tema);
    setTempoSegundos(
      p.cronometrar ? tempoDaBateria(p.classe, p.quantidade) : null,
    );
    setEtapa("simulado");
  }

  function iniciar(
    temas: Tema[],
    quantidade: number,
    classe: Classe,
    cronometrar: boolean,
    cego: boolean,
    soIneditas: boolean,
  ) {
    // O histórico entra no sorteio: o que você errou volta antes, o que já
    // domina rareia. Sem histórico, o sorteio é uniforme. A classe define o
    // acervo elegível — o acréscimo técnico da Classe A não cai em B nem em C.
    //
    // Com mais de uma matéria, são exames em sequência — nunca uma bateria
    // misturada: a Anatel aplica três provas separadas, e um veredito sobre a
    // mistura aprovaria quem compensasse matéria fraca com matéria forte.
    const p: Plano = {
      temas,
      quantidade,
      classe,
      cronometrar,
      soIneditas,
      desafio: null,
    };
    setModo("avulso");
    setRegime(cego ? "cego" : "treino");
    setClasseAtual(classe);
    setMateriasProva([]);
    setPlano(p);
    iniciarMateria(p, 0);
  }

  function iniciarAssunto(sorteadas: Questao[]) {
    // Estudo dirigido: como a revisão — treino, sem cronômetro, sem veredito.
    // A bateria é a seção inteira; quem escolheu o assunto quer esgotá-lo.
    setModo("assunto");
    setRegime("treino");
    setPlano(null);
    setQuestoes(sorteadas);
    setRespostas([]);
    setTempoSegundos(null);
    setEtapa("simulado");
  }

  function iniciarDesafio(d: Desafio) {
    // Cego e cronometrado por construção: é o que torna os resultados
    // comparáveis. Registra no histórico como qualquer bateria da matéria.
    const p: Plano = {
      temas: d.temas,
      quantidade: d.quantidade,
      classe: d.classe,
      cronometrar: true,
      soIneditas: false,
      desafio: d,
    };
    setModo("desafio");
    setRegime("cego");
    setClasseAtual(d.classe);
    setMateriasProva([]);
    setPlano(p);
    iniciarMateria(p, 0);
  }

  /**
   * A bateria em papel, sempre a partir de uma semente: assim a folha impressa
   * e o link são a MESMA prova, e quem faltou à aula responde pelo celular às
   * questões que os colegas responderam na caneta.
   */
  function imprimirBateria(d: Desafio) {
    const base = `${window.location.origin}${window.location.pathname}`;
    setImpressao({
      desafio: d,
      baterias: bateriasDoDesafio(d),
      link: linkDoDesafio(d, base),
    });
    setEtapa("impressao");
  }

  function iniciarRevisao(classe: Classe) {
    // Revisão é estudo dirigido: sem cronômetro, sem veredito e sempre com o
    // gabarito na hora — esconder a resposta aqui seria esconder o estudo.
    setModo("revisao");
    setRegime("treino");
    setPlano(null);
    setQuestoes(questoesParaRevisao(historico, classe));
    setRespostas([]);
    setClasseAtual(classe);
    setTempoSegundos(null);
    setEtapa("simulado");
  }

  function concluir(finais: Resposta[], motivo: MotivoFim) {
    setRespostas(finais);
    setMotivoFim(motivo);
    // Só entra no histórico a bateria terminada; abandonar não conta. A
    // revisão e o estudo por assunto também registram: acertar ali tira a
    // questão da lista de erros e alimenta o desempenho por questão.
    registrar(
      modo === "revisao" || modo === "assunto" ? modo : temaAtual,
      finais,
      { classe: classeAtual },
    );

    // Revisão e assunto não têm plano: são uma bateria só, e acabou.
    if (!plano) {
      setEtapa("resultado");
      return;
    }
    const concluidas = [...materiasProva, { tema: temaAtual, respostas: finais }];
    setMateriasProva(concluidas);
    if (concluidas.length < plano.temas.length) {
      setEtapa("intervalo");
      return;
    }
    // Uma matéria fecha no resultado da bateria; várias, no consolidado, onde
    // cada matéria tem seu próprio veredito.
    setEtapa(plano.temas.length > 1 ? "resultadoProva" : "resultado");
  }

  return (
    <main
      id="conteudo"
      className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12"
    >
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Simulados · Radioamador
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Questões de certo ou errado no formato da prova da Anatel.
          </p>
          {/* O caminho para o material, no alto e sem caixa. Quem instala o app
              não desconfia que existe uma ementa oficial, e um item de menu não
              conta isso a ninguém — mas a home é sobre fazer a bateria de hoje,
              e um cartão aqui competiria com ela. Uma linha resolve.

              Só no início: durante a bateria seria cola, e das telas de
              resultado seria porta de mão única — sair descartaria o gabarito
              recém-conquistado, pela mesma razão que esconde o menu. */}
          {etapa === "inicio" && (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              A ementa oficial e os PDFs da Anatel estão no{" "}
              <Link
                href="/estudar"
                className="font-medium underline underline-offset-4 hover:text-slate-700 dark:hover:text-slate-200"
              >
                material de estudo ›
              </Link>
            </p>
          )}
        </div>
        {/* O menu não existe durante uma bateria nem depois dela: consulta
            rápida em prova cega é cola e em treino é distração, e a partir de
            uma tela de resultado seria porta de mão única — "Voltar ao início"
            das telas de consulta descarta o gabarito recém-conquistado. */}
        {(etapa === "inicio" ||
          etapa === "assuntos" ||
          etapa === "desempenho" ||
          etapa === "ferramentas") && (
          <MenuPrincipal
            atual={etapa === "assuntos" ? "inicio" : etapa}
            onInicio={() => setEtapa("inicio")}
            onDesempenho={() => setEtapa("desempenho")}
            onFerramentas={() => setEtapa("ferramentas")}
          />
        )}
      </header>

      {/* O convite de recarregar segue a mesma regra do menu: só fora de
          bateria e de resultado. Recarregar no meio descartaria a bateria; o
          componente em si nunca recarrega sozinho. */}
      {(etapa === "inicio" ||
        etapa === "assuntos" ||
        etapa === "desempenho" ||
        etapa === "ferramentas") && <AvisoAtualizacao />}

      {etapa === "inicio" && (
        <div className="space-y-8">
          <ResumoDesempenho
            historico={historico}
            carregado={carregado}
            onAbrir={() => setEtapa("desempenho")}
          />
          <TelaInicio
            historico={historico}
            onIniciar={iniciar}
            onRevisar={iniciarRevisao}
            onAssuntos={() => setEtapa("assuntos")}
            onImprimir={imprimirBateria}
          />
        </div>
      )}

      {etapa === "assuntos" && (
        <TelaAssuntos
          historico={historico}
          onEstudar={iniciarAssunto}
          onVoltar={() => setEtapa("inicio")}
        />
      )}

      {etapa === "desafio" && desafio && (
        <TelaDesafio
          desafio={desafio}
          onComecar={() => iniciarDesafio(desafio)}
          onIgnorar={() => setEtapa("inicio")}
        />
      )}

      {/* A `key` amarra a tela à bateria: as três matérias da prova completa
          têm o mesmo `tempoSegundos`, então sem ela um dia em que a etapa de
          intervalo saia do caminho o cronômetro herdaria o prazo da matéria
          anterior em vez de recomeçar. */}
      {etapa === "simulado" &&
        (regime === "cego" ? (
          <TelaProvaCega
            key={`${temaAtual}-${materiasProva.length}`}
            questoes={questoes}
            tempoSegundos={tempoSegundos}
            onConcluir={concluir}
            onSair={() => setEtapa("inicio")}
          />
        ) : (
          <TelaSimulado
            key={`${temaAtual}-${materiasProva.length}`}
            questoes={questoes}
            tempoSegundos={tempoSegundos}
            onConcluir={concluir}
            onSair={() => setEtapa("inicio")}
          />
        ))}

      {etapa === "resultado" && (
        <TelaResultado
          respostas={respostas}
          onReiniciar={() => setEtapa("inicio")}
          classe={classeAtual}
          modo={modo === "revisao" || modo === "assunto" ? modo : "prova"}
          cega={regime === "cego"}
          motivoFim={motivoFim}
          tema={
            modo === "revisao" || modo === "assunto" ? undefined : temaAtual
          }
          gravacaoRecusada={gravacaoRecusada}
          desafio={
            modo === "desafio" && desafio && linkDesafio
              ? {
                  semente: desafio.semente,
                  link: linkDesafio,
                  codigo: codigoDaBateria(questoes.map((q) => q.id)),
                }
              : undefined
          }
        />
      )}

      {etapa === "intervalo" && plano && (
        <TelaIntervalo
          classe={classeAtual}
          tema={temaAtual}
          respostas={respostas}
          quantidade={plano.quantidade}
          proximoTema={plano.temas[materiasProva.length]}
          cronometrado={plano.cronometrar}
          restantes={plano.temas.length - materiasProva.length}
          onProsseguir={() => iniciarMateria(plano, materiasProva.length)}
          onAbandonar={() => setEtapa("inicio")}
        />
      )}

      {etapa === "impressao" && impressao && (
        <TelaImpressao
          desafio={impressao.desafio}
          baterias={impressao.baterias}
          link={impressao.link}
          onVoltar={() => setEtapa("inicio")}
        />
      )}

      {etapa === "ferramentas" && (
        <TelaFerramentas onVoltar={() => setEtapa("inicio")} />
      )}

      {etapa === "desempenho" && (
        <TelaDesempenho
          historico={historico}
          carregado={carregado}
          onLimpar={limpar}
          onImportar={importar}
          onVoltar={() => setEtapa("inicio")}
        />
      )}

      {etapa === "resultadoProva" && (
        <TelaResultadoProva
          classe={classeAtual}
          materias={materiasProva}
          onReiniciar={() => setEtapa("inicio")}
          gravacaoRecusada={gravacaoRecusada}
        />
      )}
    </main>
  );
}
