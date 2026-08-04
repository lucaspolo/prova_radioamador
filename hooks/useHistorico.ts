"use client";

import { useCallback, useEffect, useState } from "react";
import type { EscolhaTema, Resposta } from "@/lib/tipos";
import {
  gravar,
  ler,
  montarRegistro,
  HISTORICO_VAZIO,
  MAX_SIMULADOS,
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
    setHistorico(ler());
    setCarregado(true);
  }, []);

  const registrar = useCallback(
    (escolha: EscolhaTema, respostas: Resposta[]) => {
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

  const limpar = useCallback(() => {
    setHistorico(HISTORICO_VAZIO);
    gravar(HISTORICO_VAZIO);
  }, []);

  return { historico, carregado, registrar, limpar };
}
