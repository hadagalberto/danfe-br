/**
 * Modelo tipado da NF-e (modelo 55) e da NFC-e (modelo 65), layout 4.00.
 *
 * Estrutura e obrigatoriedade seguem os XSDs oficiais vendados em
 * `schemas/PL_009q_NT2025_001_v1.00/` (Pacote de Liberação 009q —
 * https://dfe-portal.svrs.rs.gov.br/NFe/Documentos, download de 20/11/2026) e
 * o MOC 7.0 — Anexo I (Leiaute e Regras de Validação da NF-e e da NFC-e).
 * Os identificadores entre parênteses nos comentários (B02, C02, W07, ...)
 * são os IDs de campo do Anexo I do MOC, para auditoria direta.
 *
 * Os grupos IBS/CBS da Reforma Tributária seguem a NT 2024.002 v1.10
 * (`det/imposto/IBSCBSSel` e `total/IBSCBSSelTot`). Nota: o pacote PL 010b
 * (NT 2025.002 v1.30) renomeou esses grupos para `IBSCBS`/`IBSCBSTot` com
 * pequenas evoluções de campos; este modelo segue a NT 2024.002 conforme a
 * SPEC do projeto (vide `schemas/README.md`).
 */
import type {
  CRT,
  Endereco,
  FinNFe,
  IdDest,
  IndFinal,
  IndIEDest,
  IndPag,
  IndPres,
  ModBC,
  ModBCST,
  ModFrete,
  MotDesIcms,
  Origem,
  ProcEmi,
  TpAmb,
  TpEmis,
  TpImp,
  TpIntegra,
  TpNF,
  TPag,
} from './comum';

// ---------------------------------------------------------------------------
// A — identificação da NF-e (grupo B do MOC)
// ---------------------------------------------------------------------------

/** B02-B34 — grupo `ide`. */
export interface Ide {
  /** B02 — código da UF do emitente (IBGE). */
  cUF: number;
  /** B03 — código numérico que compõe a chave de acesso (8 dígitos). */
  cNF: string;
  /** B04a? — não existe em 4.00; natOp é B04. */
  natOp: string;
  /** B06 — 55 (NF-e) ou 65 (NFC-e). */
  mod: 55 | 65;
  /** B07 — série (0-899 normal; 890-899 avulsa; 900-979 SCAN; 990-999 contingência). */
  serie: number;
  /** B08 — número da NF-e (1-999999999). */
  nNF: number;
  /** B09 — data e hora de emissão (ISO-8601 com fuso). */
  dhEmi: string;
  /** B10 — data e hora de saída/entrada (opcional). */
  dhSaiEnt?: string;
  /** B11 — 0 = entrada, 1 = saída. */
  tpNF: TpNF;
  /** B19 — identificador de local de destino. */
  idDest: IdDest;
  /** B11a — código do município de ocorrência do fato gerador (IBGE). */
  cMunFG: number;
  /** B20 — formato de impressão do DANFE. */
  tpImp: TpImp;
  /** B22 — forma de emissão (compõe a chave de acesso). */
  tpEmis: TpEmis;
  /** B23 — dígito verificador da chave de acesso (módulo 11). */
  cDV: number;
  /** B24a — 1 = produção, 2 = homologação. */
  tpAmb: TpAmb;
  /** B25 — finalidade de emissão. */
  finNFe: FinNFe;
  /** B25a — consumidor final. */
  indFinal: IndFinal;
  /** B25b — presença do comprador. */
  indPres: IndPres;
  /** B25c — indicador de intermediário (NT 2020.006). */
  indIntermed?: 0 | 1;
  /** B26 — processo de emissão. */
  procEmi: ProcEmi;
  /** B27 — versão do aplicativo emissor. */
  verProc: string;
  /** B28a — data/hora de entrada em contingência. */
  dhCont?: string;
  /** B29 — justificativa da contingência. */
  xJust?: string;
  /** BA01 — documentos fiscais referenciados. */
  nfRef: NfRef[];
}

/** BA02 — tipos de referência do grupo `NFref`. */
export type NfRef =
  | { refNFe: string }
  | {
      refNF: {
        cUF: number;
        aamm: string;
        cnpj: string;
        mod: string;
        serie: number;
        nNF: number;
      };
    }
  | { refCTe: string }
  | {
      refNFP: {
        cUF: number;
        cnpj?: string;
        cpf?: string;
        ie?: string;
        mod: string;
        serie: number;
        nNF: number;
        refNFP?: number;
      };
    }
  | { refECF: { mod: string; nECF: string; nCOO: string } };

