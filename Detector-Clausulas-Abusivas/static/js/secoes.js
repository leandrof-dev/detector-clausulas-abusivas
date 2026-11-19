/* Interações de cada seção da página, na ordem em que aparecem:
   iceberg (faixas) · caso real · apontamentos · montanha (controle) · rodapé · antes × depois · quiz ·
   lista de espera · glossário. As partes 3D ficam em iceberg.js, montanha.js e carro-comparacao.js. */
import { ANTES_DEPOIS, CASO_REAL, GLOSSARIO, ICEBERG, MONTANHA, QUIZ } from './conteudo.js';
import { formatarDecimal, formatarReais, limitar, movimentoReduzido, parcelaPrice, suave } from './util.js';

/* contador animado: o número "corre" do valor atual até o novo */
const desacelerar = (k) => 1 - Math.pow(1 - k, 3);
const contadores = new WeakMap();
function animarNumero(elemento, valorFinal, formatar, duracao = 480) {
  const estado = contadores.get(elemento) || { atual: valorFinal };
  contadores.set(elemento, estado);
  const valorInicial = estado.atual;
  const inicio = performance.now();
  cancelAnimationFrame(estado.pedido);
  const passo = (tempo) => {
    const k = Math.min(1, (tempo - inicio) / duracao);
    estado.atual = valorInicial + (valorFinal - valorInicial) * desacelerar(k);
    elemento.textContent = formatar(estado.atual);
    if (k < 1) estado.pedido = requestAnimationFrame(passo);
  };
  estado.pedido = requestAnimationFrame(passo);
}

/* ---------- iceberg: as faixas escondidas aparecem com a rolagem (e voltam a esconder ao subir) ---------- */
function iniciarIceberg() {
  const quadro = document.getElementById('ice');
  if (!quadro) return;
  const faixas = [...quadro.querySelectorAll('.bd')];
  const valorVisivel = document.createElement('em');
  valorVisivel.textContent = formatarReais(ICEBERG.parcela);
  faixas[0].querySelector('span').append(valorVisivel);
  const escondidas = faixas.slice(1).map((faixa, i) => {
    const numero = document.createElement('em');
    faixa.querySelector('span').append(numero);
    faixa.classList.add('hid');
    numero.textContent = '+ R$ 0';
    return { faixa, numero, legenda: faixa.querySelector('small'), valor: ICEBERG.escondidos[i], aberta: false };
  });
  // quanto do quadro já entrou na tela (1 = inteiro) para abrir cada faixa; ao fechar há uma folga de 0,15 para não piscar
  const LIMITES = [0.42, 0.62, 0.82];
  let pedido = 0;
  function conferirFaixas() {
    pedido = 0;
    const caixa = quadro.getBoundingClientRect();
    const visivel = (innerHeight - caixa.top) / caixa.height;
    escondidas.forEach((item, i) => {
      const aberta = item.aberta ? visivel > LIMITES[i] - 0.15 : visivel > LIMITES[i];
      if (aberta === item.aberta) return;
      item.aberta = aberta;
      item.faixa.classList.toggle('hid', !aberta);
      item.legenda.textContent = aberta ? 'revelado pela leitura' : 'oculto';
      animarNumero(item.numero, aberta ? item.valor : 0, (valor) => '+ ' + formatarReais(valor), 900);
    });
  }
  addEventListener(
    'scroll',
    () => {
      pedido || (pedido = requestAnimationFrame(conferirFaixas));
    },
    { passive: true },
  );
  conferirFaixas();
}

