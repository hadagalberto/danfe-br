import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseNFe } from '../src/parse/nfe';
import { ParseError } from '../src/parse/xml';
import type { NFeProc } from '../src/model/nfe';

const FIXTURES = join(import.meta.dirname, 'fixtures');

function lerFixture(nome: string): string {
  return readFileSync(join(FIXTURES, nome), 'utf8');
}

function parse(nome: string): NFeProc {
  return parseNFe(lerFixture(nome));
}

describe('parseNFe — nfeProc com protocolo', () => {
  const proc = parse('nfe-cst-10.xml');

  it('extrai a chave de acesso do atributo Id (sem o literal NFe)', () => {
    expect(proc.versao).toBe('4.00');
    expect(proc.nfe.chave).toMatch(/^[0-9]{44}$/);
    expect(proc.nfe.chave.slice(0, 2)).toBe('35');
  });

  it('parseia o protocolo (protNFe/infProt)', () => {
    expect(proc.protNFe).toBeDefined();
    expect(proc.protNFe?.chNFe).toBe(proc.nfe.chave);
    expect(proc.protNFe?.cStat).toBe(100);
    expect(proc.protNFe?.xMotivo).toBe('Autorizado o uso da NF-e');
    expect(proc.protNFe?.nProt).toMatch(/^\d{15}$/);
    expect(proc.protNFe?.tpAmb).toBe(1);
  });

  it('parseia o grupo ide completo', () => {
    const { ide } = proc.nfe;
    expect(ide.cUF).toBe(35);
    expect(ide.mod).toBe(55);
    expect(ide.serie).toBe(51);
    expect(ide.dhEmi).toMatch(/^2026-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-03:00$/);
    expect(ide.tpNF).toBe(1);
    expect(ide.idDest).toBe(1);
    expect(ide.tpImp).toBe(1);
    expect(ide.tpEmis).toBe(1);
    expect(ide.cDV).toBe(Number(proc.nfe.chave.slice(43)));
    expect(ide.tpAmb).toBe(1);
    expect(ide.finNFe).toBe(1);
    expect(ide.procEmi).toBe(0);
    expect(ide.verProc).toBe('danfe-br-fixtures 0.1.0');
    expect(ide.nfRef).toEqual([]);
  });

  it('parseia emitente e destinatário com endereços', () => {
    const { emit, dest } = proc.nfe;
    expect(emit.cnpj).toMatch(/^[0-9]{14}$/);
    expect(emit.crt).toBe(3);
    expect(emit.enderEmit.cMun).toBe(3550308);
    expect(emit.enderEmit.uf).toBe('SP');
    expect(emit.enderEmit.cep).toMatch(/^[0-9]{8}$/);
    expect(dest?.cnpj).toMatch(/^[0-9]{14}$/);
    expect(dest?.indIEDest).toBe(1);
    expect(dest?.enderDest?.uf).toBe('PR');
    expect(dest?.email).toContain('@');
  });

  it('parseia o item com ICMS10 (ST + FCP), PIS e COFINS', () => {
    const det = proc.nfe.det[0]!;
    expect(det.nItem).toBe(1);
    expect(det.prod.qCom).toBeCloseTo(10, 4);
    expect(det.prod.indTot).toBe(1);
    expect(det.prod.cEAN).toBe('SEM GTIN');

    const icms = det.imposto.icms!;
    expect(icms.grupo).toBe('ICMS10');
    if (icms.grupo === 'ICMS10') {
      expect(icms.cst).toBe('10');
      expect(icms.vBC).toBeGreaterThan(0);
      expect(icms.vICMS).toBeCloseTo((icms.vBC * icms.pICMS) / 100, 2);
      expect(icms.modBCST).toBe(4);
      expect(icms.vICMSST).toBeGreaterThan(0);
      expect(icms.vFCP).toBeGreaterThan(0);
      expect(icms.vFCPST).toBeGreaterThan(0);
    }
    expect(det.imposto.pis?.grupo).toBe('PISAliq');
    expect(det.imposto.cofins?.grupo).toBe('COFINSAliq');
    expect(det.imposto.vTotTrib).toBeGreaterThanOrEqual(0);
  });

  it('parseia o total ICMSTot com vNF pela fórmula W16-10', () => {
    const t = proc.nfe.total.icmsTot;
    expect(t.vBC).toBeGreaterThan(0);
    expect(t.vST).toBeGreaterThan(0);
    expect(t.vNF).toBeGreaterThan(0);
    expect(t.vFCP).toBeGreaterThan(0);
    expect(proc.nfe.total.issqnTot).toBeUndefined();
  });

  it('parseia transp (modFrete 9), pag e campos vazios', () => {
    expect(proc.nfe.transp.modFrete).toBe(9);
    expect(proc.nfe.transp.reboque).toEqual([]);
    expect(proc.nfe.transp.vol).toEqual([]);
    expect(proc.nfe.pag.detPag).toHaveLength(1);
    expect(proc.nfe.pag.detPag[0]!.vPag).toBe(proc.nfe.total.icmsTot.vNF);
    expect(proc.nfe.autXml).toEqual([]);
    expect(proc.infNFeSupl).toBeUndefined();
  });
});

