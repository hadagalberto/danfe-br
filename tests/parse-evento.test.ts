import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseEventoNFe } from '../src/parse/evento';
import { ParseError } from '../src/parse/xml';
import {
  TP_EVENTO_CANCELAMENTO,
  TP_EVENTO_CCE,
  type DetEventoCancelamento,
  type DetEventoCce,
} from '../src/model/evento';

const FIXTURES = join(import.meta.dirname, 'fixtures');

function lerFixture(nome: string): string {
  return readFileSync(join(FIXTURES, nome), 'utf8');
}

describe('parseEventoNFe — cancelamento (procEventoCancNFe, tpEvento 110111)', () => {
  const proc = parseEventoNFe(lerFixture('evento-cancelamento.xml'));
  const det = proc.evento.infEvento.detEvento as DetEventoCancelamento;

  it('parseia o envelope (evento + retEvento)', () => {
    expect(proc.versao).toBe('1.00');
    const inf = proc.evento.infEvento;
    expect(inf.cOrgao).toBe(35);
    expect(inf.tpAmb).toBe(1);
    expect(inf.cnpj).toMatch(/^[0-9]{14}$/);
    expect(inf.chNFe).toMatch(/^[0-9]{44}$/);
    expect(inf.dhEvento).toMatch(/^2026-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-03:00$/);
    expect(inf.tpEvento).toBe(TP_EVENTO_CANCELAMENTO);
    expect(inf.nSeqEvento).toBe(1);
    expect(inf.verEvento).toBe('1.00');
    expect(inf.id).toBe(`ID${inf.tpEvento}${inf.chNFe}01`);
  });

  it('especializa detEvento com nProt e xJust (leiauteEventoCancNFe_v1.00.xsd)', () => {
    expect(det.tipo).toBe(TP_EVENTO_CANCELAMENTO);
    expect(det.descEvento).toBe('Cancelamento');
    expect(det.nProt).toMatch(/^\d{15}$/);
    expect(det.xJust).toContain('divergentes');
  });

  it('parseia o processamento com cStat 101 (cancelamento homologado)', () => {
    const ret = proc.retEvento.infEvento;
    expect(ret.cStat).toBe(101);
    expect(ret.xMotivo).toContain('Cancelamento');
    expect(ret.chNFe).toBe(proc.evento.infEvento.chNFe);
    expect(ret.tpEvento).toBe(TP_EVENTO_CANCELAMENTO);
    expect(ret.nSeqEvento).toBe(1);
    expect(ret.dhRegEvento).toBeDefined();
    // nProt do retEvento é o protocolo do EVENTO; o nProt do detEvento
    // referencia o protocolo de autorização da nota cancelada.
    expect(ret.nProt).toMatch(/^\d{15}$/);
    expect(det.nProt).toMatch(/^\d{15}$/);
  });
});

describe('parseEventoNFe — Carta de Correção (procCCeNFe, tpEvento 110110)', () => {
  const proc = parseEventoNFe(lerFixture('evento-cce.xml'));

  it('especializa detEvento com xCorrecao e xCondUso (leiauteCCe_v1.00.xsd)', () => {
    const det = proc.evento.infEvento.detEvento as DetEventoCce;
    expect(det.tipo).toBe(TP_EVENTO_CCE);
    expect(det.descEvento).toMatch(/^Carta de Corre/);
    expect(det.xCorrecao).toContain('razão social');
    // xCondUso é o literal fixo do schema oficial da CC-e
    expect(det.xCondUso).toContain('Convênio S/N');
    expect(det.xCondUso).toContain('III - a data de emissão ou de saída');
  });

  it('parseia o processamento com cStat 135 (evento registrado e vinculado)', () => {
    expect(proc.retEvento.infEvento.cStat).toBe(135);
    expect(proc.retEvento.infEvento.xMotivo).toContain('vinculado');
    expect(proc.retEvento.infEvento.cOrgaoAutor).toBe(35);
  });
});

describe('parseEventoNFe — envelope genérico', () => {
  it('aceita procEventoNFe com detEvento de tipo não especializado', () => {
    // Evento de insucesso na entrega (tpEvento 110190, NT 2023.005) montado
    // sobre o envelope genérico — detEvento vem como campos texto.
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<procEventoNFe versao="1.00" xmlns="http://www.portalfiscal.inf.br/nfe">
  <evento versao="1.00">
    <infEvento Id="ID11019035261100000000000000000000000000000000010001">
      <cOrgao>35</cOrgao>
      <tpAmb>1</tpAmb>
      <CNPJ>11222333000181</CNPJ>
      <chNFe>35261100000000000000000000000000000000000000</chNFe>
      <dhEvento>2026-11-20T10:00:00-03:00</dhEvento>
      <tpEvento>110190</tpEvento>
      <nSeqEvento>1</nSeqEvento>
      <verEvento>1.00</verEvento>
      <detEvento versao="1.00">
        <descEvento>Insucesso na Entrega da NF-e</descEvento>
        <cSit>1</cSit>
        <xOBS>Destinatário ausente</xOBS>
      </detEvento>
    </infEvento>
  </evento>
  <retEvento versao="1.00">
    <infEvento>
      <tpAmb>1</tpAmb>
      <verAplic>SVRS-2026</verAplic>
      <cOrgao>35</cOrgao>
      <cStat>135</cStat>
      <xMotivo>Evento registrado e vinculado a NF-e</xMotivo>
      <chNFe>35261100000000000000000000000000000000000000</chNFe>
      <tpEvento>110190</tpEvento>
      <nSeqEvento>1</nSeqEvento>
      <dhRegEvento>2026-11-20T10:05:00-03:00</dhRegEvento>
    </infEvento>
  </retEvento>
</procEventoNFe>`;
    const proc = parseEventoNFe(xml);
    const det = proc.evento.infEvento.detEvento;
    expect(det.tipo).toBe('110190');
    if (det.tipo === '110190') {
      expect(det.descEvento).toBe('Insucesso na Entrega da NF-e');
      expect(det.campos['cSit']).toBe('1');
      expect(det.campos['xOBS']).toBe('Destinatário ausente');
    }
    expect(proc.retEvento.infEvento.cStat).toBe(135);
  });

  it('rejeita documentos que não são eventos', () => {
    expect(() => parseEventoNFe(lerFixture('nfe-cst-00.xml'))).toThrow(ParseError);
    expect(() => parseEventoNFe('<outra-coisa/>')).toThrow(ParseError);
    expect(() => parseEventoNFe('')).toThrow(ParseError);
  });

  it('rejeita evento sem infEvento/detEvento obrigatórios', () => {
    const semDet = lerFixture('evento-cce.xml').replace(/<detEvento[\s\S]*?<\/detEvento>/, '');
    expect(() => parseEventoNFe(semDet)).toThrow(ParseError);
  });
});
