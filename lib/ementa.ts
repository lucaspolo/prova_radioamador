import type { Classe, Questao, Tema } from "./tipos";
import { CLASSE_PADRAO } from "./constantes";
import { acervo } from "./questoes";
import {
  ATO_3445,
  ATO_3448,
  ATO_926,
  ATO_926_UHF,
  CARTILHA,
  LGT,
  RES_715,
  RES_719,
  RES_720,
  RES_777,
  RES_779,
  RES_780,
  rotuloDoTopico,
  secaoDe,
  secaoPorRef,
  type RefSecao,
  type Secao,
} from "./secoes";

/**
 * A ementa oficial do exame — o item 11.4 do Ato nº 3448/2026, transcrito.
 *
 * É o programa da prova: o que a Anatel cobra, dito por ela. `lib/secoes.ts` é
 * o índice do que os PDFs ENSINAM e `listarAssuntos` é o índice do que o banco
 * TEM; nenhum dos dois responde "o que cai". Um tópico da ementa que o banco
 * não cobre some daquelas listas — e é justamente o buraco que quem estuda
 * precisa enxergar. Por isso o tópico aqui existe mesmo sem questão nenhuma.
 *
 * A transcrição é literal, das pp. 5-6 de `SEI_ANATEL - 15307586 -
 * Ato_orginal.pdf`, e `testes/ementa.test.ts` abre o PDF e exige cada título e
 * cada texto lá dentro — no mesmo espírito de `referencia.test.ts` e
 * `secoes.test.ts`. Duas liberdades, e só duas: o `;` que separa os itens da
 * lista vira `.`, porque fora da lista ele não quer dizer nada; e as ligaduras
 * que o PDF quebra ("arti fi cial", "Kirchho ff") são escritas inteiras. A
 * normalização do teste descarta pontuação e caixa, então nem uma nem outra
 * afrouxam a conferência.
 *
 * Esta é a FONTE ÚNICA da ementa no repositório: `scripts/processar_pdfs.py`
 * lê o `scripts/ementa.json` que sai daqui por `npm run ementa`, em vez de
 * manter a própria cópia. Mexeu aqui, reexporte.
 */

export interface TopicoEmenta {
  /**
   * Slug estável. Vai na URL (`/?assunto=…`), então um link já compartilhado
   * tem de continuar valendo: renomeie o título à vontade, o id não.
   */
  id: string;
  /** Como no Ato ("ANTENAS"); null nos itens de Legislação, que não têm. */
  titulo: string | null;
  /** O item transcrito. */
  texto: string;
  /** Onde estudar — seções de `lib/secoes.ts`. */
  secoes: RefSecao[];
  /**
   * Rótulos de tópico do banco (o que `rotuloDoTopico` devolve) cujas questões
   * pertencem a este item. É o que traz as questões de `origem: "ementa"`, que
   * não nascem de uma página e por isso não têm seção.
   */
  topicos: string[];
}

export interface BlocoEmenta {
  tema: Tema;
  /** O cabeçalho literal do Ato. */
  titulo: string;
  /** As classes que cobram este bloco. */
  classes: Classe[];
  /**
   * A frase de cumulatividade do Ato, quando há. Ela é o motivo de a Classe A
   * ter três blocos de Eletrônica e a C ter um: cada nível é definido como
   * "todo o conteúdo" do anterior mais os seus tópicos.
   */
  cumulativo?: string;
  topicos: TopicoEmenta[];
}

/** De onde a transcrição saiu, para a tela poder abrir o PDF na página. */
export const FONTE_EMENTA = {
  arquivo: ATO_3448,
  pagina: 5,
  referencia: "Ato nº 3448/2026, item 11.4",
};

const TECNICA: Tema = "Técnica e ética operacional";
const LEGISLACAO: Tema = "Legislação de Telecomunicações";
const ELETRONICA: Tema = "Conhecimentos de Eletrônica e Eletricidade";

/** Atalho para as referências, que são quase todas da Cartilha. */
function cartilha(...titulos: string[]): RefSecao[] {
  return titulos.map((titulo) => ({ arquivo: CARTILHA, titulo }));
}

