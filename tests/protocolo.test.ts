import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseNFe } from '../src/parse/nfe';
import { validateNFe } from '../src/validate/validate';
import { analisaProtocolo, CSTAT_AUTORIZADO, CSTAT_DENEGADO } from '../src/validate/protocolo';

const FIXTURES = join(import.meta.dirname, 'fixtures');

function parse(nome: string) {
  return parseNFe(readFileSync(join(FIXTURES, nome), 'utf8'));
}

describe('analisaProtocolo — cStat e autorização (MOC 7.0 — Anexo I, 4.4.1)', () => {
  it('tabelas de cStat cobrem 100/150 (autorizado) e 110/301-303 (denegado)', () => {
    expect([...CSTAT_AUTORIZADO].sort()).toEqual([100, 150]);
    expect([...CSTAT_DENEGADO].sort()).toEqual([110, 301, 302, 303]);
  });

  it('cStat 100 e 150 autorizam o uso da NF-e', () => {
    for (const arquivo of ['nfe-cst-00.xml', 'nfe-fora-prazo.xml']) {
      const proc = parse(arquivo);
      const { situacao, problemas } = analisaProtocolo(proc);
      expect(situacao.autorizada).toBe(true);
      expect(situacao.denegada).toBe(false);
      expect(situacao.temProtocolo).toBe(true);
      expect(situacao.semValorFiscal).toBe(false);
      expect(problemas).toEqual([]);
    }
  });

  it('cStat 110 denega o uso (MOC 4.4.3 — Uso Denegado)', () => {
    const proc = parse('nfe-denegada.xml');
    const { situacao, problemas } = analisaProtocolo(proc);
    expect(situacao.autorizada).toBe(false);
    expect(situacao.denegada).toBe(true);
    expect(situacao.semValorFiscal).toBe(true);
    expect(problemas.map((p) => p.code)).toEqual(['USO_DENEGADO']);
    expect(problemas[0]?.cStat).toBe(110);
  });

  it('sem protocolo → não autorizada (aviso para renderizar SEM VALOR FISCAL)', () => {
    const proc = parse('nfe-sem-protocolo.xml');
    const { situacao, problemas } = analisaProtocolo(proc);
    expect(situacao.temProtocolo).toBe(false);
    expect(situacao.autorizada).toBe(false);
    expect(situacao.semValorFiscal).toBe(true);
    expect(problemas.map((p) => p.code)).toEqual(['SEM_PROTOCOLO']);
  });

  it('homologação (tpAmb = 2) gera aviso de SEM VALOR FISCAL', () => {
    const proc = parse('nfe-homologacao.xml');
    const { situacao, problemas } = analisaProtocolo(proc);
    expect(situacao.homologacao).toBe(true);
    expect(situacao.autorizada).toBe(true); // autorizada em homologação
    expect(situacao.semValorFiscal).toBe(true);
    expect(problemas.map((p) => p.code)).toEqual(['AMBIENTE_HOMOLOGACAO']);
    expect(problemas[0]?.severity).toBe('aviso');
  });

  it('protocolo com ambiente divergente → erro (MOC B24-10, cStat 252)', () => {
    const proc = parse('nfe-cst-00.xml');
    proc.protNFe = { ...proc.protNFe!, tpAmb: 2 };
    const problemas = analisaProtocolo(proc).problemas;
    const p = problemas.find((x) => x.code === 'AMBIENTE_DIVERGENTE');
    expect(p).toBeDefined();
    expect(p?.cStat).toBe(252);
    expect(p?.regra).toBe('B24-10');
  });

  it('protocolo com chave divergente → erro de integridade', () => {
    const proc = parse('nfe-cst-00.xml');
    proc.protNFe = { ...proc.protNFe!, chNFe: proc.nfe.chave.replace(/^35/, '31') };
    expect(analisaProtocolo(proc).problemas.map((p) => p.code)).toContain(
      'PROTOCOLO_CHAVE_DIVERGENTE',
    );
  });

  it('cStat desconhecido (ex.: 204 duplicidade) → não autorizada', () => {
    const proc = parse('nfe-cst-00.xml');
    proc.protNFe = { ...proc.protNFe!, cStat: 204, xMotivo: 'Duplicidade de NF-e' };
    const { situacao, problemas } = analisaProtocolo(proc);
    expect(situacao.autorizada).toBe(false);
    expect(situacao.denegada).toBe(false);
    expect(problemas[0]?.code).toBe('NAO_AUTORIZADA');
    expect(problemas[0]?.cStat).toBe(204);
  });
});

