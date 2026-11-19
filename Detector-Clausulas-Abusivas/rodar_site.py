# Servidor so para visualizar as paginas novas (nao altera o app.py).
# Rode com:  python rodar_site.py   e abra http://localhost:5000
from flask import Flask, render_template

app = Flask(__name__, template_folder="templates", static_folder="static")

@app.route("/")
def index(): return render_template("index.html")

@app.route("/enviar_pdf")
def enviar_pdf(): return render_template("enviar_pdf.html")

@app.route("/faq")
def faq(): return render_template("faq.html")

@app.route("/sobre")
def sobre(): return render_template("sobre.html")

@app.route("/contato")
def contato(): return render_template("contato.html")

if __name__ == "__main__":
    app.run(debug=True, port=5000)
