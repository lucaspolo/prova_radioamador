---
name: processar-conferencia
description: Transforma o JSON baixado da tela /conferencia em consertos versionados do banco de questões. Use ao receber um arquivo conferencia-AAAA-MM-DD.json, ao ser pedido "processa a revisão", "analisa os problemas da conferência", "o que sobrou da conferência", ou ao retomar uma revisão interrompida. Não se aplica à geração do banco (processar_pdfs.py) nem ao relatório em Markdown (npm run conferencia).
---

# Processar a revisão da conferência

A tela `/conferencia` produz um JSON com o que o revisor humano achou. Esta skill
diz o que fazer com ele: **cada achado vira um conserto versionado, ou uma
recusa registrada — nunca some em silêncio.**

O ponto todo é não depender da memória de nenhuma sessão. Quem abrir o
repositório daqui a três meses precisa conseguir responder, só olhando os
arquivos: o que já foi conferido, o que virou conserto, o que foi olhado e
descartado, e o que ainda falta.

## Antes de tudo: onde o histórico mora

| Arquivo | Guarda |
| --- | --- |
| `scripts/correcoes.json` | conserto na questão (gabarito, página, remoção), por `id` |
| `scripts/erratas_ocr.json` | conserto na **transcrição** de um PDF digitalizado, por arquivo+página |
| `scripts/questoes_manuais.json` | questão escrita à mão, para repor uma removida |
| `scripts/conferencia_triado.json` | **a memória desta skill**: cobertura por arquivo e o destino de cada achado |

Os três primeiros já existem e são lidos por `scripts/processar_pdfs.py`. O
quarto é criado por esta skill se ainda não existir; ele é o que impede o mesmo
achado de ser rediscutido do zero a cada revisão, e é onde fica o que ficou
pendente.

O JSON baixado (`~/Downloads/conferencia-*.json`) **não** é o histórico: é
entrada descartável. `relatorios/` também não serve — está no `.gitignore`.

## O passo a passo

### 1. Ler o arquivo e situar

```bash
python3 -c "
import json,sys; d=json.load(open(sys.argv[1]))
print(d['resumo'])
print('retidos por já terem decisão:', d.get('vistas', []))
for i in d['itens']: print(i['id'], i['veredito'], 'gab', i['gabarito'], '|', i['afirmacao'][:70])
" ~/Downloads/conferencia-AAAA-MM-DD.json
```

Compare `resumo.porArquivo` com o `cobertura` de `scripts/conferencia_triado.json`:
o que subiu é revisão nova, o que não subiu continua pendente. Cruze
`d["estado"]` com os `achados` já triados e ignore o que já tem decisão — a
menos que o veredito tenha mudado, e aí a mudança é o assunto.

**`vistas` é o que a tela reteve, e não o que ela perdeu.** São ids que o revisor
deu por encerrados porque este arquivo aqui já registrou a decisão deles; eles
saem de `itens` justamente para não serem retriados a cada rodada. Confira que
todos constam em `achados` — um id em `vistas` sem decisão registrada seria
achado sumindo em silêncio, e aí o assunto é esse. O caminho de volta existe: o
revisor tira a marca reabrindo o veredito na tela.

**`revisoes` não é para esta skill.** A partir da versão 2 o arquivo carrega a
revisão inteira como está no navegador, para o revisor continuar em outro
computador. São centenas de entradas, quase todas de questões que conferiram e
não pedem nada. O que precisa de ação continua sendo `itens`; não trate o que só
aparece em `revisoes` como achado, ou você vai triar 900 questões que ninguém
questionou.

### 2. Conferir cada achado antes de agir

**O revisor também erra.** Nunca escreva um conserto só porque o veredito
divergiu. Para cada item:

- `trecho_id` presente → abra `public/trechos.json` nessa chave e leia o texto
  inteiro, não só o campo `passagem` (que é aproximação por sobreposição de
  termos, não prova).
- `por_ocr_de_visao: true` → a citação é a **leitura do modelo**, não os bytes
  do PDF. Confira contra a imagem da página antes de qualquer coisa:
  `pdftoppm -f <pagina> -l <pagina> -r 200 -png public/pdfs/<slug>.pdf /tmp/pag`
- `origem: "ementa"` → não existe texto de origem. A página é o capítulo do
  assunto. A conferência aqui é contra a norma, não contra a página.

Só depois de saber qual dos dois está certo é que se escolhe a linha da tabela
abaixo.

### 3. Escolher o conserto

