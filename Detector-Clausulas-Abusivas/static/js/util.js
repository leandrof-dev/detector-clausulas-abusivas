/* Funções pequenas usadas por vários arquivos. */

/** Prende um número entre `min` e `max` (por padrão, entre 0 e 1). */
export const limitar = (valor, min = 0, max = 1) => Math.min(max, Math.max(min, valor));

/** Curva em "S" de 0 a 1: começa e termina devagar (smoothstep). */
export const suave = (x) => x * x * (3 - 2 * x);

/** Leva `x` do intervalo [inicio, fim] para 0…1, já com a curva suave. */
export const suavizar = (inicio, fim, x) => suave(limitar((x - inicio) / (fim - inicio)));

/** 1234.5 → "R$ 1.235" */
export const formatarReais = (valor) => 'R$ ' + Math.round(valor).toLocaleString('pt-BR');

/** (2.45, 1) → "2,5": número com vírgula e a quantidade de casas pedida. */
export const formatarDecimal = (valor, casas) => valor.toFixed(casas).replace('.', ',');

/** Parcela fixa da tabela Price: valor financiado, juros ao mês (0.024 = 2,4%) e número de parcelas. */
export const parcelaPrice = (financiado, jurosMes, parcelas) =>
  jurosMes === 0 ? financiado / parcelas : (financiado * jurosMes) / (1 - Math.pow(1 + jurosMes, -parcelas));

/** true quando a pessoa pediu ao sistema para reduzir animações. */
export const movimentoReduzido = matchMedia('(prefers-reduced-motion:reduce)').matches;
