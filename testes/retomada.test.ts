import {
  CHAVE_EM_CURSO,
  VALIDADE_HORAS,
  VERSAO_EM_CURSO,
  gravar,
  ler,
  limpar,
  respondidasEm,
  validar,
  type BateriaEmCurso,
} from "@/lib/bateria-em-curso";
import { BANCO, sortearSimulado } from "@/lib/questoes";

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
}
const storage = new StorageFalso();
(globalThis as unknown as { window: unknown }).window = { localStorage: storage };

const AGORA = Date.parse("2026-08-29T12:00:00Z");
const questoes = sortearSimulado("Legislação de Telecomunicações", 20);

function bateria(extra: Partial<BateriaEmCurso> = {}): BateriaEmCurso {
  return {
    versao: VERSAO_EM_CURSO,
    quando: new Date(AGORA - 60_000).toISOString(),
    modo: "avulso",
    regime: "cego",
    tema: "Legislação de Telecomunicações",
    classe: "B",
    ids: questoes.map((q) => q.id),
    escolhas: questoes.map((_, i) => (i < 3 ? true : null)),
    indice: 3,
    marcadas: [1],
    prazo: AGORA + 20 * 60 * 1000,
    plano: null,
    materias: [],
    ...extra,
  };
}

// --- Ida e volta -----------------------------------------------------------
{
  gravar(bateria());
  const r = ler(AGORA);
  checar("a bateria salva volta inteira", r !== null);
  checar("as questões são reconstruídas pelos ids", r?.questoes.length === 20);
  checar(
    "na mesma ordem em que foram sorteadas",
    r?.questoes.every((q, i) => q.id === questoes[i].id) === true,
  );
  checar("a posição volta", r?.bateria.indice === 3);
  checar("as marcações voltam", r?.bateria.marcadas.join() === "1");
  checar(
    "o tempo restante sai do prazo, e não do que sobrava ao salvar",
    r?.restanteSegundos === 20 * 60,
  );
  checar("conta as respondidas", respondidasEm(r!.bateria) === 3);
  limpar();
  checar("limpar apaga", ler(AGORA) === null);
}

// --- Prazo vencido enquanto o app estava fechado ----------------------------
// Retomar aqui seria devolver minutos que a prova real não devolve.
{
  gravar(bateria({ prazo: AGORA - 1000 }));
  checar("bateria com o tempo esgotado não é oferecida", ler(AGORA) === null);
  checar("e é apagada do storage", storage.getItem(CHAVE_EM_CURSO) === null);
}

// --- Velha demais ----------------------------------------------------------
{
  const velha = AGORA - (VALIDADE_HORAS + 1) * 3600 * 1000;
  gravar(bateria({ quando: new Date(velha).toISOString(), prazo: null }));
  checar("bateria de ontem não é oferecida", ler(AGORA) === null);

  const recente = AGORA - (VALIDADE_HORAS - 1) * 3600 * 1000;
  gravar(bateria({ quando: new Date(recente).toISOString(), prazo: null }));
  checar("dentro da validade, é oferecida", ler(AGORA) !== null);
  limpar();
}

// --- Sem cronômetro --------------------------------------------------------
{
  gravar(bateria({ prazo: null, regime: "treino" }));
  const r = ler(AGORA);
  checar("bateria sem cronômetro volta sem prazo", r?.restanteSegundos === null);
  limpar();
}

// --- Questão que saiu do banco ---------------------------------------------
// Melhor perder a retomada do que ressuscitar uma afirmação que saiu do ar.
{
  gravar(bateria({ ids: [...questoes.map((q) => q.id).slice(0, 19), "nao-existe"] }));
  checar("id desconhecido invalida a retomada", ler(AGORA) === null);
}

// --- Formato ---------------------------------------------------------------
{
  checar("versão diferente é descartada", validar({ ...bateria(), versao: 99 }) === null);
  checar(
    "folha de tamanho diferente das questões é descartada",
    validar({ ...bateria(), escolhas: [true, null] }) === null,
  );
  checar(
    "índice fora da bateria é descartado",
    validar({ ...bateria(), indice: 20 }) === null,
  );
  checar("lixo é descartado", validar({ oi: 1 }) === null && validar(null) === null);
  checar("bateria válida passa", validar(bateria()) !== null);

  storage.setItem(CHAVE_EM_CURSO, "{isto não é json");
  checar("JSON corrompido não derruba a leitura", ler(AGORA) === null);
}

// --- Prova de várias matérias ----------------------------------------------
{
  const anterior = sortearSimulado("Técnica e ética operacional", 5);
  gravar(
    bateria({
      plano: {
        temas: ["Técnica e ética operacional", "Legislação de Telecomunicações"],
        quantidade: 20,
        cronometrar: true,
        soIneditas: false,
        desafio: null,
      },
      materias: [
        {
          tema: "Técnica e ética operacional",
          ids: anterior.map((q) => q.id),
          escolhas: anterior.map(() => true),
        },
      ],
    }),
  );
  const r = ler(AGORA);
  checar("o plano volta", r?.bateria.plano?.temas.length === 2);
  checar("a matéria já concluída volta com as questões", r?.materias[0].questoes.length === 5);
  limpar();
}

// --- Storage recusado ------------------------------------------------------
{
  storage.recusar = true;
  checar("gravar devolve false quando o storage recusa", gravar(bateria()) === false);
  storage.recusar = false;
}

// --- O banco tem ids únicos, que é o que torna a retomada possível ----------
{
  checar("ids do banco são únicos", new Set(BANCO.map((q) => q.id)).size === BANCO.length);
}

console.log(`\n${falhas === 0 ? "TODOS OS TESTES DE RETOMADA PASSARAM" : falhas + " FALHA(S)"}`);
process.exit(falhas === 0 ? 0 : 1);
