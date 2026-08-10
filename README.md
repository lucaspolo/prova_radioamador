# Simulados — Radioamador (Anatel)

Plataforma de simulados de Verdadeiro/Falso para o exame de certificação de
radioamador da Anatel, nas classes **A**, **B** e **C**.

O banco de questões é gerado por um script Python que lê os PDFs oficiais de
estudo e os estrutura com um LLM. O app é um site estático em Next.js que sorteia
baterias a partir desse banco.

## A prova real

Conforme o **Ato nº 3448, de 11 de março de 2026** (item 11.2 e 11.3), o exame é
composto de questões objetivas na modalidade *"certo ou errado"*. As três
matérias são as mesmas nas três classes; muda o quantitativo:

| Classe | Questões por matéria | Mínimo para aprovação | Tempo |
| --- | --- | --- | --- |
| C | 15 | 8 | 20 min |
| B | 20 | 11 | 30 min |
| A | 30 | 16 | 40 min |

O app espelha essa estrutura: escolhida a classe, a bateria padrão passa a ter o
tamanho da prova real e o veredito usa o corte oficial correspondente.

### O que muda entre as classes

A ementa do item 11.4 traz **uma única lista** de Legislação de Telecomunicações
e outra de Técnica e Ética Operacional, válidas para as três classes. Só
Eletrônica é escalonada, e de forma cumulativa: a Classe B é "todo o conteúdo"
da C mais dez tópicos, e a Classe A é todo o conteúdo da B mais quatro.

Por isso cada questão carrega um campo `nivel`:

- `B` — está no programa até a Classe B. Vale também para a Classe C, cuja
  ementa é um subconjunto. É o acervo padrão.
- `A` — o acréscimo exclusivo da Classe A: análise de circuitos RLC série e
  paralelo, fator de qualidade, impedância de ponto de alimentação, ganho em
  dBi/dBd, classes de operação de amplificadores de RF, superposição de ondas.
  Só entra em simulados de Classe A.

Quem estuda para a Classe C vê mais do que cai: o banco inclui cálculos
(código de cores, Kirchhoff, associação de resistores) que só são cobrados a
partir da Classe B. A tela inicial avisa.

## Estrutura

```
app/          rotas e layout (Next.js App Router) — inclui /conferencia
components/   telas, menu, resumo de desempenho e visualizador de PDF
hooks/        useHistorico — persistência em localStorage
lib/          tipos, constantes da prova, sorteio, histórico e mapa de PDFs
              conferencia.ts — ordem da revisão, storage e exportação
              triagem.ts — o que a conferência já decidiu, lido do triado
scripts/      processar_pdfs.py — gerador do banco de questões
              auditar_ocr.py — segundo leitor dos PDFs digitalizados
              copiar_pdfs.mjs / preparar_worker.mjs — publicação de assets
              exportar_tabelas.ts — tabelas de referência para o gerador
testes/       sorteio, histórico, estudo, bateria, prioridade, PDFs, páginas,
              trechos, classes, cobertura, cálculos, referência, conferência
              e render
public/       banco_questoes.json, trechos.json e pdfs/
```

## Funcionalidades

- Escolha da classe (A, B ou C), que define o acervo elegível, o tamanho da
  bateria padrão e o critério de aprovação.
- Bateria sempre de **uma matéria**, como a prova real: a Anatel aplica três
  exames separados, cada um com seu tempo e seu mínimo de acertos. Uma bateria
  misturando os três temas não corresponde a prova nenhuma — e o veredito dela
  aprovava quem compensasse uma matéria fraca com duas fortes, o que a norma
  não permite.
