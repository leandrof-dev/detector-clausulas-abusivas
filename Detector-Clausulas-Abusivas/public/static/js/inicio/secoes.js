/* Interações de cada seção da página inicial, na ordem em que aparecem:
   iceberg (camadas) · caso real · apontamentos · montanha (controle e nota) · antes × depois · quiz ·
   rodapé · glossário. As partes 3D ficam em iceberg.js, montanha.js e carro-comparacao.js. */
import {
  conteudoDaMontanha,
  conteudoDoAntesDepois,
  conteudoDoCasoReal,
  conteudoDoGlossario,
  conteudoDoIceberg,
  conteudoDoQuiz,
} from './conteudo.js';
import {
  formatarDecimal,
  formatarReais,
  limitar,
  movimentoReduzido,
  parcelaPrice,
  suave,
} from '../comum/utilidades.js';

/* ---------- contador animado: o número "corre" do valor atual até o novo ---------- */

/** Curva que desacelera no fim. */
function desacelerar(k) {
  const valor = 1 - Math.pow(1 - k, 3);
  return valor;
}

/** Cria a função que anima números; ela lembra o valor atual de cada elemento. */
function criarAnimadorDeNumeros() {
  const estados = new WeakMap();
  const animar = (elemento, valorFinal, formatar, duracao) => {
    const estado = estados.get(elemento) || { atual: valorFinal, pedido: 0 };
    const valorInicial = estado.atual;
    const inicio = performance.now();
    const passo = (tempo) => {
      const k = Math.min(1, (tempo - inicio) / duracao);
      estado.atual = valorInicial + (valorFinal - valorInicial) * desacelerar(k);
      elemento.textContent = formatar(estado.atual);
      if (k < 1) estado.pedido = requestAnimationFrame(passo);
    };
    estados.set(elemento, estado);
    cancelAnimationFrame(estado.pedido);
    estado.pedido = requestAnimationFrame(passo);
  };
  return animar;
}

/* ---------- iceberg: as camadas escondidas aparecem com a rolagem (e voltam a esconder ao subir) ---------- */

function conferirCamadas(quadro, escondidas, animarNumero) {
  // quanto do quadro já entrou na tela (1 = inteiro) para abrir cada camada; ao fechar há uma folga de 0,15
  const limites = [0.42, 0.62, 0.82];
  const caixa = quadro.getBoundingClientRect();
  const visivel = (innerHeight - caixa.top) / caixa.height;
  escondidas.forEach((item, indice) => {
    const aberta = item.aberta ? visivel > limites[indice] - 0.15 : visivel > limites[indice];
    if (aberta !== item.aberta) {
      item.aberta = aberta;
      item.camada.classList.toggle('escondida', !aberta);
      item.legenda.textContent = aberta ? 'revelado pela leitura' : 'oculto';
      animarNumero(item.numero, aberta ? item.valor : 0, (valor) => '+ ' + formatarReais(valor), 900);
    }
  });
}

function iniciarCamadasDoIceberg(animarNumero) {
  const quadro = document.getElementById('iceberg');
  const conteudo = conteudoDoIceberg();
  const camadas = [...quadro.querySelectorAll('.camada')];
  const valorVisivel = document.createElement('em');
  const pedido = { id: 0 };
  const escondidas = camadas.slice(1).map((camada, indice) => {
    const numero = document.createElement('em');
    camada.querySelector('span').append(numero);
    camada.classList.add('escondida');
    numero.textContent = '+ R$ 0';
    return {
      camada,
      numero,
      legenda: camada.querySelector('small'),
      valor: conteudo.escondidos[indice],
      aberta: false,
    };
  });

  valorVisivel.textContent = formatarReais(conteudo.parcela);
  camadas[0].querySelector('span').append(valorVisivel);
  addEventListener(
    'scroll',
    () => {
      if (!pedido.id) {
        pedido.id = requestAnimationFrame(() => {
          pedido.id = 0;
          conferirCamadas(quadro, escondidas, animarNumero);
        });
      }
    },
    { passive: true },
  );
  conferirCamadas(quadro, escondidas, animarNumero);
}

/* ---------- caso real: passar o mouse (ou tocar) num ponto do contrato mostra a explicação ---------- */

