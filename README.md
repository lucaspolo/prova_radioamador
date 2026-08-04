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
testes/       sorteio, histórico, prioridade, PDFs, trechos, classes e render
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
- Feedback imediato a cada questão, com explicação e indicação da fonte, mais o
  **trecho literal do PDF** que originou a afirmação, com a passagem destacada.
- Atalhos de teclado: `V` / `F` para responder, `Enter` para avançar.
- Histórico no navegador (`localStorage`) e dashboard com o percentual de
  acerto por matéria contra a linha de corte oficial de 55%.
- Botão **Consultar Material**: abre o PDF de origem já na página da questão,
  sem sair do simulado.

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

## Aviso

As questões são geradas por LLM a partir dos documentos oficiais e revisadas por
amostragem, não uma a uma. Em caso de divergência, **o documento oficial da
Anatel prevalece** — use o campo `arquivo_origem` para conferir na fonte.
