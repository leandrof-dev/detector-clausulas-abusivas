/* Página "Envie seu PDF": escolhe o arquivo, manda para o servidor (POST /ler-pdf) e mostra o resultado em 3 faixas.
   Todo texto que vem do servidor entra na página com textContent (nunca innerHTML): o contrato não consegue
   injetar HTML na página. */
import { iniciarCartoes3D } from './comum/cartoes-3d.js';
import { movimentoReduzido } from './comum/utilidades.js';

/* ---------- textos, cores e elementos da tela ---------- */

/** Mensagens da tela, todas juntas para ficar fácil de mudar. */
function textosDaTela(limiteEmMb) {
  const textos = {
    tituloVazio: 'Arraste o PDF para cá',
    subtituloVazio: 'ou escolha um arquivo',
    semArquivo: 'Selecione um PDF primeiro.',
    naoEPdf: 'O arquivo precisa ser um PDF.',
    arquivoVazio: 'Este arquivo está vazio.',
    grandeDemais: `O PDF passa de ${limiteEmMb} MB.`,
    grandeDemaisNoServidor:
      'O PDF é grande demais para o servidor. Na versão publicada na internet, o limite é de 4 MB.',
    demorouDemais: 'A análise demorou mais do que o servidor permite. Tente de novo em instantes ou use um PDF menor.',
    carregando: 'Lendo o contrato e comparando com a base. Isso pode levar até um minuto…',
    falhaDeRede: 'Não consegui falar com o servidor. Confira se o site está rodando e tente de novo.',
    respostaInesperada: 'O servidor respondeu algo inesperado. Tente de novo.',
  };
  return textos;
}

/** Cor e nome de cada nível de um ponto. */
function niveisDosPontos() {
  const niveis = {
    atencao: { cor: '#ff5566', nome: 'Atenção' },
    verificar: { cor: '#ffb454', nome: 'Verificar' },
    ok: { cor: '#3ff0a6', nome: 'Tudo certo' },
  };
  return niveis;
}

/** Cor da nota: vermelho abaixo de 45, roxo abaixo de 75, verde daí em diante. */
function corDaNota(nota) {
  const cor = nota < 45 ? '#ff5566' : nota < 75 ? '#a78bfa' : '#3ff0a6';
  return cor;
}

/** Os elementos da página que o código usa. */
function elementosDaTela() {
  const porId = (id) => document.getElementById(id);
  const tela = {
    principal: porId('env-principal'),
    formulario: porId('env-formulario'),
    areaDeSoltar: porId('env-solta'),
    campoArquivo: porId('env-arquivo'),
    titulo: porId('env-solta-titulo'),
    subtitulo: porId('env-solta-sub'),
    dica: porId('env-solta-dica'),
    botao: porId('env-analisar'),
    carregando: porId('env-estado'),
    carregandoTexto: porId('env-estado-texto'),
    erro: porId('env-erro'),
    resultado: porId('env-resultado'),
    tipo: porId('env-leitura-tipo'),
    manchete: porId('env-manchete'),
    resumo: porId('env-resumo'),
    paginas: porId('env-fato-paginas'),
    caracteres: porId('env-fato-caracteres'),
    avisos: porId('env-avisos'),
    contagem: porId('env-contagem'),
    lista: porId('env-lista'),
    vazio: porId('env-vazio'),
    faixaNota: porId('env-faixa-nota'),
    rosca: porId('env-rosca-valor'),
    roscaNumero: porId('env-rosca-numero'),
    situacao: porId('env-nota-situacao'),
    notaTexto: porId('env-nota-texto'),
    barras: porId('env-barras'),
    base: porId('env-base'),
    comoNota: porId('env-como-nota'),
    dialogo: porId('env-dialogo'),
    ficha: porId('env-ficha'),
  };
  return tela;
}

/* ---------- pequenas ajudas ---------- */

