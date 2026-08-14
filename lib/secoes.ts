import type { Classe, Questao } from "./tipos";
import { CLASSE_PADRAO, ROTULO_CURTO, TEMAS } from "./constantes";
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

// Todos exportados: outros módulos endereçam seções por nome de arquivo
// (`lib/atalhos.ts`, `lib/ementa.ts`), e o nome é a chave de
// `lib/mapa-pdfs.json` — repeti-lo à mão em outro arquivo é errata esperando
// acontecer.
export const CARTILHA = "2026-06-30 CARTILHA-RADIOAMADOR-v9 2026-06.pdf";
export const ATO_926 = "Anatel - Ato nº 926, de 1 de fevereiro de 2024.pdf";
export const ATO_3448 = "SEI_ANATEL - 15307586 - Ato_orginal.pdf";
export const RES_777 = "Anatel - R. Anatel nº 777_20250428_RA_RCIDADAO.pdf";
export const ATO_3445 = "ATO_3445_20260311_INDICATIVOS_ESPECIAIS_RAFAEL_VTC.pdf";
export const ATO_926_UHF = "Anatel - Ato nº 926, 01022024_2M_220_UHF.pdf";

// As normas que a ementa nomeia mas que o material de estudo só resumia.
//
// Nenhuma delas tem questão no banco: entraram para serem CONSULTADAS — o item
// "Lei Geral das Telecomunicações" da ementa apontava para duas páginas de
// resumo da Cartilha, e agora aponta também para a lei. Gerar questão delas é
// outra decisão, e cara: são 119 páginas de norma setorial, a maior parte
// sobre concessão e estrutura da agência, que o exame de radioamador não
// cobra. Quando for a hora, o caminho é `PAGINAS_REFORCO` no gerador — página
// escolhida, cota própria —, e não jogar os arquivos inteiros no chunking.
export const LGT = "Lei nº 9.472, de 16 de julho de 1997 (LGT).pdf";
export const RES_715 = "Anatel - Resolução nº 715, de 23 de outubro de 2019.pdf";
export const RES_780 = "Anatel - Resolução Anatel nº 780, de 1º de agosto de 2025.pdf";
export const RES_779 = "Anatel - Resolução Anatel nº 779, de 28 de abril de 2025.pdf";
export const RES_719 = "Anatel - Resolução nº 719, de 10 de fevereiro de 2020.pdf";
export const RES_720 = "Anatel - Resolução nº 720, de 10 de fevereiro de 2020.pdf";

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
  // --- Lei Geral das Telecomunicações (39 pp.) ---------------------------
  // Só os capítulos que a ementa alcança. O resto da lei é concessão, tarifa
  // e desestatização — assunto de prova de outro concurso.
  { arquivo: LGT, titulo: "Princípios fundamentais", paginaInicio: 1, paginaFim: 2, ancora: "DOS PRINCÍPIOS FUNDAMENTAIS" },
  { arquivo: LGT, titulo: "Competências da Anatel", paginaInicio: 4, paginaFim: 5, ancora: "DAS COMPETÊNCIAS" },
  { arquivo: LGT, titulo: "Organização dos serviços", paginaInicio: 12, paginaFim: 14, ancora: "DA ORGANIZAÇÃO DOS SERVIÇOS DE TELECOMUNICAÇÕES" },
  { arquivo: LGT, titulo: "Espectro e órbita", paginaInicio: 29, paginaFim: 31, ancora: "DO ESPECTRO E DA ÓRBITA" },
  { arquivo: LGT, titulo: "Sanções administrativas", paginaInicio: 32, paginaFim: 32, ancora: "DAS SANÇÕES" },
  // --- Res. 715/2019: conformidade e homologação (18 pp.) ----------------
  { arquivo: RES_715, titulo: "Objetivo, princípios e abrangência", paginaInicio: 2, paginaFim: 2, ancora: "DAS DISPOSIÇÕES GERAIS" },
  { arquivo: RES_715, titulo: "Avaliação da conformidade", paginaInicio: 3, paginaFim: 9, ancora: "DO PROCESSO DE AVALIAÇÃO DA CONFORMIDADE E DE HOMOLOGAÇÃO" },
  { arquivo: RES_715, titulo: "Homologação: obtenção e direitos", paginaInicio: 10, paginaFim: 13, ancora: "DOS DIREITOS DECORRENTES DA HOMOLOGAÇÃO" },
  { arquivo: RES_715, titulo: "Sanções", paginaInicio: 15, paginaFim: 15, ancora: "DAS SANÇÕES" },
  // --- Res. 780/2025: altera a 715 (3 pp.) -------------------------------
  { arquivo: RES_780, titulo: "Alterações à Resolução 715/2019", paginaInicio: 1, paginaFim: 3, ancora: "Altera o Regulamento de Avaliação da Conformidade" },
  // --- Res. 779/2025: Glossário do setor (31 pp.) ------------------------
  // O que fecha o buraco apontado em `RST_SEM_FONTE` para outro assunto: os
  // três verbos do nome do PDFF — atribuição (p. 6), destinação e distribuição
  // (p. 10) — não tinham definição em nenhum PDF publicado aqui.
  { arquivo: RES_779, titulo: "Definições de espectro e radiofrequência", paginaInicio: 6, paginaFim: 14, ancora: "Atribuição (de uma faixa de radiofrequências)" },
  { arquivo: RES_779, titulo: "Definições do Serviço de Radioamador", paginaInicio: 23, paginaFim: 26, ancora: "pessoa habilitada a operar estação do Serviço de Radioamador" },
  // --- Res. 719/2020: Regulamento Geral de Licenciamento (16 pp.) --------
  { arquivo: RES_719, titulo: "Licenciamento de estações", paginaInicio: 10, paginaFim: 13, ancora: "DO LICENCIAMENTO DE ESTAÇÕES" },
  { arquivo: RES_719, titulo: "Validade, transferência e obrigações", paginaInicio: 14, paginaFim: 14, ancora: "DOS PRAZOS DE VALIDADE DA LICENÇA DA ESTAÇÃO" },
  // --- Res. 720/2020: Regulamento Geral de Outorgas (12 pp.) -------------
  { arquivo: RES_720, titulo: "Processo de autorização", paginaInicio: 6, paginaFim: 6, ancora: "DO PROCESSO DE AUTORIZAÇÃO" },
  { arquivo: RES_720, titulo: "Autorização de uso de radiofrequências", paginaInicio: 7, paginaFim: 7, ancora: "DA AUTORIZAÇÃO DE USO DE RADIOFREQUÊNCIAS" },
  { arquivo: RES_720, titulo: "Dispensa de autorização e transferências", paginaInicio: 8, paginaFim: 9, ancora: "DOS CASOS DE DISPENSA DE AUTORIZAÇÃO" },
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