export const EMENTA: BlocoEmenta[] = [
  {
    tema: TECNICA,
    titulo: "TÉCNICA E ÉTICA OPERACIONAL",
    classes: ["C", "B", "A"],
    topicos: [
      {
        id: "tec-estacao",
        titulo: "ESTAÇÃO DE RADIOAMADOR",
        texto:
          "Diagrama de blocos de receptores, transmissores, transceptores e repetidoras.",
        secoes: cartilha("Estação de radioamador", "Glossário do radioamador"),
        topicos: ["Estação de radioamador", "Repetidoras"],
      },
      {
        id: "tec-antenas",
        titulo: "ANTENAS",
        texto:
          "Noções básicas de antenas direcionais, tipos e características, uso de antena artificial, relação sinal/ruído, onda estacionária.",
        secoes: cartilha("Antenas"),
        topicos: [
          "Antenas",
          "Antena artificial (carga fictícia) e relação sinal/ruído",
          "Linhas de transmissão, onda estacionária (ROE/SWR) e casamento de impedância",
        ],
      },
      {
        id: "tec-frequencia",
        titulo: "FREQUÊNCIA, COMPRIMENTO DE ONDA",
        texto:
          "Noções básicas de frequência de áudio, faixas de frequências de transmissão e seus comprimentos de onda, batimento de frequências.",
        secoes: cartilha("Frequência, onda e modulação"),
        topicos: ["Frequência e comprimento de onda"],
      },
      {
        id: "tec-propagacao",
        titulo: "PROPAGAÇÃO",
        texto:
          "Noções básicas de Ondas terrestres, espaciais, camadas atmosféricas, propagação de ondas nas faixas de VLF, LF, MF, HF, VHF, UHF e SHF.",
        secoes: cartilha("Propagação"),
        topicos: ["Propagação"],
      },
      {
        id: "tec-interferencias",
        titulo: "INTERFERÊNCIAS",
        texto: "Procedimentos de como detectar e evitar interferências.",
        secoes: cartilha("Interferências"),
        topicos: ["Interferências"],
      },
      {
        id: "tec-comunicados",
        titulo: "COMUNICADOS",
        texto:
          "Como estabelecer um comunicado nas diversas modalidades, Alfabeto Fonético da UIT, noções do Código Q.",
        secoes: cartilha("Comunicados", "Como operar corretamente"),
        topicos: [
          "Comunicados",
          "Alfabeto fonético internacional",
          "Código Q",
          "Sistema RST de reportagem de sinais",
        ],
      },
      {
        id: "tec-etica",
        titulo: "ÉTICA",
        texto:
          "Comportamento ético do radioamador, procedimentos indispensáveis.",
        secoes: cartilha("Ética operacional"),
        topicos: ["Ética do radioamador", "Código de Conduta DX"],
      },
      {
        id: "tec-emergencias",
        titulo: "EMERGÊNCIAS",
        texto: "Procedimentos operacionais em situações de emergência.",
        secoes: cartilha("Emergências", "Emergência e identificação"),
        topicos: ["Emergências"],
      },
    ],
  },

  {
    tema: LEGISLACAO,
    titulo: "LEGISLAÇÃO DE TELECOMUNICAÇÕES",
    classes: ["C", "B", "A"],
    // A única lista da ementa que nomeia normas em vez de assuntos: são oito
    // linhas sem título, e por isso `titulo` é null nas oito.
    topicos: [
      {
        id: "leg-rr-uit",
        titulo: null,
        texto:
          "Regulamento de Rádio (RR) da União Internacional de Telecomunicações (UIT).",
        secoes: cartilha("Normas internacionais (UIT, IARU)"),
        topicos: [],
      },
      {
        id: "leg-itu-r-m1544",
        titulo: null,
        texto:
          "Recomendação ITU-R M.1544-1 (09/2015) de qualificações mínimas para o radioamador.",
        secoes: [
          ...cartilha("Habilitação (COER) e outorga"),
          { arquivo: ATO_3448, titulo: "Exames de qualificação" },
        ],
        topicos: [],
      },
      {
        id: "leg-iaru-regiao-2",
        titulo: null,
        texto:
          "Plano de Faixas para a Região 2, da União Internacional de Radioamadores (IARU).",
        secoes: cartilha("Normas internacionais (UIT, IARU)"),
        topicos: ["Plano de bandas e classes autorizadas"],
      },
      {
        id: "leg-lgt",
        titulo: null,
        texto: "Lei Geral das Telecomunicações.",
        // A lei em si vem primeiro: até ela ser publicada aqui, este item da
        // ementa apontava só para duas páginas de resumo da Cartilha.
        secoes: [
          { arquivo: LGT, titulo: "Princípios fundamentais" },
          { arquivo: LGT, titulo: "Competências da Anatel" },
          { arquivo: LGT, titulo: "Organização dos serviços" },
          { arquivo: LGT, titulo: "Espectro e órbita" },
          { arquivo: LGT, titulo: "Sanções administrativas" },
          ...cartilha(
            "Ser radioamador no Brasil",
            "Regiões de indicativos e LGT",
            "Obrigações e fiscalização",
          ),
        ],
        topicos: [],
      },
      {
        id: "leg-rgst",
        titulo: null,
        texto: "Regulamento Geral dos Serviços de Telecomunicações – RGST.",
        // O RGL e o RGO não são o RGST, e a ementa não os nomeia — mas são o
        // que de fato detalha licenciamento e outorga, e a própria Cartilha os
        // lista ao lado do RGST como "as regras gerais" (seção 1.4). Entram
        // aqui porque é o item da ementa onde quem estuda vai procurá-los.
        // O verbete do Glossário vem junto: é ele que define o Serviço de
        // Radioamador como serviço de interesse restrito em regime privado.
        secoes: [
          { arquivo: RES_777, titulo: "Condições do Serviço de Radioamador" },
          { arquivo: RES_777, titulo: "Disposições, concessões e permissões" },
          { arquivo: RES_777, titulo: "Rádio do Cidadão" },
          { arquivo: RES_779, titulo: "Definições do Serviço de Radioamador" },
          { arquivo: RES_719, titulo: "Licenciamento de estações" },
          { arquivo: RES_719, titulo: "Validade, transferência e obrigações" },
          { arquivo: RES_720, titulo: "Processo de autorização" },
          { arquivo: RES_720, titulo: "Autorização de uso de radiofrequências" },
          { arquivo: RES_720, titulo: "Dispensa de autorização e transferências" },
          ...cartilha("Licenciamento e estação", "Serviço, estação e licença"),
        ],
        topicos: [],
      },
      {
        id: "leg-requisitos-tecnicos",
        titulo: null,
        texto:
          "Requisitos Técnicos e Operacionais para uso de radiofrequências associadas ao Serviço de Radioamador.",
        // O item mais largo da ementa, e com razão: é o Ato 926 inteiro mais o
        // Ato 3448 de habilitação e indicativos. É onde mora a maior parte das
        // questões de Legislação.
        secoes: [
          ...cartilha(
            "Classes, faixas e potências",
            "Faixas e restrições por classe",
            "Limites de potência",
            "Indicativos de chamada",
            "IARP, equipamentos e repetidoras",
          ),
          { arquivo: ATO_926, titulo: "Objetivo, referências e definições" },
          { arquivo: ATO_926, titulo: "Classes por faixa (Tabela I)" },
          { arquivo: ATO_926, titulo: "Limites de potência e requisitos" },
          { arquivo: ATO_926, titulo: "Modos e características das emissões" },
          { arquivo: ATO_926, titulo: "Repetidoras e IVG" },
          { arquivo: ATO_3448, titulo: "Requisitos operacionais e licenças" },
          { arquivo: ATO_3448, titulo: "Restrições, IARP e estrangeiros" },
          { arquivo: ATO_3448, titulo: "Indicativos de chamada" },
          { arquivo: ATO_3448, titulo: "Disposições transitórias" },
          { arquivo: ATO_3445, titulo: "Indicativos especiais" },
        ],
        topicos: [],
      },
      {
        id: "leg-pdff",
        titulo: null,
        texto:
          "Plano de Atribuição, Destinação e Distribuição de Faixas de Frequências no Brasil.",
        // O PDFF em si (Res. 772/2025) não está publicado aqui — a Anatel só o
        // oferece em HTML. O que dá para apontar é o vocabulário: os três
        // verbos do nome deste item têm definição no Glossário, e sem eles a
        // tabela de faixas não se lê.
        secoes: [
          { arquivo: RES_779, titulo: "Definições de espectro e radiofrequência" },
          { arquivo: ATO_926, titulo: "Plano de faixas por banda" },
          { arquivo: ATO_926_UHF, titulo: "Faixas de 2 m, 220 MHz e UHF" },
        ],
        topicos: ["Plano de bandas e classes autorizadas"],
      },
      {
        id: "leg-conformidade",
        titulo: null,
        texto:
          "Regulamento de Avaliação da Conformidade e de Homologação de Produtos para Telecomunicações.",
        // O item nomeia um regulamento, e ele é a Res. 715/2019 — com a 780/2025
        // por cima, que a alterou. A Cartilha fica por último: é o resumo.
        secoes: [
          { arquivo: RES_715, titulo: "Objetivo, princípios e abrangência" },
          { arquivo: RES_715, titulo: "Avaliação da conformidade" },
          { arquivo: RES_715, titulo: "Homologação: obtenção e direitos" },
          { arquivo: RES_715, titulo: "Sanções" },
          { arquivo: RES_780, titulo: "Alterações à Resolução 715/2019" },
          ...cartilha("Certificação e homologação"),
        ],
        topicos: [],
      },
    ],
  },

  {
    tema: ELETRONICA,
    titulo: "CONHECIMENTOS BÁSICOS DE ELETRÔNICA E ELETRICIDADE (CLASSE C)",
    classes: ["C", "B", "A"],
    topicos: [
      {
        id: "ele-c-eletronica-basica",
        titulo: "ELETRÔNICA BÁSICA",
        texto:
          "Noções básicas da Lei de Ohm, funções e utilizações de componentes eletrônicos, resistência, tensão, corrente e potência em circuitos elétricos.",
        secoes: cartilha("Eletricidade e lei de Ohm", "Componentes e materiais"),
        topicos: ["Lei de Ohm", "Capacitores e indutores como componentes"],
      },
      {
        id: "ele-c-eletromagnetismo-basico",
        titulo: "ELETROMAGNETISMO BÁSICO",
        texto:
          "Noções básicas sobre espectro eletromagnético, frequência e comprimento de onda.",
        secoes: cartilha("Eletromagnetismo e ondulatória"),
        topicos: [
          "Comprimento de onda e frequência",
          "Espectro eletromagnético e as faixas VLF, LF, MF, HF, VHF, UHF e SHF",
        ],
      },
      {
        id: "ele-c-protecao-eletrica",
        titulo: "PROTEÇÃO ELÉTRICA",
        texto:
          "Noções básicas da função e utilização de fusíveis/disjuntores e aterramento em circuitos elétricos.",
        secoes: cartilha("Proteção e medição elétrica"),
        topicos: ["Proteção elétrica"],
      },
      {
        id: "ele-c-medicao-eletrica",
        titulo: "MEDIÇÃO ELÉTRICA",
        texto:
          "Noções básicas da função e utilização do Multímetro (medição de tensão, corrente e resistência), Wattímetro e Medidor de Ondas Estacionárias.",
        secoes: cartilha("Proteção e medição elétrica"),
        topicos: ["Instrumentos de medição"],
      },
      {
        id: "ele-c-estacao",
        titulo: "ESTAÇÃO DE RADIOAMADOR",
        texto:
          "Noções básicas sobre a função dos receptores, transmissores, transceptores, repetidoras, antenas, linhas de transmissão, diagramas de blocos de transmissores e receptores.",
        secoes: cartilha("Estação de radioamador"),
        topicos: [],
      },
      {
        id: "ele-c-telecomunicacoes",
        titulo: "TELECOMUNICAÇÕES",
        texto: "Noções básicas sobre modulação, demodulação, propagação.",
        secoes: cartilha("Frequência, onda e modulação"),
        topicos: [],
      },
    ],
  },

  {
    tema: ELETRONICA,
    titulo: "CONHECIMENTOS DE ELETRÔNICA E ELETRICIDADE (CLASSE B)",
    classes: ["B", "A"],
    cumulativo:
      "Todo o conteúdo especificado nos Conhecimentos Básicos de Eletrônica e Eletricidade.",
    topicos: [
      {
        id: "ele-b-circuitos",
        titulo: "CIRCUITOS ELÉTRICOS",
        texto:
          "Lei de Ohm, cálculo da resistência, tensão, corrente e potência, conhecimentos básicos das Leis de Joule e Kirchhoff.",
        secoes: cartilha("Eletricidade e lei de Ohm"),
        topicos: [
          "Lei de Ohm e potência com múltiplos e submúltiplos",
          "Potência elétrica e Lei de Joule",
          "Leis de Kirchhoff das correntes e das tensões",
          "Múltiplos e submúltiplos de unidades elétricas e conversões",
        ],
      },
      {
        id: "ele-b-identificacao-resistores",
        titulo: "IDENTIFICAÇÃO DE RESISTORES",
        texto:
          "Determinação do valor da Resistência mediante o código de cores de um resistor.",
        secoes: cartilha("Componentes e materiais"),
        topicos: ["Código de cores de resistores"],
      },
      {
        id: "ele-b-associacao-resistores",
        titulo: "ASSOCIAÇÃO DE RESISTORES",
        texto: "Cálculo da Resistência em circuitos série e paralelo.",
        secoes: cartilha("Componentes e materiais"),
        topicos: [
          "Associação de resistores em série e em paralelo",
          "Divisor de tensão e queda de tensão em resistores em série",
        ],
      },
      {
        id: "ele-b-eletromagnetismo",
        titulo: "ELETROMAGNETISMO",
        texto:
          "Análise sobre cargas elétricas, campos elétricos, campos magnéticos e seus conceitos.",
        secoes: cartilha("Eletromagnetismo e ondulatória"),
        topicos: ["Cargas elétricas e campo elétrico", "Campo magnético"],
      },
      {
        id: "ele-b-teoria-circuitos-ca",
        titulo: "TEORIA DE CIRCUITOS (CA)",
        texto:
          "Conhecimentos básicos de impedância, reatância, capacitância e indutância em componentes eletrônicos.",
        secoes: cartilha("Circuitos em corrente alternada"),
        topicos: [
          "Capacitância, indutância, reatância e impedância em circuitos CA",
        ],
      },
      {
        id: "ele-b-ondulatoria",
        titulo: "ONDULATÓRIA",
        texto:
          "Análise de sinais ondulatórios senoidais com relação a frequência, amplitude e período.",
        secoes: cartilha("Eletromagnetismo e ondulatória"),
        topicos: [
          "Ondulatória",
          "Valores eficaz (RMS), máximo (pico) e médio de tensões senoidais",
        ],
      },
      {
        id: "ele-b-propriedade-materiais",
        titulo: "PROPRIEDADE DOS MATERIAIS",
        texto:
          "Conhecimentos básicos sobre condutores, semicondutores e isolantes.",
        secoes: cartilha("Componentes e materiais"),
        topicos: [
          "Semicondutores",
          "Condutores, semicondutores e isolantes; diodos e transistores",
        ],
      },
      {
        id: "ele-b-teoria-antenas",
        titulo: "TEORIA DE ANTENAS",
        texto:
          "Funcionamento básico e aplicação dos diversos tipos de antenas.",
        secoes: cartilha("Antenas: teoria aplicada"),
        topicos: ["Teoria de antenas"],
      },
      {
        id: "ele-b-propagacao-ondas",
        titulo: "PROPAGAÇÃO DE ONDAS",
        texto:
          "Conceitos básicos sobre polarização, interferência e ressonância.",
        secoes: cartilha("Propagação e fenômenos"),
        topicos: [
          "Ressonância, interferência e superposição de ondas, no nível de noções da Classe B",
          "Polarização de ondas eletromagnéticas e o alinhamento entre antenas transmissora e receptora",
        ],
      },
      {
        id: "ele-b-comunicacoes-digitais",
        titulo: "COMUNICAÇÕES DIGITAIS",
        texto: "Conceitos sobre modulações ASK, FSK e PSK.",
        secoes: cartilha("RF, redes e digital"),
        topicos: [
          "Modulações digitais ASK, FSK e PSK; modulação e demodulação",
          "Modulação digital (FSK e AFSK)",
        ],
      },
    ],
  },

  {
    tema: ELETRONICA,
    titulo:
      "CONHECIMENTOS TÉCNICOS DE ELETRÔNICA E ELETRICIDADE (CLASSE A)",
    classes: ["A"],
    cumulativo:
      "Todo o conteúdo especificado nos Conhecimentos de Eletrônica e Eletricidade.",
    topicos: [
      {
        id: "ele-a-teoria-circuitos",
        titulo: "TEORIA DE CIRCUITOS",
        texto:
          "Análise de circuitos CA série e paralelo. Conhecimentos técnicos de impedância, reatância, capacitância e indutância em componentes eletrônicos.",
        secoes: cartilha("Circuitos em corrente alternada"),
        topicos: [
          "Análise de circuitos RLC em série",
          "Análise de circuitos RLC em paralelo",
          "Cálculo de reatância indutiva e capacitiva em função da frequência, e potência real, aparente e fator de potência em CA",
          "Frequência de ressonância, fator de qualidade (Q), largura de banda e seletividade em circuitos sintonizados",
        ],
      },
      {
        id: "ele-a-teoria-ondas",
        titulo: "TEORIA DE ONDAS",
        texto:
          "Conhecimentos técnicos sobre funcionamento e aplicação dos diversos tipos de antenas.",
        secoes: cartilha("Antenas: teoria aplicada"),
        topicos: [
          "Antenas Yagi-Uda, dipolo de meia onda, vertical de quarto de onda e plano de terra",
          "Linhas de transmissão",
        ],
      },
      {
        id: "ele-a-eletronica-rf",
        titulo: "ELETRÔNICA DE RF",
        texto:
          "Conhecimentos técnicos de funcionamento e aplicação de componentes semicondutores em circuitos de transmissão.",
        secoes: cartilha("RF, redes e digital"),
        topicos: ["Eletrônica de RF"],
      },
      {
        id: "ele-a-fenomenos-propagacao",
        titulo: "FENÔMENOS DE PROPAGAÇÃO",
        texto:
          "Conceitos técnicos sobre polarização, ondas estacionárias, interferências, superposição e ressonância.",
        secoes: cartilha("Propagação e fenômenos"),
        topicos: ["Fenômenos de propagação", "Ondas estacionárias"],
      },
    ],
  },
];

