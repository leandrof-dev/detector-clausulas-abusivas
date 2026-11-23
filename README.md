# Detector de Cláusulas Abusivas em Contrato

Site que lê o PDF de um **contrato de financiamento de veículo** e explica o documento em linguagem simples:
o que o contrato diz, quais pontos vale conferir (cada um com o trecho do contrato e a norma que o sustenta) e
uma **nota de confiabilidade**, calculada comparando o contrato com outros já analisados.

- **Site publicado:** <https://detector-clausulas-abusivas.vercel.app/>
- **Projeto Integrador** – Fatec Taquaritinga (2026)
- **Autores:** Leandro Felipe Reis e Daniel Cabau · **Orientadora:** Daniela Gibertoni

> É uma leitura assistida, com caráter informativo. Não é parecer jurídico e não substitui um advogado.

---

## Sumário

1.  [Como o site funciona](#1-como-o-site-funciona)
2.  [Pastas do repositório](#2-pastas-do-repositório)
3.  [O servidor (Python)](#3-o-servidor-python)
4.  [As páginas (HTML, CSS e JavaScript)](#4-as-páginas-html-css-e-javascript)
5.  [Banco de dados (Supabase)](#5-banco-de-dados-supabase)
6.  [Inteligência artificial](#6-inteligência-artificial)
7.  [Nota de confiabilidade](#7-nota-de-confiabilidade)
8.  [Privacidade e segurança](#8-privacidade-e-segurança)
9.  [Como rodar no computador](#9-como-rodar-no-computador)
10. [Variáveis de ambiente (.env)](#10-variáveis-de-ambiente-env)
11. [Publicação na Vercel](#11-publicação-na-vercel)
12. [Desempenho](#12-desempenho)
13. [Padrões de organização do código](#13-padrões-de-organização-do-código)
14. [Limitações e próximos passos](#14-limitações-e-próximos-passos)

---

## 1. Como o site funciona

```text
Navegador                         Servidor (Flask)                                Serviços externos
─────────                         ────────────────                                ─────────────────
página "Envie seu PDF"
  └─ POST /ler-pdf  ───────────▶  app.py → receber_pdf()
                                    └─ main_detector.detectar()
                                         1. validar_arquivo()   é PDF? tem conteúdo?
                                         2. ler_texto()         PyMuPDF extrai o texto
                                            └─ anonimizar_texto()  CPF, CNPJ, e-mail e telefone → [CPF]...
                                         3. ler_com_ia()        3 tarefas AO MESMO TEMPO ──────▶  API da OpenAI
                                              • leitura em linguagem simples (essencial)
                                              • assunto de cada cláusula (plano B: palavras-chave)
                                              • embeddings (vetores) de cada cláusula
                                         4. comparar_com_a_base()   busca vetorial ────────────▶  Supabase (pgvector)
                                         5. guardar_no_banco()      PDF + análise + cláusulas ─▶  Supabase
  ◀── JSON com o resultado  ─────  jsonify(resultado)
enviar-pdf.js monta 3 faixas:
  leitura da IA · pontos a conferir · nota de confiabilidade
```

Se a leitura principal da IA falhar, o envio falha com uma mensagem clara. Se só a classificação ou os embeddings
falharem, o site continua e avisa (sem embeddings não há nota).

## 2. Pastas do repositório

```text
detector-clausulas-abusivas/
├── README.md                       este arquivo
├── .gitignore                      o que nunca vai para o Git (.env, __pycache__, venv...)
├── documentos/                     trabalho escrito do Projeto Integrador
│   ├── Projeto Integrador Fatec.docx
│   ├── Projeto Integrador Fatec.pdf
│   └── Apresentação Fatec Formatada ABNT.pdf   (apresentação do anteprojeto)
├── contratos-de-exemplo/           contratos PÚBLICOS usados para alimentar a base de comparação
│   ├── 01-sicoob ... 05-bradesco   (cinco contratos de financiamento de veículos)
│   ├── Revisao-de-Contrato Publico Volkswagen SA.pdf   (laudo pericial público)
│   └── resumo-do-laudo-volkswagen.md                   (resumo do laudo: o "caso real" do site)
└── Detector-Clausulas-Abusivas/    O SITE (é esta pasta que a Vercel publica)
    ├── app.py                      rotas do site e recebimento do PDF
    ├── main_detector.py            passo a passo da análise (o "maestro")
    ├── pdf_leitor.py               extrai o texto do PDF
    ├── ia.py                       instruções da IA, anonimização, leitura, assuntos e embeddings
    ├── comparacao.py               compara com a base e calcula a nota
    ├── banco.py                    tudo que fala com o Supabase
    ├── requirements.txt            bibliotecas Python
    ├── .env.example                modelo do .env (só os NOMES das variáveis, sem chaves)
    ├── templates/                  páginas HTML (Jinja2)
    │   ├── index.html              página inicial
    │   ├── enviar_pdf.html         envio do PDF e resultado
    │   ├── base_info.html          molde das páginas informativas
    │   └── faq.html · sobre.html · contato.html
    └── public/static/              arquivos do navegador (na Vercel, entregues pela CDN)
        ├── css/
        │   ├── comum.css           base, menu, faixas, cartões e rodapé (todas as páginas)
        │   ├── inicio.css          só a página inicial
        │   ├── enviar-pdf.css      só a página de envio (classes "env-")
        │   └── paginas.css         só FAQ, Sobre e Contato (classes "info-")
        ├── js/
        │   ├── comum/              usado por mais de uma página
        │   │   ├── utilidades.js   contas pequenas, formatação de números, preferências da tela
        │   │   ├── cartoes-3d.js   cartões de vidro que inclinam com o mouse
        │   │   └── modelo-3d.js    baixa e abre um modelo 3D (.glb) comprimido
        │   ├── inicio/             página inicial
        │   │   ├── principal.js    liga tudo e monta as cenas 3D só quando a pessoa chega perto
        │   │   ├── efeitos.js      aparecer ao rolar, títulos palavra por palavra, parallax, barra de progresso
        │   │   ├── secoes.js       interações de cada faixa (iceberg, caso real, quiz, comparador...)
        │   │   ├── conteudo.js     textos e números que o JavaScript coloca na página
        │   │   ├── topo.js         topo da página (etapas, painel e animação do carro)
        │   │   ├── topo-cena.js    cena 3D do topo (piso espelhado, luzes, carro)
        │   │   ├── topo-cores.js   cores das 3 etapas do topo
        │   │   ├── iceberg.js      iceberg 3D da faixa "O problema"
        │   │   ├── montanha.js     montanha 3D da faixa "Nota de confiabilidade"
        │   │   └── carro-comparacao.js  carro 3D da faixa "Antes × depois" (com tela cheia)
        │   ├── enviar-pdf.js       página de envio: escolhe o arquivo, envia e monta o resultado
        │   └── paginas.js          FAQ, Sobre e Contato: liga os cartões 3D
        ├── models/                 modelos 3D: car.glb (topo), audi_rs5.glb (antes × depois), ice.glb (iceberg)
        └── vendor/three/           biblioteca Three.js r160 (cópia local, sem depender de CDN externa)
```

## 3. O servidor (Python)

| Arquivo | O que faz | Funções principais |
| --- | --- | --- |
| `app.py` | Cria o site Flask, as rotas e as respostas de erro em JSON. | `criar_app()`, `receber_pdf()`, `limite_de_envio_em_mb()`, `perguntas_do_faq()` |
| `main_detector.py` | O passo a passo de uma análise. Também roda pelo terminal. | `detectar()`, `ler_texto()`, `ler_com_ia()`, `guardar_no_banco()` |
| `pdf_leitor.py` | Lê o PDF direto da memória (sem salvar arquivo). | `ler_pdf()` |
| `ia.py` | Instruções da IA (versão, normas, assuntos), anonimização, chamadas à OpenAI, embeddings e separação em cláusulas. | `instrucoes_da_ia()`, `anonimizar_texto()`, `ler_contrato()`, `classificar_clausulas()`, `gerar_embeddings()`, `separar_clausulas()` |
| `comparacao.py` | Compara as cláusulas com a base e calcula a nota. | `comparar_com_a_base()`, `comparar_assunto()` |
| `banco.py` | Guarda e busca no Supabase (tabelas, bucket e funções de busca vetorial). | `guardar_contrato()`, `guardar_analise()`, `guardar_clausulas()`, `buscar_clausulas_de_outros_contratos()` |

**Rotas do site**

| Endereço | Página |
| --- | --- |
| `/` | Página inicial (conteúdo educativo e interativo) |
| `/enviar_pdf` | Envio do PDF e resultado |
| `/ler-pdf` (POST) | Recebe o PDF (campo `pdf`) e devolve o resultado em JSON |
| `/faq`, `/sobre`, `/contato` | Páginas informativas |

**Bibliotecas** (`requirements.txt`): `flask` (site), `pymupdf` (PDF), `python-dotenv` (lê o `.env`),
`supabase` (banco e armazenamento) e `openai` (IA). Python 3.10 ou mais novo.

## 4. As páginas (HTML, CSS e JavaScript)

- Cada linguagem fica no seu arquivo: HTML em `templates/`, CSS em `public/static/css/`, JavaScript em
  `public/static/js/`. No HTML ficam só alguns valores pontuais de estilo (uma cor ou uma variável de CSS num
  elemento, como `style="--cor: #3ff0a6"`).
- **Cada página carrega só o que usa:** a página inicial usa `comum.css` + `inicio.css` e um único script,
  `inicio/principal.js`; a página de envio usa `comum.css` + `enviar-pdf.css` e `enviar-pdf.js`; as informativas usam
  `comum.css` + `enviar-pdf.css` + `paginas.css` e `paginas.js`.
- Os scripts são **módulos JavaScript** (`import`/`export`), sem framework e sem etapa de build.
- O Three.js é importado pelos nomes `three` e `three/addons/...`, definidos no `<script type="importmap">` da
  página inicial (a única que usa 3D).
- **Segurança:** tudo o que vem do servidor entra na página com `textContent` (nunca `innerHTML`), então um contrato
  com HTML malicioso não consegue executar nada no navegador.
- **Variáveis do CSS mais usadas:** `--cor` (cor de destaque da faixa), `--cor-tela` (cor da faixa no meio da tela,
  definida pelo JavaScript), `--posicao` (parallax, de -1 a 1), `--cor-nota` (cor da nota na montanha). A lista
  completa está no início do `comum.css`.

## 5. Banco de dados (Supabase)

PostgreSQL com a extensão **pgvector** e um armazenamento de arquivos privado.

| Tabela | Guarda | Colunas principais |
| --- | --- | --- |
| `contratos` | Um registro por PDF enviado | `nome_arquivo`, `hash_sha256`, `caminho_storage`, `paginas`, `texto_extraido` (já anonimizado), `anonimizado`, `origem` (`teste`/`producao`), `status` (`recebido`/`lido`/`analisado`/`erro`) |
| `analises` | O resultado de cada análise | `contrato_id`, `modelo`, `versao_prompt`, `resultado` (JSON), `nota_confiabilidade` |
| `clausulas` | Cada cláusula do contrato | `contrato_id`, `ordem`, `tipo` (`juros`, `tarifa`, `seguro`, `multa`, `cancelamento`, `cet`, `outro`), `texto`, `embedding` (vetor de 1.536 números) |

- **Bucket `contratos`** (privado): o PDF original.
- **Funções de busca** (chamadas por `banco.py` com `rpc`): `buscar_clausulas_parecidas` e
  `buscar_clausulas_de_outros_contratos` (similaridade de cosseno, com índice HNSW).
- **RLS ativada sem políticas públicas:** só o servidor, com a chave secreta, lê e grava.

## 6. Inteligência artificial

- **Modelos:** definidos no `.env` (`MODELO_IA_ANALISE` para a leitura e `MODELO_IA_REPETITIVO` para classificar
  as cláusulas). Os embeddings usam `text-embedding-3-large` com 1.536 dimensões (pode mudar no `.env`).
- **Instruções:** ficam em `instrucoes_da_ia()` (`ia.py`), com **versão** (hoje `v2`). A versão é gravada com cada
  análise (coluna `versao_prompt`); mude a versão sempre que mudar o texto das instruções.
- **Normas que a IA pode citar (v2):** CDC art. 6º, III (informação clara); art. 39, I (venda casada); art. 51
  (cláusulas abusivas); art. 51, IV, e art. 101, I (foro distante do domicílio do consumidor); art. 52, § 1º (multa de
  até 2%); art. 52, § 2º (quitação antecipada com redução dos juros); Resolução CMN nº 3.517/2007 (CET); STJ Súmulas
  472 e 566 e Temas 621 e 972.
- **Limite:** a IA lê até 120.000 caracteres do contrato; se passar disso, o site avisa.
- **Saída sempre em JSON**, conferida e normalizada no servidor antes de ir para a página.

## 7. Nota de confiabilidade

A nota diz o quanto o contrato "está na curva", isto é, o quanto as cláusulas dele se parecem com as de contratos
já guardados (100% = igual).

1. É preciso ter pelo menos **3 contratos diferentes** na base (reenvios do mesmo PDF contam uma vez, pelo hash).
2. Para cada assunto (juros, tarifas, seguro, multa, cancelamento, CET), o sistema pega as 2 cláusulas mais completas
   do contrato e procura a cláusula mais parecida **em outros contratos**, do mesmo assunto.
3. A similaridade do assunto é a maior encontrada; a **nota é a média dos assuntos** (precisa de pelo menos 2).

Com poucos contratos na base, a nota indica pouco. Por isso o site explica como ela é calculada.

## 8. Privacidade e segurança

- **Anonimização parcial:** antes de ir para a IA e para o banco, o texto tem **CPF, CNPJ, e-mail e telefone**
  trocados por marcas como `[CPF]` (`anonimizar_texto()` em `ia.py`). Números com formato de telefone (10 ou 11
  dígitos seguidos) também viram `[TELEFONE]`.
- **Ainda não:** nomes e endereços não são detectados, e o **PDF original é guardado sem alterações** no bucket
  privado (por isso a coluna `anonimizado` continua `false`). A página inicial e o FAQ avisam isso.
- **Chaves:** ficam só no `.env` (no computador) ou nas variáveis da Vercel. O `.env` está no `.gitignore` e
  **nunca** deve ir para o GitHub. A chave secreta do Supabase só existe no servidor, nunca no navegador.

## 9. Como rodar no computador

No Windows (PowerShell), dentro da pasta `Detector-Clausulas-Abusivas`:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env     # depois abra o .env e preencha as chaves
python app.py                   # abra http://127.0.0.1:5000
```

Testes rápidos pelo terminal:

```powershell
python ia.py                                          # faz uma chamada mínima a cada modelo do .env
python banco.py                                       # testa a conexão com o Supabase
python main_detector.py "..\contratos-de-exemplo\03-safra-financeira-ccb-veiculos-pf.pdf"            # analisa sem gravar
python main_detector.py "..\contratos-de-exemplo\03-safra-financeira-ccb-veiculos-pf.pdf" --salvar   # analisa e grava
```

## 10. Variáveis de ambiente (.env)

Só os nomes aparecem aqui. Os valores ficam no seu `.env` (computador) ou no painel da Vercel.

| Variável | Obrigatória | Para quê |
| --- | --- | --- |
| `SUPABASE_URL` | sim | Endereço do projeto no Supabase |
| `SUPABASE_SECRET_KEY` | sim | Chave secreta do Supabase (só no servidor) |
| `SUPABASE_PUBLISHABLE_KEY` | não | Chave pública (reservada; o site não usa hoje) |
| `IA_API_KEY` | sim | Chave da API da OpenAI |
| `MODELO_IA_ANALISE` | sim | Modelo que faz a leitura do contrato |
| `MODELO_IA_REPETITIVO` | sim | Modelo que classifica as cláusulas por assunto |
| `MODELO_EMBEDDING` | não | Modelo de embeddings (padrão: `text-embedding-3-large`) |
| `EMBEDDING_DIMENSOES` | não | Tamanho do vetor (padrão: `1536`, igual à coluna do banco) |
| `CONTATO_EMAIL` | não | E-mail mostrado na página Contato (vazio = formulário desativado) |

## 11. Publicação na Vercel

- O repositório está ligado à Vercel: **cada envio ao GitHub publica uma nova versão**.
- Na Vercel, a **pasta raiz do projeto** (Root Directory) é `Detector-Clausulas-Abusivas`. A Vercel reconhece o
  Flask pelo `app.py` e roda o servidor como uma função.
- As variáveis da seção 10 ficam em *Settings → Environment Variables* da Vercel (nunca no código).
- Os arquivos do navegador ficam em `public/`: a Vercel os entrega direto pela CDN, com cache e compressão,
  sem passar pelo Python. No computador, o Flask entrega a mesma pasta (`static_folder="public/static"`).
- **Limite de tamanho:** a Vercel recusa requisições maiores que 4,5 MB. Por isso, na versão publicada, o site aceita
  PDFs de **até 4 MB** (no computador, até 50 MB). O limite aparece na página de envio, é conferido antes de enviar e,
  se o servidor recusar, a mensagem explica o motivo. A Vercel também limita o tempo de cada requisição; se a
  análise demorar demais, o site avisa.
- Documentação usada: [Flask na Vercel](https://vercel.com/docs/frameworks/backend/flask) e
  [guia de publicação de Flask](https://vercel.com/kb/guide/ship-a-flask-app-on-vercel).

## 12. Desempenho

A página inicial tem quatro cenas 3D. Para rodar bem em notebooks:

- **Cenas montadas sob demanda:** iceberg, montanha e carro do "Antes × depois" só são criados quando a pessoa chega
  perto deles (`inicio/principal.js`).
- **Nada é desenhado fora da tela:** cada cena para quando sai da tela, e as animações de CSS das faixas que não
  aparecem ficam pausadas (classe `.fora-da-tela`).
- **Menos trabalho por quadro:** a resolução das cenas tem limite em telas muito densas; a cor das faixas só é
  atualizada quando muda de verdade; a montanha calcula o relevo uma vez só e depois apenas mistura; a rolagem mede
  tudo primeiro e só depois altera o CSS.
- **Modelos 3D comprimidos** (meshopt + texturas WebP sem perda), com o visual conferido imagem por imagem:

  | Modelo | Antes | Depois |
  | --- | --- | --- |
  | `audi_rs5.glb` (Antes × depois) | 13,3 MB · 757 chamadas de desenho por quadro | 4,1 MB · 32 chamadas |
  | `car.glb` (topo) | 7,5 MB · 79 chamadas de desenho por quadro | 4,3 MB · 46 chamadas |
  | `ice.glb` (iceberg) | 0,9 MB | sem mudança |

  Os modelos foram otimizados com [glTF-Transform](https://gltf-transform.dev/) (Node.js, fora do projeto). O
  navegador abre o formato comprimido com o `meshopt_decoder` que acompanha o Three.js
  (`vendor/three/addons/libs/`). Os arquivos originais continuam no histórico do Git.

## 13. Padrões de organização do código

- **Linguagens:** servidor só em Python; navegador só em HTML, CSS e JavaScript. Linguagem nova no projeto, só com
  combinação prévia da equipe.
- **Nomes em português claro**, sem abreviações: funções (`limite_de_envio_em_mb`), variáveis (`conteudo_pdf`),
  classes de CSS (`.faixa`, `.cartao`, `.rodape`), ids (`#trilho-topo`) e variáveis de CSS (`--cor-tela`).
- **Um único `return` por função**, no final. As variáveis ficam dentro das funções (a única exceção é o `app` do
  `app.py`, que o Flask e a Vercel procuram pelo nome).
- **Cada função tem um comentário** dizendo o que faz. Cada arquivo começa com um comentário explicando para que serve.
- **Bibliotecas no topo do arquivo**, cada uma com um comentário curto e um exemplo de uso. Ex.:
  `import json  # transforma texto JSON em dicionário. Ex.: json.loads('{"ok": true}') → {"ok": True}`
- **Formatação:** Python conferido com Ruff (linhas de até 120 caracteres); JavaScript e CSS formatados com Prettier
  (largura 120; aspas simples no JavaScript) e JavaScript conferido com ESLint.

## 14. Limitações e próximos passos

- PDFs digitalizados (fotos de papel) não são lidos: falta OCR.
- A anonimização é parcial (nomes, endereços e o PDF original).
- Na versão publicada, o limite é de 4 MB por PDF. Para aceitar arquivos maiores, o plano é enviar o PDF direto ao
  armazenamento do Supabase.
- As normas e as instruções da IA ainda não passaram por revisão jurídica, e a IA pode errar.
- A base de comparação ainda é pequena, então a nota indica pouco.
- Falta a página de políticas e termos (o link do rodapé ainda não leva a ela).

---

*Os modelos 3D (`.glb`) são de terceiros: antes de uso fora do contexto acadêmico, confira o autor e a licença de
cada um.*
