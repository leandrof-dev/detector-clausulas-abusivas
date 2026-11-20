# O passo a passo do detector: confere o arquivo, lê o texto, a IA lê o contrato, compara com a base e guarda no banco.
# O site (app.py) usa a função detectar(). Para testar sem abrir o site:
#     python main_detector.py contrato.pdf              (lê, analisa com a IA e compara, mas não grava nada)
#     python main_detector.py contrato.pdf --salvar     (também guarda no Supabase)

import os                                     # pega só o nome do arquivo a partir do caminho digitado no terminal
import sys                                    # lê o que foi digitado no terminal
from concurrent.futures import ThreadPoolExecutor    # roda as 3 tarefas da IA ao mesmo tempo, para não somar as esperas

from banco import BancoErro, calcular_hash, guardar_analise, guardar_clausulas, guardar_contrato, marcar_erro
from comparacao import comparar_com_a_base, resultado_indisponivel
from ia import (
    IAErro,
    anonimizar_texto,
    classificar_clausulas,
    gerar_embeddings,
    instrucoes_da_ia,
    ler_contrato,
    limite_de_caracteres,
    modelo_de_analise,
    separar_clausulas,
    tipo_por_palavras,
)
from pdf_leitor import ler_pdf


class ErroDeEnvio(Exception):
    """Problema com o envio: tem a mensagem para a pessoa e o código HTTP (400, 422, 502...)."""

    def __init__(self, mensagem, codigo):
        super().__init__(mensagem)
        self.mensagem = mensagem
        self.codigo = codigo


def validar_arquivo(nome_arquivo, conteudo_pdf):
    """Confere se veio um arquivo e se ele é mesmo um PDF. Se não for, gera ErroDeEnvio."""
    problema = None

    if not nome_arquivo or not conteudo_pdf:
        problema = "Selecione um PDF primeiro."
    elif not nome_arquivo.lower().endswith(".pdf"):
        problema = "O arquivo precisa ser um PDF."
    elif b"%PDF" not in conteudo_pdf[:1024]:    # todo PDF começa com "%PDF"
        problema = "O arquivo não parece ser um PDF válido."

    if problema:
        raise ErroDeEnvio(problema, 400)


def ler_texto(conteudo_pdf):
    """Lê o PDF e garante que ele tem texto selecionável. Devolve {"texto", "paginas"}."""
    try:
        leitura = ler_pdf(conteudo_pdf)
    except ValueError as erro:
        raise ErroDeEnvio(str(erro), 422) from erro

    if leitura["texto"] == "":
        raise ErroDeEnvio("Este PDF não tem texto selecionável. Ele pode ser digitalizado (precisa de OCR).", 422)

    leitura["texto"] = anonimizar_texto(leitura["texto"])    # CPF, CNPJ, e-mail e telefone não saem do servidor

    return leitura


def ler_com_ia(texto):
    """Roda as 3 tarefas da IA ao mesmo tempo e devolve {"leitura", "clausulas", "avisos"}.

    A leitura em linguagem simples é essencial: se ela falhar, o envio falha (ErroDeEnvio 502).
    As outras duas têm plano B: sem o assunto marcado pela IA usa as palavras-chave; sem embeddings não há comparação.
    """
    pedacos = separar_clausulas(texto)
    avisos = []

    if len(texto) > limite_de_caracteres():
        limite = f"{limite_de_caracteres():,}".replace(",", ".")
        avisos.append(f"O contrato é muito longo: a IA leu só os primeiros {limite} caracteres.")

    with ThreadPoolExecutor(max_workers=3) as equipe:
        tarefa_leitura = equipe.submit(ler_contrato, texto)
        tarefa_assuntos = equipe.submit(classificar_clausulas, pedacos)
        tarefa_vetores = equipe.submit(gerar_embeddings, pedacos)

        try:
            leitura = tarefa_leitura.result()
        except IAErro as erro:
            raise ErroDeEnvio(f"A leitura por IA não funcionou: {erro}", 502) from erro

        try:
            tipos = tarefa_assuntos.result()
        except IAErro:
            tipos = [tipo_por_palavras(pedaco) for pedaco in pedacos]
            avisos.append("A IA não marcou o assunto de cada cláusula; usei as palavras-chave.")

        try:
            vetores = tarefa_vetores.result()
        except IAErro:
            vetores = [None] * len(pedacos)
            avisos.append("Não foi possível gerar os números de comparação (embeddings), então a nota não foi calculada.")

    clausulas = [
        {"ordem": ordem, "tipo": tipo, "texto": pedaco, "embedding": vetor}
        for ordem, (pedaco, tipo, vetor) in enumerate(zip(pedacos, tipos, vetores, strict=True), start=1)
    ]
    resultado = {"leitura": leitura, "clausulas": clausulas, "avisos": avisos}

    return resultado


