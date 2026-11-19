/* Efeitos gerais da página (valem para todas as seções):
   1. elementos aparecem ao rolar;
   2. títulos das seções entram palavra por palavra;
   3. parallax, cor de destaque que acompanha a seção e barra de progresso no topo;
   4. cartões inclinam em 3D seguindo o mouse. */
import { movimentoReduzido } from './util.js';

/* ---------- 1. revelar ao rolar: quem tem a classe .rv ganha .in quando entra na tela (o CSS faz a animação) ---------- */
const observadorRevelar = new IntersectionObserver(
  (entradas) =>
    entradas.forEach((entrada) => {
      if (entrada.isIntersecting) {
        entrada.target.classList.add('in');
        observadorRevelar.unobserve(entrada.target);
      }
    }),
  { threshold: 0.2 },
);
document.querySelectorAll('.rv').forEach((elemento) => observadorRevelar.observe(elemento));

/* ---------- 2. títulos das seções: cada palavra vira um <span class="w"> numerado (--i) para entrar em sequência ---------- */
document.querySelectorAll('.bn h2').forEach((titulo) => {
  let indice = 0;
  const separarPalavras = (no) => {
    [...no.childNodes].forEach((filho) => {
      if (filho.nodeType === Node.TEXT_NODE) {
        const pedacos = document.createDocumentFragment();
        filho.textContent.split(/(\s+)/).forEach((palavra) => {
          if (!palavra) return;
          if (/^\s+$/.test(palavra)) {
            pedacos.append(' ');
            return;
          }
          const span = document.createElement('span');
          span.className = 'w';
          span.style.setProperty('--i', indice++);
          span.textContent = palavra;
          pedacos.append(span);
        });
        filho.replaceWith(pedacos);
      } else if (filho.nodeType === Node.ELEMENT_NODE) separarPalavras(filho);
    });
  };
  separarPalavras(titulo);
  titulo.classList.add('sx');
});

/* atrasos em cascata (--d): o texto da esquerda entra em sequência, o cartão da direita logo depois;
   as linhas dentro dos cartões ganham a ordem --i */
document.querySelectorAll('.bn').forEach((secao) => {
  let ordem = 0;
  secao
    .querySelectorAll('.gr>div:first-child .rv')
    .forEach((elemento) => elemento.style.setProperty('--d', ordem++ * 0.09 + 's'));
  secao
    .querySelectorAll('.gr>div:last-child .rv,.gr>div.rv')
    .forEach((elemento) => elemento.style.setProperty('--d', '.25s'));
  secao.querySelectorAll('.gp .rw,.gp .sr').forEach((elemento, i) => elemento.style.setProperty('--i', i));
});

/* ---------- 3. parallax (--p), cor da seção (--tk) e barra de progresso ---------- */
const secoes = [...document.querySelectorAll('.bn')];
const pagina = document.getElementById('pg');
const barraProgresso = document.getElementById('prog');
let pedidoDeQuadro = 0;

// cada seção ganha uma camada de fundo (.bgl) que se dissolve nas bordas: a página vira um fluxo contínuo
secoes.forEach((secao) => {
  const fundo = document.createElement('i');
  fundo.className = 'bgl';
  secao.prepend(fundo);
});

// cor de destaque de cada seção, na ordem da página (quase sempre a mesma do --k da <section> no HTML)
const paraRGB = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const CORES_DAS_SECOES = [
  '#ff5566',
  '#ff6b7d',
  '#8d9bff',
  '#a98cff',
  '#7fd4ff',
  '#b496ff',
  '#3ff0a6',
  '#4fd8c0',
  '#4fe8b0',
  '#3ff0a6',
].map(paraRGB);
const VERDE = paraRGB('#3ff0a6');
const misturarRGB = (a, b, t) => a.map((valor, i) => Math.round(valor + (b[i] - valor) * t));

/** --tk = cor da seção que está no meio da tela, misturada com a vizinha conforme a rolagem */
function atualizarCorDaSecao() {
  const alturaTela = innerHeight;
  const centros = secoes.map((secao) => {
    const caixa = secao.getBoundingClientRect();
    return caixa.top + caixa.height / 2;
  });
  const meio = alturaTela / 2;
  let cor;
  if (centros[0] > meio) {
    cor = misturarRGB(CORES_DAS_SECOES[0], VERDE, Math.min(1, (centros[0] - meio) / alturaTela));
  } else {
    let i = 0;
    while (i < centros.length - 1 && centros[i + 1] <= meio) i++;
    cor =
      i >= centros.length - 1
        ? CORES_DAS_SECOES[CORES_DAS_SECOES.length - 1]
        : misturarRGB(
            CORES_DAS_SECOES[i],
            CORES_DAS_SECOES[i + 1],
            (meio - centros[i]) / (centros[i + 1] - centros[i]),
          );
  }
  pagina.style.setProperty('--tk', 'rgb(' + cor.join(',') + ')');
}

/** roda uma vez por quadro enquanto a página rola */
function aoRolar() {
  pedidoDeQuadro = 0;
  atualizarCorDaSecao();
  const alturaTela = innerHeight;
  // --p vai de -1 (seção abaixo da tela) a 1 (acima); o CSS usa para deslocar texto e cartão em velocidades diferentes
  secoes.forEach((secao) => {
    const caixa = secao.getBoundingClientRect();
    if (caixa.bottom < -alturaTela || caixa.top > 2 * alturaTela) return;
    secao.style.setProperty(
      '--p',
      Math.max(-1, Math.min(1, (caixa.top + caixa.height / 2 - alturaTela / 2) / alturaTela)).toFixed(3),
    );
  });
  const rolagemMaxima = document.documentElement.scrollHeight - alturaTela;
  barraProgresso.style.transform =
    'scaleX(' + (rolagemMaxima > 0 ? Math.min(1, scrollY / rolagemMaxima) : 0).toFixed(4) + ')';
  // --hz: o horizonte curvo da transição do topo sobe um pouco com a rolagem
  pagina.style.setProperty(
    '--hz',
    Math.max(0, Math.min(60, (scrollY - pagina.offsetTop + alturaTela) * 0.04)).toFixed(1),
  );
}

