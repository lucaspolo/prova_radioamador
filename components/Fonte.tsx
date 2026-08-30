import { ROTULO_ARQUIVO } from "@/lib/secoes";
import type { Origem } from "@/lib/tipos";

/**
 * De onde saiu o que está na tela, com o nome que uma pessoa reconhece.
 *
 * Quatro telas imprimiam o nome do arquivo cru — "Fonte: 2026-06-30
 * CARTILHA-RADIOAMADOR-v9 2026-06.pdf · página 49", "SEI_ANATEL - 15307586 -
 * Ato_orginal.pdf" —, enquanto `ROTULO_ARQUIVO` já existia e a lista de
 * material e os atalhos da prova já o usavam, na mesma sessão. Duas linhas no
 * celular para dizer "Cartilha do Radioamador", e um nome de arquivo de
 * digitalização interna da Anatel oferecido como referência de estudo.
 *
 * Pior: essa linha não fica no app. Ela vai na revisão impressa e no texto que
 * se compartilha no grupo do radioclube — é o que sobra depois que a tela
 * fecha.
 *
 * O nome do arquivo continua acessível no `title`, para quem precisar conferir
 * contra o PDF baixado.
 */
export default function Fonte({
  arquivo,
  detalhe,
  origem = "documento",
}: {
  arquivo: string;
  /** O recorte dentro do documento: "página 40", "Tabela II, páginas 8–9". */
  detalhe?: string;
  /**
   * Questão de ementa não nasce de uma frase do PDF: a página indicada explica
   * o tema, mas não traz o enunciado. Chamar isso de "Fonte" faria procurar no
   * documento uma frase que não está lá.
   */
  origem?: Origem;
}) {
  return (
    <>
      <span className="font-medium">
        {origem === "documento" ? "Fonte:" : "Estude o tema em:"}
      </span>{" "}
      <span title={arquivo}>{ROTULO_ARQUIVO[arquivo] ?? arquivo}</span>
      {detalhe && <> · {detalhe}</>}
    </>
  );
}
