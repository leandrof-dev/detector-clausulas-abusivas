/* Topo da página: textos que trocam por etapa, painel "Análise do seu contrato" e a animação do carro.
   A rolagem dentro de #trilho-topo (430vh no CSS) controla tudo: progresso 0 = começo do topo, 1 = fim.
   Cena 3D em topo-cena.js · cores em topo-cores.js · textos e números em conteudo.js. */
import * as THREE from 'three'; // biblioteca 3D. Ex.: THREE.MathUtils.lerp(0, 10, 0.5) → 5
import { conteudoDoTopo } from './conteudo.js';
import { criarCenaDoTopo, mudarResolucao } from './topo-cena.js';
import { corDaEtapa, luminancia, misturarOklab, paletaDoTopo } from './topo-cores.js';
import {
  formatarDecimal,
  formatarReais,
  limitar,
  observarVisibilidade,
  seguir,
  suavizar,
} from '../comum/utilidades.js';

/* ---------- textos por etapa: seguem a rolagem real, nos dois sentidos ---------- */

/** Coloca as frases empilhadas dentro da caixa (só a primeira aparece) e devolve a lista delas. */
function criarFrases(caixa, frases) {
  const elementos = frases.map((frase, indice) => {
    const elemento = document.createElement('span');
    elemento.innerHTML = frase; // as frases vêm do conteudo.js (texto fixo do site)
    if (indice === 0) elemento.className = 'ativo';
    caixa.append(elemento);
    return elemento;
  });
  return elementos;
}

/** A frase antiga sai para um lado e a nova entra do outro (direcao: 1 descendo, -1 subindo). */
function trocarFrase(frases, de, para, direcao) {
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
}

function mudarEtapa(estado, nova) {
  if (nova !== estado.etapaAtual) {
    const direcao = nova > estado.etapaAtual ? 1 : -1;
    trocarFrase(estado.titulos, estado.etapaAtual, nova, direcao);
    trocarFrase(estado.subtitulos, estado.etapaAtual, nova, direcao);
    estado.etapaAtual = nova;
    estado.pagina.etiqueta.style.opacity = 0;
    setTimeout(() => {
      estado.pagina.etiqueta.textContent = estado.conteudo.etiquetas[estado.etapaAtual];
      estado.pagina.etiqueta.style.opacity = 1;
    }, 220);
  }
}

/** Etapa dos textos pela rolagem; a margem (histerese) evita piscar perto dos limites. */
function escolherEtapa(estado) {
  const sobe = [0.32, 0.7];
  const desce = [0.28, 0.66];
  let etapa = estado.etapaAtual;
  while (etapa < 2 && estado.progresso >= sobe[etapa]) etapa++;
  while (etapa > 0 && estado.progresso < desce[etapa - 1]) etapa--;
  mudarEtapa(estado, etapa);
}

/* ---------- painel "Análise do seu contrato": os valores vão de "antes" para "depois" com a rolagem ---------- */

/** Como cada tipo de valor aparece no painel. */
function formatosDoPainel() {
  const formatos = {
    reais: formatarReais,
    taxa: (valor) => formatarDecimal(valor, 1) + '% a.m.',
    porcentagem: (valor) => Math.round(valor) + '%',
  };
  return formatos;
}

/** Cria as linhas do painel (rótulo à esquerda, valor à direita) e devolve a lista com o elemento de cada valor. */
function criarLinhasDoPainel(itens) {
  const formatos = formatosDoPainel();
  const caixa = document.getElementById('painel-linhas');
  const linhas = itens.map((item) => {
    const linha = document.createElement('div');
    const rotulo = document.createElement('span');
    const valor = document.createElement('b');
    linha.className = 'painel-linha';
    rotulo.textContent = item.rotulo;
    linha.append(rotulo, valor);
    caixa.append(linha);
    return { ...item, valor, formatar: formatos[item.formato] };
  });
  return linhas;
}

/** Legenda do painel conforme a rolagem (com a mesma margem anti-pisca das etapas). */
function atualizarLegenda(estado) {
  const sobe = [0.3, 0.78];
  const desce = [0.27, 0.75];
  const progresso = estado.progresso;
  let legenda = estado.legendaAtual;
  if (legenda < 0) {
    legenda = progresso < 0.3 ? 0 : progresso < 0.78 ? 1 : 2;
  }
  while (legenda < 2 && progresso >= sobe[legenda]) legenda++;
  while (legenda > 0 && progresso < desce[legenda - 1]) legenda--;
  if (legenda !== estado.legendaAtual) {
    estado.legendaAtual = legenda;
    estado.pagina.legendaDoPainel.textContent = estado.conteudo.legendasDoPainel[legenda];
  }
}

