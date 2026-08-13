import { prontidao } from "@/lib/prontidao";
import { percentualAprovacao, TEMAS } from "@/lib/constantes";
import type { Classe } from "@/lib/tipos";
import {
  VERSAO_HISTORICO,
  type Historico,
  type SimuladoSalvo,
} from "@/lib/historico";

let falhas = 0;
function checar(nome: string, ok: boolean, detalhe = "") {
  if (!ok) falhas++;
  console.log(`${ok ? "  ok  " : "FALHA "} ${nome}${detalhe ? " — " + detalhe : ""}`);
}

const LEG = TEMAS[0];

function bateria(
  id: string,
  data: string,
  acertos: number,
  total: number,
  extra: Partial<SimuladoSalvo> = {},
): SimuladoSalvo {
  return { id, data, escolha: LEG, total, acertos, itens: [], ...extra };
}

function h(...simulados: SimuladoSalvo[]): Historico {
  return { versao: VERSAO_HISTORICO, simulados };
}

// --- A janela é recente, e só da matéria ----------------------------------
{
  // Seis baterias de 20 (oficial da B): as 5 recentes acima do corte, a mais
  // antiga — fora da janela — reprovada. Ordem: mais recente primeiro.
  const historico = h(
    bateria("f", "2026-08-06", 15, 20),
    bateria("e", "2026-08-05", 14, 20),
    bateria("d", "2026-08-04", 13, 20),
    bateria("c", "2026-08-03", 12, 20),
    bateria("b", "2026-08-02", 11, 20),
    bateria("a", "2026-08-01", 3, 20),
  );
  const [leg] = prontidao(historico, "B");
  checar("a janela pega as 5 mais recentes", leg.baterias === 5);
  checar(
    "a bateria velha fora da janela não pesa",
    leg.acimaDoCorte === 5,
    `${leg.acimaDoCorte} de ${leg.baterias}`,
  );
  checar("a janela sabe que só olhou baterias oficiais", leg.soOficiais);

  const semNada = prontidao(h(), "B");
  checar(
    "sem histórico, cada matéria tem janela vazia",
    semNada.every((p) => p.baterias === 0 && p.acimaDoCorte === 0),
  );
}

// --- Nota de corte exata, por classe --------------------------------------
{
  // 11/20 é exatamente o mínimo da Classe B; 10/20 fica abaixo.
  const b = prontidao(h(bateria("x", "2026-08-01", 11, 20)), "B")[0];
  checar("11 de 20 conta como acima do corte na B", b.acimaDoCorte === 1);
  const quase = prontidao(h(bateria("x", "2026-08-01", 10, 20)), "B")[0];
  checar("10 de 20 não conta", quase.acimaDoCorte === 0);

  // 8/15 é o mínimo da C (53%): a mesma proporção que reprovaria na B.
  const c = prontidao(h(bateria("x", "2026-08-01", 8, 15)), "C")[0];
  checar(
    `8 de 15 passa o corte da C (${percentualAprovacao("C")}%)`,
    c.acimaDoCorte === 1,
  );
}

// --- Revisão e outras classes ficam de fora -------------------------------
{
  const historico = h(
    bateria("r", "2026-08-03", 2, 10, { escolha: "revisao" }),
    bateria("outra", "2026-08-02", 20, 20, { classe: "A" as Classe }),
    bateria("minha", "2026-08-01", 12, 20, { classe: "B" as Classe }),
    bateria("antiga", "2026-07-30", 12, 20), // sem classe: anterior ao campo
  );
  const [leg] = prontidao(historico, "B");
  checar(
    "revisão e bateria de outra classe não entram; a legada sem classe entra",
    leg.baterias === 2 && leg.acimaDoCorte === 2,
    `${leg.acimaDoCorte}/${leg.baterias}`,
  );
}

// --- Baterias curtas só valem quando não há oficiais ----------------------
{
  const soCurtas = prontidao(h(bateria("x", "2026-08-01", 9, 10)), "B")[0];
  checar(
    "sem bateria oficial, as curtas valem — e a janela avisa",
    soCurtas.baterias === 1 && soCurtas.acimaDoCorte === 1 && !soCurtas.soOficiais,
  );

  const mistas = prontidao(
    h(
      bateria("curta", "2026-08-03", 10, 10),
      bateria("oficial", "2026-08-02", 11, 20),
    ),
    "B",
  )[0];
  checar(
    "havendo oficial, a curta sai da conta",
    mistas.baterias === 1 && mistas.soOficiais,
  );
}

console.log(`\n${falhas === 0 ? "TODOS OS TESTES DE PRONTIDÃO PASSARAM" : falhas + " FALHA(S)"}`);
process.exit(falhas === 0 ? 0 : 1);
