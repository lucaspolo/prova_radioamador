"use client";

import { useCallback, useEffect, useState } from "react";
import { gravarSuspeitas, lerSuspeitas } from "@/lib/suspeitas";

/**
 * Questões marcadas como suspeitas, persistidas no navegador.
 *
 * Mesmo padrão do useHistorico: estado começa vazio e é preenchido num
 * useEffect para o HTML estático e o primeiro render do cliente coincidirem.
 * Cada componente que usa o hook lê o storage ao montar — como as telas se
 * revezam (simulado, resultado, início), não há duas instâncias vivas
 * escrevendo ao mesmo tempo.
 */
export function useSuspeitas() {
  const [ids, setIds] = useState<string[]>([]);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    // O storage só existe no cliente: ler aqui e ajustar o estado é o padrão
    // de hidratação deliberado (o comentário do hook explica). O re-render em
    // cascata é um só, no primeiro mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIds(lerSuspeitas());
    setCarregado(true);
  }, []);

  const alternar = useCallback((id: string) => {
    setIds((atuais) => {
      const novos = atuais.includes(id)
        ? atuais.filter((x) => x !== id)
        : [...atuais, id];
      gravarSuspeitas(novos);
      return novos;
    });
  }, []);

  const mesclarCom = useCallback((outros: string[]) => {
    setIds((atuais) => {
      const novos = [...new Set([...atuais, ...outros])];
      gravarSuspeitas(novos);
      return novos;
    });
  }, []);

  return { ids, carregado, alternar, mesclarCom };
}
