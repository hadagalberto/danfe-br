/**
 * Parser XML → modelo tipado para `nfeProc` e `NFe` (layout 4.00).
 *
 * Fonte estrutural: `schemas/PL_009q_NT2025_001_v1.00/leiauteNFe_v4.00.xsd`
 * (elementos, escolhas e obrigatoriedade) e MOC 7.0 — Anexo I (descrições).
 *
 * O parser é tolerante por natureza de leitura: campos opcionais ausentes
 * viram `undefined`; grupos repetidos ausentes viram arrays vazios. Campos
 * com conteúdo fora do padrão (ex.: decimal malformado) viram `undefined` —
 * a validação estrutural (`validateNFe`) reporta o problema; o parser só lança
 * `ParseError` quando um campo obrigatório para a composição do documento
 * (chave, ide, emit, total) está ausente.
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
  GCred,
  GCredPres,
  GDeson,
  GDevTrib,
  GigaDif,
  GIbsMun,
  GIbsUf,
  GRed,
  GCbs,
  IbsCbsSel,
  IbsCbsSelTot,
  Icms,
  IcmsUfDest,
  Ide,
  Imposto,
  ImpostoDevol,
  InfAdic,
  InfNFeSupl,
  InfRespTec,
  Issqn,
  IssqnTot,
  NFe,
  NFeProc,
  ObsItem,
  Pag,
  Pis,
  Prod,
  ProtNFe,
  RetTrib,
  Seletivo,
  Total,
  Transp,
  Veiculo,
  Vol,
} from '../model/nfe';
import type { FinNFe } from '../model/comum';
import {
  arr,
  attr,
  bit,
  int,
  node,
  num,
  ParseError,
  parseXml,
  requer,
  requerNode,
  txt,
  type XNode,
} from './xml';

/** Faz o parse de um XML `nfeProc` ou `NFe` (com ou sem protocolo). */
export function parseNFe(xml: string): NFeProc {
  const raiz = parseXml(xml);
  const proc = node(raiz['nfeProc']);
  if (proc) {
    return parseNfeProc(proc);
  }
  const nfeNode = node(raiz['NFe']);
  if (nfeNode) {
    return {
      versao: '4.00',
      nfe: parseInfNFe(requerNode(nfeNode['infNFe'], 'infNFe', 'NFe'), 'NFe'),
      protNFe: undefined,
    };
  }
  throw new ParseError('Documento não reconhecido: esperado elemento raiz nfeProc ou NFe', 'raiz');
}

function parseNfeProc(proc: XNode): NFeProc {
  const nfeNode = requerNode(proc['NFe'], 'NFe', 'nfeProc');
  const result: NFeProc = {
    versao: attr(proc, 'versao') ?? '4.00',
    nfe: parseInfNFe(requerNode(nfeNode['infNFe'], 'infNFe', 'nfeProc/NFe'), 'nfeProc/NFe'),
    protNFe: undefined,
  };
  const protNode = node(proc['protNFe']);
  if (protNode) {
    const infProt = node(protNode['infProt']);
    if (infProt) {
      result.protNFe = parseProtNFe(infProt);
    }
  }
  return result;
}

function parseProtNFe(infProt: XNode): ProtNFe {
  return {
    tpAmb: requer(int(infProt['tpAmb']), 'tpAmb', 'protNFe/infProt') as 1 | 2,
    verAplic: requer(txt(infProt['verAplic']), 'verAplic', 'protNFe/infProt'),
    chNFe: requer(txt(infProt['chNFe']), 'chNFe', 'protNFe/infProt'),
    dhRecbto: requer(txt(infProt['dhRecbto']), 'dhRecbto', 'protNFe/infProt'),
    nProt: txt(infProt['nProt']),
    cStat: requer(int(infProt['cStat']), 'cStat', 'protNFe/infProt'),
    xMotivo: requer(txt(infProt['xMotivo']), 'xMotivo', 'protNFe/infProt'),
  };
}

function parseInfNFe(infNFe: XNode, contexto: string): NFe {
  const idAttr = attr(infNFe, 'Id') ?? '';
  const chave = idAttr.startsWith('NFe') ? idAttr.slice(3) : idAttr;

  const ide = parseIde(requerNode(infNFe['ide'], 'ide', contexto), contexto);
  const emit = parseEmit(requerNode(infNFe['emit'], 'emit', contexto), contexto);
  const total = parseTotal(requerNode(infNFe['total'], 'total', contexto), contexto);
  const transp = parseTransp(requerNode(infNFe['transp'], 'transp', contexto), contexto);
  const pagNode = node(infNFe['pag']);
  const pag: Pag = pagNode ? parsePag(pagNode, contexto) : { detPag: [], vTroco: undefined };

  const det = arr(infNFe['det']).map((d, i) =>
    parseDet(requerNode(d, 'det', contexto), contexto, i),
  );

  const suplNode = node(infNFe['infNFeSupl']);
  const infNFeSupl: InfNFeSupl | undefined = suplNode
    ? {
        qrCode: requer(txt(suplNode['qrCode']), 'qrCode', `${contexto}/infNFeSupl`),
        urlChave: requer(txt(suplNode['urlChave']), 'urlChave', `${contexto}/infNFeSupl`),
      }
    : undefined;

  return {
    versao: attr(infNFe, 'versao') ?? '4.00',
    chave,
    ide,
    emit,
    dest: optional(infNFe['dest'], (n) => parseDest(n, `${contexto}/dest`)),
    det,
    total,
    transp,
    cobr: optional(infNFe['cobr'], (n) => parseCobr(n, `${contexto}/cobr`)),
    pag,
    infAdic: optional(infNFe['infAdic'], parseInfAdic),
    infRespTec: optional(infNFe['infRespTec'], (n) => parseInfRespTec(n, `${contexto}/infRespTec`)),
    autXml: arr(infNFe['autXML'])
      .map((a) => node(a))
      .filter((a): a is XNode => a !== undefined)
      .map((a) => parseAutXml(a)),
    infNFeSupl,
  };
}

/** Aplica `f` quando o valor existe; senão `undefined` (grupos 0-1). */
function optional<T>(v: unknown, f: (n: XNode) => T): T | undefined {
  const n = node(v);
  return n === undefined ? undefined : f(n);
}

// ---------------------------------------------------------------------------
// ide
// ---------------------------------------------------------------------------

