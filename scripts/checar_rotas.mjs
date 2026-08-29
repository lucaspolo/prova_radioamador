// Confere que um site publicado serve TODAS as rotas do app por caminho
// limpo — `/estudar`, e não só `/estudar.html`.
//
//   node scripts/checar_rotas.mjs https://prova-radioamador.vercel.app
//
// Existe porque o defeito que isto pega não aparece no build nem em
// `next dev`: o export gera `out/estudar.html`, o servidor de desenvolvimento
// serve `/estudar`, e só o host de produção decide se um caminho sem extensão
// encontra o arquivo (`cleanUrls` em `vercel.json`). Enquanto não encontrava,
// `/estudar` respondia 404 — o link que a tela existe para ser compartilhado
// não abria, e o pré-cache do service worker rejeitava por causa dele,
// deixando o app sem offline e sem instalação.
import { CASCAS } from "./cascas.mjs";

const base = (process.argv[2] || "").replace(/\/$/, "");
if (!base) {
  console.error("uso: node scripts/checar_rotas.mjs <url-base>");
  process.exit(2);
}

const falhas = [];
for (const rota of Object.keys(CASCAS)) {
  const url = base + rota;
  try {
    // GET e não HEAD: alguns hosts respondem HEAD por outro caminho.
    const r = await fetch(url, { redirect: "follow" });
    console.log(`${r.ok ? "ok  " : "FALHA"} ${r.status} ${url}`);
    if (!r.ok) falhas.push(`${url} → ${r.status}`);
  } catch (e) {
    console.log(`FALHA --- ${url} (${e.message})`);
    falhas.push(`${url} → ${e.message}`);
  }
}

if (falhas.length) {
  console.error(`\n${falhas.length} rota(s) sem resposta 200:\n  ${falhas.join("\n  ")}`);
  process.exit(1);
}
console.log(`\n${Object.keys(CASCAS).length} rotas ok.`);
