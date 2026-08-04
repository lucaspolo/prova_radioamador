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
components/   telas: início, simulado, resultado
lib/          tipos, constantes da prova e lógica de sorteio
scripts/      processar_pdfs.py — gerador do banco de questões
testes/       testes de lógica e de renderização
public/       banco_questoes.json
```

## Rodando o app

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # gera o site estático em out/
npm test         # testes de sorteio e de renderização
```

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
