/* Cartões 3D de vidro (.gp): inclinam na direção do mouse. Usado pela página inicial (efeitos.js) e pela de envio. */
import { movimentoReduzido } from './util.js';

/* ---------- 4. cartões 3D: inclinam na direção do mouse, com mola suave, profundidade, sombra e reflexo ----------
   Só com mouse (não em telas de toque) e sem "reduzir movimento". O JS só calcula variáveis (--rx, --ry, --h…);
   quem desenha a inclinação é o CSS. */
export function iniciarCartoes3D() {
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
