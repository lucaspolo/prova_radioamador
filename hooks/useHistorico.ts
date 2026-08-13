"use client";

import { useCallback, useEffect, useState } from "react";
import type { Classe, Resposta } from "@/lib/tipos";
import {
  gravar,
  ler,
  mesclar,
  montarRegistro,
  HISTORICO_VAZIO,
  MAX_SIMULADOS,
  type EscolhaRegistro,
  type Historico,
} from "@/lib/historico";

/**
 * Acesso ao histórico salvo no navegador.
 *
 * O `localStorage` não existe durante a pré-renderização estática. Por isso o
 * estado começa vazio e só é preenchido dentro de um `useEffect`, que roda
 * apenas no cliente: o HTML gerado na build e o primeiro render no navegador
 * são idênticos, e não há divergência de hidratação. O sinalizador `carregado`
 * permite à interface distinguir "ainda não li o storage" de "li e está vazio"
 * — sem ele, o dashboard piscaria "nenhum simulado" a cada carregamento.
 */
export function useHistorico() {
  const [historico, setHistorico] = useState<Historico>(HISTORICO_VAZIO);
  const [carregado, setCarregado] = useState(false);
  const [gravacaoRecusada, setGravacaoRecusada] = useState(false);

  useEffect(() => {
    // O storage só existe no cliente: ler aqui e ajustar o estado é o padrão
    // de hidratação deliberado (o comentário do hook explica). O re-render em
    // cascata é um só, no primeiro mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistorico(ler());
    setCarregado(true);
  }, []);

  /**
   * Atualiza o estado e grava, com o resultado da gravação à vista: recusa
   * (cota, modo privado) acende `gravacaoRecusada` para a interface avisar —
   * o dado continua válido nesta aba, mas morre com ela. Sucesso limpa o
   * aviso: se o navegador voltou a aceitar, o alerta antigo viraria mentira.
   */
  const persistir = useCallback((novo: Historico) => {
    setHistorico(novo);
    setGravacaoRecusada(!gravar(novo));
  }, []);

  const registrar = useCallback(
    (
      escolha: EscolhaRegistro,
      respostas: Resposta[],
      extras?: { classe?: Classe },
    ) => {
      if (respostas.length === 0) return;
      // Calculado fora do updater, como no `importar`: o resultado de
      // `gravar()` precisa virar estado, e updater é função pura. Não há
      // concorrência — toda escrita passa por este hook e é disparada por
      // interação.
      persistir({
        ...historico,
        // Os mais recentes ficam à frente; o excedente antigo é descartado.
        simulados: [
          montarRegistro(escolha, respostas, extras),
          ...historico.simulados,
        ].slice(0, MAX_SIMULADOS),
      });
    },
    [historico, persistir],
  );

  /**
   * Une um histórico importado de outro aparelho ao local e devolve quantos
   * simulados eram novos. União por id: reimportar o mesmo arquivo não duplica.
   */
  const importar = useCallback(
    (outro: Historico): number => {
      // Calculado fora do updater: dentro dele o retorno chegaria tarde
      // demais para informar o usuário. Não há concorrência — toda escrita
      // passa por este hook e é disparada por interação.
      const unido = mesclar(historico, outro);
      const novos = unido.simulados.length - historico.simulados.length;
      persistir(unido);
      return novos;
    },
    [historico, persistir],
  );

  const limpar = useCallback(() => {
    persistir(HISTORICO_VAZIO);
  }, [persistir]);

  return { historico, carregado, gravacaoRecusada, registrar, importar, limpar };
}