function parseIde(ide: XNode, contexto: string): Ide {
  const c = `${contexto}/ide`;
  const nfRef: Ide['nfRef'] = [];
  const refNode = node(ide['NFref']);
  for (const r of refNode ? arr(refNode) : []) {
    const rn = node(r);
    if (!rn) continue;
    const refNFe = txt(rn['refNFe']);
    if (refNFe !== undefined) {
      nfRef.push({ refNFe });
      continue;
    }
    const refNF = node(rn['refNF']);
    if (refNF) {
      nfRef.push({
        refNF: {
          cUF: requer(int(refNF['cUF']), 'cUF', 'NFref/refNF'),
          aamm: requer(txt(refNF['AAMM']), 'AAMM', 'NFref/refNF'),
          cnpj: requer(txt(refNF['CNPJ']), 'CNPJ', 'NFref/refNF'),
          mod: requer(txt(refNF['mod']), 'mod', 'NFref/refNF'),
          serie: requer(int(refNF['serie']), 'serie', 'NFref/refNF'),
          nNF: requer(int(refNF['nNF']), 'nNF', 'NFref/refNF'),
        },
      });
      continue;
    }
    const refCTe = txt(rn['refCTe']);
    if (refCTe !== undefined) {
      nfRef.push({ refCTe });
      continue;
    }
    const refNFP = node(rn['refNFP']);
    if (refNFP) {
      nfRef.push({
        refNFP: {
          cUF: int(refNFP['cUF']) ?? 0,
          cnpj: txt(refNFP['CNPJ']),
          cpf: txt(refNFP['CPF']),
          ie: txt(refNFP['IE']),
          mod: txt(refNFP['mod']) ?? '',
          serie: int(refNFP['serie']) ?? 0,
          nNF: int(refNFP['nNF']) ?? 0,
          refNFP: int(refNFP['refNFP']),
        },
      });
      continue;
    }
    const refECF = node(rn['refECF']);
    if (refECF) {
      nfRef.push({
        refECF: {
          mod: txt(refECF['mod']) ?? '',
          nECF: txt(refECF['nECF']) ?? '',
          nCOO: txt(refECF['nCOO']) ?? '',
        },
      });
    }
  }

  return {
    cUF: requer(int(ide['cUF']), 'cUF', c),
    cNF: requer(txt(ide['cNF']), 'cNF', c),
    natOp: requer(txt(ide['natOp']), 'natOp', c),
    mod: requer(int(ide['mod']), 'mod', c) as 55 | 65,
    serie: requer(int(ide['serie']), 'serie', c),
    nNF: requer(int(ide['nNF']), 'nNF', c),
    dhEmi: requer(txt(ide['dhEmi']), 'dhEmi', c),
    dhSaiEnt: txt(ide['dhSaiEnt']),
    tpNF: requer(int(ide['tpNF']), 'tpNF', c) as 0 | 1,
    idDest: requer(int(ide['idDest']), 'idDest', c) as Ide['idDest'],
    cMunFG: requer(int(ide['cMunFG']), 'cMunFG', c),
    tpImp: requer(int(ide['tpImp']), 'tpImp', c) as Ide['tpImp'],
    tpEmis: requer(int(ide['tpEmis']), 'tpEmis', c) as Ide['tpEmis'],
    cDV: requer(int(ide['cDV']), 'cDV', c),
    tpAmb: requer(int(ide['tpAmb']), 'tpAmb', c) as 1 | 2,
    finNFe: requer(int(ide['finNFe']), 'finNFe', c) as FinNFe,
    indFinal: requer(bit(ide['indFinal']), 'indFinal', c),
    indPres: requer(int(ide['indPres']), 'indPres', c) as Ide['indPres'],
    indIntermed: bit(ide['indIntermed']),
    procEmi: requer(int(ide['procEmi']), 'procEmi', c) as Ide['procEmi'],
    verProc: requer(txt(ide['verProc']), 'verProc', c),
    dhCont: txt(ide['dhCont']),
    xJust: txt(ide['xJust']),
    nfRef,
  };
}

// ---------------------------------------------------------------------------
// emit / dest
// ---------------------------------------------------------------------------

function parseEndereco(n: XNode): NonNullable<Dest['enderDest']> {
  return {
    xLgr: txt(n['xLgr']) ?? '',
    nro: txt(n['nro']) ?? '',
    xCpl: txt(n['xCpl']),
    xBairro: txt(n['xBairro']) ?? '',
    cMun: int(n['cMun']) ?? 0,
    xMun: txt(n['xMun']) ?? '',
    uf: txt(n['UF']) ?? '',
    cep: txt(n['CEP']),
    cPais: int(n['cPais']),
    xPais: txt(n['xPais']),
    fone: txt(n['fone']),
  };
}

function parseEmit(emit: XNode, contexto: string): Emit {
  const c = `${contexto}/emit`;
  const ender = requerNode(emit['enderEmit'], 'enderEmit', c);
  return {
    cnpj: txt(emit['CNPJ']),
    cpf: txt(emit['CPF']),
    xNome: requer(txt(emit['xNome']), 'xNome', c),
    xFant: txt(emit['xFant']),
    enderEmit: parseEndereco(ender),
    ie: requer(txt(emit['IE']), 'IE', c),
    iest: txt(emit['IEST']),
    im: txt(emit['IM']),
    cnae: txt(emit['CNAE']),
    crt: requer(int(emit['CRT']), 'CRT', c) as Emit['crt'],
  };
}

function parseDest(dest: XNode, contexto: string): Dest {
  return {
    cnpj: txt(dest['CNPJ']),
    cpf: txt(dest['CPF']),
    idEstrangeiro: txt(dest['idEstrangeiro']),
    xNome: txt(dest['xNome']),
    enderDest: optional(dest['enderDest'], parseEndereco),
    indIEDest: requer(int(dest['indIEDest']), 'indIEDest', contexto) as Dest['indIEDest'],
    ie: txt(dest['IE']),
    isuf: txt(dest['ISUF']),
    im: txt(dest['IM']),
    email: txt(dest['email']),
  };
}

// ---------------------------------------------------------------------------
// det / prod / imposto
// ---------------------------------------------------------------------------

function parseDet(det: XNode, contexto: string, indice: number): Det {
  const c = `${contexto}/det[${indice}]`;
  const prod = parseProd(requerNode(det['prod'], 'prod', c), c);
  const imposto = parseImposto(requerNode(det['imposto'], 'imposto', c), c);

  const impostoDevolNode = node(det['impostoDevol']);
  const impostoDevol: ImpostoDevol | undefined = impostoDevolNode
    ? {
        pDevol: num(impostoDevolNode['pDevol']) ?? 0,
        ipiDevol: {
          vIPIDevol: num(node(impostoDevolNode['IPI'])?.['vIPIDevol']) ?? 0,
        },
      }
    : undefined;

  const obsItemNode = node(det['obsItem']);
  const obsItem: ObsItem | undefined = obsItemNode
    ? {
        obsCont: parseObservacoes(obsItemNode['obsCont']),
        obsFisco: parseObservacoes(obsItemNode['obsFisco']),
      }
    : undefined;

  return {
    nItem: int(attr(det, 'nItem')) ?? indice + 1,
    prod,
    imposto,
    impostoDevol,
    infAdProd: txt(det['infAdProd']),
    obsItem,
  };
}

function parseObservacoes(v: unknown): { xCampo: string; xTexto: string }[] | undefined {
  const lista = arr(v);
  if (lista.length === 0) return undefined;
  return lista.map((o) => {
    const n = node(o);
    return {
      xCampo: attr(n, 'xCampo') ?? '',
      xTexto: txt(n?.['xTexto']) ?? '',
    };
  });
}

