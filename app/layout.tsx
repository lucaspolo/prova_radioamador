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

/**
 * Aplica tema e escala antes da primeira pintura.
 *
 * Sem isto o app pinta com o tema do sistema e salta para o escolhido só na
 * hidratação — um flash branco na cara de quem estuda no escuro. Precisa ser
 * inline e síncrono, e tolerar `localStorage` bloqueado (modo privado, cookies
 * de terceiros desligados), porque falhar aqui deixaria a página em branco.
 */
const ANTI_FLASH = `try{
var p=JSON.parse(localStorage.getItem("prova-radioamador:preferencias")||"{}");
if(p.tema==="claro"||p.tema==="escuro")document.documentElement.setAttribute("data-tema",p.tema);
var f={pequeno:.9,normal:1,grande:1.15}[p.escala];
if(f)document.documentElement.style.setProperty("--escala-fonte",f);
}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // `suppressHydrationWarning` porque o próprio ANTI_FLASH é a divergência:
    // ele crava `data-tema` e `--escala-fonte` no <html> antes da hidratação,
    // e o HTML do export estático não tem como trazê-los (são do storage de
    // cada aparelho). Sem isto o React acusa mismatch a cada carregamento de
    // quem escolheu tema ou tamanho de texto. O atributo vale só para esta
    // tag — divergência em qualquer componente continua sendo denunciada.
    <html lang="pt-BR" className="h-full antialiased" suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <script dangerouslySetInnerHTML={{ __html: ANTI_FLASH }} />
        <RegistroSW />
        {children}
        <footer className="nao-imprimir mx-auto w-full max-w-2xl px-4 pb-6 text-center text-xs text-slate-400 dark:text-slate-500">
          Código aberto sob a licença MIT —{" "}
          <a
            href="https://github.com/lucaspolo/prova_radioamador"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4 hover:text-slate-600 dark:hover:text-slate-300"
          >
            github.com/lucaspolo/prova_radioamador
          </a>
        </footer>
      </body>
    </html>
  );
}
