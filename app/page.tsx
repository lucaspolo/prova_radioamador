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
import TelaAssuntoPouso from "@/components/TelaAssuntoPouso";
import TelaImpressao from "@/components/TelaImpressao";
import CartaoRetomar from "@/components/CartaoRetomar";
import DesafioPendente from "@/components/DesafioPendente";
import Antena from "@/components/Antena";
import Icone from "@/components/Icone";
import { useHistorico } from "@/hooks/useHistorico";
import { foiSaidaDaGuarda } from "@/hooks/useGuardaDeSaida";
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
import { lerAssunto, questoesDoTopico, type TopicoEmenta } from "@/lib/ementa";
import type { Escolhas } from "@/lib/bateria";
import { respostasDe } from "@/lib/bateria";
import {
  gravar as gravarEmCurso,
  limpar as limparEmCurso,
  ler as lerEmCurso,
  type Retomada,
} from "@/lib/bateria-em-curso";
import { lerPreferencias } from "@/lib/preferencias";
import { codigoDaBateria } from "@/lib/semente";
import {
  CLASSE_PADRAO,
  LOTE_REVISAO,
  TEMAS,
  tempoDaBateria,
} from "@/lib/constantes";
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
  | "assuntoPouso"
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
  /**
   * O instante em que o cronômetro acaba (epoch ms), espelhando o prazo do
   * `useCronometro`. Guardado aqui porque é isso que a bateria salva precisa:
   * segundos restantes só valem enquanto a aba está viva; o instante do fim
   * sobrevive a ela.
   */
  const [prazo, setPrazo] = useState<number | null>(null);
  /** A bateria interrompida que a home oferece retomar. */
  const [retomada, setRetomada] = useState<Retomada | null>(null);
  /** Folha, posição e marcações com que a tela de bateria monta. */
  const [inicial, setInicial] = useState<{
    escolhas: Escolhas;
    indice: number;
    marcadas: number[];
  } | null>(null);
  /** Assunto que chegou por link e ainda não começou — ver `assuntoPouso`. */
  const [pouso, setPouso] = useState<{
    topico: TopicoEmenta;
    questoes: Questao[];
  } | null>(null);
  const [impressao, setImpressao] = useState<{
    desafio: Desafio;
    baterias: { tema: Tema; questoes: Questao[] }[];
    link: string;
  } | null>(null);
  const {
    historico,
    carregado,
    gravacaoRecusada,
    registrar,
    importar,
    limpar,
  } = useHistorico();

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
    if (t) {
      const doTopico = questoesDoTopico(t, lerPreferencias().classe);
      if (doTopico.length > 0) {
        // Pousa antes de começar, como no desafio: o "Treinar" de `/estudar`
        // caía direto na questão 1 de 37 — sem dizer que seriam 37, e sem
        // volta ao material que não fosse "Abandonar".
        setPouso({ topico: t, questoes: doTopico });
        setEtapa("assuntoPouso");
        return;
      }
    }

    // Só depois dos links: quem abriu um endereço específico pediu aquilo, e
    // não a bateria de ontem. A retomada é oferecida, nunca imposta — cair
    // direto na bateria seria sequestrar a home de quem só queria começar
    // outra coisa.
    setRetomada(lerEmCurso());
  }, []);

  /**
   * Grava a bateria em andamento a cada resposta.
   *
   * As telas de bateria avisam a mudança; o contexto (matéria, classe, modo,
   * regime, prazo, plano e as matérias já concluídas) só existe aqui. Ids em
   * vez de questões: ver `lib/bateria-em-curso.ts`.
   */
  function registrarProgresso(
    escolhas: Escolhas,
    indice: number,
    marcadas: number[] = [],
  ) {
    gravarEmCurso({
      versao: 1,
      quando: new Date().toISOString(),
      modo,
      regime,
      tema: temaAtual,
      classe: classeAtual,
      ids: questoes.map((q) => q.id),
      escolhas,
      indice,
      marcadas,
      prazo,
      plano: plano
        ? {
            temas: plano.temas,
            quantidade: plano.quantidade,
            cronometrar: plano.cronometrar,
            soIneditas: plano.soIneditas,
            desafio: plano.desafio,
          }
        : null,
      materias: materiasProva.map((m) => ({
        tema: m.tema,
        ids: m.respostas.map((r) => r.questao.id),
        escolhas: m.respostas.map((r) => r.respondeu),
      })),
    });
  }

  /**
   * Volta ao início e apaga a bateria salva.
   *
   * Em revisão e estudo por assunto, o que já foi respondido é registrado
   * antes: são modos sem veredito de aprovação, então não há o que uma bateria
   * pela metade pudesse falsear — e a regra de "só a bateria concluída conta",
   * que protege o simulado, ali só servia para apagar o trabalho de quem
   * revisou sessenta erros e precisou parar. No simulado nada muda: meia prova
   * registrada distorceria a prontidão.
   */
  function abandonar(parcial: Resposta[] = []) {
    if ((modo === "revisao" || modo === "assunto") && parcial.length > 0) {
      registrar(modo, parcial, { classe: classeAtual });
    }
    limparEmCurso();
    setInicial(null);
    // Sair de um assunto devolve à lista de assuntos, e não à home: foi de lá
    // que se entrou, e é lá que está o próximo. A home fica a um toque no
    // "Voltar ao início" da própria lista.
    setEtapa(modo === "assunto" ? "assuntos" : "inicio");
  }

  /** Recompõe o estado da bateria salva e volta para dentro dela. */
  function retomar(r: Retomada) {
    const { bateria } = r;
    setModo(bateria.modo);
    setRegime(bateria.regime);
    setTemaAtual(bateria.tema);
    setClasseAtual(bateria.classe);
    setQuestoes(r.questoes);
    setRespostas([]);
    setTempoSegundos(r.restanteSegundos);
    setPrazo(bateria.prazo);
    setMateriasProva(
      r.materias.map((m) => ({
        tema: m.tema,
        respostas: respostasDe(m.questoes, m.escolhas),
      })),
    );
    setPlano(
      bateria.plano
        ? {
            temas: bateria.plano.temas,
            quantidade: bateria.plano.quantidade,
            classe: bateria.classe,
            cronometrar: bateria.plano.cronometrar,
            soIneditas: bateria.plano.soIneditas,
            desafio: bateria.plano.desafio,
          }
        : null,
    );
    setInicial({
      escolhas: bateria.escolhas,
      indice: bateria.indice,
      marcadas: bateria.marcadas,
    });
    setRetomada(null);
    setEtapa("simulado");
  }

  /**
   * As telas de consulta entram no histórico do navegador.
   *
   * Fora da bateria, voltar era sair do site: nenhuma etapa empurrava entrada,
   * então o gesto de voltar do Android — o caminho natural para a home — caía
   * em `about:blank`. Em Assuntos, Desempenho e Consulta rápida não há
   * progresso a perder, então aqui voltar simplesmente volta.
   *
   * A URL não muda (continua "/"): o service worker responde igual e nenhuma
   * rota nova precisa existir. É só um marcador de "onde eu estava".
   */
  function irPara(destino: Etapa) {
    window.history.pushState({ etapa: destino }, "");
    setEtapa(destino);
  }

  useEffect(() => {
    function aoVoltar(e: PopStateEvent) {
      // A bateria tem guarda própria (`useGuardaDeSaida`), que reempurra a
      // entrada e abre a confirmação de abandono. Se este ouvinte agisse
      // junto, o voltar sairia da bateria por trás da confirmação.
      if (etapa === "simulado") return;
      // A saída normal da bateria desfaz a entrada de guarda com um
      // `history.back()` programado; ele não é o gesto de voltar de ninguém.
      if (foiSaidaDaGuarda()) return;
      const alvo = (e.state as { etapa?: Etapa } | null)?.etapa;
      setEtapa(alvo && alvo !== "simulado" ? alvo : "inicio");
    }
    window.addEventListener("popstate", aoVoltar);
    return () => window.removeEventListener("popstate", aoVoltar);
  }, [etapa]);

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
    const segundos = p.cronometrar
      ? tempoDaBateria(p.classe, p.quantidade)
      : null;
    setTempoSegundos(segundos);
    // O mesmo instante que o `useCronometro` vai calcular ao montar: é ele que
    // permite retomar a prova com o tempo que de fato sobrou, e não com o que
    // sobrava quando a aba fechou.
    setPrazo(segundos === null ? null : Date.now() + segundos * 1000);
    setInicial(null);
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
    setPrazo(null);
    setInicial(null);
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
    // Um lote por vez: a revisão trazia os 91 erros em aberto de uma sentada
    // só, e o resultado agora convida a continuar enquanto sobrar erro.
    setQuestoes(questoesParaRevisao(historico, classe, LOTE_REVISAO));
    setRespostas([]);
    setClasseAtual(classe);
    setTempoSegundos(null);
    setPrazo(null);
    setInicial(null);
    setEtapa("simulado");
  }

  /**
   * Revisa só os erros da bateria que acabou de sair.
   *
   * Diferente de `iniciarRevisao`, que recruta TODOS os erros em aberto: aqui
   * o conjunto é o desta bateria, no momento em que a pessoa ainda lembra de
   * ter errado. É estudo, então segue as regras da revisão — treino, sem
   * cronômetro, sem veredito.
   */
  function revisarErrosDaBateria(erradas: Questao[]) {
    if (erradas.length === 0) return;
    setModo("revisao");
    setRegime("treino");
    setPlano(null);
    setMateriasProva([]);
    setQuestoes(erradas);
    setRespostas([]);
    setTempoSegundos(null);
    setPrazo(null);
    setInicial(null);
    setEtapa("simulado");
  }

  /**
   * Refaz a bateria com a mesma configuração — outro sorteio, mesma matéria,
   * mesmo tamanho, mesmo regime.
   *
   * Sem isto, repetir custava voltar à home e reescolher matéria e quantidade,
   * que retornam ao padrão. O plano é o que guarda a configuração; quando não
   * há (revisão e estudo por assunto), não há o que repetir de forma
   * significativa — o conjunto muda a cada acerto.
   */
  function refazerBateria() {
    if (!plano) return;
    setMateriasProva([]);
    iniciarMateria(plano, 0);
  }

  function concluir(finais: Resposta[], motivo: MotivoFim) {
    setRespostas(finais);
    setMotivoFim(motivo);
    setInicial(null);
    // A bateria concluída não é mais "em curso". Numa prova de várias
    // matérias, a etapa de intervalo grava a próxima assim que ela começa.
    limparEmCurso();
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
    const concluidas = [
      ...materiasProva,
      { tema: temaAtual, respostas: finais },
    ];
    setMateriasProva(concluidas);
    if (concluidas.length < plano.temas.length) {
      setEtapa("intervalo");
      return;
    }
    // Uma matéria fecha no resultado da bateria; várias, no consolidado, onde
    // cada matéria tem seu próprio veredito.
    setEtapa(plano.temas.length > 1 ? "resultadoProva" : "resultado");
  }

  /**
   * As telas em que o cabeçalho encolhe: durante a bateria e depois dela.
   *
   * O bloco de título com a tagline come cerca de 200 px no celular (o título
   * quebra em duas linhas a 390 px) — espaço que na bateria pertence à
   * questão e, no resultado, ao veredito. Fora da bateria ele fica: é ali que
   * apresenta o produto a quem chegou agora.
   */
  const emBateria =
    etapa === "simulado" ||
    etapa === "intervalo" ||
    etapa === "resultado" ||
    etapa === "resultadoProva";

  return (
    <main
      id="conteudo"
      className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12"
    >
      <header
        className={`flex items-start justify-between gap-4 ${
          emBateria ? "mb-4" : "mb-8"
        }`}
      >
        <div className="min-w-0">
          {/* A antena ao lado do título: é a marca do ícone instalado, e era o
              único desenho do produto que a interface não usava.

              `text-lg` no celular porque a 360 px o título quebrava em duas
              linhas e deixava "Radioamador" sozinho na segunda — três linhas
              de cabeçalho antes de qualquer coisa acionável. */}
          <h1
            className={`flex items-center gap-2 font-bold tracking-tight text-balance ${
              emBateria ? "text-lg" : "text-lg leading-tight sm:text-2xl"
            }`}
          >
            <Antena
              className={`shrink-0 ${emBateria ? "h-5 w-5" : "h-6 w-6 sm:h-7 sm:w-7"}`}
            />
            Simulados · Radioamador
          </h1>
          {!emBateria && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Certo ou errado, no formato da prova da Anatel.
            </p>
          )}
          {/* O caminho para o material, no alto e sem caixa. Quem instala o app
              não desconfia que existe uma ementa oficial, e um item de menu não
              conta isso a ninguém — mas a home é sobre fazer a bateria de hoje,
              e um cartão aqui competiria com ela. Uma linha resolve.

              Só no início: durante a bateria seria cola, e das telas de
              resultado seria porta de mão única — sair descartaria o gabarito
              recém-conquistado, pela mesma razão que esconde o menu. */}
          {etapa === "inicio" && (
            <p className="text-sm">
              {/* A frase inteira é o link. Antes, a explicação em volta dele
                  ("A ementa oficial e os PDFs da Anatel estão no…") gastava
                  três linhas a 360 px e ainda deixava o "›" órfão numa quarta —
                  mais altura do que o destino merece antes de a pessoa ver a
                  primeira decisão da tela. */}
              <Link
                href="/estudar"
                /* Padding em vez de `alvo-toque`: o link tem dois pedaços de
                   texto com um espaço entre eles, e display:flex descarta nós
                   de texto que só têm espaço em branco — virava "PDFs
                   daAnatel". Aqui os 44 px vêm do py-3 (20 de linha + 24), e
                   as margens negativas devolvem o espaço à coluna. */
                className="-mx-2 -my-3 inline-block rounded-lg px-2 py-3 font-medium text-slate-500 underline underline-offset-4 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Ementa oficial e PDFs da{" "}
                {/* O "›" preso à última palavra: solto, ele caía sozinho numa
                    linha só para ele a 320 px. */}
                <span className="whitespace-nowrap">
                  Anatel
                  <Icone
                    nome="seta-direita"
                    className="ml-0.5 h-3.5 w-3.5 align-[-2px]"
                  />
                </span>
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
            onDesempenho={() => irPara("desempenho")}
            onFerramentas={() => irPara("ferramentas")}
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
          {retomada && (
            <CartaoRetomar
              retomada={retomada}
              onRetomar={() => retomar(retomada)}
              onDescartar={() => {
                limparEmCurso();
                setRetomada(null);
              }}
            />
          )}
          {/* O desafio que ficou para depois continua à vista enquanto a URL
              o trouxer: sem isto, "Deixar para depois" era caminho de mão
              única. */}
          {desafio && (
            <DesafioPendente
              desafio={desafio}
              onAbrir={() => setEtapa("desafio")}
            />
          )}
          <ResumoDesempenho
            historico={historico}
            carregado={carregado}
            onAbrir={() => irPara("desempenho")}
          />
          <TelaInicio
            historico={historico}
            onIniciar={iniciar}
            onRevisar={iniciarRevisao}
            onAssuntos={() => irPara("assuntos")}
            onImprimir={imprimirBateria}
          />
        </div>
      )}

      {etapa === "assuntoPouso" && pouso && (
        <TelaAssuntoPouso
          topico={pouso.topico}
          quantidade={pouso.questoes.length}
          onComecar={() => iniciarAssunto(pouso.questoes)}
        />
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
            escolhasIniciais={inicial?.escolhas ?? null}
            indiceInicial={inicial?.indice ?? 0}
            marcadasIniciais={inicial?.marcadas}
            onConcluir={concluir}
            onSair={abandonar}
            onProgresso={registrarProgresso}
          />
        ) : (
          <TelaSimulado
            key={`${temaAtual}-${materiasProva.length}`}
            questoes={questoes}
            tempoSegundos={tempoSegundos}
            escolhasIniciais={inicial?.escolhas ?? null}
            indiceInicial={inicial?.indice ?? 0}
            onConcluir={concluir}
            onSair={abandonar}
            onProgresso={registrarProgresso}
            parcialConta={modo === "revisao" || modo === "assunto"}
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
          onRefazer={plano ? refazerBateria : undefined}
          onRevisarErros={() =>
            revisarErrosDaBateria(
              respostas.filter((r) => !r.acertou).map((r) => r.questao),
            )
          }
          onEstudarAssunto={() => irPara("assuntos")}
          onOutroAssunto={
            modo === "assunto" ? () => irPara("assuntos") : undefined
          }
          // Quantos erros continuam em aberto DEPOIS desta bateria — o
          // histórico já foi atualizado por `concluir`.
          restantesRevisao={
            modo === "revisao"
              ? questoesParaRevisao(historico, classeAtual).length
              : 0
          }
          onContinuarRevisao={() => iniciarRevisao(classeAtual)}
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
          motivoFim={motivoFim}
          onProsseguir={() => iniciarMateria(plano, materiasProva.length)}
          onAbandonar={abandonar}
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
          onRefazer={plano ? refazerBateria : undefined}
          onRevisarErros={() =>
            revisarErrosDaBateria(
              materiasProva
                .flatMap((m) => m.respostas)
                .filter((r) => !r.acertou)
                .map((r) => r.questao),
            )
          }
          // O desafio de várias matérias chegava ao fim sem código, sem link e
          // sem menção no texto compartilhado — o organizador ficava sem o que
          // comparar justamente na bateria mais longa.
          desafio={
            modo === "desafio" && desafio && linkDesafio
              ? {
                  semente: desafio.semente,
                  link: linkDesafio,
                  codigo: codigoDaBateria(
                    materiasProva.flatMap((m) =>
                      m.respostas.map((r) => r.questao.id),
                    ),
                  ),
                }
              : undefined
          }
        />
      )}
    </main>
  );
}
