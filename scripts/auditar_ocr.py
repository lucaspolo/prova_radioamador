#!/usr/bin/env python3
"""Confere a transcricao dos PDFs digitalizados com um segundo leitor.

O gerador le' os PDFs sem camada de texto com um modelo de visao. Esse leitor
erra normalizando: devolve portugues fluente e plausivel que se afastou da
fonte. No Ato 3445 ele leu a primeira letra "W" do item 12.12.4 como "Y", a
questao saiu fiel ao trecho corrompido e o gabarito nasceu invertido (issue #2).
Nada nisso da' sinal: o texto continua legivel e a questao, coerente.

A saida e' pegar um segundo leitor cujo modo de falha nao seja correlacionado.
O docling com RapidOCR le' pixel e nao pode ser convencido pelo contexto de que
"Y" cai melhor ali. Medido na p.3 do Ato 3445 contra o gabarito conferido na
imagem: o modelo de visao errou 6 palavras em 229, o docling nenhuma.

Onde cada um ganha, e por que os dois continuam:

  - prosa: o docling e' melhor. Preservou ate' o "O sufixos" que o proprio Ato
    escreveu errado, que o modelo de visao "consertou".
  - tabela: o modelo de visao e' melhor. A Tabela IV de prefixos sai inteira e
    certa; o docling le' o digito 0 dos prefixos de ilha como letra O
    (PP0F -> PPOF). Esse erro e' mecanico de achar — prefixo e' duas letras
    mais digito —, ao contrario do "Y", que so' um humano pegaria.

Por isso isto e' conferencia, e nao substituicao: o gerador continua lendo por
visao e este script aponta onde os dois discordam.

Uso:
    python scripts/auditar_ocr.py
    python scripts/auditar_ocr.py --forcar     # ignora o cache do docling

Requer `docling` e `rapidocr-onnxruntime`, que nao estao no requirements.txt:
puxam torch e so' fazem falta nesta auditoria ocasional.
    pip install docling rapidocr-onnxruntime
"""

from __future__ import annotations

import argparse
import difflib
import json
import re
import sys
import unicodedata
from pathlib import Path
from typing import Any

import pdfplumber

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / "scripts"))
from processar_pdfs import (  # noqa: E402
    DIR_CACHE,
    DIR_PDFS_PADRAO,
    MIN_CHARS_POR_PAGINA,
    log,
)

ARQ_BANCO = RAIZ / "public" / "banco_questoes.json"
ARQ_TRECHOS = RAIZ / "public" / "trechos.json"
ARQ_TRIADO = RAIZ / "scripts" / "auditar_ocr_triado.json"
CACHE_DOCLING = DIR_CACHE / "docling_paginas.json"

# Um bloco divergente maior que isto e' remontagem de tabela, nao leitura: os
# dois leitores serializam a mesma grade de formas diferentes e comparar palavra
# a palavra ali so' produz ruido.
MAX_PALAVRAS_COMPARAVEIS = 3


# ---------------------------------------------------------------------------
# Leitura pelo docling
# ---------------------------------------------------------------------------


def digitalizados(diretorio: Path) -> list[Path]:
    """PDFs que o gerador le' por OCR, pelo mesmo criterio que ele usa.

    Derivado, e nao uma lista fixa de nomes: se um PDF novo entrar sem camada de
    texto, ele cai na auditoria sozinho.
    """
    fora = []
    for pdf in sorted(diretorio.glob("*.pdf")):
        with pdfplumber.open(pdf) as doc:
            paginas = max(len(doc.pages), 1)
            chars = sum(len(p.extract_text() or "") for p in doc.pages)
        if chars / paginas < MIN_CHARS_POR_PAGINA:
            fora.append(pdf)
    return fora