function parseProd(prod: XNode, c: string): Prod {
  const gCred: GCred[] = arr(prod['gCred'])
    .map((g) => node(g))
    .filter((g): g is XNode => g !== undefined)
    .map((g) => ({
      cCredPresumido: txt(g['cCredPresumido']) ?? '',
      pCredPresumido: num(g['pCredPresumido']) ?? 0,
      vCredPresumido: num(g['vCredPresumido']) ?? 0,
    }));

  return {
    cProd: requer(txt(prod['cProd']), 'cProd', `${c}/prod`),
    cEAN: txt(prod['cEAN']) ?? 'SEM GTIN',
    cBarra: txt(prod['cBarra']),
    xProd: requer(txt(prod['xProd']), 'xProd', `${c}/prod`),
    ncm: txt(prod['NCM']) ?? '',
    nve: arr(prod['NVE'])
      .map((v) => txt(v))
      .filter((v): v is string => v !== undefined),
    cest: txt(prod['CEST']),
    indEscala: bit(prod['indEscala']),
    cnpjFab: txt(prod['CNPJFab']),
    cBenef: txt(prod['cBenef']),
    gCred,
    extIpi: txt(prod['EXTIPI']),
    cfop: requer(txt(prod['CFOP']), 'CFOP', `${c}/prod`),
    uCom: requer(txt(prod['uCom']), 'uCom', `${c}/prod`),
    qCom: num(prod['qCom']) ?? 0,
    vUnCom: num(prod['vUnCom']) ?? 0,
    vProd: num(prod['vProd']) ?? 0,
    cEANTrib: txt(prod['cEANTrib']) ?? 'SEM GTIN',
    cBarraTrib: txt(prod['cBarraTrib']),
    uTrib: txt(prod['uTrib']) ?? '',
    qTrib: num(prod['qTrib']) ?? 0,
    vUnTrib: num(prod['vUnTrib']) ?? 0,
    vFrete: num(prod['vFrete']),
    vSeg: num(prod['vSeg']),
    vDesc: num(prod['vDesc']),
    vOutro: num(prod['vOutro']),
    indTot: bit(prod['indTot']) ?? 1,
    xPed: txt(prod['xPed']),
    nItemPed: int(prod['nItemPed']),
  };
}

function parseImposto(imposto: XNode, c: string): Imposto {
  const icms = parseIcms(node(imposto['ICMS']), c);
  const ipi = optional(imposto['IPI'], (n) => parseIpi(n, c));
  const iiNode = node(imposto['II']);
  const issqnNode = node(imposto['ISSQN']);

  return {
    vTotTrib: num(imposto['vTotTrib']),
    icms,
    ipi,
    ii: iiNode
      ? {
          vBC: num(iiNode['vBC']) ?? 0,
          vDespAdu: num(iiNode['vDespAdu']) ?? 0,
          vII: num(iiNode['vII']) ?? 0,
          vIOF: num(iiNode['vIOF']) ?? 0,
        }
      : undefined,
    issqn: issqnNode ? parseIssqn(issqnNode) : undefined,
    pis: optional(imposto['PIS'], parsePis),
    pisst: optional(imposto['PISST'], (n) => ({ vPIS: num(n['vPIS']) ?? 0 })),
    cofins: optional(imposto['COFINS'], parseCofins),
    cofinsst: optional(imposto['COFINSST'], (n) => ({
      vCOFINS: num(n['vCOFINS']) ?? 0,
    })),
    icmsUfDest: optional(imposto['ICMSUFDest'], parseIcmsUfDest),
    ibscbsSel: optional(imposto['IBSCBSSel'], parseIbsCbsSel),
  };
}

function parseIssqn(issqn: XNode): Issqn {
  return {
    vBC: num(issqn['vBC']) ?? 0,
    vAliq: num(issqn['vAliq']) ?? 0,
    vISSQN: num(issqn['vISSQN']) ?? 0,
    cMunFG: int(issqn['cMunFG']) ?? 0,
    cListServ: txt(issqn['cListServ']) ?? '',
    vDeducao: num(issqn['vDeducao']),
    vOutro: num(issqn['vOutro']),
    vDescIncond: num(issqn['vDescIncond']),
    vDescCond: num(issqn['vDescCond']),
    vISSRet: num(issqn['vISSRet']),
    indISS: (int(issqn['indISS']) ?? 1) as Issqn['indISS'],
    cServico: txt(issqn['cServico']),
    cMun: int(issqn['cMun']),
    cPais: txt(issqn['cPais']),
    nProcesso: txt(issqn['nProcesso']),
    indIncentivo: (bit(issqn['indIncentivo']) ?? 2) as Issqn['indIncentivo'],
  };
}

// --- ICMS -------------------------------------------------------------------

const GRUPOS_ICMS = [
  'ICMS00',
  'ICMS02',
  'ICMS10',
  'ICMS15',
  'ICMS20',
  'ICMS30',
  'ICMS40',
  'ICMS51',
  'ICMS53',
  'ICMS60',
  'ICMS61',
  'ICMS70',
  'ICMS90',
  'ICMSPart',
  'ICMSST',
  'ICMSSN101',
  'ICMSSN102',
  'ICMSSN201',
  'ICMSSN202',
  'ICMSSN500',
  'ICMSSN900',
] as const;

function parseIcms(icmsNode: XNode | undefined, c: string): Icms | undefined {
  if (!icmsNode) return undefined;
  for (const grupo of GRUPOS_ICMS) {
    const n = node(icmsNode[grupo]);
    if (!n) continue;
    return parseIcmsGrupo(grupo, n, c);
  }
  return undefined;
}

function cst(n: XNode, campo = 'CST'): string {
  return txt(n[campo]) ?? '';
}

function origem(n: XNode): 0 | 1 | 2 | 3 | 4 | 5 | 6 | undefined {
  return int(n['orig']) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | undefined;
}

