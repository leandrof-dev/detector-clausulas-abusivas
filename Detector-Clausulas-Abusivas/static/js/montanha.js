/* Montanha 3D da seção "Nota de confiabilidade" (desenhada no código, sem arquivo de modelo).
   distância 0 = contrato perto da curva de referência (montanha suave, marcador no pé);
   distância 1 = longe da curva (cristas mais ásperas, marcador no topo). O valor chega de secoes.js
   pelo evento "meter"; a cor do marcador vem da variável CSS --c da seção. */
import * as THREE from 'three';
import { movimentoReduzido } from './util.js';

const secao = document.getElementById('nb');
const moldura = document.querySelector('#mt .mv');
const canvas = document.getElementById('mcv');

const renderizador = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance',
});
renderizador.setClearColor(0, 0);
renderizador.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
renderizador.toneMapping = THREE.ACESFilmicToneMapping;
renderizador.toneMappingExposure = 1.05;

const cena = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
camera.position.set(0, 1.6, 6.6);
camera.lookAt(0, 1.0, 0);
cena.add(new THREE.HemisphereLight(0xb9c4ff, 0x141a38, 1.15));
const luzPrincipal = new THREE.DirectionalLight(0xd8e0ff, 2.5);
luzPrincipal.position.set(-3.5, 4, 3);
cena.add(luzPrincipal);
const contraluz = new THREE.DirectionalLight(0x6a8cff, 2.2);
contraluz.position.set(4, 2, -3.5);
cena.add(contraluz);

/* ---------- relevo: ruído suave somado em várias escalas, com cristas ---------- */
const aleatorio = (x, y) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const interpolar = (a, b, t) => a + (b - a) * t;
const ruido = (x, y) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  return interpolar(
    interpolar(aleatorio(xi, yi), aleatorio(xi + 1, yi), u),
    interpolar(aleatorio(xi, yi + 1), aleatorio(xi + 1, yi + 1), u),
    v,
  );
};
/** 5 camadas de ruído em "crista"; `pesos` diz quanto cada camada (da maior para a menor) aparece */
const cristas = (x, y, pesos) => {
  let soma = 0;
  let frequencia = 1;
  for (let i = 0; i < 5; i++) {
    const n = 1 - Math.abs(2 * ruido(x * frequencia + i * 17.3, y * frequencia - i * 9.1) - 1);
    soma += pesos[i] * n * n;
    frequencia *= 2.07;
  }
  return soma;
};

const RAIO = 2.05;
let distancia = 0.06;
/** altura do terreno no ponto (x, z); quanto maior a distância, mais as camadas finas (ásperas) aparecem */
function altura(x, z, d) {
  const r = Math.hypot(x, z);
  const cone = Math.max(0, 1 - r / RAIO);
  const base = Math.pow(cone, 1.3);
  const pesos = [0.5, 0.28, 0.15 * (0.45 + d), 0.1 * (0.35 + 1.7 * d), 0.06 * (0.25 + 2.4 * d)];
  const crista = cristas(x * 1.5 + 7, z * 1.5 + 3, pesos);
  return base * (1.35 + 1.25 * crista) + Math.exp(-r * r * 5.5) * 0.62 * (1 - 0.32 * d);
}

const DIVISOES = 112;
const relevo = new THREE.PlaneGeometry(RAIO * 2.1, RAIO * 2.1, DIVISOES, DIVISOES);
relevo.rotateX(-Math.PI / 2);
const posicoes = relevo.attributes.position;
const cores = new Float32Array(posicoes.count * 3);
relevo.setAttribute('color', new THREE.BufferAttribute(cores, 3));
// cores por altura: base escura → roxo → lilás → "neve" nas partes altas e planas
const COR_BASE = new THREE.Color('#1c2150');
const COR_MEIO = new THREE.Color('#4a3f8c');
const COR_ALTA = new THREE.Color('#8f7fc4');
const COR_NEVE = new THREE.Color('#e4defa');
const cor = new THREE.Color();