def guardar_no_banco(nome_arquivo, conteudo_pdf, leitura_pdf, resultado_ia, comparacao):
    """Guarda o PDF, a análise e as cláusulas no Supabase e devolve o que foi guardado.

    Nunca interrompe o site: se algo falhar, o problema vem explicado no campo "aviso".
    """
    registro = {"contrato_id": None, "analise_id": None, "clausulas": 0, "aviso": None}

    try:
        registro["contrato_id"] = guardar_contrato(nome_arquivo, conteudo_pdf, leitura_pdf["texto"], leitura_pdf["paginas"])
        registro["analise_id"] = guardar_analise(
            registro["contrato_id"],
            {**resultado_ia["leitura"], "comparacao": comparacao},
            modelo_de_analise(),
            instrucoes_da_ia()["versao"],
            comparacao["nota"],
        )
    except BancoErro as erro:
        if registro["contrato_id"]:
            marcar_erro(registro["contrato_id"])
        registro["aviso"] = f"O envio não foi guardado no banco: {erro}"

    if registro["analise_id"]:
        try:
            registro["clausulas"] = guardar_clausulas(registro["contrato_id"], resultado_ia["clausulas"])
        except BancoErro as erro:
            registro["aviso"] = f"PDF e análise guardados, mas as cláusulas não: {erro}"

    return registro


def detectar(nome_arquivo, conteudo_pdf, salvar=True):
    """Faz o processo completo para um PDF e devolve o resultado que o site mostra.

    salvar=False lê e analisa com a IA, mas não usa o banco (sem comparação e sem gravar nada).
    """
    validar_arquivo(nome_arquivo, conteudo_pdf)
    leitura_pdf = ler_texto(conteudo_pdf)
    resultado_ia = ler_com_ia(leitura_pdf["texto"])

    if salvar:
        comparacao = comparar_com_a_base(resultado_ia["clausulas"], calcular_hash(conteudo_pdf))
        registro = guardar_no_banco(nome_arquivo, conteudo_pdf, leitura_pdf, resultado_ia, comparacao)
    else:
        comparacao = resultado_indisponivel("A comparação com a base não foi feita nesta execução (sem banco).")
        registro = None

    resultado = {
        "caracteres": len(leitura_pdf["texto"]),
        "paginas": leitura_pdf["paginas"],
        "leitura": resultado_ia["leitura"],
        "confiabilidade": comparacao,
        "avisos": resultado_ia["avisos"],
        "modelo": modelo_de_analise(),
        "versao_prompt": instrucoes_da_ia()["versao"],
        "registro": registro,
    }
    return resultado


def testar_pelo_terminal(argumentos):
    """Roda o detector num PDF do computador e devolve um resumo em texto para mostrar no terminal."""
    caminhos = [argumento for argumento in argumentos if not argumento.startswith("--")]
    salvar = "--salvar" in argumentos

    if not caminhos:
        resumo = "Uso: python main_detector.py caminho/do/contrato.pdf [--salvar]"
    else:
        try:
            with open(caminhos[0], "rb") as arquivo:
                conteudo = arquivo.read()
            resultado = detectar(os.path.basename(caminhos[0]), conteudo, salvar)
            leitura = resultado["leitura"]
            confiabilidade = resultado["confiabilidade"]
            nota = f"Confiabilidade: {confiabilidade['nota']}%" if confiabilidade["disponivel"] else f"Confiabilidade: {confiabilidade['mensagem']}"

            linhas = [
                f"{resultado['paginas']} página(s), {resultado['caracteres']} caracteres lidos. Modelo: {resultado['modelo']}.",
                f"Documento: {leitura['tipo_documento']}",
                f"Em uma frase: {leitura['manchete']}",
                "Resumo:",
                *[f"  - {frase}" for frase in leitura["resumo"]],
                "Pontos a conferir:",
                *[f"  [{ponto['nivel']}] {ponto['titulo']}: {ponto['explicacao']}" for ponto in leitura["pontos"]],
                nota,
                *[f"Aviso: {aviso}" for aviso in resultado["avisos"]],
                f"Banco: {resultado['registro']}" if salvar else "Banco: nada gravado (use --salvar para gravar).",
            ]
            resumo = "\n".join(linhas)
        except OSError:
            resumo = f"Não encontrei o arquivo: {caminhos[0]}"
        except (ErroDeEnvio, IAErro) as erro:
            resumo = f"Erro: {getattr(erro, 'mensagem', erro)}"

    return resumo


if __name__ == "__main__":
    print(testar_pelo_terminal(sys.argv[1:]))
