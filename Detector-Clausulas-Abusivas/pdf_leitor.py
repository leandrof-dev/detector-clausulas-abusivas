# Lê o texto de um PDF direto da memória (sem janela e sem salvar arquivo no computador).

import pymupdf    # abre o PDF e extrai o texto (requirements.txt: "pymupdf"). Ex.: pymupdf.open(stream=bytes)


def ler_pdf(conteudo_pdf):
    """Recebe o PDF em bytes e devolve {"texto": ..., "paginas": ...}.

    Se o arquivo estiver corrompido ou protegido por senha, gera ValueError com a explicação.
    """
    try:
        with pymupdf.open(stream=conteudo_pdf, filetype="pdf") as documento:
            protegido = documento.needs_pass
            paginas = documento.page_count
            texto = "" if protegido else "".join(pagina.get_text() for pagina in documento)
    except Exception as erro:
        raise ValueError(f"Não foi possível ler o PDF: {erro}") from erro

    if protegido:
        raise ValueError("O PDF está protegido por senha. Envie uma versão sem senha.")

    leitura = {"texto": texto.strip(), "paginas": paginas}
    return leitura
