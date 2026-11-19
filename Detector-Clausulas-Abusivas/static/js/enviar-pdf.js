import { iniciarCartoes3D } from './cartoes-3d.js';

// Página "Envie seu PDF": escolhe o arquivo, manda para o servidor (POST /ler-pdf) e mostra o resultado em faixas.
// Todo texto que vem do servidor entra na página com textContent (nunca innerHTML), para o contrato não injetar HTML.

const TAMANHO_MAXIMO = 50 * 1024 * 1024; // mesmo limite do servidor (50 MB)

// Mensagens da tela, todas juntas para ficar fácil de mudar
const TEXTOS = {
  tituloVazio: 'Arraste o PDF para cá',
  subVazio: 'ou escolha um arquivo',
  dicaVazia: 'PDF com texto selecionável · até 50 MB',
  semArquivo: 'Selecione um PDF primeiro.',
  naoEPdf: 'O arquivo precisa ser um PDF.',
  arquivoVazio: 'Este arquivo está vazio.',
  grandeDemais: 'O PDF passa de 50 MB.',
  carregando: 'Lendo o contrato e comparando com a base. Isso pode levar até um minuto…',
  falhaDeRede: 'Não consegui falar com o servidor. Confira se o site está rodando e tente de novo.',
  respostaInesperada: 'O servidor respondeu algo inesperado. Tente de novo.',
  semPontos: 'Sem pontos',
};

// Cores e nomes de cada nível de um ponto
const NIVEIS = {
  atencao: { cor: '#ff5566', nome: 'Atenção' },
  verificar: { cor: '#ffb454', nome: 'Verificar' },
  ok: { cor: '#3ff0a6', nome: 'Tudo certo' },
};

// Cores da nota: vermelho abaixo de 45, roxo abaixo de 75, verde daí em diante
const COR_NOTA = { baixa: '#ff5566', media: '#a78bfa', alta: '#3ff0a6' };

const $ = (id) => document.getElementById(id);

const tela = {
  principal: $('env-principal'),
  formulario: $('env-formulario'),
  solta: $('env-solta'),
  arquivo: $('env-arquivo'),
  titulo: $('env-solta-titulo'),
  sub: $('env-solta-sub'),
  dica: $('env-solta-dica'),
  botao: $('env-analisar'),
  estado: $('env-estado'),
  estadoTexto: $('env-estado-texto'),
  erro: $('env-erro'),
  resultado: $('env-resultado'),
  tipo: $('env-leitura-tipo'),
  manchete: $('env-manchete'),
  resumo: $('env-resumo'),
  paginas: $('env-fato-paginas'),
  caracteres: $('env-fato-caracteres'),
  avisos: $('env-avisos'),
  contagem: $('env-contagem'),
  lista: $('env-lista'),
  vazio: $('env-vazio'),
  faixaNota: $('env-faixa-nota'),
  rosca: $('env-rosca-valor'),
  roscaNumero: $('env-rosca-numero'),
  situacao: $('env-nota-situacao'),
  notaTexto: $('env-nota-texto'),
  barras: $('env-barras'),
  base: $('env-base'),
  comoNota: $('env-como-nota'),
  dialogo: $('env-dialogo'),
  ficha: $('env-ficha'),
};

let arquivoEscolhido = null;
let enviando = false;

// ---------- Utilidades ----------

// Cria um elemento com classe e texto (sempre como texto puro)
function criar(tag, classe, texto) {
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

// 1536 → "1,5 KB"; 3145728 → "3,0 MB"
function formatarTamanho(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

function formatarNumero(numero) {
  return Number(numero).toLocaleString('pt-BR');
}

function corDaNota(nota) {
  if (nota < 45) return COR_NOTA.baixa;
  if (nota < 75) return COR_NOTA.media;
  return COR_NOTA.alta;
}

function esvaziar(elemento) {
  elemento.replaceChildren();
}

function mostrarErro(mensagem) {
  tela.erro.textContent = mensagem;
  tela.erro.hidden = false;
}

function limparErro() {
  tela.erro.textContent = '';
  tela.erro.hidden = true;
}

// Rola a página (e não um quadro interno) até o topo de um elemento
function rolarAte(elemento) {
  const topo = elemento.getBoundingClientRect().top + window.scrollY - 16;
  const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: Math.max(0, topo), behavior: reduzido ? 'auto' : 'smooth' });
}

// ---------- Escolha do arquivo ----------

// Devolve o texto do problema, ou "" se o arquivo serve
function validarArquivo(arquivo) {
  if (!arquivo) return TEXTOS.semArquivo;
  if (!arquivo.name.toLowerCase().endsWith('.pdf')) return TEXTOS.naoEPdf;
  if (arquivo.size === 0) return TEXTOS.arquivoVazio;
  if (arquivo.size > TAMANHO_MAXIMO) return TEXTOS.grandeDemais;
  return '';
}

