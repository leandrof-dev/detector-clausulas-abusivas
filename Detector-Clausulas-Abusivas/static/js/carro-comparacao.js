/* Seção "Antes × depois": carro 3D (static/models/audi_rs5.glb) girando no cartão.
   O botão de tela cheia leva o mesmo canvas para uma camada por cima da página, onde dá para
   girar, aproximar e afastar com o mouse ou com os dedos. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CARRO_COMPARACAO } from './conteudo.js';
import { carregarModelo } from './modelo-3d.js';

const blocoDoCarro = document.querySelector('.carw');
const moldura = blocoDoCarro && blocoDoCarro.querySelector('.cvw');
const canvas = moldura && moldura.querySelector('.car3');
const botaoTelaCheia = moldura && moldura.querySelector('.fsb');

if (canvas) {
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
  const camera = new THREE.PerspectiveCamera(24, 2, 0.05, 100);
  cena.environment = new THREE.PMREMGenerator(renderizador).fromScene(new RoomEnvironment(), 0.04).texture;
  const luzPrincipal = new THREE.DirectionalLight(0xffffff, 1.6);
  luzPrincipal.position.set(-3, 4, 3);
  cena.add(luzPrincipal);
  const contraluz = new THREE.DirectionalLight(0x7fd4ff, 1.7);
  contraluz.position.set(4, 2, -4);
  cena.add(contraluz);

  /* sombra redonda no chão (esticada no tamanho do carro quando o modelo carrega) */
  const telaSombra = document.createElement('canvas');
  telaSombra.width = telaSombra.height = 128;
  {
    const contexto = telaSombra.getContext('2d');
    const gradiente = contexto.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradiente.addColorStop(0, 'rgba(0,0,0,.6)');
    gradiente.addColorStop(0.6, 'rgba(0,0,0,.25)');
    gradiente.addColorStop(1, 'rgba(0,0,0,0)');
    contexto.fillStyle = gradiente;
    contexto.fillRect(0, 0, 128, 128);
  }
  const sombra = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(telaSombra), transparent: true, depthWrite: false }),
  );
  sombra.rotation.x = -Math.PI / 2;
  sombra.position.y = 0.005;
  const carro = new THREE.Group();
  carro.add(sombra);
  cena.add(carro);

  let pronto = false;
  let comprimento = 4.4; // medidas do carro na cena (atualizadas quando o modelo carrega)
  let altura = 1.3;
  let largura = 1.9;
  let telaCheia = false;
  const controles = new OrbitControls(camera, canvas);
  controles.enabled = false;
  controles.enableDamping = true;
  controles.dampingFactor = 0.08;
  controles.enablePan = false;
  controles.maxPolarAngle = Math.PI / 2 - 0.04; // não deixa olhar por baixo do chão

  /* enquadramento: no cartão, o carro inteiro cabe em qualquer ângulo do giro */
  function enquadrar() {
    const larguraQuadro = canvas.clientWidth;
    const alturaQuadro = canvas.clientHeight;
    if (!larguraQuadro || !alturaQuadro) return;
    renderizador.setSize(larguraQuadro, alturaQuadro, false);
    const proporcao = larguraQuadro / alturaQuadro;
    const tangente = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.aspect = proporcao;
    camera.updateProjectionMatrix();
    if (telaCheia) {
      controles.minDistance = comprimento * 0.6;
      controles.maxDistance = comprimento * 4;
      return;
    }
    // raio do giro = meia diagonal do carro visto de cima; a ponta mais próxima ainda ganha margem de perspectiva
    const raio = Math.hypot(comprimento / 2, largura / 2);
    const distancia = Math.max(
      (raio * 1.04) / (tangente * proporcao) + raio * 0.5,
      (altura * 1.0) / tangente + raio * 0.5,
    );
    camera.position.set(0, altura * 1.15, distancia);
    camera.lookAt(0, altura * 0.42, 0);
  }

  carregarModelo('/static/models/audi_rs5.glb', (gltf) => {
    const modelo = gltf.scene;
    modelo.traverse((objeto) => {
      if (!objeto.isMesh) return;
      objeto.frustumCulled = false;
      [].concat(objeto.material).forEach((material) => {
        if (!material) return;
        // vidro sem passe de transmissão (bem mais leve), como no carro do topo
        if (material.transmission > 0) {
          material.transmission = 0;
          material.transmissionMap = null;
          material.transparent = true;
          material.opacity = 0.45;
          material.depthWrite = false;
          return;
        }
        // pintura fosca lisa, igual ao acabamento do carro do topo
        if (/Paint_Material/.test(material.name)) {
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
      });
    });
    // centraliza o modelo com 4,4 de comprimento, apoiado no chão
    modelo.updateMatrixWorld(true);
    const limites = new THREE.Box3().setFromObject(modelo);
    const tamanho = limites.getSize(new THREE.Vector3());
    const centro = limites.getCenter(new THREE.Vector3());
    const escala = 4.4 / Math.max(tamanho.x, tamanho.z);
    const ajuste = new THREE.Group();
    ajuste.add(modelo);
    ajuste.scale.setScalar(escala);
    ajuste.position.set(-centro.x * escala, -limites.min.y * escala, -centro.z * escala);
    carro.add(ajuste);
    comprimento = 4.4;
    altura = tamanho.y * escala;
    largura = Math.min(tamanho.x, tamanho.z) * escala;
    if (tamanho.x > tamanho.z) sombra.scale.set(comprimento * 1.12, largura * 1.5, 1);
    else sombra.scale.set(largura * 1.5, comprimento * 1.12, 1);
    controles.target.set(0, altura * 0.4, 0);
    enquadrar();
    pronto = true;
  });
  new ResizeObserver(enquadrar).observe(canvas);
  enquadrar();

  /* gira sempre para a direita, como o carro do topo (inclusive com "reduzir movimento" ligado); só desenha na tela */
  let ultimoQuadro = performance.now();
  let angulo = -0.6;
  renderizador.setAnimationLoop((agora) => {
    const dt = Math.min(0.05, (agora - ultimoQuadro) / 1000);
    ultimoQuadro = agora;
    if (!pronto) return;
    if (!telaCheia) {
      const caixa = canvas.getBoundingClientRect();
      if (caixa.bottom < 0 || caixa.top > innerHeight) return;
    }
    if (telaCheia) controles.update();
    else {
      angulo -= dt * 0.3;
      carro.rotation.y = angulo;
    }
    renderizador.render(cena, camera);
  });

  /* ---------- tela cheia ---------- */
  let camada = null;
  function abrirTelaCheia() {
    if (telaCheia) return;
    telaCheia = true;
    camada = document.createElement('div');
    camada.className = 'c3o';
    camada.setAttribute('role', 'dialog');
    camada.setAttribute('aria-modal', 'true');
    camada.setAttribute('aria-label', 'Modelo 3D do veículo');
    camada.innerHTML = `<div class='c3h'><div><b>${CARRO_COMPARACAO.nome}</b><br><small>${CARRO_COMPARACAO.resumo}</small></div><button type='button' class='fsb' aria-label='Fechar tela cheia' title='Minimizar (Esc)'><svg viewBox='0 0 24 24'><path d='M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5'/></svg></button></div><div class='c3t'>${CARRO_COMPARACAO.dica}</div>`;
    camada.append(canvas);
    document.body.append(camada);
    document.documentElement.style.overflow = 'hidden';
    // a câmera começa do ângulo em que o carro estava girando
    const anguloAtual = carro.rotation.y;
    carro.rotation.y = 0;
    enquadrar();
    const tangente = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const distancia = Math.max((comprimento * 0.62) / (tangente * camera.aspect), (altura * 1.6) / tangente);
    camera.position.set(Math.sin(-anguloAtual) * distancia, altura * 1.3, Math.cos(-anguloAtual) * distancia);
    controles.target.set(0, altura * 0.4, 0);
    controles.enabled = true;
    canvas.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => camada.classList.add('on'));
    enquadrar();
    controles.update();
    const botaoFechar = camada.querySelector('.fsb');
    botaoFechar.addEventListener('click', fecharTelaCheia);
    botaoFechar.focus();
    addEventListener('keydown', fecharComEsc);
  }
  function fecharTelaCheia() {
    if (!telaCheia) return;
    telaCheia = false;
    controles.enabled = false;
    removeEventListener('keydown', fecharComEsc);
    // volta a girar a partir do ângulo em que a pessoa deixou
    angulo = -Math.atan2(camera.position.x, camera.position.z);
    carro.rotation.y = angulo;
    moldura.prepend(canvas);
    canvas.setAttribute('aria-hidden', 'true');
    camada.remove();
    camada = null;
    document.documentElement.style.overflow = '';
    ultimoQuadro = performance.now();
    enquadrar();
    botaoTelaCheia.focus();
  }
  const fecharComEsc = (evento) => {
    if (evento.key === 'Escape') fecharTelaCheia();
  };
  botaoTelaCheia.addEventListener('click', abrirTelaCheia);
  canvas.addEventListener('click', () => {
    if (!telaCheia) abrirTelaCheia();
  });
}
