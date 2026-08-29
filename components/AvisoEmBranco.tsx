import type { MotivoFim } from "@/lib/tipos";

/**
 * "N questões ficaram sem resposta e contam como erro."
 *
 * Vive num componente próprio porque a mesma frase precisa aparecer em três
 * telas — resultado, intervalo entre matérias e consolidado — e só a primeira
 * a tinha. Na prova completa, que é a cronometrada, quem estourou o tempo
 * ficava sem saber por que perdeu pontos: o intervalo mostrava "10/15 ·
 * Aprovado na matéria" e nenhuma menção às cinco em branco.
 *
 * `motivoFim` importa: encerrar à mão também deixa questões em branco, e
 * anunciar "tempo esgotado" nesse caso seria mentira.
 */
export default function AvisoEmBranco({
  naoRespondidas,
  motivoFim = "manual",
}: {
  naoRespondidas: number;
  motivoFim?: MotivoFim;
}) {
  if (naoRespondidas === 0) return null;
  return (
    <p className="mt-2 text-sm font-medium text-rose-700 dark:text-rose-400">
      {motivoFim === "tempo" ? "Tempo esgotado: " : ""}
      {naoRespondidas}{" "}
      {naoRespondidas === 1
        ? "questão ficou sem resposta e conta"
        : "questões ficaram sem resposta e contam"}{" "}
      como erro, igual à prova real.
    </p>
  );
}