/**
 * Endereço de uma seção, para quem precisa apontar para ela de fora.
 *
 * O par arquivo + título, e não só o título: "Antenas" e "Indicativos de
 * chamada" existem em mais de um documento, e uma referência ambígua abriria
 * calada o PDF errado.
 */
export interface RefSecao {
  arquivo: string;
  titulo: string;
}

/** A seção apontada por uma referência, ou null se ela não existe mais. */
export function secaoPorRef(ref: RefSecao): Secao | null {
  return (
    SECOES.find(
      (s) => s.arquivo === ref.arquivo && s.titulo === ref.titulo,
    ) ?? null
  );
}

/** Rótulo curto de cada PDF, para o agrupamento não ocupar três linhas. */
export const ROTULO_ARQUIVO: Record<string, string> = {
  [CARTILHA]: "Cartilha do Radioamador",
  [ATO_926]: "Ato 926/2024 — requisitos técnicos",
  [ATO_3448]: "Ato 3448/2026 — habilitação e indicativos",
  [RES_777]: "Resolução 777/2025",
  [ATO_3445]: "Ato 3445/2026 — indicativos especiais",
  [ATO_926_UHF]: "Ato 926/2024 — 2 m, 220 MHz e UHF",
  [LGT]: "Lei 9.472/1997 — Lei Geral das Telecomunicações",
  [RES_715]: "Resolução 715/2019 — conformidade e homologação",
  [RES_780]: "Resolução 780/2025 — altera a 715/2019",
  [RES_779]: "Resolução 779/2025 — Glossário do setor",
  [RES_719]: "Resolução 719/2020 — licenciamento (RGL)",
  [RES_720]: "Resolução 720/2020 — outorgas (RGO)",
};

/**
 * Uma linha dizendo o que cada documento é, para a lista de material.
 *
 * São doze arquivos com nomes que só quem já os leu distingue — "Ato 926" e
 * "Ato 3448" não contam a ninguém qual traz as faixas e qual traz a prova.
 *
 * É índice, não conteúdo, pela mesma regra de `lib/atalhos.ts`: cada linha
 * resume o assunto declarado pelo próprio documento (a ementa da norma, o
 * "Aprova o Regulamento de…" da primeira página) e aponta onde olhar. Quem
 * responde é o PDF. `testes/pdfs.test.ts` exige uma entrada aqui para todo
 * arquivo publicado — sem ela a lista mostraria o nome cru do arquivo.
 */
