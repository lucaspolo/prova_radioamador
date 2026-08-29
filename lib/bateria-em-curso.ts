import type { Escolhas } from "./bateria";
import type { Desafio } from "./desafio";
import { BANCO } from "./questoes";
import type { Classe, Questao, Regime, Tema } from "./tipos";

export const CHAVE_EM_CURSO = "prova-radioamador:bateria-em-curso";

/** Versão do formato salvo. Formato desconhecido é descartado, não migrado. */
export const VERSAO_EM_CURSO = 1;

/**
 * Depois disso, a bateria não é mais oferecida.
 *
 * Guardar em `localStorage` — e não em `sessionStorage` — é o que faz a
 * bateria sobreviver a fechar a aba e ao aplicativo instalado ser encerrado
 * pelo sistema, que são justamente os casos que doíam. O preço é a bateria
 * velha: sem prazo de validade, o app ofereceria retomar um simulado de
 * terça-feira. Doze horas cobrem "voltei depois do almoço" e descartam
 * "esqueci a semana passada".
 */
export const VALIDADE_HORAS = 12;

/** Uma matéria já concluída da bateria de várias, no formato mínimo. */
export interface MateriaSalva {
  tema: Tema;
  ids: string[];
  escolhas: Escolhas;
}

/**
 * O plano de uma bateria de várias matérias, quando é o caso: o que o `Plano`
 * de `app/page.tsx` precisa para seguir para a próxima matéria. O desafio vem
 * inteiro porque é a semente dele que mantém a bateria idêntica à dos colegas.
 */
export interface PlanoSalvo {
  temas: Tema[];
  quantidade: number;
  cronometrar: boolean;
  soIneditas: boolean;
  desafio: Desafio | null;
}

/**
 * Uma bateria interrompida, no meio.
 *
 * Guarda ids e não questões: o banco é o mesmo em todo aparelho que roda esta
 * versão do app, e uma questão retirada dele deve fazer a retomada falhar em
 * vez de ressuscitar uma afirmação que já saiu do ar.
 */
export interface BateriaEmCurso {
  versao: number;
  /** ISO 8601, em UTC — quando a bateria foi salva pela última vez. */
  quando: string;
  modo: "avulso" | "revisao" | "assunto" | "desafio";
  regime: Regime;
  tema: Tema;
  classe: Classe;
  ids: string[];
  escolhas: Escolhas;
  indice: number;
  marcadas: number[];
  /** Instante em que o tempo acaba (epoch ms); `null` sem cronômetro. */
  prazo: number | null;
  plano: PlanoSalvo | null;
  materias: MateriaSalva[];
}

/** O que a tela precisa para retomar: a bateria salva mais as questões. */
export interface Retomada {
  bateria: BateriaEmCurso;
  questoes: Questao[];
  materias: { tema: Tema; questoes: Questao[]; escolhas: Escolhas }[];
  /** Segundos que restam agora; `null` sem cronômetro. */
  restanteSegundos: number | null;
}

function ehEscolha(v: unknown): v is boolean | null {
  return v === null || typeof v === "boolean";
}

/**
 * Valida o que veio do storage. Devolve null a qualquer sinal de formato
 * estranho: uma retomada malformada é pior que retomada nenhuma, porque
 * levaria a uma bateria com folha e questões fora de sincronia.
 */
export function validar(dados: unknown): BateriaEmCurso | null {
  if (typeof dados !== "object" || dados === null) return null;
  const b = dados as BateriaEmCurso;
  if (b.versao !== VERSAO_EM_CURSO) return null;
  if (typeof b.quando !== "string") return null;
  if (!Array.isArray(b.ids) || b.ids.length === 0) return null;
  if (!b.ids.every((id) => typeof id === "string")) return null;
  if (!Array.isArray(b.escolhas) || b.escolhas.length !== b.ids.length) return null;
  if (!b.escolhas.every(ehEscolha)) return null;
  if (typeof b.indice !== "number" || b.indice < 0 || b.indice >= b.ids.length) {
    return null;
  }
  if (!Array.isArray(b.marcadas) || !b.marcadas.every((m) => typeof m === "number")) {
    return null;
  }
  if (b.prazo !== null && typeof b.prazo !== "number") return null;
  return b;
}

export function gravar(bateria: BateriaEmCurso): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(CHAVE_EM_CURSO, JSON.stringify(bateria));
    return true;
  } catch {
    // Storage recusado (modo privado, cota). A bateria continua na memória da
    // aba; o que se perde é a retomada, e o app já avisa sobre gravação
    // recusada no resultado.
    return false;
  }
}

export function limpar(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CHAVE_EM_CURSO);
  } catch {
    // Nada a fazer: sem storage, não há o que limpar.
  }
}

function questoesDosIds(ids: string[]): Questao[] | null {
  const porId = new Map(BANCO.map((q) => [q.id, q]));
  const questoes: Questao[] = [];
  for (const id of ids) {
    const q = porId.get(id);
    if (!q) return null;
    questoes.push(q);
  }
  return questoes;
}

/**
 * Lê a bateria interrompida e a devolve pronta para a tela — ou null.
 *
 * Descarta em três casos, todos em silêncio: formato inválido, velha demais
 * (`VALIDADE_HORAS`) e, no caso cronometrado, prazo já vencido. Este último é
 * uma decisão de conteúdo, não técnica: retomar uma prova cujo tempo acabou
 * enquanto o app estava fechado seria devolver minutos que a prova real não
 * devolve. Nada foi registrado no histórico, então descartar não apaga
 * resultado nenhum.
 */
export function ler(agora = Date.now()): Retomada | null {
  if (typeof window === "undefined") return null;
  let bruto: string | null = null;
  try {
    bruto = window.localStorage.getItem(CHAVE_EM_CURSO);
  } catch {
    return null;
  }
  if (!bruto) return null;

  let bateria: BateriaEmCurso | null = null;
  try {
    bateria = validar(JSON.parse(bruto));
  } catch {
    bateria = null;
  }
  if (!bateria) {
    limpar();
    return null;
  }

  const idade = agora - new Date(bateria.quando).getTime();
  if (!Number.isFinite(idade) || idade > VALIDADE_HORAS * 3600 * 1000) {
    limpar();
    return null;
  }

  const restanteSegundos =
    bateria.prazo === null
      ? null
      : Math.ceil((bateria.prazo - agora) / 1000);
  if (restanteSegundos !== null && restanteSegundos <= 0) {
    limpar();
    return null;
  }

  const questoes = questoesDosIds(bateria.ids);
  if (!questoes) {
    limpar();
    return null;
  }

  const materias: Retomada["materias"] = [];
  for (const m of bateria.materias ?? []) {
    const qs = questoesDosIds(m.ids);
    if (!qs) {
      limpar();
      return null;
    }
    materias.push({ tema: m.tema, questoes: qs, escolhas: m.escolhas });
  }

  return { bateria, questoes, materias, restanteSegundos };
}

/** Quantas questões já foram respondidas — o que o convite de retomar mostra. */
export function respondidasEm(bateria: BateriaEmCurso): number {
  return bateria.escolhas.filter((e) => e !== null).length;
}