function parseIcmsGrupo(grupo: string, n: XNode, c: string): Icms {
  const ctx = `${c}/imposto/ICMS/${grupo}`;
  switch (grupo) {
    case 'ICMS00':
      return {
        grupo: 'ICMS00',
        orig: origem(n) ?? 0,
        cst: cst(n) as '00',
        modBC: (int(n['modBC']) ?? 0) as 0 | 1 | 2 | 3,
        vBC: num(n['vBC']) ?? 0,
        pICMS: num(n['pICMS']) ?? 0,
        vICMS: num(n['vICMS']) ?? 0,
        pFCP: num(n['pFCP']),
        vFCP: num(n['vFCP']),
      };
    case 'ICMS02':
      return {
        grupo: 'ICMS02',
        orig: origem(n) ?? 0,
        cst: cst(n) as '02',
        qBCMono: num(n['qBCMono']),
        adRemICMS: num(n['adRemICMS']) ?? 0,
        vICMSMono: num(n['vICMSMono']) ?? 0,
      };
    case 'ICMS10':
      return {
        grupo: 'ICMS10',
        orig: origem(n) ?? 0,
        cst: cst(n) as '10',
        modBC: (int(n['modBC']) ?? 0) as 0 | 1 | 2 | 3,
        vBC: num(n['vBC']) ?? 0,
        pICMS: num(n['pICMS']) ?? 0,
        vICMS: num(n['vICMS']) ?? 0,
        vBCFCP: num(n['vBCFCP']),
        pFCP: num(n['pFCP']),
        vFCP: num(n['vFCP']),
        modBCST: (int(n['modBCST']) ?? 0) as 0 | 1 | 2 | 3,
        pMVAST: num(n['pMVAST']),
        pRedBCST: num(n['pRedBCST']),
        vBCST: num(n['vBCST']) ?? 0,
        pICMSST: num(n['pICMSST']) ?? 0,
        vICMSST: num(n['vICMSST']) ?? 0,
        vBCFCPST: num(n['vBCFCPST']),
        pFCPST: num(n['pFCPST']),
        vFCPST: num(n['vFCPST']),
      };
    case 'ICMS15':
      return {
        grupo: 'ICMS15',
        orig: origem(n) ?? 0,
        cst: cst(n) as '15',
        qBCMono: num(n['qBCMono']),
        adRemICMS: num(n['adRemICMS']) ?? 0,
        vICMSMono: num(n['vICMSMono']) ?? 0,
        qBCMonoReten: num(n['qBCMonoReten']),
        adRemICMSReten: num(n['adRemICMSReten']) ?? 0,
        vICMSMonoReten: num(n['vICMSMonoReten']) ?? 0,
      };
    case 'ICMS20':
      return {
        grupo: 'ICMS20',
        orig: origem(n) ?? 0,
        cst: cst(n) as '20',
        modBC: (int(n['modBC']) ?? 0) as 0 | 1 | 2 | 3,
        pRedBC: num(n['pRedBC']) ?? 0,
        vBC: num(n['vBC']) ?? 0,
        pICMS: num(n['pICMS']) ?? 0,
        vICMS: num(n['vICMS']) ?? 0,
        vBCFCP: num(n['vBCFCP']),
        pFCP: num(n['pFCP']),
        vFCP: num(n['vFCP']),
      };
    case 'ICMS30':
      return {
        grupo: 'ICMS30',
        orig: origem(n) ?? 0,
        cst: cst(n) as '30',
        modBCST: (int(n['modBCST']) ?? 0) as 0 | 1 | 2 | 3,
        pMVAST: num(n['pMVAST']),
        pRedBCST: num(n['pRedBCST']),
        vBCST: num(n['vBCST']) ?? 0,
        pICMSST: num(n['pICMSST']) ?? 0,
        vICMSST: num(n['vICMSST']) ?? 0,
        vICMSDeson: num(n['vICMSDeson']),
        motDesICMS: int(n['motDesICMS']) as never,
      };
    case 'ICMS40':
      return {
        grupo: 'ICMS40',
        orig: origem(n) ?? 0,
        cst: cst(n) as '40' | '41' | '50',
        vICMSDeson: num(n['vICMSDeson']),
        motDesICMS: int(n['motDesICMS']) as never,
      };
    case 'ICMS51':
      return {
        grupo: 'ICMS51',
        orig: origem(n) ?? 0,
        cst: cst(n) as '51',
        modBC: int(n['modBC']) as 0 | 1 | 2 | 3 | undefined,
        pRedBC: num(n['pRedBC']),
        cBenefRBC: txt(n['cBenefRBC']),
        vBC: num(n['vBC']),
        pICMS: num(n['pICMS']),
        vICMSOp: num(n['vICMSOp']),
        pDif: num(n['pDif']),
        vICMSDif: num(n['vICMSDif']),
        vICMS: num(n['vICMS']),
      };
    case 'ICMS53':
      return {
        grupo: 'ICMS53',
        orig: origem(n) ?? 0,
        cst: cst(n) as '53',
        qBCMono: num(n['qBCMono']),
        adRemICMS: num(n['adRemICMS']),
        vICMSMonoOp: num(n['vICMSMonoOp']),
        pDif: num(n['pDif']),
        vICMSMonoDif: num(n['vICMSMonoDif']),
        vICMSMono: num(n['vICMSMono']),
        qBCMonoDif: num(n['qBCMonoDif']),
        adRemICMSDif: num(n['adRemICMSDif']),
      };
    case 'ICMS60':
      return {
        grupo: 'ICMS60',
        orig: origem(n) ?? 0,
        cst: cst(n) as '60',
        vBCSTRet: num(n['vBCSTRet']),
        pST: num(n['pST']),
        vICMSSubstituto: num(n['vICMSSubstituto']),
        vICMSSTRet: num(n['vICMSSTRet']),
        vBCFCPSTRet: num(n['vBCFCPSTRet']),
        pFCPSTRet: num(n['pFCPSTRet']),
        vFCPSTRet: num(n['vFCPSTRet']),
      };
    case 'ICMS61':
      return {
        grupo: 'ICMS61',
        orig: origem(n) ?? 0,
        cst: cst(n) as '61',
        qBCMonoRet: num(n['qBCMonoRet']),
        adRemICMSRet: num(n['adRemICMSRet']) ?? 0,
        vICMSMonoRet: num(n['vICMSMonoRet']) ?? 0,
      };
    case 'ICMS70':
      return {
        grupo: 'ICMS70',
        orig: origem(n) ?? 0,
        cst: cst(n) as '70',
        modBC: (int(n['modBC']) ?? 0) as 0 | 1 | 2 | 3,
        pRedBC: num(n['pRedBC']) ?? 0,
        vBC: num(n['vBC']) ?? 0,
        pICMS: num(n['pICMS']) ?? 0,
        vICMS: num(n['vICMS']) ?? 0,
        modBCST: (int(n['modBCST']) ?? 0) as 0 | 1 | 2 | 3,
        pMVAST: num(n['pMVAST']),
        pRedBCST: num(n['pRedBCST']),
        vBCST: num(n['vBCST']) ?? 0,
        pICMSST: num(n['pICMSST']) ?? 0,
        vICMSST: num(n['vICMSST']) ?? 0,
        vBCFCPST: num(n['vBCFCPST']),
        pFCPST: num(n['pFCPST']),
        vFCPST: num(n['vFCPST']),
      };
    case 'ICMS90':
      return {
        grupo: 'ICMS90',
        orig: origem(n) ?? 0,
        cst: cst(n) as '90',
        modBC: int(n['modBC']) as 0 | 1 | 2 | 3 | undefined,
        vBC: num(n['vBC']),
        pRedBC: num(n['pRedBC']),
        pICMS: num(n['pICMS']),
        vICMS: num(n['vICMS']),
        vBCFCP: num(n['vBCFCP']),
        pFCP: num(n['pFCP']),
        vFCP: num(n['vFCP']),
        modBCST: int(n['modBCST']) as 0 | 1 | 2 | 3 | undefined,
        pMVAST: num(n['pMVAST']),
        pRedBCST: num(n['pRedBCST']),
        vBCST: num(n['vBCST']),
        pICMSST: num(n['pICMSST']),
        vICMSST: num(n['vICMSST']),
        vBCFCPST: num(n['vBCFCPST']),
        pFCPST: num(n['pFCPST']),
        vFCPST: num(n['vFCPST']),
      };
    case 'ICMSPart':
      return {
        grupo: 'ICMSPart',
        orig: origem(n) ?? 0,
        cst: cst(n) as '10' | '90',
        modBC: (int(n['modBC']) ?? 0) as 0 | 1 | 2 | 3,
        vBC: num(n['vBC']) ?? 0,
        pRedBC: num(n['pRedBC']),
        pICMS: num(n['pICMS']) ?? 0,
        vICMS: num(n['vICMS']) ?? 0,
        modBCST: (int(n['modBCST']) ?? 0) as 0 | 1 | 2 | 3,
        pMVAST: num(n['pMVAST']),
        pRedBCST: num(n['pRedBCST']),
        vBCST: num(n['vBCST']) ?? 0,
        pICMSST: num(n['pICMSST']) ?? 0,
        vICMSST: num(n['vICMSST']) ?? 0,
        pBCOp: num(n['pBCOp']) ?? 0,
        ufST: txt(n['UFST']) ?? '',
      };
    case 'ICMSST':
      return {
        grupo: 'ICMSST',
        orig: origem(n) ?? 0,
        cst: cst(n) as '41' | '60',
        vBCSTRet: num(n['vBCSTRet']) ?? 0,
        pST: num(n['pST']),
        vICMSSubstituto: num(n['vICMSSubstituto']),
        vICMSSTRet: num(n['vICMSSTRet']) ?? 0,
        vBCSTDest: num(n['vBCSTDest']) ?? 0,
        vICMSSTDest: num(n['vICMSSTDest']) ?? 0,
      };
    case 'ICMSSN101':
      return {
        grupo: 'ICMSSN101',
        orig: origem(n) ?? 0,
        csosn: cst(n, 'CSOSN') as '101',
        pCredSN: num(n['pCredSN']) ?? 0,
        vCredICMSSN: num(n['vCredICMSSN']) ?? 0,
      };
    case 'ICMSSN102':
      return {
        grupo: 'ICMSSN102',
        orig: origem(n),
        csosn: cst(n, 'CSOSN') as '102' | '103' | '300' | '400',
      };
    case 'ICMSSN201':
      return {
        grupo: 'ICMSSN201',
        orig: origem(n) ?? 0,
        csosn: cst(n, 'CSOSN') as '201',
        modBCST: (int(n['modBCST']) ?? 0) as 0 | 1 | 2 | 3,
        pMVAST: num(n['pMVAST']),
        pRedBCST: num(n['pRedBCST']),
        vBCST: num(n['vBCST']) ?? 0,
        pICMSST: num(n['pICMSST']) ?? 0,
        vICMSST: num(n['vICMSST']) ?? 0,
        pCredSN: num(n['pCredSN']) ?? 0,
        vCredICMSSN: num(n['vCredICMSSN']) ?? 0,
      };
    case 'ICMSSN202':
      return {
        grupo: 'ICMSSN202',
        orig: origem(n) ?? 0,
        csosn: cst(n, 'CSOSN') as '202' | '203',
        modBCST: (int(n['modBCST']) ?? 0) as 0 | 1 | 2 | 3,
        pMVAST: num(n['pMVAST']),
        pRedBCST: num(n['pRedBCST']),
        vBCST: num(n['vBCST']) ?? 0,
        pICMSST: num(n['pICMSST']) ?? 0,
        vICMSST: num(n['vICMSST']) ?? 0,
      };
    case 'ICMSSN500':
      return {
        grupo: 'ICMSSN500',
        orig: origem(n) ?? 0,
        csosn: cst(n, 'CSOSN') as '500',
        vBCSTRet: num(n['vBCSTRet']),
        pST: num(n['pST']),
        vICMSSubstituto: num(n['vICMSSubstituto']),
        vICMSSTRet: num(n['vICMSSTRet']),
        vBCFCPSTRet: num(n['vBCFCPSTRet']),
        pFCPSTRet: num(n['pFCPSTRet']),
        vFCPSTRet: num(n['vFCPSTRet']),
      };
    case 'ICMSSN900':
      return {
        grupo: 'ICMSSN900',
        orig: origem(n),
        csosn: cst(n, 'CSOSN') as '900',
        modBC: int(n['modBC']) as 0 | 1 | 2 | 3 | undefined,
        vBC: num(n['vBC']),
        pRedBC: num(n['pRedBC']),
        pICMS: num(n['pICMS']),
        vICMS: num(n['vICMS']),
        modBCST: int(n['modBCST']) as 0 | 1 | 2 | 3 | undefined,
        pMVAST: num(n['pMVAST']),
        pRedBCST: num(n['pRedBCST']),
        vBCST: num(n['vBCST']),
        pICMSST: num(n['pICMSST']),
        vICMSST: num(n['vICMSST']),
        pCredSN: num(n['pCredSN']),
        vCredICMSSN: num(n['vCredICMSSN']),
      };
    default: {
      // Inalcançável: GRUPOS_ICMS é uma lista fechada; mantém exaustividade
      // em tempo de compilação para futuros grupos.
      void ctx;
      throw new ParseError(`Grupo de ICMS não suportado: ${grupo}`, 'det/imposto/ICMS');
    }
  }
}

