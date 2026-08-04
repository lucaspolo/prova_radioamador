# Simulados — Radioamador Classe B (Anatel)

Plataforma de simulados de Verdadeiro/Falso para o exame de certificação de
radioamador **Classe B** da Anatel.

O banco de questões é gerado por um script Python que lê os PDFs oficiais de
estudo e os estrutura com um LLM. O app é um site estático em Next.js que sorteia
baterias a partir desse banco.

## A prova real

Conforme o **Ato nº 3448, de 11 de março de 2026** (item 11.2 e 11.3), o exame é
composto de questões objetivas na modalidade *"certo ou errado"*. Para a Classe B:

| Matéria | Questões | Mínimo para aprovação | Tempo |
| --- | --- | --- | --- |
| Legislação de Telecomunicações | 20 | 11 | 30 min |
| Técnica e Ética Operacional | 20 | 11 | 30 min |
| Conhecimentos de Eletrônica e Eletricidade | 20 | 11 | 30 min |

O app espelha essa estrutura: a bateria padrão tem 20 questões e o veredito usa
o corte oficial de 11 acertos.

## Estrutura

```
app/          rotas e layout (Next.js App Router)
components/   telas, dashboard e visualizador de PDF
hooks/        useHistorico — persistência em localStorage
lib/          tipos, constantes da prova, sorteio, histórico e mapa de PDFs
scripts/      processar_pdfs.py — gerador do banco de questões
              copiar_pdfs.mjs / preparar_worker.mjs — publicação de assets
testes/       sorteio, histórico, PDFs e renderização
public/       banco_questoes.json e pdfs/
```

## Funcionalidades

- Bateria por matéria ou com os três temas misturados. Em "Todos os Temas" as
  vagas são divididas igualmente, então 60 questões reproduzem a prova real
  (20 de cada) em vez de refletir o desequilíbrio do banco.
- Feedback imediato a cada questão, com explicação e indicação da fonte.
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
