#!/usr/bin/env python3
"""
Gera o banco de questoes Verdadeiro/Falso para a prova de radioamador Classe B
da Anatel a partir dos PDFs oficiais de estudo.

Pipeline:
    PDFs -> texto (pdfplumber, ou OCR por visao quando o PDF e digitalizado)
         -> chunks com rastreio de pagina
         -> LLM (OpenAI Structured Outputs) -> questoes V/F classificadas
         -> passe complementar de eletronica (questoes de calculo da ementa)
         -> deduplicacao e validacao
         -> public/banco_questoes.json

A prova real (Ato nº 3448, de 11/03/2026, item 11.2/11.3) e composta de questoes
objetivas "certo ou errado". Para a Classe B sao 3 materias de 20 questoes cada,
com minimo de 11 acertos por materia.

Uso:
    python scripts/processar_pdfs.py --dry-run
    python scripts/processar_pdfs.py --arquivo cartilha --limite-chunks 2
    python scripts/processar_pdfs.py
    python scripts/processar_pdfs.py --verificar
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import unicodedata
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable

import pdfplumber
from dotenv import load_dotenv

# pdfminer (usado por baixo do pdfplumber) e barulhento com PDFs mal formados.
import logging

logging.getLogger("pdfminer").setLevel(logging.ERROR)
logging.getLogger("pdfplumber").setLevel(logging.ERROR)


# ---------------------------------------------------------------------------
# Configuracao
# ---------------------------------------------------------------------------

RAIZ = Path(__file__).resolve().parent.parent
DIR_CACHE = RAIZ / "scripts" / ".cache"
SAIDA_PADRAO = RAIZ / "public" / "banco_questoes.json"
DIR_PDFS_PADRAO = "/home/lucaspolo/Downloads/materia_estudo_ra"

# Os tres temas sao um enum fechado: o schema do LLM nao aceita outro valor.
TEMAS = [
    "Técnica e ética operacional",
    "Legislação de Telecomunicações",
    "Conhecimentos de Eletrônica e Eletricidade",
]

# Tamanho dos blocos enviados ao LLM. ~6k caracteres mantem contexto suficiente
# para uma secao inteira de norma sem estourar custo por chamada.
TAMANHO_CHUNK = 6000
SOBREPOSICAO_CHUNK = 500

# Abaixo disso por pagina, consideramos que o PDF e uma digitalizacao sem
# camada de texto e partimos para OCR por visao.
MIN_CHARS_POR_PAGINA = 100

# Resolucao de renderizacao para OCR. 300 dpi resolve as tabelas de prefixos;
# a 200 dpi o modelo nao distinguia "0" de "O".
DPI_OCR = 300
DPI_OCR_RETENTATIVA = 400

# Chunks curtos demais sao capa, sumario ou assinatura eletronica.
MIN_CHARS_CHUNK_UTIL = 400

QUESTOES_POR_CHUNK = 8
MAX_TENTATIVAS = 5
WORKERS_PADRAO = 5

# Ementa oficial do Ato nº 3448/2026 (item 11.4). Serve de guia de cobertura
# para o gerador: o LLM deve puxar as questoes para esses topicos, que sao os
# efetivamente cobrados.
#
# A transcricao NAO mora aqui. Ela e' de lib/ementa.ts, que o app tambem usa
# para montar a pagina /estudar e que testes/ementa.test.ts confere contra o
# PDF item a item; `npm run ementa` exporta o JSON abaixo. Duas copias da mesma
# ementa seriam a errata esperando acontecer — uma republicacao do Ato
# corrigiria uma e deixaria a outra ensinando o programa do ano passado. Mesmo
# arranjo de scripts/tabelas_referencia.json.
#
# A ementa e' cumulativa em Eletronica: a Classe B e' "todo o conteudo" da C
# mais dez topicos, e a A e' todo o da B mais quatro. Legislacao e Tecnica e
# Etica tem uma lista so' para as tres classes. Por isso os blocos declaram
# `classes`, e nao o contrario.
ARQ_EMENTA = RAIZ / "scripts" / "ementa.json"


def carregar_ementa() -> list[dict[str, Any]]:
    """Le os blocos da ementa exportados de lib/ementa.ts."""
    if not ARQ_EMENTA.exists():
        raise SystemExit(
            f"{ARQ_EMENTA.name} não encontrado. Gere-o com `npm run ementa`."
        )
    return json.loads(ARQ_EMENTA.read_text(encoding="utf-8"))["blocos"]


BLOCOS_EMENTA = carregar_ementa()


def _itens(bloco: dict[str, Any], com_cumulativo: bool = True) -> list[str]:
    linhas = []
    if com_cumulativo and bloco["cumulativo"]:
        linhas.append(f"- {bloco['cumulativo']}")
    for t in bloco["topicos"]:
        rotulo = f"{t['titulo']}: " if t["titulo"] else ""
        linhas.append(f"- {rotulo}{t['texto']}")
    return linhas


def topicos_ementa(titulo: str, com_cumulativo: bool = True) -> str:
    """So' os itens de um bloco, sem o cabecalho dele."""
    for b in BLOCOS_EMENTA:
        if b["titulo"] == titulo:
            return "\n".join(_itens(b, com_cumulativo))
    raise SystemExit(
        f"bloco '{titulo}' não está em {ARQ_EMENTA.name}; "
        f"reexporte com `npm run ementa`."
    )


# O bloco que o passe da Classe A usa sozinho: ele e' o acrescimo sobre a
# Classe B, e o prompt de la' o apresenta como tal.
BLOCO_ELETRONICA_A = "CONHECIMENTOS TÉCNICOS DE ELETRÔNICA E ELETRICIDADE (CLASSE A)"


def ementa_texto(classe: str | None = None, tema: str | None = None) -> str:
    """Os blocos que a classe cobra (e, opcionalmente, so' de um tema)."""
    partes = []
    for b in BLOCOS_EMENTA:
        if classe is not None and classe not in b["classes"]:
            continue
        if tema is not None and b["tema"] != tema:
            continue
        partes.append("\n".join([b["titulo"], *_itens(b)]))
    return "\n\n".join(partes)


# ---------------------------------------------------------------------------
# Schema de saida do LLM (Structured Outputs, strict)
# ---------------------------------------------------------------------------

SCHEMA_QUESTOES: dict[str, Any] = {
    "name": "banco_questoes",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "questoes": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "tema": {"type": "string", "enum": TEMAS},
                        "afirmacao": {"type": "string"},
                        "resposta_correta": {"type": "boolean"},
                        "explicacao_curta": {"type": "string"},
                    },
                    "required": [
                        "tema",
                        "afirmacao",
                        "resposta_correta",
                        "explicacao_curta",
                    ],
                    "additionalProperties": False,
                },
            }
        },
        "required": ["questoes"],
        "additionalProperties": False,
    },
}

SCHEMA_VERIFICACAO: dict[str, Any] = {
    "name": "verificacao",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "veredito": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "indice": {"type": "integer"},
                        "consistente": {"type": "boolean"},
                        "motivo": {"type": "string"},
                    },
                    "required": ["indice", "consistente", "motivo"],
                    "additionalProperties": False,
                },
            }
        },
        "required": ["veredito"],
        "additionalProperties": False,
    },
}


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

PROMPT_SISTEMA = f"""\
Você é um examinador da Anatel que elabora questões para o exame de certificação \
de radioamador CLASSE B, no formato oficial "certo ou errado" (Verdadeiro/Falso).

Você recebe um TRECHO extraído de um documento oficial e deve produzir questões \
Verdadeiro/Falso fiéis a esse trecho.

REGRAS OBRIGATÓRIAS

1. FIDELIDADE: toda afirmação deve ser decidível a partir do TRECHO fornecido. \
Não invente números, prazos, artigos, faixas de frequência ou potências que não \
estejam no trecho. Se o trecho não sustenta a afirmação, não a crie.

2. TEMA: classifique cada questão em exatamente um destes três temas:
   - "Técnica e ética operacional" — operação da estação, antenas, propagação, \
interferência, comunicados, Código Q, alfabeto fonético, ética, emergências.
   - "Legislação de Telecomunicações" — normas, atos, resoluções, licenciamento, \
indicativos, classes, atribuição de faixas, sanções, homologação.
   - "Conhecimentos de Eletrônica e Eletricidade" — grandezas elétricas, Lei de \
Ohm, componentes, circuitos, eletromagnetismo, ondulatória, materiais, teoria de \
antenas, modulações digitais.

3. EQUILÍBRIO: aproximadamente METADE das questões deve ter resposta_correta=true \
e metade false. Não faça todas verdadeiras.

4. QUALIDADE DAS FALSAS: uma afirmação falsa deve ser PLAUSÍVEL — troque um valor \
numérico por outro verossímil, inverta uma condição, troque "pode" por "deve", \
generalize indevidamente uma exceção, ou atribua a uma classe o que é de outra. \
Nunca produza absurdos óbvios nem afirmações falsas por mero erro de português.

5. AUTOSSUFICIÊNCIA: a afirmação deve ser compreensível sozinha. Não use "o \
documento diz", "segundo o texto acima", "conforme citado" nem referências ao \
trecho. Quem responde não vê o trecho.

6. EXPLICAÇÃO: `explicacao_curta` tem 1 a 2 frases e diz por que a afirmação é \
verdadeira ou falsa. Se a afirmação for falsa, informe o dado correto.
   - NÃO escreva "o texto afirma", "o trecho diz" nem "o documento indica" — quem \
lê a explicação não tem o trecho à vista. Enuncie a regra diretamente.
   - Cite norma, artigo ou item APENAS quando o próprio trecho fizer essa \
identificação. Se o trecho ensina uma boa prática ou um conceito sem apontar a \
norma de origem, explique sem citar nenhuma. É melhor não citar do que citar \
errado: uma referência inventada ensina um erro a quem estuda.

7. DESCARTE: se o TRECHO for capa, sumário, índice, cabeçalho, rodapé, assinatura \
eletrônica, código verificador ou lista de referências — ou seja, se não houver \
conteúdo cobrável — retorne uma lista VAZIA. Isso é esperado e correto; não force \
questões a partir de material sem substância.
   Parte do material vem de transcrição automática de páginas digitalizadas. \
Onde aparecer a marca [ilegível], o dado NÃO foi lido com segurança: nunca use \
esse ponto como base de uma afirmação e nunca tente adivinhar o valor oculto.

8. FORA DO ESCOPO — não gere questões sobre:
   - O material de estudo em si: o que a cartilha substitui, em quais documentos \
ela se baseia, qual a sua versão, o que ela recomenda ler.
   - O procedimento administrativo do exame: cadastro no SEI ou no SEC, \
agendamento, requisitos de equipamento e ambiente para a prova online, inscrição \
de menor de idade, acompanhante, isenção de disciplinas, consulta de resultado.
   - A ementa ou o conteúdo programático do exame. Se o trecho listar as \
matérias e seus tópicos, ele descreve O QUE A PROVA COBRA — não é matéria. Nunca \
gere afirmações do tipo "a ementa inclui X", "consta do conteúdo programático Y" \
ou "na Classe B exige-se Z". Use esse trecho apenas como orientação de \
relevância, e retorne lista VAZIA se ele não trouxer nenhum outro conteúdo.
   Nada disso está na ementa. A prova cobra o conteúdo técnico e normativo do \
SERVIÇO DE RADIOAMADOR, não o processo de se inscrever nela. Se o trecho só \
tratar desses assuntos, retorne lista VAZIA.

9. RELEVÂNCIA: priorize o que consta da ementa abaixo. Regras operacionais, \
faixas de frequência, potências, classes, indicativos, condições de uso, sanções, \
conceitos técnicos e procedimentos de operação valem questão. Trivialidades \
editoriais não.

10. Escreva em português do Brasil. Não numere as afirmações.

EMENTA OFICIAL DA CLASSE B (guia de cobertura — priorize os pontos abaixo quando \
o trecho tocar neles):
{ementa_texto(classe="B")}"""


