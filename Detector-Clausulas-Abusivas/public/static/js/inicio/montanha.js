/* Montanha 3D da seção "Nota de confiabilidade" (desenhada no código, sem arquivo de modelo).
   distância 0 = contrato perto da curva de referência (montanha suave, marcador no pé);
   distância 1 = longe da curva (cristas mais ásperas, marcador no topo).
   A distância e a cor da nota chegam de secoes.js pelo evento "mudou-distancia" da seção #nota.

   Desempenho: a altura do terreno muda de forma linear com a distância. Por isso o relevo é calculado
   uma vez só, nas duas pontas (distância 0 e 1), e cada quadro apenas mistura as duas — em vez de refazer
   o ruído inteiro (milhares de senos) a cada movimento da rolagem. */
import * as THREE from 'three'; // biblioteca 3D. Ex.: new THREE.PlaneGeometry(4, 4, 112, 112)
import { densidadeDaTela, movimentoReduzido, observarVisibilidade } from '../comum/utilidades.js';

/* ---------- relevo: ruído suave somado em várias escalas, com cristas ---------- */

/** Número "aleatório" fixo para cada ponto da grade (o mesmo ponto sempre dá o mesmo número). */
function aleatorio(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  const numero = s - Math.floor(s);
  return numero;
}

function interpolar(a, b, t) {
  const valor = a + (b - a) * t;
  return valor;
}

/** Ruído suave: mistura os números aleatórios dos 4 cantos da casa da grade onde o ponto está. */
function ruido(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const valor = interpolar(
    interpolar(aleatorio(xi, yi), aleatorio(xi + 1, yi), u),
    interpolar(aleatorio(xi, yi + 1), aleatorio(xi + 1, yi + 1), u),
    v,
  );
  return valor;
}

/** 5 camadas de ruído em "crista"; `pesos` diz quanto cada camada (da maior para a menor) aparece. */
function cristas(x, y, pesos) {
  let soma = 0;
  let frequencia = 1;
  for (let i = 0; i < 5; i++) {
    const n = 1 - Math.abs(2 * ruido(x * frequencia + i * 17.3, y * frequencia - i * 9.1) - 1);
    soma += pesos[i] * n * n;
    frequencia *= 2.07;
  }
  return soma;
}

/** Raio da montanha (a borda do terreno some aos poucos a partir daqui). */
function raioDaMontanha() {
  const raio = 2.05;
  return raio;
}

/** Altura do terreno no ponto (x, z); quanto maior a distância, mais as camadas finas (ásperas) aparecem. */
function altura(x, z, distancia) {
  const r = Math.hypot(x, z);
  const cone = Math.max(0, 1 - r / raioDaMontanha());
  const base = Math.pow(cone, 1.3);
  const pesos = [0.5, 0.28, 0.15 * (0.45 + distancia), 0.1 * (0.35 + 1.7 * distancia), 0.06 * (0.25 + 2.4 * distancia)];
  const crista = cristas(x * 1.5 + 7, z * 1.5 + 3, pesos);
  const resultado = base * (1.35 + 1.25 * crista) + Math.exp(-r * r * 5.5) * 0.62 * (1 - 0.32 * distancia);
  return resultado;
}

/** Cria a grade do terreno e calcula, uma vez só, a altura de cada ponto nas duas pontas (distância 0 e 1). */
function criarRelevo() {
  const divisoes = 112;
  const raio = raioDaMontanha();
  const geometria = new THREE.PlaneGeometry(raio * 2.1, raio * 2.1, divisoes, divisoes);
  geometria.rotateX(-Math.PI / 2);
  const posicoes = geometria.attributes.position;
  const alturaPerto = new Float32Array(posicoes.count);
  const alturaLonge = new Float32Array(posicoes.count);
  for (let i = 0; i < posicoes.count; i++) {
    alturaPerto[i] = altura(posicoes.getX(i), posicoes.getZ(i), 0);
    alturaLonge[i] = altura(posicoes.getX(i), posicoes.getZ(i), 1);
  }
  geometria.setAttribute('color', new THREE.BufferAttribute(new Float32Array(posicoes.count * 3), 3));
  const relevo = { geometria, alturaPerto, alturaLonge };
  return relevo;
}

/** Cores por altura: base escura → roxo → lilás → "neve" nas partes altas e planas. */
function coresDoRelevo() {
  const cores = {
    base: new THREE.Color('#1c2150'),
    meio: new THREE.Color('#4a3f8c'),
    alta: new THREE.Color('#8f7fc4'),
    neve: new THREE.Color('#e4defa'),
  };
  return cores;
}

