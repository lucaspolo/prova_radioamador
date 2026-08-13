import type { Classe, Questao } from "./tipos";
import { CLASSE_PADRAO } from "./constantes";
import { acervo } from "./questoes";

/**
 * O mapa de seções dos PDFs publicados: o "assunto" das questões de
 * documento, derivado de `arquivo_origem` + `pagina` — sem tocar no gerador
 * e sem regenerar o banco.
 *
 * A granularidade máxima de estudo era a matéria (3 valores): "Eletrônica em
 * 48%" não dizia se o fraco é código de cores ou plano de bandas. Cada seção
 * aqui é um capítulo/sumário real do PDF, transcrito à mão — e conferido por
 * `testes/secoes.test.ts`, que abre o PDF e exige a `ancora` dentro da faixa
 * de páginas declarada, no mesmo espírito de `referencia.test.ts`.
 *
 * `titulo` é o rótulo de UI (curto); `ancora` é a string literal que existe
 * no texto da faixa (por padrão, o próprio título). Faixas podem encostar:
 * `secaoDe` devolve a PRIMEIRA que contém a página, então a ordem do array
 * decide o desempate — está declarada onde importa.
 */
export interface Secao {
  arquivo: string;
  titulo: string;
  paginaInicio: number;
  paginaFim: number;
  /** String verificável na faixa; quando ausente, vale o `titulo`. */
  ancora?: string;
}

const CARTILHA = "2026-06-30 CARTILHA-RADIOAMADOR-v9 2026-06.pdf";
const ATO_926 = "Anatel - Ato nº 926, de 1 de fevereiro de 2024.pdf";
const ATO_3448 = "SEI_ANATEL - 15307586 - Ato_orginal.pdf";
const RES_777 = "Anatel - R. Anatel nº 777_20250428_RA_RCIDADAO.pdf";
const ATO_3445 = "ATO_3445_20260311_INDICATIVOS_ESPECIAIS_RAFAEL_VTC.pdf";
const ATO_926_UHF = "Anatel - Ato nº 926, 01022024_2M_220_UHF.pdf";

