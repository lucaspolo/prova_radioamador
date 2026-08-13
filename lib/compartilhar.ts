import type { Classe, Tema } from "./tipos";
import { ROTULO_CURTO } from "./constantes";
import { REPO } from "./reportar";

export const URL_PROJETO = `https://github.com/${REPO}`;

export interface MateriaResumo {
  tema: Tema;
  acertos: number;
  total: number;
  aprovado: boolean;
}

export interface ResumoBateria {
  classe: Classe;
  /** Ausente na prova completa, que cobre as três. */
  tema?: Tema;
  acertos: number;
  total: number;
  /** Ausente na revisão de erros, que não emite veredito. */
  aprovado?: boolean;
  /** Presente só na prova completa. */
  materias?: MateriaResumo[];
  /**
   * Bateria de desafio: o link volta no texto para quem receber poder fazer a
   * mesma, e o código da bateria denuncia bancos divergentes.
   */
  desafio?: { semente: string; link: string; codigo: string };
}

function placar(acertos: number, total: number): string {
  const pct = total > 0 ? Math.round((acertos / total) * 100) : 0;
  return `${acertos}/${total} (${pct}%)`;
}

/**
 * O resultado em uma linha, para colar em qualquer lugar.
 *
 * Texto e não imagem: dobra menos código, cabe em qualquer grupo de mensagens
 * e continua legível para quem usa leitor de tela do outro lado.
 */
export function resumoDeTexto(r: ResumoBateria): string {
  const linhas: string[] = [];

  if (r.materias) {
    linhas.push(
      `Prova completa de radioamador — Classe ${r.classe}: ${
        r.aprovado ? "Aprovado" : "Reprovado"
      }`,
    );
    for (const m of r.materias) {
      linhas.push(
        `· ${ROTULO_CURTO[m.tema]}: ${placar(m.acertos, m.total)} — ${
          m.aprovado ? "aprovado" : "reprovado"
        }`,
      );
    }
  } else {
    const materia = r.tema ? ` · ${ROTULO_CURTO[r.tema]}` : "";
    const veredito =
      r.aprovado === undefined
        ? ""
        : ` · ${r.aprovado ? "Aprovado" : "Reprovado"}`;
    linhas.push(
      `Simulado de radioamador — Classe ${r.classe}${materia}: ${placar(
        r.acertos,
        r.total,
      )}${veredito}`,
    );
  }

  // O link do desafio vem antes do link do projeto: quem lê a mensagem no
  // grupo quer fazer a MESMA bateria, e é o primeiro que faz isso acontecer.
  if (r.desafio) {
    linhas.push(
      `Desafio ${r.desafio.semente} · bateria ${r.desafio.codigo}`,
      r.desafio.link,
    );
  }

  linhas.push(URL_PROJETO);
  return linhas.join("\n");
}
