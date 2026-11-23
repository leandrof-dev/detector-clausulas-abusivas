/* Iceberg 3D da seção "O problema" (public/static/models/ice.glb).
   Ele gira junto com a rolagem; as faixas de cor batem com as camadas de texto ao lado (secoes.js). */
import * as THREE from 'three'; // biblioteca 3D. Ex.: new THREE.OrthographicCamera(-1, 1, 1, -1)
import { carregarModelo } from '../comum/modelo-3d.js';
import { densidadeDaTela, movimentoReduzido, observarVisibilidade } from '../comum/utilidades.js';

/** Material pintado pela altura: acima da linha d'água (parcela e preço, y > 0,438) e três faixas abaixo
    (encargos, tarifas embutidas, serviços); uma linha escura marca cada divisa. */
function criarMaterialEmFaixas() {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.4,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vY;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvY = position.y;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vY;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
      {
        float y = vY;
        vec3 t = y > 0.438 ? vec3(0.80, 0.91, 1.0)
          : y > -0.042 ? vec3(1.0, 0.60, 0.65)
          : y > -0.52 ? vec3(1.0, 0.30, 0.38)
          : vec3(0.70, 0.22, 0.40);
        float l = 1.0 - smoothstep(0.0, 0.012, min(min(abs(y - 0.438), abs(y + 0.042)), abs(y + 0.52)));
        diffuseColor.rgb = mix(diffuseColor.rgb, t, 0.62) * (1.0 - 0.5 * l);
      }`,
      );
  };
  return material;
}

/** Centraliza o modelo, ajusta a altura para 2 (a altura toda da câmera) e o coloca no grupo que gira. */
function colocarIceberg(gltf, grupo, material) {
  const malha = gltf.scene.getObjectByProperty('isMesh', true);
  const geometria = malha.geometry;
  geometria.computeBoundingBox();
  const limites = geometria.boundingBox;
  const centro = limites.getCenter(new THREE.Vector3());
  const escala = 2 / (limites.max.y - limites.min.y);
  geometria.translate(-centro.x, -centro.y, -centro.z);
  geometria.scale(escala, escala, escala);
  geometria.computeVertexNormals();
  grupo.add(new THREE.Mesh(geometria, material));
}

/** Câmera sem perspectiva: o iceberg ocupa sempre a mesma altura do quadro, qualquer que seja a largura. */
function ajustarTamanho(pecas) {
  const largura = pecas.canvas.clientWidth;
  const altura = pecas.canvas.clientHeight;
  const proporcao = largura / altura;
  const meiaAltura = 1.14; // um pouco de folga em cima e embaixo
  pecas.camera.left = -meiaAltura * proporcao;
  pecas.camera.right = meiaAltura * proporcao;
  pecas.camera.top = meiaAltura;
  pecas.camera.bottom = -meiaAltura;
  pecas.camera.updateProjectionMatrix();
  pecas.renderizador.setSize(largura, altura, false);
}

/** Giro = posição da rolagem (sobe e desce junto) + uma deriva lenta para não ficar parado. */
function desenharQuadro(estado, agora) {
  const segundos = Math.max(0, Math.min(0.05, (agora - estado.ultimoQuadro) / 1000));
  const caixa = estado.quadro.getBoundingClientRect();
  const passagem = Math.max(0, Math.min(1, (innerHeight - caixa.top) / (innerHeight + caixa.height))); // 0 entrando, 1 saindo
  const anguloAlvo = 0.6 - passagem * Math.PI * 1.6;

  estado.ultimoQuadro = agora;
  estado.anguloAtual =
    estado.anguloAtual === null
      ? anguloAlvo
      : estado.anguloAtual + (anguloAlvo - estado.anguloAtual) * (1 - Math.exp(-segundos * 6));
  if (!movimentoReduzido()) estado.deriva -= segundos * 0.05;
  estado.grupo.rotation.y = estado.anguloAtual + estado.deriva;
  estado.pecas.renderizador.render(estado.pecas.cena, estado.pecas.camera);
}

/** Monta a cena do iceberg e liga a animação (só desenha enquanto o quadro está na tela). */
export function iniciarIceberg() {
  const quadro = document.getElementById('iceberg');
  const canvas = document.getElementById('tela-iceberg');
  const renderizador = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  const cena = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
  const luzPrincipal = new THREE.DirectionalLight(0xffffff, 2.6);
  const contraluz = new THREE.DirectionalLight(0x5aa8ff, 1.5);
  const grupo = new THREE.Group();
  const material = criarMaterialEmFaixas();
  const pecas = { canvas, renderizador, cena, camera };
  const estado = { quadro, pecas, grupo, ultimoQuadro: performance.now(), anguloAtual: null, deriva: 0 };

  renderizador.setClearColor(0x000000, 0);
  renderizador.setPixelRatio(densidadeDaTela(1.5));
  renderizador.toneMapping = THREE.ACESFilmicToneMapping;
  camera.position.set(0, 0, 6);
  cena.add(new THREE.HemisphereLight(0xcfe3ff, 0x1a2440, 1.2));
  luzPrincipal.position.set(-3, 2.5, 4);
  cena.add(luzPrincipal);
  contraluz.position.set(4, -1, -3);
  cena.add(contraluz);
  cena.add(grupo);
  carregarModelo('/static/models/ice.glb', (gltf) => colocarIceberg(gltf, grupo, material));
  new ResizeObserver(() => ajustarTamanho(pecas)).observe(canvas);
  ajustarTamanho(pecas);
  observarVisibilidade(quadro, (visivel) => {
    estado.ultimoQuadro = performance.now();
    renderizador.setAnimationLoop(visivel ? (tempo) => desenharQuadro(estado, tempo) : null);
  });
}
