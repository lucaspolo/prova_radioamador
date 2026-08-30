/**
 * A marca do app: a antena que já existe no ícone instalado.
 *
 * O ícone do PWA — mastro com o ponto âmbar no vértice e duas ondas — é o
 * melhor desenho do produto, e não aparecia em pixel nenhum da interface: o
 * cabeçalho era texto de sistema, e o app tinha a cara de qualquer projeto
 * Next+Tailwind recém-criado. Aqui ela entra como SVG e não como imagem para
 * herdar a cor do texto (funciona nos dois temas sem segundo arquivo) e para
 * não custar uma requisição.
 *
 * O ponto âmbar é o único uso dessa cor que não significa "atenção": é a
 * assinatura, e por isso não carrega texto nem estado.
 */
export default function Antena({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M12 21V9.5" />
      <path d="M8.5 21h7" />
      <path d="M6.6 11.4a7 7 0 0 1 0-8.8" opacity="0.55" />
      <path d="M17.4 11.4a7 7 0 0 0 0-8.8" opacity="0.55" />
      <circle cx="12" cy="7" r="2.4" fill="#f59e0b" stroke="none" />
    </svg>
  );
}
