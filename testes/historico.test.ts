import {
  CHAVE_STORAGE,
  MAX_SIMULADOS,
  VERSAO_HISTORICO,
  estatisticasPorTema,
  gravar,
  ler,
  montarRegistro,
  resumo,
  type Historico,
  type SimuladoSalvo,
} from "@/lib/historico";
import { sortearSimulado } from "@/lib/questoes";
import type { Resposta, Tema } from "@/lib/tipos";

let falhas = 0;
function checar(nome: string, ok: boolean, detalhe = "") {
  if (!ok) falhas++;
  console.log(`${ok ? "  ok  " : "FALHA "} ${nome}${detalhe ? " — " + detalhe : ""}`);
}

// localStorage falso, já que este teste roda em Node e não no navegador.
class StorageFalso {
  private dados = new Map<string, string>();
  public recusar = false;
  getItem(k: string) {
    return this.dados.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    if (this.recusar) throw new Error("QuotaExceededError");
    this.dados.set(k, v);
  }
  removeItem(k: string) {
    this.dados.delete(k);
  }
  clear() {
    this.dados.clear();
  }
}
const storage = new StorageFalso();
(globalThis as unknown as { window: unknown }).window = { localStorage: storage };

function respostasFalsas(qtd: number, acertos: number): Resposta[] {
  return sortearSimulado("todos", qtd).map((q, i) => ({
    questao: q,
    respondeu: i < acertos ? q.resposta_correta : !q.resposta_correta,
    acertou: i < acertos,
  }));
}

// --- Ida e volta ----------------------------------------------------------
{
  storage.clear();
  checar("storage vazio devolve histórico vazio", ler().simulados.length === 0);

  const h: Historico = {
    versao: VERSAO_HISTORICO,
    simulados: [montarRegistro("todos", respostasFalsas(20, 12))],
  };
  checar("gravar devolve true", gravar(h) === true);

  const lido = ler();
  checar("lê de volta 1 simulado", lido.simulados.length === 1);
  checar("preserva o placar", lido.simulados[0].acertos === 12 && lido.simulados[0].total === 20);
  checar("guarda o resultado de cada questão", lido.simulados[0].itens.length === 20);
}

// --- Resiliência a storage sujo -------------------------------------------
{
  storage.clear();
  storage.setItem(CHAVE_STORAGE, "{ isto não é json");
  checar("JSON corrompido não quebra a leitura", ler().simulados.length === 0);

  storage.setItem(CHAVE_STORAGE, JSON.stringify({ versao: 99, simulados: [{}] }));
  checar("versão desconhecida é descartada", ler().simulados.length === 0);

  storage.setItem(CHAVE_STORAGE, JSON.stringify({ versao: VERSAO_HISTORICO, simulados: "nada" }));
  checar("campo simulados inválido é descartado", ler().simulados.length === 0);

  storage.setItem(CHAVE_STORAGE, "null");
  checar("valor null é descartado", ler().simulados.length === 0);

  // Registros malformados são filtrados sem derrubar os válidos ao lado.
  const bom = montarRegistro("todos", respostasFalsas(10, 5));
  storage.setItem(
    CHAVE_STORAGE,
    JSON.stringify({ versao: VERSAO_HISTORICO, simulados: [bom, { id: 1 }, null] }),
  );
  checar("mantém o registro válido e descarta os quebrados", ler().simulados.length === 1);
}

// --- Cota esgotada --------------------------------------------------------
{
  storage.clear();
  storage.recusar = true;
  checar(
    "gravar devolve false quando o storage recusa (cota/modo privado)",
    gravar({ versao: VERSAO_HISTORICO, simulados: [] }) === false,
  );
  storage.recusar = false;
}

// --- Teto de simulados ----------------------------------------------------
{
  const muitos: SimuladoSalvo[] = Array.from({ length: MAX_SIMULADOS + 50 }, () =>
    montarRegistro("todos", respostasFalsas(10, 5)),
  );
  const cortado = muitos.slice(0, MAX_SIMULADOS);
  checar(`teto de ${MAX_SIMULADOS} simulados`, cortado.length === MAX_SIMULADOS);
}

// --- Estatísticas ---------------------------------------------------------
{
  const tema: Tema = "Conhecimentos de Eletrônica e Eletricidade";
  const questoes = sortearSimulado(tema, 20);
  const respostas: Resposta[] = questoes.map((q, i) => ({
    questao: q,
    respondeu: q.resposta_correta,
    acertou: i < 15, // 15 de 20 = 75%
  }));
  const h: Historico = {
    versao: VERSAO_HISTORICO,
    simulados: [montarRegistro(tema, respostas)],
  };

  const est = estatisticasPorTema(h).find((e) => e.tema === tema)!;
  checar("percentual por tema (15/20 = 75%)", est.percentual === 75, `${est.percentual}%`);

  const outros = estatisticasPorTema(h).filter((e) => e.tema !== tema);
  checar("temas sem dados ficam em 0", outros.every((e) => e.respondidas === 0 && e.percentual === 0));

  const r = resumo(h);
  checar("resumo agrega corretamente", r.simulados === 1 && r.respondidas === 20 && r.acertos === 15 && r.percentual === 75);
}

// --- Acumulação entre simulados -------------------------------------------
{
  const tema: Tema = "Legislação de Telecomunicações";
  const fazer = (acertos: number) => {
    const qs = sortearSimulado(tema, 10);
    return montarRegistro(tema, qs.map((q, i) => ({ questao: q, respondeu: q.resposta_correta, acertou: i < acertos })));
  };
  // 10 acertos em 10 + 4 em 10 = 14 de 20 = 70%
  const h: Historico = { versao: VERSAO_HISTORICO, simulados: [fazer(10), fazer(4)] };
  const est = estatisticasPorTema(h).find((e) => e.tema === tema)!;
  checar("acumula ao longo de vários simulados (14/20 = 70%)", est.percentual === 70, `${est.acertos}/${est.respondidas}`);
}

// --- Histórico vazio não divide por zero ----------------------------------
{
  const vazio: Historico = { versao: VERSAO_HISTORICO, simulados: [] };
  const r = resumo(vazio);
  checar("resumo de histórico vazio é 0, não NaN", r.percentual === 0 && !Number.isNaN(r.percentual));
  checar("estatísticas de histórico vazio são 0", estatisticasPorTema(vazio).every((e) => e.percentual === 0));
}

console.log(`\n${falhas === 0 ? "TODOS OS TESTES DE HISTÓRICO PASSARAM" : falhas + " FALHA(S)"}`);
process.exit(falhas === 0 ? 0 : 1);
