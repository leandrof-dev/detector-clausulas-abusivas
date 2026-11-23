/* Cena 3D do topo: fundo, piso espelhado, luzes e o carro (public/static/models/car.glb).
   criarCenaDoTopo() monta tudo e devolve as peças que a animação (topo.js) controla. */
import * as THREE from 'three'; // biblioteca 3D. Ex.: new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material)
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js'; // prepara as luzes retangulares. Ex.: RectAreaLightUniformsLib.init()
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'; // "sala" que dá reflexos realistas. Ex.: new RoomEnvironment()
import { Reflector } from 'three/addons/objects/Reflector.js'; // superfície espelhada. Ex.: new Reflector(new THREE.PlaneGeometry(9, 9))
import { carregarModelo } from '../comum/modelo-3d.js';
import { densidadeDaTela } from '../comum/utilidades.js';

/** Cor de fundo da cena (a mesma do fundo da página). */
function corDeFundo() {
  const cor = 0x04070d;
  return cor;
}

/* Shader do piso espelhado: borra o reflexo aos poucos com a distância, clareia perto do carro
   e some longe; sem "tone mapping" e com mistura neutra = mesma cor do fundo, sem emenda no horizonte. */
function shaderDoPiso() {
  const shader = {
    name: 'Refl',
    uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null } },
    vertexShader: `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec3 vW;
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vW = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
    fragmentShader: `
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    varying vec4 vUv;
    varying vec3 vW;
    vec4 tp(vec2 o) {
      return texture2DProj(tDiffuse, vUv + vec4(o * vUv.w, 0.0, 0.0));
    }
    void main() {
      float d = length(vW.xz);
      float rd = 0.0016 + 0.0105 * smoothstep(0.2, 5.5, d);
      float a0 = 6.2831 * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
      vec4 b = tp(vec2(0.0)) * 0.16;
      for (int i = 0; i < 8; i++) {
        float a = a0 + float(i) * 0.785398;
        vec2 o = vec2(cos(a), sin(a)) * rd * (i % 2 == 0 ? 1.0 : 0.55);
        b += tp(o * vec2(0.5625, 1.0)) * 0.105;
      }
      vec3 c = b.rgb / max(b.a, 0.0001);
      c = c * (1.0 + c / 4.0) / (1.0 + c);
      float f = 1.0 - smoothstep(2.0, 9.0, d);
      float near = 1.0 + 0.35 * (1.0 - smoothstep(0.0, 2.4, d));
      gl_FragColor = vec4(c * color, b.a * f * 0.62 * near);
      #include <colorspace_fragment>
    }`,
  };
  return shader;
}

/* Brilho "perolado" só nas bordas e curvas da lataria (a cor original não muda).
   uPc = cor do brilho, uPk = força; `termoBrilho` decide o quanto superfícies ásperas brilham. */
function brilhoPerolado(termoBrilho) {
  const trecho = `#include <emissivemap_fragment>
  {
    float fr = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 2.2);
    float gl = clamp((metalnessFactor * 0.6 + 0.4) * ${termoBrilho} * 1.6, 0.0, 1.0);
    totalEmissiveRadiance += uPc * uPk * fr * gl;
  }`;
  return trecho;
}

/** Textura com um degradê redondo (para o brilho e a sombra no chão). */
function gradienteRedondo(paradas) {
  const tela = document.createElement('canvas');
  tela.width = 256;
  tela.height = 256;
  const contexto = tela.getContext('2d');
  const gradiente = contexto.createRadialGradient(128, 128, 0, 128, 128, 128);
  paradas.forEach(([posicao, cor]) => gradiente.addColorStop(posicao, cor));
  contexto.fillStyle = gradiente;
  contexto.fillRect(0, 0, 256, 256);
  const textura = new THREE.CanvasTexture(tela);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

/** Fundo: escuro onde há texto, cinza-azulado claro ao redor do carro e no piso (o piso espelha este fundo). */
function desenharFundo() {
  const tela = document.createElement('canvas');
  tela.width = 1024;
  tela.height = 512;
  const contexto = tela.getContext('2d');
  // degradê vertical
  const vertical = contexto.createLinearGradient(0, 0, 0, 512);
  [
    [0, '#060a13'],
    [0.12, '#0b1220'],
    [0.24, '#18223a'],
    [0.34, '#2e3a52'],
    [0.42, '#566279'],
    [0.49, '#7a869d'],
    [0.56, '#6c7890'],
    [0.66, '#4c5871'],
    [0.78, '#333d54'],
    [0.9, '#1f2739'],
    [1, '#161d2c'],
  ].forEach(([posicao, cor]) => vertical.addColorStop(posicao, cor));
  contexto.fillStyle = vertical;
  contexto.fillRect(0, 0, 1024, 512);
  // clarão atrás do carro
  const clarao = contexto.createRadialGradient(640, 230, 0, 640, 230, 430);
  clarao.addColorStop(0, 'rgba(215,226,247,.34)');
  clarao.addColorStop(0.6, 'rgba(150,170,205,.1)');
  clarao.addColorStop(1, 'rgba(150,170,205,0)');
  contexto.fillStyle = clarao;
  contexto.fillRect(0, 0, 1024, 512);
  // escurece a esquerda, onde fica o texto
  const lateral = contexto.createLinearGradient(0, 0, 1024, 0);
  lateral.addColorStop(0, 'rgba(4,7,13,.66)');
  lateral.addColorStop(0.25, 'rgba(4,7,13,.5)');
  lateral.addColorStop(0.5, 'rgba(4,7,13,.28)');
  lateral.addColorStop(0.78, 'rgba(4,7,13,0)');
  contexto.fillStyle = lateral;
  contexto.fillRect(0, 0, 1024, 512);
  // arcos de luz e a linha do horizonte
  contexto.shadowColor = 'rgba(150,190,255,.8)';
  contexto.shadowBlur = 24;
  contexto.lineWidth = 3;
  [
    [1010, -110, 540, 430, 0.3],
    [1180, -40, 360, 330, 0.2],
  ].forEach(([x, y, raioX, raioY, opacidade]) => {
    contexto.strokeStyle = 'rgba(190,215,255,' + opacidade + ')';
    contexto.beginPath();
    contexto.ellipse(x, y, raioX, raioY, 0, 0, 6.283);
    contexto.stroke();
  });
  contexto.strokeStyle = 'rgba(235,243,255,.55)';
  contexto.beginPath();
  contexto.moveTo(0, 398);
  contexto.bezierCurveTo(260, 410, 640, 452, 1024, 520);
  contexto.stroke();
  const textura = new THREE.CanvasTexture(tela);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

/** Deita um objeto no chão (plano XZ), na altura pedida, e o coloca na cena. */
function deitar(cena, objeto, altura) {
  objeto.rotation.x = -Math.PI / 2;
  objeto.position.y = altura;
  cena.add(objeto);
  return objeto;
}

/** Piso espelhado; o reflexo é desenhado a cada 2 quadros (mais leve) e sem o fundo: só o carro aparece no piso. */
function criarPiso(cena) {
  const piso = new Reflector(new THREE.PlaneGeometry(60, 60), {
    shader: shaderDoPiso(),
    textureWidth: 512,
    textureHeight: 512,
    color: new THREE.Color(1, 1, 1),
    clipBias: 0.003,
  });
  const desenharReflexo = piso.onBeforeRender;
  const contagem = { quadro: 0 };

  deitar(cena, piso, 0);
  piso.material.transparent = true;
  piso.material.depthWrite = false;
  piso.renderOrder = 2;
  piso.onBeforeRender = function (renderer, scene, ...resto) {
    if (!(contagem.quadro++ & 1)) {
      const fundo = scene.background;
      const alfa = renderer.getClearAlpha();
      scene.background = null;
      renderer.setClearColor(0x000000, 0);
      desenharReflexo.call(this, renderer, scene, ...resto);
      scene.background = fundo;
      renderer.setClearColor(corDeFundo(), alfa);
    }
  };
  return piso;
}

/** Brilho colorido no chão (a cor muda com a etapa) e dois anéis finos em volta do carro. */
function criarBrilhoEAneis(cena) {
  const brilho = deitar(
    cena,
    new THREE.Mesh(
      new THREE.PlaneGeometry(15, 15),
      new THREE.MeshBasicMaterial({
        map: gradienteRedondo([
          [0, '#fff'],
          [1, 'rgba(255,255,255,0)'],
        ]),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    ),
    0.004,
  );
  brilho.renderOrder = 3;
  [
    [3.4, 0.3],
    [4.5, 0.16],
  ].forEach(([raio, opacidade]) =>
    deitar(
      cena,
      new THREE.Mesh(
        new THREE.RingGeometry(raio, raio + 0.025, 160),
        new THREE.MeshBasicMaterial({
          color: 0x9cc2ff,
          transparent: true,
          opacity: opacidade,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      ),
      0.006,
    ),
  );
  return brilho;
}

/** Grupo do carro (é ele que gira); a sombra embaixo gira junto. */
function criarGrupoDoCarro(cena) {
  const carro = new THREE.Group();
  const sombra = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 6.4),
    new THREE.MeshBasicMaterial({
      map: gradienteRedondo([
        [0, '#000'],
        [1, 'rgba(0,0,0,0)'],
      ]),
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  sombra.rotation.x = -Math.PI / 2;
  sombra.position.y = 0.008;
  carro.add(sombra);
  cena.add(carro);
  return carro;
}

/** Vidro sem passe de transmissão (bem mais leve): escuro, liso e meio transparente. */
function ajustarVidro(material) {
  material.transmission = 0;
  material.transmissionMap = null;
  material.thickness = 0;
  material.transparent = true;
  material.opacity = 0.55;
  material.color.multiplyScalar(0.15);
  material.roughness = Math.min(material.roughness, 0.08);
  material.depthWrite = false;
  material.envMapIntensity = 1;
}

/** Pintura fosca acetinada: sem verniz, aspereza alta e "sheen" suave; a cor original continua. */
function ajustarPintura(material) {
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
  material.aoMapIntensity = 0.3;
}

/** Materiais do modelo: brilho perolado nas bordas, pintura fosca e vidro leve. Faróis e luzes ficam como estão. */
function ajustarMaterial(material, perolado, anisotropia) {
  if (material) {
    ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'].forEach((mapa) => {
      if (material[mapa]) material[mapa].anisotropy = anisotropia;
    });
    if (material.transmission > 0) {
      ajustarVidro(material);
    } else if (!(material.emissive && material.emissive.getHex() !== 0)) {
      const pintura = material.name === 'CarPaint';
      // pintura: o brilho perolado não depende da aspereza (0.55 fixo); nos demais, superfícies lisas brilham mais
      const termoBrilho = pintura ? '0.55' : '(1.0-roughnessFactor)';
      material.envMapIntensity = 0.45;
      material.onBeforeCompile = (shader) => {
        shader.uniforms.uPc = perolado.cor;
        shader.uniforms.uPk = perolado.forca;
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform vec3 uPc;uniform float uPk;')
          .replace('#include <emissivemap_fragment>', brilhoPerolado(termoBrilho));
      };
      if (pintura) {
        ajustarPintura(material);
        material.customProgramCacheKey = () => 'pearl-matte';
      } else {
        material.customProgramCacheKey = () => 'pearl';
      }
      material.needsUpdate = true;
    }
  }
}

/** Coloca o modelo no grupo do carro: centralizado, com 4,6 de comprimento e apoiado no chão. */
function colocarModelo(gltf, carro, perolado, anisotropia) {
  const modelo = gltf.scene;
  modelo.updateMatrixWorld(true);
  const limites = new THREE.Box3().setFromObject(modelo);
  const tamanho = limites.getSize(new THREE.Vector3());
  const centro = limites.getCenter(new THREE.Vector3());
  const escala = 4.6 / Math.max(tamanho.z, tamanho.x);
  const ajuste = new THREE.Group();
  ajuste.add(modelo);
  ajuste.scale.setScalar(escala);
  ajuste.position.set(-centro.x * escala, -limites.min.y * escala, -centro.z * escala);
  modelo.traverse((objeto) => {
    if (objeto.isMesh) {
      objeto.frustumCulled = false;
      [].concat(objeto.material).forEach((material) => ajustarMaterial(material, perolado, anisotropia));
    }
  });
  carro.add(ajuste);
}

/** Ajusta o tamanho do desenho à tela: no computador o carro fica na metade direita (o texto ocupa a esquerda);
    no celular, mais acima. */
function ajustarTamanho(pecas) {
  const largura = pecas.canvas.clientWidth;
  const altura = pecas.canvas.clientHeight;
  const celular = largura < 900;
  pecas.renderizador.setSize(largura, altura, false);
  pecas.camera.aspect = largura / altura;
  pecas.camera.setViewOffset(
    largura,
    altura,
    celular ? 0 : -largura * 0.07,
    celular ? -altura * 0.12 : 0,
    largura,
    altura,
  );
  pecas.piso.getRenderTarget().setSize(largura * pecas.resolucao * 0.5, altura * pecas.resolucao * 0.5);
}

/** Muda a resolução do desenho (usado quando o computador não aguenta o ritmo). */
export function mudarResolucao(pecas, valor) {
  pecas.resolucao = valor;
  pecas.renderizador.setPixelRatio(valor);
  ajustarTamanho(pecas);
}

/** Monta a cena do topo e devolve as peças que a animação controla. */
export function criarCenaDoTopo() {
  const canvas = document.getElementById('tela-topo');
  const resolucao = densidadeDaTela(1.5); // telas muito densas desenhariam pixels demais
  const renderizador = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const cena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  // luzes: principal (quase branca, à frente) e contraluz (atrás, na cor da etapa)
  const luzPrincipal = new THREE.RectAreaLight(0xffffff, 6, 6, 2.6);
  const contraluz = new THREE.RectAreaLight(0x2f7dff, 6, 7, 2.2);
  const perolado = { cor: { value: new THREE.Color() }, forca: { value: 0 } };

  renderizador.setPixelRatio(resolucao);
  renderizador.setClearColor(corDeFundo(), 1);
  renderizador.toneMapping = THREE.ACESFilmicToneMapping;
  renderizador.toneMappingExposure = 1;
  RectAreaLightUniformsLib.init();
  cena.background = desenharFundo();
  cena.environment = new THREE.PMREMGenerator(renderizador).fromScene(new RoomEnvironment(), 0.04).texture;
  contraluz.position.set(5, 2.4, -4.5);
  contraluz.lookAt(0, 0.8, 0);
  cena.add(luzPrincipal, contraluz);

  const pecas = {
    canvas,
    renderizador,
    cena,
    camera,
    luzPrincipal,
    contraluz,
    piso: criarPiso(cena),
    brilho: criarBrilhoEAneis(cena),
    carro: criarGrupoDoCarro(cena),
    perolado,
    resolucao,
  };
  const anisotropia = Math.min(8, renderizador.capabilities.getMaxAnisotropy());
  carregarModelo('/static/models/car.glb', (gltf) => colocarModelo(gltf, pecas.carro, perolado, anisotropia));
  new ResizeObserver(() => ajustarTamanho(pecas)).observe(canvas);
  ajustarTamanho(pecas);
  return pecas;
}