- Dois regimes de bateria. **Treino** dá feedback imediato a cada questão, com
  explicação e indicação da fonte, mais o **trecho literal do PDF** que originou
  a afirmação, com a passagem destacada. **Prova** é cega, como o exame:
  nenhum gabarito até encerrar, folha de respostas com o estado de cada
  questão, navegação livre para pular e voltar, marcação para revisar e
  confirmação ao encerrar com questões em branco. No fim, o gabarito abre
  completo — depois de uma prova cega, o que mais vale conferir são os acertos
  no chute, que a revisão de erros esconde por definição.
- Atalhos de teclado: `V` / `F` para responder, `Enter` para avançar.
- Cronômetro no ritmo oficial da prova (Classe B: 20 questões em 30 min),
  proporcional em baterias de outros tamanhos. Ao esgotar, as questões em
  branco contam como erro — igual à prova real. Pode ser desligado.
- Instalável como aplicativo (PWA) e utilizável offline: o service worker
  pré-carrega a casca do app e os trechos de origem; os PDFs entram no cache
  na primeira consulta e ficam disponíveis sem rede.
- **Prova completa**: as três matérias em sequência no formato oficial da
  classe, cada uma com seu cronômetro e seu mínimo — aprovação exige passar
  nas três, como no exame. É sempre cega.
- **Consulta rápida** offline: alfabeto fonético, código Q, plano de bandas com
  as classes habilitadas, prefixos de indicativo por UF e limites de potência,
  todos copiados dos PDFs oficiais e a um toque da página de origem; mais as
  calculadoras da ementa de Eletrônica (lei de Ohm, código de cores,
  comprimento de onda e antena, dBm e ressonância LC).
- **Revisão de erros**: bateria só com as questões erradas ainda não
  corrigidas; acertar tira da lista, sem veredito de aprovação.
- **Tela de desempenho**: percentual por matéria contra a linha de corte
  oficial de 55%, tendência das últimas baterias, exportar/importar do
  histórico para backup ou troca de aparelho, e lista de questões marcadas
  como suspeitas durante o estudo. Marcada a suspeita, um link abre no GitHub
  uma issue já preenchida com id, afirmação, gabarito e fonte — o banco é
  gerado por LLM, e quem estuda por ele é quem mais olha cada questão de
  perto. Na tela inicial fica só uma linha de resumo, com o que é acionável:
  quantos simulados, o percentual e qual matéria está abaixo do corte.
- **Um menu só** no cabeçalho, com as três telas — simulado, desempenho e
  consulta rápida, sempre as três, para voltar custar o mesmo que ir — mais o
  tema (claro/escuro/automático) e os três tamanhos de texto, persistidos e
  aplicados antes da primeira pintura. O menu não existe durante uma bateria
  nem nas telas de resultado: consulta rápida em prova cega seria cola.
- Compartilhar o resultado em texto e imprimir a revisão para estudar no papel.
- Histórico no navegador (`localStorage`).
- Botão **Consultar Material**: abre o PDF de origem já na página da questão,
  sem sair do simulado. A página é a do texto que trata do assunto, e não a do
  título da seção — vários títulos da Cartilha caem na última linha de uma
  página e o conteúdo só começa na seguinte. `testes/paginas.test.ts` abre os
  PDFs e reprova a questão cuja página vizinha fale claramente mais do assunto
  do que a apontada.

## Rodando o app

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # gera o site estático em out/
npm test         # testes de sorteio, histórico, PDFs e renderização
```

O worker do pdf.js é copiado de `node_modules` para `public/` automaticamente
antes de `dev` e de `build` (`scripts/preparar_worker.mjs`). Ele é gerado, e não
versionado, para não ficar defasado da versão instalada do `pdfjs-dist`.

Os PDFs de consulta já estão em `public/pdfs/`, com nomes seguros para URL. Para
republicá-los a partir de outra pasta de origem:

```bash
npm run pdfs -- /caminho/para/os/pdfs
```

Isso regrava `lib/mapa-pdfs.json`, que liga o campo `arquivo_origem` de cada
questão ao arquivo publicado.

## Regerando o banco de questões

Só é necessário ao trocar os PDFs de origem ou ajustar os prompts.

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env          # preencha OPENAI_API_KEY
.venv/bin/python scripts/processar_pdfs.py --dry-run   # não gasta API
.venv/bin/python scripts/processar_pdfs.py --verificar
```