// O nome do PDF ocupa o lugar do "Arraste o PDF para cá"
function atualizarJanelaDeEnvio() {
  const temArquivo = arquivoEscolhido !== null;
  tela.solta.classList.toggle('tem-arquivo', temArquivo);
  tela.titulo.textContent = temArquivo ? arquivoEscolhido.name : TEXTOS.tituloVazio;
  tela.sub.textContent = temArquivo
    ? `${formatarTamanho(arquivoEscolhido.size)} · clique para trocar`
    : TEXTOS.subVazio;
  tela.dica.hidden = temArquivo;
  tela.botao.disabled = !temArquivo || enviando;
}

function esconderResultado() {
  tela.resultado.hidden = true;
  tela.principal.classList.remove('tem-resultado');
}

function escolherArquivo(arquivo) {
  limparErro();
  esconderResultado();

  const problema = validarArquivo(arquivo);
  if (problema) {
    arquivoEscolhido = null;
    tela.arquivo.value = '';
    mostrarErro(problema);
  } else {
    arquivoEscolhido = arquivo;
  }
  atualizarJanelaDeEnvio();
}

// ---------- Envio ----------

function mostrarCarregando(ligado) {
  enviando = ligado;
  tela.estado.hidden = !ligado;
  tela.estadoTexto.textContent = ligado ? TEXTOS.carregando : '';
  tela.formulario.setAttribute('aria-busy', String(ligado));
  atualizarJanelaDeEnvio();
}

async function analisarContrato() {
  if (enviando) return;
  limparErro();
  const problema = validarArquivo(arquivoEscolhido);
  if (problema) {
    mostrarErro(problema);
    return;
  }

  const dados = new FormData();
  dados.append('pdf', arquivoEscolhido);
  mostrarCarregando(true);

  try {
    const resposta = await fetch('/ler-pdf', { method: 'POST', body: dados });
    let corpo = null;
    try {
      corpo = await resposta.json();
    } catch {
      corpo = null;
    }

    if (!resposta.ok) {
      mostrarErro((corpo && corpo.erro) || TEXTOS.respostaInesperada);
    } else if (!corpo || !corpo.leitura) {
      mostrarErro(TEXTOS.respostaInesperada);
    } else {
      mostrarResultado(corpo);
    }
  } catch {
    mostrarErro(TEXTOS.falhaDeRede);
  } finally {
    mostrarCarregando(false);
  }
}

// ---------- Resultado ----------

function mostrarResultado(analise) {
  preencherLeitura(analise);
  preencherPontos(analise.leitura.pontos || []);
  preencherConfiabilidade(analise.confiabilidade, analise);

  tela.resultado.hidden = false;
  tela.principal.classList.add('tem-resultado');
  tela.resultado.focus({ preventScroll: true });
  rolarAte(tela.resultado);
}

// Faixa 1: a leitura da IA em linguagem simples
function preencherLeitura(analise) {
  const leitura = analise.leitura;
  tela.tipo.textContent = leitura.tipo_documento || '';
  tela.manchete.textContent = leitura.manchete || '';

  esvaziar(tela.resumo);
  for (const frase of leitura.resumo || []) tela.resumo.append(criar('li', '', frase));

  tela.paginas.textContent = `${formatarNumero(analise.paginas)} ${analise.paginas === 1 ? 'página' : 'páginas'}`;
  tela.caracteres.textContent = `${formatarNumero(analise.caracteres)} caracteres lidos`;

  const avisos = [...(analise.avisos || [])];
  if (analise.registro && analise.registro.aviso) avisos.push(analise.registro.aviso);
  tela.avisos.textContent = avisos.join(' ');
  tela.avisos.hidden = avisos.length === 0;
}

// Faixa 2: lista de pontos, um abre por vez
function preencherPontos(pontos) {
  esvaziar(tela.lista);
  esvaziar(tela.contagem);
  tela.vazio.hidden = pontos.length > 0;

  const contagem = { atencao: 0, verificar: 0, ok: 0 };
  pontos.forEach((ponto, indice) => {
    const nivel = NIVEIS[ponto.nivel] ? ponto.nivel : 'verificar';
    contagem[nivel] += 1;
    tela.lista.append(criarPonto(ponto, nivel, indice));
  });

  for (const nivel of ['atencao', 'verificar', 'ok']) {
    if (contagem[nivel] === 0) continue;
    const chip = criar('span', '', `${contagem[nivel]} ${NIVEIS[nivel].nome.toLowerCase()}`);
    const bolinha = criar('i');
    bolinha.style.setProperty('--q', NIVEIS[nivel].cor);
    chip.prepend(bolinha);
    tela.contagem.append(chip);
  }

  abrirPonto(tela.lista.querySelector('.env-ponto'));
}

