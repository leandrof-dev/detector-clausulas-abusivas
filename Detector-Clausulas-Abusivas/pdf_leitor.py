import tkinter as tk
from tkinter import filedialog, messagebox
import fitz

print("pdf_leitor, __name__ =", __name__)

dados = {"texto": ""}    # NOVO: guarda o texto lido, fica disponível para quem importar o arquivo

def selecionar_pdf(entrada_pdf):    # ALTERADO: recebe a caixa de entrada como parâmetro (antes era global)
    caminho = filedialog.askopenfilename(
        title="Selecionar PDF",
        filetypes=[("Arquivos PDF", "*.pdf")]
    )

    if caminho != "":
        entrada_pdf.delete(0, tk.END)
        entrada_pdf.insert(0, caminho)


def extrair_pdf(entrada_pdf, caixa_texto):    # ALTERADO: recebe as duas caixas como parâmetros (antes eram globais)
    caminho = entrada_pdf.get()

    if caminho == "":
        messagebox.showwarning("Atenção", "Selecione um PDF primeiro.")
        return

    try:
        documento = fitz.open(caminho)

        texto = ""
        for pagina in documento:
            texto += pagina.get_text()

        documento.close()

        dados["texto"] = texto.strip()    # NOVO: guarda o texto lido para ser usado depois por outros arquivos

        caixa_texto.delete("1.0", tk.END)
        caixa_texto.insert("1.0", texto)

        uso_texto()    # chama a função que pega o texto lido

    except Exception as erro:
        messagebox.showerror("Erro", f"Não foi possível ler o PDF:\n{erro}")


def salvar_txt():
    texto = dados["texto"]    # ALTERADO: pega o texto guardado em "dados" (antes pegava da caixa_texto)

    if texto == "":
        messagebox.showwarning("Atenção", "Não há texto para salvar.")
        return

    caminho = filedialog.asksaveasfilename(
        title="Salvar texto",
        defaultextension=".txt",
        filetypes=[("Arquivo de texto", "*.txt")]
    )

    if caminho != "":
        with open(caminho, "w", encoding="utf-8") as arquivo:
            arquivo.write(texto)

        messagebox.showinfo("Sucesso", "Texto salvo com sucesso!")


def uso_texto():
    texto = dados["texto"]    # ALTERADO: pega o texto guardado em "dados" (antes pegava da caixa_texto, que some quando a janela fecha)
    print(texto)                                     # por enquanto só mostra no terminal
    return texto                                     # devolve o texto para quem chamou


def iniciar():
    # ALTERADO: linha "global entrada_pdf, caixa_texto" removida, não precisa mais

    janela = tk.Tk()
    janela.title("Extrator de Texto PDF")
    janela.geometry("800x800")

    tk.Label(
        janela,
        text="Extrator de Texto PDF",
        font=("Arial", 18, "bold")
    ).pack(pady=15)

    frame = tk.Frame(janela)
    frame.pack(pady=5)

    entrada_pdf = tk.Entry(frame, width=60)
    entrada_pdf.pack(side=tk.LEFT, padx=5)

    tk.Button(frame, text="Selecionar PDF", command=lambda: selecionar_pdf(entrada_pdf)).pack(side=tk.LEFT)    # ALTERADO: lambda para passar a entrada_pdf à função

    caixa_texto = tk.Text(janela, wrap=tk.WORD)    # ALTERADO: movida para cima, para existir antes do botão "Extrair texto" usar ela

    tk.Button(janela, text="Extrair texto", command=lambda: extrair_pdf(entrada_pdf, caixa_texto), width=20).pack(pady=15)    # ALTERADO: lambda para passar as duas caixas à função

    caixa_texto.pack(expand=True, fill=tk.BOTH, padx=20, pady=10)

    tk.Button(janela, text="Salvar TXT", command=salvar_txt, width=20).pack(pady=15)

    janela.mainloop()