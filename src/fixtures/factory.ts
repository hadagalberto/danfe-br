/**
 * Fábrica de fixtures: gera NF-e/NFC-e sintéticas REALISTAS (empresas
 * fictícias, chaves com DV válidos, totais recomputados que passam na
 * validação) e serializa para XML na ordem exata do XSD oficial
 * (`schemas/PL_009q_NT2025_001_v1.00/leiauteNFe_v4.00.xsd`).
 *
 * Determinismo: todas as derivações partem de uma `seed` textual (hash
 * FNV-1a), então regenerar o corpus produz bytes idênticos — o corpus
 * versionado em `tests/fixtures/` é auditável contra `npm run fixtures`.
 *
 * Valores tributários são calculados com as fórmulas oficiais:
 * - vProd do item = round(qCom × vUnCom, 2) (MOC cStat 629, tolerância 0,01);
 * - vICMS = round(vBC × pICMS / 100, 2) (cStat 528);
 * - vNF pela fórmula W16-10 (cStat 610) — com os tributos por fora da
 *   NT 2024.002 quando o grupo IBSCBSSelTot existe.
 * - chaves de acesso com DV módulo 11 (MOC 7.0 — Visão Geral, 2.2.6.2).
 */
import type {
  AutXml,
  Card,
  Cofins,
  Cobr,
  Det,
  Dest,
  DetPag,
  Emit,
  Fat,
  GDeson,
  IbsCbsSel,
  IbsCbsSelTot,
  Icms,
  IcmsTot,
  IcmsUfDest,
  Ide,
  Ii,
  Ipi,
  Imposto,
  ImpostoDevol,
  InfAdic,
  InfNFeSupl,
  InfRespTec,
  Issqn,
  NFe,
  NFeProc,
  Pag,
  Pis,
  Prod,
  ProtNFe,
  RetTransp,
  Seletivo,
  Total,
  Transp,
  Veiculo,
} from '../model/nfe';
import type { ProcEventoNFe } from '../model/evento';
import { CODIGOS_UF } from '../model/comum';
import type { FinNFe, IndPres } from '../model/comum';
import { TP_EVENTO_CANCELAMENTO, TP_EVENTO_CCE } from '../model/evento';
import { calculaDvCnpj, calculaDvCpf } from '../validate/documentos';
import { aammDeDhEmi, montaChaveDeAcesso } from '../validate/chave';
import { escapaXml, EscritorXml, fmt } from './xml-writer';

// ---------------------------------------------------------------------------
// Derivação determinística (FNV-1a 32 bits)
// ---------------------------------------------------------------------------

