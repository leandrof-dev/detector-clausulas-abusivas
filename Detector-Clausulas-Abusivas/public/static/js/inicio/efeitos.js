/* Efeitos gerais da página inicial (valem para todas as faixas):
   1. elementos aparecem ao rolar;
   2. títulos das faixas entram palavra por palavra;
   3. parallax, cor de destaque que acompanha a faixa no meio da tela e barra de progresso no topo;
   4. animações de faixas fora da tela ficam pausadas (o processador descansa). */
import { limitar, movimentoReduzido, observarVisibilidade } from '../comum/utilidades.js';

/* ---------- 1. aparecer ao rolar: quem tem .revelar ganha .revelado ao entrar na tela (o CSS faz a animação) ---------- */
function revelarAoRolar() {
  const observador = new IntersectionObserver(
    (entradas) => {
      entradas.forEach((entrada) => {
        if (entrada.isIntersecting) {
          entrada.target.classList.add('revelado');
          observador.unobserve(entrada.target);
        }
      });
    },
    { threshold: 0.2 },
  );
  document.querySelectorAll('.revelar').forEach((elemento) => observador.observe(elemento));
}

/* ---------- 2. títulos palavra por palavra: cada palavra vira <span class="palavra"> numerado (--ordem) ---------- */
function separarPalavras(no, contador) {
  [...no.childNodes].forEach((filho) => {
    if (filho.nodeType === Node.TEXT_NODE) {
      const pedacos = document.createDocumentFragment();
      filho.textContent.split(/(\s+)/).forEach((pedaco) => {
        if (/^\s+$/.test(pedaco)) {
          pedacos.append(' ');
        } else if (pedaco) {
          const palavra = document.createElement('span');
          palavra.className = 'palavra';
          palavra.style.setProperty('--ordem', contador.indice++);
          palavra.textContent = pedaco;
          pedacos.append(palavra);
        }
      });
      filho.replaceWith(pedacos);
    } else if (filho.nodeType === Node.ELEMENT_NODE) {
      separarPalavras(filho, contador);
    }
  });
}

function separarTitulosEmPalavras() {
  document.querySelectorAll('.faixa h2').forEach((titulo) => {
    separarPalavras(titulo, { indice: 0 });
    titulo.classList.add('palavra-a-palavra');
  });
}

/** Atrasos em cascata: o texto da esquerda entra em sequência e o cartão logo depois; as linhas do cartão ganham ordem. */
function definirAtrasos(faixas) {
  faixas.forEach((faixa) => {
    faixa
      .querySelectorAll('.grade > div:first-child .revelar')
      .forEach((elemento, ordem) => elemento.style.setProperty('--atraso', ordem * 0.09 + 's'));
    faixa
      .querySelectorAll('.grade > div:last-child .revelar, .grade > div.revelar')
      .forEach((elemento) => elemento.style.setProperty('--atraso', '.25s'));
    faixa
      .querySelectorAll('.cartao .linha, .cartao .passo')
      .forEach((elemento, ordem) => elemento.style.setProperty('--ordem', ordem));
  });
}

/** Cada faixa ganha uma camada de fundo (.fundo-faixa) que se dissolve nas bordas: a página vira um fluxo contínuo. */
function criarFundosDasFaixas(faixas) {
  faixas.forEach((faixa) => {
    const fundo = document.createElement('i');
    fundo.className = 'fundo-faixa';
    faixa.prepend(fundo);
  });
}

/* ---------- 3. parallax (--posicao), cor da faixa no meio da tela (--cor-tela) e barra de progresso ---------- */

/** "#3ff0a6" → [63, 240, 166] */
function paraRGB(hexadecimal) {
  const rgb = [1, 3, 5].map((inicio) => parseInt(hexadecimal.slice(inicio, inicio + 2), 16));
  return rgb;
}

