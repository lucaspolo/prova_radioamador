"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  aoAnotar,
  aoMarcar,
  darPorVistas as aplicarVistas,
  gravarRevisoes,
  lerRevisoes,
  type Revisoes,
  type Veredito,
} from "@/lib/conferencia";

/** Espera antes de gravar o que está sendo digitado. */
const ESPERA_MS = 500;

/**
 * As revisões da conferência, persistidas no navegador.
 *
 * Mesmo padrão do useSuspeitas: estado começa vazio e é preenchido num
 * useEffect, para o HTML estático e o primeiro render do cliente coincidirem.
 * A diferença é `carregado`, que aqui não é só informativo — enquanto for
 * false ninguém pode gravar, ou o `{}` inicial passaria por cima de uma
 * revisão inteira antes da leitura terminar.
 *
 * Só a tela de conferência usa este hook, e só uma vez: não há duas instâncias
 * vivas disputando a mesma chave.
 */
export function useConferencia() {
  const [revisoes, setRevisoes] = useState<Revisoes>({});
  const [carregado, setCarregado] = useState(false);
  const [storageRecusou, setStorageRecusou] = useState(false);

  // O timer do debounce e o último valor pendente, para o blur poder forçar a
  // gravação sem esperar. Em ref porque nenhum dos dois deve causar render.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendente = useRef<Revisoes | null>(null);

  useEffect(() => {
    // O storage só existe no cliente: ler aqui e ajustar o estado é o padrão
    // de hidratação deliberado. O re-render em cascata é um só, no mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRevisoes(lerRevisoes());
    setCarregado(true);
  }, []);

  const gravar = useCallback((novas: Revisoes) => {
    if (!gravarRevisoes(novas)) setStorageRecusou(true);
  }, []);

  /** Descarrega agora o que o debounce estava segurando. */
  const descarregar = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (pendente.current) {
      gravar(pendente.current);
      pendente.current = null;
    }
  }, [gravar]);

  // Fechar a aba com uma frase por gravar é perder a frase. O debounce é curto,
  // mas "curto" e "zero" não são a mesma coisa quando o trabalho é de horas.
  useEffect(() => {
    window.addEventListener("beforeunload", descarregar);
    return () => {
      window.removeEventListener("beforeunload", descarregar);
      descarregar();
    };
  }, [descarregar]);

  /**
   * Marca o veredito. Grava na hora: um clique é uma decisão tomada, e segurá-la
   * meio segundo só criaria uma janela para perdê-la.
   *
   * Clicar de novo no mesmo veredito desmarca — é como se desfaz um engano de
   * teclado sem ter de escolher outra resposta que também não é a sua. A regra
   * inteira — inclusive a de que mexer no veredito reabre um achado já dado por
   * visto — está em `aoMarcar`, testada sem navegador.
   */
  const marcar = useCallback(
    (id: string, veredito: Veredito) => {
      setRevisoes((atuais) => {
        const novas = aoMarcar(atuais, id, veredito, new Date().toISOString());
        descarregar();
        gravar(novas);
        return novas;
      });
    },
    [descarregar, gravar],
  );

  /**
   * Anota a justificativa, gravando com atraso.
   *
   * Um `setItem` por tecla digitada serializa as 903 revisões inteiras a cada
   * caractere. O atraso resolve isso, e o `onBlur` da tela chama `descarregar()`
   * para que sair do campo não dependa dele.
   *
   * O que a nota faz com a revisão — inclusive existir sem veredito e reabrir um
   * achado dado por visto — está em `aoAnotar`.
   */
  const anotar = useCallback(
    (id: string, nota: string) => {
      setRevisoes((atuais) => {
        const novas = aoAnotar(atuais, id, nota, new Date().toISOString());
        pendente.current = novas;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          timer.current = null;
          if (pendente.current) {
            gravar(pendente.current);
            pendente.current = null;
          }
        }, ESPERA_MS);
        return novas;
      });
    },
    [gravar],
  );

  /**
   * Dá por lida a triagem de um conjunto de achados. Grava na hora, como
   * `marcar`: é uma decisão, não digitação.
   */
  const darPorVistas = useCallback(
    (ids: readonly string[]) => {
      if (ids.length === 0) return;
      setRevisoes((atuais) => {
        const novas = aplicarVistas(atuais, ids, new Date().toISOString());
        descarregar();
        gravar(novas);
        return novas;
      });
    },
    [descarregar, gravar],
  );

  /** Substitui tudo — usado ao importar um arquivo de revisão. */
  const substituir = useCallback(
    (novas: Revisoes) => {
      descarregar();
      setRevisoes(novas);
      gravar(novas);
    },
    [descarregar, gravar],
  );

  return {
    revisoes,
    carregado,
    storageRecusou,
    marcar,
    anotar,
    darPorVistas,
    descarregar,
    substituir,
  };
}
