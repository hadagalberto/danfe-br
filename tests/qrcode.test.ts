/**
 * QR Code (ISO/IEC 18004) — modo byte, versões 1–40, nível M padrão e
 * seleção de máscara por penalidade N1–N4, verificados por decodificação
 * com `jsQR` (Apache-2.0), implementação independente.
 */
import { describe, expect, it } from 'vitest';
import { encodeQrCode } from '../src/qrcode/qrcode';
import { codewordsDados } from '../src/qrcode/tabelas';
import { decodificaQr, decodificaQrBytes, rasterizaQr, rng } from './helpers/decodificadores';

function roundTrip(
  dados: string | Uint8Array,
  opcoes?: Parameters<typeof encodeQrCode>[1],
): string {
  return decodificaQr(rasterizaQr(encodeQrCode(dados, opcoes)));
}

describe('encodeQrCode — modo byte', () => {
  it('usa EC M e a menor versão por padrão; round-trip de vetor conhecido', () => {
    const simbolo = encodeQrCode('https://www.sefaz.sp.gov.br/nfce/consulta');
    expect(simbolo.nivelCorrecao).toBe('M');
    expect(simbolo.versao).toBeGreaterThanOrEqual(1);
    expect(simbolo.tamanho).toBe(17 + 4 * simbolo.versao);
    expect(simbolo.modulos).toHaveLength(simbolo.tamanho);
    expect(simbolo.modulos[0]).toHaveLength(simbolo.tamanho);
    expect(roundTrip('https://www.sefaz.sp.gov.br/nfce/consulta')).toBe(
      'https://www.sefaz.sp.gov.br/nfce/consulta',
    );
  });

  it('respeita versaoMinima/versaoMaxima nas versoes 1, 2, 7 e 10', () => {
    for (const versao of [1, 2, 7, 10]) {
      const tamanho = Math.max(1, codewordsDados(versao, 'M') - 3);
      const dados = 'x'.repeat(tamanho);
      const simbolo = encodeQrCode(dados, { versaoMinima: versao, versaoMaxima: versao });
      expect(simbolo.versao, `versao ${versao}`).toBe(versao);
      expect(simbolo.tamanho).toBe(17 + 4 * versao);
      expect(roundTrip(dados, { versaoMinima: versao, versaoMaxima: versao })).toBe(dados);
    }
  });

  it('gera simbolos decodificaveis em todas as versoes 1..40 (faixa forcada)', () => {
    for (let versao = 1; versao <= 40; versao++) {
      const tamanho = Math.max(1, codewordsDados(versao, 'M') - 3);
      const dados = `V${versao}-`.padEnd(tamanho, 'q');
      const simbolo = encodeQrCode(dados, { versaoMinima: versao, versaoMaxima: versao });
      expect(simbolo.versao, `versao ${versao}`).toBe(versao);
      // jsQR e mais lento em simbolos grandes; escala 5 mantem 5 px/modulo.
      const imagem = rasterizaQr(simbolo, 5, 4);
      expect(decodificaQr(imagem), `versao ${versao}`).toBe(dados);
    }
  });

  it('round-trip com 40 payloads aleatorios em todos os niveis de correcao', () => {
    const gerador = rng(18004);
    const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 /:-.?#@$%';
    const niveis = ['M', 'L', 'Q', 'H'] as const;
    for (let n = 0; n < 40; n++) {
      const nivel = niveis[n % niveis.length]!;
      const tamanho = 1 + Math.floor(gerador() * 180);
      let texto = '';
      for (let i = 0; i < tamanho; i++) {
        texto += alfabeto[Math.floor(gerador() * alfabeto.length)]!;
      }
      expect(roundTrip(texto, { nivelCorrecao: nivel }), `payload ${n} (${nivel})`).toBe(texto);
    }
  });

  it('selecao automatica de mascara e deterministica; mascaras forçadas 0..7 decodificam', () => {
    const dados = 'nfce://consulta?chave=35260110562655620245550280000217691341262140';
    const automatica = encodeQrCode(dados);
    expect(automatica.mascara).toBeGreaterThanOrEqual(0);
    expect(automatica.mascara).toBeLessThanOrEqual(7);
    expect(encodeQrCode(dados).mascara).toBe(automatica.mascara);
    for (let mascara = 0; mascara <= 7; mascara++) {
      const simbolo = encodeQrCode(dados, { mascara });
      expect(simbolo.mascara).toBe(mascara);
      expect(decodificaQr(rasterizaQr(simbolo)), `mascara ${mascara}`).toBe(dados);
    }
  });

  it('codifica bytes crus (UTF-8 e bins) preservando a sequencia exata', () => {
    const casos = [
      new TextEncoder().encode('Olá, NF-e! 🎉'),
      Uint8Array.from([0, 1, 2, 127, 128, 254, 255]),
    ];
    for (const bytes of casos) {
      const simbolo = encodeQrCode(bytes, { nivelCorrecao: 'M' });
      const decodificado = decodificaQrBytes(rasterizaQr(simbolo));
      expect(decodificado, `bytes ${bytes.length}`).toEqual(Array.from(bytes));
    }
  });

  it('paraSvg inclui zona de silencio e ajusta dimensoes', () => {
    const simbolo = encodeQrCode('NF-e');
    const svg = simbolo.paraSvg(3, 4);
    const esperado = (simbolo.tamanho + 8) * 3;
    expect(svg).toContain(`width="${esperado}"`);
    expect(svg).toContain(`height="${esperado}"`);
    expect(svg).toContain('fill="#000"');
  });

  it('rejeita opcoes e dados fora dos limites do padrao', () => {
    expect(() => encodeQrCode('x', { versaoMinima: 0 })).toThrow(RangeError);
    expect(() => encodeQrCode('x', { versaoMaxima: 41 })).toThrow(RangeError);
    expect(() => encodeQrCode('x', { versaoMinima: 10, versaoMaxima: 5 })).toThrow(RangeError);
    expect(() => encodeQrCode('x', { mascara: -1 })).toThrow(RangeError);
    expect(() => encodeQrCode('x', { mascara: 8 })).toThrow(RangeError);
    expect(() => encodeQrCode('x'.repeat(100), { versaoMinima: 1, versaoMaxima: 1 })).toThrow(
      RangeError,
    );
  });
});