function criarPonto(ponto, nivel, indice) {
  const item = criar('li');
  item.style.setProperty('--q', NIVEIS[nivel].cor);

  const botao = criar('button', 'env-ponto');
  botao.type = 'button';
  botao.setAttribute('aria-expanded', 'false');
  botao.setAttribute('aria-controls', `env-detalhe-${indice}`);
  botao.append(
    criar('span', 'env-ponto-cor'),
    criar('span', 'env-ponto-titulo', ponto.titulo),
    criar('span', 'env-ponto-nivel', NIVEIS[nivel].nome),
    criar('span', 'env-ponto-seta', '›'),
  );

  const detalhe = criar('div', 'env-detalhe');
  detalhe.id = `env-detalhe-${indice}`;
  detalhe.hidden = true;
  detalhe.append(criar('p', '', ponto.explicacao));
  if (ponto.trecho) detalhe.append(criar('blockquote', '', `“${ponto.trecho}”`));
  if (ponto.norma) detalhe.append(criar('span', 'chip', ponto.norma));

  botao.addEventListener('click', () => {
    const abrir = botao.getAttribute('aria-expanded') !== 'true';
    fecharPontos();
    if (abrir) abrirPonto(botao);
  });

  item.append(botao, detalhe);
  return item;
}

function fecharPontos() {
  for (const botao of tela.lista.querySelectorAll('.env-ponto')) {
    botao.setAttribute('aria-expanded', 'false');
    botao.parentElement.querySelector('.env-detalhe').hidden = true;
  }
}

function abrirPonto(botao) {
  if (!botao) return;
  botao.setAttribute('aria-expanded', 'true');
  botao.parentElement.querySelector('.env-detalhe').hidden = false;
}

// Faixa 3: nota, rosca e barras por assunto
function preencherConfiabilidade(dados, analise) {
  const cor = dados.disponivel ? corDaNota(dados.nota) : '#8d99ae';
  tela.faixaNota.style.setProperty('--k', cor);

  esvaziar(tela.barras);
  for (const item of dados.itens || []) {
    if (item.similaridade === null || item.similaridade === undefined) continue;
    const linha = criar('li', 'env-barra-linha');
    const trilho = criar('div', 'env-barra-trilho');
    const preenchido = criar('i');
    trilho.append(preenchido);
    linha.append(criar('span', '', item.rotulo), trilho, criar('span', 'env-barra-valor', `${item.similaridade}%`));
    tela.barras.append(linha);
    requestAnimationFrame(() => requestAnimationFrame(() => (preenchido.style.width = `${item.similaridade}%`)));
  }

  if (dados.disponivel) {
    tela.roscaNumero.textContent = String(dados.nota);
    tela.situacao.textContent = `Nota ${dados.nota} de 100`;
    tela.notaTexto.textContent =
      'Quanto maior, mais as cláusulas deste contrato se parecem com as de contratos já analisados. Notas baixas indicam um contrato fora do comum.';
  } else {
    tela.roscaNumero.textContent = '–';
    tela.situacao.textContent = 'Sem nota por enquanto';
    tela.notaTexto.textContent = dados.mensagem || 'Não foi possível calcular a nota.';
  }
  const valor = dados.disponivel ? dados.nota : 0;
  tela.rosca.style.display = dados.disponivel ? '' : 'none'; // sem nota, o arco some (a ponta redonda viraria um pontinho)
  tela.rosca.style.stroke = cor;
  tela.rosca.style.strokeDasharray = '0 100';
  requestAnimationFrame(() => requestAnimationFrame(() => (tela.rosca.style.strokeDasharray = `${valor} 100`)));

  tela.base.textContent = `Base de comparação: ${formatarNumero(dados.base)} ${dados.base === 1 ? 'contrato' : 'contratos'} (mínimo para a nota: ${formatarNumero(dados.minimo)}).`;

  tela.ficha.textContent = `Modelo de IA: ${analise.modelo || '—'} · versão das instruções: ${analise.versao_prompt || '—'}`;
  tela.ficha.hidden = false;
}

// ---------- Eventos ----------

tela.arquivo.addEventListener('change', () => escolherArquivo(tela.arquivo.files[0] || null));

tela.formulario.addEventListener('submit', (evento) => {
  evento.preventDefault();
  analisarContrato();
});

tela.comoNota.addEventListener('click', () => tela.dialogo.showModal());
tela.dialogo.addEventListener('click', (evento) => {
  if (evento.target === tela.dialogo) tela.dialogo.close(); // clicar fora fecha
});

// Arrastar e soltar: o navegador não pode abrir o PDF por conta própria se ele cair fora da janela
window.addEventListener('dragover', (evento) => evento.preventDefault());
window.addEventListener('drop', (evento) => evento.preventDefault());

tela.solta.addEventListener('dragover', () => tela.solta.classList.add('arrastando'));
tela.solta.addEventListener('dragleave', () => tela.solta.classList.remove('arrastando'));
tela.solta.addEventListener('drop', (evento) => {
  tela.solta.classList.remove('arrastando');
  const arquivo = evento.dataTransfer.files[0];
  if (arquivo) escolherArquivo(arquivo);
});

atualizarJanelaDeEnvio();

iniciarCartoes3D(); // os cartões da direita inclinam com o mouse e brilham, como na página inicial
