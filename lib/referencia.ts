/**
 * Tabelas de consulta rápida, copiadas dos PDFs oficiais que acompanham o app.
 *
 * A regra desta camada é a mesma que o README promete sobre o banco de
 * questões: **o documento oficial prevalece**. Nada aqui pode ser escrito de
 * memória. Toda linha declara de qual arquivo e de quais páginas saiu, e
 * `testes/referencia.test.ts` abre o PDF e confere que o texto está lá — se
 * alguém digitar um número errado, ou inventar uma tabela, o teste falha.
 *
 * O corolário incômodo disso está no fim do arquivo: a escala RST não entra,
 * porque não existe em nenhum dos PDFs publicados aqui.
 */

export interface FonteTabela {
  /** Mesmo nome que `Questao.arquivo_origem` usa — resolve por `lib/pdfs.ts`. */
  arquivo: string;
  /** Páginas que a tabela ocupa. A primeira é a que o botão de consulta abre. */
  paginas: number[];
  /** O item ou a tabela citada no documento, p.ex. "Tabela I" ou "item 12.2". */
  referencia: string;
}

export interface LinhaTabela {
  celulas: string[];
  /**
   * Trechos literais da fonte que sustentam a linha, quando as células não
   * servem: célula mesclada no PDF (a coluna vazia herda a de cima), linha
   * partida entre duas páginas, ou texto corrido em vez de tabela.
   * Ausente: procura-se as próprias células, coladas na ordem.
   */
  trechosFonte?: string[];
}

export interface TabelaReferencia {
  id: string;
  titulo: string;
  descricao: string;
  colunas: string[];
  linhas: LinhaTabela[];
  fonte: FonteTabela;
  nota?: string;
}

const CARTILHA = "2026-06-30 CARTILHA-RADIOAMADOR-v9 2026-06.pdf";
const ATO_926 = "Anatel - Ato nº 926, de 1 de fevereiro de 2024.pdf";
const ATO_3448 = "SEI_ANATEL - 15307586 - Ato_orginal.pdf";

const FONETICO: TabelaReferencia = {
  id: "fonetico",
  titulo: "Alfabeto fonético internacional",
  descricao:
    "Soletração padrão da UIT. Serve para vencer sotaque, idioma e sinal fraco — é o que se usa para passar indicativo e nome no ar.",
  colunas: ["Letra", "Fonético correto"],
  fonte: { arquivo: CARTILHA, paginas: [34, 35], referencia: "seção 6.2" },
  linhas: [
    { celulas: ["A", "Alfa"] },
    { celulas: ["B", "Bravo"] },
    { celulas: ["C", "Charlie"] },
    { celulas: ["D", "Delta"] },
    { celulas: ["E", "Echo"] },
    { celulas: ["F", "Foxtrot"] },
    { celulas: ["G", "Golf"] },
    { celulas: ["H", "Hotel"] },
    { celulas: ["I", "Índia"] },
    { celulas: ["J", "Juliett"] },
    { celulas: ["K", "Kilo"] },
    { celulas: ["L", "Lima"] },
    { celulas: ["M", "Mike"] },
    { celulas: ["N", "November"] },
    { celulas: ["O", "Oscar"] },
    { celulas: ["P", "Papa"] },
    { celulas: ["Q", "Quebec"] },
    { celulas: ["R", "Romeo"] },
    { celulas: ["S", "Sierra"] },
    { celulas: ["T", "Tango"] },
    { celulas: ["U", "Uniform"] },
    { celulas: ["V", "Victor"] },
    { celulas: ["W", "Whiskey"] },
    { celulas: ["X", "X-Ray"] },
    { celulas: ["Y", "Yankee"] },
    { celulas: ["Z", "Zulu"] },
  ],
};

