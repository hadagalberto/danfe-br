import { describe, expect, it } from 'vitest';
import { itemSintetico, montaNFe } from '../src/fixtures/factory';
import type { Det, NFe } from '../src/model/nfe';
import { validaItens, validaTotais } from '../src/validate/totais';

const cent = (v: number): number => Math.round(v * 100);

function nfeComItens(dets: Det[]): NFe {
  return montaNFe({ seed: 'totais-teste', itens: dets });
}

describe('validaTotais — somatórios do grupo W (MOC cStat 531-609)', () => {
  it('não aponta problemas para totais recomputados pela fábrica', () => {
    const nfe = nfeComItens([
      itemSintetico({
        seed: 't1',
        icms: { grupo: 'ICMS00', orig: 0, cst: '00', modBC: 3, vBC: 1000, pICMS: 18, vICMS: 180 },
        vUn: 10,
        qtd: 100,
      }),
      itemSintetico({
        seed: 't2',
        icms: {
          grupo: 'ICMS10',
          orig: 0,
          cst: '10',
          modBC: 3,
          vBC: 2000,
          pICMS: 18,
          vICMS: 360,
          modBCST: 4,
          vBCST: 2800,
          pICMSST: 18,
          vICMSST: 144,
        },
        vUn: 20,
        qtd: 100,
        vFrete: 50,
        vSeg: 10,
        vDesc: 30,
        vOutro: 5,
      }),
    ]);
    expect(validaTotais(nfe)).toEqual([]);
    expect(validaItens(nfe)).toEqual([]);
  });

  it('detecta vProd divergente do somatório dos itens (cStat 564)', () => {
    const nfe = nfeComItens([
      itemSintetico({ seed: 'a', icms: { grupo: 'ICMS40', orig: 0, cst: '40' }, vUn: 10, qtd: 2 }),
    ]);
    nfe.total.icmsTot.vProd = nfe.total.icmsTot.vProd + 1;
    const problemas = validaTotais(nfe);
    const p = problemas.find((x) => x.code === 'TOTAL_VPROD');
    expect(p).toBeDefined();
    expect(p?.cStat).toBe(564);
    expect(p?.campo).toBe('total/ICMSTot/vProd');
  });

  it('detecta vICMS divergente (cStat 532), vBC (531) e vST (534)', () => {
    const nfe = nfeComItens([
      itemSintetico({
        seed: 'b',
        icms: {
          grupo: 'ICMS10',
          orig: 0,
          cst: '10',
          modBC: 3,
          vBC: 1000,
          pICMS: 18,
          vICMS: 180,
          modBCST: 4,
          vBCST: 1400,
          pICMSST: 18,
          vICMSST: 72,
        },
        vUn: 10,
        qtd: 100,
      }),
    ]);
    nfe.total.icmsTot.vICMS = 0;
    nfe.total.icmsTot.vBC = 0;
    nfe.total.icmsTot.vST = 0;
    const codigos = validaTotais(nfe).map((p) => p.code);
    expect(codigos).toContain('TOTAL_VICMS');
    expect(codigos).toContain('TOTAL_VBC');
    expect(codigos).toContain('TOTAL_VST');
  });

  it('somatórios ignoram itens com indTot = 0 (I17b)', () => {
    const nfe = montaNFe({
      seed: 'indtot',
      itens: [
        itemSintetico({
          seed: 'c1',
          icms: { grupo: 'ICMS00', orig: 0, cst: '00', modBC: 3, vBC: 100, pICMS: 18, vICMS: 18 },
          vUn: 1,
          qtd: 1,
        }),
        itemSintetico({
          seed: 'c2',
          icms: {
            grupo: 'ICMS00',
            orig: 0,
            cst: '00',
            modBC: 3,
            vBC: 999,
            pICMS: 18,
            vICMS: 179.82,
          },
          vUn: 9.99,
          qtd: 100,
          indTot: 0,
        }),
      ],
    });
    // o segundo item não compõe os totais
    expect(cent(nfe.total.icmsTot.vProd)).toBe(cent(1));
    expect(cent(nfe.total.icmsTot.vBC)).toBe(cent(100));
    expect(validaTotais(nfe)).toEqual([]);
  });

  it('vICMSDeson soma ICMS40 e ICMS30 (cStat 795)', () => {
    const nfe = nfeComItens([
      itemSintetico({
        seed: 'd1',
        icms: { grupo: 'ICMS40', orig: 0, cst: '40', vICMSDeson: 100, motDesICMS: 9 },
        vUn: 10,
        qtd: 10,
      }),
      itemSintetico({
        seed: 'd2',
        icms: {
          grupo: 'ICMS30',
          orig: 0,
          cst: '30',
          modBCST: 4,
          vBCST: 140,
          pICMSST: 18,
          vICMSST: 25.2,
          vICMSDeson: 50,
          motDesICMS: 3,
        },
        vUn: 10,
        qtd: 10,
      }),
    ]);
    expect(cent(nfe.total.icmsTot.vICMSDeson)).toBe(cent(150));
    expect(validaTotais(nfe)).toEqual([]);
    nfe.total.icmsTot.vICMSDeson = 149;
    expect(validaTotais(nfe).map((p) => p.code)).toContain('TOTAL_VICMSDESON');
  });
});

