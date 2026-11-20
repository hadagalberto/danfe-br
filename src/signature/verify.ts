/**
 * Verificacao da assinatura XMLDSig do `infNFe` (perfil NF-e).
 *
 * O documento autorizado contem, como irmao do `infNFe`, um elemento
 * `Signature` (namespace `http://www.w3.org/2000/09/xmldsig#`) com:
 * - `SignedInfo` contendo `CanonicalizationMethod` (C14N 1.0 sem
 *   comentarios), `SignatureMethod` (rsa-sha1) e `Reference` ao `Id` do
 *   `infNFe`, com `DigestMethod` sha1 e `DigestValue`;
 * - `SignatureValue` — a assinatura RSA-SHA1 do `SignedInfo` canonico;
 * - `KeyInfo/X509Data/X509Certificate` — o certificado do emissor.
 *
 * Fluxo verificado (XML Signature Core, W3C Recommendation 12/04/2002,
 * https://www.w3.org/TR/2002/REC-xmldsig-core-20020412 — consultado em
 * 20/11/2026; perfil NF-e conforme o MOC, padrões de assinatura digital):
 * 1. localizar `Signature`/`SignedInfo`/`Reference`/`X509Certificate`;
 * 2. validar algoritmos declarados (C14N inclusiva, SHA-1, RSA-SHA1);
 * 3. resolver a referencia interna (`#Id`) e conferir o `DigestValue` sobre
 *    a forma canonica do `infNFe` (com transform enveloped-signature, que
 *    e inofensiva porque o `Signature` esta fora do subconjunto);
 * 4. verificar `SignatureValue` com a chave publica extraida do X.509 sobre
 *    o `SignedInfo` canonico.
 *
 * A funcao **reporta, nunca lanca** para assinaturas invalidas: qualquer
 * falha vira uma entrada em `erros` e `valido: false`.
 */
import { decodeBase64, encodeBase64 } from './base64';
import { canonicalizaElemento } from './c14n';
import { verificaRsaSha1Pkcs1v15 } from './rsa';
import { sha1 } from './sha1';
import {
  atributo,
  lerXml,
  procuraElemento,
  textoDe,
  type DocumentoXml,
  type NoElemento,
} from './xml-reader';
import { bitsModulo, extraiChavePublicaRsa } from './x509';

/** Namespace XMLDSig (W3C XML Signature Core). */
export const URI_XMLDSIG = 'http://www.w3.org/2000/09/xmldsig#';

/** URN do algoritmo RSA-SHA1 do XMLDSig. */
export const ALG_RSA_SHA1 = `${URI_XMLDSIG}rsa-sha1`;
/** URN do algoritmo de digest SHA-1 do XMLDSig. */
export const ALG_SHA1 = `${URI_XMLDSIG}sha1`;
/** URN da C14N 1.0 sem comentarios (perfil NF-e). */
export const ALG_C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';

/** Detalhes da verificacao — preenchidos ate onde o documento permitir. */
export interface DetalhesAssinatura {
  /** URI da `Reference` (ex.: `#NFe3526...`). */
  uriReferencia?: string;
  /** Valor do atributo `Id` do elemento alvo da referencia. */
  idAlvo?: string;
  /** `DigestValue` declarado em Base64. */
  digestDeclarado?: string;
  /** SHA-1 da forma canonica do alvo, em Base64. */
  digestCalculado?: string;
  /** Os dois digests conferem? */
  digestValido?: boolean;
  /** URN do `SignatureMethod` declarado. */
  metodoAssinatura?: string;
  /** RSA-SHA1 do `SignedInfo` valido? */
  assinaturaValida?: boolean;
  /** Certificado X.509 encontrado e processado. */
  certificado: {
    presente: boolean;
    /** Bits do modulo RSA (ex.: 2048). */
    bitsModulo?: number;
  };
}

/** Resultado da verificacao — nunca lanca. */
export interface ResultadoVerificacaoAssinatura {
  valido: boolean;
  /** Lista de problemas encontrados (vazia quando `valido`). */
  erros: string[];
  detalhes: DetalhesAssinatura;
}

function resultados(erros: string[], detalhes: DetalhesAssinatura): ResultadoVerificacaoAssinatura {
  return { valido: erros.length === 0, erros, detalhes };
}

function mensagem(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}

/**
 * Verifica a assinatura XMLDSig contida em `xml`.
 *
 * @param xml documento `NFe`/`nfeProc` com o elemento `Signature`.
 * @returns relatorio com `valido`, `erros` e os detalhes de cada etapa.
 */
export function verificaAssinaturaNFe(xml: string): ResultadoVerificacaoAssinatura {
  const erros: string[] = [];
  const detalhes: DetalhesAssinatura = { certificado: { presente: false } };

  let documento: DocumentoXml;
  try {
    documento = lerXml(xml);
  } catch (erro) {
    return resultados([`XML mal formado: ${mensagem(erro)}`], detalhes);
  }

  try {
    const assinatura = procuraElemento(documento.raiz, 'Signature', URI_XMLDSIG);
    if (!assinatura) {
      return resultados(['Elemento Signature (XMLDSig) nao encontrado.'], detalhes);
    }

    const signedInfo = procuraElemento(assinatura, 'SignedInfo', URI_XMLDSIG);
    const signatureValueNo = procuraElemento(assinatura, 'SignatureValue', URI_XMLDSIG);
    const x509No = procuraElemento(assinatura, 'X509Certificate', URI_XMLDSIG);
    if (!signedInfo) erros.push('SignedInfo ausente.');
    if (!signatureValueNo) erros.push('SignatureValue ausente.');
    if (!x509No) erros.push('X509Certificate ausente.');

    verificaAlgoritmos(signedInfo, erros);

    if (x509No && signatureValueNo && signedInfo) {
      verificaAssinaturaValue(x509No, signatureValueNo, signedInfo, detalhes, erros);
    }
    if (signedInfo) {
      verificaReferencia(documento, signedInfo, detalhes, erros);
    }
  } catch (erro) {
    erros.push(`Falha na verificacao: ${mensagem(erro)}`);
  }

  return resultados(erros, detalhes);
}

