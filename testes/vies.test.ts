import { BANCO } from "@/lib/questoes";
import type { Questao } from "@/lib/tipos";

let falhas = 0;
function checar(nome: string, ok: boolean, detalhe = "") {
  if (!ok) falhas++;
  console.log(
    `${ok ? "  ok  " : "FALHA "} ${nome}${detalhe ? " — " + detalhe : ""}`,
  );
}

/**
 * O gabarito não pode ser adivinhável sem ler a questão.
 *
 * Um simulado de verdadeiro/falso tem uma fragilidade que um de múltipla
 * escolha não tem: só existem duas respostas, então qualquer regularidade do
 * gabarito vira estratégia. Se as verdadeiras forem mais numerosas, chutar tudo
 * "V" aprova; se forem mais compridas, contar caracteres aprova. Nos dois casos
 * o app devolve um veredito de aprovação a quem não sabe a matéria — que é o
 * único erro que um simulado de véspera não pode cometer.
 *
 * Nada disso aparece revisando questão por questão: cada uma continua correta,
 * bem escrita e bem explicada. O viés é uma propriedade do conjunto, e só um
 * teste sobre o conjunto inteiro o enxerga. Daí este arquivo, separado de
 * `dataset.test.ts` (que confere as promessas do README) e de
 * `cobertura.test.ts` (que confere o que a ementa exige).
 *
 * A regeneração do banco é um passe de LLM, não uma edição: ninguém revisa 914
 * questões à mão depois. Estes números são o que sobra para perceber que o
 * próximo lote reintroduziu o padrão.
 */

const V = (q: Questao) => q.resposta_correta;
const comprimento = (q: Questao) => q.afirmacao.length;

function proporcaoV(questoes: Questao[]): number {
  return questoes.filter(V).length / questoes.length;
}

/**
 * Testa uma fatia do banco contra a moeda honesta.
 *
 * A tolerância é maior nas fatias pequenas de propósito: com 8 questões, 5
 * verdadeiras é o que uma moeda produz uma vez em cada quatro, e reprovar isso
 * seria exigir do gerador uma simetria que nem o acaso tem.
 */
function equilibrio(rotulo: string, questoes: Questao[], tolerancia: number) {
  const p = proporcaoV(questoes);
  const ok = Math.abs(p - 0.5) <= tolerancia;
  checar(
    `${rotulo}: V/F equilibrado (n=${questoes.length}, P(V) = ${(100 * p).toFixed(1)}%)`,
    ok,
    ok
      ? ""
      : `fora da faixa ${(100 * (0.5 - tolerancia)).toFixed(0)}–${(100 * (0.5 + tolerancia)).toFixed(0)}%`,
  );
}

/**
 * O mesmo, para muitos grupos pequenos de uma vez.
 *
 * São 34 tópicos e 55 trechos: uma linha para cada afogaria a saída do teste, e
 * a saída existe para alguém ler depois de regerar o banco. Uma linha por
 * família, nomeando só quem estourou.
 */
function equilibrioDosGrupos(
  rotulo: string,
  grupos: Map<string, Questao[]>,
  minimo: number,
  tolerancia: number,
) {
  const avaliados = [...grupos].filter(([, qs]) => qs.length >= minimo);
  const fora = avaliados
    .filter(([, qs]) => Math.abs(proporcaoV(qs) - 0.5) > tolerancia)
    .map(
      ([k, qs]) => `${k.slice(0, 40)} (${qs.filter(V).length}/${qs.length} V)`,
    );
  checar(
    `${rotulo}: nenhum grupo desequilibrado (${avaliados.length} com ${minimo}+ questões)`,
    fora.length === 0,
    fora.slice(0, 4).join(", "),
  );
}

function agrupar<T>(itens: T[], chave: (item: T) => string | undefined) {
  const mapa = new Map<string, T[]>();
  for (const item of itens) {
    const k = chave(item);
    if (k === undefined) continue;
    const atual = mapa.get(k);
    if (atual) atual.push(item);
    else mapa.set(k, [item]);
  }
  return mapa;
}