describe('validaTotais — fórmula do vNF (W16-10, cStat 610)', () => {
  it('vNF = vProd − vDesc + frete + seguro + outros + IPI + ST ...', () => {
    const nfe = nfeComItens([
      itemSintetico({
        seed: 'f1',
        icms: {
          grupo: 'ICMS10',
          orig: 0,
          cst: '10',
          modBC: 3,
          vBC: 1000,
          pICMS: 18,
          vICMS: 180,
          modBCST: 4,
          vBCST: 1400,
          pICMSST: 18,
          vICMSST: 72,
        },
        ipi: { grupo: 'IPITrib', cEnq: '999', cst: '50', vBC: 1000, pIPI: 10, vIPI: 100 },
        vUn: 10,
        qtd: 100,
        vFrete: 120,
        vSeg: 30,
        vDesc: 50,
        vOutro: 0,
      }),
    ]);
    // vProd 1000 − vDesc 50 + vST 72 + vFrete 120 + vSeg 30 + vIPI 100 = 1272
    expect(nfe.total.icmsTot.vNF).toBe(1272);
    expect(validaTotais(nfe)).toEqual([]);
  });

  it('aceita divergência de até R$ 0,50 (nota *3 — NT 2012/003)', () => {
    const nfe = nfeComItens([
      itemSintetico({
        seed: 'f2',
        icms: { grupo: 'ICMS00', orig: 0, cst: '00', modBC: 3, vBC: 100, pICMS: 18, vICMS: 18 },
        vUn: 1,
        qtd: 1,
      }),
    ]);
    nfe.total.icmsTot.vNF = nfe.total.icmsTot.vNF + 0.5;
    expect(validaTotais(nfe).map((p) => p.code)).not.toContain('TOTAL_VNF');
    nfe.total.icmsTot.vNF = nfe.total.icmsTot.vNF + 0.01; // 0,51 além do esperado
    const p = validaTotais(nfe).find((x) => x.code === 'TOTAL_VNF');
    expect(p).toBeDefined();
    expect(p?.cStat).toBe(610);
    expect(p?.regra).toBe('W16-10');
  });

  it('Exceção 3: aceita a fórmula sem subtrair o vICMSDeson', () => {
    const nfe = nfeComItens([
      itemSintetico({
        seed: 'f3',
        icms: { grupo: 'ICMS40', orig: 0, cst: '40', vICMSDeson: 40, motDesICMS: 9 },
        vUn: 10,
        qtd: 10,
      }),
    ]);
    // fórmula oficial: vProd 100 − deson 40 = 60; Exceção 3 aceita 100.
    const fórmulaOficial = nfe.total.icmsTot.vProd - nfe.total.icmsTot.vICMSDeson;
    nfe.total.icmsTot.vNF = fórmulaOficial;
    expect(validaTotais(nfe).map((p) => p.code)).not.toContain('TOTAL_VNF');
    nfe.total.icmsTot.vNF = fórmulaOficial + nfe.total.icmsTot.vICMSDeson; // sem subtrair
    expect(validaTotais(nfe).map((p) => p.code)).not.toContain('TOTAL_VNF');
    nfe.total.icmsTot.vNF = fórmulaOficial + 60; // absurdo
    expect(validaTotais(nfe).map((p) => p.code)).toContain('TOTAL_VNF');
  });

  it('vNF inclui IPI devolvido (vIPIDevol, NT 2013/005)', () => {
    const nfe = nfeComItens([
      itemSintetico({
        seed: 'f4',
        icms: { grupo: 'ICMS40', orig: 0, cst: '40' },
        impostoDevol: { pDevol: 100, ipiDevol: { vIPIDevol: 77.77 } },
        vUn: 5,
        qtd: 10,
      }),
    ]);
    expect(nfe.total.icmsTot.vNF).toBeCloseTo(50 + 77.77, 2);
    expect(validaTotais(nfe)).toEqual([]);
  });

  it('vNF inclui vServ para nota conjugada com ISSQN (W16-10 + W18)', () => {
    const nfe = montaNFe({
      seed: 'f5',
      itens: [
        itemSintetico({
          seed: 'f5:peca',
          icms: { grupo: 'ICMS00', orig: 0, cst: '00', modBC: 3, vBC: 500, pICMS: 18, vICMS: 90 },
          vUn: 5,
          qtd: 100,
        }),
        itemSintetico({
          seed: 'f5:serv',
          icms: { grupo: 'ICMS40', orig: 0, cst: '41' },
          issqn: {
            vBC: 2000,
            vAliq: 5,
            vISSQN: 100,
            cMunFG: 3550308,
            cListServ: '0107',
            indISS: 1,
            indIncentivo: 2,
          },
          vUn: 20,
          qtd: 100,
          indTot: 0,
        }),
      ],
    });
    // peça 500 (vProd) + serviço 2000 (vServ) — serviço com indTot = 0
    expect(cent(nfe.total.icmsTot.vProd)).toBe(cent(500));
    expect(nfe.total.issqnTot?.vServ).toBe(2000);
    expect(nfe.total.icmsTot.vNF).toBe(2500);
    expect(validaTotais(nfe)).toEqual([]);
  });
});