// --- IPI / PIS / COFINS / ICMSUFDest ----------------------------------------

function parseIpi(ipi: XNode, c: string): Imposto['ipi'] {
  const comum = {
    cnpjProd: txt(ipi['CNPJProd']),
    cSelo: txt(ipi['cSelo']),
    qSelo: int(ipi['qSelo']),
    cEnq: txt(ipi['cEnq']) ?? '',
  };
  const trib = node(ipi['IPITrib']);
  if (trib) {
    return {
      grupo: 'IPITrib',
      ...comum,
      cst: (cst(trib) as never) ?? '',
      vBC: num(trib['vBC']),
      pIPI: num(trib['pIPI']),
      qUnid: num(trib['qUnid']),
      vUnid: num(trib['vUnid']),
      vIPI: num(trib['vIPI']) ?? 0,
    };
  }
  const nTrib = node(ipi['IPINT']);
  if (nTrib) {
    return { grupo: 'IPINT', ...comum, cst: (cst(nTrib) as never) ?? '' };
  }
  throw new ParseError('IPI sem IPITrib/IPINT', `${c}/imposto/IPI`);
}

function parsePis(pis: XNode): Pis {
  const aliq = node(pis['PISAliq']);
  if (aliq) {
    return {
      grupo: 'PISAliq',
      cst: (cst(aliq) as '01' | '02') ?? '01',
      vBC: num(aliq['vBC']) ?? 0,
      pPIS: num(aliq['pPIS']) ?? 0,
      vPIS: num(aliq['vPIS']) ?? 0,
    };
  }
  const qtde = node(pis['PISQtde']);
  if (qtde) {
    return {
      grupo: 'PISQtde',
      cst: (cst(qtde) as '03') ?? '03',
      qBCProd: num(qtde['qBCProd']) ?? 0,
      vAliqProd: num(qtde['vAliqProd']) ?? 0,
      vPIS: num(qtde['vPIS']) ?? 0,
    };
  }
  const nt = node(pis['PISNT']);
  if (nt) {
    return { grupo: 'PISNT', cst: (cst(nt) as never) ?? '' };
  }
  const outr = node(pis['PISOutr']);
  if (outr) {
    return {
      grupo: 'PISOutr',
      cst: (cst(outr) as never) ?? '',
      vBC: num(outr['vBC']),
      pPIS: num(outr['pPIS']),
      qBCProd: num(outr['qBCProd']),
      vAliqProd: num(outr['vAliqProd']),
      vPIS: num(outr['vPIS']) ?? 0,
    };
  }
  throw new ParseError('PIS sem grupo reconhecido', 'det/imposto/PIS');
}

