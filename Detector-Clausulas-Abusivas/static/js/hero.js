/* Topo da página (hero): textos que trocam por etapa, painel "Análise do seu contrato" e a animação do carro.
   A rolagem dentro de #track (430vh no CSS) é o "controle" de tudo: progresso 0 = topo, 1 = fim do hero.
   Cena 3D em hero-cena.js · cores em hero-cores.js · textos e números em conteudo.js. */
import * as THREE from 'three';
import { HERO } from './conteudo.js';
import { criarCena } from './hero-cena.js';
import {
  AZUL_CONTRALUZ,
  BRANCO_DA_LUZ,
  CORES_DA_INTERFACE,
  CORES_DA_LUZ,
  NEUTRA,
  corDaEtapa,
  luminancia,
  misturarOklab,
} from './hero-cores.js';
import { formatarDecimal, formatarReais, limitar, suavizar } from './util.js';

try {
  history.scrollRestoration = 'manual'; // ao recarregar, volta ao topo (a animação depende da rolagem)
} catch {
  // navegador antigo sem essa opção: segue normalmente
}

/* ---------- textos por etapa: seguem a rolagem real, nos dois sentidos ---------- */
const criarFrases = (caixa, frases) =>
  frases.map((frase, i) => {
    const span = document.createElement('span');
    span.innerHTML = frase;
    if (!i) span.className = 'on';
    caixa.append(span);
    return span;
  });
const titulos = criarFrases(document.getElementById('hl'), HERO.titulos);
const subtitulos = criarFrases(document.getElementById('slg'), HERO.subtitulos);
const etiqueta = document.getElementById('stgt');
let etapaAtual = 0;

/** a frase antiga sai para um lado e a nova entra do outro (direcao: 1 descendo, -1 subindo) */
const trocarFrase = (frases, de, para, direcao) => {
  const saindo = frases[de];
  const entrando = frases[para];
  entrando.style.transition = 'none'; // posiciona a nova frase sem animar…
  entrando.style.opacity = 0;
  entrando.style.filter = 'blur(10px)';
  entrando.style.transform = 'translateY(' + 22 * direcao + 'px)';
  void entrando.offsetWidth; // …força o navegador a aplicar…
  entrando.style.transition = ''; // …e então anima até a posição final
  entrando.style.opacity = 1;
  entrando.style.filter = 'none';
  entrando.style.transform = 'none';
  saindo.style.opacity = 0;
  saindo.style.filter = 'blur(10px)';
  saindo.style.transform = 'translateY(' + -22 * direcao + 'px)';
};

function mudarEtapa(nova) {
  if (nova === etapaAtual) return;
  const direcao = nova > etapaAtual ? 1 : -1;
  trocarFrase(titulos, etapaAtual, nova, direcao);
  trocarFrase(subtitulos, etapaAtual, nova, direcao);
  etapaAtual = nova;
  etiqueta.style.opacity = 0;
  setTimeout(() => {
    etiqueta.textContent = HERO.etiquetas[etapaAtual];
    etiqueta.style.opacity = 1;
  }, 220);
}

/* ---------- painel "Análise do seu contrato": os valores vão de "antes" para "depois" com a rolagem ---------- */
const FORMATOS = {
  reais: formatarReais,
  taxa: (valor) => formatarDecimal(valor, 1) + '% a.m.',
  porcentagem: (valor) => Math.round(valor) + '%',
};
const linhasDoPainel = HERO.painel.map((item) => {
  const linha = document.createElement('div');
  linha.className = 'r';
  linha.innerHTML = '<span>' + item.rotulo + '</span><b></b>';
  document.getElementById('rows').append(linha);
  return { ...item, valor: linha.querySelector('b'), formatar: FORMATOS[item.formato] };
});

const trilho = document.getElementById('track'); // a altura dele define quanto se rola dentro do hero
const hero = document.getElementById('hero');
const painel = document.getElementById('panel');
const legendaDoPainel = document.getElementById('cap');
const barraDoPainel = document.getElementById('bar');
const iconeAlerta = document.getElementById('ic1');
const iconeOk = document.getElementById('ic2');
const setaRolar = document.getElementById('hint');
const blocoDeTexto = document.querySelector('.copy');

/* ---------- cena 3D ---------- */
const {
  canvas,
  renderizador,
  cena,
  camera,
  luzPrincipal,
  contraluz,
  brilho,
  carro,
  perolado,
  mudarResolucao,
  resolucaoAtual,
} = criarCena();