| O que se descobriu | Onde conserta | Como |
| --- | --- | --- |
| Gabarito invertido, e o PDF confirma o revisor | `correcoes.json` | `{"acao":"editar","campos":{"resposta_correta":false},"motivo":"…"}` |
| Página aponta para o lugar errado | `correcoes.json` | `{"acao":"editar","campos":{"pagina":15},"motivo":"…"}` |
| Enunciado ambíguo, errado ou sem resposta possível | `correcoes.json` + talvez `questoes_manuais.json` | `{"acao":"remover","motivo":"…"}`, e reponha à mão se a pergunta valer |
| A transcrição do OCR se afastou da página | `erratas_ocr.json` | `{"pagina":3,"de":"<texto exato hoje>","para":"<texto certo>","motivo":"…"}` |
| O revisor se enganou | `conferencia_triado.json` | `"decisao":"descartado"` com o porquê, para não reabrir |
| Achado real, mas o conserto pede decisão que não é sua | `conferencia_triado.json` | `"decisao":"adiado"` com o que falta decidir |

**Três armadilhas que o repositório já cobra:**

1. **Nunca edite `afirmacao` por `correcoes.json`.** O `id` é hash da afirmação;
   mudá-la orfanaria o próprio conserto. `aplicar_correcoes()` levanta erro. Para
   trocar o texto: `remover` + entrada em `questoes_manuais.json`.
2. **Erro de OCR não é conserto de questão.** Se a transcrição está errada, todas
   as questões daquela página nasceram do texto errado. Consertar uma delas em
   `correcoes.json` deixa as outras erradas e esconde a causa. Vai em
   `erratas_ocr.json`, que age antes das questões existirem.
3. **`erratas_ocr.json` é casamento exato.** O campo `de` precisa ocorrer
   **uma única vez** na transcrição daquela página, ou `aplicar_erratas()` aborta
   a geração. Isso é de propósito: errata que deixa de casar em silêncio faria o
   banco voltar a ser gerado errado.

### 4. Registrar em `scripts/conferencia_triado.json`

Se o arquivo não existir, crie com esta forma. Todo achado do JSON entra aqui,
inclusive os que viraram conserto — é o índice de "isto já foi olhado".

```json
{
  "cobertura": {
    "Anatel - Ato nº 926, 01022024_2M_220_UHF.pdf": { "revisadas": 16, "total": 16, "em": "2026-08-08" }
  },
  "achados": {
    "80dbb3d44f9dd709": {
      "decisao": "corrigido",
      "onde": "correcoes.json",
      "motivo": "A Tabela XIV dá 51,610–52,000 como saídas de repetidoras com entradas -500 kHz; o gabarito V estava certo quanto à faixa, mas 'uso exclusivo' não está no documento. Removida a afirmação, reposta em questoes_manuais.json sem o adjetivo."
    },
    "94fa42f5489c886a": {
      "decisao": "descartado",
      "motivo": "O revisor marcou problema por achar a tabela ilegível no PDF digitalizado, mas a imagem da p.1 ampliada confirma a linha. Nada a consertar."
    }
  }
}
```

`motivo` é o campo que faz esta skill valer alguma coisa. Escreva o que foi
conferido e **contra o quê** — a frase precisa bastar para alguém decidir, sem
refazer o trabalho, se a conclusão continua válida quando o PDF mudar.

### 5. Fazer os consertos valerem

`correcoes.json` e `erratas_ocr.json` só têm efeito quando o banco é regerado —
`public/banco_questoes.json` no disco não muda sozinho:

```bash
.venv/bin/python scripts/processar_pdfs.py --verificar
```

Os chunks já estão em `scripts/.cache/`, então isso não gasta API para páginas
inalteradas. Uma errata nova invalida a página dela e ela volta ao modelo.

Depois, obrigatoriamente:

```bash
npm run conferencia   # regera o .md e lib/ocr-visao.json
npm test              # 14 suítes; paginas/referencia/cobertura pegam o que a mão errou
npm run lint && npx tsc --noEmit
```

Se o banco mudou, `git diff --stat public/banco_questoes.json` tem de mostrar
exatamente as questões que você quis mexer. Mais que isso é efeito colateral, e
efeito colateral aqui significa questão errada indo para quem estuda.

### 6. Commitar

Um commit por natureza de conserto, não um commit por revisão — o `git bisect`
precisa isolar. Siga a skill `git-commits` (prosa em português, o efeito e não a
implementação). O `motivo` que você escreveu no triado costuma ser o corpo do
commit já pronto.

## O que reportar ao usuário no fim

1. Quantos achados entraram, e o destino de cada um (corrigido / descartado / adiado).
2. **O que ficou pendente**, com o que falta para destravar — é a razão de a
   skill existir.
3. A cobertura: quais arquivos ainda têm questões não revisadas, e quantas.

Nunca diga que a revisão terminou enquanto `cobertura` mostrar arquivo com
`revisadas < total`. O banco tem 903 questões e a conferência é para ser feita
em várias sessões; um relatório que dá por encerrado o que está pela metade é
pior que nenhum, porque passa a sensação de cobertura sem ela.
