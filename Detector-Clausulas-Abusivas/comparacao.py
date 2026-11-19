# Compara as cláusulas do contrato com as de contratos já guardados no banco e calcula a nota de confiabilidade.
# A nota diz o quanto o contrato "está na curva": quão parecida cada cláusula é com as já conhecidas (100% = igual).

import logging    # registra no terminal o detalhe técnico dos erros

from banco import BancoErro, buscar_clausulas_de_outros_contratos, contar_contratos_da_base

registro = logging.getLogger("detector.comparacao")


def minimo_de_contratos():
    """Quantos contratos DIFERENTES precisam estar na base para a nota fazer sentido."""
    minimo = 3
    return minimo


def assuntos_do_grafico():
    """Os assuntos comparados no gráfico, na ordem em que aparecem: (tipo guardado no banco, nome na tela)."""
    assuntos = [
        ("juros", "Juros"),
        ("tarifa", "Tarifas"),
        ("seguro", "Seguro"),
        ("multa", "Multa e encargos"),
        ("cancelamento", "Cancelamento"),
        ("cet", "Custo Efetivo Total"),
    ]
    return assuntos


def resultado_indisponivel(mensagem, base=0):
    """O resultado quando não dá para calcular a nota: sem nota e com a explicação do motivo."""
    resultado = {
        "disponivel": False,
        "nota": None,
        "base": base,
        "minimo": minimo_de_contratos(),
        "itens": [],
        "mensagem": mensagem,
    }
    return resultado


def clausulas_para_comparar(clausulas, tipo, quantidade=2):
    """Escolhe as cláusulas mais completas (maiores) de um assunto, só as que têm embedding."""
    do_assunto = [c for c in clausulas if c["tipo"] == tipo and c["embedding"] is not None]
    do_assunto.sort(key=lambda clausula: len(clausula["texto"]), reverse=True)

    return do_assunto[:quantidade]


def como_percentual(similaridade):
    """0.8137 → 81 (e sempre entre 0 e 100)."""
    percentual = max(0, min(100, round(similaridade * 100)))
    return percentual


def comparar_assunto(clausulas, tipo, rotulo, hash_do_pdf):
    """Compara um assunto com a base: devolve a similaridade da cláusula mais parecida (ou None se não houver)."""
    similaridades = []

    for clausula in clausulas_para_comparar(clausulas, tipo):
        parecidas = buscar_clausulas_de_outros_contratos(clausula["embedding"], hash_do_pdf, limite=1, tipo=tipo)
        if parecidas:
            similaridades.append(parecidas[0]["similaridade"])

    item = {
        "assunto": tipo,
        "rotulo": rotulo,
        "similaridade": como_percentual(max(similaridades)) if similaridades else None,
    }
    return item


def comparar_com_a_base(clausulas, hash_do_pdf):
    """Compara o contrato com os outros já guardados.

    clausulas: lista de {"tipo", "texto", "embedding"}. hash_do_pdf: os envios do mesmo PDF são ignorados.
    Devolve {"disponivel", "nota", "base", "minimo", "itens", "mensagem"}.
    """
    minimo = minimo_de_contratos()
    resultado = resultado_indisponivel("")

    try:
        base = contar_contratos_da_base(hash_do_pdf)
        resultado = resultado_indisponivel("", base)

        if base < minimo:
            resultado["mensagem"] = f"Ainda há poucos contratos na base para comparar ({base} de {minimo})."
        else:
            itens = []
            for tipo, rotulo in assuntos_do_grafico():
                if any(c["tipo"] == tipo for c in clausulas):    # só entram os assuntos que este contrato tem
                    itens.append(comparar_assunto(clausulas, tipo, rotulo, hash_do_pdf))

            medidos = [item["similaridade"] for item in itens if item["similaridade"] is not None]
            resultado["itens"] = itens

            if len(medidos) >= 2:
                resultado["disponivel"] = True
                resultado["nota"] = round(sum(medidos) / len(medidos))
            else:
                resultado["mensagem"] = "Poucos assuntos em comum com os contratos da base para calcular a nota."
    except BancoErro as erro:
        registro.warning("Comparação com a base não feita: %s", erro)
        resultado = resultado_indisponivel("Não consegui consultar a base de comparação agora.")

    return resultado
