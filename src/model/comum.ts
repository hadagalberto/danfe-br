/**
 * Tipos básicos compartilhados do modelo tipado da NF-e/NFC-e.
 *
 * Fonte: `schemas/PL_009q_NT2025_001_v1.00/tiposBasico_v4.00.xsd`
 * (Pacote de Liberação 009q da NF-e, layout 4.00, publicado pela SEFAZ em
 * https://dfe-portal.svrs.rs.gov.br/NFe/Documentos) e o MOC 7.0 — Anexo I
 * (Leiaute e Regras de Validação), aprovado pelo Ato COTEPE ICMS 69/20.
 *
 * Convenções do modelo:
 * - Nomes de campos idênticos aos das tags XML (cUF, cNF, xNome, ...) para
 *   facilitar a auditoria contra o XSD e o MOC.
 * - Decimais (`TDec_*`) viram `number` (o XML sempre traz 2-4 casas).
 * - Datas/horas (`TDateTimeUTC`) permanecem como `string` ISO-8601 com o
 *   fuso original do documento (ex.: `2026-11-20T10:48:39-03:00`), sem perda
 *   de informação.
 * - Grupos opcionais (`0-1`) viram propriedades opcionais; grupos
 *   repetíveis (`0-n`) viram arrays (possivelmente vazios).
 */

/** TAmb — 1 = Produção, 2 = Homologação. */
export type TpAmb = 1 | 2;

/**
 * TFinNFe — finalidade de emissão da NF-e (campo B24).
 * 1 = Normal, 2 = Complementar, 3 = Ajuste, 4 = Devolução/Retorno.
 */
export type FinNFe = 1 | 2 | 3 | 4;

/** B21 tpNF — 0 = Entrada, 1 = Saída. */
export type TpNF = 0 | 1;

/** B19 idDest — 1 = Operação interna, 2 = Interestadual, 3 = Exterior. */
export type IdDest = 1 | 2 | 3;

/** B25a indFinal — 0 = Normal, 1 = Consumidor final. */
export type IndFinal = 0 | 1;

/**
 * B25b indPres — indicador de presença do comprador.
 * 0 = Não se aplica; 1 = Presencial; 2 = Internet; 3 = Teleatendimento;
 * 4 = Entrega a domicílio; 5 = Presencial, fora estabelecimento;
 * 9 = Presencial, NFC-e (tipo de operação do SAT-CF-e-SAT).
 */
export type IndPres = 0 | 1 | 2 | 3 | 4 | 5 | 9;

/** E16a indIEDest — 1 = Contribuinte ICMS, 2 = Isento, 3 = Não contribuinte, 4 = Simples Nacional (MEI?), 9 = Exterior. */
export type IndIEDest = 1 | 2 | 3 | 4 | 9;

/** B04/B06 mod — 55 = NF-e, 65 = NFC-e. */
export type ModeloDfe = 55 | 65;

/** B28 procEmi — 0 = Emissão de NF-e com aplicativo do contribuinte; 1-3 = emissão pelo Fisco. */
export type ProcEmi = 0 | 1 | 2 | 3;

/** Torig (N02) — origem da mercadoria: 0-6. */
export type Origem = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** CRT do emitente (C05): 1 = Simples Nacional, 2 = Simples Nacional — excesso, 3 = Regime Normal, 4 = MEI. */
export type CRT = 1 | 2 | 3 | 4;

/** I17b indTot — 0 = valor do item não compõe o total da NF-e, 1 = compõe. */
export type IndTot = 0 | 1;

/** X02 tpImp — formato de impressão do DANFE: 1 = retrato, 2 = paisagem, 3 = simplificado, 4 = DANFE NFC-e, 5 = DANFE NFC-e eletrônico. */
export type TpImp = 1 | 2 | 3 | 4 | 5;

/**
 * B22 tpEmis — forma de emissão (também compõe a chave de acesso):
 * 1 = Normal; 2 = Contingência FS-IA; 3 = Contingência SCAN; 4 = Contingência DPEC;
 * 5 = Contingência FS-DA; 6 = Contingência SVC-AN; 7 = Contingência SVC-RS;
 * 9 = Contingência off-line da NFC-e.
 */
export type TpEmis = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 9;

/**
 * N13 modBC — modalidade de determinação da BC do ICMS:
 * 0 = Margem Valor Agregado (%); 1 = Pauta (valor); 2 = Preço Tabelado Máx. (valor); 3 = Valor da Operação.
 */
export type ModBC = 0 | 1 | 2 | 3;

