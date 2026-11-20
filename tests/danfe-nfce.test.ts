/** Testes do DANFE NFC-e 80 mm / 58 mm e do QR Code da tag `qrCode`. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseNFe } from '../src/parse/nfe';
import { renderDanfeNfce } from '../src/render/danfe-nfce';
import { PT_POR_CM } from '../src/render/layout';
import { decodificaQr } from './helpers/decodificadores';
import { abrePdf, extraiTexto, rasteriza, textoSimples } from './helpers/raster';

const xml = (arquivo: string) => readFileSync(resolve('tests/fixtures', arquivo), 'utf8');
const modelo = (arquivo: string) => parseNFe(xml(arquivo));

describe('DANFE NFC-e', () => {
  it('usa papel de 80 mm por padrão e 58 mm quando solicitado', async () => {
    const nfce = modelo('nfce-consumidor-cpf.xml');
    const pdf80 = await renderDanfeNfce(nfce);
    const pdf58 = await renderDanfeNfce(nfce, { larguraMm: 58 });
    const [doc80, doc58] = await Promise.all([abrePdf(pdf80), abrePdf(pdf58)]);
    expect((await doc80.getPage(1)).view[2]).toBeCloseTo((80 / 10) * PT_POR_CM, 1);
    expect((await doc58.getPage(1)).view[2]).toBeCloseTo((58 / 10) * PT_POR_CM, 1);
    expect(doc80.numPages).toBe(1);
    expect(doc58.numPages).toBe(1);
  });

  it('imprime as divisões I–VII com os valores da NFC-e', async () => {
    const texto = (
      await textoSimples(await renderDanfeNfce(modelo('nfce-consumidor-cpf.xml')))
    )[0]!;
    for (const trecho of [
      '13.583.426/5359-40',
      'Bom Prezzo',
      'Documento Auxiliar da Nota Fiscal de Consumidor',
      'SKU481173 - Produto sintético 7798',
      'Qtde. Total de Itens: 2',
      'Valor Total R$ 21,90',
      'Valor a Pagar R$ 21,90',
      'FORMA PAGAMENTO: Cartão de Crédito',
      'Consulte pela Chave de Acesso em',
      'https://www.sefaz.rs.gov.br/consulta/NFCe',
      'CONSUMIDOR CPF: 111.444.777-35',
      'NFC-e nº 805.326 Série 21',
      'Protocolo de autorização: 000000622320132',
    ]) {
      expect(texto, `trecho ausente: ${trecho}`).toContain(trecho);
    }
  });

  it('chave de acesso em 11 blocos de 4 dígitos (§3.1.4)', async () => {
    const pdf = await renderDanfeNfce(modelo('nfce-consumidor-cpf.xml'));
    const itens = await extraiTexto(await (await abrePdf(pdf)).getPage(1));
    const linhasChave = itens
      .filter((item) => /^\d{4}/.test(item.str))
      .map((item) => item.str)
      .join(' ');
    const blocos = linhasChave.match(/\d{4}/g) ?? [];
    expect(blocos).toHaveLength(11);
    expect(blocos.join('')).toBe('35260413583426535940650210008053261339775770');
  });

  it('QR Code gerado a partir do campo qrCode do XML (§3.1.5)', async () => {
    const nfce = modelo('nfce-consumidor-cpf.xml');
    const pdf = await renderDanfeNfce(nfce);
    const pagina = (await rasteriza(pdf, 3))[0]!;
    const decodificado = decodificaQr({
      dados: pagina.pixels,
      largura: pagina.largura,
      altura: pagina.altura,
    });
    expect(decodificado).toBe(nfce.infNFeSupl?.qrCode);
  });

  it('detalhamento de itens é opcional (DANFE NFC-e resumido)', async () => {
    const pdf = await renderDanfeNfce(modelo('nfce-consumidor-cpf.xml'), { detalharItens: false });
    const texto = (await textoSimples(pdf))[0]!;
    expect(texto).not.toContain('SKU481173');
    expect(texto).toContain('Qtde. Total de Itens: 2');
  });

  it('homologação e contingência exibem as mensagens obrigatórias (§3.1.8)', async () => {
    const hom = modelo('nfce-anonima.xml');
    hom.nfe.ide.tpAmb = 2;
    const textoHom = (await textoSimples(await renderDanfeNfce(hom))).join(' ');
    expect(textoHom).toContain('EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO');
    expect(textoHom).toMatch(/SEM\s*VALOR FISCAL/);

    const contingencia = modelo('nfce-consumidor-cpf.xml');
    contingencia.nfe.ide.tpEmis = 9;
    const textoCont = (await textoSimples(await renderDanfeNfce(contingencia))).join(' ');
    expect(textoCont.match(/EMITIDA EM CONTINGÊNCIA/g)).toHaveLength(2);
    expect(textoCont).not.toContain('Protocolo de autorização');
  });

  it('rejeita modelo 55, ausência de qrCode e largura inválida', async () => {
    await expect(renderDanfeNfce(modelo('nfe-cst-00.xml'))).rejects.toThrow(/modelo 65/);
    const semQr = modelo('nfce-consumidor-cpf.xml');
    semQr.infNFeSupl = undefined;
    await expect(renderDanfeNfce(semQr)).rejects.toThrow(/sem infNFeSupl\/qrCode/);
    await expect(
      renderDanfeNfce(modelo('nfce-consumidor-cpf.xml'), { larguraMm: 72 as 80 }),
    ).rejects.toThrow(/Largura de papel inválida/);
  });
});
