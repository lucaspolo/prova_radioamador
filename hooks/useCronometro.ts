"use client";

import { useEffect, useRef, useState } from "react";

/**
 * O relógio de uma bateria: devolve os segundos restantes e chama `aoEsgotar`
 * uma única vez quando o tempo acaba. `tempoSegundos` nulo desliga o
 * cronômetro.
 *
 * Duas sutilezas que valem o hook em vez de repetir o efeito em cada tela:
 *
 * - O prazo é um instante fixo (`Date.now() + t * 1000`), e não um contador
 *   decrementado. Se o intervalo atrasar — aba em segundo plano no celular é o
 *   caso comum — o relógio continua honesto em vez de ganhar tempo.
 * - `aoEsgotar` é lido de um ref. O callback muda de identidade a cada render
 *   de quem usa o hook; se ele entrasse nas dependências do efeito, o relógio
 *   reiniciaria do zero a cada resposta.
 */
export function useCronometro(
  tempoSegundos: number | null,
  aoEsgotar: () => void,
): number {
  const [restante, setRestante] = useState(tempoSegundos ?? 0);
  const [prazoAnterior, setPrazoAnterior] = useState(tempoSegundos);
  const aoEsgotarRef = useRef(aoEsgotar);
  const disparadoRef = useRef(false);

  useEffect(() => {
    aoEsgotarRef.current = aoEsgotar;
  });

  // Trocar o prazo com o componente montado recomeça o relógio já no render,
  // sem esperar o primeiro tick — senão o mostrador ficaria até 250 ms exibindo
  // o tempo da bateria anterior.
  if (tempoSegundos !== prazoAnterior) {
    setPrazoAnterior(tempoSegundos);
    setRestante(tempoSegundos ?? 0);
  }

  useEffect(() => {
    if (tempoSegundos == null) return;
    disparadoRef.current = false;

    const fim = Date.now() + tempoSegundos * 1000;
    const timer = setInterval(() => {
      const falta = Math.max(0, Math.ceil((fim - Date.now()) / 1000));
      setRestante(falta);
      // A guarda importa: sem ela o tick continua caindo aqui a cada 250 ms
      // depois do fim, e a bateria seria encerrada várias vezes.
      if (falta === 0 && !disparadoRef.current) {
        disparadoRef.current = true;
        clearInterval(timer);
        aoEsgotarRef.current();
      }
    }, 250);
    return () => clearInterval(timer);
  }, [tempoSegundos]);

  return restante;
}
