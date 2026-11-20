/** Testes byte a byte da saída ESC/POS (comando QR nativo GS ( k). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseNFe } from '../src/parse/nfe';
import { codificaPc860, colunasPapel, toEscPos } from '../src/render/escppos';

const xml = (arquivo: string) => readFileSync(resolve('tests/fixtures', arquivo), 'utf8');
const nfce = () => parseNFe(xml('nfce-consumidor-cpf.xml'));
const hex = (bytes: Uint8Array) => Buffer.from(bytes).toString('hex');

/** Fluxo integral esperado para `nfce-consumidor-cpf.xml` (32 colunas). */
const ESPERADO =
  // Corrigido (review 2026-11-20, itens 2 e 7): razão social em negrito,
  // fantasia como linha extra e CEP "13010-001" — antes: "Bom Prezzo" e CEP cru.
  '1b401b74121b610131332e3538332e3432362f353335392d34300d0a1b45014d65726361646f20426f6d205072657a7a6f204c746461204d450d0a' +
  '1b450046616e74617369613a20426f6d205072657a7a6f0d0a527561206461732050616c6d65697261732c203235302c204c6f6a612031320d0a' +
  '4a617264696d2042726173696c202d2043616d70696e61732f5350202d204345502031333031302d3030310d0a446f63756d656e746f20417578696c696172206461204e6f746120' +
  '46697363616c20646520436f6e73756d69646f7220456c657472936e6963610d0a2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d' +
  '2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d0d0a1b61001b4501534b55343831313733202d2050726f6475746f2073696e74827469' +
  '636f20373739380d0a1b4500322c3030303020554e207820342c35303030203d20392c30300d0a1b4501534b553630323435' +
  '32202d2050726f6475746f2073696e74827469636f20343337330d0a1b4500312c3030303020554e20782031322c39303030' +
  '203d2031322c39300d0a2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d0d0a517464652e20' +
  '546f74616c206465204974656e733a20320d0a56616c6f7220546f74616c2052242032312c39300d0a56616c6f7220612050' +
  '616761722052242032312c39300d0a464f524d4120504147414d454e544f3a2043617274846f206465204372826469746f0d' +
  '0a56616c6f72205061676f2052242032312c39300d0a2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d' +
  '2d2d2d2d0d0a1b6101436f6e73756c74652070656c612043686176652064652041636573736f20656d2068747470733a2f2f' +
  '7777772e736566617a2e72732e676f762e62722f636f6e73756c74612f4e4643650d0a333532362030343133203538333420' +
  '3236353320353934302036353032203130303020383035332032363133203339373720353737300d0a1d286b040031413200' +
  '1d286b03003143031d286b03003145311d286b0d0131503068747470733a2f2f7777772e736566617a2e72732e676f762e62' +
  '722f636f6e73756c74612f4e4643653f63684e46653d33353236303431333538333432363533353934303635303231303030' +
  '38303533323631333339373735373730266e56657273616f3d313030267470416d623d312663446573743d31313134343437' +
  '37373335266468456d693d323032362d31312d3230543130253341303025334130302d3033253341303026764e463d32312e' +
  '3930267649434d533d302e30302664696756616c3d26634964546f6b656e3d3030303030312663486173685152436f64653d' +
  '413142324333443445354636413742384339443045314632413342344335443645374638413942301d286b0300315130434f' +
  '4e53554d49444f52204350463a203131312e3434342e3737372d33350d0a1b61004e46432d65206ea7203830352e33323620' +
  '53827269652032310d0a446174612f486f726120456d697373846f3a2031312f30342f323032362031373a34303a30300d0a' +
  '50726f746f636f6c6f206465206175746f72697a6187846f3a203030303030303632323332303133322031312f30342f3230' +
  '32362031373a34303a30300d0a1b64031d5601';

describe('ESC/POS (NFC-e)', () => {
  it('produz exatamente a sequência de bytes esperada', () => {
    expect(hex(toEscPos(nfce()))).toBe(ESPERADO);
  });

  it('comandos iniciais, de código de página e de corte', () => {
    const bytes = toEscPos(nfce());
    expect(hex(bytes.subarray(0, 8))).toBe('1b401b74121b6101'); // ESC @, ESC t 18, ESC a 1
    expect(hex(bytes.subarray(-5))).toBe('64031d5601'); // ESC d 3, GS V 1
    expect(hex(toEscPos(nfce(), { cortar: false, linhasApos: 2 }).subarray(-5))).toBe('0d0a1b6402');
  });

  it('comando QR nativo com tamanho, correção M, dados UTF-8 e impressão', () => {
    const modelo = nfce();
    const bytes = toEscPos(modelo);
    const qr = modelo.infNFeSupl?.qrCode ?? '';
    const tamanho = qr.length + 3; // cn + fn + m (pL = dados + 3, pH = 0)
    const esperado =
      '1d286b040031413200' + // GS ( k 4 0 '1' 'A' '2' NUL — modelo 2
      '1d286b0300314303' + // GS ( k 3 0 '1' 'C' 3 — módulo 3
      '1d286b0300314531' + // GS ( k 3 0 '1' 'E' '1' — nível M
      `1d286b${(tamanho & 0xff).toString(16).padStart(2, '0')}${((tamanho >>> 8) & 0xff)
        .toString(16)
        .padStart(2, '0')}` +
      `3150${Buffer.from('0' + qr, 'utf8').toString('hex')}` +
      '1d286b0300315130'; // GS ( k 3 0 '1' 'Q' '0' — imprime
    expect(hex(bytes)).toContain(esperado);
  });

  it('PC860 codifica acentos do português e normaliza glifos ausentes', () => {
    expect(hex(codificaPc860('Ação'))).toBe('4187846f');
    expect(hex(codificaPc860('Cartão de Crédito'))).toBe('43617274846f206465204372826469746f');
    expect(hex(codificaPc860('Homologação – sem valor'))).toContain('2d20'); // '–' → '-'
    expect(hex(codificaPc860('linha1\nlinha2'))).toBe('6c696e6861310d0a6c696e686132');
  });

  it('58 mm uses 24-column separators; 80 mm uses 32', () => {
    expect(colunasPapel(80)).toBe(32);
    expect(colunasPapel(58)).toBe(24);
    const bytes58 = hex(toEscPos(nfce(), { larguraMm: 58 }));
    expect(bytes58).toContain('2d'.repeat(24));
    expect(bytes58).not.toContain('2d'.repeat(32));
  });

  it('rejeita modelo 55, sem qrCode e largura inválida', () => {
    expect(() => toEscPos(parseNFe(xml('nfe-cst-00.xml')))).toThrow(/modelo 65/);
    const semQr = nfce();
    semQr.infNFeSupl = undefined;
    expect(() => toEscPos(semQr)).toThrow(/sem infNFeSupl\/qrCode/);
    expect(() => toEscPos(nfce(), { larguraMm: 60 as 80 })).toThrow(/Largura de papel inválida/);
  });
});