/* ---------- giro do carro ---------- */
const ANGULO_INICIAL = 0.75; // começa virado para o painel
const GIRO_TOTAL = 1.5 + 2 * Math.PI; // uma volta completa e termina virado para o texto
const anguloPelaRolagem = (progresso) => ANGULO_INICIAL - GIRO_TOTAL * suavizar(0, 1, progresso);
/** ângulo equivalente entre -π e π */
const normalizarAngulo = (a) => ((((a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;

let progresso = 0; // 0 a 1, segue a rolagem com suavidade
let atividade = 0; // 0 = vitrine (página parada no topo), 1 = rolando
let anguloVitrine = ANGULO_INICIAL; // giro lento enquanto ninguém rola
let deslize = 0; // diferença que some aos poucos ao sair da vitrine (evita salto)
let giroExtra = 0; // giro que continua depois do fim da animação
let velocidadeGiro = 0;
let angulo = ANGULO_INICIAL;
let estavaParado = true;
let chegouAoFim = false;
let legendaAtual = -1;
let ultimoQuadro = performance.now();
const inicio = ultimoQuadro;
// últimos valores aplicados (só mexe na página quando algo mudou)
let ultimoProgresso = -1;
let ultimaAtividade = -1;
let ultimaSaida = -1;
let ultimaSeta = -1;
// medição de desempenho
let somaDosIntervalos = 0;
let quadrosMedidos = 0;

scrollTo(0, 0);
let heroVisivel = true;
new IntersectionObserver((entradas) => {
  heroVisivel = entradas[0].isIntersecting;
}).observe(hero);

renderizador.setAnimationLoop((agora) => {
  if (!heroVisivel) {
    ultimoQuadro = agora;
    return;
  }
  const intervalo = (agora - ultimoQuadro) / 1000;
  const dt = Math.min(0.05, intervalo); // segundos desde o último quadro (no máximo 0,05)
  ultimoQuadro = agora;
  const alturaRolavel = Math.max(1, trilho.offsetHeight - innerHeight);
  const alvo = limitar(scrollY / alturaRolavel);

  /* progresso segue a rolagem nos dois sentidos, suavizado (sem saltos): descer avança, subir retrocede */
  progresso += (alvo - progresso) * (1 - Math.exp(-dt * 7));
  if (Math.abs(alvo - progresso) < 1e-4) progresso = alvo;
  chegouAoFim = progresso > 0.985;
  const parado = alvo < 0.004 && progresso < 0.01;
  atividade += ((parado ? 0 : 1) - atividade) * (1 - Math.exp(-dt * 2.4));

  /* rotação: vitrine em repouso → giro guiado pela rolagem → depois do verde continua girando;
     ao subir, esse giro extra se desfaz suavemente até a volta inteira mais próxima */
  if (chegouAoFim) {
    velocidadeGiro += (0.17 - velocidadeGiro) * (1 - Math.exp(-dt * 1.6));
    giroExtra += velocidadeGiro * dt;
  } else {
    velocidadeGiro = 0;
    const voltaInteira = Math.round(giroExtra / (2 * Math.PI)) * 2 * Math.PI;
    giroExtra += (voltaInteira - giroExtra) * (1 - Math.exp(-dt * 3));
  }
  if (parado) {
    if (!estavaParado) {
      anguloVitrine = anguloPelaRolagem(progresso) + deslize + giroExtra;
      deslize = 0;
      giroExtra = 0;
    }
    anguloVitrine -= 0.17 * dt;
    angulo = anguloVitrine;
  } else {
    if (estavaParado) {
      deslize = normalizarAngulo(anguloVitrine - anguloPelaRolagem(progresso));
      giroExtra = 0;
    }
    deslize *= Math.exp(-dt * 2.5);
    angulo = anguloPelaRolagem(progresso) + deslize + giroExtra;
  }
  estavaParado = parado;
  carro.rotation.y = angulo;

  /* câmera: distância que enquadra o carro na largura da tela; aproxima um pouco no fim */
  const distancia = limitar(4.3 / (0.46 * 2 * Math.tan(0.2618) * camera.aspect), 7, 14);
  camera.position.set(0, 1.7 - 0.15 * progresso, distancia * (1 - 0.05 * progresso));
  camera.lookAt(0, 0.8, 0);

  /* etapa dos textos; a margem (histerese) evita piscar perto dos limites */
  {
    const SOBE = [0.32, 0.7];
    const DESCE = [0.28, 0.66];
    let etapa = etapaAtual;
    while (etapa < 2 && progresso >= SOBE[etapa]) etapa++;
    while (etapa > 0 && progresso < DESCE[etapa - 1]) etapa--;
    mudarEtapa(etapa);
  }

  if (Math.abs(progresso - ultimoProgresso) > 1e-4 || Math.abs(atividade - ultimaAtividade) > 1e-4) {
    ultimoProgresso = progresso;
    ultimaAtividade = atividade;
    const avanco = suavizar(0.1, 0.96, progresso); // 0 → valores "antes", 1 → valores "depois"
    const corDaLuz = corDaEtapa(CORES_DA_LUZ, progresso);
    const forca = 0.1 + 0.9 * atividade;

    /* luzes: a principal fica quase branca (o carro mantém a cor real dele);
       a cor da etapa vai para o contraluz, o brilho do chão e o ambiente */
    const corPrincipal = BRANCO_DA_LUZ.clone().lerp(corDaLuz, 0.1 * forca);
    luzPrincipal.color.copy(corPrincipal);
    luzPrincipal.intensity = limitar(2.4 / luminancia(corPrincipal), 3, 6);
    luzPrincipal.position.set(
      THREE.MathUtils.lerp(-5, 2, suavizar(0.1, 1, progresso)),
      2.3 + 0.5 * progresso,
      5 - 1.4 * progresso,
    );
    luzPrincipal.lookAt(0, 0.7, 0);
    const corContraluz = AZUL_CONTRALUZ.clone().lerp(misturarOklab(AZUL_CONTRALUZ, corDaLuz, 0.5), forca);
    contraluz.color.copy(corContraluz);
    contraluz.intensity = limitar(1.3 / Math.max(0.05, luminancia(corContraluz)), 3, 9);
    brilho.material.color
      .copy(NEUTRA)
      .multiplyScalar(0.25)
      .lerp(corDaLuz.clone().multiplyScalar(0.2 / Math.max(0.08, luminancia(corDaLuz))), forca * 0.4);
    brilho.material.opacity = 0.3 + 0.25 * atividade;

    /* interface: cor de destaque (--acc), brilho perolado do carro e tom do ambiente (--amb) */
    const corDaInterface = corDaEtapa(CORES_DA_INTERFACE, progresso);
    perolado.cor.value
      .copy(NEUTRA)
      .lerp(corDaInterface.clone().multiplyScalar(0.3 / Math.max(0.12, luminancia(corDaInterface))), forca * 0.5);
    perolado.forca.value = 0.1 + 0.1 * atividade;
    hero.style.setProperty('--amb', (0.75 * atividade).toFixed(3));
    hero.style.setProperty('--acc', '#' + corDaInterface.getHexString());

    /* painel */
    linhasDoPainel.forEach((linha) => {
      linha.valor.textContent = linha.formatar(linha.antes + (linha.depois - linha.antes) * avanco);
    });
    barraDoPainel.style.width = 32 + 62 * avanco + '%';
    iconeAlerta.style.opacity = 1 - suavizar(0.7, 0.95, progresso);
    iconeOk.style.opacity = suavizar(0.7, 0.95, progresso);
    let legenda = legendaAtual < 0 ? (progresso < 0.3 ? 0 : progresso < 0.78 ? 1 : 2) : legendaAtual;
    const LEGENDA_SOBE = [0.3, 0.78];
    const LEGENDA_DESCE = [0.27, 0.75];
    while (legenda < 2 && progresso >= LEGENDA_SOBE[legenda]) legenda++;
    while (legenda > 0 && progresso < LEGENDA_DESCE[legenda - 1]) legenda--;
    if (legenda !== legendaAtual) {
      legendaAtual = legenda;
      legendaDoPainel.textContent = HERO.legendasDoPainel[legenda];
    }
    hero.style.setProperty('--w', 6 + 8 * progresso + 'vw'); // largura da linha embaixo do título
  }

  /* fim do hero: texto e painel somem com desfoque enquanto a página seguinte sobe */
  {
    const saida = limitar((scrollY - (alturaRolavel - innerHeight * 0.5)) / (innerHeight * 0.42));
    const saidaSuave = saida * saida * (3 - 2 * saida);
    if (saidaSuave !== ultimaSaida) {
      ultimaSaida = saidaSuave;
      blocoDeTexto.style.opacity = 1 - saidaSuave;
      blocoDeTexto.style.filter = saidaSuave ? 'blur(' + (saidaSuave * 10).toFixed(1) + 'px)' : '';
      blocoDeTexto.style.translate = '0 ' + (-saidaSuave * 46).toFixed(1) + 'px';
      painel.style.opacity = 1 - saidaSuave * 0.9;
      painel.style.filter = saidaSuave ? 'blur(' + (saidaSuave * 8).toFixed(1) + 'px)' : '';
      canvas.style.opacity = 1 - saidaSuave * 0.15;
    }
  }
  /* seta "role para baixo": some assim que a pessoa começa a rolar */
  const opacidadeSeta = chegouAoFim ? 0 : +limitar(1 - scrollY / 70).toFixed(2);
  if (opacidadeSeta !== ultimaSeta) {
    ultimaSeta = opacidadeSeta;
    setaRolar.style.opacity = opacidadeSeta;
  }

  renderizador.render(cena, camera);

  /* resolução adaptativa: se a média de 40 quadros passar de 28 ms, reduz a resolução (nunca sobe de novo) */
  if (agora - inicio > 3000 && intervalo < 0.25) {
    somaDosIntervalos += intervalo;
    if (++quadrosMedidos >= 40) {
      const media = somaDosIntervalos / quadrosMedidos;
      somaDosIntervalos = 0;
      quadrosMedidos = 0;
      if (media > 0.028 && resolucaoAtual() > 0.8) mudarResolucao(Math.max(0.8, resolucaoAtual() - 0.2));
    }
  }
});