PROMPT_SISTEMA_ELETRONICA = f"""\
Você é um examinador da Anatel que elabora questões de ELETRÔNICA E ELETRICIDADE \
para o exame de radioamador CLASSE B, no formato oficial "certo ou errado".

Sua tarefa é gerar questões de APLICAÇÃO E CÁLCULO sobre o tópico solicitado. Os \
materiais de estudo ensinam a teoria mas não trazem exercícios resolvidos, e a \
prova cobra cálculo. Você deve criar os exercícios.

REGRAS OBRIGATÓRIAS

1. CORREÇÃO ARITMÉTICA: este é o ponto crítico. Calcule o resultado passo a passo \
antes de decidir `resposta_correta`. Use números que fechem em contas limpas \
(ex.: 12 V / 4 Ω = 3 A). Confira a conta uma segunda vez antes de responder. Uma \
questão com erro de cálculo é pior do que nenhuma questão.

2. UNIDADES: use unidades corretas e coerentes (V, A, Ω, W, Hz, F, H, dB). \
Atenção a múltiplos e submúltiplos (kΩ, mA, µF, MHz).

3. EQUILÍBRIO: aproximadamente metade das questões com resposta_correta=true e \
metade false. Nas falsas, apresente um resultado numérico errado mas plausível — \
tipicamente o erro que um candidato desatento cometeria (inverter a fórmula, \
somar resistores em paralelo, esquecer o fator de conversão).

4. TEMA: use sempre exatamente "Conhecimentos de Eletrônica e Eletricidade".

5. AUTOSSUFICIÊNCIA: enuncie todos os dados dentro da própria afirmação. \
Exemplo: "Um resistor de 220 Ω submetido a 11 V é percorrido por uma corrente de \
50 mA."

6. EXPLICAÇÃO: mostre a fórmula e o resultado correto. \
Exemplo: "I = V/R = 11/220 = 0,05 A = 50 mA."

7. NÍVEL: Classe B — noções e cálculos diretos, sem análise avançada de circuitos \
CA em série/paralelo (isso é Classe A).

8. Escreva em português do Brasil.

EMENTA OFICIAL DE ELETRÔNICA E ELETRICIDADE DA CLASSE B:
{ementa_texto(classe="B", tema=TEMAS[2])}"""


PROMPT_SISTEMA_CLASSE_A = f"""\
Você é um examinador da Anatel que elabora questões de ELETRÔNICA E ELETRICIDADE \
para o exame de radioamador CLASSE A, no formato oficial "certo ou errado".

A Classe A é o nível mais alto: a ementa exige CONHECIMENTOS TÉCNICOS, e não \
noções. Sua tarefa é gerar questões de análise técnica e cálculo sobre o tópico \
solicitado, no patamar acima do exigido na Classe B.

REGRAS OBRIGATÓRIAS

1. CORREÇÃO ARITMÉTICA: este é o ponto crítico. Calcule o resultado passo a passo \
antes de decidir `resposta_correta`. Confira a conta uma segunda vez. Uma questão \
com erro de cálculo é pior do que nenhuma questão. Prefira números que fechem \
limpos; quando o resultado for irracional (raízes, π), arredonde de forma \
explícita no enunciado e na explicação.

2. UNIDADES: use unidades corretas e coerentes (V, A, Ω, W, Hz, F, H, dB, dBi, \
dBd). Atenção a múltiplos e submúltiplos (kΩ, mA, µF, µH, MHz, pF).

3. EQUILÍBRIO: aproximadamente metade das questões com resposta_correta=true e \
metade false. Nas falsas, apresente o erro que um candidato bem preparado \
cometeria — somar reatâncias como se fossem resistências, trocar o sinal do \
ângulo de fase, confundir dBi com dBd, inverter a fórmula da ressonância.

4. TEMA: use sempre exatamente "Conhecimentos de Eletrônica e Eletricidade".

5. AUTOSSUFICIÊNCIA: enuncie todos os dados dentro da própria afirmação, \
inclusive a frequência de operação quando a resposta depender dela.

6. EXPLICAÇÃO: mostre a fórmula e o resultado correto. \
Exemplo: "XL = 2πfL = 2π · 7.000.000 · 2,2e-6 ≈ 96,8 Ω."

7. NÍVEL: Classe A. É AQUI que esta tarefa se distingue: exija análise, e não \
reconhecimento. Circuitos RLC série e paralelo com ângulo de fase e fator de \
qualidade, impedância de ponto de alimentação de antenas, ganho em dBi/dBd, \
coeficiente de reflexão e ROE a partir de impedâncias, classes de operação de \
amplificadores de RF, superposição de ondas. NÃO gere questões de nível Classe B \
(ler código de cores, aplicar V=RI direto, somar resistores em série): essas já \
existem no banco e não acrescentam nada ao candidato da Classe A.

8. ESCOPO: atenha-se ao acréscimo da Classe A descrito abaixo. Não invente \
exigências regulatórias brasileiras nem valores normativos.

9. Escreva em português do Brasil.

ACRÉSCIMO OFICIAL DA CLASSE A SOBRE A CLASSE B:
{topicos_ementa(BLOCO_ELETRONICA_A, com_cumulativo=False)}"""


PROMPT_SISTEMA_TABELA = """\
Você é um examinador da Anatel que elabora questões no formato oficial "certo ou \
errado" (Verdadeiro/Falso) a partir de TABELAS normativas.

Você recebe as LINHAS de uma tabela de um documento oficial, já transcritas e \
conferidas contra o PDF. Cada linha é um dado regulatório exato.

REGRAS OBRIGATÓRIAS

1. UMA QUESTÃO POR LINHA, na ordem em que as linhas aparecem. Se receber seis \
linhas, devolva seis questões.

2. A afirmação deve NOMEAR a chave da linha (a primeira célula: a faixa, a \
unidade da federação, a letra) de forma explícita. Quem responde precisa saber \
de qual linha se trata sem adivinhar.

3. NÃO INVENTE VALOR: todo número, prefixo, sufixo, classe ou limite que \
aparecer na questão tem de estar nas linhas fornecidas. Não arredonde, não \
converta unidade e não complete o que a tabela não diz.

4. EQUILÍBRIO: aproximadamente metade das questões com resposta_correta=true e \
metade false.

5. COMO ERRAR BEM: a questão falsa deve trocar o valor da linha pelo valor de \
uma linha de CHAVE DIFERENTE — o prefixo de outro estado, a frequência de outra \
faixa, a classe habilitada em outra faixa. É a confusão que o candidato de fato \
comete. Não invente um valor que não existe na tabela, e não crie falsa por \
negação preguiçosa ("não é verdade que...").

6. CUIDADO COM A CHAVE QUE SE REPETE: a mesma chave pode ocupar várias linhas — \
uma faixa de frequências costuma ter duas ou três subfaixas, cada uma com suas \
classes. Trocar uma subfaixa pela subfaixa VIZINHA DA MESMA FAIXA não produz \
uma afirmação falsa: produz uma afirmação verdadeira sobre a outra linha, e \
marcá-la como falsa põe um gabarito errado no simulado. Se a chave da linha se \
repete, o valor trocado tem de vir de outra chave.

   Errado: "Na Faixa de 4 milímetros, a radiofrequência é 77,5 - 78 GHz" \
marcada como falsa porque a linha sorteada era a de 76 - 77,5 GHz — as duas \
subfaixas são da mesma faixa, e a afirmação é verdadeira.

   Certo: "Na Faixa de 4 milímetros, a radiofrequência é 122,25 - 123 GHz" \
(que é da Faixa de 2,5 milímetros), ou manter a subfaixa e trocar as classes.

7. EXPLICAÇÃO: 1 a 2 frases. Quando a afirmação for falsa, diga qual é o valor \
correto da tabela.

8. AUTOSSUFICIÊNCIA: a afirmação deve ser compreensível sozinha. Não escreva \
"segundo a tabela", "conforme o quadro acima" nem equivalentes — quem responde \
não vê a tabela.

9. Escreva em português do Brasil."""


PROMPT_SISTEMA_TECNICA = f"""\
Você é um examinador da Anatel que elabora questões de TÉCNICA E ÉTICA \
OPERACIONAL para o exame de radioamador CLASSE B, no formato oficial "certo ou \
errado".

Sua tarefa é gerar questões sobre o tópico solicitado. Os materiais de estudo \
cobrem esses assuntos de forma resumida, e a prova cobra mais profundidade em \
operação, antenas, propagação e procedimentos.

REGRAS OBRIGATÓRIAS

1. CONHECIMENTO CONSOLIDADO: baseie-se em conhecimento técnico consolidado de \
radioamadorismo e nos padrões internacionais (Código Q, alfabeto fonético da UIT, \
convenções de propagação e de antenas). Este material é estável e universal.

2. NÃO INVENTE DADOS REGULATÓRIOS BRASILEIROS: limites de potência por classe, \
faixas e segmentos de frequência atribuídos no Brasil, frequências de chamada \
nacionais, formação de indicativos e prazos administrativos NÃO devem ser objeto \
destas questões — esses valores vêm da legislação e serão cobrados a partir dos \
documentos oficiais. Se o tópico exigir um número desse tipo, prefira o conceito \
à cifra.

3. EQUILÍBRIO: aproximadamente metade das questões com resposta_correta=true e \
metade false. As falsas devem ser plausíveis: inverta uma relação de causa, troque \
dois conceitos parecidos (ganho x diretividade, refração x reflexão, simplex x \
duplex), ou generalize indevidamente uma condição.

4. TEMA: use sempre exatamente "Técnica e ética operacional".

5. AUTOSSUFICIÊNCIA: a afirmação deve ser compreensível sozinha, sem remeter a \
nenhum texto. Não use "segundo o material" nem equivalentes.

6. EXPLICAÇÃO: 1 a 2 frases explicando o porquê. Se a afirmação for falsa, diga \
qual é o conceito correto. Não cite normas que você não tenha certeza de estar \
citando corretamente.

7. NÍVEL: Classe B — noções sólidas e aplicação prática, sem análise matemática \
avançada de RF (isso é Classe A).

8. Escreva em português do Brasil.

EMENTA OFICIAL DE TÉCNICA E ÉTICA OPERACIONAL:
{topicos_ementa("TÉCNICA E ÉTICA OPERACIONAL")}"""


PROMPT_OCR = """\
Transcreva integralmente e fielmente o conteúdo desta página de um documento \
oficial da Anatel sobre o Serviço de Radioamador.

Instruções:
- Preserve TODOS os valores numéricos exatamente: faixas de frequência, limites \
em MHz/kHz, potências, larguras de banda, designações de emissão, números de \
artigos e itens.
- Reproduza tabelas em Markdown, mantendo todas as linhas e colunas.
- Mantenha a hierarquia de títulos e a numeração dos itens.
- Não resuma, não interprete e não comente. Apenas transcreva.

TRECHOS ILEGÍVEIS: transcreva tudo o que conseguir ler e marque APENAS a parte \
duvidosa com [ilegível]. Exemplo: se numa célula você não distingue o dígito, \
escreva "PP[ilegível]". Não descarte o restante da página por causa dela.

Esta é uma transcrição automatizada: não há ninguém para responder você e não \
será possível enviar outra imagem. Portanto, NÃO peça uma versão em maior \
resolução, NÃO peça recortes ampliados, NÃO ofereça alternativas e NÃO comente \
sobre a qualidade da imagem. Produza a melhor transcrição possível desta imagem, \
usando [ilegível] onde houver dúvida.

Se a página estiver em branco ou contiver apenas elementos gráficos sem texto, \
responda exatamente: [PÁGINA SEM TEXTO]"""

# Uma recusa do modelo de visao chega como texto comum. Se for gravada no cache
# como se fosse o conteudo da pagina, ela vira chunk e o gerador tenta produzir
# questoes a partir de uma mensagem de erro.
PADROES_RECUSA = (
    "não consigo",
    "nao consigo",
    "não posso",
    "por favor envie",
    "envie uma versão",
    "maior resolução",
    "melhor esforço",
    "desculpe",
)


def parece_recusa(texto: str) -> bool:
    t = texto.lower()
    return sum(p in t for p in PADROES_RECUSA) >= 2