function mostrarPontoDoContrato(estado, indice) {
  if (indice !== estado.atual) {
    const ponto = estado.pontos[indice];
    const selo = document.createElement('span');
    const titulo = document.createElement('b');
    const texto = document.createElement('p');
    const fonte = document.createElement('small');
    estado.atual = indice;
    estado.botoes.forEach((botao, posicao) => botao.classList.toggle('ativo', posicao === indice));
    selo.className = 'selo-cheio';
    selo.textContent = ponto.selo;
    titulo.textContent = ponto.titulo;
    texto.textContent = ponto.texto;
    fonte.textContent = ponto.fonte;
    estado.explicacao.style.setProperty('--cor-ponto', ponto.cor);
    estado.explicacao.replaceChildren(selo, titulo, texto, fonte);
  }
}

function iniciarCasoReal() {
  const lista = document.getElementById('pontos-contrato');
  const estado = {
    pontos: conteudoDoCasoReal(),
    botoes: [...lista.querySelectorAll('.ponto')],
    explicacao: document.getElementById('explicacao'),
    atual: -1,
  };
  estado.botoes.forEach((botao, indice) => {
    botao.style.setProperty('--cor-ponto', estado.pontos[indice].cor);
    botao.querySelector('.ponto-selo').textContent = estado.pontos[indice].selo;
    ['mouseenter', 'focus', 'click'].forEach((tipo) =>
      botao.addEventListener(tipo, () => mostrarPontoDoContrato(estado, indice)),
    );
  });
  mostrarPontoDoContrato(estado, 4); // começa mostrando o ponto de atenção
}

/* ---------- apontamentos: um destaque percorre a lista sozinho; com o mouse em cima, a pessoa assume ---------- */

/** A barrinha lateral acompanha a linha destacada. */
function posicionarMarcadorLateral(estado) {
  const linha = estado.linhas[estado.atual];
  if (linha) {
    estado.marcador.style.top = linha.offsetTop + 'px';
    estado.marcador.style.height = linha.offsetHeight + 'px';
  }
}

function destacarApontamento(estado, indice) {
  estado.atual = indice;
  estado.linhas.forEach((linha, posicao) => linha.classList.toggle('ativo', posicao === indice));
  estado.linhas[indice].classList.add('vista');
  estado.contador.textContent = 'Conferindo ' + (indice + 1) + ' de ' + estado.linhas.length;
  posicionarMarcadorLateral(estado);
  clearTimeout(estado.ajusteAtrasado);
  // de novo depois que a linha termina de abrir
  estado.ajusteAtrasado = setTimeout(() => posicionarMarcadorLateral(estado), 480);
}

function iniciarApontamentos() {
  const cartao = document.getElementById('apontamentos');
  const estado = {
    linhas: [...cartao.querySelectorAll('.lista-apontamentos > .linha')],
    marcador: cartao.querySelector('.marcador-lateral'),
    contador: document.getElementById('contador'),
    atual: -1,
    mouseEmCima: false,
    visivel: false,
    ajusteAtrasado: 0,
  };
  estado.linhas.forEach((linha, indice) =>
    linha.addEventListener('mouseenter', () => {
      estado.mouseEmCima = true;
      destacarApontamento(estado, indice);
    }),
  );
  cartao.addEventListener('mouseleave', () => {
    estado.mouseEmCima = false;
  });
  new IntersectionObserver(
    (entradas) => {
      estado.visivel = entradas[0].isIntersecting;
      if (estado.visivel && estado.atual < 0) setTimeout(() => destacarApontamento(estado, 0), 700);
    },
    { threshold: 0.35 },
  ).observe(cartao);
  if (!movimentoReduzido()) {
    setInterval(() => {
      if (estado.visivel && !estado.mouseEmCima && estado.atual >= 0) {
        destacarApontamento(estado, (estado.atual + 1) % estado.linhas.length);
      }
    }, 2300);
  }
  addEventListener('resize', () => posicionarMarcadorLateral(estado));
}

/* ---------- montanha: rolar a página (ou arrastar o controle) afasta o contrato da curva ----------
   distância 0 = perto da curva (nota alta) · 1 = longe (nota baixa). A cena 3D (montanha.js) recebe
   a distância e a cor pelo evento "mudou-distancia". */