/** Confere os URNs de algoritmos declarados no `SignedInfo`. */
function verificaAlgoritmos(signedInfo: NoElemento | undefined, erros: string[]): void {
  if (!signedInfo) return;

  const c14n = procuraElemento(signedInfo, 'CanonicalizationMethod', URI_XMLDSIG);
  const algoritmoC14n = c14n ? atributo(c14n, 'Algorithm') : undefined;
  if (algoritmoC14n !== ALG_C14N) {
    erros.push(
      `CanonicalizationMethod nao suportado: ${algoritmoC14n ?? 'ausente'} ` +
        `(esperado C14N 1.0 sem comentarios, ${ALG_C14N}).`,
    );
  }

  const metodo = procuraElemento(signedInfo, 'SignatureMethod', URI_XMLDSIG);
  const algoritmoAssinatura = metodo ? atributo(metodo, 'Algorithm') : undefined;
  if (algoritmoAssinatura !== ALG_RSA_SHA1) {
    erros.push(
      `SignatureMethod nao suportado: ${algoritmoAssinatura ?? 'ausente'} ` +
        `(esperado ${ALG_RSA_SHA1}).`,
    );
  }
}

/** Verifica `SignatureValue` com a chave publica do certificado X.509. */
function verificaAssinaturaValue(
  x509No: NoElemento,
  signatureValueNo: NoElemento,
  signedInfo: NoElemento,
  detalhes: DetalhesAssinatura,
  erros: string[],
): void {
  detalhes.certificado.presente = true;
  try {
    const certificadoDer = decodeBase64(textoDe(x509No));
    const chave = extraiChavePublicaRsa(certificadoDer);
    detalhes.certificado.bitsModulo = bitsModulo(chave);

    const assinatura = decodeBase64(textoDe(signatureValueNo));
    const canonico = canonicalizaElemento(signedInfo);
    const resumo = sha1(new TextEncoder().encode(canonico));
    detalhes.assinaturaValida = verificaRsaSha1Pkcs1v15(assinatura, resumo, chave);
    if (!detalhes.assinaturaValida) {
      erros.push('SignatureValue invalido: RSA-SHA1 do SignedInfo nao confere.');
    }
  } catch (erro) {
    erros.push(`Falha ao verificar SignatureValue: ${mensagem(erro)}`);
  }
}

/** Confere o digest da `Reference` contra a forma canonica do elemento alvo. */
function verificaReferencia(
  documento: DocumentoXml,
  signedInfo: NoElemento,
  detalhes: DetalhesAssinatura,
  erros: string[],
): void {
  const reference = procuraElemento(signedInfo, 'Reference', URI_XMLDSIG);
  if (!reference) {
    erros.push('Reference ausente no SignedInfo.');
    return;
  }

  detalhes.uriReferencia = atributo(reference, 'URI');
  const digestMethod = procuraElemento(reference, 'DigestMethod', URI_XMLDSIG);
  const algoritmoDigest = digestMethod ? atributo(digestMethod, 'Algorithm') : undefined;
  if (algoritmoDigest !== ALG_SHA1) {
    erros.push(
      `DigestMethod nao suportado: ${algoritmoDigest ?? 'ausente'} (esperado ${ALG_SHA1}).`,
    );
  }

  const digestValueNo = procuraElemento(reference, 'DigestValue', URI_XMLDSIG);
  if (!digestValueNo) {
    erros.push('DigestValue ausente na Reference.');
    return;
  }

  try {
    detalhes.digestDeclarado = textoDe(digestValueNo).replace(/\s+/g, '');
    const alvo = resolveReferencia(documento, detalhes.uriReferencia);
    if (!alvo) {
      erros.push(`Referencia nao resolvida: ${detalhes.uriReferencia ?? 'URI ausente'}.`);
      return;
    }
    detalhes.idAlvo = atributo(alvo, 'Id') ?? atributo(alvo, 'id');

    const canonico = canonicalizaElemento(alvo, { excluirAssinatura: true });
    detalhes.digestCalculado = encodeBase64(sha1(new TextEncoder().encode(canonico)));
    detalhes.digestValido = detalhes.digestCalculado === detalhes.digestDeclarado;
    if (!detalhes.digestValido) {
      erros.push('DigestValue da Reference nao confere: conteudo do infNFe alterado.');
    }
  } catch (erro) {
    erros.push(`Falha ao verificar DigestValue: ${mensagem(erro)}`);
  }
}

/** Resolve uma URI de referencia interna (`#Id`) para o elemento alvo. */
function resolveReferencia(
  documento: DocumentoXml,
  uri: string | undefined,
): NoElemento | undefined {
  if (!uri?.startsWith('#')) return undefined;
  const id = uri.slice(1);
  if (id.length === 0) return undefined;
  return procuraPorId(documento.raiz, id);
}

function procuraPorId(base: NoElemento, id: string): NoElemento | undefined {
  if (atributo(base, 'Id') === id || atributo(base, 'id') === id) return base;
  for (const filho of base.filhos) {
    if (filho.tipo !== 'elemento') continue;
    const achado = procuraPorId(filho, id);
    if (achado) return achado;
  }
  return undefined;
}
