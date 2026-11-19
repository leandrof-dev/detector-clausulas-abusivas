"""banco.py: ponte entre o site (Flask), o Supabase e a OpenAI.

O que este arquivo faz:
  - guarda o PDF original no armazenamento privado (bucket "contratos");
  - registra o contrato, o texto lido e as análises no banco;
  - separa o texto em cláusulas e gera os "embeddings" (usados para comparar contratos);
  - busca cláusulas parecidas com um texto.

Ele NÃO altera nenhum outro arquivo do projeto. Para usar, o app.py só precisa de:

    from banco import guardar_envio, BancoErro

Variáveis do arquivo .env usadas:
    SUPABASE_URL, SUPABASE_SECRET_KEY  -> acesso ao banco (a chave secret fica só no backend)
    IA_API_KEY                         -> chave da OpenAI (só para gerar embeddings)
    MODELO_EMBEDDING     (opcional)    -> padrão: text-embedding-3-large
    EMBEDDING_DIMENSOES  (opcional)    -> padrão: 1536 (precisa ser igual ao vector(1536) do banco)

Para testar a conexão (não grava nada):
    python banco.py
"""

import hashlib
import os
import re
import uuid

from dotenv import load_dotenv

load_dotenv()    # lê o arquivo .env da pasta do projeto (na Vercel as variáveis vêm do painel)

BUCKET = "contratos"
EMBEDDING_MODELO = os.getenv("MODELO_EMBEDDING", "text-embedding-3-large")
EMBEDDING_DIMENSOES = int(os.getenv("EMBEDDING_DIMENSOES", "1536"))
DIMENSOES_DO_BANCO = 1536    # o banco foi criado com vector(1536)

# Enquanto a análise for a do analise.py (sem IA), é isto que vai gravado em "analises"
MODELO_ATUAL = "regras"
VERSAO_ATUAL = "regras-v1"

# Cada tipo de cláusula e as palavras que o identificam (a ordem importa: vale o primeiro que achar)
PALAVRAS_POR_TIPO = [
    ("cet", ["custo efetivo total"]),
    ("multa", ["multa"]),
    ("juros", ["juros"]),
    ("tarifa", ["tarifa"]),
    ("seguro", ["seguro"]),
    ("cancelamento", ["cancelamento", "rescisão", "rescisao"]),
]


class BancoErro(Exception):
    """Erro com mensagem em português, pronta para mostrar na tela ou no terminal."""


# ---------------------------------------------------------------------------
# Conexões (só são criadas quando alguma função precisa delas)
# ---------------------------------------------------------------------------
_clientes = {}


def _supabase():
    if "supabase" not in _clientes:
        url = os.getenv("SUPABASE_URL")
        chave = os.getenv("SUPABASE_SECRET_KEY")
        if not url or not chave:
            raise BancoErro("Faltam SUPABASE_URL e/ou SUPABASE_SECRET_KEY no arquivo .env.")
        from supabase import create_client
        _clientes["supabase"] = create_client(url, chave)
    return _clientes["supabase"]


def _openai():
    if "openai" not in _clientes:
        chave = os.getenv("IA_API_KEY")
        if not chave:
            raise BancoErro("Falta IA_API_KEY no arquivo .env.")
        from openai import OpenAI
        _clientes["openai"] = OpenAI(api_key=chave)
    return _clientes["openai"]


# ---------------------------------------------------------------------------
# Funções simples (não usam internet)
# ---------------------------------------------------------------------------
def calcular_hash(conteudo_pdf):
    """Impressão digital do PDF: o mesmo arquivo sempre dá o mesmo código."""
    return hashlib.sha256(conteudo_pdf).hexdigest()


def classificar_tipo(texto):
    """Diz de que assunto é a cláusula (juros, multa...), usando as mesmas palavras do analise.py."""
    minusculo = texto.lower()
    for tipo, palavras in PALAVRAS_POR_TIPO:
        for palavra in palavras:
            if palavra in minusculo:
                return tipo
    return "outro"


