/**
 * SHA-1 (FIPS 180-4 / RFC 3174) — implementação própria, sem dependências.
 *
 * O perfil de assinatura da NF-e usa SHA-1 como função de resumo
 * (`http://www.w3.org/2000/09/xmldsig#sha1`, MOC — padrões de assinatura
 * digital do projeto NF-e; ver também o FAQ oficial do projeto:
 * "Função de 'message digest': SHA-1 (w3c.org/2000/09/xmldsig#sha1)").
 *
 * Uso restrito à verificação do XMLDSig legado da NF-e — SHA-1 não é mais
 * seguro contra colisões para fins gerais (SHAttered, 2017) e não deve ser
 * adotado em novos designs; a SEFAZ o mantém por compatibilidade do leiaute.
 */

/** Tamanho do resumo SHA-1 em bytes (160 bits). */
export const SHA1_BYTES = 20;

/**
 * Calcula o resumo SHA-1 de `bytes`.
 *
 * Estrutura (FIPS 180-4 §6.1): padding com 0x80 + zeros + comprimento de
 * 64 bits big-endian; 80 rodadas por bloco de 512 bits com as funções f
 * por intervalos de t e constantes K.
 */
export function sha1(bytes: Uint8Array): Uint8Array {
  const comprimentoBits = bytes.length * 8;
  // Mensagem estendida: dados || 0x80 || zeros(→56 mod 64) || uint64BE(bits)
  const total =
    bytes.length + 1 + ((55 - bytes.length) % 64 + 64) % 64 + 8;
  const m = new Uint8Array(total);
  m.set(bytes, 0);
  m[bytes.length] = 0x80;
  const alto = Math.floor(comprimentoBits / 2 ** 32);
  m[total - 8] = (alto >>> 24) & 0xff;
  m[total - 7] = (alto >>> 16) & 0xff;
  m[total - 6] = (alto >>> 8) & 0xff;
  m[total - 5] = alto & 0xff;
  m[total - 4] = (comprimentoBits >>> 24) & 0xff;
  m[total - 3] = (comprimentoBits >>> 16) & 0xff;
  m[total - 2] = (comprimentoBits >>> 8) & 0xff;
  m[total - 1] = comprimentoBits & 0xff;

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  const w = new Uint32Array(80);
  for (let bloco = 0; bloco < total; bloco += 64) {
    for (let t = 0; t < 16; t++) {
      const i = bloco + t * 4;
      w[t] = (m[i]! << 24) | (m[i + 1]! << 16) | (m[i + 2]! << 8) | m[i + 3]!;
    }
    for (let t = 16; t < 80; t++) {
      w[t] = rotl(w[t - 3]! ^ w[t - 8]! ^ w[t - 14]! ^ w[t - 16]!, 1);
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    for (let t = 0; t < 80; t++) {
      let f: number;
      let k: number;
      if (t < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (t < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (t < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const temp = (rotl(a, 5) + f + e + k + w[t]!) | 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = temp;
    }
    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
  }

  const saida = new Uint8Array(SHA1_BYTES);
  escreve32(saida, 0, h0);
  escreve32(saida, 4, h1);
  escreve32(saida, 8, h2);
  escreve32(saida, 12, h3);
  escreve32(saida, 16, h4);
  return saida;
}

/** Rotação à esquerda de `x` por `n` bits (32 bits). */
function rotl(x: number, n: number): number {
  return ((x << n) | (x >>> (32 - n))) | 0;
}

/** Escreve um uint32 big-endian em `bytes` na posição `pos`. */
function escreve32(bytes: Uint8Array, pos: number, valor: number): void {
  bytes[pos] = (valor >>> 24) & 0xff;
  bytes[pos + 1] = (valor >>> 16) & 0xff;
  bytes[pos + 2] = (valor >>> 8) & 0xff;
  bytes[pos + 3] = valor & 0xff;
}
