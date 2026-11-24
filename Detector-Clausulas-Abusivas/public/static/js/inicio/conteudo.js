/* Textos e números que o JavaScript coloca na página inicial — edite aqui.
   Os demais textos ficam direto no templates/index.html. Cada função devolve o conteúdo de uma parte da página. */

/** Topo da página: uma frase por etapa da cor (vermelho → roxo → verde) e o painel "Análise do seu contrato". */
export function conteudoDoTopo() {
  const conteudo = {
    titulos: [
      'Você sabe o que <b class="destaque">está pagando?</b>',
      'Descubra o que está <b class="destaque">por trás das taxas.</b>',
      'Ajuste o contrato. <b class="destaque">Assine com clareza.</b>',
    ],
    subtitulos: [
      'Juros, tarifas e encargos escondidos podem deixar seu contrato bem mais caro do que parece.',
      'Comparamos cada ponto com referências do mercado e mostramos onde o contrato precisa melhorar.',
      'Com os pontos ajustados, o contrato fica consistente com as referências e você decide com segurança.',
    ],
    etiquetas: ['Atenção · contrato caro', 'Em análise · comparando', 'Consistente · contrato ajustado'],
    legendasDoPainel: [
      'Pontos que merecem atenção',
      'Comparando com referências…',
      'Comparado às referências disponíveis',
    ],
    /* valor no começo da rolagem (antes) e no fim (depois).
       formato: 'reais' → R$ 78.000 · 'taxa' → 2,8% a.m. · 'porcentagem' → 32% */
    painel: [
      { rotulo: 'Valor financiado', antes: 78000, depois: 78000, formato: 'reais' },
      { rotulo: 'Taxa de financiamento', antes: 2.8, depois: 2.4, formato: 'taxa' },
      { rotulo: 'Encargos adicionais', antes: 6480, depois: 3950, formato: 'reais' },
      { rotulo: 'Custo efetivo total', antes: 3.4, depois: 2.9, formato: 'taxa' },
      { rotulo: 'Confiabilidade da análise', antes: 32, depois: 94, formato: 'porcentagem' },
    ],
  };
  return conteudo;
}

/** Seção "O problema" (iceberg): valor da faixa visível e das três faixas escondidas. */
export function conteudoDoIceberg() {
  const conteudo = {
    parcela: 78000,
    escondidos: [2530, 1450, 2500], // encargos, tarifas embutidas, serviços agregados
  };
  return conteudo;
}

/** Seção "Leitura guiada · caso real": explicação de cada ponto do contrato (mesma ordem dos botões no HTML). */
export function conteudoDoCasoReal() {
  const cores = { verde: '#3ff0a6', amarelo: '#ffb454', vermelho: '#ff5566' };
  const pontos = [
    {
      cor: cores.verde,
      selo: 'Dentro da média',
      titulo: 'Taxa contratada × média do Banco Central',
      texto:
        'Na data do contrato, a média do Banco Central para aquisição de veículos era de 1,98% ao mês. A taxa de 2,05% ficou próxima da média, e a perícia confirmou que foi exatamente a taxa aplicada nas parcelas.',
      fonte: 'Laudo pericial · Banco Central, série 20749',
    },
    {
      cor: cores.verde,
      selo: 'Permitida',
      titulo: 'Cobrada no início do relacionamento',
      texto:
        'Contratos firmados depois de 30/04/2008 podem cobrar tarifa de cadastro no início do relacionamento com o banco. A perícia não considerou a cobrança indevida.',
      fonte: 'STJ, Súmula 566',
    },
    {
      cor: cores.verde,
      selo: 'Permitido',
      titulo: 'Imposto financiado junto',
      texto:
        'O IOF pode ser financiado com o crédito, desde que informado. Aqui ele aparece separado, com o valor exato.',
      fonte: 'STJ, Tema 621',
    },
    {
      cor: cores.amarelo,
      selo: 'Verificar',
      titulo: 'Tabela Price sem nome no contrato',
      texto:
        'O contrato não cita o sistema de amortização pelo nome, mas as parcelas fixas indicam a tabela Price. Com as parcelas pagas em dia, a perícia não encontrou juros sobre juros.',
      fonte: 'Laudo pericial · quesito 1',
    },
    {
      cor: cores.vermelho,
      selo: 'Atenção',
      titulo: 'Encargos de atraso somados',
      texto:
        'O contrato previa comissão de permanência junto com multa e juros de mora. Nas parcelas pagas com atraso, a comissão variou de 3% a 9% ao mês, acima da taxa do contrato.',
      fonte: 'STJ, Súmula 472',
    },
  ];
  return pontos;
}