const CODIGO_Q: TabelaReferencia = {
  id: "codigo-q",
  titulo: "Código Q",
  descricao:
    "Os códigos que a Cartilha lista como principais em QSO. Cada um vale como pergunta ou como afirmação, dependendo da entonação e do contexto.",
  colunas: ["Código", "Uso prático em QSO"],
  fonte: { arquivo: CARTILHA, paginas: [36], referencia: "seção 6.3" },
  nota: "O regulamento admite no radioamadorismo somente as séries QRA a QUZ; os demais subconjuntos pertencem a operações aeronáuticas, marítimas e de outros serviços.",
  linhas: [
    { celulas: ["QRA", "Indicativo"] },
    { celulas: ["QRG", "Frequência exata de transmissão"] },
    {
      celulas: ["QTH", "Localização (cidade, região, latitude e longitude)"],
    },
    { celulas: ["QSL", "Confirmado, entendido; também cartão de QSO"] },
    { celulas: ["QRO", "Aumentar potência? (pergunta ou instrução)"] },
    { celulas: ["QTC", "Mensagem a transmitir"] },
    { celulas: ["QRM", "Interferência de outras estações"] },
    { celulas: ["QRP", "Diminuir a potência do transmissor?"] },
    { celulas: ["QRV", "Estou pronto / preparado"] },
    { celulas: ["QRT", "Devo cessar a transmissão?"] },
    { celulas: ["QSA", "Como está recebendo? Qual a intensidade do meu sinal?"] },
  ],
};

/**
 * Tabela I do Ato 926: a única fonte que liga faixa de frequência à classe de
 * COER. É a tabela que mais casa com o app — o simulado já é organizado por
 * classe, e aqui está o que cada classe pode operar de fato.
 *
 * Onde o PDF mescla a célula da faixa entre subfaixas, a linha repete o nome
 * da faixa para a tabela se ler sozinha na tela, e declara em `trechosFonte`
 * o texto que de fato existe na página.
 */
const BANDAS: TabelaReferencia = {
  id: "bandas",
  titulo: "Plano de bandas — quem pode operar cada faixa",
  descricao:
    "Faixas destinadas ao Serviço de Radioamador e as classes de COER habilitadas em cada subfaixa.",
  colunas: ["Faixa", "Radiofrequência", "Classes que podem operar"],
  fonte: { arquivo: ATO_926, paginas: [3, 4], referencia: "Tabela I" },
  linhas: [
    { celulas: ["Faixa de 2.200 metros", "135,7 - 137,8 kHz", "Todas as classes"] },
    { celulas: ["Faixa de 630 metros", "472 - 479 kHz", "Todas as classes"] },
    { celulas: ["Faixa de 160 metros", "1.800 - 1.850 kHz", "Todas as classes"] },
    {
      celulas: ["Faixa de 160 metros", "1.850 - 2.000 kHz", "A"],
      trechosFonte: ["1.850 - 2.000 kHz A"],
    },
    { celulas: ["Faixa de 80 metros", "3.500 - 3.800 kHz", "Todas as classes"] },
    {
      celulas: ["Faixa de 80 metros", "3.800 - 4.000 kHz", "A"],
      trechosFonte: ["3.800 - 4.000 kHz A"],
    },
    { celulas: ["Faixa de 60 metros", "5.351,5 - 5.366,5 kHz", "A"] },
    { celulas: ["Faixa de 40 metros", "7.000 - 7.047 kHz", "Todas as classes"] },
    {
      celulas: ["Faixa de 40 metros", "7.047 - 7.300 kHz", "A e B"],
      trechosFonte: ["7.047 - 7.300 kHz A e B"],
    },
    { celulas: ["Faixa de 30 metros", "10.100 - 10.150 kHz", "A"] },
    { celulas: ["Faixa de 20 metros", "14.000 - 14.350 kHz", "A"] },
    { celulas: ["Faixa de 17 metros", "18.068 - 18.168 kHz", "A"] },
    { celulas: ["Faixa de 15 metros", "21.000 - 21.150 kHz", "Todas as classes"] },
    {
      celulas: ["Faixa de 15 metros", "21.150 - 21.300 kHz", "A e B"],
      trechosFonte: ["21.150 - 21.300 kHz A e B"],
    },
    {
      celulas: ["Faixa de 15 metros", "21.300 - 21.450 kHz", "A"],
      trechosFonte: ["21.300 - 21.450 kHz A"],
    },
    { celulas: ["Faixa de 12 metros", "24.890 - 24.990 kHz", "Todas as classes"] },
    { celulas: ["Faixa de 10 metros", "28 - 29,7 MHz", "Todas as classes"] },
    { celulas: ["Faixa de 6 metros", "50 - 54 MHz", "Todas as classes"] },
    { celulas: ["Faixa de 2 metros", "144 - 148 MHz", "Todas as classes"] },
    { celulas: ["Faixa de 1,3 metro", "220 - 225 MHz", "Todas as classes"] },
    { celulas: ["Faixa de 70 centímetros", "430 - 440 MHz", "Todas as classes"] },
    { celulas: ["Faixa de 33 centímetros", "902 - 907,5 MHz", "Todas as classes"] },
    {
      celulas: ["Faixa de 33 centímetros", "915 - 928 MHz", "Todas as classes"],
      // A célula de classes é mesclada com a linha de cima no PDF: na página
      // só existe a subfaixa.
      trechosFonte: ["915 - 928 MHz"],
    },
    { celulas: ["Faixa de 23 centímetros", "1.240 - 1.300 MHz", "Todas as classes"] },
    { celulas: ["Faixa de 13 centímetros", "2.300 - 2.450 MHz", "Todas as classes"] },
    { celulas: ["Faixa de 9 centímetros", "3.300 - 3.500 MHz", "Todas as classes"] },
    { celulas: ["Faixa de 5 centímetros", "5.650 - 5.925 MHz", "Todas as classes"] },
    { celulas: ["Faixa de 3 centímetros", "10 - 10,50 GHz", "Todas as classes"] },
    { celulas: ["Faixa de 1,2 centímetro", "24 - 24,05 GHz", "Todas as classes"] },
    {
      celulas: ["Faixa de 1,2 centímetro", "24,05 - 24,25 GHz", "Todas as classes"],
      trechosFonte: ["24,05 - 24,25 GHz Todas as classes"],
    },
    { celulas: ["Faixa de 6 milímetros", "47 - 47,2 GHz", "Todas as classes"] },
    { celulas: ["Faixa de 4 milímetros", "76 - 77,5 GHz", "Todas as classes"] },
    {
      celulas: ["Faixa de 4 milímetros", "77,5 - 78 GHz", "Todas as classes"],
      trechosFonte: ["77,5 - 78 GHz Todas as classes"],
    },
    {
      celulas: ["Faixa de 4 milímetros", "78 - 81,5 GHz", "Todas as classes"],
      trechosFonte: ["78 - 81,5 GHz Todas as classes"],
    },
    { celulas: ["Faixa de 2,5 milímetros", "122,25 - 123 GHz", "Todas as classes"] },
    { celulas: ["Faixa de 2 milímetros", "134 - 136 GHz", "Todas as classes"] },
    {
      celulas: ["Faixa de 2 milímetros", "136 - 141 GHz", "Todas as classes"],
      trechosFonte: ["136 - 141 GHz Todas as classes"],
    },
    { celulas: ["Faixa de 1 milímetro", "241 - 248 GHz", "Todas as classes"] },
    {
      celulas: ["Faixa de 1 milímetro", "248 - 250 GHz", "Todas as classes"],
      trechosFonte: ["248 - 250 GHz Todas as classes"],
    },
  ],
};