# Topicos dos passes complementares, derivados da ementa Classe B. A pagina e a
# da Cartilha onde o assunto e tratado, para o botao "Consultar Material" abrir
# no capitulo util em vez da capa.
#
# A pagina e' a do TEXTO que explica o topico, e nao a do titulo da secao. A
# distincao importa: varios titulos da Cartilha caem na ultima linha de uma
# pagina e o conteudo comeca na seguinte — "6.3 Codigo Q" e' a linha final da
# p.35 e a tabela inteira esta na p.36. Apontar para o titulo abre o material
# numa pagina onde nao ha nada do assunto, que e' o mesmo que apontar para a
# pagina anterior. Conferido contra o texto extraido do PDF, topico a topico.
# (topico, quantidade, pagina)
TOPICOS_ELETRONICA = [
    ("Lei de Ohm: cálculo de tensão, corrente e resistência", 10, 54),
    ("Potência elétrica e Lei de Joule: cálculo de potência e dissipação", 8, 54),
    ("Código de cores de resistores: leitura do valor e da tolerância", 8, 55),
    ("Associação de resistores em série e em paralelo: resistência equivalente", 8, 55),
    ("Leis de Kirchhoff das correntes e das tensões", 6, 55),
    ("Múltiplos e submúltiplos de unidades elétricas e conversões", 6, 54),
    ("Capacitância, indutância, reatância e impedância em circuitos CA", 8, 59),
    ("Ondulatória: frequência, período, amplitude e comprimento de onda", 8, 58),
    ("Espectro eletromagnético e as faixas VLF, LF, MF, HF, VHF, UHF e SHF", 6, 29),
    ("Condutores, semicondutores e isolantes; diodos e transistores", 6, 56),
    ("Instrumentos de medição: multímetro, wattímetro e medidor de ROE (SWR)", 6, 60),
    ("Teoria de antenas: dipolo, ganho, polarização, ROE e casamento de impedância", 8, 62),
    ("Modulações digitais ASK, FSK e PSK; modulação e demodulação", 6, 64),
    ("Proteção elétrica: fusíveis, disjuntores e aterramento", 5, 60),
    # -- Expansão (2026-08): buracos da ementa que os 14 tópicos originais nao
    # cobriam. A ementa da Classe B lista ELETROMAGNETISMO e PROPAGACAO DE
    # ONDAS explicitamente, e nada aqui cobria os capitulos 3 e 9 da Cartilha.
    # Topicos novos sao ADITIVOS: mudar um topico existente trocaria a chave de
    # cache, regeraria as questoes com ids novos e orfanaria o historico.
    ("Cargas elétricas e campo elétrico: atração e repulsão, unidades e "
     "conceitos básicos", 6, 57),
    ("Campo magnético: origem, características e relação com a corrente "
     "elétrica", 6, 57),
    ("Valores eficaz (RMS), máximo (pico) e médio de tensões senoidais: "
     "relações e cálculos", 8, 58),
    ("Capacitores e indutores como componentes: função, tipos básicos, "
     "associação e aplicações em rádio", 8, 56),
    ("Ressonância, interferência e superposição de ondas, no nível de noções "
     "da Classe B", 8, 62),
    ("Polarização de ondas eletromagnéticas e o alinhamento entre antenas "
     "transmissora e receptora", 6, 63),
    ("Lei de Ohm e potência com múltiplos e submúltiplos: cálculos com mA, "
     "kΩ, µF e mW", 8, 54),
    ("Divisor de tensão e queda de tensão em resistores em série: cálculos", 8, 55),
    ("Comprimento de onda e frequência: cálculos com λ(m) = 300/f(MHz)", 6, 29),
    ("Semicondutores: junção PN, polarização direta e reversa, diodo zener e "
     "LED", 8, 56),
]

# Acrescimo da Classe A. As paginas foram conferidas contra o sumario real da
# Cartilha: 5.3-5.6 (impedancia, fase, RLC, potencia CA) na 59; 8.1-8.3 (antenas)
# na 61; 9.1-9.5 (ressonancia, superposicao, ondas estacionarias, polarizacao) na
# 62; 10.1-10.2 (diodos e transistores em RF) na 63.
TOPICOS_CLASSE_A = [
    ("Análise de circuitos RLC em série: impedância, ângulo de fase entre tensão "
     "e corrente, e comportamento indutivo ou capacitivo", 8, 59),
    ("Análise de circuitos RLC em paralelo: impedância equivalente, correntes nos "
     "ramos e comportamento na ressonância", 8, 59),
    ("Frequência de ressonância, fator de qualidade (Q), largura de banda e "
     "seletividade em circuitos sintonizados", 8, 59),
    ("Cálculo de reatância indutiva e capacitiva em função da frequência, e "
     "potência real, aparente e fator de potência em CA", 8, 59),
    ("Teoria técnica de antenas: impedância de ponto de alimentação, ganho em "
     "dBi e dBd, diagrama de irradiação e relação frente-costas", 8, 61),
    ("Antenas Yagi-Uda, dipolo de meia onda, vertical de quarto de onda e plano "
     "de terra: dimensionamento em função do comprimento de onda", 8, 62),
    ("Linhas de transmissão: impedância característica, coeficiente de reflexão, "
     "ROE calculada a partir das impedâncias e perda de retorno", 8, 61),
    ("Eletrônica de RF: transistores bipolares e FET em amplificadores de "
     "potência, classes de operação A, AB, B e C, rendimento e linearidade", 8, 63),
    ("Eletrônica de RF: diodos em misturadores, detectores e multiplicadores; "
     "osciladores e estabilidade de frequência em transmissores", 6, 63),
    ("Fenômenos de propagação: polarização de ondas, superposição, interferência "
     "construtiva e destrutiva, e ressonância", 8, 62),
    ("Ondas estacionárias: formação, nós e ventres, relação com o descasamento "
     "de impedância e efeito sobre a potência transferida", 6, 62),
]

# Tecnica e Etica e o tema mais escasso nos PDFs, que sao majoritariamente
# normativos. Sem este passe sobram poucas questoes e o simulado desse tema
# passa a ser memorizado por reconhecimento.
TOPICOS_TECNICA = [
    ("Estação de radioamador: diagrama de blocos de receptores, transmissores, "
     "transceptores e repetidoras", 10, 26),
    ("Repetidoras: operação em shift/split, simplex e duplex, uso de tom "
     "subaudível e etiqueta de uso", 8, 27),
    ("Linhas de transmissão, onda estacionária (ROE/SWR) e casamento de "
     "impedância", 8, 29),
    ("Antenas: tipos e características, antenas direcionais, ganho e "
     "diretividade, polarização", 10, 28),
    ("Antena artificial (carga fictícia) e relação sinal/ruído", 6, 29),
    ("Frequência e comprimento de onda: relação entre eles, faixas de "
     "transmissão e batimento de frequências", 8, 29),
    ("Propagação: ondas terrestres e espaciais, camadas da ionosfera, "
     "comportamento em VLF, LF, MF, HF, VHF, UHF e SHF", 10, 32),
    ("Interferências: tipos, como detectar, como evitar e como proceder ao "
     "causá-las ou recebê-las", 8, 33),
    ("Comunicados: como estabelecer contato, chamada geral (CQ), relatório de "
     "sinal (RST) e modalidades de operação", 8, 34),
    ("Alfabeto Fonético da UIT: soletração correta de letras", 8, 34),
    ("Código Q: significado dos códigos usuais no radioamadorismo", 10, 36),
    ("Ética do radioamador: conduta no ar, uso racional de potência, "
     "identificação e procedimentos indispensáveis", 8, 37),
    ("Emergências: procedimentos operacionais, prioridade de tráfego e conduta "
     "em situações de socorro", 8, 38),
]


# Passe de tabela: cobertura linha a linha das tabelas normativas.
#
# O passe geral gera QUESTOES_POR_CHUNK questoes por chunk, tenha o chunk uma
# linha ou trinta. O chunk das pp.7-12 do Ato 926 traz dez tabelas de faixa e
# recebe as mesmas 8 questoes de um chunk de prosa; o das pp.8-9 do Ato 3448 traz
# as 27 unidades da federacao e tambem recebe 8. O modelo escolhe algumas linhas
# e ignora o resto. Medido no banco de 2026-08: 10 das 28 faixas do plano de
# bandas e 26 das 27 UFs nao apareciam em questao nenhuma, embora as duas tabelas
# estejam na consulta rapida do app e sejam materia de Legislacao.
#
# A cota aqui acompanha o numero de linhas. As linhas vem de
# scripts/tabelas_referencia.json, exportado de lib/referencia.ts por
# `npm run tabelas` — e nao do texto cru da pagina: o pdfplumber le a Tabela II
# do Ato 3448 com as colunas embaralhadas, e pedir ao modelo que refaca o
# pareamento UF -> prefixo a partir disso e' pedir para ele errar um dado
# regulatorio. A transcricao exportada ja passou pela conferencia contra o PDF
# que testes/referencia.test.ts faz linha a linha.
#
# Quem fecha o circuito e' testes/cobertura.test.ts: ele deriva a lista esperada
# da mesma lib/referencia.ts e cobra que cada faixa e cada UF tenha questao.
# O peso e o do sorteio, e nao a importancia da materia. Uma questao por linha e'
# o que garante cobertura, mas as 39 linhas da Tabela I viram 39 questoes do
# mesmo molde ("na Faixa de X, a radiofrequencia e' Y e podem operar Z"). No
# peso 1 elas seriam 11% do acervo de Legislacao e apareceriam ~2 vezes por
# bateria de 20, o suficiente para o candidato aprender a forma em vez do
# conteudo. Em 0,3 caem para menos de uma por bateria, sem sumir do banco.
#
# A de prefixos fica em 1: cada linha e' um estado com prefixos proprios, entao
# a repeticao e' de estrutura, nao de conteudo — quem responde precisa saber
# outra coisa a cada questao.
# (id da tabela em tabelas_referencia.json, tema, linhas por lote, peso)
TABELAS_COBERTURA = [
    ("bandas", TEMAS[1], 6, 0.3),
    ("prefixos", TEMAS[1], 6, 1.0),
]

ARQ_TABELAS = RAIZ / "scripts" / "tabelas_referencia.json"

# A Cartilha: unico PDF que cobre as tres materias. E' para ela que os passes
# complementares apontam a pagina de estudo, e dela que sai o reforco.
ARQUIVO_COMPLEMENTAR = "2026-06-30 CARTILHA-RADIOAMADOR-v9 2026-06.pdf"

# As normas do setor publicadas para CONSULTA (ver lib/secoes.ts, que as mapeia
# em secoes e as liga aos itens da ementa em lib/ementa.ts).
LGT = "Lei nº 9.472, de 16 de julho de 1997 (LGT).pdf"
RES_715 = "Anatel - Resolução nº 715, de 23 de outubro de 2019.pdf"
RES_719 = "Anatel - Resolução nº 719, de 10 de fevereiro de 2020.pdf"
RES_720 = "Anatel - Resolução nº 720, de 10 de fevereiro de 2020.pdf"
RES_779 = "Anatel - Resolução Anatel nº 779, de 28 de abril de 2025.pdf"
RES_780 = "Anatel - Resolução Anatel nº 780, de 1º de agosto de 2025.pdf"

# Lidos, mas fora do chunking geral: entram so' pelos passes dirigidos.
#
# Sao 119 paginas de norma setorial. A Lei 9.472 tem 39 e so' o Titulo V toca o
# radioamador; o Glossario tem 31 e o que cai sao cinco verbetes; a 719 e a 720
# tratam de prestadora, licitacao e preco publico. No chunking geral (6.000
# chars, 8 questoes por chunk) isso renderia ~700 questoes sobre concessao,
# tarifa e desestatizacao — quase dobrando o banco com o que o exame de
# radioamador nao cobra, e diluindo o sorteio de Legislacao na mesma proporcao.
#
# Continuam sendo LIDAS: `PAGINAS_REFORCO` precisa dos blocos, e elas tem camada
# de texto (nada de OCR, nada de custo de visao). O que se pula e' a cota por
# chunk. Tirar um arquivo daqui sem apontar as paginas em PAGINAS_REFORCO o faz
# voltar a nao render questao nenhuma.
SO_REFORCO = {LGT, RES_715, RES_719, RES_720, RES_779, RES_780}