export const SECOES: Secao[] = [
  // --- Cartilha, corpo (pp. 5-25) ---------------------------------------
  { arquivo: CARTILHA, titulo: "Ser radioamador no Brasil", paginaInicio: 6, paginaFim: 7, ancora: "O QUE É SER RADIOAMADOR NO BRASIL" },
  { arquivo: CARTILHA, titulo: "Como se tornar radioamador", paginaInicio: 8, paginaFim: 9, ancora: "PASSO A PASSO PARA SE TORNAR RADIOAMADOR" },
  { arquivo: CARTILHA, titulo: "Licenciamento e estação", paginaInicio: 10, paginaFim: 11, ancora: "LICENCIAMENTO E AUTORIZAÇÃO DE ESTAÇÃO" },
  { arquivo: CARTILHA, titulo: "Classes, faixas e potências", paginaInicio: 12, paginaFim: 14, ancora: "CLASSES, FAIXAS E POTÊNCIAS" },
  { arquivo: CARTILHA, titulo: "Como operar corretamente", paginaInicio: 15, paginaFim: 17, ancora: "COMO OPERAR CORRETAMENTE" },
  { arquivo: CARTILHA, titulo: "Obrigações e fiscalização", paginaInicio: 18, paginaFim: 19, ancora: "OBRIGAÇÕES REGULATÓRIAS E CONSEQUÊNCIAS" },
  { arquivo: CARTILHA, titulo: "Glossário do radioamador", paginaInicio: 20, paginaFim: 21, ancora: "GLOSSÁRIO BÁSICO DO RADIOAMADOR" },
  { arquivo: CARTILHA, titulo: "Onde conferir cada assunto", paginaInicio: 22, paginaFim: 23, ancora: "GUIA RÁPIDO" },
  { arquivo: CARTILHA, titulo: "Preparando-se para o exame", paginaInicio: 24, paginaFim: 25, ancora: "PREPARANDO-SE PARA O EXAME" },
  // --- Cartilha, Anexo 1: Técnica e Ética (pp. 26-38) --------------------
  { arquivo: CARTILHA, titulo: "Estação de radioamador", paginaInicio: 26, paginaFim: 27, ancora: "ESTAÇÃO DE RADIOAMADOR" },
  { arquivo: CARTILHA, titulo: "Antenas", paginaInicio: 28, paginaFim: 28 },
  { arquivo: CARTILHA, titulo: "Frequência, onda e modulação", paginaInicio: 29, paginaFim: 30, ancora: "COMPRIMENTO DE ONDA E MODULAÇÃO" },
  { arquivo: CARTILHA, titulo: "Propagação", paginaInicio: 31, paginaFim: 32, ancora: "PROPAGAÇÃO" },
  { arquivo: CARTILHA, titulo: "Interferências", paginaInicio: 33, paginaFim: 33, ancora: "INTERFERÊNCIAS" },
  { arquivo: CARTILHA, titulo: "Comunicados", paginaInicio: 34, paginaFim: 36, ancora: "COMUNICADOS" },
  { arquivo: CARTILHA, titulo: "Ética operacional", paginaInicio: 37, paginaFim: 37, ancora: "ÉTICA OPERACIONAL" },
  { arquivo: CARTILHA, titulo: "Emergências", paginaInicio: 38, paginaFim: 38, ancora: "EMERGÊNCIAS" },
  // --- Cartilha, Anexo 2: Legislação (pp. 39-53) -------------------------
  { arquivo: CARTILHA, titulo: "Normas internacionais (UIT, IARU)", paginaInicio: 39, paginaFim: 41, ancora: "REGULAMENTO DE RÁDIO" },
  { arquivo: CARTILHA, titulo: "Regiões de indicativos e LGT", paginaInicio: 42, paginaFim: 43, ancora: "REGIÕES DE INDICATIVOS NO BRASIL" },
  { arquivo: CARTILHA, titulo: "Serviço, estação e licença", paginaInicio: 44, paginaFim: 44, ancora: "ESTAÇÃO, LICENÇA E TIPOS" },
  { arquivo: CARTILHA, titulo: "Habilitação (COER) e outorga", paginaInicio: 45, paginaFim: 45, ancora: "HABILITAÇÃO DO OPERADOR" },
  { arquivo: CARTILHA, titulo: "Indicativos de chamada", paginaInicio: 46, paginaFim: 46, ancora: "INDICATIVOS DE CHAMADA" },
  { arquivo: CARTILHA, titulo: "IARP, equipamentos e repetidoras", paginaInicio: 47, paginaFim: 48, ancora: "PERMISSÃO INTERNACIONAL DE RADIOAMADOR" },
  { arquivo: CARTILHA, titulo: "Faixas e restrições por classe", paginaInicio: 49, paginaFim: 49, ancora: "RESTRIÇÕES POR CLASSE" },
  { arquivo: CARTILHA, titulo: "Limites de potência", paginaInicio: 50, paginaFim: 50, ancora: "LIMITES DE POTÊNCIA" },
  { arquivo: CARTILHA, titulo: "Certificação e homologação", paginaInicio: 51, paginaFim: 52, ancora: "CERTIFICAÇÃO E HOMOLOGAÇÃO" },
  { arquivo: CARTILHA, titulo: "Emergência e identificação", paginaInicio: 53, paginaFim: 53, ancora: "COMUNICAÇÕES EMERGENCIAIS" },
  // --- Cartilha, Anexo 3: Eletrônica (pp. 54-65) -------------------------
  { arquivo: CARTILHA, titulo: "Eletricidade e lei de Ohm", paginaInicio: 54, paginaFim: 54, ancora: "CONCEITOS BÁSICOS DE ELETRICIDADE" },
  { arquivo: CARTILHA, titulo: "Componentes e materiais", paginaInicio: 55, paginaFim: 56, ancora: "COMPONENTES ELETRÔNICOS" },
  { arquivo: CARTILHA, titulo: "Eletromagnetismo e ondulatória", paginaInicio: 57, paginaFim: 57, ancora: "ELETROMAGNETISMO" },
  { arquivo: CARTILHA, titulo: "Circuitos em corrente alternada", paginaInicio: 58, paginaFim: 58, ancora: "CORRENTE ALTERNADA" },
  { arquivo: CARTILHA, titulo: "Proteção e medição elétrica", paginaInicio: 59, paginaFim: 60, ancora: "PROTEÇÃO ELÉTRICA" },
  { arquivo: CARTILHA, titulo: "Antenas: teoria aplicada", paginaInicio: 61, paginaFim: 61, ancora: "TEORIA DE ONDAS APLICADAS" },
  { arquivo: CARTILHA, titulo: "Propagação e fenômenos", paginaInicio: 62, paginaFim: 62, ancora: "PROPAGAÇÃO DE ONDAS" },
  { arquivo: CARTILHA, titulo: "RF, redes e digital", paginaInicio: 63, paginaFim: 65, ancora: "ELETRÔNICA DE RF" },
  // --- Ato 926/2024, requisitos técnicos (pp. 1-27) ----------------------
  { arquivo: ATO_926, titulo: "Objetivo, referências e definições", paginaInicio: 1, paginaFim: 2, ancora: "DEFINIÇÕES" },
  { arquivo: ATO_926, titulo: "Classes por faixa (Tabela I)", paginaInicio: 3, paginaFim: 3, ancora: "Tabela I" },
  { arquivo: ATO_926, titulo: "Limites de potência e requisitos", paginaInicio: 4, paginaFim: 5, ancora: "LIMITES DE POTÊNCIA" },
  { arquivo: ATO_926, titulo: "Plano de faixas por banda", paginaInicio: 6, paginaFim: 20, ancora: "Tabela II" },
  { arquivo: ATO_926, titulo: "Modos e características das emissões", paginaInicio: 21, paginaFim: 25, ancora: "CARACTERÍSTICAS BÁSICAS DAS EMISSÕES" },
  { arquivo: ATO_926, titulo: "Repetidoras e IVG", paginaInicio: 26, paginaFim: 27, ancora: "CANALIZAÇÃO" },
  // --- Ato 3448/2026, habilitação e indicativos (pp. 1-12) ---------------
  { arquivo: ATO_3448, titulo: "Requisitos operacionais e licenças", paginaInicio: 1, paginaFim: 2, ancora: "LICENÇAS DE ESTAÇÃO DE RADIOAMADOR" },
  { arquivo: ATO_3448, titulo: "Restrições, IARP e estrangeiros", paginaInicio: 3, paginaFim: 3, ancora: "RADIOAMADOR ESTRANGEIRO" },
  { arquivo: ATO_3448, titulo: "Exames de qualificação", paginaInicio: 4, paginaFim: 7, ancora: "EXAMES DE QUALIFICAÇÃO" },
  { arquivo: ATO_3448, titulo: "Indicativos de chamada", paginaInicio: 8, paginaFim: 11, ancora: "INDICATIVOS DE CHAMADA DO RADIOAMADOR" },
  { arquivo: ATO_3448, titulo: "Disposições transitórias", paginaInicio: 12, paginaFim: 12, ancora: "DISPOSIÇÕES TRANSITÓRIAS" },
  // --- Resolução 777/2025 (pp. 2-7) --------------------------------------
  // O capítulo do Radioamador vem ANTES da seção geral: os dois encostam na
  // p. 3, e é o capítulo específico que começa ali — a ordem decide.
  { arquivo: RES_777, titulo: "Condições do Serviço de Radioamador", paginaInicio: 3, paginaFim: 5, ancora: "CONDIÇÕES ESPECÍFICAS DO SERVIÇO DE RADIOAMADOR" },
  { arquivo: RES_777, titulo: "Disposições, concessões e permissões", paginaInicio: 2, paginaFim: 3, ancora: "DAS CONCESSÕES" },
  { arquivo: RES_777, titulo: "Rádio do Cidadão", paginaInicio: 6, paginaFim: 7, ancora: "RÁDIO DO CIDADÃO" },
  // --- Digitalizados (sem camada de texto) --------------------------------
  // Sem texto onde procurar âncora: o teste pula a verificação por extração
  // para os arquivos de lib/ocr-visao.json — a mesma fonte de verdade que o
  // app usa para avisar que a citação é leitura do modelo.
  { arquivo: ATO_3445, titulo: "Indicativos especiais", paginaInicio: 1, paginaFim: 3 },
  { arquivo: ATO_926_UHF, titulo: "Faixas de 2 m, 220 MHz e UHF", paginaInicio: 1, paginaFim: 4 },
];

