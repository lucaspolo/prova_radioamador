import { BANCO } from "@/lib/questoes";

let falhas = 0;
function checar(nome: string, ok: boolean, detalhe = "") {
  if (!ok) falhas++;
  console.log(`${ok ? "  ok  " : "FALHA "} ${nome}${detalhe ? " — " + detalhe : ""}`);
}

function norm(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/x[ -]?ray/g, "x-ray");
}

// Texto pesquisável de cada questão: a cobertura vale se a letra/código é
// objeto da afirmação ou aparece corrigida na explicação (nas falsas, a
// palavra certa mora na explicação).
const TEXTOS = BANCO.map((q) => norm(`${q.afirmacao} ${q.explicacao_curta}`));

// --- Alfabeto fonético da UIT: as 26 letras (Cartilha, pp. 34-35) ----------
{
  const FONETICO: Record<string, string> = {
    A: "alfa", B: "bravo", C: "charlie", D: "delta", E: "echo", F: "foxtrot",
    G: "golf", H: "hotel", I: "india", J: "juliett", K: "kilo", L: "lima",
    M: "mike", N: "november", O: "oscar", P: "papa", Q: "quebec", R: "romeo",
    S: "sierra", T: "tango", U: "uniform", V: "victor", W: "whiskey",
    X: "x-ray", Y: "yankee", Z: "zulu",
  };

  // Só conta questão que é de fato sobre soletração, senão "Lima" (cidade) ou
  // "papa" em outro contexto dariam cobertura falsa.
  const deAlfabeto = TEXTOS.filter((t) => /fonetic|soletra/.test(t));
  const faltam = Object.entries(FONETICO)
    .filter(([, palavra]) =>
      !deAlfabeto.some((t) => new RegExp(`\\b${palavra}\\b`).test(t)),
    )
    .map(([letra]) => letra);

  checar(
    "todas as 26 letras do alfabeto fonético têm questão",
    faltam.length === 0,
    faltam.length ? `faltam: ${faltam.join(" ")}` : `${deAlfabeto.length} questões de soletração`,
  );
}

// --- Código Q: os 28 usuais do radioamadorismo (Cartilha, p. 36) -----------
{
  const CODIGOS = [
    // os 11 da tabela da Cartilha
    "QRA", "QRG", "QTH", "QSL", "QRO", "QTC", "QRM", "QRP", "QRV", "QRT", "QSA",
    // demais usuais da série QRA-QUZ reservada ao radioamadorismo
    "QRH", "QRI", "QRK", "QRL", "QRN", "QRQ", "QRS", "QRU", "QRX", "QRZ",
    "QSB", "QSD", "QSK", "QSO", "QSP", "QSY", "QTR",
  ];
  checar("a lista cobre os 28 códigos usuais", CODIGOS.length === 28);

  const faltam = CODIGOS.filter(
    (c) => !TEXTOS.some((t) => new RegExp(`\\b${c.toLowerCase()}\\b`).test(t)),
  );
  checar(
    "todos os 28 códigos Q usuais têm questão",
    faltam.length === 0,
    faltam.length ? `faltam: ${faltam.join(" ")}` : "cobertura completa",
  );

  // Cada código precisa ser OBJETO de uma questão, não só citado de passagem
  // na explicação de outra: a afirmação é o que o simulado exercita.
  const soDePassagem = CODIGOS.filter(
    (c) => !BANCO.some((q) => new RegExp(`\\b${c}\\b`).test(q.afirmacao)),
  );
  checar(
    "cada código aparece na afirmação de alguma questão",
    soDePassagem.length === 0,
    soDePassagem.length ? `só de passagem: ${soDePassagem.join(" ")}` : "",
  );
}

console.log(`\n${falhas === 0 ? "TODOS OS TESTES DE COBERTURA PASSARAM" : falhas + " FALHA(S)"}`);
process.exit(falhas === 0 ? 0 : 1);