# Passe de reforco: paginas que o chunking geral cobriu de raspao.
#
# Mesma causa do passe de tabela — cota fixa por chunk. O chunk das pp.50-52 da
# Cartilha recebeu 8 questoes e o modelo as concentrou nas duas primeiras
# paginas: a p.52 ficou com zero, e e' onde esta a distincao entre certificacao
# e homologacao, item nomeado na ementa de Legislacao ("Regulamento de Avaliacao
# da Conformidade e de Homologacao") e que a propria Cartilha marca com um "Para
# prova:".
#
# Sao paginas de prosa, entao aqui o passe e' o geral (fidelidade ao trecho),
# so' que mirando uma pagina e com cota propria. Estas questoes tem origem no
# documento e trecho literal, como as do passe geral.
#
# Ficam de fora, de proposito, as paginas administrativas que o levantamento
# tambem apontou como rasas — pp.8-9 (o que levar para a prova) e p.17 (como
# pedir documento): a ementa cobra o conteudo tecnico e normativo do servico, e
# nao o procedimento do exame. O gerador ja descarta questao sobre a prova em
# `questao_meta`; adicionar paginas dessas seria remar contra isso.
# (arquivo, paginas, assunto, questoes)
PAGINAS_REFORCO = [
    (ARQUIVO_COMPLEMENTAR, [52],
     "certificação x homologação de produtos: quem faz cada uma, em que ordem "
     "e para que serve", 6),
    (ARQUIVO_COMPLEMENTAR, [47],
     "atribuição de indicativos de chamada: séries internacionais do Brasil, "
     "escolha, vacância e sufixos vedados", 8),
    (ARQUIVO_COMPLEMENTAR, [45],
     "tipos de estação (fixa, móvel, repetidora) e uso da estação por terceiros "
     "não radioamadores", 6),
    ("Anatel - Ato nº 926, de 1 de fevereiro de 2024.pdf", [6],
     "regras gerais de uso das faixas: estações NSS temporárias, vedação de "
     "criptografia em modos digitais, salto em frequência e espalhamento "
     "espectral abaixo de 440 MHz", 8),

    # --- As normas de consulta, e so' os capitulos que o exame alcanca -------
    #
    # Aqui o reforco muda de papel: nas entradas acima ele corrige pagina
    # coberta de raspao; nestas, ele e' a UNICA porta de entrada do arquivo
    # (ver SO_REFORCO). Fora destas paginas, esses PDFs existem no app so' para
    # consulta.
    #
    # UMA pagina por entrada, sempre — ver a validacao logo abaixo.
    #
    # O Titulo V da LGT e' o unico trecho da lei que a prova alcanca. O art. 159
    # e' o mais valioso: e' a definicao legal de interferencia prejudicial, que
    # a ementa cobra em Tecnica (INTERFERENCIAS) e em Legislacao, e que o banco
    # so' tinha de forma indireta, pelo resumo da Cartilha.
    (LGT, [29],
     "o espectro como bem público e recurso limitado administrado pela Agência; "
     "o plano de atribuição, distribuição e destinação de radiofrequências; a "
     "definição legal de interferência prejudicial; a restrição de faixas por "
     "interesse público; e a sujeição da estação transmissora a licença de "
     "funcionamento prévia e a fiscalização permanente (arts. 157 a 162)", 8),
    (LGT, [30],
     "a outorga prévia da Agência para o uso de radiofrequência, com ou sem "
     "caráter de exclusividade, e as exceções à licença de funcionamento "
     "(art. 163)", 3),

    # O Glossario e' uma lista alfabetica de verbetes sem relacao entre si: uma
    # entrada por pagina nao e' so' a regra da atribuicao de pagina, e' o que
    # mantem a mira do modelo num punhado de definicoes por vez.
    (RES_779, [6],
     "a definição oficial de atribuição de uma faixa de radiofrequências", 2),
    (RES_779, [8], "a definição oficial de COER", 2),
    (RES_779, [10],
     "as definições oficiais de destinação e de distribuição de uma "
     "radiofrequência, faixa ou canal de radiofrequências", 3),
    (RES_779, [12], "a definição oficial de estação de radioamador", 2),
    (RES_779, [23],
     "a definição oficial de radioamador como pessoa habilitada a operar "
     "estação do Serviço de Radioamador", 2),
    (RES_779, [26],
     "a definição oficial de Serviço de Radioamador como serviço de interesse "
     "restrito prestado em regime privado", 2),

    # A Cartilha ja rende a distincao certificacao x homologacao (p.52, acima).
    # O que a norma acrescenta e' o ciclo de vida do certificado.
    (RES_715, [10],
     "a homologação como pré-requisito para uso e comercialização de produtos "
     "para telecomunicações, e o requerimento em formulário eletrônico", 3),
    (RES_715, [11],
     "os direitos que o Certificado de Homologação confere, conforme decorra "
     "de Declaração de Conformidade ou de Certificado de Conformidade", 2),
    (RES_715, [12],
     "o prazo de validade do Certificado de Homologação e as hipóteses de "
     "suspensão e de revogação", 3),
    (RES_715, [13], "a renovação da homologação", 2),
]

# Uma pagina por entrada, e a razao e' onde o botao "Consultar Material" abre.
#
# `chunk_de_paginas` junta o texto das paginas pedidas e atribui TODAS as
# questoes a `min(paginas)`. Numa faixa de quatro paginas isso mente: a
# definicao de Servico de Radioamador esta' na p.26 do Glossario e a questao
# sairia apontando a p.8. Quebra a promessa de `testes/paginas.test.ts` e manda
# quem estuda para a pagina errada — em silencio, que e' o pior modo de falha.
#
# O passe de tabela usa faixa de propósito: la' a atribuicao de pagina e' feita
# linha a linha, com o texto de cada pagina em separado. Aqui nao ha' esse
# desempate, entao a faixa fica proibida.
for _arq, _pags, _assunto, _n in PAGINAS_REFORCO:
    if len(_pags) != 1:
        raise ValueError(
            f"PAGINAS_REFORCO de {_arq} declara {len(_pags)} páginas ({_pags}); "
            f"use uma entrada por página, ou as questões apontarão todas para "
            f"a p.{min(_pags)}"
        )

# Nao entram no reforco, apesar de tambem estarem sem questao: as pp.7, 16 e 17
# do Ato 926, que sao a grade de modos de emissao por subfaixa. Ali o dado e'
# posicional — um "x" numa coluna CW/SSB/AM/FM/DV —, e a extracao de texto
# entrega "3.510 3.570 x" sem dizer sob qual coluna aquele "x" estava. Gerar
# questao dai e' inventar qual modo e' permitido. As faixas dessas paginas ja
# sao cobradas pela Tabela I, que diz quem pode operar cada uma e cujas linhas
# vem transcritas e conferidas.


