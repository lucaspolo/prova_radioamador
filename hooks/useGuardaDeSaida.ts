"use client";

import { useEffect, useRef } from "react";

/**
 * Ligado enquanto a guarda desfaz a própria entrada de histórico.
 *
 * A limpeza chama `history.back()` para não deixar um degrau a mais entre o
 * usuário e a página anterior — e esse `back` dispara um `popstate` que, para
 * quem estiver ouvindo de fora, é indistinguível do gesto de voltar. Sem esta
 * bandeira, o ouvinte de `app/page.tsx` (que leva as telas de consulta ao
 * histórico) via a saída normal da bateria como um "voltar" e mandava a pessoa
 * para a home no lugar do resultado.
 */
let saindoPelaGuarda = false;

/** Consome a bandeira: devolve true uma única vez, para o pop programado. */
export function foiSaidaDaGuarda(): boolean {
  if (!saindoPelaGuarda) return false;
  saindoPelaGuarda = false;
  return true;
}

/**
 * Intercepta as duas formas de sair de uma bateria sem querer: o gesto de
 * voltar e o fechamento da aba.
 *
 * O app é uma máquina de estados numa rota só, e o comentário de
 * `app/page.tsx` diz que isso "evita perder progresso com o botão voltar" —
 * mas o efeito medido era o oposto: como nenhuma etapa empurra entrada no
 * histórico, voltar durante a bateria saía do site (num aplicativo instalado
 * no Android, fechava o app), e o gesto de voltar é reflexo. Recarregar
 * fazia o mesmo em silêncio.
 *
 * Como funciona: ao montar com `ativo`, empurra uma entrada de guarda com a
 * MESMA URL — não muda o endereço, não cria rota, não mexe no service worker.
 * Quando o gesto de voltar consome essa entrada, `popstate` a reempurra (não
 * existe cancelar um `popstate`) e chama `aoTentarSair`, que abre a
 * confirmação de abandono da tela. Quem confirma sai pelo caminho normal.
 *
 * `beforeunload` cobre recarregar, fechar a aba e o "puxar para atualizar" do
 * celular. O diálogo é do navegador e não dá para escrever o texto dele; o que
 * dá para garantir é que ele só apareça quando há o que perder — daí `ativo`
 * ser falso enquanto ninguém respondeu nada.
 */
export function useGuardaDeSaida(ativo: boolean, aoTentarSair: () => void) {
  // O callback muda de identidade a cada render de quem usa o hook; num ref,
  // ele não reinstala os ouvintes — e reinstalar significaria empurrar outra
  // entrada de guarda a cada resposta.
  const aoTentarSairRef = useRef(aoTentarSair);
  useEffect(() => {
    aoTentarSairRef.current = aoTentarSair;
  });

  useEffect(() => {
    if (!ativo) return;

    const marca = { guardaDeBateria: true };
    window.history.pushState(marca, "");

    function aoVoltar() {
      window.history.pushState(marca, "");
      aoTentarSairRef.current();
    }
    function aoDescarregar(e: BeforeUnloadEvent) {
      e.preventDefault();
    }

    window.addEventListener("popstate", aoVoltar);
    window.addEventListener("beforeunload", aoDescarregar);
    return () => {
      window.removeEventListener("popstate", aoVoltar);
      window.removeEventListener("beforeunload", aoDescarregar);
      // Sair pela porta da frente (concluir, abandonar) devolve a entrada de
      // guarda ao histórico: sem isto, cada bateria deixaria um degrau a mais
      // entre o usuário e a página de onde ele veio. O ouvinte já saiu, então
      // este `back` não dispara a confirmação.
      if ((window.history.state as typeof marca | null)?.guardaDeBateria) {
        saindoPelaGuarda = true;
        window.history.back();
      }
    };
  }, [ativo]);
}
