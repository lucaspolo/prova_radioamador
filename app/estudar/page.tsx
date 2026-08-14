import type { Metadata } from "next";
import TelaEstudar from "@/components/TelaEstudar";

export const metadata: Metadata = {
  title: "Material de estudo — Radioamador (Anatel)",
  description:
    "A ementa oficial do exame de radioamador da Anatel (Ato nº 3448/2026, item 11.4), com o trecho do material que cobre cada item e os PDFs oficiais para baixar.",
};

/**
 * Rota própria, e não uma etapa de `app/page.tsx` como as outras telas.
 *
 * A regra do app é etapa, porque o service worker responde toda navegação com
 * a casca de `/` — um deep link para uma etapa, sem rede, renderizaria a home.
 * Aqui a exceção se paga: material de estudo se lê devagar, se deixa aberto
 * numa aba e se manda para o colega do radioclube, e nada disso funciona sem
 * endereço. `scripts/gerar_sw.mjs` dá casca própria a `/estudar`, como já faz
 * com `/conferencia`.
 */
export default function Estudar() {
  return <TelaEstudar />;
}