// ---------------------------------------------------------------------------
// C — emitente / E — destinatário
// ---------------------------------------------------------------------------

/** C01-C10 — grupo `emit`. */
export interface Emit {
  /** C02 — CNPJ do emitente (14 posições; a partir de 07/2026 pode ser alfanumérico — NT 2025.001). */
  cnpj?: string;
  /** C02a — CPF do emitente (emitente pessoa física, NT 2018.001). */
  cpf?: string;
  /** C03 — razão social. */
  xNome: string;
  /** C04 — nome fantasia. */
  xFant?: string;
  /** C05 — endereço. */
  enderEmit: Endereco;
  /** C17 — inscrição estadual. */
  ie: string;
  /** C18 — inscrição estadual do substituto tributário. */
  iest?: string;
  /** C19 — inscrição municipal. */
  im?: string;
  /** C20 — CNAE. */
  cnae?: string;
  /** C21 — código do regime tributário. */
  crt: CRT;
}

/** E01-E18 — grupo `dest`. */
export interface Dest {
  /** E02 — CNPJ do destinatário. */
  cnpj?: string;
  /** E03 — CPF do destinatário. */
  cpf?: string;
  /** E03a — identificador de estrangeiro. */
  idEstrangeiro?: string;
  /** E04 — razão social / nome. */
  xNome?: string;
  /** E05 — endereço. */
  enderDest?: Endereco;
  /** E16a — indicador da IE do destinatário. */
  indIEDest: IndIEDest;
  /** E17 — inscrição estadual. */
  ie?: string;
  /** E18 — inscrição SUFRAMA. */
  isuf?: string;
  /** E19 — inscrição municipal. */
  im?: string;
  /** E20 — e-mail do destinatário. */
  email?: string;
}

// ---------------------------------------------------------------------------
// I — detalhamento de produtos e serviços
// ---------------------------------------------------------------------------

/** I01-I18 — grupo `prod` (I02 cEAN: “SEM GTIN” quando não houver código). */
export interface Prod {
  cProd: string;
  cEAN: string;
  /** I02a — código de barras próprio (NT 2023.004). */
  cBarra?: string;
  xProd: string;
  ncm: string;
  /** I05c — nomenclatura de valor aduaneiro e estatístico. */
  nve?: string[];
  /** I05c — código especificador da substituição tributária. */
  cest?: string;
  /** I05d — indicador de produção em escala relevante. */
  indEscala?: 0 | 1;
  /** I05e — CNPJ do fabricante da mercadoria. */
  cnpjFab?: string;
  /** I05g — código de benefício fiscal na UF. */
  cBenef?: string;
  /** I05h — crédito presumido aplicado ao item (gCred). */
  gCred?: GCred[];
  /** I06i — código EX_TIPI. */
  extIpi?: string;
  cfop: string;
  uCom: string;
  qCom: number;
  vUnCom: number;
  vProd: number;
  cEANTrib: string;
  /** I12b — código de barras próprio da unidade tributável (NT 2023.004). */
  cBarraTrib?: string;
  uTrib: string;
  qTrib: number;
  vUnTrib: number;
  vFrete?: number;
  vSeg?: number;
  vDesc?: number;
  vOutro?: number;
  /** I17b — compõe o total da NF-e. */
  indTot: 0 | 1;
  xPed?: string;
  nItemPed?: number;
}

/** I05h — grupo `gCred` (crédito presumido na UF aplicado ao item). */
export interface GCred {
  cCredPresumido: string;
  pCredPresumido: number;
  vCredPresumido: number;
}

// ---------------------------------------------------------------------------
// N/O/P/Q/R/U — impostos do item
// ---------------------------------------------------------------------------

/** ICMS normal — CST 00 (ICMS00). */
export interface Icms00 {
  grupo: 'ICMS00';
  orig: Origem;
  cst: '00';
  modBC: ModBC;
  vBC: number;
  pICMS: number;
  vICMS: number;
  pFCP?: number;
  vFCP?: number;
}

/** ICMS monofásico — CST 02 (ICMS02, NT 2023.001). */
export interface Icms02 {
  grupo: 'ICMS02';
  orig: Origem;
  cst: '02';
  qBCMono?: number;
  adRemICMS: number;
  vICMSMono: number;
}

