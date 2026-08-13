import { ATO_3448, CARTILHA } from "./secoes";

/**
 * Os atalhos para o procedimento do exame — a única parte do material que o
 * app deliberadamente não transforma em questão.
 *
 * O gerador descarta cadastro no SEI e no SEC, agendamento, ambiente da prova
 * online, inscrição de menor, isenção de matéria e consulta de resultado
 * (item 8 do prompt em `scripts/processar_pdfs.py`, e o comentário de
 * `PAGINAS_REFORCO` que exclui as pp. 8-9 pelo mesmo motivo): a ementa cobra o
 * Serviço de Radioamador, não o processo de se inscrever na prova. A exclusão
 * está certa — mas quem VAI prestar o exame precisa exatamente disso, e a
 * informação já estava no bolso da pessoa, no PDF baixado, sem caminho até
 * lá. Daí o atalho.
 *
 * Não se escreve prosa própria sobre agendamento aqui. Um resumo nosso
 * envelhece a cada mudança de sistema da Anatel e tensiona a regra do projeto
 * — a fonte é o material publicado. O `rotulo` é índice, não conteúdo: quem
 * responde é a página.
 *
 * `ancora` é uma string literal daquela página, conferida por
 * `testes/atalhos.test.ts` contra o PDF. Se a Anatel republicar o material com
 * outra paginação, o teste cai — em vez de o atalho passar a abrir, calado, a
 * página errada.
 */
export interface Atalho {
  arquivo: string;
  pagina: number;
  /** Rótulo curto: o que a página responde. */
  rotulo: string;
  /** Trecho literal que existe na página apontada. */
  ancora: string;
}

/** Na ordem em que o candidato encontra cada assunto. */
export const ATALHOS_DA_PROVA: Atalho[] = [
  {
    arquivo: CARTILHA,
    pagina: 8,
    rotulo: "Antes da prova: documentos, cadastro no SEI e no SEC, inscrição",
    ancora: "O que você precisa antes de começar",
  },
  {
    arquivo: CARTILHA,
    pagina: 9,
    rotulo: "No dia: como funciona a prova online e o que é proibido",
    ancora: "acompanhada por avaliador via videoconferência",
  },
  {
    arquivo: CARTILHA,
    pagina: 24,
    rotulo: "Questões, mínimo de acertos e tempo, por classe e matéria",
    ancora: "MÍNIMO PARA APROVAÇÃO",
  },
  {
    arquivo: ATO_3448,
    pagina: 6,
    rotulo: "Créditos por matéria, carência para repetir, revisão e isenção",
    ancora: "carência mínima de 8 (oito) dias",
  },
  {
    arquivo: CARTILHA,
    pagina: 10,
    rotulo: "Depois de aprovado: COER, outorga e licença da estação",
    ancora: "LICENCIAMENTO E AUTORIZAÇÃO DE ESTAÇÃO",
  },
];