/** Refaz alturas e cores do terreno para a distância pedida (misturando as duas pontas já calculadas). */
function moldarRelevo(relevo, distancia, paleta) {
  const posicoes = relevo.geometria.attributes.position;
  const coresDosPontos = relevo.geometria.attributes.color.array;
  const cor = new THREE.Color();

  for (let i = 0; i < posicoes.count; i++) {
    posicoes.setY(i, relevo.alturaPerto[i] + (relevo.alturaLonge[i] - relevo.alturaPerto[i]) * distancia);
  }
  relevo.geometria.computeVertexNormals();
  const normais = relevo.geometria.attributes.normal;
  for (let i = 0; i < posicoes.count; i++) {
    const t = Math.min(1, posicoes.getY(i) / 2.1);
    const inclinacao = normais.getY(i); // 1 = plano, 0 = parede
    const neve = Math.max(0, Math.min(1, (t - 0.42) * 3.2)) * Math.max(0, Math.min(1, (inclinacao - 0.55) * 3));
    const luz = 0.72 + 0.5 * inclinacao;
    cor
      .copy(paleta.base)
      .lerp(paleta.meio, Math.min(1, t * 2.2))
      .lerp(paleta.alta, Math.max(0, Math.min(1, (t - 0.28) * 2)));
    cor.lerp(paleta.neve, neve * 0.85);
    coresDosPontos[i * 3] = cor.r * luz;
    coresDosPontos[i * 3 + 1] = cor.g * luz;
    coresDosPontos[i * 3 + 2] = cor.b * luz;
  }
  relevo.geometria.attributes.color.needsUpdate = true;
  posicoes.needsUpdate = true;
  relevo.geometria.computeBoundingSphere();
}

/** A borda do terreno some aos poucos (fica transparente a partir de 1,15 do centro). */
function criarMaterialDoRelevo() {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.78,
    metalness: 0.08,
    transparent: true,
    depthWrite: true,
  });
  material.onBeforeCompile = (shader) => {
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
  return material;
}

/** Textura 128×128 com um degradê redondo. */
function gradienteRedondo(paradas) {
  const tela = document.createElement('canvas');
  tela.width = 128;
  tela.height = 128;
  const contexto = tela.getContext('2d');
  const gradiente = contexto.createRadialGradient(64, 64, 0, 64, 64, 64);
  paradas.forEach(([posicao, cor]) => gradiente.addColorStop(posicao, cor));
  contexto.fillStyle = gradiente;
  contexto.fillRect(0, 0, 128, 128);
  const textura = new THREE.CanvasTexture(tela);
  return textura;
}

/** Sombra escura no chão. */
function criarSombra() {
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
  return sombra;
}

/** Marcador luminoso: ponto branco + halo que pulsa. */
function criarMarcador() {
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
  const ponto = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  halo.scale.setScalar(0.85);
  halo.renderOrder = 5;
  const marcador = { halo, ponto };
  return marcador;
}

/* ---------- trilha em espiral do pé ao topo; a parte já percorrida acende na cor da nota ---------- */

/** Ponto (x, z) da trilha para uma posição de 0 (pé) a 1 (topo). */
function posicaoNaTrilha(distancia) {
  const angulo = -0.55 + distancia * 2.6;
  const raio = distancia * 1.5;
  const ponto = [Math.cos(angulo) * raio, Math.sin(angulo) * raio];
  return ponto;
}

function criarTrilhas() {
  const trilhas = {
    toda: new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({ color: 0xdfe6ff, transparent: true, opacity: 0.6, depthWrite: false }),
    ),
    percorrida: new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false }),
    ),
  };
  return trilhas;
}

/** Tubo que segue o terreno entre os pontos `de` e `ate` da trilha (0 = pé, 1 = topo). */
function tuboDaTrilha(de, ate, espessura, distancia) {
  const pontos = [];
  const passos = Math.max(2, Math.round(90 * (ate - de)));
  for (let i = 0; i <= passos; i++) {
    const s = de + ((ate - de) * i) / passos;
    const [x, z] = posicaoNaTrilha(s);
    pontos.push(new THREE.Vector3(x, altura(x, z, distancia) + 0.07, z));
  }
  const tubo =
    pontos.length > 2
      ? new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pontos), passos * 2, espessura, 5, false)
      : new THREE.BufferGeometry();
  return tubo;
}

function desenharTrilhas(trilhas, distancia) {
  trilhas.toda.geometry.dispose();
  trilhas.percorrida.geometry.dispose();
  trilhas.toda.geometry = tuboDaTrilha(0, 1, 0.024, distancia);
  trilhas.percorrida.geometry = tuboDaTrilha(0, Math.max(0.001, distancia), 0.034, distancia);
}

/** Coloca o marcador no ponto atual da trilha, na cor da nota. */
function posicionarMarcador(estado) {
  const [x, z] = posicaoNaTrilha(estado.distancia);
  const y = altura(x, z, estado.distancia) + 0.1;
  const { ponto, halo } = estado.marcador;
  ponto.position.set(x, y, z);
  halo.position.set(x, y, z);
  ponto.material.color.copy(estado.corDaNota).lerp(estado.branco, 0.5);
  halo.material.color.copy(estado.corDaNota);
  estado.trilhas.percorrida.material.color.copy(estado.corDaNota);
}