/** refaz alturas e cores do terreno (e a trilha) para a distância `d` */
function moldarMontanha(d) {
  desenharTrilha(d);
  for (let i = 0; i < posicoes.count; i++) {
    posicoes.setY(i, altura(posicoes.getX(i), posicoes.getZ(i), d));
  }
  relevo.computeVertexNormals();
  const normais = relevo.attributes.normal;
  for (let i = 0; i < posicoes.count; i++) {
    const y = posicoes.getY(i);
    const t = Math.min(1, y / 2.1);
    const inclinacao = normais.getY(i); // 1 = plano, 0 = parede
    cor
      .copy(COR_BASE)
      .lerp(COR_MEIO, Math.min(1, t * 2.2))
      .lerp(COR_ALTA, Math.max(0, Math.min(1, (t - 0.28) * 2)));
    const neve = Math.max(0, Math.min(1, (t - 0.42) * 3.2)) * Math.max(0, Math.min(1, (inclinacao - 0.55) * 3));
    cor.lerp(COR_NEVE, neve * 0.85);
    const luz = 0.72 + 0.5 * inclinacao;
    cores[i * 3] = cor.r * luz;
    cores[i * 3 + 1] = cor.g * luz;
    cores[i * 3 + 2] = cor.b * luz;
  }
  relevo.attributes.color.needsUpdate = true;
  posicoes.needsUpdate = true;
  relevo.computeBoundingSphere();
}

// a borda do terreno some aos poucos (fica transparente a partir de 1,15 do centro)
const materialDoRelevo = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.78,
  metalness: 0.08,
  transparent: true,
  depthWrite: true,
});
materialDoRelevo.onBeforeCompile = (shader) => {
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying float vR;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvR = length(position.xz);');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying float vR;')
    .replace(
      '#include <color_fragment>',
      '#include <color_fragment>\ndiffuseColor.a *= 1.0 - smoothstep(1.15, 1.95, vR);',
    );
};
const grupo = new THREE.Group();
grupo.add(new THREE.Mesh(relevo, materialDoRelevo));
cena.add(grupo);

/** textura 128×128 com um gradiente redondo */
function gradienteRedondo(paradas) {
  const tela = document.createElement('canvas');
  tela.width = tela.height = 128;
  const contexto = tela.getContext('2d');
  const gradiente = contexto.createRadialGradient(64, 64, 0, 64, 64, 64);
  paradas.forEach(([posicao, corDaParada]) => gradiente.addColorStop(posicao, corDaParada));
  contexto.fillStyle = gradiente;
  contexto.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(tela);
}

/* sombra escura no chão */
const sombra = new THREE.Mesh(
  new THREE.PlaneGeometry(6.4, 6.4),
  new THREE.MeshBasicMaterial({
    map: gradienteRedondo([
      [0, 'rgba(0,0,0,.65)'],
      [0.6, 'rgba(0,0,0,.35)'],
      [1, 'rgba(0,0,0,0)'],
    ]),
    transparent: true,
    depthWrite: false,
  }),
);
sombra.rotation.x = -Math.PI / 2;
sombra.position.y = -0.01;
cena.add(sombra);

/* marcador luminoso (ponto + halo pulsante) */
const halo = new THREE.Sprite(
  new THREE.SpriteMaterial({
    map: gradienteRedondo([
      [0, 'rgba(255,255,255,1)'],
      [0.18, 'rgba(255,255,255,.9)'],
      [0.4, 'rgba(255,255,255,.28)'],
      [1, 'rgba(255,255,255,0)'],
    ]),
    transparent: true,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  }),
);
halo.scale.setScalar(0.85);
halo.renderOrder = 5;
grupo.add(halo);
const ponto = new THREE.Mesh(new THREE.SphereGeometry(0.07, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffffff }));
grupo.add(ponto);
const corDoMarcador = new THREE.Color('#b496ff');

/* trilha em espiral do pé ao topo; a parte já percorrida acende na cor da nota */
const posicaoNaTrilha = (d) => {
  const angulo = -0.55 + d * 2.6;
  const raio = d * 1.5;
  return [Math.cos(angulo) * raio, Math.sin(angulo) * raio];
};
const trilhaToda = new THREE.Mesh(
  new THREE.BufferGeometry(),
  new THREE.MeshBasicMaterial({ color: 0xdfe6ff, transparent: true, opacity: 0.6, depthWrite: false }),
);
const trilhaPercorrida = new THREE.Mesh(
  new THREE.BufferGeometry(),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false }),
);
grupo.add(trilhaToda, trilhaPercorrida);