def ler_com_docling(caminho: Path) -> dict[str, str]:
    """Transcreve um PDF pagina a pagina.

    `force_full_page_ocr` nao e' opcional aqui: no modo padrao o docling so'
    OCRa as regioes que julga bitmap e devolve itens truncados — no Ato 3445 o
    12.12.4 saiu como "12.12.4. E estações".
    """
    try:
        from docling.datamodel.base_models import InputFormat
        from docling.datamodel.pipeline_options import (
            PdfPipelineOptions,
            RapidOcrOptions,
        )
        from docling.document_converter import DocumentConverter, PdfFormatOption
    except ImportError as e:
        raise SystemExit(
            "auditar_ocr.py precisa do docling e do rapidocr-onnxruntime:\n"
            "    pip install docling rapidocr-onnxruntime\n"
            f"({e})"
        )

    opcoes = PdfPipelineOptions()
    opcoes.do_ocr = True
    opcoes.do_table_structure = True
    opcoes.table_structure_options.do_cell_matching = True
    opcoes.ocr_options = RapidOcrOptions(force_full_page_ocr=True)
    conversor = DocumentConverter(
        format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=opcoes)}
    )

    doc = conversor.convert(str(caminho)).document
    paginas: dict[str, list[str]] = {}
    for item, _ in doc.iterate_items():
        prov = getattr(item, "prov", None) or []
        if not prov:
            continue
        if hasattr(item, "export_to_markdown"):  # tabela
            try:
                texto = item.export_to_markdown(doc)
            except TypeError:
                texto = item.export_to_markdown()
        else:
            texto = getattr(item, "text", "") or ""
        if texto.strip():
            paginas.setdefault(str(prov[0].page_no), []).append(texto.strip())
    return {pg: "\n\n".join(ls) for pg, ls in sorted(paginas.items(), key=lambda kv: int(kv[0]))}


def transcricoes(pdfs: list[Path], forcar: bool) -> dict[str, dict[str, str]]:
    cache: dict[str, dict[str, str]] = {}
    if not forcar and CACHE_DOCLING.exists():
        cache = json.loads(CACHE_DOCLING.read_text(encoding="utf-8"))

    for pdf in pdfs:
        if pdf.name in cache:
            log(f"  {pdf.name[:52]}: em cache")
            continue
        log(f"  {pdf.name[:52]}: transcrevendo (leva alguns minutos)")
        cache[pdf.name] = ler_com_docling(pdf)

    DIR_CACHE.mkdir(parents=True, exist_ok=True)
    CACHE_DOCLING.write_text(json.dumps(cache, ensure_ascii=False, indent=1), encoding="utf-8")
    return cache


# ---------------------------------------------------------------------------
# Cruzamento
# ---------------------------------------------------------------------------


def dobrar(s: str) -> str:
    """Caixa, acento e pontuacao fora — sobra o que muda o sentido."""
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^0-9A-Za-z]", "", s).lower()


def palavras(s: str) -> list[str]:
    return re.sub(r"\s+", " ", s.replace("“", '"').replace("”", '"')).strip().split()


def portador(bruto: str) -> bool:
    """Token capaz de mudar o sentido de uma afirmacao.

    Sigla, letra entre aspas, codigo de indicativo, numero. Palavra comum de
    quatro letras ou mais tambem entra; artigo e preposicao, nao — casam com
    qualquer questao e afogam o relatorio.
    """
    nu = dobrar(bruto)
    if not nu:
        return False
    if re.search(r"\d", nu):
        return True
    if bruto.strip("\"“”.,;:()").isupper():  # W, CW, PY0, SSB
        return True
    return len(nu) >= 4


def afirma(questao: dict[str, Any], token: str) -> bool:
    """O token aparece na afirmacao?

    So' a afirmacao: e' ela que o estudante responde. A explicacao fica de fora
    de proposito — uma questao consertada pode citar as duas leituras ("é W,
    não Y") e olhar para ela esconderia justamente a afirmacao construida em
    cima da leitura errada.
    """
    return dobrar(token) in ({dobrar(w) for w in palavras(questao["afirmacao"])} - {""})


def carregar_triados() -> set[tuple[str, str]]:
    """Pares ja' conferidos na imagem e julgados inofensivos.

    Sem isto a auditoria repete os mesmos achados a cada execucao e vira ruido
    de fundo — e uma auditoria que sempre grita a mesma coisa deixa de ser lida
    justamente quando grita algo novo. A triagem e' por par de tokens, e nao por
    id de questao, porque o id muda quando o trecho e' regerado e a triagem se
    perderia junto.
    """
    if not ARQ_TRIADO.exists():
        return set()
    return {
        (dobrar(t["visao"]), dobrar(t["docling"]))
        for t in json.loads(ARQ_TRIADO.read_text(encoding="utf-8"))
    }


