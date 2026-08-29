// As rotas reais do app e o HTML que o export gerou para cada uma.
//
// Fonte única de três coisas: o que entra no pré-cache do service worker, qual
// casca responde uma navegação offline (`scripts/gerar_sw.mjs`) e o que
// `scripts/checar_rotas.mjs` confere num site publicado.
//
// Uma rota fora daqui cairia na casca de "/" e renderizaria a home.
export const CASCAS = {
  "/": "index.html",
  "/conferencia": "conferencia.html",
  "/estudar": "estudar.html",
};
