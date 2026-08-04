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

# Ementa oficial da Classe B, transcrita do Ato nº 3448/2026 (item 11.4).
# Serve de guia de cobertura para o gerador: o LLM deve puxar as questoes para
# esses topicos, que sao os efetivamente cobrados.
EMENTA_CLASSE_B = """\
TÉCNICA E ÉTICA OPERACIONAL
- ESTAÇÃO DE RADIOAMADOR: Diagrama de blocos de receptores, transmissores, transceptores e repetidoras.
- ANTENAS: Noções básicas de antenas direcionais, tipos e características, uso de antena artificial, relação sinal/ruído, onda estacionária.
- FREQUÊNCIA, COMPRIMENTO DE ONDA: Noções básicas de frequência de áudio, faixas de frequências de transmissão e seus comprimentos de onda, batimento de frequências.
- PROPAGAÇÃO: Noções básicas de ondas terrestres, espaciais, camadas atmosféricas, propagação nas faixas de VLF, LF, MF, HF, VHF, UHF e SHF.
- INTERFERÊNCIAS: Procedimentos de como detectar e evitar interferências.
- COMUNICADOS: Como estabelecer um comunicado nas diversas modalidades, Alfabeto Fonético da UIT, noções do Código Q.
- ÉTICA: Comportamento ético do radioamador, procedimentos indispensáveis.
- EMERGÊNCIAS: Procedimentos operacionais em situações de emergência.

LEGISLAÇÃO DE TELECOMUNICAÇÕES
- Regulamento de Rádio (RR) da União Internacional de Telecomunicações (UIT).
- Recomendação ITU-R M.1544-1 (09/2015) de qualificações mínimas para o radioamador.
- Plano de Faixas para a Região 2, da União Internacional de Radioamadores (IARU).
- Lei Geral das Telecomunicações.
- Regulamento Geral dos Serviços de Telecomunicações (RGST).
- Requisitos Técnicos e Operacionais para uso de radiofrequências associadas ao Serviço de Radioamador.
- Plano de Atribuição, Destinação e Distribuição de Faixas de Frequências no Brasil.
- Regulamento de Avaliação da Conformidade e de Homologação de Produtos para Telecomunicações.

CONHECIMENTOS DE ELETRÔNICA E ELETRICIDADE (CLASSE B)
- Todo o conteúdo da Classe C: Lei de Ohm, componentes eletrônicos, resistência, tensão, corrente e potência; espectro eletromagnético; fusíveis, disjuntores e aterramento; multímetro, wattímetro e medidor de ondas estacionárias; função de receptores, transmissores, transceptores, repetidoras, antenas e linhas de transmissão; modulação, demodulação e propagação.
- CIRCUITOS ELÉTRICOS: Lei de Ohm, cálculo da resistência, tensão, corrente e potência, conhecimentos básicos das Leis de Joule e Kirchhoff.
- IDENTIFICAÇÃO DE RESISTORES: Determinação do valor da resistência mediante o código de cores.
- ASSOCIAÇÃO DE RESISTORES: Cálculo da resistência em circuitos série e paralelo.
- ELETROMAGNETISMO: Cargas elétricas, campos elétricos, campos magnéticos e seus conceitos.
- TEORIA DE CIRCUITOS (CA): Impedância, reatância, capacitância e indutância.
- ONDULATÓRIA: Análise de sinais senoidais quanto a frequência, amplitude e período.
- PROPRIEDADE DOS MATERIAIS: Condutores, semicondutores e isolantes.
- TEORIA DE ANTENAS: Funcionamento básico e aplicação dos diversos tipos de antenas.
- PROPAGAÇÃO DE ONDAS: Polarização, interferência e ressonância.
- COMUNICAÇÕES DIGITAIS: Conceitos sobre modulações ASK, FSK e PSK."""


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
{EMENTA_CLASSE_B}"""


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
{EMENTA_CLASSE_B.split("CONHECIMENTOS DE ELETRÔNICA E ELETRICIDADE (CLASSE B)")[1].strip()}"""


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
{EMENTA_CLASSE_B.split("TÉCNICA E ÉTICA OPERACIONAL")[1].split("LEGISLAÇÃO DE TELECOMUNICAÇÕES")[0].strip()}"""


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
# (topico, quantidade, pagina)
TOPICOS_ELETRONICA = [
    ("Lei de Ohm: cálculo de tensão, corrente e resistência", 10, 54),
    ("Potência elétrica e Lei de Joule: cálculo de potência e dissipação", 8, 54),
    ("Código de cores de resistores: leitura do valor e da tolerância", 8, 55),
    ("Associação de resistores em série e em paralelo: resistência equivalente", 8, 55),
    ("Leis de Kirchhoff das correntes e das tensões", 6, 54),
    ("Múltiplos e submúltiplos de unidades elétricas e conversões", 6, 54),
    ("Capacitância, indutância, reatância e impedância em circuitos CA", 8, 58),
    ("Ondulatória: frequência, período, amplitude e comprimento de onda", 8, 57),
    ("Espectro eletromagnético e as faixas VLF, LF, MF, HF, VHF, UHF e SHF", 6, 57),
    ("Condutores, semicondutores e isolantes; diodos e transistores", 6, 55),
    ("Instrumentos de medição: multímetro, wattímetro e medidor de ROE (SWR)", 6, 60),
    ("Teoria de antenas: dipolo, ganho, polarização, ROE e casamento de impedância", 8, 61),
    ("Modulações digitais ASK, FSK e PSK; modulação e demodulação", 6, 63),
    ("Proteção elétrica: fusíveis, disjuntores e aterramento", 5, 59),
]

# Tecnica e Etica e o tema mais escasso nos PDFs, que sao majoritariamente
# normativos. Sem este passe sobram poucas questoes e o simulado desse tema
# passa a ser memorizado por reconhecimento.
TOPICOS_TECNICA = [
    ("Estação de radioamador: diagrama de blocos de receptores, transmissores, "
     "transceptores e repetidoras", 10, 26),
    ("Repetidoras: operação em shift/split, simplex e duplex, uso de tom "
     "subaudível e etiqueta de uso", 8, 26),
    ("Linhas de transmissão, onda estacionária (ROE/SWR) e casamento de "
     "impedância", 8, 27),
    ("Antenas: tipos e características, antenas direcionais, ganho e "
     "diretividade, polarização", 10, 28),
    ("Antena artificial (carga fictícia) e relação sinal/ruído", 6, 28),
    ("Frequência e comprimento de onda: relação entre eles, faixas de "
     "transmissão e batimento de frequências", 8, 29),
    ("Propagação: ondas terrestres e espaciais, camadas da ionosfera, "
     "comportamento em VLF, LF, MF, HF, VHF, UHF e SHF", 10, 31),
    ("Interferências: tipos, como detectar, como evitar e como proceder ao "
     "causá-las ou recebê-las", 8, 33),
    ("Comunicados: como estabelecer contato, chamada geral (CQ), relatório de "
     "sinal (RST) e modalidades de operação", 8, 34),
    ("Alfabeto Fonético da UIT: soletração correta de letras", 8, 34),
    ("Código Q: significado dos códigos usuais no radioamadorismo", 10, 35),
    ("Ética do radioamador: conduta no ar, uso racional de potência, "
     "identificação e procedimentos indispensáveis", 8, 37),
    ("Emergências: procedimentos operacionais, prioridade de tráfego e conduta "
     "em situações de socorro", 8, 38),
]


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


def extrair_texto_ocr(
    cliente, modelo: str, caminho: Path, forcar: bool
) -> list[Bloco]:
    """Le um PDF digitalizado transcrevendo cada pagina com o modelo de visao."""
    total = contar_paginas(caminho)
    log(f"  PDF digitalizado (sem camada de texto) -> OCR por visão, {total} páginas")

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
                Chunk(arquivo_origem=arquivo, pagina=atual[0].pagina, texto=texto)
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
                        Chunk(arquivo_origem=arquivo, pagina=par.pagina, texto=fatia)
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
    cliente, modelo: str, chunk: Chunk, forcar: bool
) -> list[dict[str, Any]]:
    chave = hashlib.sha1(
        f"gen|{versao_prompt(PROMPT_SISTEMA)}|{modelo}|{QUESTOES_POR_CHUNK}"
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
            f"Gere até {QUESTOES_POR_CHUNK} questões Verdadeiro/Falso a partir "
            f"deste trecho, seguindo todas as regras. Se o trecho não tiver "
            f"conteúdo cobrável, retorne uma lista vazia."
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
# Cartilha que cobre o assunto, para consulta.
ARQUIVO_COMPLEMENTAR = "2026-06-30 CARTILHA-RADIOAMADOR-v9 2026-06.pdf"


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
            f"tópico, no nível da Classe B. {instrucao}"
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
    return questoes


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
    cliente, modelo: str, questoes: list[dict[str, Any]], workers: int, forcar: bool
) -> list[dict[str, Any]]:
    """Revisa o que tem maior risco de erro.

    Duas populacoes: questoes numericas (onde a aritmetica pode falhar) e
    questoes dos passes complementares (que nao vem de um trecho de PDF e,
    portanto, nao tem uma fonte a que se ancorar).
    """
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

    log(f"  {len(descartar)} questões descartadas por inconsistência")
    return [q for i, q in enumerate(questoes) if i not in descartar]


# ---------------------------------------------------------------------------
# Etapa 6: consolidacao
# ---------------------------------------------------------------------------


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
                # Presente so' quando a questao veio de um trecho de PDF.
                # Questoes da ementa nascem de um topico, e nao de um texto:
                # inventar um trecho para elas seria mentir sobre a origem.
                **({"trecho_id": q["_trecho"]} if q.get("_trecho") else {}),
            }
        )

    if descartadas_invalidas:
        log(f"  {descartadas_invalidas} questões descartadas por formato inválido")
    if descartadas_meta:
        log(f"  {descartadas_meta} questões sobre a ementa (e não sobre a matéria) "
            f"descartadas")
    if descartadas_duplicadas:
        log(f"  {descartadas_duplicadas} questões duplicadas removidas")
    return finais


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
    for pdf in pdfs:
        log(f"[{pdf.name}]")
        try:
            blocos = obter_blocos(cliente, modelo, pdf, args.forcar, args.dry_run)
        except Exception as e:
            log(f"  ! Falha ao ler: {e}")
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
    log(f"\n=== Gerando questões ({args.workers} chamadas simultâneas) ===")
    questoes: list[dict[str, Any]] = []
    concluidos = 0

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futuros = {
            pool.submit(gerar_do_chunk, cliente, modelo, c, args.forcar): c
            for c in chunks
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
         "Verifique cada conta antes de definir `resposta_correta`."),
        ("tec", "técnica e ética", PROMPT_SISTEMA_TECNICA, TEMAS[0], TOPICOS_TECNICA,
         "Baseie-se em conhecimento consolidado; não invente valores regulatórios "
         "brasileiros."),
    ]
    if not args.sem_complementos and not args.limite_chunks:
        for prefixo, rotulo, prompt_sis, tema, topicos, instrucao in passes:
            total = sum(n for _, n, _ in topicos)
            log(f"\n=== Passe de {rotulo}: {len(topicos)} tópicos, "
                f"~{total} questões ===")
            with ThreadPoolExecutor(max_workers=args.workers) as pool:
                futuros = {
                    pool.submit(
                        gerar_complementar, cliente, modelo, prefixo, prompt_sis,
                        instrucao, tema, t, n, pag, args.forcar
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

    log(f"\n=== Consolidando {len(questoes)} questões brutas ===")
    finais = consolidar(questoes)

    if args.verificar:
        finais = executar_verificacao(cliente, modelo, finais, args.workers, args.forcar)

    if not finais:
        log("ERRO: nenhuma questão válida foi gerada.")
        return 1

    args.saida.parent.mkdir(parents=True, exist_ok=True)
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
