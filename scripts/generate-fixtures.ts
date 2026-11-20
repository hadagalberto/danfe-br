/**
 * Gera o corpus de fixtures em `tests/fixtures/` (executado por
 * `npm run fixtures`). Determinístico: mesma árvore de código produz os
 * mesmos bytes.
 *
 * Cobertura do corpus (SPEC — Marco 1):
 * - uma nota por família de CST (00, 02, 10, 15, 20, 30, 40, 41, 50, 51, 53,
 *   60, 61, 70, 90) e por grupo especial (ICMSPart, ICMSST);
 * - uma nota por CSOSN (101, 102, 103, 201, 202, 203, 300, 400, 500, 900);
 * - notas com muitos itens (10, 60 e 120 itens) para paginação futura;
 * - duplicatas (cobr/fat/dup), transporte completo (transporta, veicTransp,
 *   reboques, volumes com lacres, retTransp);
 * - homologação (tpAmb = 2), autorização fora de prazo (cStat 150), denegada
 *   (cStat 110), sem protocolo (NFe raiz), CNPJ alfanumérico (NT 2025.001),
 *   DIFAL (ICMSUFDest), ISSQN conjugado, IBS/CBS da NT 2024.002;
 * - NFC-e: consumidor identificado por CPF (com QR Code em CDATA), consumidor
 *   anônimo e nota com 20 itens;
 * - eventos: cancelamento (110111) e Carta de Correção (110110).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  Cofins,
  Cobr,
  Dest,
  Det,
  Emit,
  IbsCbsSel,
  IbsCbsSelTot,
  Icms,
  IcmsUfDest,
  Issqn,
  NFeProc,
  Pis,
  Transp,
} from '../src/model/nfe';
import type { Endereco } from '../src/model/comum';
import {
  cnpjSintetico,
  deriva,
  destinatarioSintetico,
  emitenteSintetico,
  itemSintetico,
  montaEvento,
  montaNFe,
  montaNFeProc,
  nfeProcToXml,
  nfeToXml,
  protNFeSintetico,
  eventoToXml,
} from '../src/fixtures/factory';
import { TP_EVENTO_CANCELAMENTO, TP_EVENTO_CCE } from '../src/model/evento';
import { calculaDvCnpj } from '../src/validate/documentos';

const RAIZ_FIXTURES =
  process.env['DANFE_BR_FIXTURES_DIR'] !== undefined && process.env['DANFE_BR_FIXTURES_DIR'] !== ''
    ? process.env['DANFE_BR_FIXTURES_DIR']
    : join(import.meta.dirname, '..', 'tests', 'fixtures');

interface EntradaManifest {
  arquivo: string;
  descricao: string;
  tipo: 'nfeProc' | 'NFe' | 'evento';
  /** Expectativas verificadas por tests/corpus.test.ts */
  chave: string;
  mod: 55 | 65;
  tpAmb: 1 | 2;
  cStat: number | null;
  itens: number;
  csosn?: string | undefined;
  cst?: string | undefined;
  valido: boolean;
  /** códigos de problemas esperados, além de avisos de homologação. */
  problemas?: string[] | undefined;
}

const manifest: EntradaManifest[] = [];

