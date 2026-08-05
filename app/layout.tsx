import type { Metadata, Viewport } from "next";
import "./globals.css";
import RegistroSW from "@/components/RegistroSW";

export const metadata: Metadata = {
  title: "Simulados — Radioamador (Anatel)",
  description:
    "Simulados de certo ou errado para as provas de radioamador da Anatel, classes A, B e C.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icone-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icone-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icone-180.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Radioamador",
  },
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
      <body className="flex min-h-full flex-col">
        <RegistroSW />
        {children}
      </body>
    </html>
  );
}