describe('parseNFe — grupos específicos do corpus', () => {
  it('duplicatas: cobr/fat/dup parseados', () => {
    const proc = parse('nfe-duplicatas.xml');
    expect(proc.nfe.cobr?.fat?.nFat).toBe('NF-2026-0042');
    expect(proc.nfe.cobr?.dup).toHaveLength(3);
    const somaDups = proc.nfe.cobr!.dup.reduce((a, d) => a + Math.round(d.vDup * 100), 0);
    expect(somaDups).toBe(Math.round(proc.nfe.total.icmsTot.vNF * 100));
    const d1 = proc.nfe.cobr!.dup[0]!;
    expect(d1.nDup).toBe('001');
    expect(d1.dVenc).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('transporte: transporta, retTransp, veicTransp, reboques, volumes e lacres', () => {
    const proc = parse('nfe-transporte.xml');
    const { transp } = proc.nfe;
    expect(transp.modFrete).toBe(0);
    expect(transp.transporta?.cnpj).toMatch(/^[0-9]{14}$/);
    expect(transp.transporta?.xNome).toContain('Transportadora');
    expect(transp.retTransp?.vServ).toBe(250);
    expect(transp.retTransp?.cfop).toBe('5352');
    expect(transp.veicTransp?.placa).toMatch(/^BR[A-Z0-9]{5}$/);
    expect(transp.reboque).toHaveLength(2);
    expect(transp.vol).toHaveLength(2);
    expect(transp.vol[0]!.lacres).toHaveLength(2);
    expect(transp.vol[0]!.lacres[0]!.nLacre).toBe('LACRE-01');
    expect(transp.vol[1]!.pesoB).toBe(82);
  });

  it('ICMSPart e ICMSST mapeiam para os grupos corretos', () => {
    const part = parse('nfe-icms-part-10.xml').nfe.det[0]!.imposto.icms!;
    expect(part.grupo).toBe('ICMSPart');
    if (part.grupo === 'ICMSPart') {
      expect(part.ufST).toBe('PR');
      expect(part.pBCOp).toBe(50);
    }
    const st = parse('nfe-icms-st-60.xml').nfe.det[0]!.imposto.icms!;
    expect(st.grupo).toBe('ICMSST');
    if (st.grupo === 'ICMSST') {
      expect(st.cst).toBe('60');
      expect(st.vBCSTDest).toBe(200);
    }
  });

  it('NFC-e: infNFeSupl/qrCode em CDATA, vTroco, tPag, indFinal/indPres', () => {
    const proc = parse('nfce-consumidor-cpf.xml');
    const nfe = proc.nfe;
    expect(nfe.ide.mod).toBe(65);
    expect(nfe.ide.indFinal).toBe(1);
    expect(nfe.ide.indPres).toBe(1);
    expect(nfe.ide.tpImp).toBe(4);
    expect(nfe.dest?.cpf).toBe('11144477735');
    expect(nfe.dest?.indIEDest).toBe(9);
    const detPag = nfe.pag.detPag[0]!;
    expect(detPag.tPag).toBe('03');
    expect(detPag.card?.tpIntegra).toBe(1);
    expect(detPag.card?.tBand).toBe('02');
    // infNFeSupl é irmão do infNFe (nível NFeProc), não do conteúdo do infNFe.
    expect(proc.infNFeSupl?.qrCode).toContain(`chNFe=${nfe.chave}`);
    expect(proc.infNFeSupl?.urlChave).toContain('consulta');
  });

  it('NFC-e anônima: sem destinatário, PIX (tPag 17)', () => {
    const nfe = parse('nfce-anonima.xml').nfe;
    expect(nfe.dest).toBeUndefined();
    expect(nfe.pag.detPag[0]!.tPag).toBe('17');
    expect(nfe.pag.detPag[0]!.xPag).toBe('PIX');
  });

  it('NFC-e com troco em dinheiro', () => {
    const nfe = parse('nfce-itens-20.xml').nfe;
    expect(nfe.det).toHaveLength(20);
    const dinheiro = nfe.pag.detPag[0]!;
    expect(dinheiro.tPag).toBe('01');
    expect(nfe.pag.vTroco).toBe(10);
    expect(dinheiro.vPag).toBeCloseTo(nfe.total.icmsTot.vNF + 10, 2);
  });

  it('CNPJ alfanumérico no emitente gera chave alfanumérica (NT 2025.001)', () => {
    const nfe = parse('nfe-cnpj-alfanumerico.xml').nfe;
    expect(nfe.emit.cnpj).toMatch(/^[A-Z0-9]{14}$/);
    expect(nfe.emit.cnpj?.slice(0, 12)).toMatch(/[A-Z]/);
    expect(nfe.chave).toMatch(/^[0-9]{6}[A-Z0-9]{12}[0-9]{26}$/);
  });

  it('IBS/CBS da NT 2024.002: grupos UB e IBSCBSSelTot parseados', () => {
    const nfe = parse('nfe-rtc-ibscbs.xml').nfe;
    const sel = nfe.det[0]!.imposto.ibscbsSel!;
    expect(sel.cst).toBe('01');
    expect(sel.cClassTrib).toBe('010001');
    expect(sel.gIBSCBS.vBC).toBe(1000);
    expect(sel.gIBSCBS.gIBSUF.pIBSUF).toBe(1.3);
    expect(sel.gIBSCBS.gIBSMun.pIBSMun).toBe(0.9);
    expect(sel.gIBSCBS.gCBS.pCBS).toBe(1.2);

    const tot = nfe.total.ibscbsSelTot!;
    expect(tot.vBCIBSCBS).toBe(1000);
    expect(tot.gIBS.gIBSMunTot.vIBSTot).toBe(22);
    expect(tot.gCBS.vCBS).toBe(12);
    // tributos por fora: vNF = vProd + vIBSTot + vCBS
    expect(nfe.total.icmsTot.vNF).toBeCloseTo(nfe.total.icmsTot.vProd + 22 + 12, 2);
  });

  it('NF-e conjugada com ISSQN: item de serviço com indTot = 0', () => {
    const nfe = parse('nfe-issqn-conjugada.xml').nfe;
    const servico = nfe.det[1]!;
    expect(servico.imposto.issqn?.vBC).toBe(2000);
    expect(servico.imposto.issqn?.cListServ).toBe('0107');
    expect(servico.prod.indTot).toBe(0);
    expect(nfe.total.issqnTot?.vServ).toBe(2000);
    expect(nfe.total.issqnTot?.dCompet).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(nfe.total.icmsTot.vProd).toBe(500); // só a peça
    expect(nfe.total.icmsTot.vNF).toBe(2500); // peça + serviço
  });

  it('NF-e homologação mantém tpAmb = 2', () => {
    expect(parse('nfe-homologacao.xml').nfe.ide.tpAmb).toBe(2);
  });

  it('NFe raiz (sem nfeProc) parseia sem protocolo', () => {
    const proc = parse('nfe-sem-protocolo.xml');
    expect(proc.protNFe).toBeUndefined();
    expect(proc.nfe.chave).toMatch(/^[0-9]{44}$/);
  });

  it('rejeita documentos desconhecidos', () => {
    expect(() => parseNFe('<qualquer-coisa><a>1</a></qualquer-coisa>')).toThrow(ParseError);
    expect(() => parseNFe('')).toThrow(ParseError);
    expect(() => parseNFe(lerFixture('evento-cancelamento.xml'))).toThrow(ParseError);
  });

  it('rejeita infNFe sem ide/emit/total obrigatórios', () => {
    const xmlSemIde = lerFixture('nfe-sem-protocolo.xml').replace(/<ide>[\s\S]*?<\/ide>/, '');
    expect(() => parseNFe(xmlSemIde)).toThrow(ParseError);
    const xmlSemEmit = lerFixture('nfe-sem-protocolo.xml').replace(/<emit>[\s\S]*?<\/emit>/, '');
    expect(() => parseNFe(xmlSemEmit)).toThrow(ParseError);
  });
});

describe('parseNFe — todos os grupos de ICMS/CSOSN do corpus', () => {
  const esperados: [arquivo: string, grupo: string, cst?: string, csosn?: string][] = [
    ['nfe-cst-00.xml', 'ICMS00', '00'],
    ['nfe-cst-02.xml', 'ICMS02', '02'],
    ['nfe-cst-10.xml', 'ICMS10', '10'],
    ['nfe-cst-15.xml', 'ICMS15', '15'],
    ['nfe-cst-20.xml', 'ICMS20', '20'],
    ['nfe-cst-30.xml', 'ICMS30', '30'],
    ['nfe-cst-40.xml', 'ICMS40', '40'],
    ['nfe-cst-41.xml', 'ICMS40', '41'],
    ['nfe-cst-50.xml', 'ICMS40', '50'],
    ['nfe-cst-51.xml', 'ICMS51', '51'],
    ['nfe-cst-53.xml', 'ICMS53', '53'],
    ['nfe-cst-60.xml', 'ICMS60', '60'],
    ['nfe-cst-61.xml', 'ICMS61', '61'],
    ['nfe-cst-70.xml', 'ICMS70', '70'],
    ['nfe-cst-90.xml', 'ICMS90', '90'],
    ['nfe-icms-part-10.xml', 'ICMSPart', '10'],
    ['nfe-icms-st-60.xml', 'ICMSST', '60'],
    ['nfe-csosn-101.xml', 'ICMSSN101', undefined, '101'],
    ['nfe-csosn-102.xml', 'ICMSSN102', undefined, '102'],
    ['nfe-csosn-103.xml', 'ICMSSN102', undefined, '103'],
    ['nfe-csosn-201.xml', 'ICMSSN201', undefined, '201'],
    ['nfe-csosn-202.xml', 'ICMSSN202', undefined, '202'],
    ['nfe-csosn-203.xml', 'ICMSSN202', undefined, '203'],
    ['nfe-csosn-300.xml', 'ICMSSN102', undefined, '300'],
    ['nfe-csosn-400.xml', 'ICMSSN102', undefined, '400'],
    ['nfe-csosn-500.xml', 'ICMSSN500', undefined, '500'],
    ['nfe-csosn-900.xml', 'ICMSSN900', undefined, '900'],
  ];

  it.each(esperados)('%s → %s', (arquivo, grupo, cst, csosn) => {
    const nfe = parse(arquivo).nfe;
    const icms = nfe.det[0]!.imposto.icms!;
    expect(icms.grupo).toBe(grupo);
    if (cst !== undefined && 'cst' in icms) {
      expect(icms.cst).toBe(cst);
    }
    if (csosn !== undefined && 'csosn' in icms) {
      expect(icms.csosn).toBe(csosn);
    }
    // emitente do Simples Nacional (CSOSN) tem CRT = 1
    if (csosn !== undefined) {
      expect(nfe.emit.crt).toBe(1);
    }
  });
});
