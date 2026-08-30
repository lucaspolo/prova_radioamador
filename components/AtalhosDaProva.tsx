import { ATALHOS_DA_PROVA } from "@/lib/atalhos";
import { ROTULO_ARQUIVO } from "@/lib/secoes";
import BotaoConsultarMaterial from "./BotaoConsultarMaterial";

/**
 * "Como faço a prova?" — a pergunta que o banco de questões não responde de
 * propósito (ver `lib/atalhos.ts`) e que o material publicado responde inteira.
 *
 * Cada item é rótulo + botão para a página; nenhum explica o procedimento com
 * palavras nossas. Funciona offline como o resto: o PDF vem do cache do
 * service worker, e o pré-download ao lado garante que ele esteja lá.
 */
export default function AtalhosDaProva() {
  return (
    <section className="rounded-xl border border-borda bg-superficie p-4">
      <h3 className="font-semibold">A prova em si</h3>
      <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
        Não há questão sobre o procedimento do exame — a ementa cobra o serviço,
        não o processo de se inscrever nele. Mas está tudo no material oficial:
        cada atalho abre a página que responde.
      </p>

      <ul className="mt-3 divide-y divide-slate-200 dark:divide-slate-800">
        {ATALHOS_DA_PROVA.map((a) => (
          <li key={a.rotulo} className="py-3 first:pt-0 last:pb-0">
            <p className="text-sm font-medium">{a.rotulo}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {ROTULO_ARQUIVO[a.arquivo] ?? a.arquivo}
            </p>
            <BotaoConsultarMaterial
              arquivoOrigem={a.arquivo}
              pagina={a.pagina}
              origem="documento"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
