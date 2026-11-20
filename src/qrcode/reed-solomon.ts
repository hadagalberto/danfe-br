/**
 * Reed-Solomon sobre GF(2^8) com polinômimo primitivo 0x11D e gerador α=2,
 * conforme ISO/IEC 18004 (Códigos QR), Anexo A — o mesmo campo usado por
 * todos os leitores do padrão.
 *
 * Os códigos de correção são o resto da divisão do polinômio de dados
 * (grau k−1) pelo polinômio gerador de grau n
 * ∏_{i=0}^{n-1} (x − α^i), calculado pelo método clássico de Horner.
 */

/** Tabela de exponenciais α^i para i em [0, 255] (α^255 = 1). */
const EXP = new Uint8Array(256);
/** Tabela de logaritmos: LOG[α^i] = i. */
const LOG = new Uint8Array(256);

// Construção das tabelas: multiplicação sucessiva por α=2 módulo 0x11D.
{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    // x *= 2 em GF(2^8)/0x11D: shift e redução pelo polinômimo primitivo.
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
}

/** Produto de dois elementos de GF(2^8)/0x11D. */
export function gfMult(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[(LOG[a]! + LOG[b]!) % 255]!;
}

/**
 * Polinômio gerador de grau `n`, coeficientes do maior para o menor grau,
 * termo líder implícito (1) omitido — convenção do padrão.
 */
export function polinomioGerador(n: number): Uint8Array {
  if (n < 1 || n > 255) {
    throw new RangeError(`Reed-Solomon: grau ${n} fora do intervalo [1, 255].`);
  }
  // Começa com o monômio x^0; multiplica por (x − α^i) para i = 0..n−1.
  const coefs = new Uint8Array(n);
  coefs[n - 1] = 1;
  let raiz = 1; // α^i
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let coeficiente = gfMult(coefs[j]!, raiz);
      if (j + 1 < n) coeficiente ^= coefs[j + 1]!;
      coefs[j] = coeficiente;
    }
    raiz = gfMult(raiz, 2);
  }
  return coefs;
}

/**
 * Resto da divisão de `dados` (coeficientes do maior para o menor grau)
 * pelo polinômio `gerador` — os n códigos de correção de Reed-Solomon.
 */
export function restoReedSolomon(dados: Uint8Array, gerador: Uint8Array): Uint8Array {
  const n = gerador.length;
  const resto = new Uint8Array(n);
  for (const byte of dados) {
    // Passo da divisão: XOR com o termo líder e deslocamento do resto.
    const fator = byte ^ resto[0]!;
    resto.copyWithin(0, 1);
    resto[n - 1] = 0;
    for (let i = 0; i < n; i++) {
      resto[i] = resto[i]! ^ gfMult(gerador[i]!, fator);
    }
  }
  return resto;
}
