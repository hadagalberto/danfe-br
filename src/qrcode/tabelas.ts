/**
 * Tabelas do padrão QR Code (ISO/IEC 18004) para as versões 1–40 e os
 * níveis de correção L/M/Q/H.
 *
 * As duas tabelas de blocos abaixo (códigos de correção por bloco e número
 * de blocos) são o Anexo do ISO/IEC 18004 ("Error correction characteristics
 * per version"). Foram conferidas caractere a caractere contra a
 * implementação de referência do Project Nayuki (MIT License,
 * https://github.com/nayuki/QR-Code-generator, arquivo
 * typescript-javascript/qrcodegen.ts — ECC_CODEWORDS_PER_BLOCK e
 * NUM_ERROR_CORRECTION_BLOCKS), obtida em 20/11/2026. O índice 0 de cada
 * linha é um valor sentinela ilegível (as versões começam em 1).
 */

/** Níveis de correção de erro do QR Code (ISO/IEC 18004 §7.3.2). */
export type NivelCorrecao = 'L' | 'M' | 'Q' | 'H';

/** Ordem canônica dos níveis usada nas tabelas: L, M, Q, H. */
export const ORDEM_NIVEIS: readonly NivelCorrecao[] = ['L', 'M', 'Q', 'H'];

/** Índice do nível nas tabelas de blocos. */
export function indiceNivel(nivel: NivelCorrecao): number {
  return ORDEM_NIVEIS.indexOf(nivel);
}

/**
 * Bits do indicador de nível na informação de formato (ISO/IEC 18004,
 * Table 25 — Embedded indicator of level and mask pattern):
 * L=01(1), M=00(0), Q=11(3), H=10(2).
 */
export const BITS_FORMATO_NIVEL: Readonly<Record<NivelCorrecao, number>> = {
  L: 1,
  M: 0,
  Q: 3,
  H: 2,
};

/**
 * Capacidade de correção: códigos EC por bloco, por versão (1–40).
 * Linhas: L, M, Q, H.
 */
export const CODIGOS_EC_POR_BLOCO: readonly (readonly number[])[] = [
  //  0   1   2   3   4   5   6   7   8   9  10  11  12  13  14  15  16  17  18  19  20  21  22  23  24  25  26  27  28  29  30  31  32  33  34  35  36  37  38  39  40
  [
    -1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28,
    28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
  ], // L
  [
    -1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26,
    26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
  ], // M
  [
    -1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30,
    28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
  ], // Q
  [
    -1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28,
    30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
  ], // H
];

/** Número de blocos (1–H), por versão. Linhas: L, M, Q, H. */
export const NUMERO_BLOCOS: readonly (readonly number[])[] = [
  // 0  1   2   3   4   5   6   7   8   9  10  11  12  13  14  15  16  17  18  19  20  21  22  23  24  25  26  27  28  29  30  31  32  33  34  35  36  37  38  39  40
  [
    -1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12,
    12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25,
  ], // L
  [
    -1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20,
    21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49,
  ], // M
  [
    -1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25,
    27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68,
  ], // Q
  [
    -1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30,
    32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81,
  ], // H
];

/**
 * Número total de módulos (função, sem zona de silêncio) por versão:
 * 17 + 4 × versão (ISO/IEC 18004 §7.3.1... "symbol size").
 */
export function tamanhoVersao(versao: number): number {
  return 17 + 4 * versao;
}

/**
 * Número de módulos disponíveis para codewords (dados + EC), incluindo os
 * bits remanescentes (< 8) das versões 2–6, 14–20 e 28–34.
 * Fórmula: módulos do símbolo menos posições de função (padrões de
 * reconhecimento + separadores + tempo + alinhamento + formatos + versão).
 */
export function modulosBrutos(versao: number): number {
  let total = (16 * versao + 128) * versao + 64;
  if (versao >= 2) {
    const numAlinhamento = Math.floor(versao / 7) + 2;
    total -= (25 * numAlinhamento - 10) * numAlinhamento - 55;
    if (versao >= 7) total -= 36;
  }
  return total;
}

/** Codewords brutos (módulos ÷ 8, bits remanescentes descartados). */
export function codewordsBrutos(versao: number): number {
  return Math.floor(modulosBrutos(versao) / 8);
}

/** Codewords de dados para versão e nível (EC = blocos × códigos EC por bloco). */
export function codewordsDados(versao: number, nivel: NivelCorrecao): number {
  const i = indiceNivel(nivel);
  return (
    codewordsBrutos(versao) -
    CODIGOS_EC_POR_BLOCO[i]![versao]! * NUMERO_BLOCOS[i]![versao]!
  );
}

/**
 * Posições dos centros dos padrões de alinhamento no eixo (x e y iguais),
 * em ordem crescente, começando em 6 (ISO/IEC 18004 Anexo E). Versão 1 não
 * tem padrões de alinhamento.
 */
export function posicoesAlinhamento(versao: number): number[] {
  if (versao === 1) return [];
  const tamanho = tamanhoVersao(versao);
  const numAlinhamento = Math.floor(versao / 7) + 2;
  // Passo entre centros (par), conforme a tabela do Anexo E.
  const passo = Math.floor((versao * 8 + numAlinhamento * 3 + 5) / (numAlinhamento * 4 - 4)) * 2;
  const posicoes: number[] = [6];
  for (let pos = tamanho - 7; posicoes.length < numAlinhamento; pos -= passo) {
    posicoes.splice(1, 0, pos);
  }
  return posicoes;
}

/**
 * Bits do indicador de contagem de caracteres do modo byte
 * (ISO/IEC 18004 Table 3 — character count indicator): 8 bits para as
 * versões 1–9 e 16 bits para as versões 10–40.
 */
export function bitsContagemBytes(versao: number): number {
  return versao <= 9 ? 8 : 16;
}