/** Cor da nota: vermelho abaixo de 45, roxo abaixo de 75, verde daí em diante. */
function corDaNota(nota) {
  const cor = nota < 45 ? '#ff5566' : nota < 75 ? '#b496ff' : '#3ff0a6';
  return cor;
}

function mostrarDistancia(estado, distancia) {
  if (Math.abs(distancia - estado.distanciaAtual) >= 0.0004) {
    const { referencia, situacoes } = estado.conteudo;
    const campos = estado.campos;
    const nota = Math.round(96 - distancia * 68);
    const cor = corDaNota(nota);
    const taxa = referencia.taxa + distancia * 1.5;
    const cet = referencia.cet + distancia * 1.55;
    const encargos = referencia.encargos + distancia * 5200;
    estado.distanciaAtual = distancia;
    estado.controle.setAttribute('aria-valuenow', Math.round(distancia * 100));
    estado.controle.style.setProperty('--valor', distancia.toFixed(4));
    estado.dica.style.opacity = distancia > 0.06 ? 0 : 1;
    estado.secao.style.setProperty('--cor-nota', cor);
    estado.secao.dataset.distancia = distancia;
    campos.placarNota.textContent = nota + '%';
    campos.folhaNota.textContent = nota + '%';
    campos.situacao.textContent = situacoes[nota < 45 ? 0 : nota < 75 ? 1 : 2];
    campos.barraNota.style.width = nota + '%';
    campos.valorTaxa.textContent = formatarDecimal(taxa, 1) + '% × ' + formatarDecimal(referencia.taxa, 1) + '%';
    campos.valorCet.textContent = formatarDecimal(cet, 1) + '% × ' + formatarDecimal(referencia.cet, 1) + '%';
    campos.valorEncargos.textContent = formatarReais(encargos) + ' × ' + formatarReais(referencia.encargos);
    campos.barraTaxa.style.width = Math.min(100, ((68 * taxa) / referencia.taxa) * 0.97) + '%';
    campos.barraCet.style.width = Math.min(100, ((64 * cet) / referencia.cet) * 0.97) + '%';
    campos.barraEncargos.style.width = Math.min(100, ((48 * encargos) / referencia.encargos) * 0.97) + '%';
    estado.secao.dispatchEvent(new CustomEvent('mudou-distancia', { detail: { distancia, cor } }));
  }
}

/** Distância pela posição da rolagem. No computador com tela alta a seção fica "presa" (ver #nota no CSS). */
function distanciaPelaRolagem(estado) {
  const alturaTela = innerHeight;
  let distancia;
  if (estado.telaGrande.matches) {
    const caixa = estado.secao.getBoundingClientRect();
    distancia = suave(limitar((-caixa.top / Math.max(1, caixa.height - alturaTela) - 0.06) / 0.82));
  } else {
    const caixa = estado.cartao.getBoundingClientRect();
    distancia = suave(limitar((alturaTela * 0.85 - caixa.top) / (alturaTela * 0.65)));
  }
  return distancia;
}

function aoRolarNaMontanha(estado) {
  estado.pedido = 0;
  if (estado.ajusteManual && Math.abs(scrollY - estado.rolagemNoAjuste) >= 60) {
    estado.ajusteManual = false;
  }
  if (!estado.ajusteManual) {
    mostrarDistancia(estado, distanciaPelaRolagem(estado));
  }
}

/** Arrastar o controle: no computador rola a página até o ponto equivalente (rolagem e controle sempre
    concordam); no celular ajusta direto, até a pessoa rolar de novo. */
function irParaDistancia(estado, pedida) {
  const distancia = limitar(pedida);
  if (estado.telaGrande.matches) {
    const topo = estado.secao.getBoundingClientRect().top + scrollY;
    const x = 0.5 - Math.sin(Math.asin(1 - 2 * distancia) / 3); // inverso da curva suave
    scrollTo({ top: topo + (0.06 + 0.82 * x) * (estado.secao.offsetHeight - innerHeight), behavior: 'instant' });
  } else {
    estado.ajusteManual = true;
    estado.rolagemNoAjuste = scrollY;
  }
  mostrarDistancia(estado, distancia);
}

function irParaPosicaoDoMouse(estado, x) {
  const caixa = estado.controle.getBoundingClientRect();
  irParaDistancia(estado, (x - caixa.left) / caixa.width);
}

