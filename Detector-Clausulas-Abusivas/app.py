# O servidor do site: mostra as páginas e recebe os PDFs enviados.
# Para abrir no computador:  python app.py   e acesse http://localhost:5000

import os                                                      # lê o e-mail de contato do arquivo .env

from dotenv import load_dotenv                                 # carrega o arquivo .env para dentro do programa
from flask import Flask, jsonify, render_template, request    # Flask: cria o site e as rotas (endereços)

from main_detector import ErroDeEnvio, detectar

load_dotenv()


def perguntas_do_faq():
    """As perguntas e respostas da página FAQ, na ordem em que aparecem (pergunta, resposta)."""
    perguntas = [
        (
            "O que este site faz?",
            "Você envia o PDF de um contrato de financiamento de veículo e uma IA explica o documento em linguagem "
            "simples, aponta os pontos que vale conferir e mostra a norma que sustenta cada um.",
        ),
        (
            "Isso é um parecer jurídico?",
            "Não. É uma leitura assistida, que serve para você entender melhor o contrato. Em caso de dúvida ou "
            "de conflito com o banco, procure um advogado ou um órgão de defesa do consumidor.",
        ),
        (
            "Que tipo de PDF posso enviar?",
            "PDFs com texto selecionável, de até 50 MB. PDFs digitalizados (fotos de papel) ainda não são lidos, "
            "porque o sistema não faz OCR.",
        ),
        (
            "O que significam Atenção, Verificar e Tudo certo?",
            "Atenção: pode haver cobrança ou cláusula irregular ou abusiva segundo as normas. Verificar: falta "
            "clareza ou informação, vale confirmar com o banco. Tudo certo: o ponto está claro e de acordo.",
        ),
        (
            "Como é calculada a nota de confiabilidade?",
            "Cada cláusula do seu contrato é comparada com as de contratos já analisados. A nota é a média de quão "
            "parecida cada assunto é com o mais parecido que o sistema já viu. Ela só aparece quando há contratos "
            "suficientes na base.",
        ),
        (
            "O que acontece com o meu arquivo?",
            "O PDF e o texto extraído são guardados em um armazenamento privado, usado para a análise e para a "
            "comparação entre contratos. Evite enviar documentos com dados pessoais que você não queira guardar.",
        ),
        (
            "A IA pode errar?",
            "Pode. Ela usa apenas o texto do documento e as normas de referência do projeto, mas pode interpretar "
            "algo de forma incompleta. Por isso cada ponto mostra o trecho do contrato, para você conferir.",
        ),
    ]
    return perguntas


def pagina_inicio():
    """Página inicial."""
    pagina = render_template("index.html")
    return pagina


def pagina_enviar_pdf():
    """Página de envio do PDF."""
    pagina = render_template("enviar_pdf.html")
    return pagina


def pagina_faq():
    """Página de perguntas frequentes."""
    pagina = render_template("faq.html", pagina_atual="faq", perguntas=perguntas_do_faq())
    return pagina


def pagina_sobre():
    """Página "Sobre nós"."""
    pagina = render_template("sobre.html", pagina_atual="sobre")
    return pagina


def pagina_contato():
    """Página de contato."""
    email = (os.getenv("CONTATO_EMAIL") or "").strip()
    pagina = render_template("contato.html", pagina_atual="contato", email_contato=email)
    return pagina


def receber_pdf():
    """Recebe o PDF enviado (campo "pdf" do formulário), roda o detector e devolve o resultado em JSON."""
    arquivo = request.files.get("pdf")
    nome_arquivo = arquivo.filename if arquivo else ""
    conteudo_pdf = arquivo.read() if arquivo else b""

    try:
        resposta = detectar(nome_arquivo, conteudo_pdf)
        codigo = 200
    except ErroDeEnvio as erro:
        resposta = {"erro": erro.mensagem}
        codigo = erro.codigo

    return jsonify(resposta), codigo


def arquivo_grande_demais(erro):
    """Resposta quando o PDF passa do limite de tamanho (o Flask recusa antes de chegar ao detector)."""
    resposta = {"erro": "O PDF passa do limite de 50 MB."}
    return jsonify(resposta), 413


def erro_inesperado(erro):
    """Resposta em JSON para erros inesperados (com debug=True o Flask mostra o erro completo no lugar disto)."""
    resposta = {"erro": "Erro inesperado no servidor. Tente de novo."}
    return jsonify(resposta), 500


def criar_app():
    """Monta o site: limite de tamanho, endereços das páginas e a rota que recebe o PDF."""
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024    # 50 MB, o mesmo limite do armazenamento no Supabase

    app.add_url_rule("/", "index", pagina_inicio)
    app.add_url_rule("/enviar_pdf", "enviar_pdf", pagina_enviar_pdf)
    app.add_url_rule("/faq", "faq", pagina_faq)
    app.add_url_rule("/sobre", "sobre", pagina_sobre)
    app.add_url_rule("/contato", "contato", pagina_contato)
    app.add_url_rule("/ler-pdf", "ler_pdf", receber_pdf, methods=["POST"])
    app.register_error_handler(413, arquivo_grande_demais)
    app.register_error_handler(500, erro_inesperado)

    return app


app = criar_app()    # o Flask (e a Vercel, quando o site for publicado) procura esta variável "app"

if __name__ == "__main__":
    app.run(debug=True, port=5000)