/* ---------- giro do carro ---------- */

/** Ângulo do carro para um progresso de rolagem: começa virado para o painel, dá uma volta e termina virado para o texto. */
function anguloPelaRolagem(progresso) {
  const anguloInicial = 0.75;
  const giroTotal = 1.5 + 2 * Math.PI;
  const angulo = anguloInicial - giroTotal * suavizar(0, 1, progresso);
  return angulo;
}

/** Ângulo equivalente entre -π e π. */
function normalizarAngulo(angulo) {
  const normalizado = ((((angulo + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
  return normalizado;
}

/** Rotação: vitrine em repouso → giro guiado pela rolagem → depois do verde continua girando;
    ao subir, esse giro extra se desfaz suavemente até a volta inteira mais próxima. */
function girarCarro(estado, segundos, parado) {
  if (estado.chegouAoFim) {
    estado.velocidadeGiro += (0.17 - estado.velocidadeGiro) * (1 - Math.exp(-segundos * 1.6));
    estado.giroExtra += estado.velocidadeGiro * segundos;
  } else {
    const voltaInteira = Math.round(estado.giroExtra / (2 * Math.PI)) * 2 * Math.PI;
    estado.velocidadeGiro = 0;
    estado.giroExtra += (voltaInteira - estado.giroExtra) * (1 - Math.exp(-segundos * 3));
  }
  if (parado) {
    if (!estado.estavaParado) {
      estado.anguloVitrine = anguloPelaRolagem(estado.progresso) + estado.deslize + estado.giroExtra;
      estado.deslize = 0;
      estado.giroExtra = 0;
    }
    estado.anguloVitrine -= 0.17 * segundos;
    estado.angulo = estado.anguloVitrine;
  } else {
    if (estado.estavaParado) {
      estado.deslize = normalizarAngulo(estado.anguloVitrine - anguloPelaRolagem(estado.progresso));
      estado.giroExtra = 0;
    }
    estado.deslize *= Math.exp(-segundos * 2.5);
    estado.angulo = anguloPelaRolagem(estado.progresso) + estado.deslize + estado.giroExtra;
  }
  estado.estavaParado = parado;
  estado.pecas.carro.rotation.y = estado.angulo;
}

/** Câmera: distância que enquadra o carro na largura da tela; aproxima um pouco no fim. */
function posicionarCamera(estado) {
  const camera = estado.pecas.camera;
  const distancia = limitar(4.3 / (0.46 * 2 * Math.tan(0.2618) * camera.aspect), 7, 14);
  camera.position.set(0, 1.7 - 0.15 * estado.progresso, distancia * (1 - 0.05 * estado.progresso));
  camera.lookAt(0, 0.8, 0);
}

/** Luzes, cores da interface e valores do painel (só quando o progresso ou a atividade mudaram). */
function atualizarCoresEPainel(estado) {
  const { pecas, paleta, progresso, atividade } = estado;
  const avanco = suavizar(0.1, 0.96, progresso); // 0 → valores "antes", 1 → valores "depois"
  const corDaLuz = corDaEtapa(paleta.luz, progresso);
  const forca = 0.1 + 0.9 * atividade;

  /* luzes: a principal fica quase branca (o carro mantém a cor real dele);
     a cor da etapa vai para o contraluz, o brilho do chão e o ambiente */
  const corPrincipal = paleta.brancoDaLuz.clone().lerp(corDaLuz, 0.1 * forca);
  pecas.luzPrincipal.color.copy(corPrincipal);
  pecas.luzPrincipal.intensity = limitar(2.4 / luminancia(corPrincipal), 3, 6);
  pecas.luzPrincipal.position.set(
    THREE.MathUtils.lerp(-5, 2, suavizar(0.1, 1, progresso)),
    2.3 + 0.5 * progresso,
    5 - 1.4 * progresso,
  );
  pecas.luzPrincipal.lookAt(0, 0.7, 0);
  const corContraluz = paleta.azulContraluz.clone().lerp(misturarOklab(paleta.azulContraluz, corDaLuz, 0.5), forca);
  pecas.contraluz.color.copy(corContraluz);
  pecas.contraluz.intensity = limitar(1.3 / Math.max(0.05, luminancia(corContraluz)), 3, 9);
  pecas.brilho.material.color
    .copy(paleta.neutra)
    .multiplyScalar(0.25)
    .lerp(corDaLuz.clone().multiplyScalar(0.2 / Math.max(0.08, luminancia(corDaLuz))), forca * 0.4);
  pecas.brilho.material.opacity = 0.3 + 0.25 * atividade;

  /* interface: cor de destaque (--cor-etapa), brilho perolado do carro e tom do ambiente (--ambiente) */
  const corDaInterface = corDaEtapa(paleta.interface, progresso);
  pecas.perolado.cor.value
    .copy(paleta.neutra)
    .lerp(corDaInterface.clone().multiplyScalar(0.3 / Math.max(0.12, luminancia(corDaInterface))), forca * 0.5);
  pecas.perolado.forca.value = 0.1 + 0.1 * atividade;
  estado.pagina.topo.style.setProperty('--ambiente', (0.75 * atividade).toFixed(3));
  estado.pagina.topo.style.setProperty('--cor-etapa', '#' + corDaInterface.getHexString());

  /* painel */
  estado.linhasDoPainel.forEach((linha) => {
    linha.valor.textContent = linha.formatar(linha.antes + (linha.depois - linha.antes) * avanco);
  });
  estado.pagina.barraDoPainel.style.width = 32 + 62 * avanco + '%';
  estado.pagina.iconeAlerta.style.opacity = 1 - suavizar(0.7, 0.95, progresso);
  estado.pagina.iconeConferido.style.opacity = suavizar(0.7, 0.95, progresso);
  atualizarLegenda(estado);
  estado.pagina.topo.style.setProperty('--largura-linha', 6 + 8 * progresso + 'vw'); // linha embaixo do título
}

/** Fim do topo: texto e painel somem com desfoque enquanto a página seguinte sobe. */
function atualizarSaida(estado, alturaRolavel) {
  const saida = limitar((scrollY - (alturaRolavel - innerHeight * 0.5)) / (innerHeight * 0.42));
  const saidaSuave = saida * saida * (3 - 2 * saida);
  if (saidaSuave !== estado.ultimaSaida) {
    const texto = estado.pagina.texto;
    const painel = estado.pagina.painel;
    estado.ultimaSaida = saidaSuave;
    texto.style.opacity = 1 - saidaSuave;
    texto.style.filter = saidaSuave ? 'blur(' + (saidaSuave * 10).toFixed(1) + 'px)' : '';
    texto.style.translate = '0 ' + (-saidaSuave * 46).toFixed(1) + 'px';
    painel.style.opacity = 1 - saidaSuave * 0.9;
    painel.style.filter = saidaSuave ? 'blur(' + (saidaSuave * 8).toFixed(1) + 'px)' : '';
    estado.pecas.canvas.style.opacity = 1 - saidaSuave * 0.15;
  }
}

/** Seta "role para baixo": some assim que a pessoa começa a rolar. */
function atualizarSeta(estado) {
  const opacidade = estado.chegouAoFim ? 0 : +limitar(1 - scrollY / 70).toFixed(2);
  if (opacidade !== estado.ultimaSeta) {
    estado.ultimaSeta = opacidade;
    estado.pagina.seta.style.opacity = opacidade;
  }
}

/** Resolução adaptativa: se a média de 30 quadros passar de 25 ms, reduz a resolução (até 0,6; nunca sobe de novo). */
function ajustarResolucaoSeLento(estado, agora, intervalo) {
  if (agora - estado.inicio > 3000 && intervalo > 0 && intervalo < 0.25) {
    estado.somaDosIntervalos += intervalo;
    estado.quadrosMedidos += 1;
    if (estado.quadrosMedidos >= 30) {
      const media = estado.somaDosIntervalos / estado.quadrosMedidos;
      estado.somaDosIntervalos = 0;
      estado.quadrosMedidos = 0;
      if (media > 0.025 && estado.pecas.resolucao > 0.6) {
        mudarResolucao(estado.pecas, Math.max(0.6, estado.pecas.resolucao - 0.2));
      }
    }
  }
}

/** Um quadro da animação do topo. */
function desenharQuadro(estado, agora) {
  const intervalo = (agora - estado.ultimoQuadro) / 1000;
  const segundos = limitar(intervalo, 0, 0.05); // tempo desde o último quadro (no máximo 0,05 s)
  const alturaRolavel = Math.max(1, estado.pagina.trilho.offsetHeight - innerHeight);
  const alvo = limitar(scrollY / alturaRolavel);

  estado.ultimoQuadro = agora;
  /* o progresso segue a rolagem nos dois sentidos, suavizado (sem saltos): descer avança, subir retrocede */
  estado.progresso = seguir(estado.progresso, alvo, segundos, 7);
  if (Math.abs(alvo - estado.progresso) < 1e-4) estado.progresso = alvo;
  estado.chegouAoFim = estado.progresso > 0.985;
  const parado = alvo < 0.004 && estado.progresso < 0.01;
  estado.atividade = seguir(estado.atividade, parado ? 0 : 1, segundos, 2.4);

  girarCarro(estado, segundos, parado);
  posicionarCamera(estado);
  escolherEtapa(estado);
  if (
    Math.abs(estado.progresso - estado.ultimoProgresso) > 1e-4 ||
    Math.abs(estado.atividade - estado.ultimaAtividade) > 1e-4
  ) {
    estado.ultimoProgresso = estado.progresso;
    estado.ultimaAtividade = estado.atividade;
    atualizarCoresEPainel(estado);
  }
  atualizarSaida(estado, alturaRolavel);
  atualizarSeta(estado);
  estado.pecas.renderizador.render(estado.pecas.cena, estado.pecas.camera);
  ajustarResolucaoSeLento(estado, agora, intervalo);
}

/** Elementos da página usados pelo topo. */
function elementosDoTopo() {
  const elementos = {
    trilho: document.getElementById('trilho-topo'), // a altura dele define quanto se rola dentro do topo
    topo: document.getElementById('topo'),
    painel: document.getElementById('painel'),
    legendaDoPainel: document.getElementById('painel-legenda'),
    barraDoPainel: document.getElementById('painel-barra-cheia'),
    iconeAlerta: document.getElementById('icone-alerta'),
    iconeConferido: document.getElementById('icone-conferido'),
    seta: document.getElementById('seta-rolar'),
    texto: document.querySelector('.texto-topo'),
    etiqueta: document.getElementById('etapa-texto'),
  };
  return elementos;
}

/** Liga o topo: textos, painel e a cena 3D (o desenho para quando o topo sai da tela). */
export function iniciarTopo() {
  const conteudo = conteudoDoTopo();
  const agora = performance.now();
  const estado = {
    conteudo,
    pagina: elementosDoTopo(),
    titulos: criarFrases(document.getElementById('titulo-topo'), conteudo.titulos),
    subtitulos: criarFrases(document.getElementById('subtitulo-topo'), conteudo.subtitulos),
    linhasDoPainel: criarLinhasDoPainel(conteudo.painel),
    pecas: criarCenaDoTopo(),
    paleta: paletaDoTopo(),
    etapaAtual: 0,
    progresso: 0, // 0 a 1, segue a rolagem com suavidade
    atividade: 0, // 0 = vitrine (página parada no começo), 1 = rolando
    anguloVitrine: 0.75, // giro lento enquanto ninguém rola
    deslize: 0, // diferença que some aos poucos ao sair da vitrine (evita salto)
    giroExtra: 0, // giro que continua depois do fim da animação
    velocidadeGiro: 0,
    angulo: 0.75,
    estavaParado: true,
    chegouAoFim: false,
    legendaAtual: -1,
    ultimoQuadro: agora,
    inicio: agora,
    // últimos valores aplicados (só mexe na página quando algo mudou)
    ultimoProgresso: -1,
    ultimaAtividade: -1,
    ultimaSaida: -1,
    ultimaSeta: -1,
    // medição do ritmo de quadros (resolução adaptativa)
    somaDosIntervalos: 0,
    quadrosMedidos: 0,
  };

  try {
    history.scrollRestoration = 'manual'; // ao recarregar, volta ao começo (a animação depende da rolagem)
  } catch {
    // navegador antigo sem essa opção: segue normalmente
  }
  scrollTo(0, 0);
  estado.pecas.renderizador.setAnimationLoop((tempo) => desenharQuadro(estado, tempo));
  // fora da tela, o topo para de desenhar (e volta de onde parou quando reaparece)
  observarVisibilidade(estado.pagina.topo, (visivel) => {
    estado.ultimoQuadro = performance.now();
    estado.pecas.renderizador.setAnimationLoop(visivel ? (tempo) => desenharQuadro(estado, tempo) : null);
  });
}