/* ---------- caso real: passar o mouse (ou tocar) num ponto do contrato mostra a explicação ---------- */
function iniciarCasoReal() {
  const lista = document.getElementById('ppr');
  const explicacao = document.getElementById('xpl');
  if (!lista) return;
  const botoes = [...lista.querySelectorAll('.cl')];
  let atual = -1;
  const mostrar = (i) => {
    if (i === atual) return;
    atual = i;
    botoes.forEach((botao, j) => botao.classList.toggle('on', j === i));
    const ponto = CASO_REAL[i];
    explicacao.style.setProperty('--q', ponto.cor);
    explicacao.innerHTML = `<span class='bdg'>${ponto.selo}</span><b>${ponto.titulo}</b><p>${ponto.texto}</p><small>${ponto.fonte}</small>`;
  };
  botoes.forEach((botao, i) => {
    botao.style.setProperty('--q', CASO_REAL[i].cor);
    botao.querySelector('s').textContent = CASO_REAL[i].selo;
    ['mouseenter', 'focus', 'click'].forEach((tipo) => botao.addEventListener(tipo, () => mostrar(i)));
  });
  mostrar(4); // começa mostrando o ponto de atenção
}

/* ---------- apontamentos: um destaque percorre a lista sozinho; com o mouse em cima, a pessoa assume ---------- */
function iniciarApontamentos() {
  const cartao = document.getElementById('ap');
  if (!cartao) return;
  const linhas = [...cartao.querySelectorAll('.apl>.rw')];
  const marcador = cartao.querySelector('.bar3');
  const contador = document.getElementById('apc');
  let atual = -1;
  let mouseEmCima = false;
  let visivel = false;
  let ajusteAtrasado = 0;
  // a barrinha lateral acompanha a linha destacada (de novo depois que a linha termina de abrir)
  const posicionarMarcador = () => {
    const linha = linhas[atual];
    if (!linha) return;
    marcador.style.top = linha.offsetTop + 'px';
    marcador.style.height = linha.offsetHeight + 'px';
  };
  const destacar = (k) => {
    atual = k;
    linhas.forEach((linha, j) => linha.classList.toggle('on', j === k));
    linhas[k].classList.add('seen');
    contador.textContent = 'Conferindo ' + (k + 1) + ' de ' + linhas.length;
    posicionarMarcador();
    clearTimeout(ajusteAtrasado);
    ajusteAtrasado = setTimeout(posicionarMarcador, 480);
  };
  linhas.forEach((linha, j) =>
    linha.addEventListener('mouseenter', () => {
      mouseEmCima = true;
      destacar(j);
    }),
  );
  cartao.addEventListener('mouseleave', () => {
    mouseEmCima = false;
  });
  new IntersectionObserver(
    (entradas) => {
      visivel = entradas[0].isIntersecting;
      if (visivel && atual < 0) setTimeout(() => destacar(0), 700);
    },
    { threshold: 0.35 },
  ).observe(cartao);
  if (!movimentoReduzido)
    setInterval(() => {
      if (visivel && !mouseEmCima && atual >= 0) destacar((atual + 1) % linhas.length);
    }, 2300);
  addEventListener('resize', posicionarMarcador);
}

/* ---------- montanha: rolar a página (ou arrastar o controle) afasta o contrato da curva ----------
   distância 0 = perto da curva (nota alta) · 1 = longe (nota baixa). A cena 3D (montanha.js) recebe
   a distância pelo evento "meter". */
