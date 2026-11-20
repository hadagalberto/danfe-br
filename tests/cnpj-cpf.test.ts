import { describe, expect, it } from 'vitest';
import {
  calculaDvCnpj,
  calculaDvCpf,
  cnpjValido,
  cpfValido,
  validaDocumentos,
} from '../src/validate/documentos';
import { cnpjSintetico, cpfSintetico } from '../src/fixtures/factory';

describe('cnpjValido — numérico (MOC C02-10/E02-10, cStat 207/208)', () => {
  it('aceita o CNPJ clássico de exemplo 11.222.333/0001-81', () => {
    expect(cnpjValido('11222333000181')).toBe(true);
  });

  it('aceita CNPJs sintéticos gerados com DV calculado', () => {
    for (const seed of ['a', 'b', 'c', 'empresa-1', 'transportadora']) {
      const cnpj = cnpjSintetico(seed);
      expect(cnpj).toMatch(/^[0-9]{14}$/);
      expect(cnpjValido(cnpj)).toBe(true);
    }
  });

  it('rejeita DV incorreto, CNPJ zerado e formato inválido', () => {
    expect(cnpjValido('11222333000182')).toBe(false); // 2º DV trocado
    expect(cnpjValido('11222333000180')).toBe(false); // 2º DV trocado
    // a regra oficial (MOC C02-10) rejeita o CNPJ “com zeros”; bases quase
    // zeradas com DV correto passam pela verificação de DV:
    expect(cnpjValido('00000000000191')).toBe(true);
    expect(cnpjValido('00000000000000')).toBe(false);
    expect(cnpjValido('1122233300018')).toBe(false); // 13 posições
    expect(cnpjValido('')).toBe(false);
    expect(cnpjValido('1122233300018a')).toBe(false);
  });
});

describe('cnpjValido — alfanumérico (NT 2025.001 v1.00, DV módulo 11 com ASCII−48)', () => {
  it('aceita o exemplo oficial da NT/RFB: 12.ABC.345/01DE-35', () => {
    // Exemplo validado na própria NT 2025.001 (seção 2) e no manual da RFB
    // “Cálculo dos dígitos verificadores de CNPJ alfanumérico”
    // (gov.br/receitafederal): 1º DV = 3, 2º DV = 5.
    expect(cnpjValido('12ABC34501DE35')).toBe(true);
  });

  it('rejeita o mesmo CNPJ com DV alterado', () => {
    expect(cnpjValido('12ABC34501DE34')).toBe(false);
    expect(cnpjValido('12ABC34501DE36')).toBe(false);
  });

  it('os caracteres alfanuméricos valem ASCII−48 (A=17, B=18, ...)', () => {
    // '12ABC34501DE' + DV calculado pela própria função de DV exposta.
    const base = '12ABC34501DE';
    expect(calculaDvCnpj(base)).toBe('35');
    // mesma base com letras minúsculas não é aceita (padrão [A-Z0-9])
    expect(cnpjValido('12abc34501de35')).toBe(false);
  });

  it('gera e valida CNPJs alfanuméricos sintéticos', () => {
    for (const base of ['AB12CD34EF56', 'ZZ99ZZ99ZZ99', 'A00000000001']) {
      const cnpj = base + calculaDvCnpj(base);
      expect(cnpjValido(cnpj)).toBe(true);
    }
  });

  it('rejeita letras nas duas posições do DV', () => {
    expect(cnpjValido('12ABC34501DE3A')).toBe(false);
  });
});

describe('cpfValido (MOC cStat 401/237 — “zeros, nulo, 111..., 222..., ou DV inválido”)', () => {
  it('aceita os exemplos conhecidos 111.444.777-35 e 529.982.247-25', () => {
    expect(cpfValido('11144477735')).toBe(true);
    expect(cpfValido('52998224725')).toBe(true);
  });

  it('aceita CPFs sintéticos gerados com DV calculado', () => {
    for (const seed of ['p1', 'p2', 'consumidor']) {
      const cpf = cpfSintetico(seed);
      expect(cpf).toMatch(/^[0-9]{11}$/);
      expect(cpfValido(cpf)).toBe(true);
    }
  });

  it('rejeita DV incorreto', () => {
    expect(cpfValido('11144477736')).toBe(false); // 2º DV +1
    expect(cpfValido('11144477745')).toBe(false); // 1º DV +1
    expect(cpfValido('52998224724')).toBe(false);
  });

  it('rejeita sequências repetidas e zeradas (regra oficial)', () => {
    expect(cpfValido('00000000000')).toBe(false);
    expect(cpfValido('11111111111')).toBe(false);
    expect(cpfValido('22222222222')).toBe(false);
    expect(cpfValido('99999999999')).toBe(false);
  });

  it('rejeita formato inválido', () => {
    expect(cpfValido('1114447773')).toBe(false); // 10 dígitos
    expect(cpfValido('')).toBe(false);
    expect(cpfValido('11144477a35')).toBe(false);
  });

  it('calculaDvCpf confere com os vetores conhecidos', () => {
    expect(calculaDvCpf('111444777')).toBe('35');
    expect(calculaDvCpf('529982247')).toBe('25');
  });
});

describe('validaDocumentos — regras por papel (MOC 207/208/401/237)', () => {
  it('não aponta problemas para documentos válidos', () => {
    expect(
      validaDocumentos({
        emitCnpj: '11222333000181',
        destInformado: true,
        destCnpj: '12ABC34501DE35',
      }),
    ).toEqual([]);
  });

  it('rejeita CNPJ inválido do emitente com cStat 207', () => {
    const problemas = validaDocumentos({
      emitCnpj: '11222333000182',
      destInformado: false,
    });
    expect(problemas).toHaveLength(1);
    expect(problemas[0]?.code).toBe('CNPJ_EMITENTE_INVALIDO');
    expect(problemas[0]?.cStat).toBe(207);
    expect(problemas[0]?.regra).toBe('C02-10');
  });

  it('rejeita CNPJ inválido do destinatário com cStat 208', () => {
    const problemas = validaDocumentos({
      emitCnpj: '11222333000181',
      destInformado: true,
      destCnpj: '11222333000199',
    });
    expect(problemas[0]?.code).toBe('CNPJ_DESTINATARIO_INVALIDO');
    expect(problemas[0]?.cStat).toBe(208);
  });

  it('rejeita CPF inválido do emitente (cStat 401) e do destinatário (cStat 237)', () => {
    const em = validaDocumentos({
      emitCnpj: '11222333000181',
      emitCpf: '11111111111',
      destInformado: false,
    });
    expect(em.map((p) => p.cStat)).toContain(401);

    const dt = validaDocumentos({
      emitCnpj: '11222333000181',
      destInformado: true,
      destCpf: '11144477736',
    });
    expect(dt.map((p) => p.cStat)).toContain(237);
  });

  it('rejeita emitente sem documento e destinatário sem documento', () => {
    const semEmit = validaDocumentos({ destInformado: false });
    expect(semEmit.map((p) => p.code)).toContain('EMITENTE_SEM_DOCUMENTO');

    const semDest = validaDocumentos({ emitCnpj: '11222333000181', destInformado: true });
    expect(semDest.map((p) => p.code)).toContain('DESTINATARIO_SEM_DOCUMENTO');
  });
});
