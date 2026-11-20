import { describe, expect, it } from 'vitest';
import {
  aammDeDhEmi,
  chaveAcessoValida,
  chaveEsperada,
  digitoVerificadorChave,
  montaChaveDeAcesso,
  validaChaveNFe,
} from '../src/validate/chave';
import type { NFe } from '../src/model/nfe';

/**
 * Vetores conhecidos:
 * - Exemplo oficial do MOC 7.0 — Visão Geral, seção 2.2.6.2: a sequência de
 *   43 dígitos `5206043300991100250655012000000780026730161` tem somatória de
 *   ponderações 644, resto 6 e DV `5`.
 * - Chave válida completa: `...1615`.
 */
const CHAVE_MOC_43 = '5206043300991100250655012000000780026730161';
const CHAVE_MOC_44 = `${CHAVE_MOC_43}5`;

describe('digitoVerificadorChave (módulo 11 — MOC 7.0, Visão Geral 2.2.6.2)', () => {
  it('reproduz o exemplo oficial do MOC (DV = 5)', () => {
    expect(digitoVerificadorChave(CHAVE_MOC_43)).toBe(5);
  });

  it('DV 0 quando o resto é 0 ou 1', () => {
    // Vetores construídos: pesos 2..9 da direita para a esquerda.
    // Resto 0: dígito 1 na 1ª posição (peso 2) + 1 na 8ª (peso 9) → soma 11.
    const resto0 = '0'.repeat(43).split('');
    resto0[42] = '1'; // 1ª da direita, peso 2
    resto0[35] = '1'; // 8ª da direita, peso 9
    expect(digitoVerificadorChave(resto0.join(''))).toBe(0);

    // Resto 1: dígito 2 na 5ª posição da direita (peso 6) → soma 12.
    const resto1 = '0'.repeat(43).split('');
    resto1[38] = '2';
    expect(digitoVerificadorChave(resto1.join(''))).toBe(0);

    // Resto 2: dígito 1 na 1ª posição (peso 2) → soma 2 → DV = 9.
    const resto2 = '0'.repeat(43).split('');
    resto2[42] = '1';
    expect(digitoVerificadorChave(resto2.join(''))).toBe(9);
  });

  it('rejeita sequências com tamanho ou caracteres inválidos', () => {
    expect(digitoVerificadorChave('')).toBeUndefined();
    expect(digitoVerificadorChave('52')).toBeUndefined();
    expect(digitoVerificadorChave(`${CHAVE_MOC_43.slice(0, 42)}X`)).toBeUndefined();
    expect(digitoVerificadorChave(CHAVE_MOC_44)).toBeUndefined(); // 44 posições
    // letra em posição que deve ser dígito (nNF) — NT 2025.001: letras apenas
    // nas 12 posições da base do CNPJ
    const comLetra = `${CHAVE_MOC_43.slice(0, 25)}A${CHAVE_MOC_43.slice(26)}`;
    expect(digitoVerificadorChave(comLetra)).toBeUndefined();
  });
});

describe('chaveAcessoValida (MOC B23-10, cStat 253)', () => {
  it('aceita a chave do exemplo do MOC', () => {
    expect(chaveAcessoValida(CHAVE_MOC_44)).toBe(true);
  });

  it('rejeita dígito verificador trocado', () => {
    expect(chaveAcessoValida(`${CHAVE_MOC_43}6`)).toBe(false);
    expect(chaveAcessoValida(`${CHAVE_MOC_43}0`)).toBe(false);
  });

  it('rejeita formato inválido (regex oficial da NT 2025.001)', () => {
    expect(chaveAcessoValida(CHAVE_MOC_43)).toBe(false);
    expect(chaveAcessoValida(`${CHAVE_MOC_43}5A`)).toBe(false);
    expect(chaveAcessoValida('')).toBe(false);
    // letras nas 6 primeiras posições (cUF/AAMM) não são permitidas
    expect(chaveAcessoValida(`A2${CHAVE_MOC_44.slice(2)}`)).toBe(false);
  });

  it('detecta alteração de um dígito no corpo da chave', () => {
    const corpo = CHAVE_MOC_43.split('');
    corpo[5] = corpo[5] === '9' ? '0' : String(Number(corpo[5]) + 1);
    const adulterada = `${corpo.join('')}5`;
    expect(chaveAcessoValida(adulterada)).toBe(false);
  });
});

