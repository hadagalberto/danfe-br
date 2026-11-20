/**
 * Code 128 (ISO/IEC 15417) — vetores verificados por decodificacao com
 * `@zxing/library`, uma implementacao independente (Apache-2.0).
 */
import { describe, expect, it } from 'vitest';
import { encodeCode128 } from '../src/barcode/code128';
import { decodificaCode128, imagemCode128, rng } from './helpers/decodificadores';

const CHAVE = '35260110562655620245550280000217691341262140';

/** Soma de verificacao calculada de forma independente (ISO/IEC 15417 B.1). */
function digitoVerificador(valores: readonly number[]): number {
  let soma = valores[0]!; // start pesa 1
  for (let k = 1; k < valores.length; k++) soma += valores[k]! * k;
  return soma % 103;
}

describe('encodeCode128 — Code C com fallback em Code B', () => {
  it('codifica a chave de acesso de 44 digitos inteiramente em Code C', () => {
    const codigo = encodeCode128(CHAVE);
    expect(codigo.conjuntoInicial).toBe('C');
    expect(codigo.texto).toBe(CHAVE);
    // start C + 22 pares + DV + stop
    expect(codigo.valores).toHaveLength(25);
    expect(codigo.valores[0]).toBe(105);
    expect(codigo.valores.at(-1)).toBe(106);
    expect(codigo.valores.at(-2)).toBe(digitoVerificador(codigo.valores.slice(0, -2)));

    expect(decodificaCode128(imagemCode128(CHAVE))).toBe(CHAVE);
  });

  it('usa Code B para texto sem pares de digitos qualificados', () => {
    const texto = 'DANFE-NFC-e';
    expect(encodeCode128(texto).conjuntoInicial).toBe('B');
    expect(decodificaCode128(imagemCode128(texto))).toBe(texto);
  });

  it('aplica a regra GS1 para strings inteiras: 2 dígitos em C, 3 em B', () => {
    expect(encodeCode128('12').conjuntoInicial).toBe('C');
    expect(encodeCode128('123').conjuntoInicial).toBe('B');
    expect(encodeCode128('1234').conjuntoInicial).toBe('C');
    expect(decodificaCode128(imagemCode128('12'))).toBe('12');
    expect(decodificaCode128(imagemCode128('123'))).toBe('123');
  });

  it('mistura Code B e Code C em trechos de digitos no meio/fim', () => {
    const textos = [
      `NF ${CHAVE}`,
      `CHAVE:${CHAVE} STATUS=OK`,
      'AB123456CD',
      'X123456789Y12Z',
      '1234567890',
    ];
    for (const texto of textos) {
      expect(decodificaCode128(imagemCode128(texto))).toBe(texto);
    }
  });

  it('tabela de larguras e consistente: 11 modulos por simbolo, 13 no stop', () => {
    for (const texto of [CHAVE, 'DANFE 4.00', 'A1B2C3D4E5', '  ESPACOS  ']) {
      const codigo = encodeCode128(texto);
      expect(codigo.larguras).toHaveLength(codigo.valores.length * 6 + 1);
      let pos = 0;
      for (let i = 0; i < codigo.valores.length; i++) {
        const quantas = i === codigo.valores.length - 1 ? 7 : 6;
        const soma = codigo.larguras.slice(pos, pos + quantas).reduce((a, b) => a + b, 0);
        expect(soma, `simbolo ${i} de ${JSON.stringify(texto)}`).toBe(
          i === codigo.valores.length - 1 ? 13 : 11,
        );
        pos += quantas;
      }
      expect(codigo.larguras.reduce((a, b) => a + b, 0)).toBe(codigo.larguraModulos);
    }
  });

  it('round-trip com 40 payloads aleatorios ASCII imprimivel', () => {
    const gerador = rng(20261120);
    const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-./#:+ ';
    for (let n = 0; n < 40; n++) {
      const tamanho = 1 + Math.floor(gerador() * 70);
      let texto = '';
      for (let i = 0; i < tamanho; i++) {
        texto += alfabeto[Math.floor(gerador() * alfabeto.length)]!;
      }
      // ZXing preserva espacos internos; evita apenas bordas (que alguns readers aparariam).
      texto = texto.trim() || 'X';
      expect(decodificaCode128(imagemCode128(texto)), `payload ${n}`).toBe(texto);
    }
  });

  it('rejeita entrada vazia e caracteres fora de ASCII 32-126', () => {
    expect(() => encodeCode128('')).toThrow(RangeError);
    expect(() => encodeCode128('linha\nquebrada')).toThrow(RangeError);
    expect(() => encodeCode128('acento: AÇÃO')).toThrow(RangeError);
    expect(() => encodeCode128('\t')).toThrow(RangeError);
  });
});
