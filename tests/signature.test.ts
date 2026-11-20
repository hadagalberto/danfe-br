/**
 * Verificação XMLDSig do infNFe: C14N, SHA-1, RSA-SHA1 e X.509 — com
 * certificado autoassinado e cripto independente (`node:crypto`) na geração
 * dos fixtures. Casos: válido, conteúdo adulterado, assinatura adulterada.
 */
import { describe, expect, it } from 'vitest';
import { decodeBase64, encodeBase64 } from '../src/signature/base64';
import { sha1 } from '../src/signature/sha1';
import { bytesParaBigInt } from '../src/signature/rsa';
import { verificaAssinaturaNFe } from '../src/signature/verify';
import { CERT_PEM, assinaModelo, certEmBase64, modeloNaoAssinado } from './helpers/assinatura';
import { certificadoPemParaDer, extraiChavePublicaRsa } from '../src/signature/x509';

const assinado = assinaModelo();

describe('SHA-1 (FIPS 180-4) — vetores conhecidos', () => {
  const casos: readonly (readonly [string, string])[] = [
    ['', 'da39a3ee5e6b4b0d3255bfef95601890afd80709'],
    ['abc', 'a9993e364706816aba3e25717850c26c9cd0d89d'],
    [
      'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
      '84983e441c3bd26ebaae4aa1f95129e5e54670f1',
    ],
  ];
  for (const [texto, esperado] of casos) {
    it(`sha1(${JSON.stringify(texto.slice(0, 20))})`, () => {
      const resumo = Array.from(sha1(new TextEncoder().encode(texto)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      expect(resumo).toBe(esperado);
    });
  }
});

describe('Base64 (RFC 4648)', () => {
  it('codifica e decodifica com padding e ignora espaços na entrada', () => {
    expect(encodeBase64(new TextEncoder().encode('f'))).toBe('Zg==');
    expect(encodeBase64(new TextEncoder().encode('fo'))).toBe('Zm8=');
    expect(encodeBase64(new TextEncoder().encode('foo'))).toBe('Zm9v');
    expect(Array.from(decodeBase64('Zm9v'))).toEqual([102, 111, 111]);
    expect(Array.from(decodeBase64('Zm9v\n Zg==\t'))).toEqual([102, 111, 111, 102]);
  });

  it('rejeita comprimento e caracteres invalidos', () => {
    expect(() => decodeBase64('abc')).toThrow(RangeError);
    expect(() => decodeBase64('ab=@')).toThrow(RangeError);
    expect(() => decodeBase64('a===bc==')).toThrow(RangeError);
  });
});

describe('X.509 — extração da chave pública RSA', () => {
  it('extrai n e e do certificado autoassinado de 2048 bits', () => {
    const der = certificadoPemParaDer(CERT_PEM);
    const chave = extraiChavePublicaRsa(der);
    expect(chave.e).toBe(65537n);
    expect(chave.n.toString(2).length).toBe(2048);
    expect(chave.n > 0n).toBe(true);
  });

  it('rejeita DER malformado', () => {
    expect(() => extraiChavePublicaRsa(Uint8Array.from([0x30, 0x03, 0x02, 0x01]))).toThrow();
  });

  it('bytesParaBigInt interpreta big-endian', () => {
    expect(bytesParaBigInt(Uint8Array.from([0x01, 0x00]))).toBe(256n);
  });
});

describe('verificaAssinaturaNFe — XMLDSig RSA-SHA1 do infNFe', () => {
  it('aceita documento assinado corretamente', () => {
    const resultado = verificaAssinaturaNFe(assinado);
    expect(resultado.erros).toEqual([]);
    expect(resultado.valido).toBe(true);
    expect(resultado.detalhes.digestValido).toBe(true);
    expect(resultado.detalhes.assinaturaValida).toBe(true);
    expect(resultado.detalhes.certificado.bitsModulo).toBe(2048);
    expect(resultado.detalhes.uriReferencia).toContain('#NFe');
    expect(resultado.detalhes.digestCalculado).toBe(resultado.detalhes.digestDeclarado);
  });

  it('rejeita conteúdo adulterado após a assinatura (digest diverge)', () => {
    const adulterado = assinado.replace('<nNF>1</nNF>', '<nNF>2</nNF>');
    expect(adulterado).not.toBe(assinado);
    const resultado = verificaAssinaturaNFe(adulterado);
    expect(resultado.valido).toBe(false);
    expect(resultado.detalhes.digestValido).toBe(false);
    // O SignedInfo não mudou: a assinatura em si ainda é válida.
    expect(resultado.detalhes.assinaturaValida).toBe(true);
    expect(resultado.erros.join(' ')).toMatch(/DigestValue/);
  });

  it('rejeita SignatureValue adulterado (RSA diverge)', () => {
    const original = /<SignatureValue>(.)/.exec(assinado);
    expect(original).not.toBeNull();
    const substituto = original![1] === 'A' ? 'B' : 'A';
    const adulterado = assinado.replace(/<SignatureValue>(.)/, `<SignatureValue>${substituto}`);
    const resultado = verificaAssinaturaNFe(adulterado);
    expect(resultado.valido).toBe(false);
    expect(resultado.detalhes.assinaturaValida).toBe(false);
    expect(resultado.detalhes.digestValido).toBe(true);
    expect(resultado.erros.join(' ')).toMatch(/SignatureValue/);
  });

  it('rejeita certificado adulterado (troca de chave)', () => {
    const cert = certEmBase64();
    const adulterado = assinado.replace(cert, cert.slice(0, -4) + 'AAAA');
    expect(adulterado).not.toBe(assinado);
    const resultado = verificaAssinaturaNFe(adulterado);
    expect(resultado.valido).toBe(false);
    expect(resultado.erros.length).toBeGreaterThan(0);
  });

  it('rejeita algoritmo de assinatura não suportado', () => {
    const adulterado = assinado.replace('#rsa-sha1"', '#rsa-sha256"');
    const resultado = verificaAssinaturaNFe(adulterado);
    expect(resultado.valido).toBe(false);
    expect(resultado.erros.join(' ')).toMatch(/SignatureMethod/);
  });

  it('rejeita Reference apontando para Id inexistente', () => {
    const adulterado = assinado.replace('#NFe3526', '#NFe0000');
    const resultado = verificaAssinaturaNFe(adulterado);
    expect(resultado.valido).toBe(false);
    expect(resultado.erros.join(' ')).toMatch(/Referencia nao resolvida/);
  });

  it('reporta sem lançar em XML sem assinatura e XML mal formado', () => {
    const semAssinatura = verificaAssinaturaNFe('<NFe><infNFe Id="x"/></NFe>');
    expect(semAssinatura.valido).toBe(false);
    expect(semAssinatura.erros.join(' ')).toMatch(/Signature/);

    const malformado = verificaAssinaturaNFe('<NFe><infNFe></NFe>');
    expect(malformado.valido).toBe(false);
    expect(malformado.erros.join(' ')).toMatch(/mal formado/);
  });

  it('modelo com marcadores ainda não assinado também é reportado, não lança', () => {
    const resultado = verificaAssinaturaNFe(modeloNaoAssinado());
    expect(resultado.valido).toBe(false);
    expect(resultado.erros.length).toBeGreaterThan(0);
  });
});
