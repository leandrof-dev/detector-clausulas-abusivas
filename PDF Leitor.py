import tkinter as tk
from tkinter import filedialog, messagebox
import fitz


def selecionar_pdf():
    caminho = filedialog.askopenfilename(
        title="Selecionar PDF",
        filetypes=[("Arquivos PDF", "*.pdf")]
    )

    if caminho:
        entrada_pdf.delete(0, tk.END)
        entrada_pdf.insert(0, caminho)


def extrair_pdf():
    caminho = entrada_pdf.get()

    if not caminho:
        messagebox.showwarning(
            "Atenção",
            "Selecione um PDF primeiro."
        )
        return

    try:
        documento = fitz.open(caminho)

        texto = ""

        for pagina in documento:
            texto += pagina.get_text()

        documento.close()

        caixa_texto.delete("1.0", tk.END)
        caixa_texto.insert("1.0", texto)

    except Exception as erro:
        messagebox.showerror(
            "Erro",
            f"Não foi possível ler o PDF:\n{erro}"
        )


def salvar_txt():
    texto = caixa_texto.get("1.0", tk.END).strip()

    if not texto:
        messagebox.showwarning(
            "Atenção",
            "Não há texto para salvar."
        )
        return

    caminho = filedialog.asksaveasfilename(
        title="Salvar texto",
        defaultextension=".txt",
        filetypes=[("Arquivo de texto", "*.txt")]
    )

    if caminho:
        with open(caminho, "w", encoding="utf-8") as arquivo:
            arquivo.write(texto)

        messagebox.showinfo(
            "Sucesso",
            "Texto salvo com sucesso!"
        )


# -------------------------
# Interface
# -------------------------

janela = tk.Tk()
janela.title("Extrator de Texto PDF")
janela.geometry("800x800")

tk.Label(
    janela,
    text="Extrator de Texto PDF",
    font=("Arial", 18, "800")
).pack(pady=15)


frame = tk.Frame(janela)
frame.pack(pady=5)

entrada_pdf = tk.Entry(frame, width=60)
entrada_pdf.pack(side=tk.LEFT, padx=5)

tk.Button(
    frame,
    text="Selecionar PDF",
    command=selecionar_pdf
).pack(side=tk.LEFT)


tk.Button(
    janela,
    text="Extrair texto",
    command=extrair_pdf,
    width=20
).pack(pady=15)


caixa_texto = tk.Text(
    janela,
    wrap=tk.WORD
)

caixa_texto.pack(
    expand=True,
    fill=tk.BOTH,
    padx=20,
    pady=10
)


tk.Button(
    janela,
    text="Salvar TXT",
    command=salvar_txt,
    width=20
).pack(pady=15)


janela.mainloop()