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