def separar_clausulas(texto, tamanho_minimo=120, tamanho_maximo=2000):
    """Quebra o texto do contrato em pedaços (cláusulas).

    Versão simples: corta nos títulos "CLÁUSULA ..." e nas linhas em branco, junta pedaços muito
    curtos e divide os muito longos. Mais tarde dá para trocar por uma separação feita pela IA.
    """
    texto = texto.replace("\x00", "").replace("\r", "")
    corte = re.compile(r"\n\s*\n|^(?=\s*cl[aá]usula\s+\S+)", re.IGNORECASE | re.MULTILINE)

    clausulas = []
    atual = ""
    for bloco in corte.split(texto):
        bloco = " ".join(bloco.split())    # tira quebras de linha e espaços repetidos
        if bloco == "":
            continue
        atual = (atual + " " + bloco).strip()
        if len(atual) >= tamanho_minimo:
            clausulas.append(atual)
            atual = ""
    if atual != "":    # sobrou um pedaço curto no final: junta com o anterior
        if clausulas:
            clausulas[-1] += " " + atual
        else:
            clausulas.append(atual)

    resultado = []
    for clausula in clausulas:
        while len(clausula) > tamanho_maximo:    # divide os pedaços muito longos, de preferência no fim de uma frase
            ponto = clausula.rfind(". ", 0, tamanho_maximo)
            ponto = ponto + 1 if ponto > 0 else tamanho_maximo
            resultado.append(clausula[:ponto].strip())
            clausula = clausula[ponto:].strip()
        if clausula != "":
            resultado.append(clausula)
    return resultado


def _formatar_vetor(vetor):
    """Transforma a lista de números no formato de texto que o banco entende: [0.1,0.2,...]"""
    return "[" + ",".join(str(numero) for numero in vetor) + "]"


# ---------------------------------------------------------------------------
# IA (embeddings)
# ---------------------------------------------------------------------------
def gerar_embeddings(textos):
    """Devolve um vetor (lista de 1536 números) para cada texto, na mesma ordem."""
    if not textos:
        return []
    if EMBEDDING_DIMENSOES != DIMENSOES_DO_BANCO:
        raise BancoErro(
            f"EMBEDDING_DIMENSOES={EMBEDDING_DIMENSOES}, mas o banco usa vector({DIMENSOES_DO_BANCO}). "
            "Os dois precisam ser iguais."
        )
    cliente = _openai()
    vetores = []
    for inicio in range(0, len(textos), 100):    # a OpenAI recebe vários textos por chamada
        lote = textos[inicio:inicio + 100]
        try:
            resposta = cliente.embeddings.create(
                model=EMBEDDING_MODELO, input=lote, dimensions=EMBEDDING_DIMENSOES
            )
        except Exception as erro:
            raise BancoErro(f"Não consegui gerar os embeddings: {erro}") from erro
        vetores.extend(item.embedding for item in sorted(resposta.data, key=lambda item: item.index))
    return vetores


# ---------------------------------------------------------------------------
# Banco de dados
# ---------------------------------------------------------------------------
def guardar_contrato(nome_arquivo, conteudo_pdf, texto, paginas=None, origem="teste"):
    """Guarda o PDF no armazenamento e cria o registro do contrato. Devolve o id do contrato.

    O mesmo PDF pode ser enviado várias vezes: cada envio vira um contrato novo.
    origem: "teste" enquanto você testa; troque para "producao" quando for para valer.
    """
    cliente = _supabase()
    contrato_id = str(uuid.uuid4())
    caminho = f"{contrato_id}.pdf"

    try:
        cliente.storage.from_(BUCKET).upload(
            path=caminho,
            file=conteudo_pdf,
            file_options={"content-type": "application/pdf"},
        )
    except Exception as erro:
        raise BancoErro(f"Não consegui guardar o PDF no armazenamento: {erro}") from erro

    try:
        cliente.table("contratos").insert({
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
        }).execute()
    except Exception as erro:
        try:    # desfaz o upload para não sobrar um PDF sem registro
            cliente.storage.from_(BUCKET).remove([caminho])
        except Exception:
            pass
        raise BancoErro(f"Não consegui registrar o contrato no banco: {erro}") from erro

    return contrato_id