/** ICMS normal — CST 10 (ICMS10). */
export interface Icms10 {
  grupo: 'ICMS10';
  orig: Origem;
  cst: '10';
  modBC: ModBC;
  vBC: number;
  pICMS: number;
  vICMS: number;
  vBCFCP?: number;
  pFCP?: number;
  vFCP?: number;
  modBCST: ModBCST;
  pMVAST?: number;
  pRedBCST?: number;
  vBCST: number;
  pICMSST: number;
  vICMSST: number;
  vBCFCPST?: number;
  pFCPST?: number;
  vFCPST?: number;
}

/** ICMS monofásico com retenção — CST 15 (ICMS15, NT 2023.001). */
export interface Icms15 {
  grupo: 'ICMS15';
  orig: Origem;
  cst: '15';
  qBCMono?: number;
  adRemICMS: number;
  vICMSMono: number;
  qBCMonoReten?: number;
  adRemICMSReten: number;
  vICMSMonoReten: number;
}

/** ICMS com redução de BC — CST 20 (ICMS20). */
export interface Icms20 {
  grupo: 'ICMS20';
  orig: Origem;
  cst: '20';
  modBC: ModBC;
  pRedBC: number;
  vBC: number;
  pICMS: number;
  vICMS: number;
  vBCFCP?: number;
  pFCP?: number;
  vFCP?: number;
}

/** ICMS isento/não tributado/suspenso — CST 40, 41, 50 (ICMS40). */
export interface Icms40 {
  grupo: 'ICMS40';
  orig: Origem;
  cst: '40' | '41' | '50';
  vICMSDeson?: number;
  motDesICMS?: MotDesIcms;
}

/** ICMS com cobrança por ST — CST 30 (ICMS30). */
export interface Icms30 {
  grupo: 'ICMS30';
  orig: Origem;
  cst: '30';
  modBCST: ModBCST;
  pMVAST?: number;
  pRedBCST?: number;
  vBCST: number;
  pICMSST: number;
  vICMSST: number;
  vICMSDeson?: number;
  motDesICMS?: MotDesIcms;
}

/** ICMS diferido — CST 51 (ICMS51). */
export interface Icms51 {
  grupo: 'ICMS51';
  orig: Origem;
  cst: '51';
  modBC?: ModBC;
  pRedBC?: number;
  cBenefRBC?: string;
  vBC?: number;
  pICMS?: number;
  vICMSOp?: number;
  pDif?: number;
  vICMSDif?: number;
  vICMS?: number;
}

/** ICMS monofásico com diferimento — CST 53 (ICMS53, NT 2023.001). */
export interface Icms53 {
  grupo: 'ICMS53';
  orig: Origem;
  cst: '53';
  qBCMono?: number;
  adRemICMS?: number;
  vICMSMonoOp?: number;
  pDif?: number;
  vICMSMonoDif?: number;
  vICMSMono?: number;
  qBCMonoDif?: number;
  adRemICMSDif?: number;
}

/** ICMS cobrado anteriormente por ST — CST 60 (ICMS60). */
export interface Icms60 {
  grupo: 'ICMS60';
  orig: Origem;
  cst: '60';
  vBCSTRet?: number;
  pST?: number;
  vICMSSubstituto?: number;
  vICMSSTRet?: number;
  vBCFCPSTRet?: number;
  pFCPSTRet?: number;
  vFCPSTRet?: number;
}

/** ICMS monofásico retido anteriormente — CST 61 (ICMS61, NT 2023.001). */
export interface Icms61 {
  grupo: 'ICMS61';
  orig: Origem;
  cst: '61';
  qBCMonoRet?: number;
  adRemICMSRet: number;
  vICMSMonoRet: number;
}

/** ICMS com redução de BC e ST — CST 70 (ICMS70). */
export interface Icms70 {
  grupo: 'ICMS70';
  orig: Origem;
  cst: '70';
  modBC: ModBC;
  pRedBC: number;
  vBC: number;
  pICMS: number;
  vICMS: number;
  modBCST: ModBCST;
  pMVAST?: number;
  pRedBCST?: number;
  vBCST: number;
  pICMSST: number;
  vICMSST: number;
  vBCFCPST?: number;
  pFCPST?: number;
  vFCPST?: number;
}

