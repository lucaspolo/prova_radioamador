import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Simulados — Radioamador Classe B",
  description:
    "Simulados de Verdadeiro ou Falso para o exame de radioamador Classe B da Anatel.",
};

export const viewport: Viewport = {
  // Tinge a barra do navegador no celular com a cor de fundo do app, nos dois
  // temas, para a interface não terminar numa faixa branca ou preta destoante.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1120" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