/**
 * Área sob a curva ROC do comprimento como preditor da resposta.
 *
 * Lido sem estatística: a probabilidade de uma verdadeira sorteada ao acaso ser
 * mais comprida que uma falsa sorteada ao acaso. 0,5 é o banco em que o
 * tamanho não diz nada; 1,0 é o banco em que a mais comprida de duas questões
 * é sempre a verdadeira. Empates contam meio, senão um banco de frases todas
 * do mesmo tamanho — o ideal — pontuaria 0.
 */
function aucComprimento(questoes: Questao[]): number {
  const verdadeiras = questoes.filter(V).map(comprimento);
  const falsas = questoes.filter((q) => !V(q)).map(comprimento);
  let soma = 0;
  for (const v of verdadeiras) {
    for (const f of falsas) soma += v > f ? 1 : v === f ? 0.5 : 0;
  }
  return soma / (verdadeiras.length * falsas.length);
}

/** A quinta parte mais comprida do banco: onde a pista, se existe, é mais forte. */
function quintilMaisLongo(questoes: Questao[]): Questao[] {
  const ordenadas = [...questoes].sort(
    (a, b) => comprimento(a) - comprimento(b),
  );
  return ordenadas.slice(Math.floor((ordenadas.length * 4) / 5));
}

/**
 * Uma catraca, e não um limite: o valor de hoje é o teto, e o alvo é onde isto
 * deveria estar. Serve para o defeito conhecido, que não se conserta sem
 * reescrever as afirmações — e o id da questão é o hash da própria afirmação
 * (`scripts/processar_pdfs.py`), então reescrever aposenta o histórico de
 * acertos que o navegador guarda. Enquanto essa troca não é feita, o teste
 * garante ao menos que o banco não piora, e imprime a distância que falta.
 */
function catraca(rotulo: string, valor: number, teto: number, alvo: number) {
  const ok = valor <= teto;
  if (!ok) falhas++;
  const casas = valor.toFixed(3);
  console.log(
    ok
      ? `  ok   ${rotulo} = ${casas} (teto ${teto}, alvo ${alvo}${valor > alvo ? " — ainda acima" : ""})`
      : `FALHA  ${rotulo} = ${casas} — piorou, o teto é ${teto}`,
  );
}

// --- 1. Contagem: chutar tudo "V" ou tudo "F" não pode ser estratégia -------
// A prova real são três exames separados, cada um de uma matéria, e o corte é
// por matéria. Então o equilíbrio que importa é o de cada fatia que pode virar
// uma bateria inteira — não o do banco somado, que esconde duas matérias
// tortas para lados opostos.
console.log("\n--- Equilíbrio do gabarito ---");
equilibrio("Banco inteiro", BANCO, 0.03);

for (const [tema, questoes] of agrupar(BANCO, (q) => q.tema)) {
  equilibrio(`Matéria ${tema}`, questoes, 0.05);
}
for (const [nivel, questoes] of agrupar(BANCO, (q) => q.nivel)) {
  equilibrio(`Nível ${nivel}`, questoes, 0.06);
}
for (const [origem, questoes] of agrupar(BANCO, (q) => q.origem)) {
  equilibrio(`Origem ${origem}`, questoes, 0.06);
}

// Cada PDF é um passe de geração próprio, com o seu prompt: um deles pode
// desandar sozinho sem mover o total. Abaixo de 30 questões o ruído domina.
for (const [arquivo, questoes] of agrupar(BANCO, (q) => q.arquivo_origem)) {
  if (questoes.length >= 30) equilibrio(`Arquivo ${arquivo}`, questoes, 0.06);
}

// O peso próprio muda a chance de a questão ser sorteada. Se as 32 questões de
// peso reduzido fossem todas de um lado, o banco pareceria equilibrado e a
// bateria não seria.
{
  const total = BANCO.reduce((s, q) => s + (q.peso ?? 1), 0);
  const deV = BANCO.filter(V).reduce((s, q) => s + (q.peso ?? 1), 0);
  checar(
    "Equilíbrio ponderado pelo peso de sorteio",
    Math.abs(deV / total - 0.5) <= 0.03,
    `P(V) ponderada = ${(100 * (deV / total)).toFixed(1)}%`,
  );
}

