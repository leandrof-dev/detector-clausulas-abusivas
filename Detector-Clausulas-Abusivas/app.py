import os
import tempfile

import fitz
from flask import Flask, jsonify, render_template, request

from pdf_leitor import dados      # mesmo "armazém" de texto que o seu código já usa
from pdf_leitor import uso_texto  # mesma função que o integrador_pub.py usa para pegar o texto
from analise import analisar

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024    # limite de 20 MB por PDF


@app.route("/")
def inicio():
    return render_template("index.html")


@app.route("/ler-pdf", methods=["POST"])
def ler_pdf():
    arquivo = request.files.get("pdf")

    if arquivo is None or arquivo.filename == "":
        return jsonify({"erro": "Selecione um PDF primeiro."}), 400

    if not arquivo.filename.lower().endswith(".pdf"):
        return jsonify({"erro": "O arquivo precisa ser um PDF."}), 400

    # o fitz abre arquivos pelo caminho, então salvamos uma cópia temporária do PDF enviado
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as temporario:
        arquivo.save(temporario)
        caminho = temporario.name

    try:
        # mesma leitura que o extrair_pdf do pdf_leitor.py faz
        texto = ""
        with fitz.open(caminho) as documento:
            for pagina in documento:
                texto += pagina.get_text()
    except Exception as erro:
        return jsonify({"erro": f"Não foi possível ler o PDF: {erro}"}), 500
    finally:
        os.remove(caminho)

    dados["texto"] = texto.strip()    # igual ao extrair_pdf: guarda o texto no "dados"
    texto = uso_texto()               # igual ao integrador_pub.py: pega o texto com a uso_texto()

    if texto == "":
        return jsonify({"erro": "Este PDF não tem texto selecionável. Ele pode ser digitalizado (precisa de OCR)."}), 422

    return jsonify({
        "texto": texto,
        "caracteres": len(texto),
        "achados": analisar(texto),
    })


if __name__ == "__main__":
    app.run(debug=True)
