/* Carrega um modelo .glb (pasta static/models) e entrega o resultado para `aoCarregar`.
   Se o arquivo não existir, o console do navegador (F12) mostra qual arquivo faltou. */
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function carregarModelo(endereco, aoCarregar) {
  return fetch(endereco)
    .then((resposta) => {
      if (!resposta.ok) throw new Error(`Modelo 3D não encontrado (${resposta.status}): ${endereco}`);
      return resposta.arrayBuffer();
    })
    .then((dados) =>
      new GLTFLoader().parse(dados, '', aoCarregar, (erro) => console.error(`Erro ao ler o modelo ${endereco}:`, erro)),
    )
    .catch((erro) => console.error(erro));
}