function parseCofins(cofins: XNode): Cofins {
  const aliq = node(cofins['COFINSAliq']);
  if (aliq) {
    return {
      grupo: 'COFINSAliq',
      cst: (cst(aliq) as '01' | '02') ?? '01',
      vBC: num(aliq['vBC']) ?? 0,
      pCOFINS: num(aliq['pCOFINS']) ?? 0,
      vCOFINS: num(aliq['vCOFINS']) ?? 0,
    };
  }
  const qtde = node(cofins['COFINSQtde']);
  if (qtde) {
    return {
      grupo: 'COFINSQtde',
      cst: (cst(qtde) as '03') ?? '03',
      qBCProd: num(qtde['qBCProd']) ?? 0,
      vAliqProd: num(qtde['vAliqProd']) ?? 0,
      vCOFINS: num(qtde['vCOFINS']) ?? 0,
    };
  }
  const nt = node(cofins['COFINSNT']);
  if (nt) {
    return { grupo: 'COFINSNT', cst: (cst(nt) as never) ?? '' };
  }
  const outr = node(cofins['COFINSOutr']);
  if (outr) {
    return {
      grupo: 'COFINSOutr',
      cst: (cst(outr) as never) ?? '',
      vBC: num(outr['vBC']),
      pCOFINS: num(outr['pCOFINS']),
      qBCProd: num(outr['qBCProd']),
      vAliqProd: num(outr['vAliqProd']),
      vCOFINS: num(outr['vCOFINS']) ?? 0,
    };
  }
  throw new ParseError('COFINS sem grupo reconhecido', 'det/imposto/COFINS');
}

function parseIcmsUfDest(n: XNode): IcmsUfDest {
  return {
    vBCUFDest: num(n['vBCUFDest']) ?? 0,
    vBCFCPUFDest: num(n['vBCFCPUFDest']),
    pFCPUFDest: num(n['pFCPUFDest']),
    pICMSUFDest: num(n['pICMSUFDest']) ?? 0,
    pICMSInter: (num(n['pICMSInter']) ?? 7) as 4 | 7,
    pICMSInterPart: num(n['pICMSInterPart']) ?? 0,
    vFCPUFDest: num(n['vFCPUFDest']),
    vICMSUFDest: num(n['vICMSUFDest']) ?? 0,
    vICMSUFRemet: num(n['vICMSUFRemet']) ?? 0,
  };
}

// --- IBS/CBS (NT 2024.002 v1.10) ---------------------------------------------

function parseGigaDif(n?: XNode): GigaDif | undefined {
  if (!n) return undefined;
  return { pDif: num(n['pDif']) ?? 0, vDif: num(n['vDif']) ?? 0 };
}

function parseGDevTrib(n?: XNode): GDevTrib | undefined {
  if (!n) return undefined;
  return { vDevTrib: num(n['vDevTrib']) ?? 0 };
}

function parseGRed(n?: XNode): GRed | undefined {
  if (!n) return undefined;
  return {
    pRedAliq: num(n['pRedAliq']) ?? 0,
    pAliqEfet: num(n['pAliqEfet']) ?? 0,
  };
}

function parseGDeson(n?: XNode): GDeson | undefined {
  if (!n) return undefined;
  return {
    cst: txt(n['CST']),
    cClassTrib: txt(n['cClassTrib']),
    vBC: num(n['vBC']),
    pAliq: num(n['pAliq']) ?? 0,
    vDeson: num(n['vDeson']) ?? 0,
  };
}

function parseGCredPres(n?: XNode): GCredPres | undefined {
  if (!n) return undefined;
  return {
    cCredPres: txt(n['cCredPres']) ?? '',
    pCredPres: num(n['pCredPres']) ?? 0,
    vCredPres: num(n['vCredPres']) ?? 0,
    vCredPresCondSus: num(n['vCredPresCondSus']) ?? 0,
  };
}

function parseSeletivo(n?: XNode): Seletivo | undefined {
  if (!n) return undefined;
  const gImpSel = node(n['gImpSel']);
  return {
    cst: txt(n['CST']) ?? '',
    cClassTrib: txt(n['cClassTrib']) ?? '',
    gImpSel: gImpSel
      ? {
          vBCImpSel: num(gImpSel['vBCImpSel']) ?? 0,
          pImpSel: num(gImpSel['pImpSel']) ?? 0,
          pImpSelEspec: num(gImpSel['pImpSelEspec']),
          uTrib: txt(gImpSel['uTrib']),
          qTrib: num(gImpSel['qTrib']),
          vImpSel: num(gImpSel['vImpSel']) ?? 0,
        }
      : undefined,
  };
}

function parseIbsUf(n: XNode): GIbsUf {
  return {
    pIBSUF: num(n['pIBSUF']) ?? 0,
    vTribOP: num(n['vTribOP']),
    gDif: parseGigaDif(node(n['gDif'])),
    gDevTrib: parseGDevTrib(node(n['gDevTrib'])),
    gRed: parseGRed(node(n['gRed'])),
    gDeson: parseGDeson(node(n['gDeson'])),
    vIBSUF: num(n['vIBSUF']) ?? 0,
  };
}

function parseIbsMun(n: XNode): GIbsMun {
  return {
    pIBSMun: num(n['pIBSMun']) ?? 0,
    vTribOP: num(n['vTribOP']),
    gDif: parseGigaDif(node(n['gDif'])),
    gDevTrib: parseGDevTrib(node(n['gDevTrib'])),
    gRed: parseGRed(node(n['gRed'])),
    gDeson: parseGDeson(node(n['gDeson'])),
    vIBSMun: num(n['vIBSMun']) ?? 0,
  };
}