/** Cor de destaque de cada faixa, na ordem da página (quase sempre a mesma do --cor da <section> no HTML). */
function coresDasFaixas() {
  const cores = [
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
  return cores;
}

/** Mistura duas cores RGB (t = 0 → a, t = 1 → b). A mistura anda em degraus de 1/32: a diferença não se vê,
    mas a página só é redesenhada quando a cor muda de verdade (e não a cada quadro da rolagem). */
function misturarRGB(a, b, t) {
  const degrau = Math.round(limitar(t) * 32) / 32;
  const cor = a.map((valor, i) => Math.round(valor + (b[i] - valor) * degrau));
  return cor;
}

/** --cor-tela = cor da faixa que está no meio da tela, misturada com a vizinha conforme a rolagem. */
function corDoMeioDaTela(caixas, cores) {
  const alturaTela = innerHeight;
  const meio = alturaTela / 2;
  const verde = paraRGB('#3ff0a6');
  const centros = caixas.map((caixa) => caixa.top + caixa.height / 2);
  let cor = cores[cores.length - 1];

  if (centros[0] > meio) {
    cor = misturarRGB(cores[0], verde, Math.min(1, (centros[0] - meio) / alturaTela));
  } else {
    let i = 0;
    while (i < centros.length - 1 && centros[i + 1] <= meio) i++;
    if (i < centros.length - 1) {
      cor = misturarRGB(cores[i], cores[i + 1], (meio - centros[i]) / (centros[i + 1] - centros[i]));
    }
  }

  const texto = 'rgb(' + cor.join(',') + ')';
  return texto;
}

/** Muda uma variável do CSS só se o valor for outro (mudar à toa obriga o navegador a recalcular a página). */
function mudarVariavel(elemento, nome, valor) {
  if (elemento.style.getPropertyValue(nome) !== valor) {
    elemento.style.setProperty(nome, valor);
  }
}

/** Roda uma vez por quadro enquanto a página rola. Só mexe nas faixas que estão na tela ou perto dela.
    Primeiro mede tudo e só depois muda o CSS (medir depois de mudar obrigaria o navegador a recalcular no meio). */
function aoRolar(estado) {
  const alturaTela = innerHeight;
  const caixas = estado.faixas.map((faixa) => faixa.getBoundingClientRect());
  const cor = corDoMeioDaTela(caixas, estado.cores);
  const rolagemMaxima = document.documentElement.scrollHeight - alturaTela;
  const progresso = rolagemMaxima > 0 ? Math.min(1, scrollY / rolagemMaxima) : 0;
  const horizonte = limitar((scrollY - estado.pagina.offsetTop + alturaTela) * 0.04, 0, 60);

  estado.pedido = 0;
  estado.faixas.forEach((faixa, indice) => {
    const caixa = caixas[indice];
    if (caixa.bottom >= -alturaTela && caixa.top <= 2 * alturaTela) {
      // --posicao vai de -1 (faixa abaixo da tela) a 1 (acima): o CSS desloca texto e cartão em velocidades diferentes
      const posicao = limitar((caixa.top + caixa.height / 2 - alturaTela / 2) / alturaTela, -1, 1);
      mudarVariavel(faixa, '--posicao', posicao.toFixed(3));
      mudarVariavel(faixa, '--cor-tela', cor);
    }
  });
  estado.barraDeProgresso.style.transform = 'scaleX(' + progresso.toFixed(4) + ')';
  // --horizonte: o horizonte curvo da transição do topo sobe um pouco com a rolagem
  mudarVariavel(estado.pagina, '--horizonte', horizonte.toFixed(1));
}

function acompanharRolagem(faixas) {
  const estado = {
    faixas,
    cores: coresDasFaixas(),
    pagina: document.getElementById('pagina'),
    barraDeProgresso: document.getElementById('progresso'),
    pedido: 0,
  };

  if (movimentoReduzido()) {
    estado.barraDeProgresso.style.display = 'none';
  } else {
    addEventListener(
      'scroll',
      () => {
        if (!estado.pedido) {
          estado.pedido = requestAnimationFrame(() => aoRolar(estado));
        }
      },
      { passive: true },
    );
    addEventListener('resize', () => aoRolar(estado));
    aoRolar(estado);
  }
}

/* ---------- 4. faixas fora da tela: animações pausadas (o CSS lê a classe .fora-da-tela) ---------- */
function pausarAnimacoesForaDaTela(faixas) {
  [document.getElementById('topo'), ...faixas].forEach((elemento) => {
    observarVisibilidade(elemento, (visivel) => elemento.classList.toggle('fora-da-tela', !visivel));
  });
}

/** Liga todos os efeitos gerais da página inicial. */
export function iniciarEfeitos() {
  const faixas = [...document.querySelectorAll('.faixa')];
  revelarAoRolar();
  separarTitulosEmPalavras();
  definirAtrasos(faixas);
  criarFundosDasFaixas(faixas);
  acompanharRolagem(faixas);
  pausarAnimacoesForaDaTela(faixas);
}