/** Teclado: setas andam 5%, PageUp/PageDown 20%, Home/End vão às pontas. */
function moverPeloTeclado(estado, evento) {
  const passos = { ArrowRight: 0.05, ArrowUp: 0.05, ArrowLeft: -0.05, ArrowDown: -0.05, PageUp: 0.2, PageDown: -0.2 };
  const passo = passos[evento.key];
  if (evento.key === 'Home') {
    irParaDistancia(estado, 0);
  } else if (evento.key === 'End') {
    irParaDistancia(estado, 1);
  } else if (passo != null) {
    irParaDistancia(estado, estado.distanciaAtual + passo);
  }
  if (evento.key === 'Home' || evento.key === 'End' || passo != null) {
    evento.preventDefault();
  }
}

function elementosDaMontanha() {
  const campo = (id) => document.getElementById(id);
  const campos = {
    placarNota: campo('placar-nota'),
    folhaNota: campo('folha-nota'),
    situacao: campo('placar-situacao'),
    barraNota: campo('barra-nota-cheia'),
    valorTaxa: campo('valor-taxa'),
    valorCet: campo('valor-cet'),
    valorEncargos: campo('valor-encargos'),
    barraTaxa: campo('barra-taxa'),
    barraCet: campo('barra-cet'),
    barraEncargos: campo('barra-encargos'),
  };
  return campos;
}

function iniciarControleDaMontanha() {
  const estado = {
    secao: document.getElementById('nota'),
    controle: document.getElementById('controle'),
    dica: document.getElementById('dica-rolar'),
    cartao: document.getElementById('cartao-montanha'),
    campos: elementosDaMontanha(),
    conteudo: conteudoDaMontanha(),
    // computador com tela alta: a seção fica "presa" na tela enquanto a página rola
    telaGrande: matchMedia('(min-width: 901px) and (min-height: 560px)'),
    distanciaAtual: -1,
    pedido: 0,
    ajusteManual: false, // no celular o controle manda até a pessoa rolar de novo
    rolagemNoAjuste: 0,
  };
  const controle = estado.controle;

  controle.addEventListener('pointerdown', (evento) => {
    controle.setPointerCapture(evento.pointerId);
    controle.classList.add('arrastando');
    irParaPosicaoDoMouse(estado, evento.clientX);
    evento.preventDefault();
  });
  controle.addEventListener('pointermove', (evento) => {
    if (controle.hasPointerCapture(evento.pointerId)) irParaPosicaoDoMouse(estado, evento.clientX);
  });
  ['pointerup', 'pointercancel'].forEach((tipo) =>
    controle.addEventListener(tipo, () => controle.classList.remove('arrastando')),
  );
  controle.addEventListener('keydown', (evento) => moverPeloTeclado(estado, evento));
  addEventListener(
    'scroll',
    () => {
      if (!estado.pedido) estado.pedido = requestAnimationFrame(() => aoRolarNaMontanha(estado));
    },
    { passive: true },
  );
  addEventListener('resize', () => aoRolarNaMontanha(estado));
  estado.telaGrande.addEventListener('change', () => aoRolarNaMontanha(estado));
  mostrarDistancia(estado, distanciaPelaRolagem(estado));
}

/* ---------- antes × depois: divisória arrastável + parcelas calculadas pela tabela Price ---------- */

function mostrarParcelasETotais(comparador, conteudo) {
  const totais = {};
  [
    ['original', conteudo.original],
    ['ajustado', conteudo.ajustado],
  ].forEach(([lado, contrato]) => {
    const parcela = parcelaPrice(conteudo.financiado + contrato.encargos, contrato.juros, conteudo.parcelas);
    const quantidade = document.createElement('span');
    const campoParcela = comparador.querySelector(`.${lado} [data-campo=parcela]`);
    quantidade.className = 'parcelas-qtd';
    quantidade.textContent = `${conteudo.parcelas} × `;
    campoParcela.replaceChildren(quantidade, formatarReais(parcela));
    comparador.querySelector(`.${lado} [data-campo=total]`).textContent = formatarReais(parcela * conteudo.parcelas);
    totais[lado] = parcela * conteudo.parcelas;
  });
  document.getElementById('economia-valor').textContent = formatarReais(totais.original - totais.ajustado);
}