/** Cria um elemento com classe e texto (sempre como texto puro). */
function criar(tag, classe, texto) {
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

/** Tamanho do arquivo para mostrar na tela. Ex.: 1536 → "1,5 KB"; 3145728 → "3,0 MB" */
function formatarTamanho(bytes) {
  const texto =
    bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  return texto;
}

/** Número com separador de milhar. Ex.: 42553 → "42.553" */
function formatarNumero(numero) {
  const texto = Number(numero).toLocaleString('pt-BR');
  return texto;
}

function mostrarErro(estado, mensagem) {
  estado.tela.erro.textContent = mensagem;
  estado.tela.erro.hidden = false;
}

function limparErro(estado) {
  estado.tela.erro.textContent = '';
  estado.tela.erro.hidden = true;
}

/** Rola a página (e não um quadro interno) até o topo de um elemento. */
function rolarAte(elemento) {
  const topo = elemento.getBoundingClientRect().top + window.scrollY - 16;
  window.scrollTo({ top: Math.max(0, topo), behavior: movimentoReduzido() ? 'auto' : 'smooth' });
}

/* ---------- escolha do arquivo ---------- */

/** Devolve o texto do problema, ou "" se o arquivo serve. */
function problemaDoArquivo(estado, arquivo) {
  let problema = '';
  if (!arquivo) {
    problema = estado.textos.semArquivo;
  } else if (!arquivo.name.toLowerCase().endsWith('.pdf')) {
    problema = estado.textos.naoEPdf;
  } else if (arquivo.size === 0) {
    problema = estado.textos.arquivoVazio;
  } else if (arquivo.size > estado.limiteEmBytes) {
    problema = estado.textos.grandeDemais;
  }
  return problema;
}

/** O nome do PDF ocupa o lugar do "Arraste o PDF para cá". */
function atualizarJanelaDeEnvio(estado) {
  const { tela, arquivo, textos } = estado;
  const temArquivo = arquivo !== null;
  tela.areaDeSoltar.classList.toggle('tem-arquivo', temArquivo);
  tela.titulo.textContent = temArquivo ? arquivo.name : textos.tituloVazio;
  tela.subtitulo.textContent = temArquivo
    ? `${formatarTamanho(arquivo.size)} · clique para trocar`
    : textos.subtituloVazio;
  tela.dica.hidden = temArquivo;
  tela.botao.disabled = !temArquivo || estado.enviando;
}

function esconderResultado(estado) {
  estado.tela.resultado.hidden = true;
  estado.tela.principal.classList.remove('tem-resultado');
}

function escolherArquivo(estado, arquivo) {
  const problema = problemaDoArquivo(estado, arquivo);
  limparErro(estado);
  esconderResultado(estado);
  if (problema) {
    estado.arquivo = null;
    estado.tela.campoArquivo.value = '';
    mostrarErro(estado, problema);
  } else {
    estado.arquivo = arquivo;
  }
  atualizarJanelaDeEnvio(estado);
}

/* ---------- envio ---------- */

function mostrarCarregando(estado, ligado) {
  estado.enviando = ligado;
  estado.tela.carregando.hidden = !ligado;
  estado.tela.carregandoTexto.textContent = ligado ? estado.textos.carregando : '';
  estado.tela.formulario.setAttribute('aria-busy', String(ligado));
  atualizarJanelaDeEnvio(estado);
}

/** Lê a resposta como JSON; se não for JSON (ex.: página de erro do servidor), devolve null. */
async function lerJson(resposta) {
  let corpo = null;
  try {
    corpo = await resposta.json();
  } catch {
    corpo = null;
  }
  return corpo;
}

/** Explica o problema de uma resposta que não deu certo. */
function mensagemDeErro(estado, resposta, corpo) {
  let mensagem = estado.textos.respostaInesperada;
  if (corpo && corpo.erro) {
    mensagem = corpo.erro;
  } else if (resposta.status === 413) {
    mensagem = estado.textos.grandeDemaisNoServidor; // a Vercel recusa pedidos maiores que 4,5 MB
  } else if (resposta.status === 504) {
    mensagem = estado.textos.demorouDemais; // a Vercel corta funções que demoram demais
  }
  return mensagem;
}

async function analisarContrato(estado) {
  const problema = problemaDoArquivo(estado, estado.arquivo);
  if (!estado.enviando) {
    limparErro(estado);
    if (problema) {
      mostrarErro(estado, problema);
    } else {
      const dados = new FormData();
      dados.append('pdf', estado.arquivo);
      mostrarCarregando(estado, true);
      try {
        const resposta = await fetch('/ler-pdf', { method: 'POST', body: dados });
        const corpo = await lerJson(resposta);
        if (!resposta.ok) {
          mostrarErro(estado, mensagemDeErro(estado, resposta, corpo));
        } else if (!corpo || !corpo.leitura) {
          mostrarErro(estado, estado.textos.respostaInesperada);
        } else {
          mostrarResultado(estado, corpo);
        }
      } catch {
        mostrarErro(estado, estado.textos.falhaDeRede);
      } finally {
        mostrarCarregando(estado, false);
      }
    }
  }
}

/* ---------- resultado ---------- */

function mostrarResultado(estado, analise) {
  preencherLeitura(estado.tela, analise);
  preencherPontos(estado.tela, analise.leitura.pontos || []);
  preencherConfiabilidade(estado.tela, analise.confiabilidade, analise);
  estado.tela.resultado.hidden = false;
  estado.tela.principal.classList.add('tem-resultado');
  estado.tela.resultado.focus({ preventScroll: true });
  rolarAte(estado.tela.resultado);
}

/** Faixa 1: a leitura da IA em linguagem simples. */
function preencherLeitura(tela, analise) {
  const leitura = analise.leitura;
  const avisos = [...(analise.avisos || [])];
  if (analise.registro && analise.registro.aviso) avisos.push(analise.registro.aviso);
  tela.tipo.textContent = leitura.tipo_documento || '';
  tela.manchete.textContent = leitura.manchete || '';
  tela.resumo.replaceChildren(...(leitura.resumo || []).map((frase) => criar('li', '', frase)));
  tela.paginas.textContent = `${formatarNumero(analise.paginas)} ${analise.paginas === 1 ? 'página' : 'páginas'}`;
  tela.caracteres.textContent = `${formatarNumero(analise.caracteres)} caracteres lidos`;
  tela.avisos.textContent = avisos.join(' ');
  tela.avisos.hidden = avisos.length === 0;
}

function fecharPontos(tela) {
  tela.lista.querySelectorAll('.env-ponto').forEach((botao) => {
    botao.setAttribute('aria-expanded', 'false');
    botao.parentElement.querySelector('.env-detalhe').hidden = true;
  });
}

function abrirPonto(botao) {
  if (botao) {
    botao.setAttribute('aria-expanded', 'true');
    botao.parentElement.querySelector('.env-detalhe').hidden = false;
  }
}

/** Um ponto a conferir: botão (título + nível) que abre a explicação, o trecho do contrato e a norma. */
function criarPonto(tela, ponto, nivel, indice) {
  const niveis = niveisDosPontos();
  const item = criar('li');
  const botao = criar('button', 'env-ponto');
  const detalhe = criar('div', 'env-detalhe');

  item.style.setProperty('--cor-ponto', niveis[nivel].cor);
  botao.type = 'button';
  botao.setAttribute('aria-expanded', 'false');
  botao.setAttribute('aria-controls', `env-detalhe-${indice}`);
  botao.append(
    criar('span', 'env-ponto-cor'),
    criar('span', 'env-ponto-titulo', ponto.titulo),
    criar('span', 'env-ponto-nivel', niveis[nivel].nome),
    criar('span', 'env-ponto-seta', '›'),
  );
  detalhe.id = `env-detalhe-${indice}`;
  detalhe.hidden = true;
  detalhe.append(criar('p', '', ponto.explicacao));
  if (ponto.trecho) detalhe.append(criar('blockquote', '', `“${ponto.trecho}”`));
  if (ponto.norma) detalhe.append(criar('span', 'selo', ponto.norma));
  botao.addEventListener('click', () => {
    const abrir = botao.getAttribute('aria-expanded') !== 'true';
    fecharPontos(tela);
    if (abrir) abrirPonto(botao);
  });
  item.append(botao, detalhe);
  return item;
}

/** Faixa 2: lista de pontos (um abre por vez) e a contagem por nível. */
function preencherPontos(tela, pontos) {
  const niveis = niveisDosPontos();
  const contagem = { atencao: 0, verificar: 0, ok: 0 };
  const itens = pontos.map((ponto, indice) => {
    const nivel = niveis[ponto.nivel] ? ponto.nivel : 'verificar';
    contagem[nivel] += 1;
    return criarPonto(tela, ponto, nivel, indice);
  });
  const resumoDaContagem = ['atencao', 'verificar', 'ok']
    .filter((nivel) => contagem[nivel] > 0)
    .map((nivel) => {
      const etiqueta = criar('span', '', `${contagem[nivel]} ${niveis[nivel].nome.toLowerCase()}`);
      const bolinha = criar('i');
      bolinha.style.setProperty('--cor-ponto', niveis[nivel].cor);
      etiqueta.prepend(bolinha);
      return etiqueta;
    });

  tela.lista.replaceChildren(...itens);
  tela.contagem.replaceChildren(...resumoDaContagem);
  tela.vazio.hidden = pontos.length > 0;
  abrirPonto(tela.lista.querySelector('.env-ponto'));
}

/** Uma barra do gráfico: assunto, trilho com a similaridade e o número. */
function criarBarra(item) {
  const linha = criar('li', 'env-barra-linha');
  const trilho = criar('div', 'env-barra-trilho');
  const preenchido = criar('i');
  trilho.append(preenchido);
  linha.append(criar('span', '', item.rotulo), trilho, criar('span', 'env-barra-valor', `${item.similaridade}%`));
  // espera dois quadros para a barra "crescer" com animação
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      preenchido.style.width = `${item.similaridade}%`;
    }),
  );
  return linha;
}

