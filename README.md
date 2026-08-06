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
app/          rotas e layout (Next.js App Router)
components/   telas, dashboard e visualizador de PDF
hooks/        useHistorico — persistência em localStorage
lib/          tipos, constantes da prova, sorteio, histórico e mapa de PDFs
scripts/      processar_pdfs.py — gerador do banco de questões
              copiar_pdfs.mjs / preparar_worker.mjs — publicação de assets
testes/       sorteio, histórico, prioridade, PDFs, páginas, trechos, classes
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
- Dashboard com tendência por matéria (últimas baterias contra a linha de
  corte), exportar/importar do histórico para backup ou troca de aparelho, e
  lista de questões marcadas como suspeitas durante o estudo. Marcada a
  suspeita, um link abre no GitHub uma issue já preenchida com id, afirmação,
  gabarito e fonte — o banco é gerado por LLM, e quem estuda por ele é quem
  mais olha cada questão de perto.
- Tema claro/escuro/automático e três tamanhos de texto, persistidos e
  aplicados antes da primeira pintura.
- Compartilhar o resultado em texto e imprimir a revisão para estudar no papel.
- Histórico no navegador (`localStorage`) e dashboard com o percentual de
  acerto por matéria contra a linha de corte oficial de 55%.
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
5. deduplica, valida e revisa a aritmética das questões numéricas.

Cada chamada é cacheada em `scripts/.cache/`, então reexecuções não repagam
tokens. A chave de cache inclui um hash do prompt: editar um prompt invalida
automaticamente o que ele produziu.

Flags úteis: `--dry-run`, `--arquivo <padrão>`, `--limite-chunks N`,
`--verificar`, `--forcar`, `--listar-modelos`.

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