Requer `pdftoppm` (pacote `poppler-utils`) para os PDFs digitalizados.

O script:

1. extrai texto com `pdfplumber`, página a página;
2. detecta PDFs sem camada de texto e os transcreve por **OCR de visão**
   (renderiza com `pdftoppm` e envia a imagem ao modelo);
3. divide em blocos e gera questões via Structured Outputs, classificando cada
   uma em um dos três temas;
4. roda passes complementares guiados pela ementa oficial, para os tópicos que
   os PDFs ensinam mas não exercitam (cálculo de eletrônica) ou tratam de forma
   resumida (operação);
5. roda um passe por tabela normativa, com uma questão para cada linha do plano
   de bandas e da tabela de prefixos por UF. As linhas vêm de
   `scripts/tabelas_referencia.json`, exportado de `lib/referencia.ts` por
   `npm run tabelas`: é a transcrição que `testes/referencia.test.ts` já confere
   contra o PDF, e não o texto cru da página, que o extrator entrega com as
   colunas embaralhadas. Reexporte depois de mexer em `lib/referencia.ts`;
6. roda um passe de reforço nas páginas que o passo 3 cobriu de raspão;
7. deduplica, valida e revisa a aritmética das questões numéricas.

Os passos 5 e 6 existem pela mesma razão. O passo 3 gera um número fixo de
questões por trecho, tenha o trecho uma linha ou trinta: a tabela das 28 faixas
recebia as mesmas oito questões de um trecho de prosa, e o trecho das pp. 50–52
da Cartilha concentrava as suas oito nas duas primeiras páginas. O resultado era
silencioso — 10 das 28 faixas, 26 das 27 unidades da federação e a página que
distingue certificação de homologação não tinham questão nenhuma, e nada
acusava. Hoje `testes/cobertura.test.ts` cobra cada faixa e cada UF, e confere
que nenhuma questão verdadeira atribua a um estado o prefixo de outro.

Ficam de fora do reforço, de propósito, as páginas administrativas: o que levar
para a prova, como pedir um documento. A ementa cobra o conteúdo técnico e
normativo do serviço, não o procedimento do exame — e o gerador já descarta
questão sobre a própria prova.

Cada chamada é cacheada em `scripts/.cache/`, então reexecuções não repagam
tokens. A chave de cache inclui um hash do prompt: editar um prompt invalida
automaticamente o que ele produziu.

Flags úteis: `--dry-run`, `--arquivo <padrão>`, `--limite-chunks N`,
`--verificar`, `--forcar`, `--listar-modelos`.

O banco é gravado em ordem estável — por documento, página e id. Sem isso o
`as_completed` do processamento paralelo embaralhava o arquivo a cada regeração,
e o `git diff` deixava de dizer o que mudou.

## Conferindo a transcrição dos PDFs digitalizados

