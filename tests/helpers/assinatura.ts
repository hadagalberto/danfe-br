/**
 * Geracao de fixtures assinadas para os testes de XMLDSig.
 *
 * O certificado autoassinado (RSA 2048) e a chave privada são fixtures
 * versionadas em `tests/fixtures/signature/`, geradas uma única vez com
 * `openssl req -x509 -newkey rsa:2048 -sha256`. A assinatura e o digest são
 * calculados em tempo de teste com `node:crypto` (dependência de runtime
 * permitida **apenas em testes**), de modo que o verificador puro TS seja
 * conferido contra uma implementação criptográfica independente.
 */
import { createHash, createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { canonicalizaElemento } from '../../src/signature/c14n';
import { lerXml, procuraElemento } from '../../src/signature/xml-reader';

export const CERT_PEM = readFileSync(
  new URL('../fixtures/signature/cert.pem', import.meta.url),
  'utf8',
);
export const KEY_PEM = readFileSync(
  new URL('../fixtures/signature/key.pem', import.meta.url),
  'utf8',
);

export const ID_NFE = 'NFe35260110562655620245550280000217691341262140';

const C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
const RSA_SHA1 = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1';
const SHA1 = 'http://www.w3.org/2000/09/xmldsig#sha1';
const ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';

/** Base64 do certificado sem os delimitadores PEM. */
export function certEmBase64(): string {
  return CERT_PEM.split(/\r?\n/)
    .filter((linha) => !linha.startsWith('-----'))
    .join('')
    .trim();
}

/** XML com um `Signature` completo, mas com marcadores para digest/assinatura/certificado. */
export function modeloNaoAssinado(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe xmlns="http://www.portalfiscal.inf.br/nfe">
    <infNFe Id="${ID_NFE}" versao="4.00">
      <ide><cUF>35</cUF><nNF>1</nNF></ide>
      <total><ICMSTot><vNF>10.00</vNF></ICMSTot></total>
    </infNFe>
    <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
      <SignedInfo>
        <CanonicalizationMethod Algorithm="${C14N}"/>
        <SignatureMethod Algorithm="${RSA_SHA1}"/>
        <Reference URI="#${ID_NFE}">
          <Transforms>
            <Transform Algorithm="${ENVELOPED}"/>
            <Transform Algorithm="${C14N}"/>
          </Transforms>
          <DigestMethod Algorithm="${SHA1}"/>
          <DigestValue>{{DIGEST}}</DigestValue>
        </Reference>
      </SignedInfo>
      <SignatureValue>{{SIGNATURE}}</SignatureValue>
      <KeyInfo><X509Data><X509Certificate>{{CERT}}</X509Certificate></X509Data></KeyInfo>
    </Signature>
  </NFe>
</nfeProc>`;
}

/**
 * Preenche DigestValue (SHA-1 do infNFe canonico) e SignatureValue
 * (RSA-SHA1 do SignedInfo canonico) usando `node:crypto`.
 */
export function assinaModelo(modelo: string = modeloNaoAssinado()): string {
  const documento = lerXml(modelo);
  const infNFe = procuraElemento(documento.raiz, 'infNFe');
  if (!infNFe) throw new Error('Modelo sem infNFe.');
  const canonicoInf = canonicalizaElemento(infNFe);
  const digest = createHash('sha1').update(Buffer.from(canonicoInf, 'utf8')).digest('base64');

  const comDigest = modelo.replace('{{DIGEST}}', digest).replace('{{CERT}}', certEmBase64());
  const documento2 = lerXml(comDigest);
  const signedInfo = procuraElemento(documento2.raiz, 'SignedInfo');
  if (!signedInfo) throw new Error('Modelo sem SignedInfo.');
  const canonicoSi = canonicalizaElemento(signedInfo);

  const assinador = createSign('RSA-SHA1');
  assinador.update(Buffer.from(canonicoSi, 'utf8'));
  const assinatura = assinador.sign(KEY_PEM, 'base64');
  return comDigest.replace('{{SIGNATURE}}', assinatura);
}