function parseGCbs(n: XNode): GCbs {
  return {
    pCBS: num(n['pCBS']) ?? 0,
    vTribOp: num(n['vTribOp']),
    gCBSCredPres: parseGCredPres(node(n['gCBSCredPres'])),
    gDif: parseGigaDif(node(n['gDif'])),
    gDevTrib: parseGDevTrib(node(n['gDevTrib'])),
    gRed: parseGRed(node(n['gRed'])),
    gDeson: parseGDeson(node(n['gDeson'])),
    vCBS: num(n['vCBS']) ?? 0,
  };
}

function parseIbsCbsSel(sel: XNode): IbsCbsSel {
  const g = requerNode(sel['gIBSCBS'], 'gIBSCBS', 'imposto/IBSCBSSel');
  return {
    seletivo: parseSeletivo(node(sel['seletivo'])),
    cst: txt(sel['CST']),
    cClassTrib: txt(sel['cClassTrib']),
    indPerecimento: bit(sel['indPerecimento']) as never,
    gIBSCBS: {
      vBC: num(g['vBC']) ?? 0,
      gIBSUF: parseIbsUf(requerNode(g['gIBSUF'], 'gIBSUF', 'IBSCBSSel/gIBSCBS')),
      gIBSMun: parseIbsMun(requerNode(g['gIBSMun'], 'gIBSMun', 'IBSCBSSel/gIBSCBS')),
      gIBSCredPres: parseGCredPres(node(g['gIBSCredPres'])),
      gCBS: parseGCbs(requerNode(g['gCBS'], 'gCBS', 'IBSCBSSel/gIBSCBS')),
    },
  };
}

// ---------------------------------------------------------------------------
// total
// ---------------------------------------------------------------------------

function parseTotal(total: XNode, contexto: string): Total {
  const c = `${contexto}/total`;
  const icmsTot = requerNode(total['ICMSTot'], 'ICMSTot', c);
  const dec = (n: XNode, campo: string, obrigatorio = false): number | undefined => {
    const v = num(n[campo]);
    if (v === undefined && obrigatorio) {
      throw new ParseError(`Campo obrigatório ausente: ${campo}`, `${c}/ICMSTot`);
    }
    return v;
  };

  const icms: NFe['total']['icmsTot'] = {
    vBC: dec(icmsTot, 'vBC', true) ?? 0,
    vICMS: dec(icmsTot, 'vICMS', true) ?? 0,
    vICMSDeson: dec(icmsTot, 'vICMSDeson', true) ?? 0,
    vFCPUFDest: dec(icmsTot, 'vFCPUFDest'),
    vICMSUFDest: dec(icmsTot, 'vICMSUFDest'),
    vICMSUFRemet: dec(icmsTot, 'vICMSUFRemet'),
    vFCP: dec(icmsTot, 'vFCP', true) ?? 0,
    vBCST: dec(icmsTot, 'vBCST', true) ?? 0,
    vST: dec(icmsTot, 'vST', true) ?? 0,
    vFCPST: dec(icmsTot, 'vFCPST', true) ?? 0,
    vFCPSTRet: dec(icmsTot, 'vFCPSTRet', true) ?? 0,
    qBCMono: dec(icmsTot, 'qBCMono'),
    vICMSMono: dec(icmsTot, 'vICMSMono'),
    qBCMonoReten: dec(icmsTot, 'qBCMonoReten'),
    vICMSMonoReten: dec(icmsTot, 'vICMSMonoReten'),
    qBCMonoRet: dec(icmsTot, 'qBCMonoRet'),
    vICMSMonoRet: dec(icmsTot, 'vICMSMonoRet'),
    vProd: dec(icmsTot, 'vProd', true) ?? 0,
    vFrete: dec(icmsTot, 'vFrete', true) ?? 0,
    vSeg: dec(icmsTot, 'vSeg', true) ?? 0,
    vDesc: dec(icmsTot, 'vDesc', true) ?? 0,
    vII: dec(icmsTot, 'vII', true) ?? 0,
    vIPI: dec(icmsTot, 'vIPI', true) ?? 0,
    vIPIDevol: dec(icmsTot, 'vIPIDevol', true) ?? 0,
    vPIS: dec(icmsTot, 'vPIS', true) ?? 0,
    vCOFINS: dec(icmsTot, 'vCOFINS', true) ?? 0,
    vOutro: dec(icmsTot, 'vOutro', true) ?? 0,
    vNF: dec(icmsTot, 'vNF', true) ?? 0,
    vTotTrib: dec(icmsTot, 'vTotTrib'),
  };

  const issqnTotNode = node(total['ISSQNtot']);
  const issqnTot: IssqnTot | undefined = issqnTotNode
    ? {
        vServ: num(issqnTotNode['vServ']),
        vBC: num(issqnTotNode['vBC']),
        vISS: num(issqnTotNode['vISS']),
        vPIS: num(issqnTotNode['vPIS']),
        vCOFINS: num(issqnTotNode['vCOFINS']),
        dCompet: txt(issqnTotNode['dCompet']) ?? '',
        vDeducao: num(issqnTotNode['vDeducao']),
        vOutro: num(issqnTotNode['vOutro']),
        vDescIncond: num(issqnTotNode['vDescIncond']),
        vDescCond: num(issqnTotNode['vDescCond']),
        vISSRet: num(issqnTotNode['vISSRet']),
        cRegTrib: int(issqnTotNode['cRegTrib']) as IssqnTot['cRegTrib'],
      }
    : undefined;

  const retTribNode = node(total['retTrib']);
  const retTrib: RetTrib | undefined = retTribNode
    ? {
        vRetPIS: num(retTribNode['vRetPIS']),
        vRetCOFINS: num(retTribNode['vRetCOFINS']),
        vRetCSLL: num(retTribNode['vRetCSLL']),
        vBCIRRF: num(retTribNode['vBCIRRF']),
        vIRRF: num(retTribNode['vIRRF']),
        vBCRetPrev: num(retTribNode['vBCRetPrev']),
        vRetPrev: num(retTribNode['vRetPrev']),
      }
    : undefined;

  return {
    icmsTot: icms,
    issqnTot,
    retTrib,
    ibscbsSelTot: optional(total['IBSCBSSelTot'], parseIbsCbsSelTot),
  };
}

