/**
 * Extracao da chave publica RSA de um certificado X.509 (RFC 5280) —
 * implementacao propria de um leitor DER minimalista, sem `node:crypto`,
 * para manter a biblioteca pura (Node + navegador).
 *
 * O perfil de assinatura da NF-e transporta o certificado do emissor no
 * elemento `X509Certificate` do XMLDSig, em Base64. A cadeia de confianca
 * (ICP-Brasil) **nao** e validada aqui: este modulo apenas extrai `n` e `e`
 * da `subjectPublicKeyInfo` para a verificacao RSA-SHA1 do `SignedInfo`.
 * A validade temporal e o status de revogacao devem ser tratados pelo
 * consumidor, fora do escopo da verificacao criptografica da assinatura.
 *
 * Estrutura DER percorrida (RFC 5280 §4.1.1 / RFC 3279 §2.3.1):
 *
 * ```
 * Certificate ::= SEQUENCE {
 *   tbsCertificate       TBSCertificate,
 *   signatureAlgorithm   AlgorithmIdentifier,
 *   signatureValue       BIT STRING }
 *
 * TBSCertificate ::= SEQUENCE {
 *   version         [0] EXPLICIT Version DEFAULT v1,
 *   serialNumber    CertificateSerialNumber,
 *   signature       AlgorithmIdentifier,
 *   issuer          Name,
 *   validity        Validity,
 *   subject         Name,
 *   subjectPublicKeyInfo SubjectPublicKeyInfo,
 *   ... }
 *
 * SubjectPublicKeyInfo ::= SEQUENCE {
 *   algorithm         AlgorithmIdentifier,
 *   subjectPublicKey  BIT STRING }        -- DER de RSAPublicKey
 *
 * RSAPublicKey ::= SEQUENCE { modulus INTEGER, publicExponent INTEGER }
 * ```
 *
 * Tags ASN.1 usadas: 0x30 SEQUENCE, 0x02 INTEGER, 0x03 BIT STRING,
 * 0xA0 contexto-especifico [0] (versao explicita). Fonte: RFC 5280,
 * https://www.rfc-editor.org/rfc/rfc5280 (consultado em 20/11/2026).
 */
import { decodeBase64 } from './base64';
import { bytesParaBigInt, type ChaveRsaPublica } from './rsa';

/** Tag ASN.1 (identificador) + conteudo de um TLV DER. */
interface Tlv {
  tag: number;
  conteudo: Uint8Array;
}

/** Leitor sequencial de TLVs DER. */
class LeitorDer {
  private pos = 0;

  constructor(private readonly bytes: Uint8Array) {}

  /** Le o proximo TLV, avancando o cursor. */
  le(): Tlv {
    if (this.pos >= this.bytes.length) {
      throw new Error('X.509/DER: fim inesperado ao ler tag.');
    }
    const tag = this.bytes[this.pos++]!;
    const tamanho = this.leComprimento();
    if (tamanho > this.bytes.length - this.pos) {
      throw new Error('X.509/DER: conteudo do TLV excede o documento.');
    }
    const conteudo = this.bytes.subarray(this.pos, this.pos + tamanho);
    this.pos += tamanho;
    return { tag, conteudo };
  }

  /** Fim dos bytes deste nivel? */
  get esgotado(): boolean {
    return this.pos >= this.bytes.length;
  }

  private leComprimento(): number {
    const primeiro = this.bytes[this.pos++]!;
    if ((primeiro & 0x80) === 0) return primeiro; // forma curta: 0..127
    const quantos = primeiro & 0x7f;
    if (quantos === 0 || quantos > 4) {
      throw new Error('X.509/DER: comprimento longo invalido.');
    }
    if (quantos > this.bytes.length - this.pos) {
      throw new Error('X.509/DER: bytes de comprimento incompletos.');
    }
    let tamanho = 0;
    for (let i = 0; i < quantos; i++) {
      tamanho = tamanho * 256 + this.bytes[this.pos++]!;
    }
    return tamanho;
  }
}

/** Le um unico TLV que deve ocupar todo `bytes` com a tag esperada. */
function tlvUnico(bytes: Uint8Array, tag: number, nome: string): Uint8Array {
  const leitor = new LeitorDer(bytes);
  const tlv = leitor.le();
  exigeTag(tlv, tag, nome);
  if (!leitor.esgotado) throw new Error(`X.509/DER: bytes extras apos ${nome}.`);
  return tlv.conteudo;
}

function exigeTag(tlv: Tlv, tag: number, nome: string): void {
  if (tlv.tag !== tag) {
    throw new Error(
      `X.509/DER: esperada tag 0x${tag.toString(16)} (${nome}), encontrada 0x${tlv.tag.toString(16)}.`,
    );
  }
}

/**
 * Extrai `(n, e)` da chave publica RSA contida em um certificado X.509 DER.
 *
 * @throws {Error} certificado malformado ou nao contendo chave RSA.
 */
export function extraiChavePublicaRsa(certificadoDer: Uint8Array): ChaveRsaPublica {
  const cert = new LeitorDer(tlvUnico(certificadoDer, 0x30, 'Certificate'));
  const tbs = cert.le();
  exigeTag(tbs, 0x30, 'TBSCertificate');

  const campos = new LeitorDer(tbs.conteudo);
  let campo = campos.le();
  if (campo.tag === 0xa0) campo = campos.le(); // [0] EXPLICIT Version (v2/v3)
  exigeTag(campo, 0x02, 'serialNumber');
  exigeTag(campos.le(), 0x30, 'signature');
  exigeTag(campos.le(), 0x30, 'issuer');
  exigeTag(campos.le(), 0x30, 'validity');
  exigeTag(campos.le(), 0x30, 'subject');

  const spki = campos.le();
  exigeTag(spki, 0x30, 'subjectPublicKeyInfo');
  const info = new LeitorDer(spki.conteudo);
  exigeTag(info.le(), 0x30, 'algorithm');

  const chavePublica = info.le();
  exigeTag(chavePublica, 0x03, 'subjectPublicKey');
  const bits = chavePublica.conteudo;
  if (bits.length < 2 || bits[0] !== 0) {
    throw new Error('X.509/DER: subjectPublicKey nao e uma string de bits alinhada.');
  }
  const rsa = new LeitorDer(tlvUnico(bits.subarray(1), 0x30, 'RSAPublicKey'));
  const modulus = rsa.le();
  exigeTag(modulus, 0x02, 'modulus');
  const expoente = rsa.le();
  exigeTag(expoente, 0x02, 'publicExponent');
  if (rsa.esgotado === false) {
    throw new Error('X.509/DER: RSAPublicKey com campos inesperados.');
  }

  const n = bytesParaBigInt(modulus.conteudo);
  const e = bytesParaBigInt(expoente.conteudo);
  if (n <= 0n || e <= 1n) {
    throw new Error('X.509/DER: chave publica RSA invalida.');
  }
  return { n, e };
}

/**
 * Remove cabecalhos/rodape PEM e decodifica o certificado em DER.
 * Util para testes que leem fixtures `.pem` geradas com `openssl`.
 */
export function certificadoPemParaDer(pem: string): Uint8Array {
  const base64 = pem
    .split(/\r?\n/)
    .filter((linha) => !linha.startsWith('-----'))
    .join('')
    .trim();
  if (base64.length === 0) throw new Error('PEM: certificado vazio.');
  return decodeBase64(base64);
}

/** Numero de bits do modulo da chave (2048 em certificados de teste tipicos). */
export function bitsModulo(chave: ChaveRsaPublica): number {
  return chave.n.toString(2).length;
}