def auditar(banco: list[dict], trechos: dict, docling: dict) -> dict[str, list[tuple[str, str]]]:
    achados: dict[str, list[tuple[str, str]]] = {}
    triados = carregar_triados()
    comparadas = blocos = silenciados = 0

    for tid, trecho in trechos.items():
        paginas_doc = docling.get(trecho["arquivo"])
        if paginas_doc is None:
            continue  # PDF com camada de texto: o pdfplumber le' a fonte, sem OCR

        visao = palavras(trecho["texto"])
        segunda = palavras(
            "\n".join(
                paginas_doc.get(str(p), "")
                for p in range(trecho["pagina"], trecho["fim"] + 1)
            )
        )
        questoes = [q for q in banco if q.get("trecho_id") == tid]
        sm = difflib.SequenceMatcher(
            None, [dobrar(w) for w in visao], [dobrar(w) for w in segunda], autojunk=False
        )

        for tag, i1, i2, j1, j2 in sm.get_opcodes():
            if tag != "replace":
                # Insercao e remocao sao remontagem (o docling quebra a pagina em
                # itens), nao leitura divergente da mesma passagem.
                continue
            a, b = visao[i1:i2], segunda[j1:j2]
            if len(a) > MAX_PALAVRAS_COMPARAVEIS or len(b) > MAX_PALAVRAS_COMPARAVEIS:
                blocos += 1
                continue
            comparadas += 1
            for tv, td in zip(a, b):
                if dobrar(tv) == dobrar(td) or not portador(tv):
                    continue
                if (dobrar(tv), dobrar(td)) in triados:
                    silenciados += 1
                    continue
                for q in questoes:
                    # A questao repete a leitura de um lado e nao a do outro: os
                    # dois leitores discordam justamente no que ela afirma.
                    if afirma(q, tv) and not afirma(q, td):
                        achados.setdefault(q["id"], []).append((tv, td))

    log(f"\n{comparadas} substituições comparadas token a token "
        f"({blocos} blocos longos ignorados como estrutura, "
        f"{silenciados} pares já triados em {ARQ_TRIADO.name})")
    return achados


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--diretorio", type=Path, default=Path(DIR_PDFS_PADRAO),
                        help="diretório com os PDFs de estudo")
    parser.add_argument("--forcar", action="store_true",
                        help="ignora o cache e transcreve tudo de novo")
    args = parser.parse_args()

    if not args.diretorio.is_dir():
        log(f"ERRO: {args.diretorio} não existe.")
        return 1

    pdfs = digitalizados(args.diretorio)
    if not pdfs:
        log("Nenhum PDF digitalizado: todos têm camada de texto, nada a conferir.")
        return 0

    log(f"{len(pdfs)} PDFs sem camada de texto (os que o gerador lê por OCR):")
    docling = transcricoes(pdfs, args.forcar)

    banco = json.loads(ARQ_BANCO.read_text(encoding="utf-8"))
    trechos = json.loads(ARQ_TRECHOS.read_text(encoding="utf-8"))
    achados = auditar(banco, trechos, docling)

    if not achados:
        log("\nNenhuma questão afirma algo que os dois leitores leem diferente.")
        return 0

    log(f"\n{len(achados)} questões a conferir na imagem da página:\n")
    for qid, pares in achados.items():
        q = next(x for x in banco if x["id"] == qid)
        log(f"  {qid}  gabarito={q['resposta_correta']}  "
            f"{q['arquivo_origem'][:38]} p.{q['pagina']}")
        log(f"     {q['afirmacao']}")
        for tv, td in dict.fromkeys(pares):
            log(f"     visão {tv!r}  x  docling {td!r}")
        log("")
    log("Conferida a página e confirmado o erro do OCR, o conserto vai em "
        "scripts/erratas_ocr.json — não em correcoes.json, que trata sintoma.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
