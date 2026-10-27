from pdf_leitor import uso_texto
from pdf_leitor import salvar_txt

salvar_txt
texto = uso_texto()    # ALTERADO: agora guarda o texto devolvido em uma variável para as comparações

multa = 0
copia = texto.lower()
Listagem = texto.lower().split()

while "multa" in copia:
    multa += 1
    copia = copia.replace("multa" , "" , 1)  


print("\n" + "=" * 30 + "\n")
print(f"Terminou com {multa} Multas")