/** ICMS outras — CST 90 (ICMS90). */
export interface Icms90 {
  grupo: 'ICMS90';
  orig: Origem;
  cst: '90';
  modBC?: ModBC;
  vBC?: number;
  pRedBC?: number;
  pICMS?: number;
  vICMS?: number;
  vBCFCP?: number;
  pFCP?: number;
  vFCP?: number;
  modBCST?: ModBCST;
  pMVAST?: number;
  pRedBCST?: number;
  vBCST?: number;
  pICMSST?: number;
  vICMSST?: number;
  vBCFCPST?: number;
  pFCPST?: number;
  vFCPST?: number;
}

/** ICMS partilhado entre UF de origem e destino (ICMSPart — CST 10/90). */
export interface IcmsPart {
  grupo: 'ICMSPart';
  orig: Origem;
  cst: '10' | '90';
  modBC: ModBC;
  vBC: number;
  pRedBC?: number;
  pICMS: number;
  vICMS: number;
  modBCST: ModBCST;
  pMVAST?: number;
  pRedBCST?: number;
  vBCST: number;
  pICMSST: number;
  vICMSST: number;
  pBCOp: number;
  ufST: string;
}

/** ICMS ST retido anteriormente (ICMSST — CST 41/60). */
export interface IcmsSt {
  grupo: 'ICMSST';
  orig: Origem;
  cst: '41' | '60';
  vBCSTRet: number;
  pST?: number;
  vICMSSubstituto?: number;
  vICMSSTRet: number;
  vBCSTDest: number;
  vICMSSTDest: number;
}

/** ICMSSN — CSOSN 101 (ICMSSN101). */
export interface Icmssn101 {
  grupo: 'ICMSSN101';
  orig: Origem;
  csosn: '101';
  pCredSN: number;
  vCredICMSSN: number;
}

/** ICMSSN — CSOSN 102, 103, 300, 400 (ICMSSN102). */
export interface Icmssn102 {
  grupo: 'ICMSSN102';
  orig?: Origem;
  csosn: '102' | '103' | '300' | '400';
}

/** ICMSSN — CSOSN 201 (ICMSSN201). */
export interface Icmssn201 {
  grupo: 'ICMSSN201';
  orig: Origem;
  csosn: '201';
  modBCST: ModBCST;
  pMVAST?: number;
  pRedBCST?: number;
  vBCST: number;
  pICMSST: number;
  vICMSST: number;
  pCredSN: number;
  vCredICMSSN: number;
}

/** ICMSSN — CSOSN 202, 203 (ICMSSN202). */
export interface Icmssn202 {
  grupo: 'ICMSSN202';
  orig: Origem;
  csosn: '202' | '203';
  modBCST: ModBCST;
  pMVAST?: number;
  pRedBCST?: number;
  vBCST: number;
  pICMSST: number;
  vICMSST: number;
}

/** ICMSSN — CSOSN 500 (ICMSSN500). */
export interface Icmssn500 {
  grupo: 'ICMSSN500';
  orig: Origem;
  csosn: '500';
  vBCSTRet?: number;
  pST?: number;
  vICMSSubstituto?: number;
  vICMSSTRet?: number;
  vBCFCPSTRet?: number;
  pFCPSTRet?: number;
  vFCPSTRet?: number;
}

/** ICMSSN — CSOSN 900 (ICMSSN900). */
export interface Icmssn900 {
  grupo: 'ICMSSN900';
  orig?: Origem;
  csosn: '900';
  modBC?: ModBC;
  vBC?: number;
  pRedBC?: number;
  pICMS?: number;
  vICMS?: number;
  modBCST?: ModBCST;
  pMVAST?: number;
  pRedBCST?: number;
  vBCST?: number;
  pICMSST?: number;
  vICMSST?: number;
  pCredSN?: number;
  vCredICMSSN?: number;
}

/**
 * União discriminada de todos os grupos de ICMS (escolha `ICMS` do XSD):
 * normal (CST 00-90), monofásico (02/15/53/61), partilha (ICMSPart),
 * repasse ST (ICMSST) e Simples Nacional (CSOSN).
 */
export type Icms =
  | Icms00
  | Icms02
  | Icms10
  | Icms15
  | Icms20
  | Icms30
  | Icms40
  | Icms51
  | Icms53
  | Icms60
  | Icms61
  | Icms70
  | Icms90
  | IcmsPart
  | IcmsSt
  | Icmssn101
  | Icmssn102
  | Icmssn201
  | Icmssn202
  | Icmssn500
  | Icmssn900;

