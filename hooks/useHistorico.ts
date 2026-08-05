"use client";

import { useCallback, useEffect, useState } from "react";
import type { Resposta } from "@/lib/tipos";
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

  useEffect(() => {
    // O storage só existe no cliente: ler aqui e ajustar o estado é o padrão
    // de hidratação deliberado (o comentário do hook explica). O re-render em
    // cascata é um só, no primeiro mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistorico(ler());
    setCarregado(true);
  }, []);

  const registrar = useCallback(
    (escolha: EscolhaRegistro, respostas: Resposta[]) => {
      if (respostas.length === 0) return;
      setHistorico((atual) => {
        const novo: Historico = {
          ...atual,
          // Os mais recentes ficam à frente; o excedente antigo é descartado.
          simulados: [montarRegistro(escolha, respostas), ...atual.simulados].slice(
            0,
            MAX_SIMULADOS,
          ),
        };
        gravar(novo);
        return novo;
      });
    },
    [],
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
      gravar(unido);
      setHistorico(unido);
      return novos;
    },
    [historico],
  );

  const limpar = useCallback(() => {
    setHistorico(HISTORICO_VAZIO);
    gravar(HISTORICO_VAZIO);
  }, []);

  return { historico, carregado, registrar, importar, limpar };
}
