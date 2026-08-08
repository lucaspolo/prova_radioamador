import type { Metadata } from "next";
import TelaConferencia from "@/components/TelaConferencia";

export const metadata: Metadata = {
  title: "Conferência do banco — Radioamador",
  description:
    "Revisão manual do banco de questões, com o PDF de origem ao lado.",
  // Ferramenta de manutenção do banco: não é conteúdo de estudo e não tem por
  // que aparecer em busca. A página sai no export estático porque `output:
  // "export"` publica tudo que está em app/ — e publicá-la não custa nada:
  // ela só lê os dois JSON que o site já serve.
  robots: { index: false, follow: false },
};

export default function Conferencia() {
  return <TelaConferencia />;
}