/** O01-O15 — grupo `IPI` (TIpi). */
export type Ipi =
  | {
      grupo: 'IPITrib';
      cnpjProd?: string;
      cSelo?: string;
      qSelo?: number;
      cEnq: string;
      cst: '00' | '49' | '50' | '99';
      vBC?: number;
      pIPI?: number;
      qUnid?: number;
      vUnid?: number;
      vIPI: number;
    }
  | {
      grupo: 'IPINT';
      cnpjProd?: string;
      cSelo?: string;
      qSelo?: number;
      cEnq: string;
      cst: '01' | '02' | '03' | '04' | '05' | '51' | '52' | '53' | '54' | '55';
    };

/** M02 — grupo `II` (imposto de importação). */
export interface Ii {
  vBC: number;
  vDespAdu: number;
  vII: number;
  vIOF: number;
}

/** U01-U13 — grupo `ISSQN` por item (serviços sujeitos ao ISS). */
export interface Issqn {
  vBC: number;
  vAliq: number;
  vISSQN: number;
  /** U06 — município do fato gerador do ISS. */
  cMunFG: number;
  /** U06a — item da lista de serviços (LC 116/2003). */
  cListServ: string;
  vDeducao?: number;
  vOutro?: number;
  vDescIncond?: number;
  vDescCond?: number;
  vISSRet?: number;
  /** U10 — indicador de exigibilidade do ISS (1-7). */
  indISS: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  cServico?: string;
  cMun?: number;
  cPais?: string;
  nProcesso?: string;
  /** U13 — indicador de incentivo fiscal: 1 = Sim, 2 = Não. */
  indIncentivo: 1 | 2;
}

/** Q06-Q09 — PIS não cumulativo (união das escolhas PISAliq/PISQtde/PISNT/PISOutr). */
export type Pis =
  | { grupo: 'PISAliq'; cst: '01' | '02'; vBC: number; pPIS: number; vPIS: number }
  | {
      grupo: 'PISQtde';
      cst: '03';
      qBCProd: number;
      vAliqProd: number;
      vPIS: number;
    }
  | { grupo: 'PISNT'; cst: '04' | '06' | '07' | '08' | '09' | '49' | '99' }
  | {
      grupo: 'PISOutr';
      cst:
        | '49'
        | '50'
        | '51'
        | '52'
        | '53'
        | '54'
        | '55'
        | '56'
        | '60'
        | '61'
        | '62'
        | '63'
        | '64'
        | '67'
        | '70'
        | '71'
        | '72'
        | '73'
        | '74'
        | '75'
        | '98'
        | '99';
      vBC?: number;
      pPIS?: number;
      qBCProd?: number;
      vAliqProd?: number;
      vPIS: number;
    };

/** R06-R09 — COFINS não cumulativo (COFINSAliq/COFINSQtde/COFINSNT/COFINSOutr). */
export type Cofins =
  | { grupo: 'COFINSAliq'; cst: '01' | '02'; vBC: number; pCOFINS: number; vCOFINS: number }
  | {
      grupo: 'COFINSQtde';
      cst: '03';
      qBCProd: number;
      vAliqProd: number;
      vCOFINS: number;
    }
  | { grupo: 'COFINSNT'; cst: '04' | '05' | '06' | '07' | '08' | '09' | '49' | '99' }
  | {
      grupo: 'COFINSOutr';
      cst:
        | '49'
        | '50'
        | '51'
        | '52'
        | '53'
        | '54'
        | '55'
        | '56'
        | '60'
        | '61'
        | '62'
        | '63'
        | '64'
        | '67'
        | '70'
        | '71'
        | '72'
        | '73'
        | '74'
        | '75'
        | '98'
        | '99';
      vBC?: number;
      pCOFINS?: number;
      qBCProd?: number;
      vAliqProd?: number;
      vCOFINS: number;
    };

/** Q10-Q14 — PIS-ST. */
export interface PisSt {
  vPIS: number;
}

/** R10-R14 — COFINS-ST. */
export interface CofinsSt {
  vCOFINS: number;
}

/** NA01-NA13 — ICMS interestadual para consumidor final (ICMSUFDest, NT 2015.003/2022.005). */
export interface IcmsUfDest {
  vBCUFDest: number;
  vBCFCPUFDest?: number;
  pFCPUFDest?: number;
  pICMSUFDest: number;
  /** 4 ou 7 (alíquota interestadual, LC 123/2007). */
  pICMSInter: 4 | 7;
  pICMSInterPart: number;
  vFCPUFDest?: number;
  vICMSUFDest: number;
  vICMSUFRemet: number;
}

// ---------------------------------------------------------------------------
// UB — IBS/CBS/IS da Reforma Tributária (NT 2024.002 v1.10)
// ---------------------------------------------------------------------------

