# O servidor do site: mostra as páginas e recebe os PDFs enviados.
# Para abrir no computador:  python app.py   e acesse http://localhost:5000

from flask import Flask, jsonify, render_template, request    # Flask: cria o site e as rotas (endereços)

from main_detector import ErroDeEnvio, detectar


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
    pagina = render_template("faq.html")
    return pagina


def pagina_sobre():
    """Página "Sobre nós"."""
    pagina = render_template("sobre.html")
    return pagina


def pagina_contato():
    """Página de contato."""
    pagina = render_template("contato.html")
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
