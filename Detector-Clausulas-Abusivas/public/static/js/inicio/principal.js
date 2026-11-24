/* Página inicial: liga cada parte na ordem certa.
   As cenas 3D das seções só são montadas quando a pessoa chega perto delas (ou quando o navegador fica
   ocioso): a página abre mais rápido e o computador não desenha o que ninguém está vendo. */
import { iniciarCartoes3D } from '../comum/cartoes-3d.js';
import { quandoChegarPerto } from '../comum/utilidades.js';
import { iniciarEfeitos } from './efeitos.js';
import { iniciarSecoes } from './secoes.js';
import { iniciarTopo } from './topo.js';

/** Monta uma cena 3D uma única vez, carregando o arquivo dela só nessa hora. */
function criarMontadorDeCena(arquivo, funcao) {
  const cena = { montada: false };
  const montar = () => {
    if (!cena.montada) {
      cena.montada = true;
      import(arquivo).then((modulo) => modulo[funcao]());
    }
  };
  return montar;
}

/** Chama `acao` quando o navegador tiver um tempo livre (no máximo depois de `limite` milissegundos). */
function quandoOcioso(acao, limite) {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(acao, { timeout: limite });
  } else {
    setTimeout(acao, limite);
  }
}

function iniciarPaginaInicial() {
  const montarIceberg = criarMontadorDeCena('./iceberg.js', 'iniciarIceberg');
  const montarMontanha = criarMontadorDeCena('./montanha.js', 'iniciarMontanha');
  const montarCarro = criarMontadorDeCena('./carro-comparacao.js', 'iniciarCarroComparacao');

  iniciarEfeitos();
  iniciarCartoes3D();
  iniciarSecoes();
  iniciarTopo();
  // o iceberg é a primeira seção depois do topo: é montado logo que sobrar um tempo (o modelo é pequeno)
  addEventListener('load', () => quandoOcioso(montarIceberg, 2500));
  quandoChegarPerto(document.getElementById('iceberg'), '150%', montarIceberg);
  quandoChegarPerto(document.getElementById('cartao-montanha'), '150%', montarMontanha);
  quandoChegarPerto(document.querySelector('.carro'), '200%', montarCarro);
}

iniciarPaginaInicial();
