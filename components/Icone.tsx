/**
 * Os ícones do app, como SVG.
 *
 * Eram glifos Unicode — ☰ ⚑ ▼ ▲ › ‹ ⚠ —, e glifo não é ícone: cada plataforma
 * desenha o seu, o peso não acompanha o texto ao redor, e alguns viram emoji
 * colorido no Android e no iOS (a bandeira do "marcar para revisar" chegava a
 * aparecer vermelha, competindo com o vermelho de erro). Em SVG, todos herdam
 * `currentColor` e a mesma espessura de traço.
 *
 * Os desenhos são os do conjunto Lucide (licença ISC), copiados como `path`
 * para não trazer dependência de runtime a um app que precisa abrir offline.
 *
 * `aria-hidden` por padrão: o ícone acompanha um rótulo de texto em todos os
 * usos do app — é decoração, e anunciá-lo seria repetir o que já está escrito.
 */
export type NomeIcone =
  | "menu"
  | "bandeira"
  | "alerta"
  | "seta-baixo"
  | "seta-direita"
  | "seta-esquerda"
  | "fechar";

const CAMINHOS: Record<NomeIcone, React.ReactNode> = {
  menu: (
    <>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </>
  ),
  bandeira: (
    <>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V4s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <path d="M4 22v-7" />
    </>
  ),
  alerta: (
    <>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </>
  ),
  "seta-baixo": <path d="m6 9 6 6 6-6" />,
  "seta-direita": <path d="m9 18 6-6-6-6" />,
  "seta-esquerda": <path d="m15 18-6-6 6-6" />,
  fechar: (
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>
  ),
};

export default function Icone({
  nome,
  className = "h-4 w-4",
}: {
  nome: NomeIcone;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={`inline-block shrink-0 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {CAMINHOS[nome]}
    </svg>
  );
}