/** UB02-UB11 — grupo `seletivo` (Imposto Seletivo). */
export interface Seletivo {
  cst: string;
  cClassTrib: string;
  gImpSel?: {
    vBCImpSel: number;
    pImpSel: number;
    pImpSelEspec?: number;
    uTrib?: string;
    qTrib?: number;
    vImpSel: number;
  };
}

/** Diferimento aplicado ao tributo (gDif — NT 2024.002 UB21/UB40). */
export interface GigaDif {
  pDif: number;
  vDif: number;
}

/** Devolução de tributos (gDevTrib — UB24/UB43). */
export interface GDevTrib {
  vDevTrib: number;
}

/** Redução de alíquota (gRed — UB26/UB45). */
export interface GRed {
  pRedAliq: number;
  pAliqEfet: number;
}

/** Desoneração (gDeson — UB29/UB48). */
export interface GDeson {
  cst?: string;
  cClassTrib?: string;
  vBC?: number;
  pAliq: number;
  vDeson: number;
}

/** Crédito presumido (gIBSCredPres/gCBSCredPres — UB55/UB64). */
export interface GCredPres {
  cCredPres: string;
  pCredPres: number;
  vCredPres: number;
  vCredPresCondSus: number;
}

/** gIBSUF — IBS de competência da UF (UB17-UB35). */
export interface GIbsUf {
  pIBSUF: number;
  vTribOP?: number;
  gDif?: GigaDif;
  gDevTrib?: GDevTrib;
  gRed?: GRed;
  gDeson?: GDeson;
  vIBSUF: number;
}

/** gIBSMun — IBS de competência municipal (UB36-UB54). */
export interface GIbsMun {
  pIBSMun: number;
  vTribOP?: number;
  gDif?: GigaDif;
  gDevTrib?: GDevTrib;
  gRed?: GRed;
  gDeson?: GDeson;
  vIBSMun: number;
}

/** gCBS — CBS de competência da União (UB60-UB83). */
export interface GCbs {
  pCBS: number;
  vTribOp?: number;
  gCBSCredPres?: GCredPres;
  gDif?: GigaDif;
  gDevTrib?: GDevTrib;
  gRed?: GRed;
  gDeson?: GDeson;
  vCBS: number;
}

/**
 * UB01 — grupo `IBSCBSSel`: informações do IBS, da CBS e do Imposto Seletivo
 * por item (NT 2024.002 v1.10, grupo UB). Opcional — presente apenas em
 * documentos emitidos na vigência da Reforma Tributária.
 */
export interface IbsCbsSel {
  seletivo?: Seletivo;
  /** UB12 — CST do IBS e CBS. */
  cst?: string;
  /** UB13 — código de classificação tributária do IBS e CBS. */
  cClassTrib?: string;
  /** UB14 — indicador de perecimento/furto/roubo/extravio. */
  indPerecimento?: '1';
  gIBSCBS: {
    vBC: number;
    gIBSUF: GIbsUf;
    gIBSMun: GIbsMun;
    gIBSCredPres?: GCredPres;
    gCBS: GCbs;
  };
}

/** H01 — grupo `imposto` do item. */
export interface Imposto {
  vTotTrib?: number;
  icms?: Icms;
  ipi?: Ipi;
  ii?: Ii;
  issqn?: Issqn;
  pis?: Pis;
  pisst?: PisSt;
  cofins?: Cofins;
  cofinsst?: CofinsSt;
  icmsUfDest?: IcmsUfDest;
  /** NT 2024.002 v1.10 — grupo UB (`IBSCBSSel`). */
  ibscbsSel?: IbsCbsSel;
}

/** U50-U53 — grupo `impostoDevol` (NT 2013.005 — devolução de IPI). */
export interface ImpostoDevol {
  pDevol: number;
  ipiDevol: { vIPIDevol: number };
}

/** V01-V04 — observações do item (`obsItem`). */
export interface ObsItem {
  obsCont?: { xCampo: string; xTexto: string }[];
  obsFisco?: { xCampo: string; xTexto: string }[];
}

/** H01 (wrapper) — um item da NF-e (`det`, atributo nItem). */
export interface Det {
  nItem: number;
  prod: Prod;
  imposto: Imposto;
  impostoDevol?: ImpostoDevol;
  infAdProd?: string;
  obsItem?: ObsItem;
}

// ---------------------------------------------------------------------------
// W — totais
// ---------------------------------------------------------------------------