/**
 * A seção de uma questão de documento; null para questões da ementa (a
 * página delas é o capítulo onde estudar, não a origem do enunciado) e para
 * páginas fora do mapa.
 */
export function secaoDe(q: Questao): Secao | null {
  if (q.origem !== "documento") return null;
  return (
    SECOES.find(
      (s) =>
        s.arquivo === q.arquivo_origem &&
        q.pagina >= s.paginaInicio &&
        q.pagina <= s.paginaFim,
    ) ?? null
  );
}

export interface Assunto {
  secao: Secao;
  questoes: Questao[];
}

/**
 * Os assuntos estudáveis para uma classe: cada seção com as questões do
 * acervo que caem nela, na ordem do mapa (que é a ordem dos documentos).
 * Seções sem questão elegível ficam de fora — assunto sem bateria não é
 * assunto, é título.
 */
export function listarAssuntos(classe: Classe = CLASSE_PADRAO): Assunto[] {
  const porSecao = new Map<Secao, Questao[]>();
  for (const q of acervo(classe)) {
    const s = secaoDe(q);
    if (!s) continue;
    const lista = porSecao.get(s);
    if (lista) lista.push(q);
    else porSecao.set(s, [q]);
  }
  return SECOES.filter((s) => porSecao.has(s)).map((secao) => ({
    secao,
    questoes: porSecao.get(secao)!,
  }));
}