const POR_ID = new Map(
  EMENTA.flatMap((b) => b.topicos.map((t) => [t.id, t] as const)),
);

/** Todos os tópicos, na ordem do Ato. */
export function topicos(): TopicoEmenta[] {
  return EMENTA.flatMap((b) => b.topicos);
}

/**
 * Os blocos que a classe cobra.
 *
 * Eletrônica é cumulativa: a Classe C vê um bloco, a B vê dois e a A vê os
 * três. Legislação e Técnica e Ética têm uma lista só para as três.
 */
export function blocosDaClasse(classe: Classe = CLASSE_PADRAO): BlocoEmenta[] {
  return EMENTA.filter((b) => b.classes.includes(classe));
}

/** As seções de material declaradas por um tópico, já resolvidas. */
export function secoesDoTopico(t: TopicoEmenta): Secao[] {
  return t.secoes.map(secaoPorRef).filter((s) => s !== null);
}

/**
 * As questões elegíveis de um tópico: as que saíram das seções declaradas mais
 * as de ementa cujo tópico do banco está na lista. Pode ser vazio — a Anatel
 * cobra o item mesmo que o banco ainda não o cubra.
 */
export function questoesDoTopico(
  t: TopicoEmenta,
  classe: Classe = CLASSE_PADRAO,
): Questao[] {
  const secoes = new Set(secoesDoTopico(t));
  const rotulos = new Set(t.topicos);
  return acervo(classe).filter((q) => {
    const s = secaoDe(q);
    if (s && secoes.has(s)) return true;
    return (
      q.origem === "ementa" && !!q.topico && rotulos.has(rotuloDoTopico(q.topico))
    );
  });
}

export function topicoPorId(id: string): TopicoEmenta | null {
  return POR_ID.get(id) ?? null;
}

/**
 * O tópico apontado por uma query string, ou null.
 *
 * Desconfiado como `lerDesafio`: a URL é entrada de fora, e um id desconhecido
 * — link velho, texto truncado por um mensageiro — tem de virar "não há
 * assunto aqui", nunca uma bateria estranha.
 */
export function lerAssunto(busca: string): TopicoEmenta | null {
  const id = new URLSearchParams(busca).get("assunto");
  return id ? topicoPorId(id) : null;
}

/** O link de estudo dirigido de um tópico. A bateria abre em `/`. */
export function linkDoAssunto(t: TopicoEmenta): string {
  return `/?assunto=${encodeURIComponent(t.id)}`;
}
