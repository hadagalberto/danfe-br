/**
 * Base64 (RFC 4648) — codificação e decodificação sem dependências (a
 * biblioteca funciona em Node e no navegador sem `Buffer`/`btoa`).
 *
 * Usado pelo XMLDSig: `DigestValue`, `SignatureValue` e `X509Certificate`
 * são valores binários em Base64; o padrão XML Signature admite espaços em
 * branco entre as linhas, que devem ser descartados antes de decodificar
 * (XML Signature Core, §4.4 e §6.6.4/"base64" decoding of white space).
 */

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Codifica bytes em Base64 padrão (com padding `=`). */
export function encodeBase64(bytes: Uint8Array): string {
  let saida = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = i + 1 < bytes.length ? bytes[i + 1]! : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2]! : 0;
    saida += ALFABETO[b0 >>> 2];
    saida += ALFABETO[((b0 & 0x03) << 4) | (b1 >>> 4)];
    saida += i + 1 < bytes.length ? ALFABETO[((b1 & 0x0f) << 2) | (b2 >>> 6)] : '=';
    saida += i + 2 < bytes.length ? ALFABETO[b2 & 0x3f] : '=';
  }
  return saida;
}

/** Descarta todo espaço em branco (linhas longas do XMLDSig). */
function semEspacos(texto: string): string {
  return texto.replace(/\s+/g, '');
}

/**
 * Decodifica Base64; ignora espaços em branco (XMLDSig envolve linhas).
 *
 * @throws {RangeError} comprimento inválido, padding fora do padrão ou
 *   caractere fora do alfabeto.
 */
export function decodeBase64(texto: string): Uint8Array {
  const limpo = semEspacos(texto);
  if (limpo.length === 0) return new Uint8Array(0);
  if (limpo.length % 4 !== 0) {
    throw new RangeError('Base64: comprimento não é múltiplo de 4.');
  }
  const padding = /=$/.test(limpo) ? (limpo.endsWith('==') ? 2 : 1) : 0;
  const corpo = limpo.slice(0, limpo.length - padding);
  if (corpo.includes('=')) {
    throw new RangeError('Base64: padding "=" fora do final do valor.');
  }
  const bytes = new Uint8Array((limpo.length / 4) * 3 - padding);
  let pos = 0;
  for (let i = 0; i < limpo.length; i += 4) {
    let triplo = 0;
    for (let j = 0; j < 4; j++) {
      const c = limpo[i + j]!;
      const v = c === '=' ? 0 : ALFABETO.indexOf(c);
      if (v < 0) {
        throw new RangeError(`Base64: caractere inválido ${JSON.stringify(c)}.`);
      }
      triplo = (triplo << 6) | v;
    }
    const validos = Math.min(3, bytes.length - pos);
    for (let j = 0; j < validos; j++) bytes[pos++] = (triplo >>> (16 - 8 * j)) & 0xff;
  }
  return bytes;
}