function iniciarMontanha() {
  const secao = document.getElementById('nb');
  const controle = document.getElementById('rt');
  const dica = document.getElementById('mh');
  const cartao = document.getElementById('mt');
  const campo = (id) => document.getElementById(id);
  const ref = MONTANHA.referencia;
  // computador com tela alta: a seção fica "presa" na tela enquanto a página rola (ver #nb no CSS)
  const telaGrande = matchMedia('(min-width:901px) and (min-height:560px)');
  let distanciaAtual = -1;

  function mostrarDistancia(distancia) {
    if (Math.abs(distancia - distanciaAtual) < 0.0004) return;
    distanciaAtual = distancia;
    controle.setAttribute('aria-valuenow', Math.round(distancia * 100));
    controle.style.setProperty('--v', distancia.toFixed(4));
    dica.style.opacity = distancia > 0.06 ? 0 : 1;
    const nota = Math.round(96 - distancia * 68);
    secao.style.setProperty('--c', nota < 45 ? '#ff5566' : nota < 75 ? '#b496ff' : '#3ff0a6');
    campo('sc').textContent = nota + '%';
    campo('pc').textContent = nota + '%';
    campo('st').textContent = MONTANHA.situacoes[nota < 45 ? 0 : nota < 75 ? 1 : 2];
    campo('fl').style.width = nota + '%';
    const taxa = ref.taxa + distancia * 1.5;
    const cet = ref.cet + distancia * 1.55;
    const encargos = ref.encargos + distancia * 5200;
    campo('p1').textContent = formatarDecimal(taxa, 1) + '% × ' + formatarDecimal(ref.taxa, 1) + '%';
    campo('p2').textContent = formatarDecimal(cet, 1) + '% × ' + formatarDecimal(ref.cet, 1) + '%';
    campo('p3').textContent = formatarReais(encargos) + ' × ' + formatarReais(ref.encargos);
    campo('b1').style.width = Math.min(100, ((68 * taxa) / ref.taxa) * 0.97) + '%';
    campo('b2').style.width = Math.min(100, ((64 * cet) / ref.cet) * 0.97) + '%';
    campo('b3').style.width = Math.min(100, ((48 * encargos) / ref.encargos) * 0.97) + '%';
    secao.dispatchEvent(new CustomEvent('meter', { detail: distancia }));
  }

  // distância pela posição da rolagem
  function distanciaPelaRolagem() {
    const alturaTela = innerHeight;
    if (telaGrande.matches) {
      const caixa = secao.getBoundingClientRect();
      return suave(limitar((-caixa.top / Math.max(1, caixa.height - alturaTela) - 0.06) / 0.82));
    }
    const caixa = cartao.getBoundingClientRect();
    return suave(limitar((alturaTela * 0.85 - caixa.top) / (alturaTela * 0.65)));
  }

  let pedido = 0;
  let ajusteManual = false; // no celular o controle manda até a pessoa rolar de novo
  let rolagemNoAjuste = 0;
  const aoRolar = () => {
    pedido = 0;
    if (ajusteManual) {
      if (Math.abs(scrollY - rolagemNoAjuste) < 60) return;
      ajusteManual = false;
    }
    mostrarDistancia(distanciaPelaRolagem());
  };

  // arrastar o controle: no computador rola a página até o ponto equivalente (rolagem e controle sempre concordam);
  // no celular ajusta direto
  function irPara(distancia) {
    distancia = limitar(distancia);
    if (telaGrande.matches) {
      const topo = secao.getBoundingClientRect().top + scrollY;
      const x = 0.5 - Math.sin(Math.asin(1 - 2 * distancia) / 3); // inverso da curva suave
      scrollTo({ top: topo + (0.06 + 0.82 * x) * (secao.offsetHeight - innerHeight), behavior: 'instant' });
    } else {
      ajusteManual = true;
      rolagemNoAjuste = scrollY;
    }
    mostrarDistancia(distancia);
  }
  const irParaPosicaoX = (x) => {
    const caixa = controle.getBoundingClientRect();
    irPara((x - caixa.left) / caixa.width);
  };
  controle.addEventListener('pointerdown', (evento) => {
    controle.setPointerCapture(evento.pointerId);
    controle.classList.add('drag');
    irParaPosicaoX(evento.clientX);
    evento.preventDefault();
  });
  controle.addEventListener('pointermove', (evento) => {
    if (controle.hasPointerCapture(evento.pointerId)) irParaPosicaoX(evento.clientX);
  });
  ['pointerup', 'pointercancel'].forEach((tipo) =>
    controle.addEventListener(tipo, () => controle.classList.remove('drag')),
  );
  // teclado: setas andam 5%, PageUp/PageDown 20%, Home/End vão às pontas
  controle.addEventListener('keydown', (evento) => {
    const passo = {
      ArrowRight: 0.05,
      ArrowUp: 0.05,
      ArrowLeft: -0.05,
      ArrowDown: -0.05,
      PageUp: 0.2,
      PageDown: -0.2,
    }[evento.key];
    if (evento.key === 'Home') irPara(0);
    else if (evento.key === 'End') irPara(1);
    else if (passo != null) irPara(distanciaAtual + passo);
    else return;
    evento.preventDefault();
  });
  addEventListener(
    'scroll',
    () => {
      pedido || (pedido = requestAnimationFrame(aoRolar));
    },
    { passive: true },
  );
  addEventListener('resize', aoRolar);
  telaGrande.addEventListener('change', aoRolar);
  mostrarDistancia(distanciaPelaRolagem());
}

