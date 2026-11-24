/* Seção "Antes × depois": carro 3D (public/static/models/audi_rs5.glb) girando no cartão.
   O botão de tela cheia leva o mesmo canvas para uma camada por cima da página, onde dá para
   girar, aproximar e afastar com o mouse ou com os dedos. */
import * as THREE from 'three'; // biblioteca 3D. Ex.: new THREE.PerspectiveCamera(24, 2, 0.05, 100)
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'; // girar a câmera com mouse/dedos. Ex.: new OrbitControls(camera, canvas)
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'; // "sala" que dá reflexos realistas. Ex.: new RoomEnvironment()
import { conteudoDoAntesDepois } from './conteudo.js';
import { carregarModelo } from '../comum/modelo-3d.js';
import { densidadeDaTela, observarVisibilidade } from '../comum/utilidades.js';

/** Sombra redonda no chão (é esticada no tamanho do carro quando o modelo carrega). */
function criarSombra() {
  const tela = document.createElement('canvas');
  tela.width = 128;
  tela.height = 128;
  const contexto = tela.getContext('2d');
  const gradiente = contexto.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradiente.addColorStop(0, 'rgba(0,0,0,.6)');
  gradiente.addColorStop(0.6, 'rgba(0,0,0,.25)');
  gradiente.addColorStop(1, 'rgba(0,0,0,0)');
  contexto.fillStyle = gradiente;
  contexto.fillRect(0, 0, 128, 128);
  const sombra = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(tela), transparent: true, depthWrite: false }),
  );
  sombra.rotation.x = -Math.PI / 2;
  sombra.position.y = 0.005;
  return sombra;
}

/** Controles de órbita (só ligados na tela cheia): sem arrastar para os lados e sem olhar por baixo do chão. */
function criarControles(camera, canvas) {
  const controles = new OrbitControls(camera, canvas);
  controles.enabled = false;
  controles.enableDamping = true;
  controles.dampingFactor = 0.08;
  controles.enablePan = false;
  controles.maxPolarAngle = Math.PI / 2 - 0.04;
  return controles;
}

/** Vidro sem passe de transmissão (bem mais leve) e pintura fosca lisa, igual ao acabamento do carro do topo. */
function ajustarMaterial(material) {
  if (material && material.transmission > 0) {
    material.transmission = 0;
    material.transmissionMap = null;
    material.transparent = true;
    material.opacity = 0.45;
    material.depthWrite = false;
  } else if (material && /Paint_Material/.test(material.name)) {
    material.roughnessMap = null;
    material.metalnessMap = null;
    material.roughness = 0.5;
    material.metalness = 0.4;
    material.envMapIntensity = 0.6;
    if ('clearcoat' in material) material.clearcoat = 0;
    if ('specularIntensity' in material) material.specularIntensity = 0.32;
    if ('sheen' in material) {
      material.sheen = 0.4;
      material.sheenRoughness = 0.6;
      material.sheenColor = new THREE.Color(0.34, 0.4, 0.52);
    }
    material.needsUpdate = true;
  }
}

/** Enquadramento: no cartão, o carro inteiro cabe em qualquer ângulo do giro; na tela cheia, limita o zoom. */
function enquadrar(estado) {
  const { canvas, camera, renderizador, controles } = estado.pecas;
  const largura = canvas.clientWidth;
  const altura = canvas.clientHeight;
  if (largura && altura) {
    const proporcao = largura / altura;
    const tangente = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    renderizador.setSize(largura, altura, false);
    camera.aspect = proporcao;
    camera.updateProjectionMatrix();
    if (estado.telaCheia) {
      controles.minDistance = estado.medidas.comprimento * 0.6;
      controles.maxDistance = estado.medidas.comprimento * 4;
    } else {
      // raio do giro = meia diagonal do carro visto de cima; a ponta mais próxima ainda ganha margem de perspectiva
      const { comprimento, largura: larguraDoCarro, altura: alturaDoCarro } = estado.medidas;
      const raio = Math.hypot(comprimento / 2, larguraDoCarro / 2);
      const distancia = Math.max(
        (raio * 1.04) / (tangente * proporcao) + raio * 0.5,
        (alturaDoCarro * 1.0) / tangente + raio * 0.5,
      );
      camera.position.set(0, alturaDoCarro * 1.15, distancia);
      camera.lookAt(0, alturaDoCarro * 0.42, 0);
    }
  }
}