const POTENCIA: TabelaReferencia = {
  id: "potencia",
  titulo: "Limites gerais de potência por classe",
  descricao:
    "Potência média na saída do transmissor, na fração de tempo em que o sistema permanece ativo (duty cycle).",
  colunas: ["Classe de COER", "Limite"],
  fonte: { arquivo: ATO_926, paginas: [4], referencia: "item 5.2" },
  nota: "A potência utilizada deve ser sempre a mínima necessária à realização do serviço com boa qualidade e adequada confiabilidade.",
  linhas: [
    {
      celulas: ["Classe A", "1.500 W"],
      trechosFonte: ["quando operada por Radioamador Classe A, deve estar limitada a 1.500 W"],
    },
    {
      celulas: ["Classe B", "1.000 W"],
      trechosFonte: ["quando operada por Radioamador Classe B, deve estar limitada a 1.000 W"],
    },
    {
      celulas: ["Classe C", "100 W"],
      trechosFonte: ["quando operada por Radioamador Classe C, deve estar limitada a 100 W"],
    },
  ],
};

const EIRP: TabelaReferencia = {
  id: "eirp",
  titulo: "Limites de e.i.r.p. por subfaixa",
  descricao:
    "Nestas subfaixas prevalece o limite de e.i.r.p. abaixo, e não o limite geral da classe.",
  colunas: ["Subfaixa", "e.i.r.p. máxima"],
  fonte: { arquivo: ATO_926, paginas: [5], referencia: "item 5.2.1" },
  linhas: [
    {
      celulas: ["135,7 kHz a 137,8 kHz", "1 W"],
      trechosFonte: ["na subfaixa de 135,7 kHz a 137,8 kHz, a e.i.r.p. máxima das estações deve ser 1 W"],
    },
    {
      celulas: ["472 kHz a 479 kHz", "5 W"],
      trechosFonte: ["na subfaixa de 472 kHz a 479 kHz, a e.i.r.p. máxima das estações deve ser 5 W"],
    },
    {
      celulas: ["5.351,5 kHz a 5.366,5 kHz", "25 W"],
      trechosFonte: ["na subfaixa de 5.351,5 kHz a 5.366,5 kHz, a e.i.r.p máxima das estações deve ser 25 W"],
    },
    {
      celulas: [
        "2.300 a 2.450 MHz, 3.400 a 3.500 MHz e 47 a 47,2 GHz (enlaces terrestres)",
        "100 W",
      ],
      trechosFonte: [
        "nas subfaixas de 2.300 MHz a 2.450 MHz, de 3.400 MHz a 3.500 MHz e de 47 GHz a 47,2 GHz, a e.i.r.p máxima das estações de enlaces terrestres deve ser 100 W",
      ],
    },
  ],
};