function parseIbsCbsSelTot(n: XNode): IbsCbsSelTot {
  const gSel = node(n['gSel']);
  const gIbs = requerNode(n['gIBS'], 'gIBS', 'total/IBSCBSSelTot');
  const gIbsUf = requerNode(gIbs['gIBSUFTot'], 'gIBSUFTot', 'IBSCBSSelTot/gIBS');
  const gIbsMun = requerNode(gIbs['gIBSMunTot'], 'gIBSMunTot', 'IBSCBSSelTot/gIBS');
  const gCbs = requerNode(n['gCBS'], 'gCBS', 'total/IBSCBSSelTot');
  return {
    gSel: gSel
      ? {
          vBCSel: num(gSel['vBCSel']) ?? 0,
          vImpSel: num(gSel['vImpSel']) ?? 0,
        }
      : undefined,
    vBCIBSCBS: num(n['vBCIBSCBS']) ?? 0,
    gIBS: {
      gIBSUFTot: {
        vDif: num(gIbsUf['vDif']) ?? 0,
        vDevTrib: num(gIbsUf['vDevTrib']) ?? 0,
        vDeson: num(gIbsUf['vDeson']) ?? 0,
        vIBSUF: num(gIbsUf['vIBSUF']) ?? 0,
      },
      gIBSMunTot: {
        vDif: num(gIbsMun['vDif']) ?? 0,
        vDevTrib: num(gIbsMun['vDevTrib']) ?? 0,
        vDeson: num(gIbsMun['vDeson']) ?? 0,
        vIBSMun: num(gIbsMun['vIBSMun']) ?? 0,
        vIBSTot: num(gIbsMun['vIBSTot']) ?? 0,
      },
      vCresPres: num(gIbs['vCresPres']) ?? 0,
      vCredPresCondSus: num(gIbs['vCredPresCondSus']) ?? 0,
    },
    gCBS: {
      vDif: num(gCbs['vDif']) ?? 0,
      vDevTrib: num(gCbs['vDevTrib']) ?? 0,
      vDeson: num(gCbs['vDeson']) ?? 0,
      vCBS: num(gCbs['vCBS']) ?? 0,
      vCresPres: num(gCbs['vCresPres']) ?? 0,
      vCredPresCondSus: num(gCbs['vCredPresCondSus']) ?? 0,
    },
  };
}

// ---------------------------------------------------------------------------
// transp / cobr / pag
// ---------------------------------------------------------------------------

function parseVeiculo(n: XNode): Veiculo {
  return {
    placa: txt(n['placa']) ?? '',
    uf: txt(n['UF']),
    rntc: txt(n['RNTC']),
  };
}

function parseTransp(transp: XNode, contexto: string): Transp {
  const c = `${contexto}/transp`;
  const transportaNode = node(transp['transporta']);
  const transporta: Transp['transporta'] = transportaNode
    ? {
        cnpj: txt(transportaNode['CNPJ']),
        cpf: txt(transportaNode['CPF']),
        xNome: txt(transportaNode['xNome']),
        ie: txt(transportaNode['IE']),
        xEnder: txt(transportaNode['xEnder']),
        xMun: txt(transportaNode['xMun']),
        uf: txt(transportaNode['UF']),
      }
    : undefined;

  const vols: Vol[] = arr(transp['vol']).map((v) => {
    const n = requerNode(v, 'vol', c);
    return {
      qVol: int(n['qVol']),
      esp: txt(n['esp']),
      marca: txt(n['marca']),
      nVol: txt(n['nVol']),
      pesoL: num(n['pesoL']),
      pesoB: num(n['pesoB']),
      lacres: arr(n['lacres'])
        .map((l) => txt(node(l as XNode)?.['nLacre']) ?? '')
        .filter((s) => s !== '')
        .map((nLacre) => ({ nLacre })),
    };
  });

  return {
    modFrete: requer(int(transp['modFrete']), 'modFrete', c) as Transp['modFrete'],
    transporta,
    retTransp: optional(transp['retTransp'], (r) => ({
      vServ: num(r['vServ']) ?? 0,
      vBCRet: num(r['vBCRet']) ?? 0,
      pICMSRet: num(r['pICMSRet']) ?? 0,
      vICMSRet: num(r['vICMSRet']) ?? 0,
      cfop: txt(r['CFOP']) ?? '',
      cMunFG: int(r['cMunFG']) ?? 0,
    })),
    veicTransp: optional(transp['veicTransp'], parseVeiculo),
    reboque: arr(transp['reboque'])
      .map((r) => node(r))
      .filter((r): r is XNode => r !== undefined)
      .map(parseVeiculo),
    vagao: txt(transp['vagao']),
    balsa: txt(transp['balsa']),
    vol: vols,
  };
}

function parseCobr(cobr: XNode, contexto: string): Cobr {
  const c = `${contexto}/cobr`;
  const fatNode = node(cobr['fat']);
  const fat: Fat | undefined = fatNode
    ? {
        nFat: txt(fatNode['nFat']),
        vOrig: num(fatNode['vOrig']),
        vDesc: num(fatNode['vDesc']),
        vLiq: num(fatNode['vLiq']),
      }
    : undefined;
  const dup = arr(cobr['dup']).map((d) => {
    const n = requerNode(d, 'dup', c);
    return {
      nDup: txt(n['nDup']),
      dVenc: txt(n['dVenc']),
      vDup: num(n['vDup']) ?? 0,
    };
  });
  return { fat, dup };
}

function parsePag(pag: XNode, contexto: string): Pag {
  const c = `${contexto}/pag`;
  const detPag: DetPag[] = arr(pag['detPag']).map((d) => {
    const n = requerNode(d, 'detPag', c);
    const cardNode = node(n['card']);
    const card: Card | undefined = cardNode
      ? {
          tpIntegra: (int(cardNode['tpIntegra']) ?? 2) as 1 | 2,
          cnpj: txt(cardNode['CNPJ']),
          tBand: txt(cardNode['tBand']) as Card['tBand'],
          cAut: txt(cardNode['cAut']),
        }
      : undefined;
    return {
      indPag: int(n['indPag']) as DetPag['indPag'],
      tPag: (txt(n['tPag']) ?? '99') as DetPag['tPag'],
      xPag: txt(n['xPag']),
      vPag: num(n['vPag']) ?? 0,
      card,
    };
  });
  return { detPag, vTroco: num(pag['vTroco']) };
}

// ---------------------------------------------------------------------------
// infAdic / infRespTec / autXML
// ---------------------------------------------------------------------------

function parseInfAdic(infAdic: XNode): InfAdic {
  return {
    infAdFisco: txt(infAdic['infAdFisco']),
    infCpl: txt(infAdic['infCpl']),
    obsCont: parseObservacoes(infAdic['obsCont']),
    obsFisco: parseObservacoes(infAdic['obsFisco']),
  };
}

function parseInfRespTec(n: XNode, c: string): InfRespTec {
  return {
    cnpj: requer(txt(n['CNPJ']), 'CNPJ', `${c}/infRespTec`),
    xContato: requer(txt(n['xContato']), 'xContato', `${c}/infRespTec`),
    email: requer(txt(n['email']), 'email', `${c}/infRespTec`),
    fone: requer(txt(n['fone']), 'fone', `${c}/infRespTec`),
    idCSRT: txt(n['idCSRT']),
    hashCSRT: txt(n['hashCSRT']),
  };
}

function parseAutXml(a: XNode): AutXml {
  return { cnpj: txt(a['CNPJ']), cpf: txt(a['CPF']) };
}
