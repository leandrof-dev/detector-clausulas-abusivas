# Guarda os envios no Supabase: o PDF no armazenamento privado e os dados nas tabelas.
# Teste de conexão (só lê, não grava nada):  python banco.py

import hashlib                       # calcula a "impressão digital" (hash) do PDF
import os                            # lê as variáveis do arquivo .env
import uuid                          # cria um código único para cada contrato
from contextlib import suppress      # ignora um erro de propósito (em limpezas que podem falhar sem problema)
from functools import lru_cache      # guarda a conexão pronta, para não criar uma nova a cada uso

from dotenv import load_dotenv       # carrega o arquivo .env para dentro do programa
from supabase import create_client   # biblioteca oficial do Supabase (banco + armazenamento)

load_dotenv()


class BancoErro(Exception):
    """Erro do banco, com a mensagem em português."""


@lru_cache(maxsize=1)
def conectar_supabase():
    """Cria o cliente do Supabase com a URL e a chave secret do .env (só na primeira vez; depois reaproveita)."""
    url = os.getenv("SUPABASE_URL")
    chave = os.getenv("SUPABASE_SECRET_KEY")

    if not url or not chave:
        raise BancoErro("Faltam SUPABASE_URL e/ou SUPABASE_SECRET_KEY no arquivo .env.")

    try:
        cliente = create_client(url, chave)
    except Exception as erro:
        raise BancoErro(f"Não consegui conectar ao Supabase (confira a URL e a chave do .env): {erro}") from erro

    return cliente


def bucket_de_contratos():
    """Devolve o armazenamento privado onde ficam os PDFs (bucket "contratos")."""
    bucket = conectar_supabase().storage.from_("contratos")
    return bucket


def calcular_hash(conteudo_pdf):
    """Impressão digital do PDF: o mesmo arquivo sempre dá o mesmo código de 64 caracteres."""
    codigo = hashlib.sha256(conteudo_pdf).hexdigest()
    return codigo


def formatar_vetor(vetor):
    """Transforma a lista de números no texto que o banco entende: "[0.1,0.2,...]"."""
    texto = "[" + ",".join(str(numero) for numero in vetor) + "]"
    return texto


def guardar_contrato(nome_arquivo, conteudo_pdf, texto, paginas, origem="teste"):
    """Guarda o PDF no armazenamento e cria o registro do contrato. Devolve o id do contrato.

    O mesmo PDF pode ser enviado várias vezes: cada envio vira um contrato novo.
    origem: "teste" enquanto o projeto está em testes; troque para "producao" quando for para valer.
    """
    contrato_id = str(uuid.uuid4())
    caminho = f"{contrato_id}.pdf"
    linha = {
        "id": contrato_id,
        "nome_arquivo": nome_arquivo,
        "hash_sha256": calcular_hash(conteudo_pdf),
        "caminho_storage": caminho,
        "tamanho_bytes": len(conteudo_pdf),
        "paginas": paginas,
        "texto_extraido": texto.replace("\x00", ""),    # o banco não aceita o caractere nulo
        "anonimizado": False,
        "origem": origem,
        "status": "lido",
    }
    cliente = conectar_supabase()
    bucket = bucket_de_contratos()

    try:
        bucket.upload(path=caminho, file=conteudo_pdf, file_options={"content-type": "application/pdf"})
    except Exception as erro:
        raise BancoErro(f"Não consegui guardar o PDF no armazenamento: {erro}") from erro

    try:
        cliente.table("contratos").insert(linha).execute()
    except Exception as erro:
        with suppress(Exception):    # desfaz o upload para não sobrar um PDF sem registro
            bucket.remove([caminho])
        raise BancoErro(f"Não consegui registrar o contrato no banco: {erro}") from erro

    return contrato_id


def guardar_analise(contrato_id, resultado, modelo, versao_prompt, nota=None):
    """Guarda uma análise do contrato (pode haver várias por contrato). Devolve o id da análise.

    resultado: lista ou dicionário simples com o que a análise encontrou.
    modelo e versao_prompt: quem fez a análise e com qual versão do prompt (ficam registrados para comparar depois).
    nota: de 0 a 100, ou None.
    """
    linha = {
        "contrato_id": contrato_id,
        "modelo": modelo,
        "versao_prompt": versao_prompt,
        "resultado": resultado,
        "nota_confiabilidade": nota,
    }
    cliente = conectar_supabase()

    try:
        resposta = cliente.table("analises").insert(linha).execute()
        cliente.table("contratos").update({"status": "analisado"}).eq("id", contrato_id).execute()
    except Exception as erro:
        raise BancoErro(f"Não consegui guardar a análise: {erro}") from erro

    analise_id = resposta.data[0]["id"]
    return analise_id