/** Faixa 3: nota, rosca e barras por assunto. */
function preencherConfiabilidade(tela, dados, analise) {
  const cor = dados.disponivel ? corDaNota(dados.nota) : '#8d99ae';
  const valor = dados.disponivel ? dados.nota : 0;
  const medidos = (dados.itens || []).filter((item) => item.similaridade !== null && item.similaridade !== undefined);

  tela.faixaNota.style.setProperty('--cor', cor);
  tela.barras.replaceChildren(...medidos.map(criarBarra));
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
  tela.rosca.style.display = dados.disponivel ? '' : 'none'; // sem nota, o arco some (a ponta redonda viraria um pontinho)
  tela.rosca.style.stroke = cor;
  tela.rosca.style.strokeDasharray = '0 100';
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      tela.rosca.style.strokeDasharray = `${valor} 100`;
    }),
  );
  tela.base.textContent = `Base de comparação: ${formatarNumero(dados.base)} ${dados.base === 1 ? 'contrato' : 'contratos'} (mínimo para a nota: ${formatarNumero(dados.minimo)}).`;
  tela.ficha.textContent = `Modelo de IA: ${analise.modelo || '—'} · versão das instruções: ${analise.versao_prompt || '—'}`;
  tela.ficha.hidden = false;
}

/* ---------- início ---------- */

