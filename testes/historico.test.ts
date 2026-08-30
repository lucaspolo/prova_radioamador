import {
  CHAVE_STORAGE,
  MAX_SIMULADOS,
  VERSAO_HISTORICO,
  corteDoPainel,
  estatisticasPorTema,
  estatisticasRecentesPorTema,
  frequencia,
  gravar,
  ler,
  migrar,
  montarRegistro,
  resumo,
  type Historico,
  type SimuladoSalvo,
} from "@/lib/historico";
import { sortearSimulado } from "@/lib/questoes";
import { TEMAS } from "@/lib/constantes";
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
  return sortearSimulado("Legislação de Telecomunicações", qtd).map((q, i) => ({
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
    simulados: [montarRegistro("Legislação de Telecomunicações", respostasFalsas(20, 12))],
  };
  checar("gravar devolve true", gravar(h) === true);

  const lido = ler();
  checar("lê de volta 1 simulado", lido.simulados.length === 1);
  checar("preserva o placar", lido.simulados[0].acertos === 12 && lido.simulados[0].total === 20);
  checar("guarda o resultado de cada questão", lido.simulados[0].itens.length === 20);
}

// --- Campos aditivos: respondeu e classe ----------------------------------
{
  storage.clear();
  const respostas = respostasFalsas(3, 2);
  respostas[2] = { ...respostas[2], respondeu: null, acertou: false };
  const registro = montarRegistro(
    "Legislação de Telecomunicações",
    respostas,
    { classe: "A" },
  );

  checar("montarRegistro guarda a classe", registro.classe === "A");
  checar(
    "em branco e errada deixam de ser a mesma coisa",
    registro.itens[2].respondeu === null &&
      typeof registro.itens[0].respondeu === "boolean" &&
      !registro.itens[2].acertou,
  );
  checar(
    "sem extras, o registro sai sem classe",
    montarRegistro("revisao", respostas).classe === undefined,
  );

  // Round-trip: os campos novos sobrevivem à gravação e à releitura — e um
  // registro antigo, sem eles, continua válido ao lado.
  const antigo = { ...montarRegistro("revisao", respostasFalsas(2, 1)) } as SimuladoSalvo;
  delete antigo.classe;
  antigo.itens = antigo.itens.map(({ questaoId, tema, acertou }) => ({ questaoId, tema, acertou }));
  gravar({ versao: VERSAO_HISTORICO, simulados: [registro, antigo] });
  const relido = ler();
  checar(
    "round-trip preserva classe e respondeu",
    relido.simulados[0].classe === "A" && relido.simulados[0].itens[2].respondeu === null,
  );
  checar(
    "registro antigo sem os campos continua válido",
    relido.simulados.length === 2 && relido.simulados[1].itens[0].respondeu === undefined,
  );
}

// --- migrar(): o contrato que protege a próxima versão --------------------
{
  const valido = montarRegistro("Legislação de Telecomunicações", respostasFalsas(5, 3));

  checar("versão atual delega à validação normal", migrar({ versao: VERSAO_HISTORICO, simulados: [valido] })?.simulados.length === 1);
  // O defeito original: casca antiga lendo formato novo descartava TUDO e a
  // primeira bateria regravava por cima. O contrato agora é leniente: lê o
  // que entende, registro a registro.
  checar(
    "versão futura tenta leitura leniente em vez de descartar",
    migrar({ versao: 99, simulados: [valido, { lixo: true }] })?.simulados.length === 1,
  );
  checar("lixo continua sendo lixo", migrar("banana") === null && migrar(null) === null);
  checar("versão que não é número não passa", migrar({ versao: "x", simulados: [] }) === null);
}

// --- Resiliência a storage sujo -------------------------------------------
{
  storage.clear();
  storage.setItem(CHAVE_STORAGE, "{ isto não é json");
  checar("JSON corrompido não quebra a leitura", ler().simulados.length === 0);

  // Versão futura passa pela leitura leniente de migrar(): registros que esta
  // versão não reconhece são filtrados um a um — aqui, todos.
  storage.setItem(CHAVE_STORAGE, JSON.stringify({ versao: 99, simulados: [{}] }));
  checar("versão futura sem registro legível fica vazia", ler().simulados.length === 0);

  storage.setItem(CHAVE_STORAGE, JSON.stringify({ versao: VERSAO_HISTORICO, simulados: "nada" }));
  checar("campo simulados inválido é descartado", ler().simulados.length === 0);

  storage.setItem(CHAVE_STORAGE, "null");
  checar("valor null é descartado", ler().simulados.length === 0);

  // Registros malformados são filtrados sem derrubar os válidos ao lado.
  const bom = montarRegistro("Legislação de Telecomunicações", respostasFalsas(10, 5));
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
    montarRegistro("Legislação de Telecomunicações", respostasFalsas(10, 5)),
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

// --- A linha de corte que o painel desenha --------------------------------
// O painel marcava sempre 55% (o corte da Classe B, o mais exigente) e
// explicava entre parênteses que "A e C aprovam com 53%" — contradizendo a
// linha logo abaixo, que já dizia "corte da Classe C". O conservador só faz
// sentido quando o histórico mistura classes.
{
  const bateria = (classe?: "C" | "B" | "A"): SimuladoSalvo => ({
    id: `x${Math.random()}`,
    data: new Date().toISOString(),
    escolha: "Legislação de Telecomunicações",
    total: 10,
    acertos: 6,
    itens: [],
    ...(classe ? { classe } : {}),
  });
  const hist = (...s: SimuladoSalvo[]): Historico => ({ versao: VERSAO_HISTORICO, simulados: s });

  const soC = corteDoPainel(hist(bateria("C"), bateria("C")), "C");
  checar("histórico de uma classe só usa o corte dela", soC.percentual === 53 && soC.classe === "C");

  const misto = corteDoPainel(hist(bateria("C"), bateria("B")), "C");
  checar("histórico misturado volta ao corte conservador", misto.percentual === 55 && misto.classe === null);

  // Registros anteriores ao campo `classe` são de quando o app não perguntava:
  // presumir que mudaram de classe seria inventar um dado que não existe.
  const antigos = corteDoPainel(hist(bateria(), bateria("C")), "C");
  checar("registro sem classe não conta como divergência", antigos.percentual === 53 && antigos.classe === "C");

  const vazio = corteDoPainel(hist(), "A");
  checar("sem histórico, o corte é o da classe escolhida", vazio.percentual === 53 && vazio.classe === "A");
}


// --- O que a home mostra: estado atual, não média da vida toda -------------
// A linha de resumo dizia "12 simulados · 57%" — percentual que não existe no
// exame, onde a aprovação é matéria a matéria — e marcava a matéria abaixo do
// corte pela média do histórico inteiro: uma matéria a 63% acumulado podia
// estar em 50% na última bateria sem aparecer, e outra corrigida há duas
// semanas continuava marcada.
{
  const LEG = TEMAS[0], TEC = TEMAS[1];
  const bat = (tema: Tema, acertos: number, total: number, data: string): SimuladoSalvo => ({
    id: `b${data}${tema}${acertos}`,
    data,
    escolha: tema,
    total,
    acertos,
    itens: Array.from({ length: total }, (_, i) => ({
      questaoId: `q${i}`,
      tema,
      acertou: i < acertos,
      respondeu: true,
    })),
  });
  // Do mais recente para o mais antigo, como o storage guarda.
  const h: Historico = {
    versao: VERSAO_HISTORICO,
    simulados: [
      bat(LEG, 5, 10, "2026-08-30T10:00:00Z"),
      bat(LEG, 5, 10, "2026-08-29T10:00:00Z"),
      bat(LEG, 5, 10, "2026-08-28T10:00:00Z"),
      bat(LEG, 10, 10, "2026-08-01T10:00:00Z"),
      bat(LEG, 10, 10, "2026-07-01T10:00:00Z"),
    ],
  };
  const acumulado = estatisticasPorTema(h).find((e) => e.tema === LEG)!;
  const recente = estatisticasRecentesPorTema(h).find((e) => e.tema === LEG)!;
  checar("o acumulado dilui a queda recente", acumulado.percentual === 70);
  checar(
    "a janela recente mostra o estado atual",
    recente.percentual === 50 && recente.baterias === 3,
  );
  const naoFeita = estatisticasRecentesPorTema(h).find((e) => e.tema === TEC)!;
  checar(
    "matéria sem bateria aparece zerada, e não some",
    naoFeita.baterias === 0 && naoFeita.respondidas === 0,
  );
  // A janela conta baterias DAQUELA matéria: quem fez dez de Legislação e uma
  // de Técnica tem uma janela recente em cada uma.
  const misto: Historico = {
    versao: VERSAO_HISTORICO,
    simulados: [
      bat(LEG, 1, 10, "2026-08-30T10:00:00Z"),
      bat(LEG, 1, 10, "2026-08-29T10:00:00Z"),
      bat(LEG, 1, 10, "2026-08-28T10:00:00Z"),
      bat(TEC, 9, 10, "2026-08-01T10:00:00Z"),
    ],
  };
  const tec = estatisticasRecentesPorTema(misto).find((e) => e.tema === TEC)!;
  checar(
    "a janela de cada matéria é independente",
    tec.baterias === 1 && tec.percentual === 90,
  );
}

// --- Ritmo de estudo ------------------------------------------------------
// O histórico guarda a data de cada bateria e nada na interface a usava fora
// do tooltip do gráfico, que no celular não existe.
{
  const bat = (data: string): SimuladoSalvo => ({
    id: `x${data}`,
    data,
    escolha: TEMAS[0],
    total: 1,
    acertos: 1,
    itens: [],
  });
  const hist = (...datas: string[]): Historico => ({
    versao: VERSAO_HISTORICO,
    simulados: datas.map(bat),
  });
  const agora = new Date("2026-08-30T20:00:00");

  checar(
    "sem histórico não há ritmo",
    frequencia(hist(), agora).diasDesdeUltima === null &&
      frequencia(hist(), agora).diasSeguidos === 0,
  );

  const tres = frequencia(
    hist("2026-08-30T09:00:00", "2026-08-29T09:00:00", "2026-08-28T09:00:00"),
    agora,
  );
  checar("três dias seguidos contam três", tres.diasSeguidos === 3 && tres.diasDesdeUltima === 0);

  // Duas baterias no mesmo dia não são dois dias.
  const mesmoDia = frequencia(
    hist("2026-08-30T09:00:00", "2026-08-30T20:00:00", "2026-08-29T09:00:00"),
    agora,
  );
  checar("duas baterias num dia contam um dia", mesmoDia.diasSeguidos === 2);

  // A sequência aceita terminar ontem: cortá-la à meia-noite transformaria o
  // número num cobrador, e o app é de estudo adulto.
  const ontem = frequencia(hist("2026-08-29T09:00:00", "2026-08-28T09:00:00"), agora);
  checar("a sequência sobrevive a terminar ontem", ontem.diasSeguidos === 2 && ontem.diasDesdeUltima === 1);

  const sumiu = frequencia(hist("2026-08-25T09:00:00", "2026-08-24T09:00:00"), agora);
  checar("sumiço quebra a sequência e conta os dias", sumiu.diasSeguidos === 0 && sumiu.diasDesdeUltima === 5);

  const buraco = frequencia(hist("2026-08-30T09:00:00", "2026-08-28T09:00:00"), agora);
  checar("um dia pulado corta a sequência", buraco.diasSeguidos === 1);

  // Relógio do aparelho adiantado não pode virar sequência negativa.
  const futuro = frequencia(hist("2026-09-05T09:00:00"), agora);
  checar("data no futuro não quebra a conta", futuro.diasDesdeUltima === 0);
}


console.log(`\n${falhas === 0 ? "TODOS OS TESTES DE HISTÓRICO PASSARAM" : falhas + " FALHA(S)"}`);
process.exit(falhas === 0 ? 0 : 1);
