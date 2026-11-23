/* Funções pequenas usadas por várias partes do site: contas, formatação de números e preferências da tela. */

/** Prende um número entre `minimo` e `maximo` (por padrão, entre 0 e 1). Ex.: limitar(1.4) → 1 */
export function limitar(valor, minimo = 0, maximo = 1) {
  const limitado = Math.min(maximo, Math.max(minimo, valor));
  return limitado;
}

/** Curva em "S" de 0 a 1: começa e termina devagar. Ex.: suave(0.5) → 0.5 */
export function suave(x) {
  const curva = x * x * (3 - 2 * x);
  return curva;
}

/** Leva `x` do intervalo [inicio, fim] para 0…1, já com a curva suave. Ex.: suavizar(0, 10, 5) → 0.5 */
export function suavizar(inicio, fim, x) {
  const resultado = suave(limitar((x - inicio) / (fim - inicio)));
  return resultado;
}

/** Aproxima `atual` de `alvo` com suavidade, sem depender da taxa de quadros. Ex.: seguir(0, 10, 0.016, 7) → 1,06 */
export function seguir(atual, alvo, segundos, rapidez) {
  const proximo = atual + (alvo - atual) * (1 - Math.exp(-segundos * rapidez));
  return proximo;
}

/** Valor em reais, sem centavos. Ex.: formatarReais(1234.5) → "R$ 1.235" */
export function formatarReais(valor) {
  const texto = 'R$ ' + Math.round(valor).toLocaleString('pt-BR');
  return texto;
}

/** Número com vírgula e a quantidade de casas pedida. Ex.: formatarDecimal(2.45, 1) → "2,5" */
export function formatarDecimal(valor, casas) {
  const texto = valor.toFixed(casas).replace('.', ',');
  return texto;
}

/** Parcela fixa da tabela Price. Ex.: parcelaPrice(10000, 0.02, 12) → 945,60 (juros de 2% ao mês, 12 parcelas) */
export function parcelaPrice(financiado, jurosAoMes, parcelas) {
  const parcela =
    jurosAoMes === 0 ? financiado / parcelas : (financiado * jurosAoMes) / (1 - Math.pow(1 + jurosAoMes, -parcelas));
  return parcela;
}

/** true quando a pessoa pediu ao sistema para reduzir animações. */
export function movimentoReduzido() {
  const reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
  return reduzido;
}

/** true quando há mouse (computador); false em telas de toque. */
export function telaComMouse() {
  const comMouse = matchMedia('(hover: hover) and (pointer: fine)').matches;
  return comMouse;
}

/** Densidade de pixels da tela, no máximo `limite` (telas muito densas pesam demais no 3D). Ex.: 2 → 1,5 */
export function densidadeDaTela(limite) {
  const densidade = Math.min(window.devicePixelRatio || 1, limite);
  return densidade;
}

/** Chama `aoMudar(visivel)` sempre que o elemento entra ou sai da tela. Devolve o observador. */
export function observarVisibilidade(elemento, aoMudar, opcoes = {}) {
  const observador = new IntersectionObserver((entradas) => {
    entradas.forEach((entrada) => aoMudar(entrada.isIntersecting));
  }, opcoes);
  observador.observe(elemento);
  return observador;
}

/** Chama `acao` uma única vez, quando o elemento chega a `margem` da tela (ex.: '120%' = uma tela e pouco antes). */
export function quandoChegarPerto(elemento, margem, acao) {
  const observador = new IntersectionObserver(
    (entradas) => {
      if (entradas.some((entrada) => entrada.isIntersecting)) {
        observador.disconnect();
        acao();
      }
    },
    { rootMargin: `${margem} 0px ${margem} 0px` },
  );
  observador.observe(elemento);
  return observador;
}