// --- 2. Blocos: o mesmo trecho e o mesmo tópico não respondem em coro ------
// As questões de um trecho nascem de uma chamada só ao modelo, e as de um
// tópico da ementa também. É onde o gerador tem a chance de repetir a mesma
// resposta oito vezes seguidas — e são justamente as questões que costumam
// aparecer juntas na mesma bateria.
console.log("\n--- Blocos da mesma geração ---");
{
  const homogeneos = [...agrupar(BANCO, (q) => q.trecho_id)]
    .filter(([, qs]) => qs.length >= 3 && new Set(qs.map(V)).size === 1)
    .map(([id, qs]) => `${id} (${qs.length}×${V(qs[0]) ? "V" : "F"})`);
  checar(
    "Nenhum trecho com 3+ questões de resposta única",
    homogeneos.length === 0,
    homogeneos.slice(0, 3).join(", "),
  );
}
equilibrioDosGrupos(
  "Trechos",
  agrupar(BANCO, (q) => q.trecho_id),
  8,
  0.2,
);
equilibrioDosGrupos(
  "Tópicos da ementa",
  agrupar(BANCO, (q) => q.topico),
  8,
  0.2,
);

// --- 3. Comprimento: o defeito conhecido -----------------------------------
// A falsa nasce trocando um valor de uma frase curta ("Uma indutância de
// 0,15 H equivale a 15 mH."); a verdadeira nasce parafraseando a norma com
// todas as ressalvas dela ("...é permitida exclusivamente para: A, B ou C").
// O resultado é um gabarito que se lê no tamanho da frase: quem responder "V"
// a tudo que passa de 136 caracteres acerta 60% do banco sem ler nada, e isso
// aprova em 65% a 93% das baterias, conforme a matéria e a classe.
//
// O conserto é de geração, não de código: os prompts de
// `scripts/processar_pdfs.py` mandam equilibrar a CONTAGEM de verdadeiras e
// falsas e não dizem nada sobre o tamanho delas. Enquanto o banco não é
// regerado com a regra nova, estas catracas impedem que piore.
console.log("\n--- Comprimento da afirmação como pista ---");
catraca("AUC do comprimento (banco)", aucComprimento(BANCO), 0.64, 0.55);

for (const [tema, questoes] of agrupar(BANCO, (q) => q.tema)) {
  catraca(`AUC do comprimento · ${tema}`, aucComprimento(questoes), 0.68, 0.55);
}
// O nível A é o pior recorte do banco: as exclusivas da Classe A são contas de
// RF, e o enunciado que traz os dados da conta quase nunca é o falso.
for (const [nivel, questoes] of agrupar(BANCO, (q) => q.nivel)) {
  catraca(
    `AUC do comprimento · nível ${nivel}`,
    aucComprimento(questoes),
    0.75,
    0.55,
  );
}

catraca(
  "P(V) no quintil mais longo",
  proporcaoV(quintilMaisLongo(BANCO)),
  0.79,
  0.6,
);

{
  const medianaV = mediana(BANCO.filter(V).map(comprimento));
  const medianaF = mediana(BANCO.filter((q) => !V(q)).map(comprimento));
  catraca(
    "Excesso de comprimento das verdadeiras (mediana V ÷ mediana F)",
    medianaV / medianaF,
    1.25,
    1.05,
  );
}

function mediana(valores: number[]): number {
  const o = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(o.length / 2);
  return o.length % 2 ? o[meio] : (o[meio - 1] + o[meio]) / 2;
}

console.log(
  `\n${falhas === 0 ? "TODOS OS TESTES DE VIÉS PASSARAM" : falhas + " FALHA(S)"}`,
);
process.exit(falhas === 0 ? 0 : 1);