describe('validaItens — recomputação por item (cStat 629/630/528)', () => {
  it('não aponta problemas para itens consistentes', () => {
    const nfe = nfeComItens([
      itemSintetico({
        seed: 'i1',
        icms: { grupo: 'ICMS00', orig: 0, cst: '00', modBC: 3, vBC: 1000, pICMS: 18, vICMS: 180 },
        vUn: 3.33,
        qtd: 3,
      }),
    ]);
    expect(validaItens(nfe)).toEqual([]);
  });

  it('detecta vProd ≠ qCom × vUnCom (cStat 629, tolerância R$ 0,01)', () => {
    const nfe = nfeComItens([
      itemSintetico({
        seed: 'i2',
        icms: { grupo: 'ICMS40', orig: 0, cst: '40' },
        vUn: 3,
        qtd: 3,
      }),
    ]);
    // qCom × vUnCom = 9,00.
    nfe.det[0]!.prod.vProd = 9.01; // diferença de exatamente R$ 0,01 → dentro
    expect(validaItens(nfe).map((p) => p.code)).not.toContain('ITEM_VPROD');
    nfe.det[0]!.prod.vProd = 9.02; // diferença de R$ 0,02 → fora
    const p = validaItens(nfe).find((x) => x.code === 'ITEM_VPROD');
    expect(p).toBeDefined();
    expect(p?.cStat).toBe(629);
  });

  it('detecta divergência no par tributável (cStat 630)', () => {
    const nfe = nfeComItens([
      itemSintetico({ seed: 'i3', icms: { grupo: 'ICMS40', orig: 0, cst: '40' }, vUn: 2, qtd: 2 }),
    ]);
    nfe.det[0]!.prod.vUnTrib = nfe.det[0]!.prod.vUnTrib + 1;
    expect(validaItens(nfe).map((p) => p.code)).toContain('ITEM_VPROD_TRIB');
  });

  it('detecta vICMS ≠ vBC × pICMS (cStat 528, tolerância R$ 0,01)', () => {
    const nfe = nfeComItens([
      itemSintetico({
        seed: 'i4',
        icms: { grupo: 'ICMS00', orig: 0, cst: '00', modBC: 3, vBC: 333, pICMS: 18, vICMS: 59.94 },
        vUn: 3.33,
        qtd: 100,
      }),
    ]);
    expect(validaItens(nfe)).toEqual([]); // 333 × 18% = 59.94
    nfe.det[0]!.imposto.icms = {
      ...(nfe.det[0]!.imposto.icms as Extract<Det['imposto']['icms'], { cst: '00' }>),
      vICMS: 60.0, // diferença de 0,06 > tolerância
    };
    const p = validaItens(nfe).find((x) => x.code === 'ITEM_VICMS');
    expect(p).toBeDefined();
    expect(p?.cStat).toBe(528);
  });
});