describe('montaChaveDeAcesso / composição (MOC Tabela 2-1)', () => {
  it('compõe cUF+AAMM+doc+mod+serie+nNF+tpEmis+cNF com DV', () => {
    const chave = montaChaveDeAcesso({
      cUF: 35,
      aamm: '2611',
      docEmitente: '11222333000181',
      mod: 55,
      serie: 1,
      nNF: 123456,
      tpEmis: 1,
      cNF: '12345678',
    });
    expect(chave).toMatch(/^[0-9]{44}$/);
    expect(chave.slice(0, 2)).toBe('35');
    expect(chave.slice(2, 6)).toBe('2611');
    expect(chave.slice(6, 20)).toBe('11222333000181');
    expect(chave.slice(20, 22)).toBe('55');
    expect(chave.slice(22, 25)).toBe('001');
    expect(chave.slice(25, 34)).toBe('000123456');
    expect(chave.slice(34, 35)).toBe('1');
    expect(chave.slice(35, 43)).toBe('12345678');
    expect(chaveAcessoValida(chave)).toBe(true);
  });

  it('completa CPF com zeros à esquerda até 14 posições (NT 2018.001)', () => {
    const chave = montaChaveDeAcesso({
      cUF: 35,
      aamm: '2611',
      docEmitente: '11144477735',
      mod: 55,
      serie: 1,
      nNF: 1,
      tpEmis: 1,
      cNF: '00000001',
    });
    expect(chave.slice(6, 20)).toBe('00011144477735');
    expect(chaveAcessoValida(chave)).toBe(true);
  });

  it('aammDeDhEmi extrada ano/mês do dhEmi ISO-8601', () => {
    expect(aammDeDhEmi('2026-11-20T10:48:39-03:00')).toBe('2611');
    expect(aammDeDhEmi('2025-01-31T23:59:59Z')).toBe('2501');
    expect(aammDeDhEmi('20-11-20T10:48:39-03:00')).toBeUndefined();
  });

  it('suporta CNPJ alfanumérico no emitente (NT 2025.001, seção 5)', () => {
    // A chave passa a aceitar letras nas 12 posições da base do CNPJ e o DV
    // é calculado com ASCII−48 sobre os 44 caracteres.
    const chave = montaChaveDeAcesso({
      cUF: 35,
      aamm: '2611',
      docEmitente: '12ABC34501DE35',
      mod: 55,
      serie: 1,
      nNF: 42,
      tpEmis: 1,
      cNF: '00000042',
    });
    expect(chave).toMatch(/^[0-9]{6}[A-Z0-9]{12}[0-9]{26}$/);
    expect(chave.slice(6, 20)).toBe('12ABC34501DE35'.padStart(14, '0'));
    expect(chaveAcessoValida(chave)).toBe(true);
    expect(digitoVerificadorChave(chave.slice(0, 43))).toBe(Number(chave.slice(43)));
  });
});

describe('validaChaveNFe — consistência com ide/emit (MOC A03-10, cStat 502)', () => {
  const nfeBase: NFe = {
    versao: '4.00',
    chave: montaChaveDeAcesso({
      cUF: 35,
      aamm: '2611',
      docEmitente: '11222333000181',
      mod: 55,
      serie: 1,
      nNF: 123456,
      tpEmis: 1,
      cNF: '12345678',
    }),
    ide: {
      cUF: 35,
      cNF: '12345678',
      natOp: 'VENDA',
      mod: 55,
      serie: 1,
      nNF: 123456,
      dhEmi: '2026-11-20T10:48:39-03:00',
      tpNF: 1,
      idDest: 1,
      cMunFG: 3550308,
      tpImp: 1,
      tpEmis: 1,
      cDV: 0,
      tpAmb: 1,
      finNFe: 1,
      indFinal: 0,
      indPres: 0,
      procEmi: 0,
      verProc: 'teste',
      nfRef: [],
    },
    emit: {
      cnpj: '11222333000181',
      xNome: 'Emitente',
      enderEmit: {
        xLgr: 'R',
        nro: '1',
        xBairro: 'B',
        cMun: 3550308,
        xMun: 'Campinas',
        uf: 'SP',
      },
      ie: '123',
      crt: 3,
    },
    det: [],
    total: {
      icmsTot: {
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
        vII: 0,
        vIPI: 0,
        vIPIDevol: 0,
        vPIS: 0,
        vCOFINS: 0,
        vOutro: 0,
        vNF: 0,
      },
    },
    transp: { modFrete: 9, reboque: [], vol: [] },
    pag: { detPag: [] },
    autXml: [],
  };
  // completa o cDV correto
  nfeBase.ide.cDV = digitoVerificadorChave(nfeBase.chave.slice(0, 43)) ?? 0;

  it('não aponta problemas para nota consistente', () => {
    expect(validaChaveNFe(nfeBase)).toEqual([]);
    expect(chaveEsperada(nfeBase)).toBe(nfeBase.chave);
  });

  it('rejeita DV inválido (cStat 253) e a inconsistência decorrente (cStat 502)', () => {
    const corpo = nfeBase.chave.slice(0, 43);
    const dv = digitoVerificadorChave(corpo) ?? 0;
    const dvErrado = dv === 9 ? 0 : dv + 1;
    const nfe = { ...nfeBase, chave: `${corpo}${dvErrado}` };
    const problemas = validaChaveNFe(nfe);
    expect(problemas.map((p) => p.code).sort()).toEqual(['CHAVE_CONSISTENCIA', 'CHAVE_DV']);
    const dvErro = problemas.find((p) => p.code === 'CHAVE_DV');
    expect(dvErro?.cStat).toBe(253);
    expect(dvErro?.regra).toBe('B23-10');
  });

  it('rejeita divergência com os campos de ide (cStat 502)', () => {
    const nfe = { ...nfeBase, ide: { ...nfeBase.ide, nNF: nfeBase.ide.nNF + 1 } };
    const problemas = validaChaveNFe(nfe);
    expect(problemas.map((p) => p.code)).toContain('CHAVE_CONSISTENCIA');
    expect(problemas.find((p) => p.code === 'CHAVE_CONSISTENCIA')?.cStat).toBe(502);
  });

  it('rejeita cDV de ide divergente do DV da chave', () => {
    const nfe = { ...nfeBase, ide: { ...nfeBase.ide, cDV: 9 } };
    const problemas = validaChaveNFe(nfe);
    expect(problemas.map((p) => p.code)).toContain('CHAVE_CDV_DIVERGENTE');
  });

  it('rejeita emitente com documento diferente do da chave', () => {
    const nfe = { ...nfeBase, emit: { ...nfeBase.emit, cnpj: '52998224000159' } };
    expect(validaChaveNFe(nfe).map((p) => p.code)).toContain('CHAVE_CONSISTENCIA');
  });

  it('rejeita chave com formato inválido', () => {
    const nfe = { ...nfeBase, chave: 'NFe-abc' };
    expect(validaChaveNFe(nfe).map((p) => p.code)).toContain('CHAVE_FORMATO');
  });
});