if (!movimentoReduzido) {
  addEventListener(
    'scroll',
    () => {
      pedidoDeQuadro || (pedidoDeQuadro = requestAnimationFrame(aoRolar));
    },
    { passive: true },
  );
  addEventListener('resize', aoRolar);
  aoRolar();
} else {
  barraProgresso.style.display = 'none';
}

/* ---------- 4. cartões 3D: inclinam na direção do mouse, com mola suave, profundidade, sombra e reflexo ----------
   Só com mouse (não em telas de toque) e sem "reduzir movimento". O JS só calcula variáveis (--rx, --ry, --h…);
   quem desenha a inclinação é o CSS. */
function iniciarCartoes3D() {
  if (!matchMedia('(hover:hover) and (pointer:fine)').matches || movimentoReduzido) return;
  const INCLINACAO_X = 22; // graus máximos para os lados
  const INCLINACAO_Y = 16; // graus máximos para cima/baixo
  const cartoes = [...document.querySelectorAll('.gp,#panel')].map((elemento) => ({
    elemento,
    caixa: elemento.id === 'panel' ? elemento : elemento.parentElement, // área que reage ao mouse
    x: 0.5, // posição do mouse no cartão (0 a 1), suavizada
    y: 0.5,
    forca: 0, // 0 = parado, 1 = mouse em cima
    parado: true,
    intensidade: elemento.dataset.tilt === 'soft' ? 0.35 : 1, // data-tilt="soft" inclina menos
  }));
  let mouseX = -1e5;
  let mouseY = -1e5;
  let pedido = 0;
  let ultimoTempo = 0;

  function animar(tempo) {
    pedido = 0;
    const dt = Math.min(0.05, ultimoTempo ? (tempo - ultimoTempo) / 1000 : 0.016);
    ultimoTempo = tempo;
    const seguir = 1 - Math.exp(-dt * 11);
    const acender = 1 - Math.exp(-dt * 8);
    let algumAtivo = false;
    for (const cartao of cartoes) {
      const caixa = cartao.caixa.getBoundingClientRect();
      const dentro = mouseX >= caixa.left && mouseX <= caixa.right && mouseY >= caixa.top && mouseY <= caixa.bottom;
      const alvoX = dentro ? (mouseX - caixa.left) / caixa.width : 0.5;
      const alvoY = dentro ? (mouseY - caixa.top) / caixa.height : 0.5;
      const alvoForca = dentro ? 1 : 0;
      if (cartao.parado && !dentro) continue;
      if (cartao.elemento.querySelector('.rt.drag')) continue; // arrastando o controle da montanha: não inclina
      cartao.x += (alvoX - cartao.x) * seguir;
      cartao.y += (alvoY - cartao.y) * seguir;
      cartao.forca += (alvoForca - cartao.forca) * acender;
      const estilo = cartao.elemento.style;
      const dx = cartao.x - 0.5;
      const dy = cartao.y - 0.5;
      estilo.setProperty('--ry', (dx * INCLINACAO_X * cartao.intensidade * cartao.forca).toFixed(2) + 'deg');
      estilo.setProperty('--rx', (-dy * INCLINACAO_Y * cartao.intensidade * cartao.forca).toFixed(2) + 'deg');
      estilo.setProperty('--mx', (cartao.x * 100).toFixed(1) + '%');
      estilo.setProperty('--my', (cartao.y * 100).toFixed(1) + '%');
      estilo.setProperty('--h', cartao.forca.toFixed(3));
      estilo.setProperty('--s', (1 + 0.025 * cartao.forca).toFixed(4));
      estilo.setProperty('--sx', (-dx * 34 * cartao.forca).toFixed(1) + 'px');
      estilo.setProperty('--sy', (-dy * 34 * cartao.forca).toFixed(1) + 'px');
      estilo.setProperty('--ga', (90 + Math.atan2(dy, dx) * 57.3).toFixed(0) + 'deg');
      const mexendo =
        Math.abs(alvoX - cartao.x) + Math.abs(alvoY - cartao.y) + Math.abs(alvoForca - cartao.forca) > 0.002;
      cartao.parado = !dentro && !mexendo;
      if (cartao.parado) {
        cartao.forca = 0;
        estilo.setProperty('--h', '0');
        estilo.setProperty('--rx', '0deg');
        estilo.setProperty('--ry', '0deg');
        estilo.setProperty('--s', '1');
        estilo.setProperty('--sx', '0px');
        estilo.setProperty('--sy', '0px');
      } else algumAtivo = true;
    }
    if (algumAtivo) pedido = requestAnimationFrame(animar);
    else ultimoTempo = 0;
  }

  const pedirQuadro = () => {
    pedido || (pedido = requestAnimationFrame(animar));
  };
  addEventListener(
    'pointermove',
    (evento) => {
      mouseX = evento.clientX;
      mouseY = evento.clientY;
      pedirQuadro();
    },
    { passive: true },
  );
  addEventListener('scroll', pedirQuadro, { passive: true });
  // mouse saiu da janela: os cartões voltam ao normal
  document.addEventListener('pointerout', (evento) => {
    if (!evento.relatedTarget) {
      mouseX = mouseY = -1e5;
      pedirQuadro();
    }
  });
}
iniciarCartoes3D();