/** W02-W23 — grupo `ICMSTot`. */
export interface IcmsTot {
  vBC: number;
  vICMS: number;
  vICMSDeson: number;
  vFCPUFDest?: number;
  vICMSUFDest?: number;
  vICMSUFRemet?: number;
  vFCP: number;
  vBCST: number;
  vST: number;
  vFCPST: number;
  vFCPSTRet: number;
  qBCMono?: number;
  vICMSMono?: number;
  qBCMonoReten?: number;
  vICMSMonoReten?: number;
  qBCMonoRet?: number;
  vICMSMonoRet?: number;
  vProd: number;
  vFrete: number;
  vSeg: number;
  vDesc: number;
  vII: number;
  vIPI: number;
  vIPIDevol: number;
  vPIS: number;
  vCOFINS: number;
  vOutro: number;
  vNF: number;
  vTotTrib?: number;
}

/** U01-U13 — grupo `ISSQNtot`. */
export interface IssqnTot {
  vServ?: number;
  vBC?: number;
  vISS?: number;
  vPIS?: number;
  vCOFINS?: number;
  dCompet: string;
  vDeducao?: number;
  vOutro?: number;
  vDescIncond?: number;
  vDescCond?: number;
  vISSRet?: number;
  cRegTrib?: 1 | 2 | 3 | 4 | 5 | 6;
}

/** W23.1-W23.7 — grupo `retTrib`. */
export interface RetTrib {
  vRetPIS?: number;
  vRetCOFINS?: number;
  vRetCSLL?: number;
  vBCIRRF?: number;
  vIRRF?: number;
  vBCRetPrev?: number;
  vRetPrev?: number;
}

/**
 * W31 — grupo `IBSCBSSelTot`: totais da NF-e com IBS, CBS e IS
 * (NT 2024.002 v1.10, seção 8.5). O IBS, a CBS e o IS são por fora e seus
 * valores devem ser adicionados ao valor total da NF-e.
 */
export interface IbsCbsSelTot {
  gSel?: { vBCSel: number; vImpSel: number };
  vBCIBSCBS: number;
  gIBS: {
    gIBSUFTot: { vDif: number; vDevTrib: number; vDeson: number; vIBSUF: number };
    gIBSMunTot: {
      vDif: number;
      vDevTrib: number;
      vDeson: number;
      vIBSMun: number;
      vIBSTot: number;
    };
    vCresPres: number;
    vCredPresCondSus: number;
  };
  gCBS: {
    vDif: number;
    vDevTrib: number;
    vDeson: number;
    vCBS: number;
    vCresPres: number;
    vCredPresCondSus: number;
  };
}

/** W01 — grupo `total`. */
export interface Total {
  icmsTot: IcmsTot;
  issqnTot?: IssqnTot;
  retTrib?: RetTrib;
  ibscbsSelTot?: IbsCbsSelTot;
}

// ---------------------------------------------------------------------------
// X — transporte
// ---------------------------------------------------------------------------

/** X04-X10 — grupo `transporta`. */
export interface Transporta {
  cnpj?: string;
  cpf?: string;
  xNome?: string;
  ie?: string;
  xEnder?: string;
  xMun?: string;
  uf?: string;
}

/** X11.1-X11.7 — grupo `retTransp` (ICMS retido do transporte). */
export interface RetTransp {
  vServ: number;
  vBCRet: number;
  pICMSRet: number;
  vICMSRet: number;
  cfop: string;
  cMunFG: number;
}

/** TVeiculo — `veicTransp` ou `reboque` (placa Mercosul, NT 2013/003). */
export interface Veiculo {
  placa: string;
  uf?: string;
  rntc?: string;
}

/** X26-X32 — grupo `vol`. */
export interface Vol {
  qVol?: number;
  esp?: string;
  marca?: string;
  nVol?: string;
  pesoL?: number;
  pesoB?: number;
  lacres: { nLacre: string }[];
}

/** X01-X25 — grupo `transp`. */
export interface Transp {
  modFrete: ModFrete;
  transporta?: Transporta;
  /** X11 — ICMS retido do serviço de transporte. */
  retTransp?: RetTransp;
  veicTransp?: Veiculo;
  reboque: Veiculo[];
  vagao?: string;
  balsa?: string;
  vol: Vol[];
}

// ---------------------------------------------------------------------------
// Y — cobrança / pagamento
// ---------------------------------------------------------------------------