/**
 * Tabela II do Ato 3448. O que separa as classes é a série do prefixo, e não o
 * tamanho do sufixo: as classes A e B usam a série da UF (PY, PP, PT...) com
 * sufixo de duas OU de três letras, e a classe C usa a série PU. O dígito é o
 * da região do domicílio.
 *
 * A distinção parece o contrário quando se lê o texto extraído do PDF, porque
 * a coluna some: "PT 8 AA a ZZ" e "PT 8 AAA a YZZ" ficam em linhas separadas e
 * a de três letras cai ao lado do PU. Foi assim que a série de três letras
 * ficou em Classe "C" nas 27 linhas daqui, e o erro se propagou às questões
 * geradas a partir desta tabela. A ordem verdadeira está nos `trechosFonte`,
 * que seguem a ordem interna dos itens do PDF: UF, célula A/B inteira, célula
 * C inteira. `testes/cobertura.test.ts` agora confere a classe, não só a UF.
 *
 * A linha do Amazonas atravessa a virada de página, e a de São Paulo é a única
 * com duas séries em A/B (PY e PR) e duas em C (PU e PV) — as duas estão
 * transcritas como aparecem, inclusive o "PR 2 AA e ZZ", que o Ato escreve com
 * "e" onde as demais linhas trazem "a".
 */
