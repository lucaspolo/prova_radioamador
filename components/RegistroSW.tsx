"use client";

import { useEffect } from "react";
import { anunciarEspera } from "@/lib/atualizacao-sw";

/**
 * Registra o service worker que torna o app instalável e utilizável offline.
 *
 * O sw.js só existe no export de produção (é gerado pelo postbuild a partir da
 * lista real de assets), então em desenvolvimento o registro nem é tentado —
 * um worker de dev registrado por engano serviria assets velhos para sempre.
 *
 * Também é daqui que sai o anúncio de atualização: quando uma versão nova
 * termina de instalar e fica esperando, `anunciarEspera` avisa a página — que
 * mostra o convite de recarregar fora de bateria. O worker não assume mais
 * sozinho (o install não chama `skipWaiting`); assumir é decisão do usuário.
 */
export default function RegistroSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        // Deploy aconteceu entre duas visitas: a versão nova pode já estar
        // esperando quando a página abre. Sem esta checagem o aviso só
        // apareceria no deploy seguinte.
        if (reg.waiting && navigator.serviceWorker.controller) {
          anunciarEspera(reg.waiting);
        }
        reg.addEventListener("updatefound", () => {
          const novo = reg.installing;
          if (!novo) return;
          novo.addEventListener("statechange", () => {
            // "installed" com um controller ativo = atualização pronta e
            // esperando. Sem controller é a primeira instalação — não há
            // versão velha em uso, nada a avisar.
            if (
              novo.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              anunciarEspera(novo);
            }
          });
        });
      })
      .catch(() => {
        // Sem service worker o app continua funcionando normalmente online.
      });
  }, []);

  return null;
}
