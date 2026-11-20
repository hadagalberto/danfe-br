/**
 * danfe-br — parser, validador e renderizador de DANFE/DANFE NFC-e.
 *
 * Marco 1 (modelo + parser + validação):
 * - `parseNFe(xml)` — `nfeProc`/`NFe` → modelo tipado (`NFeProc`);
 * - `parseEventoNFe(xml)` — `procEventoNFe`/`procEventoCancNFe`/`procCCeNFe`
 *   → modelo tipado de evento (cancelamento e CC-e);
 * - `validateNFe(model)` — chave de acesso (DV módulo 11 + consistência),
 *   CNPJ/CPF (numérico e alfanumérico), recomputação de totais e protocolo;
 * - tipos do modelo em `./model`;
 * - fábrica de fixtures em `danfe-br/fixtures`.
 *
 * Marco 2 (códigos de barras + assinatura):
 * - `encodeCode128(texto)` — Code 128 com Code C e fallback em Code B;
 * - `encodeQrCode(dados, opcoes)` — QR Code modo byte, versões 1–40, EC M;
 * - `verificaAssinaturaNFe(xml)` — verificação XMLDSig do `infNFe` (C14N,
 *   SHA-1, RSA-SHA1, X.509), que reporta falhas sem lançar.
 */
export { parseNFe } from './parse/nfe';
export { parseEventoNFe, eventosDeLote } from './parse/evento';
export { ParseError } from './parse/xml';
export { validateNFe, type ResultadoValidacaoNFe } from './validate/validate';
export type { ProblemaValidacao, SeveridadeValidacao } from './model/comum';
export type { SituacaoProtocolo } from './validate/protocolo';
export { analisaProtocolo, CSTAT_AUTORIZADO, CSTAT_DENEGADO } from './validate/protocolo';
export { chaveAcessoValida, digitoVerificadorChave, montaChaveDeAcesso } from './validate/chave';
export { cnpjValido, cpfValido } from './validate/documentos';
export { validaChaveNFe, chaveEsperada, aammDeDhEmi } from './validate/chave';
export { validaDocumentos, calculaDvCnpj, calculaDvCpf } from './validate/documentos';
export {
  validaTotais,
  validaItens,
  TOLERANCIA_ITEM_CENTAVOS,
  TOLERANCIA_VNF_CENTAVOS,
} from './validate/totais';
export type {
  NFe,
  NFeProc,
  ProtNFe,
  Ide,
  Emit,
  Dest,
  Det,
  Prod,
  Imposto,
  Icms,
  Total,
  Transp,
  Cobr,
  Pag,
  InfAdic,
  InfRespTec,
  InfNFeSupl,
} from './model/nfe';
export type { ProcEventoNFe, DetEventoCancelamento, DetEventoCce } from './model/evento';
export { TP_EVENTO_CANCELAMENTO, TP_EVENTO_CCE } from './model/evento';
export { CODIGOS_UF } from './model/comum';

// Marco 2 — códigos de barras (ISO/IEC 15417 e ISO/IEC 18004)
export { encodeCode128, ZONA_SILENCIO_CODE128 } from './barcode/code128';
export type { CodigoBarrasCode128 } from './barcode/code128';
export { encodeQrCode } from './qrcode/qrcode';
export type { OpcoesQrCode, QrCodeSimbolo } from './qrcode/qrcode';
export type { NivelCorrecao } from './qrcode/tabelas';

// Marco 2 — verificação da assinatura XMLDSig do infNFe
export {
  verificaAssinaturaNFe,
  URI_XMLDSIG,
  ALG_RSA_SHA1,
  ALG_SHA1,
  ALG_C14N,
} from './signature/verify';
export type { DetalhesAssinatura, ResultadoVerificacaoAssinatura } from './signature/verify';

// Utilitários de baixo nível (testes vetoriais e integrações avançadas)
export { canonicalizaElemento } from './signature/c14n';
export type { OpcoesC14n } from './signature/c14n';
export { sha1, SHA1_BYTES } from './signature/sha1';
export { encodeBase64, decodeBase64 } from './signature/base64';
export { verificaRsaSha1Pkcs1v15, modPow, bytesParaBigInt, bigintParaBytes } from './signature/rsa';
export type { ChaveRsaPublica } from './signature/rsa';
export { extraiChavePublicaRsa, certificadoPemParaDer, bitsModulo } from './signature/x509';
export {
  lerXml,
  procuraElemento,
  listaElementos,
  textoDe,
  atributo,
  ErroXml,
} from './signature/xml-reader';
export type {
  AtributoXml,
  DocumentoXml,
  NoElemento,
  NoTexto,
  NoPi,
  NoXml,
} from './signature/xml-reader';