/** Y02-Y05 — grupo `fat`. */
export interface Fat {
  nFat?: string;
  vOrig?: number;
  vDesc?: number;
  vLiq?: number;
}

/** Y07-Y09 — uma duplicata (`dup`). */
export interface Dup {
  nDup?: string;
  dVenc?: string;
  vDup: number;
}

/** Y01 — grupo `cobr`. */
export interface Cobr {
  fat?: Fat;
  dup: Dup[];
}

/** YA04-YA12 — grupo `card` (cartões de pagamento). */
export interface Card {
  tpIntegra: TpIntegra;
  cnpj?: string;
  tBand?: '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '99';
  cAut?: string;
}

/** YA02 — uma forma de pagamento (`detPag`). */
export interface DetPag {
  indPag?: IndPag;
  tPag: TPag;
  /** Descrição do meio de pagamento (IT 2024.002 — códigos 16-20 e outros). */
  xPag?: string;
  vPag: number;
  card?: Card;
}

/** Y01 — grupo `pag` (vTroco informado quando há troco em pagamento em dinheiro). */
export interface Pag {
  detPag: DetPag[];
  vTroco?: number;
}

// ---------------------------------------------------------------------------
// Z / ZA-10 — informações adicionais / responsável técnico / autorizados
// ---------------------------------------------------------------------------

/** Z01-Z08 — grupo `infAdic`. */
export interface InfAdic {
  infAdFisco?: string;
  infCpl?: string;
  obsCont?: { xCampo: string; xTexto: string }[];
  obsFisco?: { xCampo: string; xTexto: string }[];
}

/** ZD01-ZD10 — grupo `infRespTec` (NT 2018.005). */
export interface InfRespTec {
  cnpj: string;
  xContato: string;
  email: string;
  fone: string;
  /** idCSRT + hashCSRT (CSRT obtido com a SEFAZ; hash = SHA-1 base64 do CSRT + chave de acesso). */
  idCSRT?: string;
  hashCSRT?: string;
}

/** ZX02/ZX03 — `autXML`: CNPJ ou CPF autorizado a acessar o XML. */
export interface AutXml {
  cnpj?: string;
  cpf?: string;
}

/** ZX01 — grupo `infNFeSupl` (NFC-e): conteúdo do QR Code e URL de consulta. */
export interface InfNFeSupl {
  qrCode: string;
  urlChave: string;
}

// ---------------------------------------------------------------------------
// A — documento completo
// ---------------------------------------------------------------------------

/** A01 — `infNFe` completo (modelo tipado da nota). */
export interface NFe {
  /** Atributo `versao` do `infNFe` (ex.: `4.00`). */
  versao: string;
  /**
   * Chave de acesso (44 dígitos) extraída do atributo `Id` de `infNFe`
   * (literal `NFe` removido). É o identificador único do documento.
   */
  chave: string;
  ide: Ide;
  emit: Emit;
  dest?: Dest;
  det: Det[];
  total: Total;
  transp: Transp;
  cobr?: Cobr;
  pag: Pag;
  infAdic?: InfAdic;
  infRespTec?: InfRespTec;
  autXml: AutXml[];
}

/**
 * Tipo de protocolo registrado na SEFAZ — `protNFe/infProt` (grupo de 1.99 do
 * leiaute, `TProtNFe` em `procNFe_v4.00.xsd`).
 */
export interface ProtNFe {
  tpAmb: TpAmb;
  verAplic: string;
  chNFe: string;
  dhRecbto: string;
  nProt?: string;
  cStat: number;
  xMotivo: string;
}

/**
 * `nfeProc` — NF-e + protocolo de autorização (arquivo de distribuição da
 * SEFAZ). `protNFe` ausente quando o XML de origem é uma `NFe` "bare"
 * (não autorizada).
 */
export interface NFeProc {
  /** Atributo `versao` do `nfeProc`. */
  versao: string;
  nfe: NFe;
  /**
   * ZX01 — grupo `infNFeSupl` (NFC-e), irmão do `infNFe` dentro de `NFe`
   * (leiaute 4.00, `leiauteNFe_v4.00.xsd`: `TNFe` = `infNFe` +
   * `infNFeSupl?` + `Signature?`). Fora do `infNFe`, portanto **não** é
   * coberto pelo digest da assinatura — emissores reais o incluem após
   * assinar o `infNFe`, com o `digVal` embutido no QR.
   */
  infNFeSupl?: InfNFeSupl;
  protNFe?: ProtNFe;
}
