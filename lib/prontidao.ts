import type { Classe, Tema } from "./tipos";
import { FORMATO, percentualAprovacao, TEMAS } from "./constantes";
import type { Historico } from "./historico";

/**
 * "Se a prova fosse hoje, eu passava?" — respondida na forma honesta.
 *
 * A honestidade tem três partes. A janela é RECENTE (as últimas baterias, não
 * o acumulado): quem melhorou não carrega a média ruim do primeiro dia. O
 * corte é o da CLASSE, por matéria — a prova exige o mínimo nas três, e é a
 * mais fraca que decide. E o resultado é um fato, não uma previsão: treino
 * com gabarito imediato não é prova cega, então a interface diz "ficou acima
 * do corte em N das últimas M baterias", nunca "você passaria".
 */
export interface ProntidaoMateria {
  tema: Tema;
  /** Quantas baterias entraram na janela — pode ser menos que o pedido. */
  baterias: number;
  /** Dessas, quantas ficaram no percentual de aprovação da classe ou acima. */
  acimaDoCorte: number;
  /**
   * A janela considerou apenas baterias do tamanho oficial da classe? Uma
   * bateria de 10 não mede o fôlego de 30 questões em 40 minutos; quando
   * existem baterias do tamanho da prova, só elas contam.
   */
  soOficiais: boolean;
}

export function prontidao(
  historico: Historico,
  classe: Classe,
  n = 5,
): ProntidaoMateria[] {
  const corte = percentualAprovacao(classe);
  const oficial = FORMATO[classe].questoes;

  return TEMAS.map((tema) => {
    // Revisão fica de fora por construção (escolha === tema): ela só tem o
    // que o usuário errou, e mediria reprovação por definição. Registros de
    // outra classe também; os anteriores ao campo `classe` entram — são
    // treino da mesma matéria, e descartá-los zeraria a prontidão de todo
    // mundo no dia em que o campo nasceu.
    const daMateria = historico.simulados.filter(
      (s) =>
        s.escolha === tema && (s.classe === undefined || s.classe === classe),
    );
    const oficiais = daMateria.filter((s) => s.total >= oficial);
    const base = oficiais.length > 0 ? oficiais : daMateria;
    // `simulados` já vem do mais recente para o mais antigo.
    const janela = base.slice(0, n);
    // Inteiros dos dois lados: `acertos/total >= corte/100` em ponto
    // flutuante erraria exatamente na nota de corte.
    const acimaDoCorte = janela.filter(
      (s) => s.total > 0 && s.acertos * 100 >= corte * s.total,
    ).length;
    return {
      tema,
      baterias: janela.length,
      acimaDoCorte,
      soOficiais: oficiais.length > 0,
    };
  });
}