/** Hash FNV-1a 32 bits — base da derivação determinística de seeds. */
export function fnv1a(texto: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Deriva um inteiro estável no intervalo [min, max] (fechado). */
export function deriva(seed: string, min: number, max: number): number {
  return min + (fnv1a(seed) % (max - min + 1));
}

/** Deriva uma string numérica com `digitos` caracteres (sem perda de zeros à esquerda via pad). */
export function derivaDigitos(seed: string, digitos: number): string {
  let valor = fnv1a(seed);
  let saida = '';
  for (let i = 0; i < digitos; i++) {
    saida = (valor % 10) + saida;
    valor = Math.floor(valor / 10);
    if (valor === 0) valor = fnv1a(`${seed}#${i}`);
  }
  return saida;
}

const cent = (v: number): number => Math.round(v * 100);
const round2 = (v: number): number => Math.round(v * 100) / 100;

/** Gera um CNPJ numérico válido a partir de uma seed. */
export function cnpjSintetico(seed: string): string {
  const base = `1${derivaDigitos(`${seed}:raiz`, 7)}${derivaDigitos(`${seed}:filial`, 4).padStart(4, '0')}`;
  return base + calculaDvCnpj(base);
}

/** Gera um CPF válido a partir de uma seed (sem dígitos repetidos). */
export function cpfSintetico(seed: string): string {
  let base = '';
  while (base.length < 9) {
    const bloco = derivaDigitos(`${seed}:cpf#${base.length}`, 9);
    // evita sequências de dígitos iguais, reprovadas pelas regras 401/237
    if (!/^(\d)\1+$/.test(bloco.padStart(9, '0'))) base += bloco;
    if (base.length > 9) base = base.slice(0, 9);
  }
  if (/^(\d)\1+$/.test(base)) base = `123${derivaDigitos(`${seed}:mix`, 6)}`;
  return base + calculaDvCpf(base);
}

/** Data/hora de emissão derivada da seed, no formato TDateTimeUTC do layout. */
export function dhEmiSintetico(seed: string): string {
  const dias = deriva(`${seed}:dia`, 1, 28);
  const mes = deriva(`${seed}:mes`, 1, 12);
  const hora = deriva(`${seed}:hora`, 8, 18).toString().padStart(2, '0');
  const minuto = deriva(`${seed}:min`, 0, 59).toString().padStart(2, '0');
  return `2026-${String(mes).padStart(2, '0')}-${String(dias).padStart(2, '0')}T${hora}:${minuto}:00-03:00`;
}

// ---------------------------------------------------------------------------
// Emitente / destinatário sintéticos
// ---------------------------------------------------------------------------

const NOMES_EMPRESA = [
  'Distribuidora Aurora Ltda',
  'Comercial Horizonte S.A.',
  'Indústria Vale Verde Ltda',
  'Atacadão Serra Azul ME',
  'Metalúrgica Ponte Nova Ltda',
  'Tech Ferramentas Delta S.A.',
];
const NOMES_PESSOA = [
  'Maria Aparecida Souza',
  'João Bosco Ferreira',
  'Ana Beatriz Nogueira',
  'Carlos Eduardo Lima',
];

export function emitenteSintetico(seed: string, sobre?: Partial<Emit>): Emit {
  const cnpj = cnpjSintetico(seed);
  const nome = NOMES_EMPRESA[deriva(`${seed}:nome`, 0, NOMES_EMPRESA.length - 1)]!;
  return {
    cnpj,
    xNome: nome,
    xFant: nome.split(' ')[0],
    enderEmit: {
      xLgr: 'Avenida das Indústrias',
      nro: String(deriva(`${seed}:nro`, 100, 9999)),
      xCpl: 'Galpão 3',
      xBairro: 'Distrito Industrial',
      cMun: 3550308,
      xMun: 'Campinas',
      uf: 'SP',
      cep: `130${derivaDigitos(`${seed}:cep`, 5)}`,
      cPais: 1058,
      xPais: 'Brasil',
      fone: `19${derivaDigitos(`${seed}:fone`, 8)}`,
    },
    ie: `P${derivaDigitos(`${seed}:ie`, 11)}${derivaDigitos(`${seed}:iedv`, 1)}`,
    crt: 3,
    ...sobre,
  };
}

export function destinatarioSintetico(seed: string, sobre?: Partial<Dest>): Dest {
  const cnpj = cnpjSintetico(`${seed}:dest`);
  const nome = NOMES_PESSOA[deriva(`${seed}:nomep`, 0, NOMES_PESSOA.length - 1)]!;
  return {
    cnpj,
    xNome: `${nome} - ME`,
    enderDest: {
      xLgr: 'Rua XV de Novembro',
      nro: String(deriva(`${seed}:destnro`, 10, 9999)),
      xBairro: 'Centro',
      cMun: 4106902,
      xMun: 'Curitiba',
      uf: 'PR',
      cep: `800${derivaDigitos(`${seed}:destcep`, 5)}`,
      cPais: 1058,
      xPais: 'Brasil',
      fone: `41${derivaDigitos(`${seed}:destfone`, 8)}`,
    },
    indIEDest: 1,
    ie: `9${derivaDigitos(`${seed}:destie`, 8)}`,
    email: `destinatario${fnv1a(seed) % 10000}@exemplo.com.br`,
    ...sobre,
  };
}

// ---------------------------------------------------------------------------
// Itens e grupos de ICMS
// ---------------------------------------------------------------------------

export interface OpcoesItem {
  seed: string;
  vUn?: number;
  qtd?: number;
  icms: Icms;
  pis?: Pis;
  cofins?: Cofins;
  ipi?: Ipi;
  ii?: Ii;
  issqn?: Issqn;
  icmsUfDest?: IcmsUfDest;
  ibscbsSel?: IbsCbsSel;
  impostoDevol?: ImpostoDevol;
  vFrete?: number;
  vSeg?: number;
  vDesc?: number;
  vOutro?: number;
  indTot?: 0 | 1;
}

export function itemSintetico(o: OpcoesItem): Det {
  const vUn = o.vUn ?? round2(deriva(`${o.seed}:vun`, 100, 9900) / 100);
  const qtd = o.qtd ?? deriva(`${o.seed}:qtd`, 1, 40);
  const vProd = round2(qtd * vUn);
  const icms: Icms = calculaValoresIcms(o.icms);

  const prod: Prod = {
    cProd: `SKU${derivaDigitos(`${o.seed}:cprod`, 6)}`,
    cEAN: 'SEM GTIN',
    xProd: `Produto sintético ${deriva(`${o.seed}:nome`, 1000, 9999)}`,
    ncm: derivaDigitos(`${o.seed}:ncm`, 8).padStart(8, '0'),
    cfop: o.icms.grupo.startsWith('ICMSSN') ? '5102' : '5401',
    uCom: 'UN',
    qCom: qtd,
    vUnCom: vUn,
    vProd,
    cEANTrib: 'SEM GTIN',
    uTrib: 'UN',
    qTrib: qtd,
    vUnTrib: vUn,
    vFrete: o.vFrete,
    vSeg: o.vSeg,
    vDesc: o.vDesc,
    vOutro: o.vOutro,
    indTot: o.indTot ?? 1,
  };

  return {
    nItem: 0, // atribuído por montaNFe
    prod,
    imposto: {
      vTotTrib: round2(deriva(`${o.seed}:vtt`, 0, 500) / 100),
      icms,
      ipi: o.ipi,
      ii: o.ii,
      issqn: o.issqn,
      pis: o.pis,
      cofins: o.cofins,
      icmsUfDest: o.icmsUfDest,
      ibscbsSel: o.ibscbsSel,
    },
    impostoDevol: o.impostoDevol,
  };
}

/** Recalcula valores dependentes do grupo de ICMS (vICMS, vICMSST, ...). */
function calculaValoresIcms(icms: Icms): Icms {
  switch (icms.grupo) {
    case 'ICMS00':
      return { ...icms, vICMS: round2((icms.vBC * icms.pICMS) / 100) };
    case 'ICMS10':
      return { ...icms, vICMS: round2((icms.vBC * icms.pICMS) / 100) };
    case 'ICMS20':
      return { ...icms, vICMS: round2((icms.vBC * icms.pICMS) / 100) };
    case 'ICMS51':
      return {
        ...icms,
        vICMSOp:
          icms.vBC !== undefined && icms.pICMS !== undefined
            ? round2((icms.vBC * icms.pICMS) / 100)
            : icms.vICMSOp,
        vICMSDif:
          icms.vICMSOp !== undefined && icms.pDif !== undefined
            ? round2((icms.vICMSOp * icms.pDif) / 100)
            : icms.vICMSDif,
        vICMS:
          icms.vICMSOp !== undefined && icms.vICMSDif !== undefined
            ? round2(icms.vICMSOp - icms.vICMSDif)
            : icms.vICMS,
      };
    case 'ICMS70':
      return { ...icms, vICMS: round2((icms.vBC * icms.pICMS) / 100) };
    case 'ICMS90':
      return {
        ...icms,
        vICMS:
          icms.vBC !== undefined && icms.pICMS !== undefined
            ? round2((icms.vBC * icms.pICMS) / 100)
            : icms.vICMS,
      };
    case 'ICMSSN101':
      // pCredSN/vCredICMSSN são informados pelo chamador (depended de
      // percentual de crédito do Simples, não derivável da BC).
      return icms;
    default:
      return icms;
  }
}

// ---------------------------------------------------------------------------
// Totais
// ---------------------------------------------------------------------------

/** Recomputa `total/ICMSTot` a partir dos itens (mesma aritmética da validação). */
export function calculaIcmsTot(dets: Det[]): IcmsTot {
  const s = {
    vBC: 0,
    vICMS: 0,
    vICMSDeson: 0,
    vFCP: 0,
    vBCST: 0,
    vST: 0,
    vFCPST: 0,
    vFCPSTRet: 0,
    vProd: 0,
    vFrete: 0,
    vSeg: 0,
    vDesc: 0,
    vOutro: 0,
    vII: 0,
    vIPI: 0,
    vIPIDevol: 0,
    vPIS: 0,
    vCOFINS: 0,
    vFCPUFDest: 0,
    vICMSUFDest: 0,
    vICMSUFRemet: 0,
    vServ: 0,
    vBCIss: 0,
    vISS: 0,
    vPisIss: 0,
    vCofinsIss: 0,
    qBCMono: 0,
    vICMSMono: 0,
    qBCMonoReten: 0,
    vICMSMonoReten: 0,
    qBCMonoRet: 0,
    vICMSMonoRet: 0,
  };
  let vTotTrib = 0;

  for (const det of dets) {
    const { prod, imposto } = det;
    if (imposto.vTotTrib !== undefined) vTotTrib += cent(imposto.vTotTrib);

    // Itens de serviço compõem vServ (W18, cStat 605) mesmo com indTot = 0
    // (NF-e conjugada: serviços entram na nota via vServ, não via vProd).
    if (imposto.issqn) {
      const vPis = imposto.pis ? valorPis(imposto.pis) : undefined;
      const vCof = imposto.cofins ? valorCofins(imposto.cofins) : undefined;
      s.vServ += cent(prod.vProd);
      s.vBCIss += cent(imposto.issqn.vBC);
      s.vISS += cent(imposto.issqn.vISSQN);
      if (vPis !== undefined) s.vPisIss += cent(vPis);
      if (vCof !== undefined) s.vCofinsIss += cent(vCof);
    }

    if (prod.indTot !== 1) continue;

    s.vProd += cent(prod.vProd);
    if (prod.vFrete !== undefined) s.vFrete += cent(prod.vFrete);
    if (prod.vSeg !== undefined) s.vSeg += cent(prod.vSeg);
    if (prod.vDesc !== undefined) s.vDesc += cent(prod.vDesc);
    if (prod.vOutro !== undefined) s.vOutro += cent(prod.vOutro);

    const icms = imposto.icms;
    if (icms) {
      if ('vBC' in icms && icms.vBC !== undefined) s.vBC += cent(icms.vBC);
      if ('vICMS' in icms && icms.vICMS !== undefined) s.vICMS += cent(icms.vICMS);
      if ('vFCP' in icms && icms.vFCP !== undefined) s.vFCP += cent(icms.vFCP);
      if ('vBCST' in icms && icms.vBCST !== undefined) s.vBCST += cent(icms.vBCST);
      if ('vICMSST' in icms && icms.vICMSST !== undefined) s.vST += cent(icms.vICMSST);
      if ('vFCPST' in icms && icms.vFCPST !== undefined) s.vFCPST += cent(icms.vFCPST);
      if ('vFCPSTRet' in icms && icms.vFCPSTRet !== undefined) s.vFCPSTRet += cent(icms.vFCPSTRet);
      if ('vICMSDeson' in icms && icms.vICMSDeson !== undefined)
        s.vICMSDeson += cent(icms.vICMSDeson);
      if ('qBCMono' in icms && icms.qBCMono !== undefined) s.qBCMono += cent(icms.qBCMono);
      if ('vICMSMono' in icms && icms.vICMSMono !== undefined) s.vICMSMono += cent(icms.vICMSMono);
      if ('qBCMonoReten' in icms && icms.qBCMonoReten !== undefined)
        s.qBCMonoReten += cent(icms.qBCMonoReten);
      if ('vICMSMonoReten' in icms && icms.vICMSMonoReten !== undefined)
        s.vICMSMonoReten += cent(icms.vICMSMonoReten);
      if ('qBCMonoRet' in icms && icms.qBCMonoRet !== undefined)
        s.qBCMonoRet += cent(icms.qBCMonoRet);
      if ('vICMSMonoRet' in icms && icms.vICMSMonoRet !== undefined)
        s.vICMSMonoRet += cent(icms.vICMSMonoRet);
    }
    if (imposto.ipi?.grupo === 'IPITrib') s.vIPI += cent(imposto.ipi.vIPI);
    if (imposto.ii) s.vII += cent(imposto.ii.vII);
    if (det.impostoDevol) s.vIPIDevol += cent(det.impostoDevol.ipiDevol.vIPIDevol);
    if (imposto.icmsUfDest) {
      if (imposto.icmsUfDest.vFCPUFDest !== undefined)
        s.vFCPUFDest += cent(imposto.icmsUfDest.vFCPUFDest);
      s.vICMSUFDest += cent(imposto.icmsUfDest.vICMSUFDest);
      s.vICMSUFRemet += cent(imposto.icmsUfDest.vICMSUFRemet);
    }
    const vPis = imposto.pis ? valorPis(imposto.pis) : undefined;
    const vCof = imposto.cofins ? valorCofins(imposto.cofins) : undefined;
    if (!imposto.issqn) {
      if (vPis !== undefined) s.vPIS += cent(vPis);
      if (vCof !== undefined) s.vCOFINS += cent(vCof);
    }
  }

  return {
    vBC: s.vBC / 100,
    vICMS: s.vICMS / 100,
    vICMSDeson: s.vICMSDeson / 100,
    vFCPUFDest: s.vFCPUFDest > 0 ? s.vFCPUFDest / 100 : undefined,
    vICMSUFDest: s.vICMSUFDest > 0 ? s.vICMSUFDest / 100 : undefined,
    vICMSUFRemet: s.vICMSUFRemet > 0 ? s.vICMSUFRemet / 100 : undefined,
    vFCP: s.vFCP / 100,
    vBCST: s.vBCST / 100,
    vST: s.vST / 100,
    vFCPST: s.vFCPST / 100,
    vFCPSTRet: s.vFCPSTRet / 100,
    qBCMono: s.qBCMono > 0 ? s.qBCMono / 100 : undefined,
    vICMSMono: s.vICMSMono > 0 ? s.vICMSMono / 100 : undefined,
    qBCMonoReten: s.qBCMonoReten > 0 ? s.qBCMonoReten / 100 : undefined,
    vICMSMonoReten: s.vICMSMonoReten > 0 ? s.vICMSMonoReten / 100 : undefined,
    qBCMonoRet: s.qBCMonoRet > 0 ? s.qBCMonoRet / 100 : undefined,
    vICMSMonoRet: s.vICMSMonoRet > 0 ? s.vICMSMonoRet / 100 : undefined,
    vProd: s.vProd / 100,
    vFrete: s.vFrete / 100,
    vSeg: s.vSeg / 100,
    vDesc: s.vDesc / 100,
    vII: s.vII / 100,
    vIPI: s.vIPI / 100,
    vIPIDevol: s.vIPIDevol / 100,
    vPIS: s.vPIS / 100,
    vCOFINS: s.vCOFINS / 100,
    vOutro: s.vOutro / 100,
    vNF: 0,
    vTotTrib: vTotTrib > 0 ? round2(vTotTrib / 100) : undefined,
  };
}

function valorPis(pis: Pis): number | undefined {
  switch (pis.grupo) {
    case 'PISAliq':
    case 'PISQtde':
    case 'PISOutr':
      return pis.vPIS;
    default:
      return undefined;
  }
}

function valorCofins(cofins: Cofins): number | undefined {
  switch (cofins.grupo) {
    case 'COFINSAliq':
    case 'COFINSQtde':
    case 'COFINSOutr':
      return cofins.vCOFINS;
    default:
      return undefined;
  }
}

/** Fórmula W16-10 (cStat 610) em centavos, com tributos por fora da NT 2024.002. */
export function calculaVnf(t: IcmsTot, issqnServ: number, ibscbsSelTot?: IbsCbsSelTot): number {
  const centavos =
    cent(t.vProd) -
    cent(t.vDesc) -
    cent(t.vICMSDeson) +
    cent(t.vST) +
    cent(t.vFCPST) +
    cent(t.vFrete) +
    cent(t.vSeg) +
    cent(t.vOutro) +
    cent(t.vII) +
    cent(t.vIPI) +
    cent(t.vIPIDevol) +
    cent(issqnServ) +
    (ibscbsSelTot
      ? cent(ibscbsSelTot.gIBS.gIBSMunTot.vIBSTot) +
        cent(ibscbsSelTot.gCBS.vCBS) +
        cent(ibscbsSelTot.gSel?.vImpSel ?? 0)
      : 0);
  return centavos / 100;
}

// ---------------------------------------------------------------------------
// Montagem da nota
// ---------------------------------------------------------------------------

export interface OpcoesNFe {
  seed: string;
  itens: Det[];
  mod?: 55 | 65;
  tpAmb?: 1 | 2;
  tpNF?: 0 | 1;
  idDest?: Ide['idDest'];
  serie?: number;
  nNF?: number;
  dhEmi?: string;
  finNFe?: FinNFe;
  indFinal?: 0 | 1;
  indPres?: IndPres;
  emit?: Emit;
  dest?: Dest | null;
  cobr?: Cobr | null;
  transp?: Transp | null;
  infAdic?: InfAdic;
  infRespTec?: InfRespTec;
  autXml?: AutXml[];
  ibscbsSelTot?: IbsCbsSelTot;
  nfRef?: Ide['nfRef'];
  detPag?: DetPag[];
  vTroco?: number;
  indIntermed?: 0 | 1;
}

/** Monta uma `NFe` completa e consistente a partir das opções. */
export function montaNFe(o: OpcoesNFe): NFe {
  const mod = o.mod ?? 55;
  const tpAmb = o.tpAmb ?? 1;
  const emit = o.emit ?? emitenteSintetico(o.seed);
  const dhEmi = o.dhEmi ?? dhEmiSintetico(o.seed);
  const serie = o.serie ?? deriva(`${o.seed}:serie`, 1, 100);
  const nNF = o.nNF ?? deriva(`${o.seed}:nnf`, 1000, 999999);
  const cNF = derivaDigitos(`${o.seed}:cnf`, 8);
  const tpEmis = 1;
  const aamm = aammDeDhEmi(dhEmi);
  if (aamm === undefined) {
    throw new Error(`dhEmi inválido para composição da chave: ${dhEmi}`);
  }
  const docEmitente = emit.cnpj ?? emit.cpf;
  if (docEmitente === undefined) {
    throw new Error('Emitente sem CNPJ/CPF — impossível compor a chave de acesso.');
  }
  const chave = montaChaveDeAcesso({
    cUF: CODIGOS_UF['SP']!,
    aamm,
    docEmitente,
    mod,
    serie,
    nNF,
    tpEmis,
    cNF,
  });

  const dets: Det[] = o.itens.map((d, i) => ({ ...d, nItem: i + 1 }));

  const icmsTot = calculaIcmsTot(dets);
  const serv =
    o.itens.map((d) => (d.imposto.issqn ? cent(d.prod.vProd) : 0)).reduce((a, b) => a + b, 0) / 100;
  icmsTot.vNF = calculaVnf(icmsTot, serv, o.ibscbsSelTot);

  const total: Total = { icmsTot, ibscbsSelTot: o.ibscbsSelTot };
  if (serv > 0 || o.itens.some((d) => d.imposto.issqn)) {
    const somaBC = o.itens.reduce((a, d) => a + cent(d.imposto.issqn?.vBC ?? 0), 0);
    const somaISS = o.itens.reduce((a, d) => a + cent(d.imposto.issqn?.vISSQN ?? 0), 0);
    const somaPis = o.itens.reduce((a, d) => {
      const v = d.imposto.issqn && d.imposto.pis ? valorPis(d.imposto.pis) : undefined;
      return a + (v !== undefined ? cent(v) : 0);
    }, 0);
    const somaCof = o.itens.reduce((a, d) => {
      const v = d.imposto.issqn && d.imposto.cofins ? valorCofins(d.imposto.cofins) : undefined;
      return a + (v !== undefined ? cent(v) : 0);
    }, 0);
    total.issqnTot = {
      vServ: serv,
      vBC: somaBC / 100,
      vISS: somaISS / 100,
      vPIS: somaPis / 100,
      vCOFINS: somaCof / 100,
      dCompet: dhEmi.slice(0, 10),
      cRegTrib: 3,
    };
  }

  const vNf = icmsTot.vNF;
  const detPag: DetPag[] =
    o.detPag ?? (mod === 65 ? [{ tPag: '01', vPag: vNf }] : [{ indPag: 0, tPag: '15', vPag: vNf }]);
  const vTroco =
    o.vTroco ??
    (mod === 65 && detPag.length === 1 && detPag[0]?.tPag === '01'
      ? round2(Math.max(0, (detPag[0]?.vPag ?? 0) - vNf))
      : undefined);

  const ide: Ide = {
    cUF: CODIGOS_UF['SP']!,
    cNF,
    natOp:
      mod === 65
        ? 'VENDA DE MERCADORIA ADQUIRIDA OU RECEBIDA DE TERCEIROS'
        : 'VENDA DE PRODUÇÃO PRÓPRIA',
    mod,
    serie,
    nNF,
    dhEmi,
    tpNF: o.tpNF ?? 1,
    idDest: o.idDest ?? 1,
    cMunFG: 3550308,
    tpImp: mod === 65 ? 4 : 1,
    tpEmis,
    cDV: Number(chave.slice(43)),
    tpAmb,
    finNFe: o.finNFe ?? 1,
    indFinal: o.indFinal ?? (mod === 65 ? 1 : 0),
    indPres: o.indPres ?? (mod === 65 ? 1 : 0),
    indIntermed: o.indIntermed,
    procEmi: 0,
    verProc: 'danfe-br-fixtures 0.1.0',
    nfRef: o.nfRef ?? [],
  };

  const transp: Transp = o.transp ?? {
    modFrete: 9,
    reboque: [],
    vol: [],
  };

  return {
    versao: '4.00',
    chave,
    ide,
    emit,
    dest: o.dest === null ? undefined : (o.dest ?? destinatarioSintetico(`${o.seed}:dest`)),
    det: dets,
    total,
    transp,
    cobr: o.cobr ?? undefined,
    pag: { detPag, vTroco },
    infAdic: o.infAdic,
    infRespTec: o.infRespTec,
    autXml: o.autXml ?? [],
  };
}

/** Protocolo sintético coerente com a nota (cStat 100/150/110/301). */
export function protNFeSintetico(nfe: NFe, sobre?: Partial<ProtNFe>): ProtNFe {
  const prot: ProtNFe = {
    tpAmb: nfe.ide.tpAmb,
    verAplic: 'SVRS-2026',
    chNFe: nfe.chave,
    dhRecbto: `${nfe.ide.dhEmi.slice(0, 19)}-03:00`,
    nProt: `${deriva(`prot:${nfe.chave}`, 1, 999999999)}`.padStart(15, '0'),
    cStat: 100,
    xMotivo: 'Autorizado o uso da NF-e',
    ...sobre,
  };
  return prot;
}

/** Envolve a nota como `nfeProc` com (ou sem) protocolo. */
export function montaNFeProc(nfe: NFe, protNFe?: ProtNFe, infNFeSupl?: InfNFeSupl): NFeProc {
  return { versao: '4.00', nfe, infNFeSupl, protNFe };
}

// ---------------------------------------------------------------------------
// Serialização XML
// ---------------------------------------------------------------------------

/** Serializa uma `NFeProc` (raiz `nfeProc`) com o protocolo, quando existir. */
export function nfeProcToXml(proc: NFeProc): string {
  const w = new EscritorXml();
  w.prologo();
  w.abre('nfeProc', { versao: '4.00', xmlns: 'http://www.portalfiscal.inf.br/nfe' });
  serializaNFe(w, proc.nfe, proc.infNFeSupl);
  if (proc.protNFe) serializaProtNFe(w, proc.protNFe);
  w.fecha('nfeProc');
  return w.construir();
}

/** Serializa apenas a `NFe` (raiz `NFe`, sem protocolo). */
export function nfeToXml(nfe: NFe, infNFeSupl?: InfNFeSupl): string {
  const w = new EscritorXml();
  w.prologo();
  serializaNFe(w, nfe, infNFeSupl);
  return w.construir();
}

function serializaNFe(w: EscritorXml, nfe: NFe, infNFeSupl?: InfNFeSupl): void {
  w.abre('NFe', { xmlns: 'http://www.portalfiscal.inf.br/nfe' });
  w.abre('infNFe', { Id: `NFe${nfe.chave}`, versao: nfe.versao });

  serializaIde(w, nfe.ide);
  serializaEmit(w, nfe.emit);
  if (nfe.dest) serializaDest(w, nfe.dest);
  for (const det of nfe.det) serializaDet(w, det);
  serializaTotal(w, nfe.total);
  serializaTransp(w, nfe.transp);
  if (nfe.cobr) serializaCobr(w, nfe.cobr);
  serializaPag(w, nfe.pag);
  if (nfe.infAdic) serializaInfAdic(w, nfe.infAdic);
  if (nfe.infRespTec) serializaInfRespTec(w, nfe.infRespTec);
  for (const aut of nfe.autXml) {
    w.abre('autXML');
    if (aut.cnpj) w.texto('CNPJ', aut.cnpj);
    if (aut.cpf) w.texto('CPF', aut.cpf);
    w.fecha('autXML');
  }
  w.fecha('infNFe');
  if (infNFeSupl) {
    w.abre('infNFeSupl');
    // NFC-e: conteúdo em CDATA, conforme o Manual de Especificações Técnicas
    // do DANFE NFC-e e QR Code (Portal Nacional da NFC-e). O grupo é irmão do
    // `infNFe` dentro de `NFe` (leiaute 4.00) — não integra o digest da
    // assinatura, que cobre apenas o `infNFe`.
    w.cdata('qrCode', infNFeSupl.qrCode);
    w.texto('urlChave', infNFeSupl.urlChave);
    w.fecha('infNFeSupl');
  }
  w.fecha('NFe');
}

function serializaProtNFe(w: EscritorXml, prot: ProtNFe): void {
  w.abre('protNFe', { versao: '4.00' });
  w.abre('infProt', { Id: `ID${prot.nProt ?? prot.chNFe}` });
  w.texto('tpAmb', prot.tpAmb);
  w.texto('verAplic', prot.verAplic);
  w.texto('chNFe', prot.chNFe);
  w.texto('dhRecbto', prot.dhRecbto);
  w.texto('nProt', prot.nProt);
  w.texto('cStat', prot.cStat);
  w.texto('xMotivo', prot.xMotivo);
  w.fecha('infProt');
  w.fecha('protNFe');
}

function serializaIde(w: EscritorXml, ide: Ide): void {
  w.abre('ide');
  w.texto('cUF', ide.cUF);
  w.texto('cNF', ide.cNF);
  w.texto('natOp', ide.natOp);
  w.texto('mod', ide.mod);
  w.texto('serie', ide.serie);
  w.texto('nNF', ide.nNF);
  w.texto('dhEmi', ide.dhEmi);
  if (ide.dhSaiEnt) w.texto('dhSaiEnt', ide.dhSaiEnt);
  w.texto('tpNF', ide.tpNF);
  w.texto('idDest', ide.idDest);
  w.texto('cMunFG', ide.cMunFG);
  w.texto('tpImp', ide.tpImp);
  w.texto('tpEmis', ide.tpEmis);
  w.texto('cDV', ide.cDV);
  w.texto('tpAmb', ide.tpAmb);
  w.texto('finNFe', ide.finNFe);
  w.texto('indFinal', ide.indFinal);
  w.texto('indPres', ide.indPres);
  if (ide.indIntermed !== undefined) w.texto('indIntermed', ide.indIntermed);
  w.texto('procEmi', ide.procEmi);
  w.texto('verProc', ide.verProc);
  for (const ref of ide.nfRef) {
    w.abre('NFref');
    if ('refNFe' in ref) w.texto('refNFe', ref.refNFe);
    if ('refNF' in ref) {
      const r = ref.refNF;
      w.abre('refNF');
      w.texto('cUF', r.cUF);
      w.texto('AAMM', r.aamm);
      w.texto('CNPJ', r.cnpj);
      w.texto('mod', r.mod);
      w.texto('serie', r.serie);
      w.texto('nNF', r.nNF);
      w.fecha('refNF');
    }
    if ('refCTe' in ref) w.texto('refCTe', ref.refCTe);
    if ('refNFP' in ref) {
      const r = ref.refNFP;
      w.abre('refNFP');
      w.texto('cUF', r.cUF);
      if (r.cnpj) w.texto('CNPJ', r.cnpj);
      if (r.cpf) w.texto('CPF', r.cpf);
      if (r.ie) w.texto('IE', r.ie);
      w.texto('mod', r.mod);
      w.texto('serie', r.serie);
      w.texto('nNF', r.nNF);
      w.fecha('refNFP');
    }
    if ('refECF' in ref) {
      const r = ref.refECF;
      w.abre('refECF');
      w.texto('mod', r.mod);
      w.texto('nECF', r.nECF);
      w.texto('nCOO', r.nCOO);
      w.fecha('refECF');
    }
    w.fecha('NFref');
  }
  w.fecha('ide');
}

function serializaEmit(w: EscritorXml, emit: Emit): void {
  w.abre('emit');
  if (emit.cnpj) w.texto('CNPJ', emit.cnpj);
  if (emit.cpf) w.texto('CPF', emit.cpf);
  w.texto('xNome', emit.xNome);
  if (emit.xFant) w.texto('xFant', emit.xFant);
  serializaEndereco(w, 'enderEmit', emit.enderEmit, true);
  w.texto('IE', emit.ie);
  if (emit.iest) w.texto('IEST', emit.iest);
  if (emit.im) w.texto('IM', emit.im);
  if (emit.cnae) w.texto('CNAE', emit.cnae);
  w.texto('CRT', emit.crt);
  w.fecha('emit');
}

function serializaDest(w: EscritorXml, dest: Dest): void {
  w.abre('dest');
  if (dest.cnpj) w.texto('CNPJ', dest.cnpj);
  if (dest.cpf) w.texto('CPF', dest.cpf);
  if (dest.idEstrangeiro) w.texto('idEstrangeiro', dest.idEstrangeiro);
  if (dest.xNome) w.texto('xNome', dest.xNome);
  if (dest.enderDest) serializaEndereco(w, 'enderDest', dest.enderDest, false);
  w.texto('indIEDest', dest.indIEDest);
  if (dest.ie) w.texto('IE', dest.ie);
  if (dest.isuf) w.texto('ISUF', dest.isuf);
  if (dest.im) w.texto('IM', dest.im);
  if (dest.email) w.texto('email', dest.email);
  w.fecha('dest');
}

function serializaEndereco(
  w: EscritorXml,
  tag: string,
  e: Emit['enderEmit'],
  cepObrigatorio: boolean,
): void {
  w.abre(tag);
  w.texto('xLgr', e.xLgr);
  w.texto('nro', e.nro);
  if (e.xCpl) w.texto('xCpl', e.xCpl);
  w.texto('xBairro', e.xBairro);
  w.texto('cMun', e.cMun);
  w.texto('xMun', e.xMun);
  w.texto('UF', e.uf);
  if (e.cep) w.texto('CEP', e.cep);
  else if (cepObrigatorio) w.texto('CEP', '00000000');
  if (e.cPais !== undefined) w.texto('cPais', e.cPais);
  if (e.xPais) w.texto('xPais', e.xPais);
  if (e.fone) w.texto('fone', e.fone);
  w.fecha(tag);
}

function serializaDet(w: EscritorXml, det: Det): void {
  w.abre('det', { nItem: String(det.nItem) });
  const p = det.prod;
  w.abre('prod');
  w.texto('cProd', p.cProd);
  w.texto('cEAN', p.cEAN);
  if (p.cBarra) w.texto('cBarra', p.cBarra);
  w.texto('xProd', p.xProd);
  w.texto('NCM', p.ncm);
  if (p.cest) w.texto('CEST', p.cest);
  if (p.cnpjFab) w.texto('CNPJFab', p.cnpjFab);
  if (p.cBenef) w.texto('cBenef', p.cBenef);
  if (p.extIpi) w.texto('EXTIPI', p.extIpi);
  w.texto('CFOP', p.cfop);
  w.texto('uCom', p.uCom);
  w.decimal('qCom', p.qCom, 4);
  w.decimal('vUnCom', p.vUnCom, 10);
  w.decimal('vProd', p.vProd);
  w.texto('cEANTrib', p.cEANTrib);
  if (p.cBarraTrib) w.texto('cBarraTrib', p.cBarraTrib);
  w.texto('uTrib', p.uTrib);
  w.decimal('qTrib', p.qTrib, 4);
  w.decimal('vUnTrib', p.vUnTrib, 10);
  w.decimal('vFrete', p.vFrete);
  w.decimal('vSeg', p.vSeg);
  w.decimal('vDesc', p.vDesc);
  w.decimal('vOutro', p.vOutro);
  w.texto('indTot', p.indTot);
  if (p.xPed) w.texto('xPed', p.xPed);
  if (p.nItemPed !== undefined) w.texto('nItemPed', p.nItemPed);
  w.fecha('prod');

  serializaImposto(w, det.imposto);

  if (det.impostoDevol) {
    w.abre('impostoDevol');
    w.decimal('pDevol', det.impostoDevol.pDevol);
    w.abre('IPI');
    w.decimal('vIPIDevol', det.impostoDevol.ipiDevol.vIPIDevol);
    w.fecha('IPI');
    w.fecha('impostoDevol');
  }
  if (det.infAdProd) w.texto('infAdProd', det.infAdProd);
  if (det.obsItem) {
    w.abre('obsItem');
    for (const o of det.obsItem.obsCont ?? []) {
      w.abre('obsCont', { xCampo: o.xCampo });
      w.texto('xTexto', o.xTexto);
      w.fecha('obsCont');
    }
    for (const o of det.obsItem.obsFisco ?? []) {
      w.abre('obsFisco', { xCampo: o.xCampo });
      w.texto('xTexto', o.xTexto);
      w.fecha('obsFisco');
    }
    w.fecha('obsItem');
  }
  w.fecha('det');
}

function serializaImposto(w: EscritorXml, imposto: Imposto): void {
  w.abre('imposto');
  w.decimal('vTotTrib', imposto.vTotTrib);
  if (imposto.icms) serializaIcms(w, imposto.icms);
  if (imposto.ipi) serializaIpi(w, imposto.ipi);
  if (imposto.ii) {
    w.abre('II');
    w.decimal('vBC', imposto.ii.vBC);
    w.decimal('vDespAdu', imposto.ii.vDespAdu);
    w.decimal('vII', imposto.ii.vII);
    w.decimal('vIOF', imposto.ii.vIOF);
    w.fecha('II');
  }
  if (imposto.issqn) serializaIssqn(w, imposto.issqn);
  if (imposto.pis) serializaPis(w, imposto.pis);
  if (imposto.cofins) serializaCofins(w, imposto.cofins);
  if (imposto.icmsUfDest) {
    const u = imposto.icmsUfDest;
    w.abre('ICMSUFDest');
    w.decimal('vBCUFDest', u.vBCUFDest);
    w.decimal('vBCFCPUFDest', u.vBCFCPUFDest);
    w.decimal('pFCPUFDest', u.pFCPUFDest);
    w.decimal('pICMSUFDest', u.pICMSUFDest);
    w.texto('pICMSInter', u.pICMSInter);
    w.decimal('pICMSInterPart', u.pICMSInterPart);
    w.decimal('vFCPUFDest', u.vFCPUFDest);
    w.decimal('vICMSUFDest', u.vICMSUFDest);
    w.decimal('vICMSUFRemet', u.vICMSUFRemet);
    w.fecha('ICMSUFDest');
  }
  if (imposto.ibscbsSel) serializaIbsCbsSel(w, imposto.ibscbsSel);
  w.fecha('imposto');
}

function serializaIssqn(w: EscritorXml, iss: Issqn): void {
  w.abre('ISSQN');
  w.decimal('vBC', iss.vBC);
  w.decimal('vAliq', iss.vAliq);
  w.decimal('vISSQN', iss.vISSQN);
  w.texto('cMunFG', iss.cMunFG);
  w.texto('cListServ', iss.cListServ);
  w.decimal('vDeducao', iss.vDeducao);
  w.decimal('vOutro', iss.vOutro);
  w.decimal('vDescIncond', iss.vDescIncond);
  w.decimal('vDescCond', iss.vDescCond);
  w.decimal('vISSRet', iss.vISSRet);
  w.texto('indISS', iss.indISS);
  if (iss.cServico) w.texto('cServico', iss.cServico);
  if (iss.cMun !== undefined) w.texto('cMun', iss.cMun);
  if (iss.cPais) w.texto('cPais', iss.cPais);
  if (iss.nProcesso) w.texto('nProcesso', iss.nProcesso);
  w.texto('indIncentivo', iss.indIncentivo);
  w.fecha('ISSQN');
}

function serializaIcms(w: EscritorXml, icms: Icms): void {
  w.abre('ICMS');
  switch (icms.grupo) {
    case 'ICMS00': {
      w.abre('ICMS00');
      w.texto('orig', icms.orig);
      w.texto('CST', icms.cst);
      w.texto('modBC', icms.modBC);
      w.decimal('vBC', icms.vBC);
      w.decimal('pICMS', icms.pICMS);
      w.decimal('vICMS', icms.vICMS);
      w.decimal('pFCP', icms.pFCP);
      w.decimal('vFCP', icms.vFCP);
      w.fecha('ICMS00');
      break;
    }
    case 'ICMS02': {
      w.abre('ICMS02');
      w.texto('orig', icms.orig);
      w.texto('CST', icms.cst);
      w.decimal('qBCMono', icms.qBCMono, 4);
      w.decimal('adRemICMS', icms.adRemICMS);
      w.decimal('vICMSMono', icms.vICMSMono);
      w.fecha('ICMS02');
      break;
    }
    case 'ICMS10': {
      w.abre('ICMS10');
      w.texto('orig', icms.orig);
      w.texto('CST', icms.cst);
      w.texto('modBC', icms.modBC);
      w.decimal('vBC', icms.vBC);
      w.decimal('pICMS', icms.pICMS);
      w.decimal('vICMS', icms.vICMS);
      w.decimal('vBCFCP', icms.vBCFCP);
      w.decimal('pFCP', icms.pFCP);
      w.decimal('vFCP', icms.vFCP);
      w.texto('modBCST', icms.modBCST);
      w.decimal('pMVAST', icms.pMVAST);
      w.decimal('pRedBCST', icms.pRedBCST);
      w.decimal('vBCST', icms.vBCST);
      w.decimal('pICMSST', icms.pICMSST);
      w.decimal('vICMSST', icms.vICMSST);
      w.decimal('vBCFCPST', icms.vBCFCPST);
      w.decimal('pFCPST', icms.pFCPST);
      w.decimal('vFCPST', icms.vFCPST);
      w.fecha('ICMS10');
      break;
    }
    case 'ICMS15': {
      w.abre('ICMS15');
      w.texto('orig', icms.orig);
      w.texto('CST', icms.cst);
      w.decimal('qBCMono', icms.qBCMono, 4);
      w.decimal('adRemICMS', icms.adRemICMS);
      w.decimal('vICMSMono', icms.vICMSMono);
      w.decimal('qBCMonoReten', icms.qBCMonoReten, 4);
      w.decimal('adRemICMSReten', icms.adRemICMSReten);
      w.decimal('vICMSMonoReten', icms.vICMSMonoReten);
      w.fecha('ICMS15');
      break;
    }
    case 'ICMS20': {
      w.abre('ICMS20');
      w.texto('orig', icms.orig);
      w.texto('CST', icms.cst);
      w.texto('modBC', icms.modBC);
      w.decimal('pRedBC', icms.pRedBC);
      w.decimal('vBC', icms.vBC);
      w.decimal('pICMS', icms.pICMS);
      w.decimal('vICMS', icms.vICMS);
      w.decimal('pFCP', icms.pFCP);
      w.decimal('vFCP', icms.vFCP);
      w.fecha('ICMS20');
      break;
    }
    case 'ICMS30': {
      w.abre('ICMS30');
      w.texto('orig', icms.orig);
      w.texto('CST', icms.cst);
      w.texto('modBCST', icms.modBCST);
      w.decimal('pMVAST', icms.pMVAST);
      w.decimal('pRedBCST', icms.pRedBCST);
      w.decimal('vBCST', icms.vBCST);
      w.decimal('pICMSST', icms.pICMSST);
      w.decimal('vICMSST', icms.vICMSST);
      w.decimal('vICMSDeson', icms.vICMSDeson);
      if (icms.motDesICMS !== undefined) w.texto('motDesICMS', icms.motDesICMS);
      w.fecha('ICMS30');
      break;
    }
    case 'ICMS40': {
      w.abre('ICMS40');
      w.texto('orig', icms.orig);
      w.texto('CST', icms.cst);
      w.decimal('vICMSDeson', icms.vICMSDeson);
      if (icms.motDesICMS !== undefined) w.texto('motDesICMS', icms.motDesICMS);
      w.fecha('ICMS40');
      break;
    }
    case 'ICMS51': {
      w.abre('ICMS51');
      w.texto('orig', icms.orig);
      w.texto('CST', icms.cst);
      if (icms.modBC !== undefined) w.texto('modBC', icms.modBC);
      w.decimal('pRedBC', icms.pRedBC);
      if (icms.cBenefRBC) w.texto('cBenefRBC', icms.cBenefRBC);
      w.decimal('vBC', icms.vBC);
      w.decimal('pICMS', icms.pICMS);
      w.decimal('vICMSOp', icms.vICMSOp);
      w.decimal('pDif', icms.pDif);
      w.decimal('vICMSDif', icms.vICMSDif);
      w.decimal('vICMS', icms.vICMS);
      w.fecha('ICMS51');
      break;
    }
    case 'ICMS53': {
      w.abre('ICMS53');
      w.texto('orig', icms.orig);
      w.texto('CST', icms.cst);
      w.decimal('qBCMono', icms.qBCMono, 4);
      w.decimal('adRemICMS', icms.adRemICMS);
      w.decimal('vICMSMonoOp', icms.vICMSMonoOp);
      w.decimal('pDif', icms.pDif);
      w.decimal('vICMSMonoDif', icms.vICMSMonoDif);
      w.decimal('vICMSMono', icms.vICMSMono);
      w.decimal('qBCMonoDif', icms.qBCMonoDif, 4);
      w.decimal('adRemICMSDif', icms.adRemICMSDif);
      w.fecha('ICMS53');
      break;
    }
    case 'ICMS60': {
      w.abre('ICMS60');
      w.texto('orig', icms.orig);
      w.texto('CST', icms.cst);
      if (icms.vBCSTRet !== undefined) {
        w.decimal('vBCSTRet', icms.vBCSTRet);
        w.decimal('pST', icms.pST);
        w.decimal('vICMSSubstituto', icms.vICMSSubstituto);
        w.decimal('vICMSSTRet', icms.vICMSSTRet);
        w.decimal('vBCFCPSTRet', icms.vBCFCPSTRet);
        w.decimal('pFCPSTRet', icms.pFCPSTRet);
        w.decimal('vFCPSTRet', icms.vFCPSTRet);
      }
      w.fecha('ICMS60');
      break;
    }
    case 'ICMS61': {
      w.abre('ICMS61');
      w.texto('orig', icms.orig);
      w.texto('CST', icms.cst);
      w.decimal('qBCMonoRet', icms.qBCMonoRet, 4);
      w.decimal('adRemICMSRet', icms.adRemICMSRet);
      w.decimal('vICMSMonoRet', icms.vICMSMonoRet);
      w.fecha('ICMS61');
      break;
    }
    case 'ICMS70': {
      w.abre('ICMS70');
      w.texto('orig', icms.orig);
      w.texto('CST', icms.cst);
      w.texto('modBC', icms.modBC);
      w.decimal('pRedBC', icms.pRedBC);
      w.decimal('vBC', icms.vBC);
      w.decimal('pICMS', icms.pICMS);
      w.decimal('vICMS', icms.vICMS);
      w.texto('modBCST', icms.modBCST);
      w.decimal('pMVAST', icms.pMVAST);
      w.decimal('pRedBCST', icms.pRedBCST);
      w.decimal('vBCST', icms.vBCST);
      w.decimal('pICMSST', icms.pICMSST);
      w.decimal('vICMSST', icms.vICMSST);
      w.decimal('vBCFCPST', icms.vBCFCPST);
      w.decimal('pFCPST', icms.pFCPST);
      w.decimal('vFCPST', icms.vFCPST);
      w.fecha('ICMS70');
      break;
    }
    case 'ICMS90': {
      w.abre('ICMS90');
      w.texto('orig', icms.orig);
      w.texto('CST', icms.cst);
      if (icms.modBC !== undefined) {
        w.texto('modBC', icms.modBC);
        w.decimal('vBC', icms.vBC);
        w.decimal('pRedBC', icms.pRedBC);
        w.decimal('pICMS', icms.pICMS);
        w.decimal('vICMS', icms.vICMS);
        w.decimal('vBCFCP', icms.vBCFCP);
        w.decimal('pFCP', icms.pFCP);
        w.decimal('vFCP', icms.vFCP);
      }
      if (icms.modBCST !== undefined) {
        w.texto('modBCST', icms.modBCST);
        w.decimal('pMVAST', icms.pMVAST);
        w.decimal('pRedBCST', icms.pRedBCST);
        w.decimal('vBCST', icms.vBCST);
        w.decimal('pICMSST', icms.pICMSST);
        w.decimal('vICMSST', icms.vICMSST);
        w.decimal('vBCFCPST', icms.vBCFCPST);
        w.decimal('pFCPST', icms.pFCPST);
        w.decimal('vFCPST', icms.vFCPST);
      }
      w.fecha('ICMS90');
      break;
    }
    case 'ICMSPart': {
      w.abre('ICMSPart');
      w.texto('orig', icms.orig);
      w.texto('CST', icms.cst);
      w.texto('modBC', icms.modBC);
      w.decimal('vBC', icms.vBC);
      w.decimal('pRedBC', icms.pRedBC);
      w.decimal('pICMS', icms.pICMS);
      w.decimal('vICMS', icms.vICMS);
      w.texto('modBCST', icms.modBCST);
      w.decimal('pMVAST', icms.pMVAST);
      w.decimal('pRedBCST', icms.pRedBCST);
      w.decimal('vBCST', icms.vBCST);
      w.decimal('pICMSST', icms.pICMSST);
      w.decimal('vICMSST', icms.vICMSST);
      w.decimal('pBCOp', icms.pBCOp);
      w.texto('UFST', icms.ufST);
      w.fecha('ICMSPart');
      break;
    }
    case 'ICMSST': {
      w.abre('ICMSST');
      w.texto('orig', icms.orig);
      w.texto('CST', icms.cst);
      w.decimal('vBCSTRet', icms.vBCSTRet);
      w.decimal('pST', icms.pST);
      w.decimal('vICMSSubstituto', icms.vICMSSubstituto);
      w.decimal('vICMSSTRet', icms.vICMSSTRet);
      w.decimal('vBCSTDest', icms.vBCSTDest);
      w.decimal('vICMSSTDest', icms.vICMSSTDest);
      w.fecha('ICMSST');
      break;
    }
    case 'ICMSSN101': {
      w.abre('ICMSSN101');
      w.texto('orig', icms.orig);
      w.texto('CSOSN', icms.csosn);
      w.decimal('pCredSN', icms.pCredSN);
      w.decimal('vCredICMSSN', icms.vCredICMSSN);
      w.fecha('ICMSSN101');
      break;
    }
    case 'ICMSSN102': {
      w.abre('ICMSSN102');
      if (icms.orig !== undefined) w.texto('orig', icms.orig);
      w.texto('CSOSN', icms.csosn);
      w.fecha('ICMSSN102');
      break;
    }
    case 'ICMSSN201': {
      w.abre('ICMSSN201');
      w.texto('orig', icms.orig);
      w.texto('CSOSN', icms.csosn);
      w.texto('modBCST', icms.modBCST);
      w.decimal('pMVAST', icms.pMVAST);
      w.decimal('pRedBCST', icms.pRedBCST);
      w.decimal('vBCST', icms.vBCST);
      w.decimal('pICMSST', icms.pICMSST);
      w.decimal('vICMSST', icms.vICMSST);
      w.decimal('pCredSN', icms.pCredSN);
      w.decimal('vCredICMSSN', icms.vCredICMSSN);
      w.fecha('ICMSSN201');
      break;
    }
    case 'ICMSSN202': {
      w.abre('ICMSSN202');
      w.texto('orig', icms.orig);
      w.texto('CSOSN', icms.csosn);
      w.texto('modBCST', icms.modBCST);
      w.decimal('pMVAST', icms.pMVAST);
      w.decimal('pRedBCST', icms.pRedBCST);
      w.decimal('vBCST', icms.vBCST);
      w.decimal('pICMSST', icms.pICMSST);
      w.decimal('vICMSST', icms.vICMSST);
      w.fecha('ICMSSN202');
      break;
    }
    case 'ICMSSN500': {
      w.abre('ICMSSN500');
      w.texto('orig', icms.orig);
      w.texto('CSOSN', icms.csosn);
      w.decimal('vBCSTRet', icms.vBCSTRet);
      w.decimal('pST', icms.pST);
      w.decimal('vICMSSubstituto', icms.vICMSSubstituto);
      w.decimal('vICMSSTRet', icms.vICMSSTRet);
      w.decimal('vBCFCPSTRet', icms.vBCFCPSTRet);
      w.decimal('pFCPSTRet', icms.pFCPSTRet);
      w.decimal('vFCPSTRet', icms.vFCPSTRet);
      w.fecha('ICMSSN500');
      break;
    }
    case 'ICMSSN900': {
      w.abre('ICMSSN900');
      if (icms.orig !== undefined) w.texto('orig', icms.orig);
      w.texto('CSOSN', icms.csosn);
      if (icms.modBC !== undefined) {
        w.texto('modBC', icms.modBC);
        w.decimal('vBC', icms.vBC);
        w.decimal('pRedBC', icms.pRedBC);
        w.decimal('pICMS', icms.pICMS);
        w.decimal('vICMS', icms.vICMS);
      }
      if (icms.modBCST !== undefined) {
        w.texto('modBCST', icms.modBCST);
        w.decimal('pMVAST', icms.pMVAST);
        w.decimal('pRedBCST', icms.pRedBCST);
        w.decimal('vBCST', icms.vBCST);
        w.decimal('pICMSST', icms.pICMSST);
        w.decimal('vICMSST', icms.vICMSST);
      }
      w.decimal('pCredSN', icms.pCredSN);
      w.decimal('vCredICMSSN', icms.vCredICMSSN);
      w.fecha('ICMSSN900');
      break;
    }
  }
  w.fecha('ICMS');
}

function serializaIpi(w: EscritorXml, ipi: Ipi): void {
  w.abre('IPI');
  if (ipi.cnpjProd) w.texto('CNPJProd', ipi.cnpjProd);
  if (ipi.cSelo) w.texto('cSelo', ipi.cSelo);
  if (ipi.qSelo !== undefined) w.texto('qSelo', ipi.qSelo);
  w.texto('cEnq', ipi.cEnq);
  if (ipi.grupo === 'IPITrib') {
    w.abre('IPITrib');
    w.texto('CST', ipi.cst);
    if (ipi.vBC !== undefined && ipi.pIPI !== undefined) {
      w.decimal('vBC', ipi.vBC);
      w.decimal('pIPI', ipi.pIPI);
    } else if (ipi.qUnid !== undefined && ipi.vUnid !== undefined) {
      w.decimal('qUnid', ipi.qUnid, 4);
      w.decimal('vUnid', ipi.vUnid, 4);
    }
    w.decimal('vIPI', ipi.vIPI);
    w.fecha('IPITrib');
  } else {
    w.abre('IPINT');
    w.texto('CST', ipi.cst);
    w.fecha('IPINT');
  }
  w.fecha('IPI');
}

function serializaPis(w: EscritorXml, pis: Pis): void {
  w.abre('PIS');
  switch (pis.grupo) {
    case 'PISAliq':
      w.abre('PISAliq');
      w.texto('CST', pis.cst);
      w.decimal('vBC', pis.vBC);
      w.decimal('pPIS', pis.pPIS);
      w.decimal('vPIS', pis.vPIS);
      w.fecha('PISAliq');
      break;
    case 'PISQtde':
      w.abre('PISQtde');
      w.texto('CST', pis.cst);
      w.decimal('qBCProd', pis.qBCProd, 4);
      w.decimal('vAliqProd', pis.vAliqProd, 4);
      w.decimal('vPIS', pis.vPIS);
      w.fecha('PISQtde');
      break;
    case 'PISNT':
      w.abre('PISNT');
      w.texto('CST', pis.cst);
      w.fecha('PISNT');
      break;
    case 'PISOutr':
      w.abre('PISOutr');
      w.texto('CST', pis.cst);
      if (pis.vBC !== undefined && pis.pPIS !== undefined) {
        w.decimal('vBC', pis.vBC);
        w.decimal('pPIS', pis.pPIS);
      } else if (pis.qBCProd !== undefined && pis.vAliqProd !== undefined) {
        w.decimal('qBCProd', pis.qBCProd, 4);
        w.decimal('vAliqProd', pis.vAliqProd, 4);
      }
      w.decimal('vPIS', pis.vPIS);
      w.fecha('PISOutr');
      break;
  }
  w.fecha('PIS');
}

function serializaCofins(w: EscritorXml, cofins: Cofins): void {
  w.abre('COFINS');
  switch (cofins.grupo) {
    case 'COFINSAliq':
      w.abre('COFINSAliq');
      w.texto('CST', cofins.cst);
      w.decimal('vBC', cofins.vBC);
      w.decimal('pCOFINS', cofins.pCOFINS);
      w.decimal('vCOFINS', cofins.vCOFINS);
      w.fecha('COFINSAliq');
      break;
    case 'COFINSQtde':
      w.abre('COFINSQtde');
      w.texto('CST', cofins.cst);
      w.decimal('qBCProd', cofins.qBCProd, 4);
      w.decimal('vAliqProd', cofins.vAliqProd, 4);
      w.decimal('vCOFINS', cofins.vCOFINS);
      w.fecha('COFINSQtde');
      break;
    case 'COFINSNT':
      w.abre('COFINSNT');
      w.texto('CST', cofins.cst);
      w.fecha('COFINSNT');
      break;
    case 'COFINSOutr':
      w.abre('COFINSOutr');
      w.texto('CST', cofins.cst);
      if (cofins.vBC !== undefined && cofins.pCOFINS !== undefined) {
        w.decimal('vBC', cofins.vBC);
        w.decimal('pCOFINS', cofins.pCOFINS);
      } else if (cofins.qBCProd !== undefined && cofins.vAliqProd !== undefined) {
        w.decimal('qBCProd', cofins.qBCProd, 4);
        w.decimal('vAliqProd', cofins.vAliqProd, 4);
      }
      w.decimal('vCOFINS', cofins.vCOFINS);
      w.fecha('COFINSOutr');
      break;
  }
  w.fecha('COFINS');
}

function serializaIbsCbsSel(w: EscritorXml, sel: IbsCbsSel): void {
  // Ordem conforme NT 2024.002 v1.10 (grupos UB02-UB83).
  w.abre('IBSCBSSel');
  if (sel.seletivo) serializaSeletivo(w, sel.seletivo);
  if (sel.cst) w.texto('CST', sel.cst);
  if (sel.cClassTrib) w.texto('cClassTrib', sel.cClassTrib);
  if (sel.indPerecimento) w.texto('indPerecimento', sel.indPerecimento);

  const g = sel.gIBSCBS;
  w.abre('gIBSCBS');
  w.decimal('vBC', g.vBC);
  w.abre('gIBSUF');
  w.decimal('pIBSUF', g.gIBSUF.pIBSUF);
  if (g.gIBSUF.vTribOP !== undefined || g.gIBSUF.gDif || g.gIBSUF.gDevTrib) {
    if (g.gIBSUF.vTribOP !== undefined) w.decimal('vTribOP', g.gIBSUF.vTribOP);
    if (g.gIBSUF.gDif) {
      w.abre('gDif');
      w.decimal('pDif', g.gIBSUF.gDif.pDif);
      w.decimal('vDif', g.gIBSUF.gDif.vDif);
      w.fecha('gDif');
    }
    if (g.gIBSUF.gDevTrib) {
      w.abre('gDevTrib');
      w.decimal('vDevTrib', g.gIBSUF.gDevTrib.vDevTrib);
      w.fecha('gDevTrib');
    }
  }
  if (g.gIBSUF.gRed) {
    w.abre('gRed');
    w.decimal('pRedAliq', g.gIBSUF.gRed.pRedAliq);
    w.decimal('pAliqEfet', g.gIBSUF.gRed.pAliqEfet);
    w.fecha('gRed');
  }
  if (g.gIBSUF.gDeson) serializaDeson(w, g.gIBSUF.gDeson);
  w.decimal('vIBSUF', g.gIBSUF.vIBSUF);
  w.fecha('gIBSUF');

  w.abre('gIBSMun');
  w.decimal('pIBSMun', g.gIBSMun.pIBSMun);
  if (g.gIBSMun.vTribOP !== undefined || g.gIBSMun.gDif || g.gIBSMun.gDevTrib) {
    if (g.gIBSMun.vTribOP !== undefined) w.decimal('vTribOP', g.gIBSMun.vTribOP);
    if (g.gIBSMun.gDif) {
      w.abre('gDif');
      w.decimal('pDif', g.gIBSMun.gDif.pDif);
      w.decimal('vDif', g.gIBSMun.gDif.vDif);
      w.fecha('gDif');
    }
    if (g.gIBSMun.gDevTrib) {
      w.abre('gDevTrib');
      w.decimal('vDevTrib', g.gIBSMun.gDevTrib.vDevTrib);
      w.fecha('gDevTrib');
    }
  }
  if (g.gIBSMun.gRed) {
    w.abre('gRed');
    w.decimal('pRedAliq', g.gIBSMun.gRed.pRedAliq);
    w.decimal('pAliqEfet', g.gIBSMun.gRed.pAliqEfet);
    w.fecha('gRed');
  }
  if (g.gIBSMun.gDeson) serializaDeson(w, g.gIBSMun.gDeson);
  w.decimal('vIBSMun', g.gIBSMun.vIBSMun);
  w.fecha('gIBSMun');

  if (g.gIBSCredPres) {
    w.abre('gIBSCredPres');
    w.texto('cCredPres', g.gIBSCredPres.cCredPres);
    w.decimal('pCredPres', g.gIBSCredPres.pCredPres);
    w.decimal('vCredPres', g.gIBSCredPres.vCredPres);
    w.decimal('vCredPresCondSus', g.gIBSCredPres.vCredPresCondSus);
    w.fecha('gIBSCredPres');
  }

  w.abre('gCBS');
  w.decimal('pCBS', g.gCBS.pCBS);
  if (g.gCBS.vTribOp !== undefined || g.gCBS.gCBSCredPres || g.gCBS.gDif || g.gCBS.gDevTrib) {
    if (g.gCBS.vTribOp !== undefined) w.decimal('vTribOp', g.gCBS.vTribOp);
    if (g.gCBS.gCBSCredPres) {
      w.abre('gCBSCredPres');
      w.texto('cCredPres', g.gCBS.gCBSCredPres.cCredPres);
      w.decimal('pCredPres', g.gCBS.gCBSCredPres.pCredPres);
      w.decimal('vCredPres', g.gCBS.gCBSCredPres.vCredPres);
      w.decimal('vCredPresCondSus', g.gCBS.gCBSCredPres.vCredPresCondSus);
      w.fecha('gCBSCredPres');
    }
    if (g.gCBS.gDif) {
      w.abre('gDif');
      w.decimal('pDif', g.gCBS.gDif.pDif);
      w.decimal('vDif', g.gCBS.gDif.vDif);
      w.fecha('gDif');
    }
    if (g.gCBS.gDevTrib) {
      w.abre('gDevTrib');
      w.decimal('vDevTrib', g.gCBS.gDevTrib.vDevTrib);
      w.fecha('gDevTrib');
    }
  }
  if (g.gCBS.gRed) {
    w.abre('gRed');
    w.decimal('pRedAliq', g.gCBS.gRed.pRedAliq);
    w.decimal('pAliqEfet', g.gCBS.gRed.pAliqEfet);
    w.fecha('gRed');
  }
  if (g.gCBS.gDeson) serializaDeson(w, g.gCBS.gDeson);
  w.decimal('vCBS', g.gCBS.vCBS);
  w.fecha('gCBS');

  w.fecha('gIBSCBS');
  w.fecha('IBSCBSSel');
}

function serializaSeletivo(w: EscritorXml, sel: Seletivo): void {
  w.abre('seletivo');
  w.texto('CST', sel.cst);
  w.texto('cClassTrib', sel.cClassTrib);
  if (sel.gImpSel) {
    w.abre('gImpSel');
    w.decimal('vBCImpSel', sel.gImpSel.vBCImpSel);
    w.decimal('pImpSel', sel.gImpSel.pImpSel);
    w.decimal('pImpSelEspec', sel.gImpSel.pImpSelEspec);
    if (sel.gImpSel.uTrib) w.texto('uTrib', sel.gImpSel.uTrib);
    w.decimal('qTrib', sel.gImpSel.qTrib, 4);
    w.decimal('vImpSel', sel.gImpSel.vImpSel);
    w.fecha('gImpSel');
  }
  w.fecha('seletivo');
}

function serializaDeson(w: EscritorXml, d: GDeson): void {
  w.abre('gDeson');
  if (d.cst) w.texto('CST', d.cst);
  if (d.cClassTrib) w.texto('cClassTrib', d.cClassTrib);
  w.decimal('vBC', d.vBC);
  w.decimal('pAliq', d.pAliq);
  w.decimal('vDeson', d.vDeson);
  w.fecha('gDeson');
}

function serializaTotal(w: EscritorXml, total: Total): void {
  w.abre('total');
  const t = total.icmsTot;
  w.abre('ICMSTot');
  w.decimal('vBC', t.vBC);
  w.decimal('vICMS', t.vICMS);
  w.decimal('vICMSDeson', t.vICMSDeson);
  w.decimal('vFCPUFDest', t.vFCPUFDest);
  w.decimal('vICMSUFDest', t.vICMSUFDest);
  w.decimal('vICMSUFRemet', t.vICMSUFRemet);
  w.decimal('vFCP', t.vFCP);
  w.decimal('vBCST', t.vBCST);
  w.decimal('vST', t.vST);
  w.decimal('vFCPST', t.vFCPST);
  w.decimal('vFCPSTRet', t.vFCPSTRet);
  w.decimal('qBCMono', t.qBCMono, 4);
  w.decimal('vICMSMono', t.vICMSMono);
  w.decimal('qBCMonoReten', t.qBCMonoReten, 4);
  w.decimal('vICMSMonoReten', t.vICMSMonoReten);
  w.decimal('qBCMonoRet', t.qBCMonoRet, 4);
  w.decimal('vICMSMonoRet', t.vICMSMonoRet);
  w.decimal('vProd', t.vProd);
  w.decimal('vFrete', t.vFrete);
  w.decimal('vSeg', t.vSeg);
  w.decimal('vDesc', t.vDesc);
  w.decimal('vII', t.vII);
  w.decimal('vIPI', t.vIPI);
  w.decimal('vIPIDevol', t.vIPIDevol);
  w.decimal('vPIS', t.vPIS);
  w.decimal('vCOFINS', t.vCOFINS);
  w.decimal('vOutro', t.vOutro);
  w.decimal('vNF', t.vNF);
  w.decimal('vTotTrib', t.vTotTrib);
  w.fecha('ICMSTot');

  if (total.issqnTot) {
    const i = total.issqnTot;
    w.abre('ISSQNtot');
    w.decimal('vServ', i.vServ);
    w.decimal('vBC', i.vBC);
    w.decimal('vISS', i.vISS);
    w.decimal('vPIS', i.vPIS);
    w.decimal('vCOFINS', i.vCOFINS);
    w.texto('dCompet', i.dCompet);
    w.decimal('vDeducao', i.vDeducao);
    w.decimal('vOutro', i.vOutro);
    w.decimal('vDescIncond', i.vDescIncond);
    w.decimal('vDescCond', i.vDescCond);
    w.decimal('vISSRet', i.vISSRet);
    if (i.cRegTrib !== undefined) w.texto('cRegTrib', i.cRegTrib);
    w.fecha('ISSQNtot');
  }
  if (total.retTrib) {
    const r = total.retTrib;
    w.abre('retTrib');
    w.decimal('vRetPIS', r.vRetPIS);
    w.decimal('vRetCOFINS', r.vRetCOFINS);
    w.decimal('vRetCSLL', r.vRetCSLL);
    w.decimal('vBCIRRF', r.vBCIRRF);
    w.decimal('vIRRF', r.vIRRF);
    w.decimal('vBCRetPrev', r.vBCRetPrev);
    w.decimal('vRetPrev', r.vRetPrev);
    w.fecha('retTrib');
  }
  if (total.ibscbsSelTot) {
    const b = total.ibscbsSelTot;
    w.abre('IBSCBSSelTot');
    if (b.gSel) {
      w.abre('gSel');
      w.decimal('vBCSel', b.gSel.vBCSel);
      w.decimal('vImpSel', b.gSel.vImpSel);
      w.fecha('gSel');
    }
    w.decimal('vBCIBSCBS', b.vBCIBSCBS);
    w.abre('gIBS');
    w.abre('gIBSUFTot');
    w.decimal('vDif', b.gIBS.gIBSUFTot.vDif);
    w.decimal('vDevTrib', b.gIBS.gIBSUFTot.vDevTrib);
    w.decimal('vDeson', b.gIBS.gIBSUFTot.vDeson);
    w.decimal('vIBSUF', b.gIBS.gIBSUFTot.vIBSUF);
    w.fecha('gIBSUFTot');
    w.abre('gIBSMunTot');
    w.decimal('vDif', b.gIBS.gIBSMunTot.vDif);
    w.decimal('vDevTrib', b.gIBS.gIBSMunTot.vDevTrib);
    w.decimal('vDeson', b.gIBS.gIBSMunTot.vDeson);
    w.decimal('vIBSMun', b.gIBS.gIBSMunTot.vIBSMun);
    w.decimal('vIBSTot', b.gIBS.gIBSMunTot.vIBSTot);
    w.fecha('gIBSMunTot');
    w.decimal('vCresPres', b.gIBS.vCresPres);
    w.decimal('vCredPresCondSus', b.gIBS.vCredPresCondSus);
    w.fecha('gIBS');
    w.abre('gCBS');
    w.decimal('vDif', b.gCBS.vDif);
    w.decimal('vDevTrib', b.gCBS.vDevTrib);
    w.decimal('vDeson', b.gCBS.vDeson);
    w.decimal('vCBS', b.gCBS.vCBS);
    w.decimal('vCresPres', b.gCBS.vCresPres);
    w.decimal('vCredPresCondSus', b.gCBS.vCredPresCondSus);
    w.fecha('gCBS');
    w.fecha('IBSCBSSelTot');
  }
  w.fecha('total');
}

function serializaTransp(w: EscritorXml, transp: Transp): void {
  w.abre('transp');
  w.texto('modFrete', transp.modFrete);
  if (transp.transporta) {
    const t = transp.transporta;
    w.abre('transporta');
    if (t.cnpj) w.texto('CNPJ', t.cnpj);
    if (t.cpf) w.texto('CPF', t.cpf);
    if (t.xNome) w.texto('xNome', t.xNome);
    if (t.ie) w.texto('IE', t.ie);
    if (t.xEnder) w.texto('xEnder', t.xEnder);
    if (t.xMun) w.texto('xMun', t.xMun);
    if (t.uf) w.texto('UF', t.uf);
    w.fecha('transporta');
  }
  if (transp.retTransp) {
    const r: RetTransp = transp.retTransp;
    w.abre('retTransp');
    w.decimal('vServ', r.vServ);
    w.decimal('vBCRet', r.vBCRet);
    w.decimal('pICMSRet', r.pICMSRet);
    w.decimal('vICMSRet', r.vICMSRet);
    w.texto('CFOP', r.cfop);
    w.texto('cMunFG', r.cMunFG);
    w.fecha('retTransp');
  }
  if (transp.veicTransp) serializaVeiculo(w, 'veicTransp', transp.veicTransp);
  for (const r of transp.reboque) serializaVeiculo(w, 'reboque', r);
  if (transp.vagao) w.texto('vagao', transp.vagao);
  if (transp.balsa) w.texto('balsa', transp.balsa);
  for (const v of transp.vol) {
    w.abre('vol');
    if (v.qVol !== undefined) w.texto('qVol', v.qVol);
    if (v.esp) w.texto('esp', v.esp);
    if (v.marca) w.texto('marca', v.marca);
    if (v.nVol) w.texto('nVol', v.nVol);
    w.decimal('pesoL', v.pesoL, 3);
    w.decimal('pesoB', v.pesoB, 3);
    for (const l of v.lacres) {
      w.abre('lacres');
      w.texto('nLacre', l.nLacre);
      w.fecha('lacres');
    }
    w.fecha('vol');
  }
  w.fecha('transp');
}

function serializaVeiculo(w: EscritorXml, tag: string, v: Veiculo): void {
  w.abre(tag);
  w.texto('placa', v.placa);
  if (v.uf) w.texto('UF', v.uf);
  if (v.rntc) w.texto('RNTC', v.rntc);
  w.fecha(tag);
}

function serializaCobr(w: EscritorXml, cobr: Cobr): void {
  w.abre('cobr');
  if (cobr.fat) {
    const f: Fat = cobr.fat;
    w.abre('fat');
    if (f.nFat) w.texto('nFat', f.nFat);
    w.decimal('vOrig', f.vOrig);
    w.decimal('vDesc', f.vDesc);
    w.decimal('vLiq', f.vLiq);
    w.fecha('fat');
  }
  for (const d of cobr.dup) {
    w.abre('dup');
    if (d.nDup) w.texto('nDup', d.nDup);
    if (d.dVenc) w.texto('dVenc', d.dVenc);
    w.decimal('vDup', d.vDup);
    w.fecha('dup');
  }
  w.fecha('cobr');
}

function serializaPag(w: EscritorXml, pag: Pag): void {
  w.abre('pag');
  for (const d of pag.detPag) {
    w.abre('detPag');
    if (d.indPag !== undefined) w.texto('indPag', d.indPag);
    w.texto('tPag', d.tPag);
    if (d.xPag) w.texto('xPag', d.xPag);
    w.decimal('vPag', d.vPag);
    if (d.card) {
      const c: Card = d.card;
      w.abre('card');
      w.texto('tpIntegra', c.tpIntegra);
      if (c.cnpj) w.texto('CNPJ', c.cnpj);
      if (c.tBand) w.texto('tBand', c.tBand);
      if (c.cAut) w.texto('cAut', c.cAut);
      w.fecha('card');
    }
    w.fecha('detPag');
  }
  w.decimal('vTroco', pag.vTroco);
  w.fecha('pag');
}

function serializaInfAdic(w: EscritorXml, infAdic: InfAdic): void {
  w.abre('infAdic');
  if (infAdic.infAdFisco) w.texto('infAdFisco', infAdic.infAdFisco);
  if (infAdic.infCpl) w.texto('infCpl', infAdic.infCpl);
  for (const o of infAdic.obsCont ?? []) {
    w.abre('obsCont', { xCampo: o.xCampo });
    w.texto('xTexto', o.xTexto);
    w.fecha('obsCont');
  }
  for (const o of infAdic.obsFisco ?? []) {
    w.abre('obsFisco', { xCampo: o.xCampo });
    w.texto('xTexto', o.xTexto);
    w.fecha('obsFisco');
  }
  w.fecha('infAdic');
}

function serializaInfRespTec(w: EscritorXml, r: InfRespTec): void {
  w.abre('infRespTec');
  w.texto('CNPJ', r.cnpj);
  w.texto('xContato', r.xContato);
  w.texto('email', r.email);
  w.texto('fone', r.fone);
  if (r.idCSRT) w.texto('idCSRT', r.idCSRT);
  if (r.hashCSRT) w.texto('hashCSRT', r.hashCSRT);
  w.fecha('infRespTec');
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------

export interface OpcoesEvento {
  seed: string;
  chNFe: string;
  tpEvento: string;
  cnpjAutor?: string;
  cpfAutor?: string;
  tpAmb?: 1 | 2;
  nSeqEvento?: number;
  dhEvento?: string;
  /** Payload do detEvento por tipo de evento. */
  cancelamento?: { nProt: string; xJust: string };
  cce?: { xCorrecao: string };
  /** Processamento na SEFAZ (retEvento). */
  ret?: {
    cStat: number;
    xMotivo: string;
    nProt?: string;
    dhRegEvento?: string;
    xEvento?: string;
  };
}

/** Texto fixo das condições de uso da CC-e (literal do schema oficial). */
export const X_COND_USO_CCE =
  'A Carta de Correção é disciplinada pelo § 1º-A do art. 7º do Convênio S/N, de 15 de dezembro de 1970 e pode ser utilizada para regularização de erro ocorrido na emissão de documento fiscal, desde que o erro não esteja relacionado com: I - as variáveis que determinam o valor do imposto tais como: base de cálculo, alíquota, diferença de preço, quantidade, valor da operação ou da prestação; II - a correção de dados cadastrais que implique mudança do remetente ou do destinatário; III - a data de emissão ou de saída.';

/** Monta um `procEventoNFe` sintético (cancelamento ou CC-e). */
export function montaEvento(o: OpcoesEvento): ProcEventoNFe {
  const tpAmb = o.tpAmb ?? 1;
  const nSeq = o.nSeqEvento ?? 1;
  const dhEvento = o.dhEvento ?? dhEmiSintetico(`${o.seed}:evento`);
  const verEvento = '1.00';
  const id = `ID${o.tpEvento}${o.chNFe}${String(nSeq).padStart(2, '0')}`;

  let det: ProcEventoNFe['evento']['infEvento']['detEvento'];
  if (o.tpEvento === TP_EVENTO_CANCELAMENTO && o.cancelamento) {
    det = {
      tipo: TP_EVENTO_CANCELAMENTO,
      descEvento: 'Cancelamento',
      nProt: o.cancelamento.nProt,
      xJust: o.cancelamento.xJust,
    };
  } else if (o.tpEvento === TP_EVENTO_CCE && o.cce) {
    det = {
      tipo: TP_EVENTO_CCE,
      descEvento: 'Carta de Correção',
      xCorrecao: o.cce.xCorrecao,
      xCondUso: X_COND_USO_CCE,
    };
  } else {
    throw new Error(`Evento não suportado pela fábrica: tpEvento=${o.tpEvento}`);
  }

  const cnpj = o.cnpjAutor ?? cnpjSintetico(o.seed);
  const cStat = o.ret?.cStat ?? (o.tpEvento === TP_EVENTO_CANCELAMENTO ? 101 : 135);
  const xMotivo =
    o.ret?.xMotivo ??
    (o.tpEvento === TP_EVENTO_CANCELAMENTO
      ? 'Cancelamento de NF-e homologado'
      : 'Evento registrado e vinculado a NF-e');

  return {
    versao: '1.00',
    evento: {
      versao: '1.00',
      infEvento: {
        id,
        cOrgao: 35,
        tpAmb,
        cnpj,
        chNFe: o.chNFe,
        dhEvento,
        tpEvento: o.tpEvento,
        nSeqEvento: nSeq,
        verEvento,
        detEvento: det,
      },
    },
    retEvento: {
      versao: '1.00',
      infEvento: {
        tpAmb,
        verAplic: 'SVRS-2026',
        cOrgao: 35,
        cStat,
        xMotivo,
        chNFe: o.chNFe,
        tpEvento: o.tpEvento,
        xEvento:
          o.ret?.xEvento ??
          (o.tpEvento === TP_EVENTO_CANCELAMENTO ? 'Cancelamento registrado' : 'Carta de Correção'),
        nSeqEvento: nSeq,
        cOrgaoAutor: 35,
        dhRegEvento: o.ret?.dhRegEvento ?? `${dhEvento.slice(0, 19)}-03:00`,
        nProt:
          o.ret?.nProt ?? `${deriva(`prot:${o.chNFe}:evento`, 1, 999999999)}`.padStart(15, '0'),
      },
    },
  };
}

/** Serializa um `procEventoNFe` (raiz conforme o tipo: genérico/canc/CC-e). */
export function eventoToXml(proc: ProcEventoNFe): string {
  const tp = proc.evento.infEvento.tpEvento;
  const raiz =
    tp === TP_EVENTO_CANCELAMENTO
      ? 'procEventoCancNFe'
      : tp === TP_EVENTO_CCE
        ? 'procCCeNFe'
        : 'procEventoNFe';
  const w = new EscritorXml();
  w.prologo();
  w.abre(raiz, {
    versao: '1.00',
    xmlns: 'http://www.portalfiscal.inf.br/nfe',
  });
  w.abre('evento', { versao: '1.00' });
  const inf = proc.evento.infEvento;
  w.abre('infEvento', { Id: inf.id ?? '' });
  w.texto('cOrgao', inf.cOrgao);
  w.texto('tpAmb', inf.tpAmb);
  if (inf.cnpj) w.texto('CNPJ', inf.cnpj);
  if (inf.cpf) w.texto('CPF', inf.cpf);
  w.texto('chNFe', inf.chNFe);
  w.texto('dhEvento', inf.dhEvento);
  w.texto('tpEvento', inf.tpEvento);
  w.texto('nSeqEvento', inf.nSeqEvento);
  w.texto('verEvento', inf.verEvento);
  w.abre('detEvento', { versao: inf.verEvento });
  const det = inf.detEvento;
  w.texto('descEvento', det.descEvento);
  if ('nProt' in det) {
    w.texto('nProt', det.nProt);
    w.texto('xJust', det.xJust);
  } else if ('xCorrecao' in det) {
    w.texto('xCorrecao', det.xCorrecao);
    w.texto('xCondUso', det.xCondUso);
  } else {
    for (const [k, v] of Object.entries(det.campos)) {
      if (typeof v === 'string') w.texto(k, v);
    }
  }
  w.fecha('detEvento');
  w.fecha('infEvento');
  w.fecha('evento');

  const ret = proc.retEvento.infEvento;
  w.abre('retEvento', { versao: '1.00' });
  w.abre('infEvento', { Id: ret.id ?? '' });
  w.texto('tpAmb', ret.tpAmb);
  w.texto('verAplic', ret.verAplic);
  w.texto('cOrgao', ret.cOrgao);
  w.texto('cStat', ret.cStat);
  w.texto('xMotivo', ret.xMotivo);
  if (ret.chNFe) w.texto('chNFe', ret.chNFe);
  if (ret.tpEvento) w.texto('tpEvento', ret.tpEvento);
  if (ret.xEvento) w.texto('xEvento', ret.xEvento);
  if (ret.nSeqEvento !== undefined) w.texto('nSeqEvento', ret.nSeqEvento);
  if (ret.cOrgaoAutor !== undefined) w.texto('cOrgaoAutor', ret.cOrgaoAutor);
  if (ret.emailDest) w.texto('emailDest', ret.emailDest);
  if (ret.dhRegEvento) w.texto('dhRegEvento', ret.dhRegEvento);
  if (ret.nProt) w.texto('nProt', ret.nProt);
  w.fecha('infEvento');
  w.fecha('retEvento');
  w.fecha(raiz);
  return w.construir();
}

/** Reexportações úteis para consumidores da fábrica. */
export { escapaXml, fmt };
