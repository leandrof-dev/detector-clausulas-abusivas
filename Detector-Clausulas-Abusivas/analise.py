# Análise do protótipo: SEM inteligência artificial.
# Cada regra procura palavras no texto do contrato e devolve um aviso já escrito.
# Para criar uma regra nova, é só copiar um bloco da lista REGRAS e trocar os textos.

REGRAS = [
    {
        "titulo": "Multa",
        "palavras": ["multa"],
        "aviso": "O contrato menciona multa. Confira em quais situações ela é cobrada (atraso, cancelamento) e qual o valor ou percentual.",
        "norma": "CDC, art. 6º, III (informação clara)",
    },
    {
        "titulo": "Juros",
        "palavras": ["juros"],
        "aviso": "Confira se a taxa de juros está escrita de forma clara, ao mês e ao ano.",
        "norma": "CDC, art. 6º, III; Resolução CMN nº 3.517/2007",
    },
    {
        "titulo": "Tarifas",
        "palavras": ["tarifa"],
        "aviso": "Confira quais tarifas são cobradas e se cada valor está informado.",
        "norma": "CDC, art. 6º, III (informação clara)",
    },
    {
        "titulo": "Seguro",
        "palavras": ["seguro"],
        "aviso": "Confira se o seguro é opcional. Seguro imposto junto com o financiamento pode configurar venda casada.",
        "norma": "CDC, art. 39, I (venda casada)",
    },
    {
        "titulo": "Cancelamento ou rescisão",
        "palavras": ["cancelamento", "rescisão"],
        "aviso": "Confira as condições, os prazos e os custos para sair do contrato.",
        "norma": "CDC, art. 51 (cláusulas abusivas)",
    },
    {
        "titulo": "Renovação automática",
        "palavras": ["renovação automática"],
        "aviso": "Confira como cancelar e com qual antecedência é preciso avisar.",
        "norma": "CDC, art. 6º, III (informação clara)",
    },
]


def analisar(texto):
    # Deixa tudo Minúsculo e com espaços simples Utilizando >Lower
    texto_limpo = " ".join(texto.lower().split())

    achados = []

    for regra in REGRAS:
        quantidade = 0
        for palavra in regra["palavras"]:
            quantidade += texto_limpo.count(palavra)

        if quantidade > 0:
            achados.append({
                "titulo": regra["titulo"],
                "quantidade": quantidade,
                "aviso": regra["aviso"],
                "norma": regra["norma"],
            })

    # Regra de Ausência: Avisa Quando algo Esperado NÃO aparece no Texto
    if "custo efetivo total" not in texto_limpo:
        achados.append({
            "titulo": "Custo Efetivo Total",
            "quantidade": 0,
            "aviso": "Não encontrei o Custo Efetivo Total no texto lido. Em operações de crédito ele deve ser informado.",
            "norma": "Resolução CMN nº 3.517/2007",
        })

    return achados
