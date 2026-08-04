"use client";

import { useState } from "react";
import TelaInicio from "@/components/TelaInicio";
import TelaSimulado from "@/components/TelaSimulado";
import TelaResultado from "@/components/TelaResultado";
import Dashboard from "@/components/Dashboard";
import { useHistorico } from "@/hooks/useHistorico";
import { sortearSimulado } from "@/lib/questoes";
import type { EscolhaTema, Questao, Resposta } from "@/lib/tipos";

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
  const [escolhaAtual, setEscolhaAtual] = useState<EscolhaTema>("todos");
  const { historico, carregado, registrar, limpar } = useHistorico();

  function iniciar(escolha: EscolhaTema, quantidade: number) {
    // O histórico entra no sorteio: o que você errou volta antes, o que já
    // domina rareia. Sem histórico, o sorteio é uniforme.
    setQuestoes(sortearSimulado(escolha, quantidade, historico));
    setRespostas([]);
    setEscolhaAtual(escolha);
    setEtapa("simulado");
  }

  function concluir(finais: Resposta[]) {
    setRespostas(finais);
    // Só entra no histórico o simulado terminado; abandonar não conta.
    registrar(escolhaAtual, finais);
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
          onConcluir={concluir}
          onSair={() => setEtapa("inicio")}
        />
      )}

      {etapa === "resultado" && (
        <TelaResultado
          respostas={respostas}
          onReiniciar={() => setEtapa("inicio")}
        />
      )}
    </main>
  );
}