/* ---------- rodapé: os links das páginas funcionam normalmente; "Início" volta ao topo e "#" ainda não tem destino ---------- */
function iniciarRodape() {
  document.querySelectorAll('.ftx a').forEach((link) =>
    link.addEventListener('click', (evento) => {
      if (link.hasAttribute('data-top')) {
        evento.preventDefault();
        scrollTo({ top: 0, behavior: 'smooth' });
      } else if (link.getAttribute('href') === '#') {
        evento.preventDefault();
      }
    }),
  );
}

/* ---------- antes × depois: divisória arrastável + parcelas calculadas pela tabela Price ---------- */
function iniciarAntesDepois() {
  const comparador = document.getElementById('cmp');
  if (!comparador) return;
  const divisoria = comparador.querySelector('input');
  const POSICAO_INICIAL = innerWidth < 600 ? 64 : 50; // no celular começa mais à direita
  let espiando = true;
  divisoria.value = POSICAO_INICIAL;
  const atualizar = () => comparador.style.setProperty('--x', divisoria.value + '%');
  divisoria.addEventListener('input', () => {
    espiando = false;
    atualizar();
  });
  atualizar();

  const { financiado, parcelas } = ANTES_DEPOIS;
  const totais = {};
  for (const [lado, contrato] of [
    ['a', ANTES_DEPOIS.original],
    ['b', ANTES_DEPOIS.ajustado],
  ]) {
    const parcela = parcelaPrice(financiado + contrato.encargos, contrato.juros, parcelas);
    totais[lado] = parcela * parcelas;
    comparador.querySelector(`.${lado} [data-f=p]`).innerHTML =
      `<span class='px'>${parcelas} × </span>` + formatarReais(parcela);
    comparador.querySelector(`.${lado} [data-f=t]`).textContent = formatarReais(parcela * parcelas);
  }
  document.getElementById('cdf').textContent = formatarReais(totais.a - totais.b);

  // ao aparecer, a divisória "espia" os dois lados uma vez, mostrando que dá para arrastar
  if (movimentoReduzido) return;
  const observador = new IntersectionObserver(
    (entradas) => {
      if (!entradas[0].isIntersecting) return;
      observador.disconnect();
      const inicio = performance.now();
      const passo = (tempo) => {
        if (!espiando) return;
        const k = Math.min(1, (tempo - inicio) / 2200);
        divisoria.value = (POSICAO_INICIAL + Math.sin(k * Math.PI * 2) * 24 * (1 - k * 0.3)).toFixed(1);
        if (k >= 1) divisoria.value = POSICAO_INICIAL;
        atualizar();
        if (k < 1) requestAnimationFrame(passo);
      };
      setTimeout(() => requestAnimationFrame(passo), 600);
    },
    { threshold: 0.6 },
  );
  observador.observe(comparador);
}

/* ---------- quiz "Abusiva ou não?": cada pergunta tem data-a com a resposta certa ---------- */
function iniciarQuiz() {
  const quiz = document.getElementById('quiz');
  if (!quiz) return;
  const perguntas = [...quiz.querySelectorAll('.qi')];
  const placar = quiz.querySelector('.qs');
  const refazer = quiz.querySelector('.qr');
  let respondidas = 0;
  let certas = 0;
  perguntas.forEach((pergunta) =>
    pergunta.querySelectorAll('.qb button').forEach((botao) =>
      botao.addEventListener('click', () => {
        if (pergunta.classList.contains('done')) return;
        const acertou = botao.dataset.a === pergunta.dataset.a;
        pergunta.classList.add('done', acertou ? 'qok' : 'qno');
        botao.classList.add('pick');
        pergunta.querySelectorAll('.qb button').forEach((b) => (b.disabled = true));
        pergunta.querySelector('.qa em').textContent =
          (acertou ? QUIZ.acertou : QUIZ.errou) +
          (pergunta.dataset.a === 'abusiva' ? QUIZ.regraAbusiva : QUIZ.regraPermitida);
        respondidas++;
        if (acertou) certas++;
        placar.textContent =
          respondidas < perguntas.length
            ? QUIZ.parcial(certas, respondidas)
            : QUIZ.resultado(certas, perguntas.length) +
              (certas === perguntas.length ? QUIZ.todasCertas : QUIZ.algumaErrada);
        refazer.hidden = respondidas < perguntas.length;
      }),
    ),
  );
  refazer.addEventListener('click', () => {
    respondidas = certas = 0;
    perguntas.forEach((pergunta) => {
      pergunta.classList.remove('done', 'qok', 'qno');
      pergunta.querySelectorAll('.qb button').forEach((b) => {
        b.disabled = false;
        b.classList.remove('pick');
      });
    });
    placar.textContent = '';
    refazer.hidden = true;
  });
}

