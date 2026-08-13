"use client";

import { useState } from "react";
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
import { useHistorico } from "@/hooks/useHistorico";
import { questoesParaRevisao, sortearSimulado } from "@/lib/questoes";
import { CLASSE_PADRAO, FORMATO, TEMAS, tempoDaBateria } from "@/lib/constantes";
import type { Classe, MotivoFim, Questao, Resposta, Tema } from "@/lib/tipos";

type Etapa =
  | "inicio"
  | "assuntos"
  | "simulado"
  | "resultado"
  | "intervalo"
  | "resultadoProva"
  | "ferramentas"
  | "desempenho";

/**
 * O que está sendo jogado agora. "avulso" é a bateria de uma matéria;
 * "revisao" recruta só os erros em aberto e não recebe veredito; "assunto" é
 * o estudo dirigido por uma seção do material, também sem veredito; "prova"
 * encadeia as três matérias no formato oficial, cada uma com seu cronômetro
 * e seu mínimo — aprovação só com as três.
 */
type Modo = "avulso" | "revisao" | "prova" | "assunto";

/**
 * Como a bateria é conduzida. "treino" dá o gabarito questão a questão, que é
 * como se aprende; "cego" esconde tudo até o fim e libera a navegação entre as
 * questões, que é como a Anatel aplica.
 */
type Regime = "treino" | "cego";

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
  const [motivoFim, setMotivoFim] = useState<MotivoFim>("manual");
  const { historico, carregado, gravacaoRecusada, registrar, importar, limpar } =
    useHistorico();

  function iniciar(
    tema: Tema,
    quantidade: number,
    classe: Classe,
    cronometrar: boolean,
    cego: boolean,
    soIneditas: boolean,
  ) {
    // O histórico entra no sorteio: o que você errou volta antes, o que já
    // domina rareia. Sem histórico, o sorteio é uniforme. A classe define o
    // acervo elegível — o acréscimo técnico da Classe A não cai em B nem em C.
    setModo("avulso");
    setRegime(cego ? "cego" : "treino");
    setQuestoes(
      sortearSimulado(tema, quantidade, historico, classe, { soIneditas }),
    );
    setRespostas([]);
    setTemaAtual(tema);
    setClasseAtual(classe);
    setTempoSegundos(cronometrar ? tempoDaBateria(classe, quantidade) : null);
    setEtapa("simulado");
  }

  function iniciarAssunto(sorteadas: Questao[]) {
    // Estudo dirigido: como a revisão — treino, sem cronômetro, sem veredito.
    // A bateria é a seção inteira; quem escolheu o assunto quer esgotá-lo.
    setModo("assunto");
    setRegime("treino");
    setQuestoes(sorteadas);
    setRespostas([]);
    setTempoSegundos(null);
    setEtapa("simulado");
  }

  function iniciarRevisao(classe: Classe) {
    // Revisão é estudo dirigido: sem cronômetro, sem veredito e sempre com o
    // gabarito na hora — esconder a resposta aqui seria esconder o estudo.
    setModo("revisao");
    setRegime("treino");
    setQuestoes(questoesParaRevisao(historico, classe));
    setRespostas([]);
    setClasseAtual(classe);
    setTempoSegundos(null);
    setEtapa("simulado");
  }

  function iniciarMateriaDaProva(classe: Classe, indice: number) {
    const tema = TEMAS[indice];
    setQuestoes(
      sortearSimulado(tema, FORMATO[classe].questoes, historico, classe),
    );
    setRespostas([]);
    setTemaAtual(tema);
    // Prova completa é sempre cronometrada: simular o exame é o ponto dela.
    setTempoSegundos(tempoDaBateria(classe, FORMATO[classe].questoes));
    setEtapa("simulado");
  }

  function iniciarProva(classe: Classe) {
    setModo("prova");
    // Simular o exame é o ponto da prova completa, e o exame é cego.
    setRegime("cego");
    setClasseAtual(classe);
    setMateriasProva([]);
    iniciarMateriaDaProva(classe, 0);
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

    if (modo !== "prova") {
      setEtapa("resultado");
      return;
    }
    const concluidas = [...materiasProva, { tema: temaAtual, respostas: finais }];
    setMateriasProva(concluidas);
    setEtapa(concluidas.length < TEMAS.length ? "intervalo" : "resultadoProva");
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
            onProvaCompleta={iniciarProva}
            onRevisar={iniciarRevisao}
            onAssuntos={() => setEtapa("assuntos")}
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
        />
      )}

      {etapa === "intervalo" && (
        <TelaIntervalo
          classe={classeAtual}
          tema={temaAtual}
          respostas={respostas}
          proximoTema={TEMAS[materiasProva.length]}
          onProsseguir={() =>
            iniciarMateriaDaProva(classeAtual, materiasProva.length)
          }
          onAbandonar={() => setEtapa("inicio")}
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