/** Enquadra a montanha inteira (raio visível ~2) qualquer que seja a proporção do quadro. */
function ajustarTamanho(pecas) {
  const largura = pecas.canvas.clientWidth;
  const alturaDoQuadro = pecas.canvas.clientHeight;
  if (largura && alturaDoQuadro) {
    const proporcao = largura / alturaDoQuadro;
    const tangente = Math.tan(THREE.MathUtils.degToRad(pecas.camera.fov / 2));
    pecas.renderizador.setSize(largura, alturaDoQuadro, false);
    pecas.camera.aspect = proporcao;
    pecas.camera.position.set(0, 1.6, Math.max(6.4, 2.3 / (tangente * Math.min(proporcao, 1.6)), 1.75 / tangente));
    pecas.camera.lookAt(0, 1.0, 0);
    pecas.camera.updateProjectionMatrix();
  }
}

/** Um quadro: a distância desenhada persegue o alvo com suavidade; o terreno só é refeito quando ela muda. */
function desenharQuadro(estado, agora) {
  const segundos = Math.max(0, Math.min(0.05, (agora - estado.ultimoQuadro) / 1000));
  estado.ultimoQuadro = agora;
  if (Math.abs(estado.distanciaAlvo - estado.distanciaDesenhada) > 0.0005) {
    estado.distanciaDesenhada =
      estado.distanciaDesenhada < 0
        ? estado.distanciaAlvo
        : estado.distanciaDesenhada +
          (estado.distanciaAlvo - estado.distanciaDesenhada) * (1 - Math.exp(-segundos * 9));
    estado.distancia = estado.distanciaDesenhada;
    desenharTrilhas(estado.trilhas, estado.distancia);
    moldarRelevo(estado.relevo, estado.distancia, estado.paleta);
  }
  estado.tempoDoPulso += segundos;
  if (!movimentoReduzido()) estado.giro += segundos * 0.04;
  estado.grupo.rotation.y = estado.giro + estado.distancia * 1.3;
  posicionarMarcador(estado);
  estado.marcador.halo.scale.setScalar(0.8 * (1 + 0.12 * Math.sin(estado.tempoDoPulso * 2.4)));
  estado.pecas.renderizador.render(estado.pecas.cena, estado.pecas.camera);
}

/** Monta a cena da montanha e liga a animação (só desenha enquanto está na tela). */
export function iniciarMontanha() {
  const secao = document.getElementById('nota');
  const moldura = document.querySelector('#cartao-montanha .montanha-quadro');
  const canvas = document.getElementById('tela-montanha');
  const renderizador = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  const cena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  const luzPrincipal = new THREE.DirectionalLight(0xd8e0ff, 2.5);
  const contraluz = new THREE.DirectionalLight(0x6a8cff, 2.2);
  const relevo = criarRelevo();
  const grupo = new THREE.Group();
  const marcador = criarMarcador();
  const trilhas = criarTrilhas();
  const pecas = { canvas, renderizador, cena, camera };
  const estado = {
    pecas,
    relevo,
    grupo,
    marcador,
    trilhas,
    paleta: coresDoRelevo(),
    distancia: 0.06,
    distanciaAlvo: Number(secao.dataset.distancia) || 0.06, // secoes.js guarda aqui a distância atual (0 = ainda no começo)
    distanciaDesenhada: -1,
    corDaNota: new THREE.Color(secao.style.getPropertyValue('--cor-nota').trim() || '#b496ff'),
    branco: new THREE.Color(1, 1, 1),
    tempoDoPulso: 0,
    giro: 0.5,
    ultimoQuadro: performance.now(),
  };

  renderizador.setClearColor(0, 0);
  renderizador.setPixelRatio(densidadeDaTela(1.5));
  renderizador.toneMapping = THREE.ACESFilmicToneMapping;
  renderizador.toneMappingExposure = 1.05;
  camera.position.set(0, 1.6, 6.6);
  camera.lookAt(0, 1.0, 0);
  cena.add(new THREE.HemisphereLight(0xb9c4ff, 0x141a38, 1.15));
  luzPrincipal.position.set(-3.5, 4, 3);
  cena.add(luzPrincipal);
  contraluz.position.set(4, 2, -3.5);
  cena.add(contraluz);
  grupo.add(new THREE.Mesh(relevo.geometria, criarMaterialDoRelevo()));
  cena.add(grupo);
  cena.add(criarSombra());
  grupo.add(marcador.halo, marcador.ponto, trilhas.toda, trilhas.percorrida);

  secao.addEventListener('mudou-distancia', (evento) => {
    estado.distanciaAlvo = evento.detail.distancia;
    estado.corDaNota.set(evento.detail.cor);
  });
  new ResizeObserver(() => ajustarTamanho(pecas)).observe(canvas);
  ajustarTamanho(pecas);
  observarVisibilidade(moldura, (visivel) => {
    estado.ultimoQuadro = performance.now();
    renderizador.setAnimationLoop(visivel ? (tempo) => desenharQuadro(estado, tempo) : null);
  });
}
