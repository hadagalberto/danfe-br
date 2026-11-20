/**
 * Verificação RSA PKCS#1 v1.5 (RFC 8017 §8.2.2, "RSASSA-PKCS1-V1_5-VERIFY")
 * sobre `BigInt` nativo — puro TS, sem `node:crypto`, para funcionar em Node
 * e no navegador (a biblioteca não tem dependências nativas).
 *
 * Perfil da NF-e: `http://www.w3.org/2000/09/xmldsig#rsa-sha1` — a
 * assinatura é o bloco EMSA-PKCS1-v1_5(SHA-1) elevado a `e` módulo `n`
 * (operação pública — não é descriptografia de conteúdo, apenas a
 * operação de recuperação do PKCS#1 v1.5, permitida por RFC 8017 §8.2.2
 * nota 1).
 */

/** Chave pública RSA (inteiros grandes, positivo). */
export interface ChaveRsaPublica {
  /** Módulo n. */
  n: bigint;
  /** Expoente público e (tipicamente 65537). */
  e: bigint;
}

/** Prefixo DER DigestInfo do SHA-1 (RFC 8017 §9.2 nota 1). */
const DIGEST_INFO_SHA1 = Uint8Array.from([
  0x30, 0x21, 0x30, 0x09, 0x06, 0x05, 0x2b, 0x0e, 0x03, 0x02, 0x1a, 0x05, 0x00, 0x04, 0x14,
]);

/**
 * Verifica a assinatura RSA-SHA1 PKCS#1 v1.5: `assinatura` sobre
 * `resumoSha1` (digest de 20 bytes já calculado pelo chamador — verify.ts
 * aplica SHA-1 sobre a forma canônica).
 *
 * Passos (RFC 8017 §8.2.2): validar comprimento; montar EM =
 * 0x00 ‖ 0x01 ‖ PS(0xFF) ‖ 0x00 ‖ DigestInfo(SHA-1); calcular
 * s = assinatura^e mod n; comparar byte a byte.
 */
export function verificaRsaSha1Pkcs1v15(
  assinatura: Uint8Array,
  resumoSha1: Uint8Array,
  chave: ChaveRsaPublica,
): boolean {
  const k = tamanhoBytes(chave.n);
  if (resumoSha1.length !== 20 || assinatura.length !== k) {
    return false;
  }

  // EM esperado: 00 01 FF..FF 00 DigestInfo(SHA-1) — PS com ≥ 8 bytes.
  const t = DIGEST_INFO_SHA1.length + resumoSha1.length;
  if (k < t + 11) return false;
  const em = new Uint8Array(k);
  em[1] = 0x01;
  em.fill(0xff, 2, k - t - 1);
  em[k - t - 1] = 0x00;
  em.set(DIGEST_INFO_SHA1, k - t);
  em.set(resumoSha1, k - resumoSha1.length);

  // s = assinatura^e mod n; comparação byte a byte com EM.
  const s = bytesParaBigInt(assinatura);
  if (s >= chave.n) return false;
  const m = modPow(s, chave.e, chave.n);
  const recuperado = bigintParaBytes(m, k);
  for (let i = 0; i < k; i++) {
    if (recuperado[i] !== em[i]) return false;
  }
  return true;
}

/**
 * Exponenciação modular (quadrado-e-multiplica, janela por bit).
 * Entradas positivas; expoente arbitrário.
 */
export function modPow(base: bigint, expoente: bigint, modulo: bigint): bigint {
  if (modulo === 1n) return 0n;
  let resultado = 1n;
  let b = base % modulo;
  let e = expoente;
  while (e > 0n) {
    if (e & 1n) resultado = (resultado * b) % modulo;
    b = (b * b) % modulo;
    e >>= 1n;
  }
  return resultado;
}

/** Número de bytes significativos de um inteiro positivo. */
function tamanhoBytes(valor: bigint): number {
  let n = 0;
  let v = valor;
  while (v > 0n) {
    v >>= 8n;
    n++;
  }
  return n;
}

/** Uint8Array (big-endian) → BigInt positivo. */
export function bytesParaBigInt(bytes: Uint8Array): bigint {
  let valor = 0n;
  for (const b of bytes) valor = (valor << 8n) | BigInt(b);
  return valor;
}

/** BigInt positivo → Uint8Array big-endian com `tamanho` bytes. */
export function bigintParaBytes(valor: bigint, tamanho: number): Uint8Array {
  const bytes = new Uint8Array(tamanho);
  let v = valor;
  for (let i = tamanho - 1; i >= 0; i--) {
    bytes[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return bytes;
}
