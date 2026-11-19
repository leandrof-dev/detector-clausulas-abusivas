/* Iceberg 3D da primeira seção ("O que está sob a parcela", static/models/ice.glb).
   Ele gira junto com a rolagem; as faixas de cor batem com as faixas de texto ao lado (secoes.js). */
import * as THREE from 'three';
import { carregarModelo } from './modelo-3d.js';
import { movimentoReduzido } from './util.js';

const quadro = document.getElementById('ice');
const canvas = document.getElementById('icv');

const renderizador = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderizador.setClearColor(0x000000, 0);
renderizador.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
renderizador.toneMapping = THREE.ACESFilmicToneMapping;

const cena = new THREE.Scene();
// câmera sem perspectiva: o iceberg ocupa sempre a mesma altura do quadro
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
camera.position.set(0, 0, 6);
cena.add(new THREE.HemisphereLight(0xcfe3ff, 0x1a2440, 1.2));
const luzPrincipal = new THREE.DirectionalLight(0xffffff, 2.6);
luzPrincipal.position.set(-3, 2.5, 4);
cena.add(luzPrincipal);
const contraluz = new THREE.DirectionalLight(0x5aa8ff, 1.5);
contraluz.position.set(4, -1, -3);
cena.add(contraluz);
const grupo = new THREE.Group();
cena.add(grupo);

/* faixas pintadas pela altura: acima da linha d'água (parcela e preço, y > 0.438) e três faixas abaixo
   (encargos, tarifas embutidas, serviços); uma linha escura marca cada divisa */
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

carregarModelo('/static/models/ice.glb', (gltf) => {
  const malha = gltf.scene.getObjectByProperty('isMesh', true);
  const geometria = malha.geometry;
  // centraliza e ajusta a altura para 2 (a altura toda da câmera)
  geometria.computeBoundingBox();
  const limites = geometria.boundingBox;
  const centro = limites.getCenter(new THREE.Vector3());
  const escala = 2 / (limites.max.y - limites.min.y);
  geometria.translate(-centro.x, -centro.y, -centro.z);
  geometria.scale(escala, escala, escala);
  geometria.computeVertexNormals();
  grupo.add(new THREE.Mesh(geometria, material));
});

function ajustarTamanho() {
  const largura = canvas.clientWidth;
  const altura = canvas.clientHeight;
  const proporcao = largura / altura;
  const MEIA_ALTURA = 1.14; // um pouco de folga em cima e embaixo
  camera.left = -MEIA_ALTURA * proporcao;
  camera.right = MEIA_ALTURA * proporcao;
  camera.top = MEIA_ALTURA;
  camera.bottom = -MEIA_ALTURA;
  camera.updateProjectionMatrix();
  renderizador.setSize(largura, altura, false);
}
new ResizeObserver(ajustarTamanho).observe(canvas);
ajustarTamanho();

/* giro = posição da rolagem (sobe e desce junto) + uma deriva lenta para não ficar parado; só desenha na tela */
let visivel = false;
let ultimoQuadro = performance.now();
let anguloAtual = null;
let deriva = 0;
new IntersectionObserver((entradas) => {
  visivel = entradas[0].isIntersecting;
}).observe(quadro);

renderizador.setAnimationLoop((agora) => {
  const dt = Math.min(0.05, (agora - ultimoQuadro) / 1000);
  ultimoQuadro = agora;
  if (!visivel) return;
  const caixa = quadro.getBoundingClientRect();
  const passagem = Math.max(0, Math.min(1, (innerHeight - caixa.top) / (innerHeight + caixa.height))); // 0 entrando, 1 saindo
  const anguloAlvo = 0.6 - passagem * Math.PI * 1.6;
  anguloAtual = anguloAtual === null ? anguloAlvo : anguloAtual + (anguloAlvo - anguloAtual) * (1 - Math.exp(-dt * 6));
  if (!movimentoReduzido) deriva -= dt * 0.05;
  grupo.rotation.y = anguloAtual + deriva;
  renderizador.render(cena, camera);
});