def carregar_tabelas_referencia() -> dict[str, dict[str, Any]]:
    """Le as tabelas exportadas de lib/referencia.ts, indexadas por id."""
    if not ARQ_TABELAS.exists():
        log(f"AVISO: {ARQ_TABELAS.name} não encontrado; passe de tabela pulado. "
            f"Gere-o com `npm run tabelas`.")
        return {}
    try:
        dados = json.loads(ARQ_TABELAS.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        log(f"AVISO: {ARQ_TABELAS.name} inválido ({e}); passe de tabela pulado.")
        return {}
    return {t["id"]: t for t in dados}


# ---------------------------------------------------------------------------
# Estruturas
# ---------------------------------------------------------------------------


@dataclass
class Bloco:
    """Um paragrafo de texto com a pagina de onde saiu."""

    pagina: int
    texto: str


@dataclass
class Chunk:
    arquivo_origem: str
    pagina: int
    texto: str
    # Ultima pagina coberta pelo chunk. Chunks atravessam paginas, e a
    # auditoria refina a pagina de cada questao para a da passagem especifica;
    # este limite permite validar que o refinamento fica dentro do chunk.
    pagina_fim: int = 0

    @property
    def chave_cache(self) -> str:
        bruto = f"{self.arquivo_origem}|{self.pagina}|{self.texto}"
        return hashlib.sha1(bruto.encode("utf-8")).hexdigest()

    @property
    def id_trecho(self) -> str:
        """Identidade publica do trecho, usada por `public/trechos.json`.

        Deriva da mesma chave: se o texto extraido mudar, o id muda junto e a
        questao nunca aponta para um trecho que nao foi o que a gerou.
        """
        return self.chave_cache[:16]


@dataclass
class Uso:
    """Acumulador de tokens, compartilhado entre as threads."""

    entrada: int = 0
    saida: int = 0
    chamadas: int = 0
    cache_hits: int = 0
    _lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def registrar(self, entrada: int, saida: int) -> None:
        with self._lock:
            self.entrada += entrada
            self.saida += saida
            self.chamadas += 1

    def registrar_cache(self) -> None:
        with self._lock:
            self.cache_hits += 1


USO = Uso()


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------


def log(msg: str) -> None:
    print(msg, flush=True)


def normalizar(texto: str) -> str:
    """Normaliza uma afirmacao para deteccao de duplicatas."""
    t = unicodedata.normalize("NFKD", texto.lower())
    t = "".join(c for c in t if not unicodedata.combining(c))
    t = re.sub(r"[^a-z0-9\s]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def versao_prompt(*partes: str) -> str:
    """Identidade do prompt, usada na chave de cache.

    Sem isto, editar um prompt nao invalidaria o cache e a execucao seguinte
    devolveria silenciosamente as questoes geradas pela versao antiga.
    """
    return hashlib.sha1("|".join(partes).encode("utf-8")).hexdigest()[:12]


def ler_cache(chave: str) -> Any | None:
    caminho = DIR_CACHE / f"{chave}.json"
    if not caminho.exists():
        return None
    try:
        return json.loads(caminho.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        # Cache corrompido nao deve derrubar a execucao: regenera.
        return None


def gravar_cache(chave: str, valor: Any) -> None:
    DIR_CACHE.mkdir(parents=True, exist_ok=True)
    caminho = DIR_CACHE / f"{chave}.json"
    tmp = caminho.with_suffix(".tmp")
    tmp.write_text(json.dumps(valor, ensure_ascii=False), encoding="utf-8")
    tmp.replace(caminho)  # escrita atomica: o cache nunca fica pela metade


# ---------------------------------------------------------------------------
# Cliente OpenAI
# ---------------------------------------------------------------------------


def criar_cliente():
    from openai import OpenAI

    chave = os.getenv("OPENAI_API_KEY", "").strip()
    if not chave or chave.startswith("sk-..."):
        log("ERRO: OPENAI_API_KEY não configurada.")
        log("      Copie .env.example para .env e preencha a sua chave:")
        log("        cp .env.example .env")
        sys.exit(1)
    return OpenAI(api_key=chave, timeout=180.0, max_retries=0)


def chamar_llm(
    cliente,
    modelo: str,
    mensagens: list[dict[str, Any]],
    schema: dict[str, Any] | None = None,
) -> str:
    """Chama a API com backoff exponencial. Devolve o texto da resposta."""
    import openai

    kwargs: dict[str, Any] = {"model": modelo, "messages": mensagens}
    if schema is not None:
        kwargs["response_format"] = {"type": "json_schema", "json_schema": schema}

    ultimo_erro: Exception | None = None
    for tentativa in range(MAX_TENTATIVAS):
        try:
            resp = cliente.chat.completions.create(**kwargs)
            if resp.usage:
                USO.registrar(resp.usage.prompt_tokens, resp.usage.completion_tokens)
            return resp.choices[0].message.content or ""
        except (
            openai.RateLimitError,
            openai.APITimeoutError,
            openai.APIConnectionError,
            openai.InternalServerError,
        ) as e:
            ultimo_erro = e
            espera = min(2**tentativa, 30)
            log(f"    ! {type(e).__name__}, nova tentativa em {espera}s")
            threading.Event().wait(espera)
        except openai.BadRequestError as e:
            # Erro de schema/modelo: repetir nao ajuda.
            log(f"    ! Requisição rejeitada pela API: {e}")
            raise

    raise RuntimeError(f"Falhou após {MAX_TENTATIVAS} tentativas: {ultimo_erro}")


# ---------------------------------------------------------------------------
# Etapa 1 e 2: extracao de texto (com OCR por visao quando necessario)
# ---------------------------------------------------------------------------


def extrair_texto_nativo(caminho: Path) -> list[Bloco]:
    """Extrai texto por pagina com pdfplumber."""
    blocos: list[Bloco] = []
    with pdfplumber.open(caminho) as pdf:
        for n, pagina in enumerate(pdf.pages, start=1):
            texto = limpar_pagina(pagina.extract_text() or "")
            if texto.strip():
                blocos.append(Bloco(pagina=n, texto=texto))
    return blocos


def contar_paginas(caminho: Path) -> int:
    with pdfplumber.open(caminho) as pdf:
        return len(pdf.pages)


def renderizar_pagina(caminho: Path, pagina: int, dpi: int = DPI_OCR) -> bytes:
    """Renderiza uma pagina para PNG usando pdftoppm (poppler-utils)."""
    with tempfile.TemporaryDirectory() as tmp:
        prefixo = Path(tmp) / "pag"
        subprocess.run(
            [
                "pdftoppm", "-png", "-r", str(dpi),
                "-f", str(pagina), "-l", str(pagina),
                str(caminho), str(prefixo),
            ],
            check=True,
            capture_output=True,
        )
        pngs = sorted(Path(tmp).glob("pag*.png"))
        if not pngs:
            raise RuntimeError(f"pdftoppm não gerou imagem para a página {pagina}")
        return pngs[0].read_bytes()


ARQ_ERRATAS = RAIZ / "scripts" / "erratas_ocr.json"


def carregar_erratas() -> dict[str, list[dict[str, Any]]]:
    """Erratas de transcricao, conferidas na imagem da pagina.

    O modelo de visao erra normalizando: devolve portugues fluente e plausivel
    que se afastou da fonte. Foi assim que o "W" do item 12.12.4 do Ato 3445
    virou "Y" e produziu uma questao com gabarito invertido (issue #2). O erro
    nao tem como aparecer sozinho: o texto continua legivel e a questao gerada
    dele fica coerente.

    Por que um arquivo versionado e nao um conserto no cache: `scripts/.cache/`
    e' local e esta no .gitignore. Consertado so' la', o erro volta na proxima
    maquina que regerar o banco, e ninguem fica sabendo.
    """
    if not ARQ_ERRATAS.exists():
        return {}
    return json.loads(ARQ_ERRATAS.read_text(encoding="utf-8"))


def aplicar_erratas(
    arquivo: str, pagina: int, texto: str, erratas: dict[str, list[dict[str, Any]]]
) -> str:
    """Corrige a transcricao de uma pagina antes que ela vire chunk.

    Aplicada depois do cache, e nao dentro dele: o cache guarda o que o modelo
    respondeu, a errata e' uma camada separada por cima. Assim `--forcar`
    tambem sai corrigido, e da' para ver o que foi corrigido de quem.

    Errata que nao encontra o texto que promete corrigir e' erro fatal. O caso
    ruim e' o silencioso: o prompt de OCR muda, a transcricao sai diferente, a
    errata deixa de casar e o banco volta a ser gerado com o texto errado sem
    nenhum aviso.
    """
    for e in erratas.get(arquivo, []):
        if e["pagina"] != pagina:
            continue
        ocorrencias = texto.count(e["de"])
        if ocorrencias != 1:
            raise ValueError(
                f"errata de {arquivo} p.{pagina} esperava 1 ocorrência de "
                f"{e['de']!r} e achou {ocorrencias}. A transcrição mudou; "
                f"confira a página na imagem e refaça a errata."
            )
        texto = texto.replace(e["de"], e["para"])
        log(f"    página {pagina}: errata aplicada ({e['de']!r} -> {e['para']!r})")
    return texto


def extrair_texto_ocr(
    cliente, modelo: str, caminho: Path, forcar: bool
) -> list[Bloco]:
    """Le um PDF digitalizado transcrevendo cada pagina com o modelo de visao."""
    total = contar_paginas(caminho)
    log(f"  PDF digitalizado (sem camada de texto) -> OCR por visão, {total} páginas")

    erratas = carregar_erratas()
    blocos: list[Bloco] = []
    for pagina in range(1, total + 1):
        chave = hashlib.sha1(
            f"ocr|{versao_prompt(PROMPT_OCR)}|{modelo}|{caminho.name}|{pagina}"
            .encode("utf-8")
        ).hexdigest()

        if not forcar and (cacheado := ler_cache(chave)) is not None:
            USO.registrar_cache()
            texto = cacheado["texto"]
        else:
            # Paginas densas em tabela podem fazer o modelo recusar a 300 dpi;
            # nesse caso vale uma segunda tentativa com mais resolucao.
            texto = ""
            for dpi in (DPI_OCR, DPI_OCR_RETENTATIVA):
                png = renderizar_pagina(caminho, pagina, dpi=dpi)
                b64 = base64.b64encode(png).decode("ascii")
                texto = chamar_llm(
                    cliente,
                    modelo,
                    [
                        {
                            "role": "user",
                            "content": [
                                {"type": "text", "text": PROMPT_OCR},
                                {
                                    "type": "image_url",
                                    "image_url": {
                                        "url": f"data:image/png;base64,{b64}",
                                        "detail": "high",
                                    },
                                },
                            ],
                        }
                    ],
                )
                if not parece_recusa(texto):
                    break
                log(f"    página {pagina}: modelo recusou a {dpi} dpi")
            else:
                # Recusou nas duas tentativas: descartar e' mais seguro do que
                # deixar a mensagem de recusa virar conteudo de estudo.
                log(f"    página {pagina}/{total}: DESCARTADA (transcrição recusada)")
                texto = ""
            gravar_cache(chave, {"texto": texto})

        texto = aplicar_erratas(caminho.name, pagina, texto, erratas)
        limpo = limpar_pagina(texto)
        if limpo and "[PÁGINA SEM TEXTO]" not in limpo:
            blocos.append(Bloco(pagina=pagina, texto=limpo))
            log(f"    página {pagina}/{total}: {len(limpo)} caracteres transcritos")
        else:
            log(f"    página {pagina}/{total}: sem texto")

    return blocos


def obter_blocos(
    cliente, modelo: str, caminho: Path, forcar: bool, dry_run: bool
) -> list[Bloco]:
    """Escolhe entre extracao nativa e OCR conforme a densidade de texto."""
    blocos = extrair_texto_nativo(caminho)
    total_paginas = max(contar_paginas(caminho), 1)
    chars = sum(len(b.texto) for b in blocos)
    media = chars / total_paginas

    if media >= MIN_CHARS_POR_PAGINA:
        log(f"  Texto nativo: {chars} caracteres em {total_paginas} páginas")
        return blocos

    if dry_run:
        log(
            f"  PDF digitalizado ({chars} caracteres em {total_paginas} páginas) "
            f"-> seria processado por OCR de visão [--dry-run: pulado]"
        )
        return []

    return extrair_texto_ocr(cliente, modelo, caminho, forcar)


# ---------------------------------------------------------------------------
# Etapa 3: chunking
# ---------------------------------------------------------------------------


def dividir_em_paragrafos(blocos: list[Bloco]) -> list[Bloco]:
    """Quebra cada pagina em paragrafos, preservando a pagina de origem."""
    saida: list[Bloco] = []
    for bloco in blocos:
        for par in re.split(r"\n\s*\n", bloco.texto):
            par = par.strip()
            if par:
                saida.append(Bloco(pagina=bloco.pagina, texto=par))
    return saida


# Rodape do SEI: bloco de assinatura eletronica e codigo verificador. Aparece
# no fim de paginas que tambem contem texto normativo, entao precisa ser
# removido cirurgicamente, sem descartar a pagina.
RE_ASSINATURA = re.compile(
    r"(Documento assinado eletronicamente por.*?da Anatel\.)"
    r"|(A autenticidade deste documento.*?CRC\s+\w+\.)"
    r"|(Referência:.*?SEI\s*n[ºo]\s*\d+)",
    re.IGNORECASE | re.DOTALL,
)


def limpar_pagina(texto: str) -> str:
    """Remove sumario e blocos de assinatura, preservando o texto normativo.

    A limpeza e por linha/bloco, e nao por pagina inteira: uma pagina do SEI
    costuma trazer o rodape de assinatura logo abaixo de artigos validos, e
    descartar a pagina toda levaria junto o conteudo cobravel.
    """
    texto = RE_ASSINATURA.sub(" ", texto)
    # Linhas de sumario: titulo ligado ao numero da pagina por pontilhado.
    linhas = [l for l in texto.split("\n") if not re.search(r"\.{5,}", l)]
    return "\n".join(linhas).strip()


# O Ato 3448 traz a propria ementa das materias. O gerador tende a ler essa
# tabela como conteudo e produzir questoes sobre o programa da prova ("a ementa
# inclui X"), que testam o syllabus e nao a materia. Algumas ainda induzem a
# erro: tratar o alfabeto fonetico da ICAO como diferente do da UIT, quando sao
# o mesmo alfabeto, so porque a ementa diz "UIT".
RE_META_EMENTA = re.compile(
    r"\bementa\b|conteúdo programático|conteudo programatico", re.IGNORECASE
)


def questao_meta(q: dict[str, Any]) -> bool:
    return bool(
        RE_META_EMENTA.search(q.get("afirmacao", ""))
        or RE_META_EMENTA.search(q.get("explicacao_curta", ""))
    )


def parece_ruido(texto: str) -> bool:
    """Descarta o que sobrou sem substancia depois da limpeza."""
    # Sumario que escapou da limpeza por linha.
    if len(re.findall(r"\.{5,}", texto)) >= 3:
        return True
    # Texto degenerado: quase so pontuacao e digitos soltos. O limiar e baixo de
    # proposito — as tabelas de faixas de frequencia sao majoritariamente
    # numericas e sao justamente conteudo cobrado na prova.
    letras = sum(c.isalpha() for c in texto)
    return letras < len(texto) * 0.15


def montar_chunks(arquivo: str, blocos: list[Bloco]) -> list[Chunk]:
    """Agrupa paragrafos em chunks de ~TAMANHO_CHUNK com sobreposicao."""
    paragrafos = dividir_em_paragrafos(blocos)
    chunks: list[Chunk] = []
    atual: list[Bloco] = []
    tamanho = 0

    def fechar() -> None:
        nonlocal atual, tamanho
        if not atual:
            return
        texto = "\n\n".join(b.texto for b in atual).strip()
        if len(texto) >= MIN_CHARS_CHUNK_UTIL and not parece_ruido(texto):
            chunks.append(
                Chunk(arquivo_origem=arquivo, pagina=atual[0].pagina,
                      texto=texto, pagina_fim=atual[-1].pagina)
            )
        # Mantem o final do chunk como sobreposicao, para nao cortar uma regra
        # exatamente na fronteira e perde-la. So entra o paragrafo que couber
        # dentro do limite: um paragrafo longo no fim nao pode virar quase o
        # chunk inteiro de novo, senao o texto e reenviado varias vezes.
        sobreposicao: list[Bloco] = []
        acumulado = 0
        for bloco in reversed(atual):
            if acumulado + len(bloco.texto) > SOBREPOSICAO_CHUNK:
                break
            sobreposicao.insert(0, bloco)
            acumulado += len(bloco.texto)
        atual = sobreposicao
        tamanho = acumulado

    for par in paragrafos:
        # Um paragrafo gigante (tabela longa) vira um chunk sozinho.
        if len(par.texto) > TAMANHO_CHUNK:
            fechar()
            atual = []
            tamanho = 0
            for i in range(0, len(par.texto), TAMANHO_CHUNK):
                fatia = par.texto[i : i + TAMANHO_CHUNK]
                if len(fatia) >= MIN_CHARS_CHUNK_UTIL and not parece_ruido(fatia):
                    chunks.append(
                        Chunk(arquivo_origem=arquivo, pagina=par.pagina,
                              texto=fatia, pagina_fim=par.pagina)
                    )
            continue

        if tamanho + len(par.texto) > TAMANHO_CHUNK:
            fechar()

        atual.append(par)
        tamanho += len(par.texto)

    fechar()
    atual = []
    return chunks


# ---------------------------------------------------------------------------
# Etapa 4: geracao de questoes a partir dos chunks
# ---------------------------------------------------------------------------


def gerar_do_chunk(
    cliente,
    modelo: str,
    chunk: Chunk,
    forcar: bool,
    quantidade: int = QUESTOES_POR_CHUNK,
    foco: str | None = None,
) -> list[dict[str, Any]]:
    """Gera questoes de um chunk.

    `foco` mira o passe de reforco num assunto dentro do trecho. Sem ele, o
    modelo escolhe o que cobrar — o que basta numa pagina de prosa, e falha numa
    pagina de glossario, onde os verbetes nao tem relacao entre si e a maioria
    nao cai na prova.
    """
    # `quantidade` e `foco` entram na chave de cache no lugar onde a constante
    # entrava: com o padrao, a chave dos chunks ja gerados nao muda, e o cache
    # continua valendo. So' o passe de reforco, que pede outra cota e declara
    # foco, gera chave nova.
    chave = hashlib.sha1(
        f"gen|{versao_prompt(PROMPT_SISTEMA)}|{modelo}|{quantidade}"
        f"{'|foco:' + foco if foco else ''}"
        f"|{chunk.chave_cache}".encode("utf-8")
    ).hexdigest()

    if not forcar and (cacheado := ler_cache(chave)) is not None:
        USO.registrar_cache()
        questoes = cacheado["questoes"]
    else:
        prompt = (
            f"DOCUMENTO: {chunk.arquivo_origem}\n"
            f"PÁGINA: {chunk.pagina}\n\n"
            f"TRECHO:\n\"\"\"\n{chunk.texto}\n\"\"\"\n\n"
            f"Gere até {quantidade} questões Verdadeiro/Falso a partir "
            f"deste trecho, seguindo todas as regras. Se o trecho não tiver "
            f"conteúdo cobrável, retorne uma lista vazia."
            + (
                f"\n\nFOCO: cubra {foco}. O trecho pode trazer outros assuntos "
                f"— ignore-os, ainda que sobre cota."
                if foco
                else ""
            )
        )
        bruto = chamar_llm(
            cliente,
            modelo,
            [
                {"role": "system", "content": PROMPT_SISTEMA},
                {"role": "user", "content": prompt},
            ],
            schema=SCHEMA_QUESTOES,
        )
        try:
            questoes = json.loads(bruto).get("questoes", [])
        except json.JSONDecodeError:
            log(f"    ! Resposta não-JSON para {chunk.arquivo_origem} p.{chunk.pagina}")
            return []
        gravar_cache(chave, {"questoes": questoes})

    for q in questoes:
        q["arquivo_origem"] = chunk.arquivo_origem
        q["pagina"] = chunk.pagina
        # Liga a questao ao trecho literal que a gerou, para que o app possa
        # mostrar o texto de origem sem obrigar o usuario a caçar a frase
        # dentro do PDF.
        q["_trecho"] = chunk.id_trecho
    return questoes


# ---------------------------------------------------------------------------
# Etapa 5: passe complementar de eletronica
# ---------------------------------------------------------------------------

# Os passes complementares nao partem de um trecho: geram questoes a partir da
# ementa oficial, cobrindo o que os PDFs ensinam sem exercitar (calculo) ou
# tratam de forma resumida demais (operacao). Apontam para o capitulo da
# Cartilha que cobre o assunto (ARQUIVO_COMPLEMENTAR), para consulta.


def gerar_complementar(
    cliente,
    modelo: str,
    prefixo: str,
    prompt_sistema: str,
    instrucao: str,
    tema: str,
    topico: str,
    quantidade: int,
    pagina: int,
    classe: str,
    forcar: bool,
) -> list[dict[str, Any]]:
    """Gera questoes de um topico da ementa, sem partir de um trecho de PDF."""
    chave = hashlib.sha1(
        f"{prefixo}|{versao_prompt(prompt_sistema)}|{modelo}|{topico}"
        f"|{quantidade}".encode("utf-8")
    ).hexdigest()

    if not forcar and (cacheado := ler_cache(chave)) is not None:
        USO.registrar_cache()
        questoes = cacheado["questoes"]
    else:
        prompt = (
            f"TÓPICO: {topico}\n\n"
            f"Gere exatamente {quantidade} questões Verdadeiro/Falso sobre este "
            f"tópico, no nível da Classe {classe}. {instrucao}"
        )
        bruto = chamar_llm(
            cliente,
            modelo,
            [
                {"role": "system", "content": prompt_sistema},
                {"role": "user", "content": prompt},
            ],
            schema=SCHEMA_QUESTOES,
        )
        try:
            questoes = json.loads(bruto).get("questoes", [])
        except json.JSONDecodeError:
            log(f"    ! Resposta não-JSON para o tópico: {topico}")
            return []
        gravar_cache(chave, {"questoes": questoes})

    for q in questoes:
        # O passe e exclusivo de um tema; corrige eventual desvio do modelo.
        q["tema"] = tema
        q["arquivo_origem"] = ARQUIVO_COMPLEMENTAR
        q["pagina"] = pagina
        # Marca interna: estas nao vem de um trecho de PDF, entao passam pela
        # verificacao independentemente de conterem numeros. Removida na escrita.
        q["_complementar"] = True
        q["_nivel"] = classe
        # O topico que dirigiu a geracao vira o "assunto" da questao no app.
        # Anexado AQUI, depois da leitura do cache, para alcancar tambem as
        # entradas antigas — o topico ja compoe a chave de cache, entao nada
        # e' invalidado e nenhuma chamada nova acontece.
        q["_topico"] = topico
    return questoes


def gerar_da_tabela(
    cliente,
    modelo: str,
    tabela: dict[str, Any],
    lote: list[list[str]],
    tema: str,
    chunk: Chunk,
    paginas_texto: dict[int, str],
    peso: float,
    forcar: bool,
) -> list[dict[str, Any]]:
    """Gera uma questao para cada linha de um lote da tabela.

    Diferente do passe da ementa, estas questoes tem origem no documento: o
    `chunk` traz o texto literal das paginas da tabela, e e ele que vai para
    `public/trechos.json` como trecho de origem. O que o modelo recebe para
    escrever sao as linhas conferidas, nao o texto embaralhado da pagina.
    """
    # O "·" separa valores dentro de uma celula e existe para a tabela na tela.
    # Cru no prompt, ele reaparece dentro da frase da questao — "os prefixos sao
    # PT 8 AA a ZZ · PT 8 AAA a YZZ" —, e ali e' texto para ler, nao tabela.
    linhas = "\n".join(
        " | ".join(c.replace(" · ", ", ") for c in linha) for linha in lote
    )
    chave = hashlib.sha1(
        f"tab|{versao_prompt(PROMPT_SISTEMA_TABELA)}|{modelo}|{tabela['id']}"
        f"|{linhas}".encode("utf-8")
    ).hexdigest()

    if not forcar and (cacheado := ler_cache(chave)) is not None:
        USO.registrar_cache()
        questoes = cacheado["questoes"]
    else:
        prompt = (
            f"DOCUMENTO: {tabela['arquivo']}\n"
            f"TABELA: {tabela['referencia']} — {tabela['titulo']}\n"
            f"COLUNAS: {' | '.join(tabela['colunas'])}\n\n"
            f"LINHAS:\n{linhas}\n\n"
            f"Gere exatamente {len(lote)} questões Verdadeiro/Falso, uma por "
            f"linha, na ordem acima. Use sempre o tema \"{tema}\"."
        )
        bruto = chamar_llm(
            cliente,
            modelo,
            [
                {"role": "system", "content": PROMPT_SISTEMA_TABELA},
                {"role": "user", "content": prompt},
            ],
            schema=SCHEMA_QUESTOES,
        )
        try:
            questoes = json.loads(bruto).get("questoes", [])
        except json.JSONDecodeError:
            log(f"    ! Resposta não-JSON para a tabela {tabela['id']}")
            return []
        gravar_cache(chave, {"questoes": questoes})

    # A regra 2 do prompt — nomear a chave da linha — e o que faz a questao
    # exercitar aquela linha e nao a tabela em geral. Conferir aqui e' barato e
    # deterministico: sem isto, "a faixa seguinte tem limite maior" passaria,
    # sem dizer de qual faixa se trata. A chave que casou tambem diz em qual
    # pagina da tabela a linha mora.
    chaves = [(normalizar(linha[0]), linha[0]) for linha in lote]
    aproveitadas: list[dict[str, Any]] = []
    for q in questoes:
        afirmacao = normalizar(q.get("afirmacao") or "")
        casada = next(
            (rotulo for chave, rotulo in chaves if chave and chave in afirmacao),
            None,
        )
        if casada is None:
            continue
        # O passe e exclusivo de um tema; corrige eventual desvio do modelo.
        q["tema"] = tema
        q["arquivo_origem"] = tabela["arquivo"]
        q["pagina"] = pagina_da_linha(casada, paginas_texto, chunk.pagina)
        q["_trecho"] = chunk.id_trecho
        q["_peso"] = peso
        aproveitadas.append(q)

    if len(aproveitadas) < len(questoes):
        log(f"    {len(questoes) - len(aproveitadas)} questões descartadas por não "
            f"nomear a linha ({tabela['id']})")
    return aproveitadas


def pagina_da_linha(rotulo: str, paginas_texto: dict[int, str], padrao: int) -> int:
    """Pagina em que a linha aparece de fato.

    A Tabela I atravessa as pp.3-4 do Ato 926 e a Tabela II as pp.8-9 do Ato
    3448. Apontar toda questao para a primeira pagina manda quem aperta
    "Consultar Material" para uma pagina onde a linha nao esta — e e' o que
    `testes/paginas.test.ts` reprova, comparando o assunto da pagina apontada
    com o da vizinha.
    """
    alvo = normalizar(rotulo)
    for pagina in sorted(paginas_texto):
        if alvo and alvo in normalizar(paginas_texto[pagina]):
            return pagina
    return padrao


def chunk_de_paginas(
    arquivo: str, paginas: list[int], blocos: list[Bloco]
) -> Chunk | None:
    """Monta um chunk com o texto literal de paginas especificas.

    Serve aos dois passes dirigidos — o de tabela e o de reforco —, que
    precisam mirar uma pagina exata em vez do recorte do chunking geral.
    """
    do_intervalo = [b for b in blocos if b.pagina in paginas]
    texto = "\n\n".join(b.texto for b in do_intervalo).strip()
    if len(texto) < MIN_CHARS_CHUNK_UTIL:
        return None
    return Chunk(
        arquivo_origem=arquivo,
        pagina=min(paginas),
        texto=texto,
        pagina_fim=max(paginas),
    )


# ---------------------------------------------------------------------------
# Etapa 5b: verificacao das questoes numericas (--verificar)
# ---------------------------------------------------------------------------

PROMPT_VERIFICACAO = """\
Você é um revisor técnico rigoroso de questões para o exame de radioamador. \
Abaixo está uma lista numerada de questões Verdadeiro/Falso, cada uma com a \
resposta atribuída e a explicação.

Para CADA questão, decida de forma independente — refazendo o cálculo quando \
houver conta, ou conferindo o conceito quando for teórica — se a resposta \
atribuída está correta e coerente com a explicação.

Marque `consistente=false` quando houver:
- erro aritmético, unidade incorreta ou conversão errada;
- afirmação tecnicamente incorreta ou conceito trocado;
- resposta invertida em relação ao que a explicação demonstra;
- valor regulatório brasileiro (potência por classe, faixa, frequência de \
chamada, formação de indicativo) que você não possa confirmar com segurança — na \
dúvida sobre um número regulatório, marque como inconsistente.

Em `motivo`, seja breve e informe o dado correto. Quando estiver tudo certo, use \
`consistente=true` e `motivo` curto."""


def verificar_lote(
    cliente, modelo: str, lote: list[dict[str, Any]], forcar: bool
) -> list[bool]:
    """Devolve, para cada questao do lote, se ela passou na verificacao."""
    corpo = "\n\n".join(
        f"[{i}] AFIRMAÇÃO: {q['afirmacao']}\n"
        f"    RESPOSTA ATRIBUÍDA: {'VERDADEIRO' if q['resposta_correta'] else 'FALSO'}\n"
        f"    EXPLICAÇÃO: {q['explicacao_curta']}"
        for i, q in enumerate(lote)
    )
    chave = hashlib.sha1(
        f"ver|{versao_prompt(PROMPT_VERIFICACAO)}|{modelo}|{corpo}".encode("utf-8")
    ).hexdigest()

    if not forcar and (cacheado := ler_cache(chave)) is not None:
        USO.registrar_cache()
        vereditos = cacheado["veredito"]
    else:
        bruto = chamar_llm(
            cliente,
            modelo,
            [
                {"role": "system", "content": PROMPT_VERIFICACAO},
                {"role": "user", "content": corpo},
            ],
            schema=SCHEMA_VERIFICACAO,
        )
        try:
            vereditos = json.loads(bruto).get("veredito", [])
        except json.JSONDecodeError:
            return [True] * len(lote)  # na duvida, mantem
        gravar_cache(chave, {"veredito": vereditos})

    aprovado = [True] * len(lote)
    for v in vereditos:
        i = v.get("indice", -1)
        if 0 <= i < len(lote) and not v.get("consistente", True):
            aprovado[i] = False
            log(f"    x descartada: {lote[i]['afirmacao'][:70]}... — {v.get('motivo','')}")
    return aprovado


def executar_verificacao(
    cliente,
    modelo: str,
    questoes: list[dict[str, Any]],
    workers: int,
    forcar: bool,
    protegidas: set[str] | None = None,
) -> list[dict[str, Any]]:
    """Revisa o que tem maior risco de erro.

    Duas populacoes: questoes numericas (onde a aritmetica pode falhar) e
    questoes dos passes complementares (que nao vem de um trecho de PDF e,
    portanto, nao tem uma fonte a que se ancorar).

    `protegidas` sao os ids marcados com acao "manter" em correcoes.json: um
    humano ja conferiu aquele fato contra a pagina, e o veredito do modelo nao
    pode derrubar essa conferencia. O caso que criou o campo foi o codigo QRA,
    que a Cartilha define como "Indicativo" (secao 6.3, p.36) e o verificador
    descartou aplicando a convencao da UIT, onde QRA e' o nome da estacao. A
    prova cobra a Cartilha; o verificador apagou justamente o que ela ensina.

    Elas continuam *dentro* do lote enviado ao modelo, e so' o descarte e'
    ignorado. Tira-las de `alvos` mudaria a composicao dos lotes, cuja chave de
    cache e' o conteudo — todo lote seguinte erraria o cache, voltaria ao modelo
    e traria vereditos novos para questoes que ninguem mexeu. Foi assim que a
    questao do QRA caiu: as sete repostas da Tabela I entraram no fim da fila e
    reavaliaram o ultimo lote.
    """
    protegidas = protegidas or set()
    tem_numero = re.compile(r"\d")
    alvos = [
        i
        for i, q in enumerate(questoes)
        if (q["tema"] == TEMAS[2] and tem_numero.search(q["afirmacao"]))
        or q.get("origem") == "ementa"
    ]
    if not alvos:
        return questoes

    log(f"\n=== Verificação: {len(alvos)} questões de maior risco ===")
    lotes = [alvos[i : i + 10] for i in range(0, len(alvos), 10)]
    descartar: set[int] = set()

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futuros = {
            pool.submit(
                verificar_lote, cliente, modelo, [questoes[i] for i in lote], forcar
            ): lote
            for lote in lotes
        }
        for fut in as_completed(futuros):
            lote = futuros[fut]
            try:
                aprovados = fut.result()
            except Exception as e:
                log(f"    ! Falha ao verificar lote: {e}")
                continue
            for idx_local, ok in enumerate(aprovados):
                if not ok:
                    descartar.add(lote[idx_local])

    # O veredito contra uma questao protegida nao some em silencio: se ele
    # voltar a aparecer, e' porque o modelo continua discordando da fonte, e
    # isso e' informacao — ou a fonte mudou, ou a protecao virou permanente.
    salvas = {i for i in descartar if questoes[i]["id"] in protegidas}
    for i in sorted(salvas):
        log(f"    = mantida apesar do veredito (correcoes.json): "
            f"{questoes[i]['afirmacao'][:70]}...")
    descartar -= salvas

    log(f"  {len(descartar)} questões descartadas por inconsistência")
    return [q for i, q in enumerate(questoes) if i not in descartar]


# ---------------------------------------------------------------------------
# Etapa 6: consolidacao
# ---------------------------------------------------------------------------


ARQ_MANUAIS = RAIZ / "scripts" / "questoes_manuais.json"


def carregar_questoes_manuais() -> list[dict[str, Any]]:
    """Questoes escritas a mao, nao geradas pelo LLM.

    Existem para garantias de cobertura que sorteio nenhum da': cada letra do
    alfabeto fonetico e cada codigo Q usual precisam de ao menos uma questao
    (testes/cobertura.test.ts trava isso). Sao ancoradas nas tabelas das
    pp. 34-36 da Cartilha e entram no mesmo funil das demais: deduplicacao,
    id deterministico, correcoes da auditoria.
    """
    if not ARQ_MANUAIS.exists():
        return []
    entradas = json.loads(ARQ_MANUAIS.read_text(encoding="utf-8"))
    for q in entradas:
        q.setdefault("arquivo_origem", ARQUIVO_COMPLEMENTAR)
        # Nao vem de um trecho: a pagina indica onde estudar (origem "ementa").
        q["_complementar"] = True
        q.setdefault("_nivel", "B")
        # Toda manual declara seu topico no proprio JSON — sao "ementa" como
        # as complementares, e sem isto seriam as unicas sem assunto no app.
        if q.get("topico"):
            q["_topico"] = q.pop("topico")
    return entradas


ARQ_CORRECOES = RAIZ / "scripts" / "correcoes.json"


def ids_protegidos() -> set[str]:
    """Ids que o passe --verificar nao pode descartar.

    Lidos do mesmo arquivo das correcoes porque sao a mesma coisa: o resultado
    de alguem ter aberto a pagina e conferido. A diferenca e' que aqui o
    conserto e' contra um juizo automatico, e nao contra o gerador.
    """
    if not ARQ_CORRECOES.exists():
        return set()
    correcoes = json.loads(ARQ_CORRECOES.read_text(encoding="utf-8"))
    return {i for i, c in correcoes.items() if c.get("acao") == "manter"}


def aplicar_correcoes(questoes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Aplica scripts/correcoes.json — o resultado da auditoria humana/LLM.

    O cache devolve as questoes exatamente como foram geradas; sem este passo,
    cada regeneracao desfaria os consertos feitos no banco publicado. O arquivo
    mapeia o id deterministico da questao para uma acao:

        {"<id>": {"acao": "remover", "motivo": "..."},
         "<id>": {"acao": "editar", "campos": {"pagina": 51}, "motivo": "..."},
         "<id>": {"acao": "manter", "motivo": "..."}}

    So os campos declarados em "campos" mudam. A afirmacao nunca e editada por
    aqui: o id deriva dela, e muda-la orfanaria o proprio conserto.

    "manter" nao muda a questao: ela blinda o fato contra o passe --verificar,
    que e' um juizo de modelo e ja' apagou questao certa por discordar da fonte
    de estudo. So' cabe quando alguem conferiu o fato contra a pagina e escreveu
    onde — o "motivo" e' a prova, nao a opiniao.
    """
    if not ARQ_CORRECOES.exists():
        return questoes

    correcoes = json.loads(ARQ_CORRECOES.read_text(encoding="utf-8"))
    finais: list[dict[str, Any]] = []
    removidas = editadas = mantidas = 0

    for q in questoes:
        c = correcoes.get(q["id"])
        if c is None:
            finais.append(q)
        elif c["acao"] == "remover":
            removidas += 1
        elif c["acao"] == "editar":
            campos = dict(c["campos"])
            if "afirmacao" in campos:
                raise ValueError(
                    f"correcao de {q['id']} tenta editar a afirmacao; o id "
                    f"deriva dela e o conserto se perderia"
                )
            q.update(campos)
            editadas += 1
            finais.append(q)
        elif c["acao"] == "manter":
            mantidas += 1
            finais.append(q)
        else:
            # Ate' aqui uma acao desconhecida caia' fora de todos os ramos e a
            # questao sumia do banco sem uma linha de log. Um erro de digitacao
            # em "remover" apagava questao certa em silencio, que e' o modo de
            # falha mais caro que este arquivo tem.
            raise ValueError(
                f"correcao de {q['id']} usa acao desconhecida {c['acao']!r}; "
                f"as validas sao remover, editar e manter"
            )

    orfas = set(correcoes) - {q["id"] for q in questoes}
    if removidas or editadas or mantidas:
        log(f"  Correções da auditoria: {editadas} editadas, {removidas} removidas, "
            f"{mantidas} protegidas do verificador")
    if orfas:
        log(f"  AVISO: {len(orfas)} correções apontam para ids inexistentes "
            f"(afirmações mudaram?): {sorted(orfas)[:4]}...")
    return finais


def consolidar(questoes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Valida, deduplica e atribui um id a cada questao."""
    vistos: set[str] = set()
    finais: list[dict[str, Any]] = []
    descartadas_invalidas = 0
    descartadas_duplicadas = 0
    descartadas_meta = 0

    for q in questoes:
        afirmacao = (q.get("afirmacao") or "").strip()
        explicacao = (q.get("explicacao_curta") or "").strip()
        tema = q.get("tema")

        if not afirmacao or not explicacao or tema not in TEMAS:
            descartadas_invalidas += 1
            continue
        if not isinstance(q.get("resposta_correta"), bool):
            descartadas_invalidas += 1
            continue

        if questao_meta(q):
            descartadas_meta += 1
            continue

        chave = normalizar(afirmacao)
        if chave in vistos:
            descartadas_duplicadas += 1
            continue
        vistos.add(chave)

        finais.append(
            {
                # Id deterministico, derivado da propria afirmacao: regerar o
                # banco preserva os ids, e o historico de acertos guardado no
                # navegador continua apontando para as mesmas questoes. Com
                # uuid4 toda reexecucao zeraria esse histórico.
                "id": hashlib.sha1(chave.encode("utf-8")).hexdigest()[:16],
                "tema": tema,
                "arquivo_origem": q.get("arquivo_origem", ""),
                "afirmacao": afirmacao,
                "resposta_correta": q["resposta_correta"],
                "explicacao_curta": explicacao,
                "pagina": q.get("pagina", 1),
                # "documento": a afirmacao saiu de um trecho do PDF, e a pagina
                # e a fonte literal. "ementa": foi gerada a partir da ementa
                # oficial num passe complementar, e a pagina e apenas o
                # capitulo que trata do assunto — material de estudo, nao a
                # origem da frase. A interface precisa dizer isso ao usuario.
                "origem": "ementa" if q.get("_complementar") else "documento",
                # Menor classe cujo programa ja cobre este conteudo, entre as
                # que o banco distingue. "B" abrange tambem a Classe C, cuja
                # ementa e' um subconjunto da de B. "A" e' o acrescimo exclusivo
                # da Classe A: essas questoes nao podem cair num simulado de B.
                "nivel": q.get("_nivel", "B"),
                # Presente so' quando a questao veio de um trecho de PDF.
                # Questoes da ementa nascem de um topico, e nao de um texto:
                # inventar um trecho para elas seria mentir sobre a origem.
                **({"trecho_id": q["_trecho"]} if q.get("_trecho") else {}),
                # O topico da ementa que dirigiu a geracao — o "assunto" da
                # questao no app. So' as de origem "ementa" tem; as de
                # documento derivam o assunto de arquivo+pagina (lib/secoes.ts).
                **({"topico": q["_topico"]} if q.get("_topico") else {}),
                # Peso proprio no sorteio. Omitido quando e' 1, que e' o padrao
                # de `lib/tipos.ts`: gravar 1 em quase mil questoes so' engorda
                # o JSON que o app carrega inteiro no bundle.
                **(
                    {"peso": q["_peso"]}
                    if q.get("_peso") is not None and q["_peso"] != 1
                    else {}
                ),
            }
        )

    if descartadas_invalidas:
        log(f"  {descartadas_invalidas} questões descartadas por formato inválido")
    if descartadas_meta:
        log(f"  {descartadas_meta} questões sobre a ementa (e não sobre a matéria) "
            f"descartadas")
    if descartadas_duplicadas:
        log(f"  {descartadas_duplicadas} questões duplicadas removidas")
    return aplicar_correcoes(finais)


def relatorio(questoes: list[dict[str, Any]]) -> None:
    log("\n" + "=" * 68)
    log(f"BANCO FINAL: {len(questoes)} questões")
    log("=" * 68)

    for tema in TEMAS:
        do_tema = [q for q in questoes if q["tema"] == tema]
        if not do_tema:
            log(f"  {tema:<45} 0  <-- ATENÇÃO: tema sem questões")
            continue
        verdadeiras = sum(1 for q in do_tema if q["resposta_correta"])
        pct = 100 * verdadeiras / len(do_tema)
        alerta = "  <-- desequilibrado" if not 35 <= pct <= 65 else ""
        log(f"  {tema:<45} {len(do_tema):>4}   V/F: {pct:.0f}%/{100-pct:.0f}%{alerta}")

    da_ementa = sum(1 for q in questoes if q.get("origem") == "ementa")
    log(
        f"\n  Procedência: {len(questoes) - da_ementa} extraídas dos documentos, "
        f"{da_ementa} geradas a partir da ementa"
    )

    de_a = sum(1 for q in questoes if q.get("nivel") == "A")
    log(
        f"  Nível: {len(questoes) - de_a} do programa até a Classe B "
        f"(vale para B e C), {de_a} exclusivas da Classe A"
    )

    log("\n  Por arquivo de origem:")
    por_arquivo: dict[str, int] = {}
    for q in questoes:
        por_arquivo[q["arquivo_origem"]] = por_arquivo.get(q["arquivo_origem"], 0) + 1
    for arq, n in sorted(por_arquivo.items(), key=lambda x: -x[1]):
        log(f"    {n:>4}  {arq[:60]}")

    minimo = min((len([q for q in questoes if q["tema"] == t]) for t in TEMAS), default=0)
    log(f"\n  Simulados completos possíveis por matéria (20 questões): {minimo // 20}")

    log(
        f"\n  Tokens: {USO.entrada:,} entrada / {USO.saida:,} saída"
        f"  |  {USO.chamadas} chamadas, {USO.cache_hits} do cache"
    )


# ---------------------------------------------------------------------------
# Orquestracao
# ---------------------------------------------------------------------------


def listar_pdfs(diretorio: Path, filtro: str | None) -> list[Path]:
    pdfs = sorted(p for p in diretorio.glob("*.pdf") if p.is_file())
    if filtro:
        alvo = normalizar(filtro)
        pdfs = [p for p in pdfs if alvo in normalizar(p.name)]
    return pdfs


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Gera o banco de questões V/F para a prova de radioamador Classe B.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--diretorio", type=Path, default=None,
                        help="Diretório com os PDFs (padrão: DIRETORIO_PDFS do .env)")
    parser.add_argument("--arquivo", type=str, default=None,
                        help="Processa apenas os PDFs cujo nome contenha este texto")
    parser.add_argument("--limite-chunks", type=int, default=None,
                        help="Processa no máximo N chunks (teste barato)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Extrai e mostra os chunks sem chamar a API")
    parser.add_argument("--so-reforco", action="store_true",
                        help="Roda só os passes dirigidos por página "
                             "(PAGINAS_REFORCO). Exige --saida próprio")
    parser.add_argument("--sem-complementos", action="store_true",
                        help="Pula os passes complementares (eletrônica e técnica)")
    parser.add_argument("--verificar", action="store_true",
                        help="Revisa as questões numéricas e as dos passes "
                             "complementares")
    parser.add_argument("--forcar", action="store_true",
                        help="Ignora o cache e refaz todas as chamadas")
    parser.add_argument("--workers", type=int, default=WORKERS_PADRAO,
                        help=f"Chamadas simultâneas (padrão: {WORKERS_PADRAO})")
    parser.add_argument("--saida", type=Path, default=SAIDA_PADRAO,
                        help=f"Arquivo de saída (padrão: {SAIDA_PADRAO})")
    parser.add_argument("--listar-modelos", action="store_true",
                        help="Lista os modelos disponíveis na sua conta e sai")
    args = parser.parse_args()

    load_dotenv(RAIZ / ".env")
    modelo = os.getenv("OPENAI_MODEL", "gpt-4o").strip()
    diretorio = args.diretorio or Path(
        os.getenv("DIRETORIO_PDFS", DIR_PDFS_PADRAO)
    )

    if args.listar_modelos:
        cliente = criar_cliente()
        nomes = sorted(m.id for m in cliente.models.list())
        log("Modelos disponíveis na sua conta:")
        for n in nomes:
            log(f"  {n}")
        return 0

    if not diretorio.is_dir():
        log(f"ERRO: diretório não encontrado: {diretorio}")
        return 1

    # A gravacao e' sempre do zero: o arquivo de saida recebe SO' o que esta
    # execucao gerou. Numa execucao completa isso e' o banco; com --so-reforco
    # sao algumas dezenas de questoes, e apontar para o destino padrao trocaria
    # 914 questoes por 53 — junto com as 178 correcoes manuais presas aos ids.
    if args.so_reforco and args.saida == SAIDA_PADRAO:
        log("ERRO: --so-reforco grava só as questões dos passes dirigidos, e "
            "sobrescreveria o banco inteiro.\n"
            "       Passe um destino próprio, por exemplo:\n"
            "       --saida /tmp/reforco.json")
        return 1

    if not shutil.which("pdftoppm"):
        log("AVISO: pdftoppm não encontrado; PDFs digitalizados serão pulados.")

    pdfs = listar_pdfs(diretorio, args.arquivo)
    if not pdfs:
        log(f"ERRO: nenhum PDF encontrado em {diretorio}"
            + (f" com o filtro '{args.arquivo}'" if args.arquivo else ""))
        return 1

    cliente = None if args.dry_run else criar_cliente()

    log(f"Diretório : {diretorio}")
    log(f"Modelo    : {modelo}")
    log(f"PDFs      : {len(pdfs)}")
    log("")

    # --- Extracao e chunking -------------------------------------------------
    chunks: list[Chunk] = []
    # Guardados para o passe de tabela, que precisa do texto literal de paginas
    # especificas — e nao dos chunks, que ja misturaram a tabela com a prosa ao
    # redor.
    blocos_por_arquivo: dict[str, list[Bloco]] = {}
    for pdf in pdfs:
        log(f"[{pdf.name}]")
        try:
            blocos = obter_blocos(cliente, modelo, pdf, args.forcar, args.dry_run)
        except Exception as e:
            log(f"  ! Falha ao ler: {e}")
            continue
        blocos_por_arquivo[pdf.name] = blocos
        # Lido e guardado, mas sem cota por chunk: os passes dirigidos pegam as
        # paginas que interessam. Ver SO_REFORCO.
        if pdf.name in SO_REFORCO:
            log("  só pelos passes dirigidos; fora do chunking geral")
            continue
        do_pdf = montar_chunks(pdf.name, blocos)
        chunks.extend(do_pdf)
        log(f"  {len(do_pdf)} chunks")

    if args.limite_chunks:
        chunks = chunks[: args.limite_chunks]
        log(f"\n--limite-chunks: usando apenas {len(chunks)} chunks")

    log(f"\nTotal: {len(chunks)} chunks, "
        f"{sum(len(c.texto) for c in chunks):,} caracteres")

    if args.dry_run:
        log("\n=== DRY RUN: amostra dos chunks ===")
        for c in chunks[:3]:
            log(f"\n--- {c.arquivo_origem} p.{c.pagina} ({len(c.texto)} chars)")
            log(c.texto[:400].replace("\n", " ") + "...")
        log("\nNenhuma chamada de API foi feita.")
        return 0

    if not chunks:
        log("ERRO: nenhum chunk aproveitável foi extraído.")
        return 1

    # --- Geracao -------------------------------------------------------------
    questoes: list[dict[str, Any]] = []
    concluidos = 0

    if args.so_reforco:
        log("\n--so-reforco: passe geral, complementares, tabelas e questões "
            "manuais ficam de fora.")
    else:
        log(f"\n=== Gerando questões ({args.workers} chamadas simultâneas) ===")

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futuros = {
            pool.submit(gerar_do_chunk, cliente, modelo, c, args.forcar): c
            for c in ([] if args.so_reforco else chunks)
        }
        for fut in as_completed(futuros):
            chunk = futuros[fut]
            concluidos += 1
            try:
                novas = fut.result()
            except Exception as e:
                log(f"  [{concluidos}/{len(chunks)}] ! {chunk.arquivo_origem[:30]} "
                    f"p.{chunk.pagina}: {e}")
                continue
            questoes.extend(novas)
            log(f"  [{concluidos}/{len(chunks)}] {chunk.arquivo_origem[:34]:<34} "
                f"p.{chunk.pagina:<3} -> {len(novas)} questões")

    # --- Passes complementares guiados pela ementa ---------------------------
    passes = [
        ("elet", "eletrônica", PROMPT_SISTEMA_ELETRONICA, TEMAS[2], TOPICOS_ELETRONICA,
         "Verifique cada conta antes de definir `resposta_correta`.", "B"),
        ("tec", "técnica e ética", PROMPT_SISTEMA_TECNICA, TEMAS[0], TOPICOS_TECNICA,
         "Baseie-se em conhecimento consolidado; não invente valores regulatórios "
         "brasileiros.", "B"),
        # Acrescimo da Classe A. So' Eletronica: a ementa de Legislacao e de
        # Tecnica e Etica e' a mesma para as tres classes no item 11.4, e gerar
        # questoes "mais dificeis" nelas seria inventar uma exigencia que a
        # norma nao faz.
        ("clsa", "Classe A", PROMPT_SISTEMA_CLASSE_A, TEMAS[2], TOPICOS_CLASSE_A,
         "Verifique cada conta antes de definir `resposta_correta`. Exija "
         "análise, não reconhecimento.", "A"),
    ]
    if not args.sem_complementos and not args.limite_chunks and not args.so_reforco:
        for prefixo, rotulo, prompt_sis, tema, topicos, instrucao, classe in passes:
            total = sum(n for _, n, _ in topicos)
            log(f"\n=== Passe de {rotulo}: {len(topicos)} tópicos, "
                f"~{total} questões ===")
            with ThreadPoolExecutor(max_workers=args.workers) as pool:
                futuros = {
                    pool.submit(
                        gerar_complementar, cliente, modelo, prefixo, prompt_sis,
                        instrucao, tema, t, n, pag, classe, args.forcar
                    ): t
                    for t, n, pag in topicos
                }
                for fut in as_completed(futuros):
                    topico = futuros[fut]
                    try:
                        novas = fut.result()
                    except Exception as e:
                        log(f"  ! {topico[:50]}: {e}")
                        continue
                    questoes.extend(novas)
                    log(f"  {topico[:52]:<52} -> {len(novas)} questões")

    # --- Passe de reforco: paginas cobertas de raspao ------------------------
    # O unico que --so-reforco liga em vez de desligar: e' ele que a flag serve
    # para provar sozinho.
    if not args.limite_chunks and (args.so_reforco or not args.sem_complementos):
        if PAGINAS_REFORCO:
            log(f"\n=== Passe de reforço: {len(PAGINAS_REFORCO)} páginas ===")
        for arquivo, paginas, assunto, quantidade in PAGINAS_REFORCO:
            blocos = blocos_por_arquivo.get(arquivo)
            if not blocos:
                log(f"  ! {arquivo} não foi lido nesta execução; reforço pulado.")
                continue
            chunk = chunk_de_paginas(arquivo, paginas, blocos)
            if chunk is None:
                log(f"  ! p.{paginas} de {arquivo[:30]} sem texto aproveitável.")
                continue
            chunks.append(chunk)
            try:
                novas = gerar_do_chunk(
                    cliente, modelo, chunk, args.forcar, quantidade, foco=assunto
                )
            except Exception as e:
                log(f"  ! p.{paginas}: {e}")
                continue
            questoes.extend(novas)
            log(f"  p.{str(paginas):<8} {assunto[:44]:<44} -> {len(novas)} questões")

    # --- Passe de tabela: cobertura linha a linha ----------------------------
    if not args.sem_complementos and not args.limite_chunks and not args.so_reforco:
        catalogo = carregar_tabelas_referencia()
        for id_tabela, tema, por_lote, peso_tabela in TABELAS_COBERTURA:
            tabela = catalogo.get(id_tabela)
            if tabela is None:
                if catalogo:
                    log(f"\n! Tabela '{id_tabela}' não está em {ARQ_TABELAS.name}; "
                        f"passe pulado.")
                continue

            blocos = blocos_por_arquivo.get(tabela["arquivo"])
            if not blocos:
                log(f"\n! {tabela['arquivo']} não foi lido nesta execução; "
                    f"passe da tabela '{id_tabela}' pulado.")
                continue
            chunk = chunk_de_paginas(tabela["arquivo"], tabela["paginas"], blocos)
            if chunk is None:
                log(f"\n! Páginas {tabela['paginas']} de {tabela['arquivo']} sem "
                    f"texto aproveitável; passe da tabela '{id_tabela}' pulado.")
                continue

            # `public/trechos.json` e' montado no fim a partir de `chunks`. Sem
            # registrar o chunk da tabela aqui, as questoes deste passe
            # apontariam para um trecho que nao existe no arquivo.
            chunks.append(chunk)

            # Texto pagina a pagina, para cada questao apontar para a pagina em
            # que a sua linha esta — as duas tabelas atravessam duas paginas.
            paginas_texto = {
                b.pagina: b.texto for b in blocos if b.pagina in tabela["paginas"]
            }

            linhas = tabela["linhas"]
            lotes = [linhas[i : i + por_lote] for i in range(0, len(linhas), por_lote)]
            log(f"\n=== Passe da tabela '{id_tabela}': {len(linhas)} linhas em "
                f"{len(lotes)} lotes ===")
            with ThreadPoolExecutor(max_workers=args.workers) as pool:
                futuros = {
                    pool.submit(
                        gerar_da_tabela, cliente, modelo, tabela, lote, tema,
                        chunk, paginas_texto, peso_tabela, args.forcar
                    ): lote
                    for lote in lotes
                }
                for fut in as_completed(futuros):
                    lote = futuros[fut]
                    try:
                        novas = fut.result()
                    except Exception as e:
                        log(f"  ! lote iniciado em {lote[0][0][:40]}: {e}")
                        continue
                    questoes.extend(novas)
                    log(f"  {lote[0][0][:32]:<32} +{len(lote) - 1:<2} linhas "
                        f"-> {len(novas)} questões")

    # --- Questoes autorais de cobertura --------------------------------------
    if not args.sem_complementos and not args.limite_chunks and not args.so_reforco:
        manuais = carregar_questoes_manuais()
        if manuais:
            questoes.extend(manuais)
            log(f"\n=== {len(manuais)} questões autorais "
                f"(scripts/questoes_manuais.json) ===")

    log(f"\n=== Consolidando {len(questoes)} questões brutas ===")
    finais = consolidar(questoes)

    if args.verificar:
        finais = executar_verificacao(
            cliente, modelo, finais, args.workers, args.forcar, ids_protegidos()
        )

    if not finais:
        log("ERRO: nenhuma questão válida foi gerada.")
        return 1

    args.saida.parent.mkdir(parents=True, exist_ok=True)
    # Ordem estavel na gravacao. Os chunks sao processados em paralelo e o
    # `as_completed` os devolve na ordem em que terminam, entao cada regeracao
    # embaralhava o arquivo inteiro: 6.363 linhas de diff para 33 questoes
    # alteradas, e o `git diff` deixava de dizer o que mudou. Agrupar por
    # documento e pagina mantem junto o que se le junto; o id desempata.
    finais.sort(key=lambda q: (q["arquivo_origem"], q["pagina"], q["id"]))
    args.saida.write_text(
        json.dumps(finais, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # --- Trechos de origem ---------------------------------------------------
    # Arquivo separado, e nao um campo dentro de cada questao: um mesmo trecho
    # gera varias questoes, e embutir o texto multiplicaria o banco por ~8. O
    # app carrega este arquivo sob demanda, so' quando alguem pede para ver o
    # trecho — o custo de abrir o simulado nao muda.
    usados = {q["trecho_id"] for q in finais if q.get("trecho_id")}
    trechos = {
        c.id_trecho: {
            "arquivo": c.arquivo_origem,
            "pagina": c.pagina,
            "fim": max(c.pagina_fim, c.pagina),
            "texto": c.texto,
        }
        for c in chunks
        if c.id_trecho in usados
    }
    saida_trechos = args.saida.parent / "trechos.json"
    saida_trechos.write_text(
        json.dumps(trechos, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    relatorio(finais)
    log(f"\nSalvo em: {args.saida}")
    log(f"Trechos de origem: {len(trechos)} em {saida_trechos} "
        f"({saida_trechos.stat().st_size / 1024:.0f} KB)")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        log("\nInterrompido. O cache foi preservado; rode de novo para continuar.")
        sys.exit(130)