def guardar_analise(contrato_id, resultado, modelo=MODELO_ATUAL, versao_prompt=VERSAO_ATUAL, nota=None):
    """Guarda uma análise do contrato (pode haver várias por contrato). Devolve o id da análise.

    resultado: qualquer lista/dicionário simples (por exemplo, o que o analisar() devolve).
    nota: de 0 a 100, ou None.
    """
    cliente = _supabase()
    try:
        resposta = cliente.table("analises").insert({
            "contrato_id": contrato_id,
            "modelo": modelo,
            "versao_prompt": versao_prompt,
            "resultado": resultado,
            "nota_confiabilidade": nota,
        }).execute()
        cliente.table("contratos").update({"status": "analisado"}).eq("id", contrato_id).execute()
    except Exception as erro:
        raise BancoErro(f"Não consegui guardar a análise: {erro}") from erro
    return resposta.data[0]["id"]


def guardar_clausulas(contrato_id, texto, com_embeddings=True):
    """Separa o texto em cláusulas e guarda cada uma (com o embedding, para comparar depois)."""
    pedacos = separar_clausulas(texto)
    if not pedacos:
        return 0

    vetores = gerar_embeddings(pedacos) if com_embeddings else [None] * len(pedacos)
    linhas = []
    for ordem, (pedaco, vetor) in enumerate(zip(pedacos, vetores), start=1):
        linhas.append({
            "contrato_id": contrato_id,
            "ordem": ordem,
            "tipo": classificar_tipo(pedaco),
            "texto": pedaco,
            "embedding": _formatar_vetor(vetor) if vetor is not None else None,
        })

    cliente = _supabase()
    try:
        for inicio in range(0, len(linhas), 50):    # envia aos poucos para não ficar pesado
            cliente.table("clausulas").insert(linhas[inicio:inicio + 50]).execute()
    except Exception as erro:
        raise BancoErro(f"Não consegui guardar as cláusulas: {erro}") from erro
    return len(linhas)


def marcar_erro(contrato_id):
    """Marca o contrato com status "erro" (use quando algo falhar depois de guardá-lo)."""
    try:
        _supabase().table("contratos").update({"status": "erro"}).eq("id", contrato_id).execute()
    except Exception:
        pass


def guardar_envio(nome_arquivo, conteudo_pdf, texto, achados, paginas=None, origem="teste", com_embeddings=True):
    """Faz tudo de uma vez para um PDF enviado no site. É a função que o app.py chama.

    Passos: guarda o PDF e o texto -> guarda a análise (os "achados" do analise.py) -> guarda as cláusulas.
    Devolve um dicionário com os ids e quantos itens foram guardados.
    Se o PDF e a análise forem guardados mas as cláusulas falharem, o envio continua valendo
    e o problema vem no campo "aviso".
    """
    contrato_id = guardar_contrato(nome_arquivo, conteudo_pdf, texto, paginas, origem)
    analise_id = guardar_analise(contrato_id, achados)

    aviso = None
    quantidade = 0
    try:
        quantidade = guardar_clausulas(contrato_id, texto, com_embeddings)
    except BancoErro as erro:
        aviso = f"PDF e análise guardados, mas as cláusulas não: {erro}"

    return {
        "contrato_id": contrato_id,
        "analise_id": analise_id,
        "clausulas": quantidade,
        "aviso": aviso,
    }


def buscar_clausulas_parecidas(texto, limite=5, tipo=None):
    """Acha, entre as cláusulas já guardadas, as mais parecidas com o texto.

    tipo: "juros", "multa"... para procurar só naquele assunto (ou None para todos).
    Devolve uma lista de dicionários com tipo, texto e similaridade (1.0 = idêntica).
    """
    vetor = gerar_embeddings([texto])[0]
    try:
        resposta = _supabase().rpc("buscar_clausulas_parecidas", {
            "consulta": _formatar_vetor(vetor),
            "limite": limite,
            "tipo_filtro": tipo,
        }).execute()
    except Exception as erro:
        raise BancoErro(f"Não consegui buscar cláusulas parecidas: {erro}") from erro
    return resposta.data


# ---------------------------------------------------------------------------
# Teste de conexão: python banco.py   (só lê, não grava nada)
# ---------------------------------------------------------------------------
def testar_conexao():
    cliente = _supabase()
    cliente.table("contratos").select("id", count="exact").limit(1).execute()
    cliente.storage.from_(BUCKET).list()
    print("Conexão com o Supabase OK (banco e armazenamento).")


if __name__ == "__main__":
    try:
        testar_conexao()
    except BancoErro as erro:
        print(f"Erro: {erro}")
    except Exception as erro:
        print(f"Não foi possível conectar: {erro}")