const PREFIXOS: TabelaReferencia = {
  id: "prefixos",
  titulo: "Prefixos de indicativo por unidade da federação",
  descricao:
    "Formação do indicativo de chamada efetivo. As classes A e B usam a série da própria UF, com sufixo de duas ou três letras; a classe C usa a série PU.",
  colunas: ["Unidade da Federação", 'Classes "A" ou "B"', 'Classe "C"'],
  fonte: { arquivo: ATO_3448, paginas: [8, 9], referencia: "Tabela II" },
  linhas: [
    { celulas: ["Acre", "PT 8 AA a ZZ · PT 8 AAA a YZZ", "PU 8 JAA a LZZ"],
      trechosFonte: ["Acre PT 8 AA a ZZ PT 8 AAA a YZZ PU 8 JAA a LZZ"] },
    { celulas: ["Alagoas", "PP 7 AA a ZZ · PP 7 AAA a YZZ", "PU 7 AAA a DZZ"],
      trechosFonte: ["Alagoas PP 7 AA a ZZ PP 7 AAA a YZZ PU 7 AAA a DZZ"] },
    { celulas: ["Amapá", "PQ 8 AA a ZZ · PQ 8 AAA a YZZ", "PU 8 GAA a IZZ"],
      trechosFonte: ["Amapá PQ 8 AA a ZZ PQ 8 AAA a YZZ PU 8 GAA a IZZ"] },
    { celulas: ["Amazonas", "PP 8 AA a ZZ · PP 8 AAA a YZZ", "PU 8 AAA a CZZ"],
      // A linha é cortada pela virada da página 8 para a 9.
      trechosFonte: ["Amazonas PP 8 AA a ZZ PU 8 AAA a CZZ", "PP 8 AAA a YZZ"] },
    { celulas: ["Bahia", "PY 6 AA a ZZ · PY 6 AAA a YZZ", "PU 6 JAA a YZZ"],
      trechosFonte: ["Bahia PY 6 AA a ZZ PY 6 AAA a YZZ PU 6 JAA a YZZ"] },
    { celulas: ["Ceará", "PT 7 AA a ZZ · PT 7 AAA a YZZ", "PU 7 MAA a PZZ"],
      trechosFonte: ["Ceará PT 7 AA a ZZ PT 7 AAA a YZZ PU 7 MAA a PZZ"] },
    { celulas: ["Distrito Federal", "PT 2 AA a ZZ · PT 2 AAA a YZZ", "PU 2 AAA a EZZ"],
      trechosFonte: ["Distrito Federal PT 2 AA a ZZ PT 2 AAA a YZZ PU 2 AAA a EZZ"] },
    { celulas: ["Espírito Santo", "PP 1 AA a ZZ · PP 1 AAA a YZZ", "PU 1 AAA a IZZ"],
      trechosFonte: ["Espírito Santo PP 1 AA a ZZ PP 1 AAA a YZZ PU 1 AAA a IZZ"] },
    { celulas: ["Goiás", "PP 2 AA a ZZ · PP 2 AAA a YZZ", "PU 2 FAA a HZZ"],
      trechosFonte: ["Goiás PP 2 AA a ZZ PP 2 AAA a YZZ PU 2 FAA a HZZ"] },
    { celulas: ["Maranhão", "PR 8 AA a ZZ · PR 8 AAA a YZZ", "PU 8 MAA a OZZ"],
      trechosFonte: ["Maranhão PR 8 AA a ZZ PR 8 AAA a YZZ PU 8 MAA a OZZ"] },
    { celulas: ["Mato Grosso", "PY 9 AA a ZZ · PY 9 AAA a YZZ", "PU 9 OAA a YZZ"],
      trechosFonte: ["Mato Grosso PY 9 AA a ZZ PY 9 AAA a YZZ PU 9 OAA a YZZ"] },
    { celulas: ["Mato Grosso do Sul", "PT 9 AA a ZZ · PT 9 AAA a YZZ", "PU 9 AAA a NZZ"],
      trechosFonte: ["Mato Grosso do Sul PT 9 AA a ZZ PT 9 AAA a YZZ PU 9 AAA a NZZ"] },
    { celulas: ["Minas Gerais", "PY 4 AA a ZZ · PY 4 AAA a YZZ", "PU 4 AAA a YZZ"],
      trechosFonte: ["Minas Gerais PY 4 AA a ZZ PY 4 AAA a YZZ PU 4 AAA a YZZ"] },
    { celulas: ["Paraíba", "PR 7 AA a ZZ · PR 7 AAA a YZZ", "PU 7 EAA a HZZ"],
      trechosFonte: ["Paraíba PR 7 AA a ZZ PR 7 AAA a YZZ PU 7 EAA a HZZ"] },
    { celulas: ["Paraná", "PY 5 AA a ZZ · PY 5 AAA a YZZ", "PU 5 MAA a YZZ"],
      trechosFonte: ["Paraná PY 5 AA a ZZ PY 5 AAA a YZZ PU 5 MAA a YZZ"] },
    { celulas: ["Pará", "PY 8 AA a ZZ · PY 8 AAA a YZZ", "PU 8 WAA a YZZ"],
      trechosFonte: ["Pará PY 8 AA a ZZ PY 8 AAA a YZZ PU 8 WAA a YZZ"] },
    { celulas: ["Pernambuco", "PY 7 AA a ZZ · PY 7 AAA a YZZ", "PU 7 RAA a YZZ"],
      trechosFonte: ["Pernambuco PY 7 AA a ZZ PY 7 AAA a YZZ PU 7 RAA a YZZ"] },
    { celulas: ["Piauí", "PS 8 AA a ZZ · PS 8 AAA a YZZ", "PU 8 PAA a SZZ"],
      trechosFonte: ["Piauí PS 8 AA a ZZ PS 8 AAA a YZZ PU 8 PAA a SZZ"] },
    { celulas: ["Rio de Janeiro", "PY 1 AA a ZZ · PY 1 AAA a YZZ", "PU 1 JAA a YZZ"],
      trechosFonte: ["Rio de Janeiro PY 1 AA a ZZ PY 1 AAA a YZZ PU 1 JAA a YZZ"] },
    { celulas: ["Rio Grande do Norte", "PS 7 AA a ZZ · PS 7 AAA a YZZ", "PU 7 IAA a LZZ"],
      trechosFonte: ["Rio Grande do Norte PS 7 AA a ZZ PS 7 AAA a YZZ PU 7 IAA a LZZ"] },
    { celulas: ["Rio Grande do Sul", "PY 3 AA a ZZ · PY 3 AAA a YZZ", "PU 3 AAA a YZZ"],
      trechosFonte: ["Rio Grande do Sul PY 3 AA a ZZ PY 3 AAA a YZZ PU 3 AAA a YZZ"] },
    { celulas: ["Rondônia", "PW 8 AA a ZZ · PW 8 AAA a YZZ", "PU 8 DAA a FZZ"],
      trechosFonte: ["Rondônia PW 8 AA a ZZ PW 8 AAA a YZZ PU 8 DAA a FZZ"] },
    { celulas: ["Roraima", "PV 8 AA a ZZ · PV 8 AAA a YZZ", "PU 8 TAA a VZZ"],
      trechosFonte: ["Roraima PV 8 AA a ZZ PV 8 AAA a YZZ PU 8 TAA a VZZ"] },
    { celulas: ["Santa Catarina", "PP 5 AA a ZZ · PP 5 AAA a YZZ", "PU 5 AAA a LZZ"],
      trechosFonte: ["Santa Catarina PP 5 AA a ZZ PP 5 AAA a YZZ PU 5 AAA a LZZ"] },
    {
      celulas: [
        "São Paulo",
        "PY 2 AA a ZZ · PR 2 AA e ZZ · PY 2 AAA a YZZ · PR 2 AAA a YZZ",
        "PU 2 KAA a YZZ · PV 2 KAA a YZZ",
      ],
      trechosFonte: [
        "São Paulo PY 2 AA a ZZ PR 2 AA e ZZ PY 2 AAA a YZZ PR 2 AAA a YZZ PU 2 KAA a YZZ PV 2 KAA a YZZ",
      ],
    },
    { celulas: ["Sergipe", "PP 6 AA a ZZ · PP 6 AAA a YZZ", "PU 6 AAA a IZZ"],
      trechosFonte: ["Sergipe PP 6 AA a ZZ PP 6 AAA a YZZ PU 6 AAA a IZZ"] },
    { celulas: ["Tocantins", "PQ 2 AA a ZZ · PQ 2 AAA a YZZ", "PU 2 IAA a JZZ"],
      trechosFonte: ["Tocantins PQ 2 AA a ZZ PQ 2 AAA a YZZ PU 2 IAA a JZZ"] },
  ],
};