/** Liga a página: escolha do arquivo (clique ou arrastar), envio, janela "Como é calculada?" e cartões 3D. */
function iniciarPaginaDeEnvio() {
  const tela = elementosDaTela();
  const limiteEmMb = Number(tela.formulario.dataset.limiteMb || 50); // vem do servidor (app.py)
  const estado = {
    tela,
    textos: textosDaTela(limiteEmMb),
    limiteEmBytes: limiteEmMb * 1024 * 1024,
    arquivo: null,
    enviando: false,
  };

  tela.campoArquivo.addEventListener('change', () => escolherArquivo(estado, tela.campoArquivo.files[0] || null));
  tela.formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    analisarContrato(estado);
  });
  tela.comoNota.addEventListener('click', () => tela.dialogo.showModal());
  tela.dialogo.addEventListener('click', (evento) => {
    if (evento.target === tela.dialogo) tela.dialogo.close(); // clicar fora da janela fecha
  });
  // arrastar e soltar: o navegador não pode abrir o PDF por conta própria se ele cair fora da área
  window.addEventListener('dragover', (evento) => evento.preventDefault());
  window.addEventListener('drop', (evento) => evento.preventDefault());
  tela.areaDeSoltar.addEventListener('dragover', () => tela.areaDeSoltar.classList.add('arrastando'));
  tela.areaDeSoltar.addEventListener('dragleave', () => tela.areaDeSoltar.classList.remove('arrastando'));
  tela.areaDeSoltar.addEventListener('drop', (evento) => {
    const arquivo = evento.dataTransfer.files[0];
    tela.areaDeSoltar.classList.remove('arrastando');
    if (arquivo) escolherArquivo(estado, arquivo);
  });
  atualizarJanelaDeEnvio(estado);
  iniciarCartoes3D(); // os cartões da direita inclinam com o mouse e brilham, como na página inicial
}

iniciarPaginaDeEnvio();