/** Ao aparecer, a divisória "espia" os dois lados uma vez, mostrando que dá para arrastar. */
function espiarOsDoisLados(estado) {
  const observador = new IntersectionObserver(
    (entradas) => {
      if (entradas[0].isIntersecting) {
        const inicio = performance.now();
        const passo = (tempo) => {
          if (estado.espiando) {
            const k = Math.min(1, (tempo - inicio) / 2200);
            const balanco = Math.sin(k * Math.PI * 2) * 24 * (1 - k * 0.3); // vai e volta, cada vez menor
            estado.divisoria.value = (estado.posicaoInicial + balanco).toFixed(1);
            if (k >= 1) estado.divisoria.value = estado.posicaoInicial;
            estado.atualizar();
            if (k < 1) requestAnimationFrame(passo);
          }
        };
        observador.disconnect();
        setTimeout(() => requestAnimationFrame(passo), 600);
      }
    },
    { threshold: 0.6 },
  );
  observador.observe(estado.comparador);
}

function iniciarAntesDepois() {
  const comparador = document.getElementById('comparador');
  const divisoria = comparador.querySelector('input');
  const estado = {
    comparador,
    divisoria,
    posicaoInicial: innerWidth < 600 ? 64 : 50, // no celular começa mais à direita
    espiando: true,
    atualizar: () => comparador.style.setProperty('--divisoria', divisoria.value + '%'),
  };
  divisoria.value = estado.posicaoInicial;
  divisoria.addEventListener('input', () => {
    estado.espiando = false;
    estado.atualizar();
  });
  estado.atualizar();
  mostrarParcelasETotais(comparador, conteudoDoAntesDepois());
  if (!movimentoReduzido()) espiarOsDoisLados(estado);
}

/* ---------- quiz "Abusiva ou não?": cada pergunta tem data-resposta com a resposta certa ---------- */

function responderPergunta(estado, pergunta, botao) {
  if (!pergunta.classList.contains('respondida')) {
    const textos = estado.textos;
    const total = estado.perguntas.length;
    const acertou = botao.dataset.resposta === pergunta.dataset.resposta;
    pergunta.classList.add('respondida', acertou ? 'certa' : 'errada');
    botao.classList.add('escolhida');
    pergunta.querySelectorAll('.opcoes button').forEach((opcao) => {
      opcao.disabled = true;
    });
    pergunta.querySelector('.resposta em').textContent =
      (acertou ? textos.acertou : textos.errou) +
      (pergunta.dataset.resposta === 'abusiva' ? textos.regraAbusiva : textos.regraPermitida);
    estado.respondidas += 1;
    if (acertou) estado.certas += 1;
    estado.placar.textContent =
      estado.respondidas < total
        ? `${estado.certas} de ${estado.respondidas} certas até agora`
        : `Resultado: ${estado.certas} de ${total}. ` +
          (estado.certas === total ? textos.todasCertas : textos.algumaErrada);
    estado.refazer.hidden = estado.respondidas < total;
  }
}

function recomecarQuiz(estado) {
  estado.respondidas = 0;
  estado.certas = 0;
  estado.perguntas.forEach((pergunta) => {
    pergunta.classList.remove('respondida', 'certa', 'errada');
    pergunta.querySelectorAll('.opcoes button').forEach((opcao) => {
      opcao.disabled = false;
      opcao.classList.remove('escolhida');
    });
  });
  estado.placar.textContent = '';
  estado.refazer.hidden = true;
}

function iniciarQuiz() {
  const quiz = document.getElementById('quiz');
  const estado = {
    perguntas: [...quiz.querySelectorAll('.pergunta')],
    placar: quiz.querySelector('.quiz-placar'),
    refazer: quiz.querySelector('.refazer'),
    textos: conteudoDoQuiz(),
    respondidas: 0,
    certas: 0,
  };
  estado.perguntas.forEach((pergunta) =>
    pergunta
      .querySelectorAll('.opcoes button')
      .forEach((botao) => botao.addEventListener('click', () => responderPergunta(estado, pergunta, botao))),
  );
  estado.refazer.addEventListener('click', () => recomecarQuiz(estado));
}

