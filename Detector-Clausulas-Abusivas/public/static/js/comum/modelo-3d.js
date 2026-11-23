/* Carrega um modelo 3D (.glb, pasta public/static/models) e entrega o resultado para `aoCarregar`.
   Os modelos ficam comprimidos (bem menores para baixar); o decodificador abaixo os abre no navegador.
   Se o arquivo não existir, o console do navegador (F12) mostra qual arquivo faltou. */
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; // lê arquivos .glb. Ex.: new GLTFLoader().parse(bytes, '', aoCarregar)
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'; // abre modelos comprimidos. Ex.: carregador.setMeshoptDecoder(MeshoptDecoder)

/** Baixa o arquivo e devolve os bytes; se o servidor não achar o arquivo, gera um erro com o endereço. */
function baixarArquivo(endereco) {
  const bytes = fetch(endereco).then((resposta) => {
    if (!resposta.ok) {
      throw new Error(`Modelo 3D não encontrado (${resposta.status}): ${endereco}`);
    }
    return resposta.arrayBuffer();
  });
  return bytes;
}

/** Baixa e lê o modelo; quando estiver pronto, chama `aoCarregar(gltf)`. Devolve a promessa do carregamento. */
export function carregarModelo(endereco, aoCarregar) {
  const carregador = new GLTFLoader();
  carregador.setMeshoptDecoder(MeshoptDecoder);
  const carregamento = baixarArquivo(endereco)
    .then((bytes) =>
      carregador.parse(bytes, '', aoCarregar, (erro) => console.error(`Erro ao ler o modelo ${endereco}:`, erro)),
    )
    .catch((erro) => console.error(erro));
  return carregamento;
}