Dois dos seis PDFs não têm camada de texto e só existem para o gerador através
do OCR de visão. Esse leitor tem um modo de falha próprio: ele erra
**normalizando**. Devolve português fluente e plausível que se afastou da fonte,
e nada no resultado denuncia. No Ato 3445 ele leu a primeira letra "W" do item
12.12.4 como "Y"; a questão saiu fiel ao trecho já corrompido, com o gabarito
invertido, e o erro só apareceu quando alguém que estudava por ela abriu a
[issue #2](https://github.com/lucaspolo/prova_radioamador/issues/2).

O conserto tem duas metades.

**`scripts/erratas_ocr.json`** corrige a transcrição na origem, logo depois do
OCR e antes de a página virar bloco. Fica versionado porque `scripts/.cache/`
está no `.gitignore`: consertado só no cache, o erro voltaria na próxima máquina
que regerasse o banco. Errata que não encontra o texto que promete corrigir é
erro fatal — o caso ruim seria o silencioso, em que a transcrição muda, a errata
deixa de casar e o banco volta a ser gerado errado sem aviso.

Como o `id` do trecho deriva do texto que o gerou, uma errata regera as questões
daquele bloco, com ids novos. É o comportamento correto: a questão nunca aponta
para um trecho que não foi o que a produziu.

**`scripts/auditar_ocr.py`** procura o próximo caso. Relê os mesmos PDFs com um
segundo leitor cujo modo de falha não seja correlacionado — `docling` com
`RapidOCR`, que lê pixel e não pode ser convencido pelo contexto de que "Y" cai
melhor ali — e aponta onde as duas leituras discordam **no que alguma questão
afirma**. Esse último filtro é o que separa sinal de ruído: divergência que
nenhuma afirmação repete não muda gabarito nenhum.

```bash
.venv/bin/pip install docling rapidocr-onnxruntime   # fora do requirements.txt: puxam torch
.venv/bin/python scripts/auditar_ocr.py
```

Nenhum dos dois leitores ganha em tudo, e por isso o gerador continua usando o
de visão. Medido na p.3 do Ato 3445 contra o gabarito conferido na imagem: em
prosa o docling não errou nada em 229 palavras e o modelo de visão errou seis;
em tabela é o contrário — a Tabela IV de prefixos sai inteira e certa pela
visão, enquanto o docling lê o dígito `0` dos prefixos de ilha como letra `O`
(`PP0F` → `PPOF`). Esse erro do docling é mecânico de achar, já que prefixo é
duas letras mais dígito; o "Y" não era.

O que já foi conferido na imagem e julgado inofensivo fica em
`scripts/auditar_ocr_triado.json`, para a auditoria não repetir o mesmo achado a
cada execução — uma que sempre grita a mesma coisa deixa de ser lida justamente
quando grita algo novo. A triagem é por par de tokens, e não por id de questão,
porque o id muda quando o trecho é regerado.

## Conferindo as questões na mão

As travas automáticas cobrem o que dá para derivar do texto: que a linha da
tabela está na página, que toda faixa e toda unidade da federação têm questão,
que duas leituras do mesmo PDF concordam. Nenhuma delas responde "esta afirmação
é verdadeira?". Os dois erros graves que já saíram deste banco — o "W" lido como
"Y" e as colunas trocadas da Tabela II, que inverteram treze gabaritos —
apareceram porque alguém leu uma questão e desconfiou.

```bash
npm run conferencia   # -> relatorios/conferencia.md
```

O relatório traz as 903 questões na ordem em que o assunto aparece nos PDFs,
cada uma com o gabarito, a explicação, a passagem do trecho que a produziu e o
`id`. Dá para abrir um PDF, ir descendo as páginas e conferir de uma vez tudo o
que o banco cobra de cada uma. Quem achar uma questão errada já tem o `id` em
mãos, que é a chave de `scripts/correcoes.json`.

Os arquivos vêm na ordem de quem paga melhor a primeira hora de leitura: começa
pelos que o gerador leu por OCR de visão, porque esse leitor erra normalizando e
foi de lá que saíram os dois erros graves; termina pelos que mais dependem da
ementa, cujas questões não se conferem contra a página. Quais são os
digitalizados sai do mesmo `MIN_CHARS_POR_PAGINA` que o gerador usa para decidir
entre camada de texto e OCR — não de uma lista de nomes, para que um PDF novo
sem camada de texto suba sozinho para o começo da fila.

A passagem citada é aproximada: sai da mesma função que grifa a origem no app
(`localizarPassagem`), por sobreposição de termos. Acha o lugar em 474 das 488
questões de documento; nas outras o relatório diz que não achou, em vez de
chutar. As 415 questões da ementa não têm texto de origem nenhum — nasceram de
um tópico, não de um trecho —, e ali a página é só o capítulo onde estudar o
assunto. O relatório marca cada uma.

`relatorios/` fica fora do histórico: é derivado de dois JSON já versionados, e
regerar custa menos que carregar meio megabyte de prosa em cada `git diff`.

### A tela de conferência

O Markdown resolve *achar* o que conferir; conferir mesmo pede o PDF aberto ao
lado. Para isso existe uma segunda saída dos mesmos dados:

```bash
npm run dev    # http://localhost:3000/conferencia
```

Tela larga, duas colunas: as questões à esquerda, na mesma ordem do relatório, e
à direita o PDF que gerou a selecionada — já rolado até a página e com a
passagem de origem grifada em amarelo. Trocar de questão move o PDF junto.

Cada questão recebe um veredito e, se for o caso, uma justificativa:

| | |
| --- | --- |
| **V** / **F** | a sua resposta, dada por conta própria. Divergir do gabarito marca a questão como achado. |
| **⚑** | nem uma nem outra: enunciado ambíguo, transcrição de OCR corrompida, questão sem resposta possível. |
| justificativa | contra o que você conferiu. Vale mesmo quando o gabarito confere — "certo, mas ambíguo" é achado. |

São mais de 900 questões, então o teclado importa: `J`/`K` andam, `V`/`F`/`P`
marcam e avançam, `Enter` cai na justificativa, `Esc` sai dela. O *modo cego*
esconde o gabarito até você decidir — é o que dá sentido a escolher V ou F em vez
de julgar uma resposta já escrita na tela. Os filtros (arquivo, tema, não
revisadas, divergentes, com nota, já triadas) permitem parar e voltar depois; a
barra de progresso mede sempre sobre o banco inteiro, e não sobre o filtro.

Tudo fica no `localStorage`, e **Baixar revisão** produz um JSON com o resumo e
o detalhe só do que precisa de ação — cada item já com afirmação, gabarito,
veredito, arquivo, página e a passagem de origem, para virar entrada de
`scripts/correcoes.json` sem abrir mais nada. O arquivo também serve de backup:
o campo `estado` traz o veredito de todas as revisões, inclusive as que
conferem, e **Importar** restaura a partir dele.

#### O que já foi decidido não volta a pedir trabalho

O veredito sobrevive no navegador de uma rodada para a outra, e sem nada mais um
achado já resolvido voltaria a contar como divergência em toda exportação
seguinte. A tela lê `scripts/conferencia_triado.json` e reconhece o que já tem
decisão: essas questões ganham o selo **✓ triado** e, ao serem abertas, mostram o
motivo registrado — o que foi conferido e contra o quê — antes de qualquer outra
coisa, para você não reconferir o que já foi conferido.

O botão **Dar N triadas por vistas** encerra essas pendências de uma vez. Ele não
mexe no seu veredito nem na sua nota: só carimba que a decisão do repositório foi
lida, e a partir daí elas saem dos contadores e da exportação (que passa a
listá-las em `vistas`, por nome, para nada sair do arquivo em silêncio). O que
ainda não foi triado nunca é tocado — é justamente o achado novo que a rodada
existe para produzir. Para revê-las, o filtro **já triadas**.

O que fazer com o arquivo baixado está em `.claude/skills/processar-conferencia/`:
cada achado vira conserto em `scripts/correcoes.json` ou `scripts/erratas_ocr.json`,
e o destino de todos eles — inclusive os descartados e os adiados — fica em
`scripts/conferencia_triado.json`. É esse arquivo que responde, meses depois, o
que já foi conferido e o que ainda falta, sem depender da memória de quem
conferiu.

Duas coisas a tela não faz. Nos dois PDFs digitalizados não há camada de texto
onde grifar — ela avisa, e ali a conferência é comparar a citação da esquerda
com a imagem da direita. E questão de ementa não tem passagem nenhuma: a página
indicada é o capítulo onde estudar o assunto, não a origem do enunciado.

A ordem dos capítulos é a mesma do Markdown porque as duas saídas chamam
`agruparEmCapitulos()` de `lib/conferencia.ts`. Quais PDFs vieram por OCR é o
único dado que a tela não consegue derivar sozinha — medir isso custaria baixar
os 5,4 MB dos seis arquivos antes da primeira questão —, então
`npm run conferencia` materializa o resultado em `lib/ocr-visao.json`, como
`npm run pdfs` faz com `lib/mapa-pdfs.json`.

## Formato do banco

```json
{
  "id": "uuid",
  "tema": "Legislação de Telecomunicações",
  "arquivo_origem": "Anatel - Ato nº 926, de 1 de fevereiro de 2024.pdf",
  "afirmacao": "Texto da afirmação",
  "resposta_correta": true,
  "explicacao_curta": "Justificativa",
  "pagina": 5
}
```

## De onde vem cada tabela de consulta

As questões são geradas por LLM; as tabelas da consulta rápida, não. Cada linha
é cópia literal de um PDF publicado em `public/pdfs/`, e
`testes/referencia.test.ts` abre o arquivo e confere que o texto está lá — um
número trocado derruba o teste.

O que esse teste **não** confere é onde uma coluna acaba e a outra começa. Ele
casa a linha inteira contra o texto da página, e mover um valor para a célula
vizinha não muda a string casada. Foi por aí que a Tabela II passou meses com a
série de três letras na coluna da classe "C", gerando 13 questões com gabarito
invertido. Fronteira de coluna só se prova com uma regra que conheça o
significado da tabela: a dos prefixos está em `testes/cobertura.test.ts`, que
confere UF **e** classe, nos dois sentidos.

As sete tabelas foram conferidas linha a linha contra a imagem das páginas
depois desse episódio. As de duas colunas (fonético, código Q, potência,
e.i.r.p., sufixos vedados) não têm fronteira ambígua — as de potência e e.i.r.p.
ainda amarram cada par numa frase inteira do Ato, do tipo "quando operada por
Radioamador Classe A, deve estar limitada a 1.500 W". No plano de bandas, as
subfaixas cujas classes poderiam deslizar trazem `trechosFonte` que amarram
radiofrequência e classe na mesma string.

| Tabela | Fonte |
| --- | --- |
| Alfabeto fonético | Cartilha, seção 6.2, pp. 34–35 |
| Código Q | Cartilha, seção 6.3, p. 36 |
| Plano de bandas e classes | Ato nº 926/2024, Tabela I, pp. 3–4 |
| Limites de potência por classe | Ato nº 926/2024, item 5.2, p. 4 |
| Limites de e.i.r.p. | Ato nº 926/2024, item 5.2.1, p. 5 |
| Prefixos por unidade da federação | Ato nº 3448/2026, Tabela II, pp. 8–9 |
| Sufixos vedados | Ato nº 3448/2026, item 12.2, p. 8 |

A escala **RST fica de fora**, e o app diz isso na tela: ela não aparece em
nenhum dos seis PDFs publicados aqui. Escrevê-la de memória seria fácil e
provavelmente daria certo — e é justamente por isso que não se faz, já que o
valor destas tabelas está em serem conferíveis contra a fonte.

## Aviso

As questões são geradas por LLM a partir dos documentos oficiais e revisadas por
amostragem, não uma a uma. Em caso de divergência, **o documento oficial da
Anatel prevalece** — use o campo `arquivo_origem` para conferir na fonte.

## Licença

Código aberto sob a licença [MIT](LICENSE). Sinta-se à vontade para usar,
modificar e redistribuir. O código-fonte está em
[github.com/lucaspolo/prova_radioamador](https://github.com/lucaspolo/prova_radioamador).