describe('validateNFe — orquestração com situações do corpus', () => {
  it('nota válida de produção: sem erros, sem avisos', () => {
    const resultado = validateNFe(parse('nfe-cst-00.xml'));
    expect(resultado.valido).toBe(true);
    expect(resultado.erros).toEqual([]);
    expect(resultado.avisos).toEqual([]);
    expect(resultado.chaveValida).toBe(true);
    expect(resultado.documentosValidos).toBe(true);
    expect(resultado.totaisValidos).toBe(true);
    expect(resultado.situacaoProtocolo.autorizada).toBe(true);
    expect(resultado.situacaoProtocolo.semValorFiscal).toBe(false);
  });

  it('nota denegada: válida estruturalmente, mas não autorizada', () => {
    const resultado = validateNFe(parse('nfe-denegada.xml'));
    expect(resultado.valido).toBe(false);
    expect(resultado.chaveValida).toBe(true);
    expect(resultado.documentosValidos).toBe(true);
    expect(resultado.totaisValidos).toBe(true);
    expect(resultado.erros.map((e) => e.code)).toEqual(['USO_DENEGADO']);
  });

  it('nota sem protocolo: erro SEM_PROTOCOLO', () => {
    const resultado = validateNFe(parse('nfe-sem-protocolo.xml'));
    expect(resultado.valido).toBe(false);
    expect(resultado.erros.map((e) => e.code)).toEqual(['SEM_PROTOCOLO']);
    expect(resultado.situacaoProtocolo.semValorFiscal).toBe(true);
  });

  it('homologação: válida com aviso SEM VALOR FISCAL', () => {
    const resultado = validateNFe(parse('nfe-homologacao.xml'));
    expect(resultado.valido).toBe(true);
    expect(resultado.avisos.map((a) => a.code)).toEqual(['AMBIENTE_HOMOLOGACAO']);
    expect(resultado.situacaoProtocolo.semValorFiscal).toBe(true);
  });

  it('NFC-e válida: consumidor com CPF válido', () => {
    const resultado = validateNFe(parse('nfce-consumidor-cpf.xml'));
    expect(resultado.valido).toBe(true);
    expect(resultado.situacaoProtocolo.autorizada).toBe(true);
  });

  it('CNPJ alfanumérico do emitente é aceito (NT 2025.001)', () => {
    const resultado = validateNFe(parse('nfe-cnpj-alfanumerico.xml'));
    expect(resultado.valido).toBe(true);
    expect(resultado.documentosValidos).toBe(true);
    expect(resultado.chaveValida).toBe(true);
  });
});

describe('validateNFe — vetores inválidos (reporta, nunca lança)', () => {
  it('CNPJ do emitente com DV errado → cStat 207', () => {
    const proc = parse('nfe-cst-00.xml');
    const cnpj = proc.nfe.emit.cnpj!;
    const cnpjInvalido = `${cnpj.slice(0, 12)}${(Number(cnpj.slice(12)) + 1) % 100}`.padStart(
      14,
      '0',
    );
    proc.nfe.emit.cnpj = cnpjInvalido;
    const resultado = validateNFe(proc);
    expect(resultado.valido).toBe(false);
    const erro = resultado.erros.find((e) => e.code === 'CNPJ_EMITENTE_INVALIDO');
    expect(erro?.cStat).toBe(207);
    // a chave deixa de ser consistente com o documento alterado
    expect(resultado.chaveValida).toBe(false);
  });

  it('CPF do destinatário inválido → cStat 237', () => {
    const proc = parse('nfce-consumidor-cpf.xml');
    proc.nfe.dest = { ...proc.nfe.dest!, cpf: '11144477736' };
    const resultado = validateNFe(proc);
    const erro = resultado.erros.find((e) => e.code === 'CPF_DESTINATARIO_INVALIDO');
    expect(erro?.cStat).toBe(237);
  });

  it('total vProd adulterado → cStat 564 e a fórmula do vNF falha (610)', () => {
    const proc = parse('nfe-cst-00.xml');
    proc.nfe.total.icmsTot.vProd += 100;
    const resultado = validateNFe(proc);
    expect(resultado.totaisValidos).toBe(false);
    const erro = resultado.erros.find((e) => e.code === 'TOTAL_VPROD');
    expect(erro?.cStat).toBe(564);
    // W16-10 soma os campos declarados do grupo W: o vProd declarado
    // adulterado faz a fórmula divergir do vNF → cStat 610.
    const erroVnf = resultado.erros.find((e) => e.code === 'TOTAL_VNF');
    expect(erroVnf).toBeDefined();
    expect(erroVnf?.cStat).toBe(610);
  });

  it('chave com dígito verificador trocado → cStat 253', () => {
    const proc = parse('nfe-cst-00.xml');
    const dv = Number(proc.nfe.chave.slice(43));
    proc.nfe.chave = `${proc.nfe.chave.slice(0, 43)}${(dv + 1) % 10}`;
    const resultado = validateNFe(proc);
    expect(resultado.chaveValida).toBe(false);
    const erro = resultado.erros.find((e) => e.code === 'CHAVE_DV');
    expect(erro?.cStat).toBe(253);
  });
});