/** Coloca o modelo: centralizado, com 4,4 de comprimento, apoiado no chão; a sombra acompanha o tamanho. */
function colocarModelo(gltf, estado) {
  const modelo = gltf.scene;
  modelo.traverse((objeto) => {
    if (objeto.isMesh) {
      objeto.frustumCulled = false;
      [].concat(objeto.material).forEach(ajustarMaterial);
    }
  });
  modelo.updateMatrixWorld(true);
  const limites = new THREE.Box3().setFromObject(modelo);
  const tamanho = limites.getSize(new THREE.Vector3());
  const centro = limites.getCenter(new THREE.Vector3());
  const escala = 4.4 / Math.max(tamanho.x, tamanho.z);
  const ajuste = new THREE.Group();
  const medidas = { comprimento: 4.4, altura: tamanho.y * escala, largura: Math.min(tamanho.x, tamanho.z) * escala };
  ajuste.add(modelo);
  ajuste.scale.setScalar(escala);
  ajuste.position.set(-centro.x * escala, -limites.min.y * escala, -centro.z * escala);
  estado.pecas.carro.add(ajuste);
  estado.medidas = medidas;
  if (tamanho.x > tamanho.z) {
    estado.pecas.sombra.scale.set(medidas.comprimento * 1.12, medidas.largura * 1.5, 1);
  } else {
    estado.pecas.sombra.scale.set(medidas.largura * 1.5, medidas.comprimento * 1.12, 1);
  }
  estado.pecas.controles.target.set(0, medidas.altura * 0.4, 0);
  enquadrar(estado);
  estado.pronto = true;
  atualizarLaco(estado);
}

/** Um quadro: gira sempre para a direita (inclusive com "reduzir movimento"); na tela cheia, quem gira é a pessoa. */
function desenharQuadro(estado, agora) {
  const segundos = Math.max(0, Math.min(0.05, (agora - estado.ultimoQuadro) / 1000));
  estado.ultimoQuadro = agora;
  if (estado.telaCheia) {
    estado.pecas.controles.update();
  } else {
    estado.angulo -= segundos * 0.3;
    estado.pecas.carro.rotation.y = estado.angulo;
  }
  estado.pecas.renderizador.render(estado.pecas.cena, estado.pecas.camera);
}

/** Só desenha com o modelo pronto e o carro na tela (ou na tela cheia). */
function atualizarLaco(estado) {
  const desenhar = estado.pronto && (estado.visivel || estado.telaCheia);
  if (desenhar !== estado.desenhando) {
    estado.desenhando = desenhar;
    estado.ultimoQuadro = performance.now();
    estado.pecas.renderizador.setAnimationLoop(desenhar ? (tempo) => desenharQuadro(estado, tempo) : null);
  }
}

/* ---------- tela cheia ---------- */

/** Monta a camada da tela cheia: nome e resumo do carro, botão de fechar e dica de uso. */
function criarCamada() {
  const textos = conteudoDoAntesDepois().carro;
  const camada = document.createElement('div');
  const topo = document.createElement('div');
  const titulo = document.createElement('div');
  const nome = document.createElement('b');
  const resumo = document.createElement('small');
  const botaoFechar = document.createElement('button');
  const dica = document.createElement('div');
  camada.className = 'tela-cheia';
  camada.setAttribute('role', 'dialog');
  camada.setAttribute('aria-modal', 'true');
  camada.setAttribute('aria-label', 'Modelo 3D do veículo');
  topo.className = 'tela-cheia-topo';
  nome.textContent = textos.nome;
  resumo.textContent = textos.resumo;
  titulo.append(nome, document.createElement('br'), resumo);
  botaoFechar.type = 'button';
  botaoFechar.className = 'botao-tela-cheia';
  botaoFechar.setAttribute('aria-label', 'Fechar tela cheia');
  botaoFechar.title = 'Minimizar (Esc)';
  botaoFechar.innerHTML = "<svg viewBox='0 0 24 24'><path d='M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5'/></svg>";
  topo.append(titulo, botaoFechar);
  dica.className = 'tela-cheia-dica';
  dica.textContent = textos.dica;
  camada.append(topo, dica);
  return camada;
}

