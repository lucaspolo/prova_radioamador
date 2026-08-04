import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Simulados — Radioamador Classe B",
  description:
    "Simulados de Verdadeiro ou Falso para o exame de radioamador Classe B da Anatel.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
