/* Cartões de vidro (.cartao) que inclinam na direção do mouse, com mola suave, profundidade, sombra e reflexo.
   Só funciona com mouse (não em telas de toque) e sem "reduzir movimento".
   O JavaScript só calcula variáveis (--giro-lateral, --mouse-em-cima…); quem desenha a inclinação é o CSS.
   Usado pela página inicial, pela página de envio e pelas páginas informativas. */
import { movimentoReduzido, observarVisibilidade, telaComMouse } from './utilidades.js';

/** Inclinação máxima, em graus: para os lados e para cima/baixo. */
function limitesDaInclinacao() {
  const limites = { lateral: 22, vertical: 16 };
  return limites;
}

/** Estado de um cartão: onde o mouse está nele (suavizado, de 0 a 1) e quanto ele está "aceso" (forca). */
function criarEstadoDoCartao(elemento) {
  const estado = {
    elemento,
    area: elemento.id === 'painel' ? elemento : elemento.parentElement, // área que reage ao mouse
    x: 0.5,
    y: 0.5,
    forca: 0, // 0 = parado, 1 = mouse em cima
    parado: true,
    visivel: false,
    intensidade: elemento.dataset.inclinacao === 'suave' ? 0.35 : 1, // data-inclinacao="suave" inclina menos
  };
  observarVisibilidade(estado.area, (visivel) => {
    estado.visivel = visivel;
  });
  return estado;
}

/** Escreve no CSS do cartão a inclinação, o brilho e a sombra do quadro atual. */
function aplicarInclinacao(cartao, limites) {
  const estilo = cartao.elemento.style;
  const dx = cartao.x - 0.5;
  const dy = cartao.y - 0.5;
  estilo.setProperty('--giro-lateral', (dx * limites.lateral * cartao.intensidade * cartao.forca).toFixed(2) + 'deg');
  estilo.setProperty(
    '--giro-vertical',
    (-dy * limites.vertical * cartao.intensidade * cartao.forca).toFixed(2) + 'deg',
  );
  estilo.setProperty('--mouse-x', (cartao.x * 100).toFixed(1) + '%');
  estilo.setProperty('--mouse-y', (cartao.y * 100).toFixed(1) + '%');
  estilo.setProperty('--mouse-em-cima', cartao.forca.toFixed(3));
  estilo.setProperty('--zoom', (1 + 0.025 * cartao.forca).toFixed(4));
  estilo.setProperty('--sombra-x', (-dx * 34 * cartao.forca).toFixed(1) + 'px');
  estilo.setProperty('--sombra-y', (-dy * 34 * cartao.forca).toFixed(1) + 'px');
  estilo.setProperty('--angulo-reflexo', (90 + Math.atan2(dy, dx) * 57.3).toFixed(0) + 'deg');
}

/** Devolve o cartão à posição de descanso (sem inclinação, sem brilho). */
function repousar(cartao) {
  const estilo = cartao.elemento.style;
  cartao.forca = 0;
  estilo.setProperty('--mouse-em-cima', '0');
  estilo.setProperty('--giro-vertical', '0deg');
  estilo.setProperty('--giro-lateral', '0deg');
  estilo.setProperty('--zoom', '1');
  estilo.setProperty('--sombra-x', '0px');
  estilo.setProperty('--sombra-y', '0px');
}

/** Atualiza um cartão para este quadro e devolve true se ele ainda está se mexendo. */
function atualizarCartao(cartao, mouse, fatores, limites) {
  const caixa = cartao.area.getBoundingClientRect();
  const dentro = mouse.x >= caixa.left && mouse.x <= caixa.right && mouse.y >= caixa.top && mouse.y <= caixa.bottom;
  const arrastandoControle = cartao.elemento.querySelector('.controle.arrastando') !== null;
  let ativo = false;

  if (!(cartao.parado && !dentro) && !arrastandoControle) {
    const alvoX = dentro ? (mouse.x - caixa.left) / caixa.width : 0.5;
    const alvoY = dentro ? (mouse.y - caixa.top) / caixa.height : 0.5;
    const alvoForca = dentro ? 1 : 0;
    cartao.x += (alvoX - cartao.x) * fatores.seguir;
    cartao.y += (alvoY - cartao.y) * fatores.seguir;
    cartao.forca += (alvoForca - cartao.forca) * fatores.acender;
    aplicarInclinacao(cartao, limites);
    const distancia = Math.abs(alvoX - cartao.x) + Math.abs(alvoY - cartao.y) + Math.abs(alvoForca - cartao.forca);
    cartao.parado = !dentro && distancia <= 0.002;
    if (cartao.parado) {
      repousar(cartao);
    }
    ativo = !cartao.parado;
  }

  return ativo;
}

/** Um quadro de animação: atualiza os cartões na tela (e os que ainda estão voltando ao repouso). */
function animarQuadro(estado, tempo) {
  const segundos = Math.min(0.05, estado.ultimoTempo ? (tempo - estado.ultimoTempo) / 1000 : 0.016);
  const fatores = { seguir: 1 - Math.exp(-segundos * 11), acender: 1 - Math.exp(-segundos * 8) };
  const limites = limitesDaInclinacao();
  let algumAtivo = false;

  estado.pedido = 0;
  estado.ultimoTempo = tempo;
  estado.cartoes.forEach((cartao) => {
    if (cartao.visivel || !cartao.parado) {
      algumAtivo = atualizarCartao(cartao, estado.mouse, fatores, limites) || algumAtivo;
    }
  });

  if (algumAtivo) {
    estado.pedido = requestAnimationFrame((proximo) => animarQuadro(estado, proximo));
  } else {
    estado.ultimoTempo = 0;
  }
}

/** Pede um quadro de animação, se ainda não houver um pedido. */
function pedirQuadro(estado) {
  if (!estado.pedido) {
    estado.pedido = requestAnimationFrame((tempo) => animarQuadro(estado, tempo));
  }
}

/** Liga a inclinação de todos os cartões da página (só com mouse e sem "reduzir movimento"). */
export function iniciarCartoes3D() {
  if (telaComMouse() && !movimentoReduzido()) {
    const estado = {
      cartoes: [...document.querySelectorAll('.cartao, #painel')].map(criarEstadoDoCartao),
      mouse: { x: -1e5, y: -1e5 }, // longe de tudo até o mouse se mexer
      pedido: 0,
      ultimoTempo: 0,
    };

    addEventListener(
      'pointermove',
      (evento) => {
        estado.mouse.x = evento.clientX;
        estado.mouse.y = evento.clientY;
        pedirQuadro(estado);
      },
      { passive: true },
    );
    addEventListener('scroll', () => pedirQuadro(estado), { passive: true });
    // o mouse saiu da janela: os cartões voltam ao normal
    document.addEventListener('pointerout', (evento) => {
      if (!evento.relatedTarget) {
        estado.mouse.x = -1e5;
        estado.mouse.y = -1e5;
        pedirQuadro(estado);
      }
    });
  }
}
