"use client";

import { useState } from "react";
import TelaInicio from "@/components/TelaInicio";
import TelaSimulado from "@/components/TelaSimulado";
import TelaResultado from "@/components/TelaResultado";
import Dashboard from "@/components/Dashboard";
import { useHistorico } from "@/hooks/useHistorico";
import { sortearSimulado } from "@/lib/questoes";
import type { Classe, Questao, Resposta, Tema } from "@/lib/tipos";
import { CLASSE_PADRAO, TEMAS, tempoDaBateria } from "@/lib/constantes";

type Etapa = "inicio" | "simulado" | "resultado";

/**
 * O app é uma máquina de estados numa única rota, e não três rotas.
 *
 * A alternativa seria passar tema e quantidade por query string, mas num
 * export estático isso exigiria `useSearchParams` com Suspense, e sair da
 * página perderia o simulado em andamento. Manter o estado aqui é mais simples
 * e evita perder progresso com o botão voltar.
 */
export default function Home() {
  const [etapa, setEtapa] = useState<Etapa>("inicio");
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [respostas, setRespostas] = useState<Resposta[]>([]);
  const [temaAtual, setTemaAtual] = useState<Tema>(TEMAS[0]);
  const [classeAtual, setClasseAtual] = useState<Classe>(CLASSE_PADRAO);
  const [tempoSegundos, setTempoSegundos] = useState<number | null>(null);
  const { historico, carregado, registrar, limpar } = useHistorico();

  function iniciar(
    tema: Tema,
    quantidade: number,
    classe: Classe,
    cronometrar: boolean,
  ) {
    // O histórico entra no sorteio: o que você errou volta antes, o que já
    // domina rareia. Sem histórico, o sorteio é uniforme. A classe define o
    // acervo elegível — o acréscimo técnico da Classe A não cai em B nem em C.
    setQuestoes(sortearSimulado(tema, quantidade, historico, classe));
    setTempoSegundos(cronometrar ? tempoDaBateria(classe, quantidade) : null);
    setRespostas([]);
    setTemaAtual(tema);
    setClasseAtual(classe);
    setEtapa("simulado");
  }

  function concluir(finais: Resposta[]) {
    setRespostas(finais);
    // Só entra no histórico o simulado terminado; abandonar não conta.
    registrar(temaAtual, finais);
    setEtapa("resultado");
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">
          Simulados · Radioamador Classe B
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Questões de certo ou errado no formato da prova da Anatel.
        </p>
      </header>

      {etapa === "inicio" && (
        <div className="space-y-8">
          <Dashboard
            historico={historico}
            carregado={carregado}
            onLimpar={limpar}
          />
          <TelaInicio onIniciar={iniciar} />
        </div>
      )}

      {etapa === "simulado" && (
        <TelaSimulado
          questoes={questoes}
          tempoSegundos={tempoSegundos}
          onConcluir={concluir}
          onSair={() => setEtapa("inicio")}
        />
      )}

      {etapa === "resultado" && (
        <TelaResultado
          respostas={respostas}
          onReiniciar={() => setEtapa("inicio")}
          classe={classeAtual}
        />
      )}
    </main>
  );
}
