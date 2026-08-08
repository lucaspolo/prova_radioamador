"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
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
   * teclado sem ter de escolher outra resposta que também não é a sua.
   */
  const marcar = useCallback(
    (id: string, veredito: Veredito) => {
      setRevisoes((atuais) => {
        const atual = atuais[id];
        const novas = { ...atuais };
        if (atual?.veredito === veredito) {
          // Desmarcar tira a decisão, não o que foi escrito: a justificativa
          // costuma ser o motivo de estar hesitando, e apagá-la junto faria o
          // clique de desfazer custar a frase que explicava a dúvida.
          if (atual.nota.trim()) novas[id] = { ...atual, veredito: null };
          else delete novas[id];
        } else {
          novas[id] = {
            veredito,
            nota: atual?.nota ?? "",
            em: new Date().toISOString(),
          };
        }
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
   * A nota pode existir sem veredito, e nesse caso o veredito fica `null` em
   * vez de virar "problema": quem escreve "conferir contra o anexo" antes de
   * decidir registrou algo que não pode sumir, mas não decidiu nada — chutar
   * "P" por ele inflaria a contagem de problemas com trabalho não feito.
   */
  const anotar = useCallback(
    (id: string, nota: string) => {
      setRevisoes((atuais) => {
        const atual = atuais[id];
        const novas = { ...atuais };
        if (!atual && !nota.trim()) {
          delete novas[id];
        } else if (atual && !atual.veredito && !nota.trim()) {
          // Anotação apagada e sem veredito: não sobrou revisão nenhuma.
          delete novas[id];
        } else {
          novas[id] = {
            veredito: atual?.veredito ?? null,
            nota,
            em: atual?.em ?? new Date().toISOString(),
          };
        }
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
    descarregar,
    substituir,
  };
}
