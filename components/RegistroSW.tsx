"use client";

import { useEffect } from "react";

/**
 * Registra o service worker que torna o app instalável e utilizável offline.
 *
 * O sw.js só existe no export de produção (é gerado pelo postbuild a partir da
 * lista real de assets), então em desenvolvimento o registro nem é tentado —
 * um worker de dev registrado por engano serviria assets velhos para sempre.
 */
export default function RegistroSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Sem service worker o app continua funcionando normalmente online.
    });
  }, []);

  return null;
}