function desenharTrilha(d) {
  // tubo que segue o terreno entre os pontos `de` e `ate` da trilha (0 = pé, 1 = topo)
  const tubo = (de, ate, espessura) => {
    const pontos = [];
    const passos = Math.max(2, Math.round(90 * (ate - de)));
    for (let i = 0; i <= passos; i++) {
      const s = de + ((ate - de) * i) / passos;
      const [x, z] = posicaoNaTrilha(s);
      pontos.push(new THREE.Vector3(x, altura(x, z, d) + 0.07, z));
    }
    return pontos.length > 2
      ? new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pontos), passos * 2, espessura, 5, false)
      : new THREE.BufferGeometry();
  };
  trilhaToda.geometry.dispose();
  trilhaPercorrida.geometry.dispose();
  trilhaToda.geometry = tubo(0, 1, 0.024);
  trilhaPercorrida.geometry = tubo(0, Math.max(0.001, d), 0.034);
}

/** coloca o marcador no ponto atual da trilha, na cor da nota */
function posicionarMarcador() {
  const [x, z] = posicaoNaTrilha(distancia);
  const y = altura(x, z, distancia) + 0.1;
  ponto.position.set(x, y, z);
  halo.position.set(x, y, z);
  corDoMarcador.set(getComputedStyle(secao).getPropertyValue('--c').trim() || '#b496ff');
  ponto.material.color.copy(corDoMarcador).lerp(new THREE.Color(1, 1, 1), 0.5);
  halo.material.color.copy(corDoMarcador);
  trilhaPercorrida.material.color.copy(corDoMarcador);
}

let distanciaAlvo = distancia;
let distanciaAtual = -1;
secao.addEventListener('meter', (evento) => {
  distanciaAlvo = evento.detail;
});

/* enquadra a montanha inteira (raio visível ~2) qualquer que seja a proporção do quadro */
function ajustarTamanho() {
  const larguraQuadro = canvas.clientWidth;
  const alturaQuadro = canvas.clientHeight;
  if (!larguraQuadro || !alturaQuadro) return;
  renderizador.setSize(larguraQuadro, alturaQuadro, false);
  camera.aspect = larguraQuadro / alturaQuadro;
  const proporcao = larguraQuadro / alturaQuadro;
  const tangente = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  camera.position.set(0, 1.6, Math.max(6.4, 2.3 / (tangente * Math.min(proporcao, 1.6)), 1.75 / tangente));
  camera.lookAt(0, 1.0, 0);
  camera.updateProjectionMatrix();
}
new ResizeObserver(ajustarTamanho).observe(canvas);
ajustarTamanho();

/* só desenha quando está na tela */
let visivel = false;
let ultimoQuadro = performance.now();
new IntersectionObserver((entradas) => {
  visivel = entradas[0].isIntersecting;
  ultimoQuadro = performance.now();
}).observe(moldura);

let tempoDoPulso = 0;
let giro = 0.5;
renderizador.setAnimationLoop((agora) => {
  if (!visivel) return;
  const dt = Math.min(0.05, (agora - ultimoQuadro) / 1000);
  ultimoQuadro = agora;
  // a distância desenhada persegue o alvo com suavidade; o terreno só é refeito quando ela muda
  if (Math.abs(distanciaAlvo - distanciaAtual) > 0.0005) {
    distanciaAtual =
      distanciaAtual < 0 ? distanciaAlvo : distanciaAtual + (distanciaAlvo - distanciaAtual) * (1 - Math.exp(-dt * 9));
    distancia = distanciaAtual;
    moldarMontanha(distancia);
  }
  tempoDoPulso += dt;
  if (!movimentoReduzido) giro += dt * 0.04;
  grupo.rotation.y = giro + distancia * 1.3;
  posicionarMarcador();
  halo.scale.setScalar(0.8 * (1 + 0.12 * Math.sin(tempoDoPulso * 2.4)));
  renderizador.render(cena, camera);
});