/** Seção "Nota de confiabilidade" (montanha): valores de referência e as frases de cada faixa de nota. */
export function conteudoDaMontanha() {
  const conteudo = {
    referencia: { taxa: 2.4, cet: 2.9, encargos: 3950 },
    situacoes: ['Pontos que merecem atenção', 'Comparando com referências', 'Consistente com as referências'],
  };
  return conteudo;
}

/** Seção "Antes × depois". Se mudar estes números, mude também os textos fixos da seção no index.html. */
export function conteudoDoAntesDepois() {
  const conteudo = {
    financiado: 719000,
    parcelas: 48,
    original: { juros: 0.028, encargos: 59700 },
    ajustado: { juros: 0.024, encargos: 36400 },
    carro: {
      nome: 'Audi RS6 Avant 2026',
      resumo: 'R$ 1.198.549 (FIPE out/2026) · R$ 719.000 financiados em 48 parcelas',
      dica: 'Arraste para girar · role ou use dois dedos para aproximar',
    },
  };
  return conteudo;
}

/** Seção "Você assinaria?" (quiz): as frases da correção e do resultado. */
export function conteudoDoQuiz() {
  const conteudo = {
    acertou: 'Acertou.',
    errou: 'Não é bem assim.',
    regraAbusiva: ' Em regra, é abusiva.',
    regraPermitida: ' Em regra, é permitido.',
    todasCertas: 'Você leu bem as cláusulas.',
    algumaErrada: 'É por isso que uma leitura assistida ajuda.',
  };
  return conteudo;
}

/** Glossário: o primeiro uso de cada termo na página ganha esta explicação ao passar o mouse. */
export function conteudoDoGlossario() {
  const termos = [
    {
      termo: 'Custo Efetivo Total',
      titulo: 'Custo Efetivo Total (CET)',
      explicacao:
        'Soma de juros, tarifas, seguros e impostos do contrato, expressa como taxa. Serve para comparar propostas (Resolução CMN 3.517/2007).',
    },
    {
      termo: 'venda casada',
      titulo: 'Venda casada',
      explicacao: 'Condicionar um produto ou serviço à compra de outro. Proibida pelo CDC, art. 39, I.',
    },
    {
      termo: 'IOF',
      titulo: 'IOF',
      explicacao:
        'Imposto sobre Operações Financeiras, cobrado pelo governo federal sobre o crédito. Pode ser financiado junto com as parcelas.',
    },
    { termo: 'CDC', titulo: 'CDC', explicacao: 'Código de Defesa do Consumidor, Lei 8.078/1990.' },
    {
      termo: 'seguro prestamista',
      titulo: 'Seguro prestamista',
      explicacao:
        'Seguro que quita a dívida em caso de morte ou invalidez. Pode ser oferecido, mas não imposto com a seguradora do banco (STJ, Tema 972).',
    },
    {
      termo: 'Súmula',
      titulo: 'Súmula',
      explicacao: 'Resumo de entendimento consolidado de um tribunal, usado como referência em casos parecidos.',
    },
    {
      termo: 'tabela Price',
      titulo: 'Tabela Price',
      explicacao: 'Sistema de amortização com parcelas iguais: no começo a maior parte da parcela é juros.',
    },
  ];
  return termos;
}