export const RESUMO_ARQUIVO: Record<string, string> = {
  [CARTILHA]:
    "O material de estudo da Anatel: o serviço explicado do começo ao fim, mais os anexos de técnica e ética, legislação e eletrônica.",
  [ATO_926]:
    "As faixas do radioamador: plano de bandas, modos de emissão, limites de potência e quais classes operam cada trecho.",
  [ATO_3448]:
    "Habilitação e indicativos: o formato do exame, a ementa das matérias (item 11.4) e as séries de indicativo por estado.",
  [RES_777]:
    "As regras gerais dos serviços de telecomunicações (RGST). Este PDF traz só os artigos de Radioamador e Rádio do Cidadão.",
  [ATO_3445]:
    "Indicativos especiais das ilhas e arquipélagos oceânicos: Fernando de Noronha, São Pedro e São Paulo, Trindade, Rocas e Martim Vaz.",
  [ATO_926_UHF]:
    "O recorte do plano de bandas nas faixas de 2 m, 220 MHz e UHF, com os modos e as aplicações de cada subfaixa.",
  [LGT]:
    "A lei que organiza os serviços de telecomunicações e cria a Anatel. O Título V é o que trata do espectro de radiofrequências.",
  [RES_715]:
    "Como um equipamento é avaliado, certificado e homologado pela Anatel antes de poder ser vendido e usado.",
  [RES_780]: "Altera a Resolução 715/2019 — leia junto com ela.",
  [RES_779]:
    "O glossário oficial do setor. Define atribuição, destinação e distribuição de faixas, e o próprio Serviço de Radioamador.",
  [RES_719]:
    "O Regulamento Geral de Licenciamento: quando a estação precisa de licença, como se pede e por quanto tempo ela vale.",
  [RES_720]:
    "O Regulamento Geral de Outorgas: a autorização do serviço e a autorização de uso de radiofrequências.",
};

/**
 * Tópicos do gerador que são o mesmo assunto com nomes diferentes — vieram de
 * passes distintos (o complementar e as questões manuais) e fundem aqui, na
 * exibição, sem reescrever o banco.
 */
const MESMO_ASSUNTO: Record<string, string> = {
  "Alfabeto Fonético da UIT": "Alfabeto fonético internacional",
  "Teoria técnica de antenas": "Teoria de antenas",
};

/**
 * O rótulo de UI de um tópico da ementa: o que vem antes do ":" (os tópicos
 * longos são "Lei de Ohm: cálculo de..."), com as fusões de `MESMO_ASSUNTO`.
 */
export function rotuloDoTopico(topico: string): string {
  const bruto = topico.split(":")[0].trim();
  return MESMO_ASSUNTO[bruto] ?? bruto;
}

export interface Assunto {
  titulo: string;
  /** Cabeçalho de agrupamento: o documento, ou "Ementa · matéria". */
  grupo: string;
  questoes: Questao[];
  /** Presente quando o assunto é uma seção de PDF (questões de documento). */
  secao?: Secao;
}

/**
 * Os assuntos estudáveis para uma classe: as seções dos PDFs (questões de
 * documento, na ordem dos documentos) e os tópicos da ementa (agrupados por
 * rótulo dentro de cada matéria, na ordem do capítulo indicado). Assunto sem
 * questão elegível fica de fora — assunto sem bateria não é assunto, é
 * título.
 */
export function listarAssuntos(classe: Classe = CLASSE_PADRAO): Assunto[] {
  const doAcervo = acervo(classe);
  const assuntos: Assunto[] = [];

  const porSecao = new Map<Secao, Questao[]>();
  for (const q of doAcervo) {
    const s = secaoDe(q);
    if (!s) continue;
    const lista = porSecao.get(s);
    if (lista) lista.push(q);
    else porSecao.set(s, [q]);
  }
  for (const secao of SECOES) {
    const questoes = porSecao.get(secao);
    if (!questoes) continue;
    assuntos.push({
      titulo: secao.titulo,
      grupo: ROTULO_ARQUIVO[secao.arquivo] ?? secao.arquivo,
      questoes,
      secao,
    });
  }

  for (const tema of TEMAS) {
    const porRotulo = new Map<string, Questao[]>();
    for (const q of doAcervo) {
      if (q.tema !== tema || !q.topico) continue;
      const rotulo = rotuloDoTopico(q.topico);
      const lista = porRotulo.get(rotulo);
      if (lista) lista.push(q);
      else porRotulo.set(rotulo, [q]);
    }
    for (const [titulo, questoes] of porRotulo) {
      assuntos.push({
        titulo,
        grupo: `Ementa · ${ROTULO_CURTO[tema]}`,
        questoes,
      });
    }
  }

  return assuntos;
}