/**
 * N18 modBCST — modalidade de determinação da BC do ICMS ST (valores do XSD
 * oficial, distintos do modBC):
 * 0 = Preço tabelado; 1 = Lista Negativa; 2 = Lista Positiva; 3 = Lista Neutra;
 * 4 = Margem Valor Agregado (%); 5 = Pauta (valor).
 */
export type ModBCST = 0 | 1 | 2 | 3 | 4 | 5;

/** Motivo da desoneração do ICMS (N29/I07 motDesICMS): 1-11, 90. */
export type MotDesIcms = 1 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 90;

/**
 * X03 modFrete — 0 = Conta do remetente/emissor (CIF); 1 = Conta do destinatário (FOB);
 * 2 = Conta de terceiros; 3 = Própria por conta do remetente; 4 = Própria por conta do destinatário;
 * 9 = Sem ocorrência de transporte.
 */
export type ModFrete = 0 | 1 | 2 | 3 | 4 | 5 | 9;

/** Z07 indPag — 0 = pagamento à vista, 1 = à prazo, 2 = outros (grupo YA, layout 4.00). */
export type IndPag = 0 | 1 | 2;

/**
 * Tpag (YA05a) — meio de pagamento. Codificação oficial do MOC 4.00 com as
 * inclusões do Informe Técnico 2024.002 (tabela de meios de pagamento):
 * 01 Dinheiro; 02 Cheque; 03 Cartão de Crédito; 04 Cartão de Débito; 05 Crédito de Loja;
 * 10 Vale Alimentação; 11 Vale Refeição; 12 Vale Presente; 13 Vale Combustível;
 * 14 Duplicata Mercantil; 15 Boleto Bancário; 16 Depósito Bancário;
 * 17 Pagamento Instantâneo (PIX); 18 Transferência Bancária; 19 Financeira;
 * 20 Crediário; 90 Sem Pagamento; 99 Outros.
 */
export type TPag =
  | '01'
  | '02'
  | '03'
  | '04'
  | '05'
  | '10'
  | '11'
  | '12'
  | '13'
  | '14'
  | '15'
  | '16'
  | '17'
  | '18'
  | '19'
  | '20'
  | '90'
  | '99';

/** UA03 tpIntegra — 1 = Pagamento integrado (Tef), 2 = não integrado. */
export type TpIntegra = 1 | 2;

/** Endereço (TEnderEmi / TEndereco — grupos C05, E03). */
export interface Endereco {
  xLgr: string;
  nro: string;
  xCpl?: string;
  xBairro: string;
  cMun: number;
  xMun: string;
  uf: string;
  cep?: string;
  cPais?: number;
  xPais?: string;
  fone?: string;
}

/** Códigos de UF da tabela IBGE usados na chave de acesso (TCodUfIBGE / B02 cUF). */
export const CODIGOS_UF: Readonly<Record<string, number>> = {
  RO: 11,
  AC: 12,
  AM: 13,
  RR: 14,
  PA: 15,
  AP: 16,
  TO: 17,
  MA: 21,
  PI: 22,
  CE: 23,
  RN: 24,
  PB: 25,
  PE: 26,
  AL: 27,
  SE: 28,
  BA: 29,
  MG: 31,
  ES: 32,
  RJ: 33,
  SP: 35,
  PR: 41,
  SC: 42,
  RS: 43,
  MS: 50,
  MT: 51,
  GO: 52,
  DF: 53,
} as const;

/** Resultado de validação de um documento fiscal. */
export type SeveridadeValidacao = 'erro' | 'aviso';

/**
 * Um problema encontrado pela validação (`validateNFe`).
 *
 * `regra` e `cStat` referem-se, quando existem, às Regras de Validação e aos
 * códigos de rejeição oficiais do MOC 7.0 — Anexo I (seção 4.4), para
 * rastreabilidade com o comportamento da SEFAZ Autorizadora.
 */
export interface ProblemaValidacao {
  severity: SeveridadeValidacao;
  /** Identificador estável do problema para uso programático (ex.: `CHAVE_DV`). */
  code: string;
  /** Regra de validação do MOC 7.0 — Anexo I (ex.: `B23-10`). */
  regra?: string;
  /** Código oficial de rejeição/denegação da SEFAZ (ex.: 253). */
  cStat?: number;
  /** Tag ou caminho relacionado (ex.: `infNFe@Id`). */
  campo?: string;
  /** Mensagem em pt-BR descrevendo o problema. */
  message: string;
}