def guardar_clausulas(contrato_id, clausulas):
    """Guarda as cláusulas de um contrato e devolve quantas foram guardadas.

    clausulas: lista de {"ordem", "tipo", "texto", "embedding"}; o embedding pode ser None.
    """
    tamanho_do_lote = 50    # envia aos poucos para não ficar pesado
    linhas = []
    cliente = conectar_supabase()

    for clausula in clausulas:
        linhas.append({
            "contrato_id": contrato_id,
            "ordem": clausula["ordem"],
            "tipo": clausula["tipo"],
            "texto": clausula["texto"],
            "embedding": formatar_vetor(clausula["embedding"]) if clausula["embedding"] is not None else None,
        })

    try:
        for inicio in range(0, len(linhas), tamanho_do_lote):
            cliente.table("clausulas").insert(linhas[inicio:inicio + tamanho_do_lote]).execute()
    except Exception as erro:
        raise BancoErro(f"Não consegui guardar as cláusulas: {erro}") from erro

    quantidade = len(linhas)
    return quantidade


def marcar_erro(contrato_id):
    """Marca o contrato com status "erro" (usado quando algo falha depois de ele já estar guardado)."""
    with suppress(Exception):
        conectar_supabase().table("contratos").update({"status": "erro"}).eq("id", contrato_id).execute()


def buscar_clausulas_parecidas(vetor, limite=5, tipo=None):
    """Para as comparações futuras: devolve as cláusulas guardadas mais parecidas com o vetor.

    tipo: "juros", "multa"... para procurar só naquele assunto (ou None para todos).
    Cada item tem tipo, texto e similaridade (1.0 = idêntica).
    """
    parametros = {"consulta": formatar_vetor(vetor), "limite": limite, "tipo_filtro": tipo}
    cliente = conectar_supabase()

    try:
        resposta = cliente.rpc("buscar_clausulas_parecidas", parametros).execute()
    except Exception as erro:
        raise BancoErro(f"Não consegui buscar cláusulas parecidas: {erro}") from erro

    parecidas = resposta.data
    return parecidas


def contar_contratos_da_base(hash_excluido):
    """Quantos PDFs DIFERENTES há na base, sem contar o PDF de hash_excluido (os reenvios do mesmo arquivo contam uma vez)."""
    cliente = conectar_supabase()

    try:
        resposta = cliente.table("contratos").select("hash_sha256").neq("hash_sha256", hash_excluido).limit(1000).execute()
    except Exception as erro:
        raise BancoErro(f"Não consegui contar os contratos da base: {erro}") from erro

    quantidade = len({linha["hash_sha256"] for linha in resposta.data})
    return quantidade


def buscar_clausulas_de_outros_contratos(vetor, hash_excluido, limite=3, tipo=None):
    """Acha as cláusulas mais parecidas com o vetor, só em contratos de outro PDF (hash diferente).

    Cada item tem tipo, similaridade (1.0 = idêntica), clausula_id e contrato_id.
    """
    parametros = {
        "consulta": formatar_vetor(vetor),
        "hash_excluido": hash_excluido,
        "limite": limite,
        "tipo_filtro": tipo,
    }
    cliente = conectar_supabase()

    try:
        resposta = cliente.rpc("buscar_clausulas_de_outros_contratos", parametros).execute()
    except Exception as erro:
        raise BancoErro(f"Não consegui comparar com os outros contratos: {erro}") from erro

    parecidas = resposta.data
    return parecidas


def testar_conexao():
    """Lê a tabela de contratos e o armazenamento, sem gravar nada. Devolve a mensagem de sucesso."""
    cliente = conectar_supabase()

    cliente.table("contratos").select("id", count="exact").limit(1).execute()
    bucket_de_contratos().list()

    mensagem = "Conexão com o Supabase OK (banco e armazenamento)."
    return mensagem


if __name__ == "__main__":
    try:
        resultado = testar_conexao()
    except BancoErro as erro:
        resultado = f"Erro: {erro}"
    except Exception as erro:
        resultado = f"Não foi possível conectar: {erro}"

    print(resultado)