/* ---------- glossário: o primeiro uso de cada termo vira <span class="gl"> com explicação ao passar o mouse ou focar ---------- */
function iniciarGlossario() {
  const balao = document.createElement('div');
  balao.id = 'gtip';
  balao.setAttribute('role', 'tooltip');
  document.body.append(balao);
  const jaMarcados = new Set();
  // só procura termos nestes textos
  const textos = document.querySelectorAll('#pg .sb,#pg .sr small,#pg .rw>span,#pg .qi>p,#pg .qa p,#pg .nt,#pg .chip');
  textos.forEach((raiz) => {
    const percorrer = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
    const fila = [];
    while (percorrer.nextNode()) fila.push(percorrer.currentNode);
    while (fila.length) {
      const no = fila.shift();
      // o termo que aparece primeiro neste pedaço de texto (siglas em maiúsculas diferenciam maiúsculas/minúsculas)
      let melhor = null;
      for (const item of GLOSSARIO) {
        if (jaMarcados.has(item.termo)) continue;
        const achado = no.textContent.match(
          new RegExp('\\b' + item.termo + '\\b', item.termo === item.termo.toUpperCase() ? '' : 'i'),
        );
        if (achado && (!melhor || achado.index < melhor.achado.index)) melhor = { item, achado };
      }
      if (!melhor) continue;
      jaMarcados.add(melhor.item.termo);
      const trecho = no.splitText(melhor.achado.index);
      const resto = trecho.splitText(melhor.achado[0].length);
      const marcado = document.createElement('span');
      marcado.className = 'gl';
      marcado.tabIndex = 0;
      marcado.dataset.t = melhor.item.titulo;
      marcado.dataset.x = melhor.item.explicacao;
      marcado.textContent = trecho.textContent;
      trecho.replaceWith(marcado);
      fila.unshift(no, resto); // continua procurando no que sobrou antes e depois do termo
    }
  });
  const mostrar = (evento) => {
    const termo = evento.currentTarget;
    const caixa = termo.getBoundingClientRect();
    balao.innerHTML = '<b>' + termo.dataset.t + '</b>' + termo.dataset.x;
    balao.classList.add('on');
    const largura = balao.offsetWidth;
    const altura = balao.offsetHeight;
    const x = Math.min(innerWidth - largura - 12, Math.max(12, caixa.left + caixa.width / 2 - largura / 2));
    let y = caixa.top - altura - 10;
    if (y < 10) y = caixa.bottom + 10; // sem espaço acima: aparece embaixo
    balao.style.transform = `translate(${x}px,${y}px)`;
  };
  const esconder = () => balao.classList.remove('on');
  document.querySelectorAll('.gl').forEach((termo) => {
    termo.addEventListener('mouseenter', mostrar);
    termo.addEventListener('focus', mostrar);
    termo.addEventListener('mouseleave', esconder);
    termo.addEventListener('blur', esconder);
  });
  addEventListener('scroll', esconder, { passive: true });
}

iniciarIceberg();
iniciarCasoReal();
iniciarApontamentos();
iniciarMontanha();
iniciarRodape();
iniciarAntesDepois();
iniciarQuiz();
iniciarGlossario();