/* ---------- rodapé: "Início" volta ao começo; links "#" ainda não têm destino ---------- */
function iniciarRodape() {
  document.querySelectorAll('.rodape a').forEach((link) =>
    link.addEventListener('click', (evento) => {
      if (link.hasAttribute('data-topo')) {
        evento.preventDefault();
        scrollTo({ top: 0, behavior: 'smooth' });
      } else if (link.getAttribute('href') === '#') {
        evento.preventDefault();
      }
    }),
  );
}

/* ---------- glossário: o primeiro uso de cada termo vira <span class="termo"> com explicação ao passar o mouse ---------- */

/** O termo do glossário que aparece primeiro neste pedaço de texto (siglas em maiúsculas diferenciam maiúsculas). */
function primeiroTermo(texto, glossario, jaMarcados) {
  let melhor = null;
  glossario.forEach((item) => {
    if (!jaMarcados.has(item.termo)) {
      const sigla = item.termo === item.termo.toUpperCase();
      const achado = texto.match(new RegExp('\\b' + item.termo + '\\b', sigla ? '' : 'i'));
      if (achado && (!melhor || achado.index < melhor.achado.index)) melhor = { item, achado };
    }
  });
  return melhor;
}

/** Procura os termos dentro de um trecho da página e marca o primeiro uso de cada um. */
function marcarTermos(raiz, glossario, jaMarcados) {
  const percorrer = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  const fila = [];
  while (percorrer.nextNode()) fila.push(percorrer.currentNode);
  while (fila.length) {
    const no = fila.shift();
    const melhor = primeiroTermo(no.textContent, glossario, jaMarcados);
    if (melhor) {
      const trecho = no.splitText(melhor.achado.index);
      const resto = trecho.splitText(melhor.achado[0].length);
      const marcado = document.createElement('span');
      jaMarcados.add(melhor.item.termo);
      marcado.className = 'termo';
      marcado.tabIndex = 0;
      marcado.dataset.titulo = melhor.item.titulo;
      marcado.dataset.explicacao = melhor.item.explicacao;
      marcado.textContent = trecho.textContent;
      trecho.replaceWith(marcado);
      fila.unshift(no, resto); // continua procurando no que sobrou antes e depois do termo
    }
  }
}

function mostrarBalao(balao, termo) {
  const caixa = termo.getBoundingClientRect();
  const titulo = document.createElement('b');
  titulo.textContent = termo.dataset.titulo;
  balao.replaceChildren(titulo, termo.dataset.explicacao);
  balao.classList.add('ativo');
  const largura = balao.offsetWidth;
  const altura = balao.offsetHeight;
  const x = Math.min(innerWidth - largura - 12, Math.max(12, caixa.left + caixa.width / 2 - largura / 2));
  const y = caixa.top - altura - 10 < 10 ? caixa.bottom + 10 : caixa.top - altura - 10; // sem espaço acima: embaixo
  balao.style.transform = `translate(${x}px,${y}px)`;
}

function iniciarGlossario() {
  const balao = document.createElement('div');
  const glossario = conteudoDoGlossario();
  const jaMarcados = new Set();
  const esconder = () => balao.classList.remove('ativo');
  // só procura termos nestes textos
  const trechos = document.querySelectorAll(
    '#pagina .subtitulo, #pagina .passo small, #pagina .linha > span, #pagina .pergunta > p, #pagina .resposta p, #pagina .observacao, #pagina .selo',
  );

  balao.id = 'balao-termo';
  balao.setAttribute('role', 'tooltip');
  document.body.append(balao);
  trechos.forEach((trecho) => marcarTermos(trecho, glossario, jaMarcados));
  document.querySelectorAll('.termo').forEach((termo) => {
    termo.addEventListener('mouseenter', () => mostrarBalao(balao, termo));
    termo.addEventListener('focus', () => mostrarBalao(balao, termo));
    termo.addEventListener('mouseleave', esconder);
    termo.addEventListener('blur', esconder);
  });
  addEventListener('scroll', esconder, { passive: true });
}

/** Liga as interações de todas as seções. */
export function iniciarSecoes() {
  iniciarCamadasDoIceberg(criarAnimadorDeNumeros());
  iniciarCasoReal();
  iniciarApontamentos();
  iniciarControleDaMontanha();
  iniciarRodape();
  iniciarAntesDepois();
  iniciarQuiz();
  iniciarGlossario();
}
