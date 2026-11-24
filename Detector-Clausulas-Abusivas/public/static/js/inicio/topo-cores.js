/* Cores das três etapas do topo (vermelho → roxo → verde) e como misturar uma na outra. */
import * as THREE from 'three'; // biblioteca 3D. Ex.: new THREE.Color('#ff5566').lerp(outraCor, 0.5)
import { suavizar } from '../comum/utilidades.js';

/** Todas as cores do topo, criadas uma vez só (criar cores a cada quadro deixaria a página mais lenta). */
export function paletaDoTopo() {
  const neutra = new THREE.Color(0.62, 0.76, 1); // azul-claro: cor da cena antes de a pessoa começar a rolar
  const brancoQuente = new THREE.Color(1, 0.98, 0.96);
  const paleta = {
    neutra,
    // cores das luzes da cena 3D em cada etapa
    luz: {
      vermelho: new THREE.Color('#ff4a5c'),
      roxo: new THREE.Color('#8f6cff'),
      verde: new THREE.Color('#2fe39b'),
    },
    // cores da interface (textos, painel) em cada etapa
    interface: {
      vermelho: new THREE.Color('#ff5566'),
      roxo: new THREE.Color('#b496ff'),
      verde: new THREE.Color('#3ff0a6'),
    },
    azulContraluz: new THREE.Color(0x2f7dff), // cor inicial do contraluz
    brancoDaLuz: neutra.clone().lerp(brancoQuente, 0.55), // luz principal quase branca: o carro mantém a cor real
  };
  return paleta;
}

/** Brilho percebido de uma cor (0 = preto, 1 = branco). */
export function luminancia(cor) {
  const brilho = 0.2126 * cor.r + 0.7152 * cor.g + 0.0722 * cor.b;
  return brilho;
}

/* Mistura no espaço de cor OKLab: o caminho do roxo ao verde não passa por azul/ciano
   (misturar direto em RGB ou HSL dava um efeito "arco-íris"). */
function paraOklab(cor) {
  const l = Math.cbrt(0.4122214708 * cor.r + 0.5363325363 * cor.g + 0.0514459929 * cor.b);
  const m = Math.cbrt(0.2119034982 * cor.r + 0.6806995451 * cor.g + 0.1073969566 * cor.b);
  const s = Math.cbrt(0.0883024619 * cor.r + 0.2817188376 * cor.g + 0.6299787005 * cor.b);
  const oklab = [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
  return oklab;
}

function deOklab(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const cor = new THREE.Color().setRGB(
    Math.max(0, 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    Math.max(0, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    Math.max(0, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  );
  return cor;
}

/** Mistura a cor `a` com `b` (t = 0 → a, t = 1 → b), passando pelo caminho natural entre elas. */
export function misturarOklab(a, b, t) {
  const A = paraOklab(a);
  const B = paraOklab(b);
  const mistura = deOklab(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
  return mistura;
}

/** Cor da etapa para um progresso de rolagem de 0 a 1:
    vermelho até 0,22 · mistura até 0,42 · roxo até 0,58 · mistura até 0,82 · verde até o fim. */
export function corDaEtapa(cores, progresso) {
  let cor;

  if (progresso < 0.22) {
    cor = cores.vermelho.clone();
  } else if (progresso < 0.42) {
    cor = misturarOklab(cores.vermelho, cores.roxo, suavizar(0.22, 0.42, progresso));
  } else if (progresso < 0.58) {
    cor = cores.roxo.clone();
  } else if (progresso < 0.82) {
    cor = misturarOklab(cores.roxo, cores.verde, suavizar(0.58, 0.82, progresso));
  } else {
    cor = cores.verde.clone();
  }

  return cor;
}
