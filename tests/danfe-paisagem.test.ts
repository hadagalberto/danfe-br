/** Testes funcionais do DANFE paisagem (MOC 7.0 Anexo II §3.8.2). */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseEventoNFe } from '../src/parse/evento';
import { parseNFe } from '../src/parse/nfe';
import { renderDanfe } from '../src/render/danfe-retrato';
import {
  CABECALHO_PAISAGEM,
  CALCULO_IMPOSTO_PAISAGEM,
  DADOS_ADICIONAIS_PAISAGEM,
  DESTINATARIO_PAISAGEM,
  FATURA_PAISAGEM,
  ISSQN_PAISAGEM,
  PAGINA_PAISAGEM,
  PRODUTOS_PAISAGEM,
  TRANSPORTADOR_PAISAGEM,
} from '../src/render/layout-paisagem';
import { PT_POR_CM, type Caixa } from '../src/render/layout';
import { abrePdf, extraiTexto, textoSimples } from './helpers/raster';
import { itensNaCaixaPagina } from './helpers/danfe';

const xml = (arquivo: string) => readFileSync(resolve('tests/fixtures', arquivo), 'utf8');
const rendered = (arquivo: string, opcoes?: Parameters<typeof renderDanfe>[1]) =>
  renderDanfe(parseNFe(xml(arquivo)), { ...opcoes, layout: 'paisagem' });

describe('DANFE paisagem', () => {
  it('folha A4 paisagem (29,7 × 21 cm) com uma página', async () => {
    const pdf = await rendered('nfe-cst-00.xml');
    const doc = await abrePdf(pdf);
    expect(doc.numPages).toBe(1);
    const pagina = await doc.getPage(1);
    expect(pagina.view[2]).toBeCloseTo(PAGINA_PAISAGEM.larguraCm * PT_POR_CM, 1);
    expect(pagina.view[3]).toBeCloseTo(PAGINA_PAISAGEM.alturaCm * PT_POR_CM, 1);
  });

  it('campos do cabeçalho nas posições do Anexo II §3.8.2', async () => {
    const itens = await extraiTexto(
      await abrePdf(await rendered('nfe-cst-00.xml')).then((d) => d.getPage(1)),
    );
    const altura = PAGINA_PAISAGEM.alturaCm;
    const caixaTexto = (caixa: Caixa) =>
      itensNaCaixaPagina(itens, caixa, altura)
        .map((item) => item.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    expect(caixaTexto(CABECALHO_PAISAGEM.emitente)).toContain('Indústria');
    expect(caixaTexto(CABECALHO_PAISAGEM.chaveTexto)).toContain(
      '3526 0110 5626 5562 0245 5502 8000 0217 6913 4126 2140',
    );
    expect(caixaTexto(CABECALHO_PAISAGEM.naturezaOperacao)).toContain('VENDA DE PRODUÇÃO PRÓPRIA');
    expect(caixaTexto(CABECALHO_PAISAGEM.numeroSerieFolha)).toContain('FOLHA 01/01');
    expect(caixaTexto(CABECALHO_PAISAGEM.cnpjEmitente)).toContain('10.562.655/6202-45');
  });

  it('quadros destinatário, fatura, cálculo, transporte e rodapé preenchidos', async () => {
    const itens = await extraiTexto(
      await abrePdf(await rendered('nfe-duplicatas.xml')).then((d) => d.getPage(1)),
    );
    const altura = PAGINA_PAISAGEM.alturaCm;
    const caixaTexto = (caixa: Caixa) =>
      itensNaCaixaPagina(itens, caixa, altura)
        .map((item) => item.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    expect(caixaTexto(DESTINATARIO_PAISAGEM.razaoSocial)).toContain('Ana Beatriz Nogueira');
    expect(caixaTexto(FATURA_PAISAGEM.conteudo)).toContain('FATURA');
    expect(caixaTexto(CALCULO_IMPOSTO_PAISAGEM.valorTotal)).toContain('VALOR TOTAL DA NOTA');
    expect(caixaTexto(TRANSPORTADOR_PAISAGEM.razaoSocial)).toContain('NOME/RAZÃO SOCIAL');
    expect(caixaTexto(PRODUTOS_PAISAGEM.quadro)).toContain('DESCRIÇÃO DOS PRODUTOS/SERVIÇOS');
    expect(caixaTexto(ISSQN_PAISAGEM.inscricaoMunicipal)).toContain('INSCRIÇÃO MUNICIPAL');
    expect(caixaTexto(DADOS_ADICIONAIS_PAISAGEM.informacoes)).toContain(
      'INFORMAÇÕES COMPLEMENTARES',
    );
  });

  it('pagina produtos e imprime FOLHA X/Y em todas as folhas', async () => {
    const texto = await textoSimples(await rendered('nfe-muitos-itens-60.xml'));
    expect(texto.length).toBeGreaterThanOrEqual(2);
    for (const [indice, pagina] of texto.entries()) {
      expect(pagina).toContain(
        `FOLHA ${String(indice + 1).padStart(2, '0')}/${String(texto.length).padStart(2, '0')}`,
      );
    }
  });

  it('marcas d’água SEM VALOR FISCAL, DENEGADA e CANCELADA', async () => {
    expect((await textoSimples(await rendered('nfe-homologacao.xml'))).join(' ')).toContain(
      'SEM VALOR FISCAL',
    );
    expect((await textoSimples(await rendered('nfe-denegada.xml'))).join(' ')).toContain(
      'DENEGADA',
    );
    const cancelamento = parseEventoNFe(xml('evento-cancelamento.xml'));
    expect(
      (await textoSimples(await rendered('nfe-cst-00.xml', { eventos: [cancelamento] }))).join(' '),
    ).toContain('CANCELADA');
  });

  it('respeita o tamanho mínimo de fonte de 5 pt do MOC §3.7', async () => {
    const itens = await extraiTexto(
      await abrePdf(await rendered('nfe-cst-00.xml')).then((d) => d.getPage(1)),
    );
    for (const item of itens) expect(item.altura).toBeGreaterThanOrEqual(4.9);
  });

  it('rejeita chave de acesso malformada', async () => {
    const modelo = parseNFe(xml('nfe-cst-00.xml'));
    await expect(
      renderDanfe({ ...modelo, nfe: { ...modelo.nfe, chave: '123' } }, { layout: 'paisagem' }),
    ).rejects.toThrow(/Chave de acesso inválida/);
  });
});