const SUFIXOS_VEDADOS: TabelaReferencia = {
  id: "sufixos-vedados",
  titulo: "Sufixos vedados no indicativo",
  descricao:
    "Grupamentos de letras que não podem figurar como sufixo do indicativo de chamada, no todo ou em parte.",
  colunas: ["Grupamentos vedados"],
  fonte: { arquivo: ATO_3448, paginas: [8], referencia: "item 12.2" },
  linhas: [
    {
      celulas: ["DDD, SNM, SOS, SVH, TTT, XXX, PAN, RRR e a série de QAA a QZZ"],
    },
  ],
};

export const TABELAS: readonly TabelaReferencia[] = [
  FONETICO,
  CODIGO_Q,
  BANDAS,
  POTENCIA,
  EIRP,
  PREFIXOS,
  SUFIXOS_VEDADOS,
];

/**
 * A escala RST é a ausência mais visível desta tela, e é deliberada.
 *
 * Uma varredura pelos seis PDFs publicados em `public/pdfs/` não encontra
 * nenhuma ocorrência de "RST", "legibilidade" ou "inteligibilidade do sinal".
 * Escrevê-la de memória seria fácil e provavelmente daria certo — e é
 * exatamente por isso que não se faz: o valor destas tabelas está em serem
 * conferíveis contra a fonte, e uma linha sem fonte contamina a confiança nas
 * outras.
 */
export const RST_SEM_FONTE = {
  titulo: "Sinais RST",
  motivo:
    "Não aparece em nenhum dos PDFs oficiais publicados neste app (Cartilha, Ato 926, Ato 3448, Resolução 777 e Ato 3445).",
  comoResolver:
    "Publique a fonte em public/pdfs/, ligue-a em lib/mapa-pdfs.json e acrescente a tabela com a página citada.",
} as const;