function abrirTelaCheia(estado) {
  if (!estado.telaCheia) {
    const { canvas, camera, carro, controles } = estado.pecas;
    const camada = criarCamada();
    const anguloAtual = carro.rotation.y; // a câmera começa do ângulo em que o carro estava girando
    estado.telaCheia = true;
    estado.camada = camada;
    camada.append(canvas);
    document.body.append(camada);
    document.documentElement.style.overflow = 'hidden';
    carro.rotation.y = 0;
    enquadrar(estado);
    const tangente = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const { comprimento, altura } = estado.medidas;
    const distancia = Math.max((comprimento * 0.62) / (tangente * camera.aspect), (altura * 1.6) / tangente);
    camera.position.set(Math.sin(-anguloAtual) * distancia, altura * 1.3, Math.cos(-anguloAtual) * distancia);
    controles.target.set(0, altura * 0.4, 0);
    controles.enabled = true;
    canvas.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => camada.classList.add('ativo'));
    enquadrar(estado);
    controles.update();
    const botaoFechar = camada.querySelector('.botao-tela-cheia');
    botaoFechar.addEventListener('click', () => fecharTelaCheia(estado));
    botaoFechar.focus();
    addEventListener('keydown', estado.fecharComEsc);
    atualizarLaco(estado);
  }
}

function fecharTelaCheia(estado) {
  if (estado.telaCheia) {
    const { canvas, camera, carro, controles, moldura, botaoTelaCheia } = estado.pecas;
    estado.telaCheia = false;
    controles.enabled = false;
    removeEventListener('keydown', estado.fecharComEsc);
    // volta a girar a partir do ângulo em que a pessoa deixou
    estado.angulo = -Math.atan2(camera.position.x, camera.position.z);
    carro.rotation.y = estado.angulo;
    moldura.prepend(canvas);
    canvas.setAttribute('aria-hidden', 'true');
    estado.camada.remove();
    estado.camada = null;
    document.documentElement.style.overflow = '';
    estado.ultimoQuadro = performance.now();
    enquadrar(estado);
    botaoTelaCheia.focus();
    atualizarLaco(estado);
  }
}

/** Monta a cena do carro, liga o giro e o botão de tela cheia. */
export function iniciarCarroComparacao() {
  const moldura = document.querySelector('.carro .carro-visor');
  const canvas = moldura.querySelector('.tela-carro-3d');
  const renderizador = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  const cena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(24, 2, 0.05, 100);
  const luzPrincipal = new THREE.DirectionalLight(0xffffff, 1.6);
  const contraluz = new THREE.DirectionalLight(0x7fd4ff, 1.7);
  const sombra = criarSombra();
  const carro = new THREE.Group();
  const pecas = {
    moldura,
    canvas,
    renderizador,
    cena,
    camera,
    sombra,
    carro,
    controles: criarControles(camera, canvas),
    botaoTelaCheia: moldura.querySelector('.botao-tela-cheia'),
  };
  const estado = {
    pecas,
    medidas: { comprimento: 4.4, altura: 1.3, largura: 1.9 }, // atualizadas quando o modelo carrega
    pronto: false,
    visivel: false,
    desenhando: false,
    telaCheia: false,
    camada: null,
    angulo: -0.6,
    ultimoQuadro: performance.now(),
    fecharComEsc: null,
  };

  estado.fecharComEsc = (evento) => {
    if (evento.key === 'Escape') fecharTelaCheia(estado);
  };
  renderizador.setClearColor(0, 0);
  renderizador.setPixelRatio(densidadeDaTela(1.5));
  renderizador.toneMapping = THREE.ACESFilmicToneMapping;
  renderizador.toneMappingExposure = 1.05;
  cena.environment = new THREE.PMREMGenerator(renderizador).fromScene(new RoomEnvironment(), 0.04).texture;
  luzPrincipal.position.set(-3, 4, 3);
  cena.add(luzPrincipal);
  contraluz.position.set(4, 2, -4);
  cena.add(contraluz);
  carro.add(sombra);
  cena.add(carro);

  carregarModelo('/static/models/audi_rs5.glb', (gltf) => colocarModelo(gltf, estado));
  new ResizeObserver(() => enquadrar(estado)).observe(canvas);
  enquadrar(estado);
  observarVisibilidade(canvas, (visivel) => {
    estado.visivel = visivel;
    atualizarLaco(estado);
  });
  pecas.botaoTelaCheia.addEventListener('click', () => abrirTelaCheia(estado));
  canvas.addEventListener('click', () => abrirTelaCheia(estado));
}