function registrar(
  arquivo: string,
  descricao: string,
  opts: {
    tipo?: EntradaManifest['tipo'];
    chave: string;
    mod: 55 | 65;
    tpAmb: 1 | 2;
    cStat: number | null;
    itens: number;
    cst?: string;
    csosn?: string;
    valido?: boolean;
    problemas?: string[];
  },
): void {
  manifest.push({
    arquivo,
    descricao,
    tipo: opts.tipo ?? 'nfeProc',
    chave: opts.chave,
    mod: opts.mod,
    tpAmb: opts.tpAmb,
    cStat: opts.cStat,
    itens: opts.itens,
    cst: opts.cst,
    csosn: opts.csosn,
    valido: opts.valido ?? true,
    problemas: opts.problemas,
  });
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

// ---------------------------------------------------------------------------
// Helpers de construção de itens/notas
// ---------------------------------------------------------------------------

function itemCst(seed: string, icms: Icms, sobre?: { vUn?: number; qtd?: number }): Det {
  const pis: Pis = {
    grupo: 'PISAliq',
    cst: '01',
    vBC: 0,
    pPIS: 0,
    vPIS: round2(deriva(`${seed}:pis`, 1, 30) / 10),
  };
  const cofins: Cofins = {
    grupo: 'COFINSAliq',
    cst: '01',
    vBC: 0,
    pCOFINS: 0,
    vCOFINS: round2(deriva(`${seed}:cof`, 1, 30) / 10),
  };
  return itemSintetico({ seed, icms, pis, cofins, vUn: sobre?.vUn, qtd: sobre?.qtd });
}

/** Nota de produção com protocolo autorizado (cStat 100). */
function notaSimples(seed: string, itens: Det[]): NFeProc {
  const base = montaNFe({ seed, itens });
  return montaNFeProc(base, protNFeSintetico(base));
}

const GERADORES: (() => void)[] = [];

function geraNotaCst(
  arquivo: string,
  seed: string,
  cst: string,
  icms: Icms,
  descricao: string,
): void {
  const proc = notaSimples(seed, [itemCst(seed, icms)]);
  writeFileSync(join(RAIZ_FIXTURES, arquivo), nfeProcToXml(proc), 'utf8');
  registrar(arquivo, descricao, {
    chave: proc.nfe.chave,
    mod: 55,
    tpAmb: 1,
    cStat: 100,
    itens: 1,
    cst,
  });
}

// ---------------------------------------------------------------------------
// 1. CSTs do ICMS normal (grupo N) e grupos ICMSPart/ICMSST
// ---------------------------------------------------------------------------

GERADORES.push(() =>
  geraNotaCst(
    'nfe-cst-00.xml',
    'cst00',
    '00',
    {
      grupo: 'ICMS00',
      orig: 0,
      cst: '00',
      modBC: 3,
      vBC: 1000,
      pICMS: 18,
      vICMS: 0,
      pFCP: 2,
      vFCP: 20,
    },
    'NF-e produção, 1 item, CST 00 (tributada integralmente) com FCP',
  ),
);
GERADORES.push(() =>
  geraNotaCst(
    'nfe-cst-02.xml',
    'cst02',
    '02',
    { grupo: 'ICMS02', orig: 0, cst: '02', qBCMono: 1000, adRemICMS: 1.5, vICMSMono: 15 },
    'NF-e produção, 1 item, CST 02 (monofásico — combustíveis, NT 2023.001)',
  ),
);
GERADORES.push(() =>
  geraNotaCst(
    'nfe-cst-10.xml',
    'cst10',
    '10',
    {
      grupo: 'ICMS10',
      orig: 0,
      cst: '10',
      modBC: 3,
      vBC: 1000,
      pICMS: 18,
      vICMS: 0,
      vBCFCP: 1000,
      pFCP: 2,
      vFCP: 20,
      modBCST: 4,
      pMVAST: 40,
      vBCST: 1400,
      pICMSST: 18,
      vICMSST: 72,
      vBCFCPST: 1400,
      pFCPST: 2,
      vFCPST: 28,
    },
    'NF-e produção, 1 item, CST 10 (tributada com cobrança por ST) com FCP',
  ),
);
GERADORES.push(() =>
  geraNotaCst(
    'nfe-cst-15.xml',
    'cst15',
    '15',
    {
      grupo: 'ICMS15',
      orig: 0,
      cst: '15',
      qBCMono: 1000,
      adRemICMS: 1.5,
      vICMSMono: 15,
      qBCMonoReten: 1000,
      adRemICMSReten: 2,
      vICMSMonoReten: 20,
    },
    'NF-e produção, 1 item, CST 15 (monofásico com retenção, NT 2023.001)',
  ),
);
GERADORES.push(() =>
  geraNotaCst(
    'nfe-cst-20.xml',
    'cst20',
    '20',
    {
      grupo: 'ICMS20',
      orig: 0,
      cst: '20',
      modBC: 3,
      pRedBC: 10,
      vBC: 900,
      pICMS: 18,
      vICMS: 0,
      pFCP: 2,
      vFCP: 18,
    },
    'NF-e produção, 1 item, CST 20 (com redução de BC) com FCP',
  ),
);
GERADORES.push(() =>
  geraNotaCst(
    'nfe-cst-30.xml',
    'cst30',
    '30',
    {
      grupo: 'ICMS30',
      orig: 0,
      cst: '30',
      modBCST: 4,
      pMVAST: 40,
      vBCST: 1400,
      pICMSST: 18,
      vICMSST: 252,
      vICMSDeson: 100,
      motDesICMS: 9,
    },
    'NF-e produção, 1 item, CST 30 (isenta com cobrança por ST)',
  ),
);
GERADORES.push(() =>
  geraNotaCst(
    'nfe-cst-40.xml',
    'cst40',
    '40',
    { grupo: 'ICMS40', orig: 0, cst: '40', vICMSDeson: 50, motDesICMS: 9 },
    'NF-e produção, 1 item, CST 40 (isenta) com desoneração',
  ),
);
GERADORES.push(() =>
  geraNotaCst(
    'nfe-cst-41.xml',
    'cst41',
    '41',
    { grupo: 'ICMS40', orig: 0, cst: '41' },
    'NF-e produção, 1 item, CST 41 (não tributada)',
  ),
);
GERADORES.push(() =>
  geraNotaCst(
    'nfe-cst-50.xml',
    'cst50',
    '50',
    { grupo: 'ICMS40', orig: 0, cst: '50', vICMSDeson: 30, motDesICMS: 90 },
    'NF-e produção, 1 item, CST 50 (suspensão)',
  ),
);
GERADORES.push(() =>
  geraNotaCst(
    'nfe-cst-51.xml',
    'cst51',
    '51',
    {
      grupo: 'ICMS51',
      orig: 0,
      cst: '51',
      modBC: 3,
      vBC: 1000,
      pICMS: 18,
      vICMSOp: 180,
      pDif: 60,
      vICMSDif: 108,
      vICMS: 72,
    },
    'NF-e produção, 1 item, CST 51 (diferimento)',
  ),
);
GERADORES.push(() =>
  geraNotaCst(
    'nfe-cst-53.xml',
    'cst53',
    '53',
    {
      grupo: 'ICMS53',
      orig: 0,
      cst: '53',
      qBCMono: 1000,
      adRemICMS: 1.5,
      vICMSMonoOp: 15,
      pDif: 40,
      vICMSMonoDif: 6,
      vICMSMono: 9,
      qBCMonoDif: 1000,
      adRemICMSDif: 0.6,
    },
    'NF-e produção, 1 item, CST 53 (monofásico com diferimento, NT 2023.001)',
  ),
);
GERADORES.push(() =>
  geraNotaCst(
    'nfe-cst-60.xml',
    'cst60',
    '60',
    {
      grupo: 'ICMS60',
      orig: 0,
      cst: '60',
      vBCSTRet: 1200,
      pST: 18,
      vICMSSTRet: 216,
      vBCFCPSTRet: 1200,
      pFCPSTRet: 2,
      vFCPSTRet: 24,
    },
    'NF-e produção, 1 item, CST 60 (ICMS cobrado anteriormente por ST)',
  ),
);
GERADORES.push(() =>
  geraNotaCst(
    'nfe-cst-61.xml',
    'cst61',
    '61',
    { grupo: 'ICMS61', orig: 0, cst: '61', qBCMonoRet: 1000, adRemICMSRet: 1.5, vICMSMonoRet: 15 },
    'NF-e produção, 1 item, CST 61 (monofásico retido anteriormente, NT 2023.001)',
  ),
);
GERADORES.push(() =>
  geraNotaCst(
    'nfe-cst-70.xml',
    'cst70',
    '70',
    {
      grupo: 'ICMS70',
      orig: 0,
      cst: '70',
      modBC: 3,
      pRedBC: 10,
      vBC: 900,
      pICMS: 18,
      vICMS: 0,
      modBCST: 4,
      pRedBCST: 5,
      vBCST: 1330,
      pICMSST: 18,
      vICMSST: 77.4,
    },
    'NF-e produção, 1 item, CST 70 (redução de BC e cobrança por ST)',
  ),
);
GERADORES.push(() =>
  geraNotaCst(
    'nfe-cst-90.xml',
    'cst90',
    '90',
    {
      grupo: 'ICMS90',
      orig: 0,
      cst: '90',
      modBC: 3,
      vBC: 1000,
      pICMS: 18,
      vICMS: 0,
      modBCST: 4,
      vBCST: 1400,
      pICMSST: 18,
      vICMSST: 72,
    },
    'NF-e produção, 1 item, CST 90 (outras) com ICMS e ST',
  ),
);
GERADORES.push(() =>
  geraNotaCst(
    'nfe-icms-part-10.xml',
    'icmspart10',
    '10',
    {
      grupo: 'ICMSPart',
      orig: 2,
      cst: '10',
      modBC: 3,
      vBC: 1000,
      pICMS: 4,
      vICMS: 40,
      modBCST: 4,
      vBCST: 1400,
      pICMSST: 18,
      vICMSST: 212,
      pBCOp: 50,
      ufST: 'PR',
    },
    'NF-e produção, 1 item, ICMSPart CST 10 (repasse entre UF origem/destino)',
  ),
);
GERADORES.push(() =>
  geraNotaCst(
    'nfe-icms-st-60.xml',
    'icmsst60',
    '60',
    {
      grupo: 'ICMSST',
      orig: 0,
      cst: '60',
      vBCSTRet: 1000,
      pST: 18,
      vICMSSTRet: 180,
      vBCSTDest: 200,
      vICMSSTDest: 36,
    },
    'NF-e produção, 1 item, ICMSST CST 60 (repasse de ST entre UFs)',
  ),
);

// ---------------------------------------------------------------------------
// 2. CSOSNs do Simples Nacional
// ---------------------------------------------------------------------------

function geraCsosn(
  arquivo: string,
  seed: string,
  csosn: string,
  icms: Icms,
  descricao: string,
): void {
  const emitSimples: Emit = { ...emitenteSintetico(seed), crt: 1 };
  const base = montaNFe({ seed, itens: [itemCst(seed, icms)], emit: emitSimples });
  const proc = montaNFeProc(base, protNFeSintetico(base));
  writeFileSync(join(RAIZ_FIXTURES, arquivo), nfeProcToXml(proc), 'utf8');
  registrar(arquivo, descricao, {
    chave: proc.nfe.chave,
    mod: 55,
    tpAmb: 1,
    cStat: 100,
    itens: 1,
    csosn,
  });
}

GERADORES.push(() =>
  geraCsosn(
    'nfe-csosn-101.xml',
    'csosn101',
    '101',
    { grupo: 'ICMSSN101', orig: 0, csosn: '101', pCredSN: 1.25, vCredICMSSN: 12.5 },
    'NF-e Simples Nacional, CSOSN 101 (tributada com permissão de crédito)',
  ),
);
GERADORES.push(() =>
  geraCsosn(
    'nfe-csosn-102.xml',
    'csosn102',
    '102',
    { grupo: 'ICMSSN102', orig: 0, csosn: '102' },
    'NF-e Simples Nacional, CSOSN 102 (tributada sem permissão de crédito)',
  ),
);
GERADORES.push(() =>
  geraCsosn(
    'nfe-csosn-103.xml',
    'csosn103',
    '103',
    { grupo: 'ICMSSN102', orig: 0, csosn: '103' },
    'NF-e Simples Nacional, CSOSN 103 (isenção do ICMS no Simples)',
  ),
);
GERADORES.push(() =>
  geraCsosn(
    'nfe-csosn-201.xml',
    'csosn201',
    '201',
    {
      grupo: 'ICMSSN201',
      orig: 0,
      csosn: '201',
      modBCST: 4,
      pMVAST: 40,
      vBCST: 1400,
      pICMSST: 18,
      vICMSST: 252,
      pCredSN: 1.25,
      vCredICMSSN: 12.5,
    },
    'NF-e Simples Nacional, CSOSN 201 (tributada com ST com permissão de crédito)',
  ),
);
GERADORES.push(() =>
  geraCsosn(
    'nfe-csosn-202.xml',
    'csosn202',
    '202',
    {
      grupo: 'ICMSSN202',
      orig: 0,
      csosn: '202',
      modBCST: 4,
      pMVAST: 40,
      vBCST: 1400,
      pICMSST: 18,
      vICMSST: 252,
    },
    'NF-e Simples Nacional, CSOSN 202 (tributada com ST sem permissão de crédito)',
  ),
);
GERADORES.push(() =>
  geraCsosn(
    'nfe-csosn-203.xml',
    'csosn203',
    '203',
    {
      grupo: 'ICMSSN202',
      orig: 0,
      csosn: '203',
      modBCST: 4,
      pRedBCST: 10,
      vBCST: 1260,
      pICMSST: 18,
      vICMSST: 226.8,
    },
    'NF-e Simples Nacional, CSOSN 203 (isenção com ST)',
  ),
);
GERADORES.push(() =>
  geraCsosn(
    'nfe-csosn-300.xml',
    'csosn300',
    '300',
    { grupo: 'ICMSSN102', orig: 0, csosn: '300' },
    'NF-e Simples Nacional, CSOSN 300 (imune)',
  ),
);
GERADORES.push(() =>
  geraCsosn(
    'nfe-csosn-400.xml',
    'csosn400',
    '400',
    { grupo: 'ICMSSN102', orig: 0, csosn: '400' },
    'NF-e Simples Nacional, CSOSN 400 (não tributada)',
  ),
);
GERADORES.push(() =>
  geraCsosn(
    'nfe-csosn-500.xml',
    'csosn500',
    '500',
    {
      grupo: 'ICMSSN500',
      orig: 0,
      csosn: '500',
      vBCSTRet: 1200,
      pST: 18,
      vICMSSTRet: 216,
      vBCFCPSTRet: 1200,
      pFCPSTRet: 2,
      vFCPSTRet: 24,
    },
    'NF-e Simples Nacional, CSOSN 500 (ICMS cobrado anteriormente por ST)',
  ),
);
GERADORES.push(() =>
  geraCsosn(
    'nfe-csosn-900.xml',
    'csosn900',
    '900',
    {
      grupo: 'ICMSSN900',
      orig: 0,
      csosn: '900',
      modBC: 3,
      vBC: 1000,
      pICMS: 1.25,
      vICMS: 12.5,
    },
    'NF-e Simples Nacional, CSOSN 900 (outros)',
  ),
);

// ---------------------------------------------------------------------------
// 3. Muitos itens, duplicatas, transporte
// ---------------------------------------------------------------------------

function itensMistos(seed: string, quantidade: number): Det[] {
  const saida: Det[] = [];
  for (let i = 1; i <= quantidade; i++) {
    const cst = ['00', '10', '20', '40', '60', '90'][(i - 1) % 6]!;
    const vUn = round2((100 + i) / 100);
    const qtd = i;
    const icms: Icms =
      cst === '00'
        ? { grupo: 'ICMS00', orig: 0, cst: '00', modBC: 3, vBC: 100 + i, pICMS: 18, vICMS: 0 }
        : cst === '10'
          ? {
              grupo: 'ICMS10',
              orig: 0,
              cst: '10',
              modBC: 3,
              vBC: 100 + i,
              pICMS: 18,
              vICMS: 0,
              modBCST: 4,
              vBCST: 140 + i,
              pICMSST: 18,
              vICMSST: 25.2,
            }
          : cst === '20'
            ? {
                grupo: 'ICMS20',
                orig: 0,
                cst: '20',
                modBC: 3,
                pRedBC: 10,
                vBC: 90 + i,
                pICMS: 18,
                vICMS: 0,
              }
            : cst === '40'
              ? { grupo: 'ICMS40', orig: 0, cst: '40' }
              : cst === '60'
                ? {
                    grupo: 'ICMS60',
                    orig: 0,
                    cst: '60',
                    vBCSTRet: 120 + i,
                    pST: 18,
                    vICMSSTRet: 21.6,
                    vBCFCPSTRet: 120 + i,
                    pFCPSTRet: 2,
                    vFCPSTRet: 2.4,
                  }
                : {
                    grupo: 'ICMS90',
                    orig: 0,
                    cst: '90',
                    modBC: 3,
                    vBC: 100 + i,
                    pICMS: 12,
                    vICMS: 0,
                    modBCST: 4,
                    vBCST: 140 + i,
                    pICMSST: 18,
                    vICMSST: 28.8,
                  };
    saida.push(itemCst(`${seed}:item${i}`, icms, { vUn, qtd }));
  }
  return saida;
}

GERADORES.push(() => {
  const proc = notaSimples('muitos10', itensMistos('muitos10', 10));
  writeFileSync(join(RAIZ_FIXTURES, 'nfe-muitos-itens-10.xml'), nfeProcToXml(proc), 'utf8');
  registrar('nfe-muitos-itens-10.xml', 'NF-e produção com 10 itens mistos', {
    chave: proc.nfe.chave,
    mod: 55,
    tpAmb: 1,
    cStat: 100,
    itens: 10,
  });
});
GERADORES.push(() => {
  const proc = notaSimples('muitos60', itensMistos('muitos60', 60));
  writeFileSync(join(RAIZ_FIXTURES, 'nfe-muitos-itens-60.xml'), nfeProcToXml(proc), 'utf8');
  registrar('nfe-muitos-itens-60.xml', 'NF-e produção com 60 itens mistos', {
    chave: proc.nfe.chave,
    mod: 55,
    tpAmb: 1,
    cStat: 100,
    itens: 60,
  });
});
GERADORES.push(() => {
  const proc = notaSimples('muitos120', itensMistos('muitos120', 120));
  writeFileSync(join(RAIZ_FIXTURES, 'nfe-muitos-itens-120.xml'), nfeProcToXml(proc), 'utf8');
  registrar('nfe-muitos-itens-120.xml', 'NF-e produção com 120 itens mistos', {
    chave: proc.nfe.chave,
    mod: 55,
    tpAmb: 1,
    cStat: 100,
    itens: 120,
  });
});

GERADORES.push(() => {
  const itens = [
    itemCst(
      'duplicatas',
      {
        grupo: 'ICMS00',
        orig: 0,
        cst: '00',
        modBC: 3,
        vBC: 5000,
        pICMS: 18,
        vICMS: 0,
      },
      { vUn: 50, qtd: 100 },
    ),
  ];
  const base = montaNFe({ seed: 'duplicatas', itens });
  const vNf = base.total.icmsTot.vNF;
  const terco = round2(vNf / 3);
  const cobr: Cobr = {
    fat: { nFat: 'NF-2026-0042', vOrig: vNf, vDesc: 0, vLiq: vNf },
    dup: [
      { nDup: '001', dVenc: '2026-12-20', vDup: terco },
      { nDup: '002', dVenc: '2027-01-20', vDup: terco },
      { nDup: '003', dVenc: '2027-02-20', vDup: round2(vNf - 2 * terco) },
    ],
  };
  base.cobr = cobr;
  base.pag = { detPag: [{ indPag: 1, tPag: '14', vPag: vNf }] };
  const proc = montaNFeProc(base, protNFeSintetico(base));
  writeFileSync(join(RAIZ_FIXTURES, 'nfe-duplicatas.xml'), nfeProcToXml(proc), 'utf8');
  registrar('nfe-duplicatas.xml', 'NF-e produção com fatura e 3 duplicatas', {
    chave: proc.nfe.chave,
    mod: 55,
    tpAmb: 1,
    cStat: 100,
    itens: 1,
  });
});

GERADORES.push(() => {
  const transp: Transp = {
    modFrete: 0,
    transporta: {
      cnpj: cnpjSintetico('transportadora'),
      xNome: 'Transportadora Rota Sol Ltda',
      ie: String(deriva('transportadora:ie', 100000000, 999999999)),
      xEnder: 'Rod. Anhanguera km 66',
      xMun: 'Campinas',
      uf: 'SP',
    },
    retTransp: {
      vServ: 250,
      vBCRet: 250,
      pICMSRet: 12,
      vICMSRet: 30,
      cfop: '5352',
      cMunFG: 3550308,
    },
    veicTransp: { placa: 'BRA2E19', uf: 'SP', rntc: '12345678' },
    reboque: [
      { placa: 'BRC1A22', uf: 'SP' },
      { placa: 'BRD3E34', uf: 'MG' },
    ],
    vol: [
      {
        qVol: 10,
        esp: 'CAIXA',
        marca: 'SINTÉTICO',
        nVol: '0001',
        pesoL: 120.5,
        pesoB: 125,
        lacres: [{ nLacre: 'LACRE-01' }, { nLacre: 'LACRE-02' }],
      },
      {
        qVol: 5,
        esp: 'FARDO',
        marca: 'SINTÉTICO',
        nVol: '0002',
        pesoL: 80,
        pesoB: 82,
        lacres: [],
      },
    ],
  };
  const base = montaNFe({ seed: 'transporte', itens: itensMistos('transporte', 5) });
  base.transp = transp;
  const proc = montaNFeProc(base, protNFeSintetico(base));
  writeFileSync(join(RAIZ_FIXTURES, 'nfe-transporte.xml'), nfeProcToXml(proc), 'utf8');
  registrar(
    'nfe-transporte.xml',
    'NF-e produção com transporte completo (transporta, retTransp, veicTransp, 2 reboques, volumes com lacres)',
    { chave: proc.nfe.chave, mod: 55, tpAmb: 1, cStat: 100, itens: 5 },
  );
});

// ---------------------------------------------------------------------------
// 4. Ambientes e situações de protocolo
// ---------------------------------------------------------------------------

GERADORES.push(() => {
  const itens = [
    itemCst('homologacao', {
      grupo: 'ICMS00',
      orig: 0,
      cst: '00',
      modBC: 3,
      vBC: 100,
      pICMS: 18,
      vICMS: 0,
    }),
  ];
  const base = montaNFe({ seed: 'homologacao', itens, tpAmb: 2 });
  const proc = montaNFeProc(base, protNFeSintetico(base));
  writeFileSync(join(RAIZ_FIXTURES, 'nfe-homologacao.xml'), nfeProcToXml(proc), 'utf8');
  registrar('nfe-homologacao.xml', 'NF-e homologação (tpAmb = 2) — “SEM VALOR FISCAL”', {
    chave: proc.nfe.chave,
    mod: 55,
    tpAmb: 2,
    cStat: 100,
    itens: 1,
    problemas: ['AMBIENTE_HOMOLOGACAO'],
  });
});

GERADORES.push(() => {
  const itens = [
    itemCst('foraprazo', {
      grupo: 'ICMS00',
      orig: 0,
      cst: '00',
      modBC: 3,
      vBC: 100,
      pICMS: 18,
      vICMS: 0,
    }),
  ];
  const base = montaNFe({ seed: 'foraprazo', itens });
  const proc = montaNFeProc(
    base,
    protNFeSintetico(base, {
      cStat: 150,
      xMotivo: 'Autorizado o uso da NF-e, autorização fora de prazo',
    }),
  );
  writeFileSync(join(RAIZ_FIXTURES, 'nfe-fora-prazo.xml'), nfeProcToXml(proc), 'utf8');
  registrar('nfe-fora-prazo.xml', 'NF-e autorizada fora de prazo (cStat 150)', {
    chave: proc.nfe.chave,
    mod: 55,
    tpAmb: 1,
    cStat: 150,
    itens: 1,
  });
});

GERADORES.push(() => {
  const itens = [
    itemCst('denegada', {
      grupo: 'ICMS00',
      orig: 0,
      cst: '00',
      modBC: 3,
      vBC: 100,
      pICMS: 18,
      vICMS: 0,
    }),
  ];
  const base = montaNFe({ seed: 'denegada', itens });
  const proc = montaNFeProc(base, protNFeSintetico(base, { cStat: 110, xMotivo: 'Uso Denegado' }));
  writeFileSync(join(RAIZ_FIXTURES, 'nfe-denegada.xml'), nfeProcToXml(proc), 'utf8');
  registrar('nfe-denegada.xml', 'NF-e denegada (cStat 110 — irregularidade fiscal)', {
    chave: proc.nfe.chave,
    mod: 55,
    tpAmb: 1,
    cStat: 110,
    itens: 1,
    valido: false,
    problemas: ['USO_DENEGADO'],
  });
});

GERADORES.push(() => {
  const itens = [
    itemCst('semprotocolo', {
      grupo: 'ICMS00',
      orig: 0,
      cst: '00',
      modBC: 3,
      vBC: 100,
      pICMS: 18,
      vICMS: 0,
    }),
  ];
  const nfe = montaNFe({ seed: 'semprotocolo', itens });
  writeFileSync(join(RAIZ_FIXTURES, 'nfe-sem-protocolo.xml'), nfeToXml(nfe), 'utf8');
  registrar('nfe-sem-protocolo.xml', 'NF-e raiz (sem protocolo) — não autorizada', {
    tipo: 'NFe',
    chave: nfe.chave,
    mod: 55,
    tpAmb: 1,
    cStat: null,
    itens: 1,
    valido: false,
    problemas: ['SEM_PROTOCOLO'],
  });
});

GERADORES.push(() => {
  const itens = [
    itemCst('cnpjalpha', {
      grupo: 'ICMS00',
      orig: 0,
      cst: '00',
      modBC: 3,
      vBC: 100,
      pICMS: 18,
      vICMS: 0,
    }),
  ];
  const base = montaNFe({ seed: 'cnpjalpha', itens, emit: emitenteCnpjAlfanumerico() });
  const proc = montaNFeProc(base, protNFeSintetico(base));
  writeFileSync(join(RAIZ_FIXTURES, 'nfe-cnpj-alfanumerico.xml'), nfeProcToXml(proc), 'utf8');
  registrar(
    'nfe-cnpj-alfanumerico.xml',
    'NF-e produção emitida por CNPJ alfanumérico (NT 2025.001)',
    { chave: proc.nfe.chave, mod: 55, tpAmb: 1, cStat: 100, itens: 1 },
  );
});

// ---------------------------------------------------------------------------
// 5. DIFAL, ISSQN conjugado, IBS/CBS (NT 2024.002)
// ---------------------------------------------------------------------------

GERADORES.push(() => {
  const icmsUfDest: IcmsUfDest = {
    vBCUFDest: 1000,
    vBCFCPUFDest: 1000,
    pFCPUFDest: 2,
    pICMSUFDest: 18,
    pICMSInter: 7,
    pICMSInterPart: 40,
    vFCPUFDest: 20,
    vICMSUFDest: 44,
    vICMSUFRemet: 28,
  };
  const enderDest: Endereco = {
    xLgr: 'Rua Marechal Deodoro',
    nro: '55',
    xBairro: 'Centro',
    cMun: 4106902,
    xMun: 'Curitiba',
    uf: 'PR',
    cep: '80010100',
    cPais: 1058,
    xPais: 'Brasil',
  };
  const dest: Dest = {
    ...destinatarioSintetico('difal:dest'),
    enderDest,
    indIEDest: 9,
    ie: undefined,
  };
  const itens = [
    itemSintetico({
      seed: 'difal:item',
      icms: { grupo: 'ICMS00', orig: 0, cst: '00', modBC: 3, vBC: 1000, pICMS: 7, vICMS: 70 },
      icmsUfDest,
      vUn: 10,
      qtd: 100,
    }),
  ];
  const base = montaNFe({ seed: 'difal', itens, idDest: 2, indFinal: 1, dest });
  const proc = montaNFeProc(base, protNFeSintetico(base));
  writeFileSync(join(RAIZ_FIXTURES, 'nfe-difal.xml'), nfeProcToXml(proc), 'utf8');
  registrar(
    'nfe-difal.xml',
    'NF-e com DIFAL — ICMS interestadual ao consumidor final (ICMSUFDest)',
    { chave: proc.nfe.chave, mod: 55, tpAmb: 1, cStat: 100, itens: 1 },
  );
});

GERADORES.push(() => {
  const issqn: Issqn = {
    vBC: 2000,
    vAliq: 5,
    vISSQN: 100,
    cMunFG: 3550308,
    cListServ: '0107',
    indISS: 1,
    indIncentivo: 2,
  };
  const servico = itemSintetico({
    seed: 'issqn:serv',
    icms: { grupo: 'ICMS40', orig: 0, cst: '41' },
    issqn,
    indTot: 0,
    vUn: 20,
    qtd: 100,
  });
  const peca = itemSintetico({
    seed: 'issqn:peca',
    icms: { grupo: 'ICMS00', orig: 0, cst: '00', modBC: 3, vBC: 500, pICMS: 18, vICMS: 0 },
    vUn: 5,
    qtd: 100,
  });
  const base = montaNFe({ seed: 'issqn', itens: [peca, servico] });
  const proc = montaNFeProc(base, protNFeSintetico(base));
  writeFileSync(join(RAIZ_FIXTURES, 'nfe-issqn-conjugada.xml'), nfeProcToXml(proc), 'utf8');
  registrar(
    'nfe-issqn-conjugada.xml',
    'NF-e conjugada: peça com ICMS + serviço com ISSQN (indTot = 0 no serviço)',
    { chave: proc.nfe.chave, mod: 55, tpAmb: 1, cStat: 100, itens: 2 },
  );
});

GERADORES.push(() => {
  const ibscbsSel: IbsCbsSel = {
    cst: '01',
    cClassTrib: '010001',
    gIBSCBS: {
      vBC: 1000,
      gIBSUF: { pIBSUF: 1.3, vTribOP: 13, vIBSUF: 13 },
      gIBSMun: { pIBSMun: 0.9, vTribOP: 9, vIBSMun: 9 },
      gCBS: { pCBS: 1.2, vTribOp: 12, vCBS: 12 },
    },
  };
  const ibscbsSelTot: IbsCbsSelTot = {
    vBCIBSCBS: 1000,
    gIBS: {
      gIBSUFTot: { vDif: 0, vDevTrib: 0, vDeson: 0, vIBSUF: 13 },
      gIBSMunTot: { vDif: 0, vDevTrib: 0, vDeson: 0, vIBSMun: 9, vIBSTot: 22 },
      vCresPres: 0,
      vCredPresCondSus: 0,
    },
    gCBS: { vDif: 0, vDevTrib: 0, vDeson: 0, vCBS: 12, vCresPres: 0, vCredPresCondSus: 0 },
  };
  const itens = [
    itemSintetico({
      seed: 'rtc:item',
      icms: { grupo: 'ICMS00', orig: 0, cst: '00', modBC: 3, vBC: 1000, pICMS: 18, vICMS: 180 },
      ibscbsSel,
      vUn: 10,
      qtd: 100,
    }),
  ];
  const base = montaNFe({ seed: 'rtc', itens, ibscbsSelTot });
  const proc = montaNFeProc(base, protNFeSintetico(base));
  writeFileSync(join(RAIZ_FIXTURES, 'nfe-rtc-ibscbs.xml'), nfeProcToXml(proc), 'utf8');
  registrar(
    'nfe-rtc-ibscbs.xml',
    'NF-e com IBS/CBS da Reforma Tributária (NT 2024.002 v1.10 — tributos por fora no vNF)',
    { chave: proc.nfe.chave, mod: 55, tpAmb: 1, cStat: 100, itens: 1 },
  );
});

// ---------------------------------------------------------------------------
// 6. NFC-e
// ---------------------------------------------------------------------------

const URL_CONSULTA_NFCE = 'https://www.sefaz.rs.gov.br/consulta/NFCe';

/**
 * Conteúdo do `qrCode` da NFC-e (infNFeSupl). A geração byte-a-byte do QR
 * (HMAC-SHA1 conforme o Manual de Especificações Técnicas do DANFE NFC-e e
 * QR Code) pertence ao marco de renderização; este corpus fixa o campo com
 * parâmetros reais da nota (chave, ambiente, valores) e marcadores sintéticos
 * para digVal/cHashQRCode.
 */
function qrCodeNfce(chave: string, vNf: number, vIcms: number, cpf?: string): string {
  const params = new URLSearchParams({
    chNFe: chave,
    nVersao: '100',
    tpAmb: '1',
    ...(cpf ? { cDest: cpf } : {}),
    dhEmi: '2026-11-20T10:00:00-03:00',
    vNF: vNf.toFixed(2),
    vICMS: vIcms.toFixed(2),
    digVal: '',
    cIdToken: '000001',
    cHashQRCode: 'A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0',
  });
  return `${URL_CONSULTA_NFCE}?${params.toString().replace(/\+/g, '%20')}`;
}

function emitenteSimplesNfce(): Emit {
  return {
    cnpj: cnpjSintetico('nfce:emit'),
    xNome: 'Mercado Bom Prezzo Ltda ME',
    xFant: 'Bom Prezzo',
    enderEmit: {
      xLgr: 'Rua das Palmeiras',
      nro: '250',
      xCpl: 'Loja 12',
      xBairro: 'Jardim Brasil',
      cMun: 3550308,
      xMun: 'Campinas',
      uf: 'SP',
      cep: '13010001',
      cPais: 1058,
      xPais: 'Brasil',
      fone: '1930000000',
    },
    ie: '110042490114',
    crt: 1,
  };
}

GERADORES.push(() => {
  const itens = [
    itemSintetico({
      seed: 'nfce:consumidor:1',
      icms: { grupo: 'ICMSSN102', orig: 0, csosn: '102' },
      vUn: 4.5,
      qtd: 2,
    }),
    itemSintetico({
      seed: 'nfce:consumidor:2',
      icms: {
        grupo: 'ICMSSN102',
        orig: 0,
        csosn: '400',
      },
      vUn: 12.9,
      qtd: 1,
    }),
  ];
  const dest: Dest = { cpf: '11144477735', indIEDest: 9 };
  const opts = {
    seed: 'nfce:consumidor',
    itens,
    mod: 65 as const,
    indFinal: 1 as const,
    indPres: 1 as const,
    dest,
    emit: emitenteSimplesNfce(),
  };
  // Primeiro build para conhecer vNF/vICMS; segundo build com o pagamento fechado.
  const pre = montaNFe(opts);
  const vNf = pre.total.icmsTot.vNF;
  const vIcms = pre.total.icmsTot.vICMS;
  const base = montaNFe({
    ...opts,
    detPag: [
      {
        tPag: '03' as const,
        vPag: vNf,
        card: { tpIntegra: 1 as const, tBand: '02' as const, cAut: '20261120' },
      },
    ],
  });
  base.infNFeSupl = {
    qrCode: qrCodeNfce(base.chave, vNf, vIcms, dest.cpf),
    urlChave: URL_CONSULTA_NFCE,
  };
  const proc = montaNFeProc(base, protNFeSintetico(base));
  writeFileSync(join(RAIZ_FIXTURES, 'nfce-consumidor-cpf.xml'), nfeProcToXml(proc), 'utf8');
  registrar(
    'nfce-consumidor-cpf.xml',
    'NFC-e com consumidor identificado por CPF, cartão de crédito e QR Code (CDATA)',
    { chave: proc.nfe.chave, mod: 65, tpAmb: 1, cStat: 100, itens: 2 },
  );
});

GERADORES.push(() => {
  const itens = [
    itemSintetico({
      seed: 'nfce:anon:1',
      icms: { grupo: 'ICMSSN102', orig: 0, csosn: '102' },
      vUn: 19.9,
      qtd: 1,
    }),
    itemSintetico({
      seed: 'nfce:anon:2',
      icms: { grupo: 'ICMSSN102', orig: 0, csosn: '102' },
      vUn: 0.99,
      qtd: 3,
    }),
  ];
  const opts = {
    seed: 'nfce:anonima',
    itens,
    mod: 65 as const,
    dest: null,
    emit: emitenteSimplesNfce(),
  };
  const pre = montaNFe(opts);
  const vNf = pre.total.icmsTot.vNF;
  const vIcms = pre.total.icmsTot.vICMS;
  const base = montaNFe({
    ...opts,
    detPag: [{ tPag: '17' as const, vPag: vNf, xPag: 'PIX' }],
  });
  base.infNFeSupl = {
    qrCode: qrCodeNfce(base.chave, vNf, vIcms),
    urlChave: URL_CONSULTA_NFCE,
  };
  const proc = montaNFeProc(base, protNFeSintetico(base));
  writeFileSync(join(RAIZ_FIXTURES, 'nfce-anonima.xml'), nfeProcToXml(proc), 'utf8');
  registrar('nfce-anonima.xml', 'NFC-e sem consumidor identificado, pagamento PIX', {
    chave: proc.nfe.chave,
    mod: 65,
    tpAmb: 1,
    cStat: 100,
    itens: 2,
  });
});

GERADORES.push(() => {
  const itens: Det[] = [];
  for (let i = 1; i <= 20; i++) {
    itens.push(
      itemSintetico({
        seed: `nfce20:${i}`,
        icms: { grupo: 'ICMSSN102', orig: 0, csosn: '102' },
        vUn: round2((100 + i) / 100),
        qtd: i,
      }),
    );
  }
  const opts = {
    seed: 'nfce:itens20',
    itens,
    mod: 65 as const,
    dest: null,
    emit: emitenteSimplesNfce(),
  };
  const pre = montaNFe(opts);
  const vNf = pre.total.icmsTot.vNF;
  const vIcms = pre.total.icmsTot.vICMS;
  const pago = round2(vNf + 10);
  const base = montaNFe({
    ...opts,
    detPag: [{ tPag: '01' as const, vPag: pago }],
    vTroco: 10,
  });
  base.infNFeSupl = {
    qrCode: qrCodeNfce(base.chave, vNf, vIcms),
    urlChave: URL_CONSULTA_NFCE,
  };
  const proc = montaNFeProc(base, protNFeSintetico(base));
  writeFileSync(join(RAIZ_FIXTURES, 'nfce-itens-20.xml'), nfeProcToXml(proc), 'utf8');
  registrar('nfce-itens-20.xml', 'NFC-e com 20 itens, pagamento em dinheiro com troco e QR Code', {
    chave: proc.nfe.chave,
    mod: 65,
    tpAmb: 1,
    cStat: 100,
    itens: 20,
  });
});

// ---------------------------------------------------------------------------
// 7. Eventos (cancelamento e CC-e)
// ---------------------------------------------------------------------------

GERADORES.push(() => {
  const base = montaNFe({
    seed: 'evento:canc',
    itens: [
      itemCst('evento:canc', {
        grupo: 'ICMS00',
        orig: 0,
        cst: '00',
        modBC: 3,
        vBC: 100,
        pICMS: 18,
        vICMS: 0,
      }),
    ],
  });
  const proc = montaNFeProc(base, protNFeSintetico(base));
  const evento = montaEvento({
    seed: 'evento:canc',
    chNFe: base.chave,
    tpEvento: TP_EVENTO_CANCELAMENTO,
    cnpjAutor: base.emit.cnpj,
    cancelamento: {
      nProt: proc.protNFe?.nProt ?? '135000000000001',
      xJust: 'Erro na emissão: valores divergentes do pedido.',
    },
    ret: { cStat: 101, xMotivo: 'Cancelamento de NF-e homologado' },
  });
  writeFileSync(join(RAIZ_FIXTURES, 'evento-cancelamento.xml'), eventoToXml(evento), 'utf8');
  manifest.push({
    arquivo: 'evento-cancelamento.xml',
    descricao: 'Evento de cancelamento homologado (tpEvento 110111, cStat 101)',
    tipo: 'evento',
    chave: base.chave,
    mod: 55,
    tpAmb: 1,
    cStat: 101,
    itens: 1,
    valido: true,
  });
});

GERADORES.push(() => {
  const base = montaNFe({
    seed: 'evento:cce',
    itens: [
      itemCst('evento:cce', {
        grupo: 'ICMS00',
        orig: 0,
        cst: '00',
        modBC: 3,
        vBC: 100,
        pICMS: 18,
        vICMS: 0,
      }),
    ],
  });
  const evento = montaEvento({
    seed: 'evento:cce',
    chNFe: base.chave,
    tpEvento: TP_EVENTO_CCE,
    cnpjAutor: base.emit.cnpj,
    nSeqEvento: 1,
    cce: {
      xCorrecao: 'Corrigir razão social do destinatário para "Comercial Horizonte S.A.".',
    },
    ret: { cStat: 135, xMotivo: 'Evento registrado e vinculado a NF-e' },
  });
  writeFileSync(join(RAIZ_FIXTURES, 'evento-cce.xml'), eventoToXml(evento), 'utf8');
  manifest.push({
    arquivo: 'evento-cce.xml',
    descricao: 'Carta de Correção registrada (tpEvento 110110, cStat 135)',
    tipo: 'evento',
    chave: base.chave,
    mod: 55,
    tpAmb: 1,
    cStat: 135,
    itens: 1,
    valido: true,
  });
});

// ---------------------------------------------------------------------------
// Emitente com CNPJ alfanumérico (NT 2025.001 — vigente desde 07/2026)
// ---------------------------------------------------------------------------

function emitenteCnpjAlfanumerico(): Emit {
  const base = 'AB12CD34EF56';
  return {
    ...emitenteSintetico('cnpjalpha'),
    cnpj: `${base}${calculaDvCnpj(base)}`,
  };
}

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------

mkdirSync(RAIZ_FIXTURES, { recursive: true });
for (const gera of GERADORES) gera();

manifest.sort((a, b) => a.arquivo.localeCompare(b.arquivo));
writeFileSync(
  join(RAIZ_FIXTURES, 'manifest.json'),
  `${JSON.stringify({ gerado: 'scripts/generate-fixtures.ts', entradas: manifest }, null, 2)}\n`,
  'utf8',
);
console.log(`${manifest.length} fixtures escritos em ${RAIZ_FIXTURES}`);
