/**
 * Regressões do review independente (2026-11-20).
 *
 * Cada valor esperado abaixo é derivado à mão da fonte oficial (MOC Anexo II),
 * da SPEC ou da litera do fixture versionado — nunca do próprio renderizador.
 * Este arquivo é executado ANTES de cada correção para provar a falha.
 */
import { createCanvas } from '@napi-rs/canvas';
import { PDFDocument } from 'pdf-lib';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseNFe } from '../src/parse/nfe';
import { cstItem } from '../src/render/formatacao';
import { renderDanfe } from '../src/render/danfe-retrato';
import { renderDanfeNfce } from '../src/render/danfe-nfce';
import {
  CABECALHO,
  DESTINATARIO,
  PAGINA,
  PRODUTOS,
  PT_POR_CM,
  type Caixa,
} from '../src/render/layout';
import { PAGINA_PAISAGEM, PRODUTOS_PAISAGEM } from '../src/render/layout-paisagem';
import { validateNFe } from '../src/validate/validate';
import { textoNaCaixa, itensNaCaixa, itensNaCaixaPagina } from './helpers/danfe';
import { decodificaCode128, type Imagem } from './helpers/decodificadores';
import { abrePdf, extraiTexto } from './helpers/raster';

const fixture = (arquivo: string) => readFileSync(resolve('tests/fixtures', arquivo), 'utf8');
const modelo = (arquivo: string) => parseNFe(fixture(arquivo));

async function itens(pdf: Uint8Array, numero = 1) {
  const documento = await abrePdf(pdf);
  return extraiTexto(await documento.getPage(numero));
}

async function texto(pdf: Uint8Array, numero = 1): Promise<string> {
  return (await itens(pdf, numero))
    .map((item) => item.str)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Rasteriza apenas a região da caixa do barras em alta resolução (≈2,4 px por
 * módulo) via `transform` do pdf.js — o recorte inclui a moldura do quadro.
 */
async function recorteBarras(pdf: Uint8Array, caixa: Caixa, alturaCm: number): Promise<Imagem> {
  expect(caixa.y + caixa.altura, 'caixa dentro da página').toBeLessThanOrEqual(alturaCm);
  const documento = await abrePdf(pdf);
  const pagina = await documento.getPage(1);
  const escala = 32; // px por ponto PDF
  // 1 pt para dentro: exclui o traço de 0,6 pt da moldura, que não faz parte
  // do símbolo e atrapalha o ZXing. A faixa de silêncio permanece integral.
  const recuo = 1;
  const x0Pt = caixa.x * PT_POR_CM + recuo;
  const y0Pt = caixa.y * PT_POR_CM + recuo;
  const largura = Math.ceil((caixa.largura * PT_POR_CM - 2 * recuo) * escala);
  const altura = Math.ceil((caixa.altura * PT_POR_CM - 2 * recuo) * escala);
  const canvas = createCanvas(largura, altura);
  const contexto = canvas.getContext('2d');
  contexto.fillStyle = '#ffffff';
  contexto.fillRect(0, 0, largura, altura);
  await pagina.render({
    canvasContext: contexto as never,
    viewport: pagina.getViewport({ scale: 1 }),
    transform: [escala, 0, 0, escala, -x0Pt * escala, -y0Pt * escala],
  }).promise;
  const rgba = contexto.getImageData(0, 0, largura, altura).data;
  const dados = new Uint8ClampedArray(largura * altura);
  for (let i = 0; i < dados.length; i++) {
    const p = i * 4;
    dados[i] = 0.299 * (rgba[p] ?? 0) + 0.587 * (rgba[p + 1] ?? 0) + 0.114 * (rgba[p + 2] ?? 0);
  }
  return { dados, largura, altura };
}

/** Mede o módulo X e a zona de silêncio diretamente nos pixels do PDF. */
function medeSilencio(imagem: Imagem): { modulo: number; silencio: number; razao: number } {
  const linha = Math.floor(imagem.altura / 2);
  const faixas: { preta: boolean; comprimento: number }[] = [];
  let corAnterior: boolean | undefined;
  let comprimento = 0;
  for (let x = 0; x < imagem.largura; x++) {
    const preta = (imagem.dados[linha * imagem.largura + x] ?? 255) < 128;
    if (preta !== corAnterior) {
      if (corAnterior !== undefined) faixas.push({ preta: corAnterior, comprimento });
      corAnterior = preta;
      comprimento = 0;
    }
    comprimento++;
  }
  if (corAnterior !== undefined) faixas.push({ preta: corAnterior, comprimento });
  const modulo = Math.min(...faixas.filter((f) => f.preta).map((f) => f.comprimento));
  const primeira = faixas[0];
  const silencio = primeira !== undefined && !primeira.preta ? primeira.comprimento : 0;
  return { modulo, silencio, razao: silencio / modulo };
}

describe('item 1 — protocolo de autorização de uso e autenticidade (MOC Anexo II §3.9.1)', () => {
  // Tabela "Tamanho dos Campos" do MOC Anexo II §3.8.1/§3.8.2 (medidas em cm).
  const protocoloRetrato: Caixa = { x: 8.12, y: 6.46, largura: 12.7, altura: 0.85 };
  const protocoloPaisagem: Caixa = { x: 16.89, y: 3.57, largura: 12.57, altura: 0.64 };
  const autenticidade1 = 'Consulta de autenticidade no portal nacional da NF-e';
  const autenticidade2 = 'www.nfe.fazenda.gov.br/portal ou no site da Sefaz Autorizadora';
  // nProt e dhRecbto lidos diretamente em tests/fixtures/nfe-cst-00.xml:150-156.
  const protocolo = '000000622619451 10/01/2026 12:35:00';

  it('retrato imprime o rótulo e nProt + dhRecbto ao lado de natureza da operação', async () => {
    const itensDaPagina = await itens(await renderDanfe(modelo('nfe-cst-00.xml')));
    const caixa = itensNaCaixa(itensDaPagina, protocoloRetrato)
      .map((item) => item.str)
      .join(' ')
      .replace(/\s+/g, ' ');
    expect(caixa).toContain('PROTOCOLO DE AUTORIZAÇÃO DE USO');
    expect(caixa).toContain(protocolo);
  });

  it('paisagem imprime o rótulo e nProt + dhRecbto no campo DADOS DA NF-e', async () => {
    const pdf = await renderDanfe(modelo('nfe-cst-00.xml'), { layout: 'paisagem' });
    const itensDaPagina = await itens(pdf);
    const caixa = itensNaCaixaPagina(itensDaPagina, protocoloPaisagem, PAGINA_PAISAGEM.alturaCm)
      .map((item) => item.str)
      .join(' ')
      .replace(/\s+/g, ' ');
    expect(caixa).toContain('PROTOCOLO DE AUTORIZAÇÃO DE USO');
    expect(caixa).toContain(protocolo);
  });

  it('retrato e paisagem trazem o texto de consulta de autenticidade', async () => {
    for (const opcoes of [{}, { layout: 'paisagem' as const }]) {
      const textoPagina = await texto(await renderDanfe(modelo('nfe-cst-00.xml'), opcoes));
      expect(textoPagina).toContain(autenticidade1);
      expect(textoPagina).toContain(autenticidade2);
    }
  });
});

describe('item 2 — razão social no lugar do nome fantasia (MOC §3.7.6)', () => {
  // xNome e xFant lidos diretamente em tests/fixtures/nfe-cst-00.xml:28-29.
  const razaoSocial = 'Indústria Vale Verde Ltda';
  const fantasia = 'Indústria';

  it('retrato mostra a razão social e o fantasia apenas como linha extra', async () => {
    const caixa = textoNaCaixa(
      await itens(await renderDanfe(modelo('nfe-cst-00.xml'))),
      CABECALHO.emitente,
    );
    expect(caixa).toContain(razaoSocial);
    expect(caixa).toContain(`Fantasia: ${fantasia}`);
  });

  it('paisagem mostra a razão social e o fantasia apenas como linha extra', async () => {
    const emitente: Caixa = { x: 2.41, y: 0.47, largura: 11.43, altura: 3.1 };
    const caixa = itensNaCaixaPagina(
      await itens(await renderDanfe(modelo('nfe-cst-00.xml'), { layout: 'paisagem' })),
      emitente,
      PAGINA_PAISAGEM.alturaCm,
    )
      .map((item) => item.str)
      .join(' ');
    expect(caixa).toContain(razaoSocial);
    expect(caixa).toContain(`Fantasia: ${fantasia}`);
  });

  it('NFC-e mostra a razão social e o fantasia apenas como linha extra', async () => {
    // xNome/xFant lidos diretamente em tests/fixtures/nfce-consumidor-cpf.xml:28-29.
    const pagina = await texto(await renderDanfeNfce(modelo('nfce-consumidor-cpf.xml')));
    expect(pagina).toContain('Mercado Bom Prezzo Ltda ME');
    expect(pagina).toContain('Fantasia: Bom Prezzo');
  });
});

describe('item 3 — CST com dígito de origem (MOC Anexo I, orig + CST/CSOSN)', () => {
  it('cstItem concatena origem e CST/CSOSN segundo tabela derivada à mão', () => {
    // Input: origem 0 + CST 00 → "000"; origem 1 + CST 00 → "100";
    // origem 0 + CSOSN 102 → "0102"; origem 1 + CSOSN 900 → "1900".
    const casos: [Parameters<typeof cstItem>[0], string][] = [
      [{ orig: 0, cst: '00', grupo: 'ICMS00' }, '000'],
      [{ orig: 1, cst: '00', grupo: 'ICMS00' }, '100'],
      [{ orig: 0, csosn: '102', grupo: 'ICMSSN102' }, '0102'],
      [{ orig: 1, csosn: '900', grupo: 'ICMSSN900' }, '1900'],
    ];
    for (const [icms, esperado] of casos) expect(cstItem(icms)).toBe(esperado);
  });

  it('renderizador usa a origem do ICMS na coluna CST', async () => {
    const proc = modelo('nfe-cst-00.xml');
    // fixture: orig=0, CST=00 → "000"; com orig=1 → "100".
    const itensPadrao = itensNaCaixa(await itens(await renderDanfe(proc)), PRODUTOS.quadro).map(
      (item) => item.str,
    );
    expect(itensPadrao).toContain('000');

    const alterado = modelo('nfe-cst-00.xml');
    const icms = alterado.nfe.det[0]!.imposto.icms as { orig?: number };
    icms.orig = 1;
    const itensAlterados = itensNaCaixa(
      await itens(await renderDanfe(alterado)),
      PRODUTOS.quadro,
    ).map((item) => item.str);
    expect(itensAlterados).toContain('100');
  });
});

describe('item 4 — zona de silêncio do Code 128 (ISO/IEC 15417: 10 módulos)', () => {
  const chave = '35260110562655620245550280000217691341262140'; // literal do fixture

  it('retrato: silêncio ≥ 10X e ZXing decodifica o recorte do PDF', async () => {
    const recorte = await recorteBarras(
      await renderDanfe(modelo('nfe-cst-00.xml')),
      CABECALHO.chaveBarras,
      PAGINA.alturaCm,
    );
    const { modulo, silencio, razao } = medeSilencio(recorte);
    expect(
      razao,
      `módulo ${modulo}px, silêncio ${silencio}px — ISO 15417 exige ≥ 10X`,
    ).toBeGreaterThanOrEqual(10);
    expect(decodificaCode128(recorte)).toBe(chave);
  });

  it('paisagem: silêncio ≥ 10X e ZXing decodifica o recorte do PDF', async () => {
    const barrasPaisagem: Caixa = { x: 16.89, y: 0.47, largura: 12.57, altura: 1.19 };
    const recorte = await recorteBarras(
      await renderDanfe(modelo('nfe-cst-00.xml'), { layout: 'paisagem' }),
      barrasPaisagem,
      PAGINA_PAISAGEM.alturaCm,
    );
    const { razao } = medeSilencio(recorte);
    expect(razao).toBeGreaterThanOrEqual(10);
    expect(decodificaCode128(recorte)).toBe(chave);
  });
});

describe('item 5 — DOCTYPE com entidades inline é rejeitado', () => {
  it('parseNFe não expande entidade definida em DTD interno', () => {
    const comDoctype = fixture('nfe-cst-00.xml')
      .replace('?>', '?>\n<!DOCTYPE nfeProc [<!ENTITY xnome "INJETADO">]>')
      .replace('<xNome>Indústria Vale Verde Ltda</xNome>', '<xNome>&xnome;</xNome>');
    expect(() => parseNFe(comDoctype)).toThrow(/DOCTYPE/);
  });
});

describe('item 6 — namespaces com prefixo', () => {
  it('parseNFe aceita <nfe:nfeProc> com prefixo declarado', () => {
    const prefixado = fixture('nfe-cst-00.xml')
      .replace(/<([A-Za-z][\w.-]*)/g, '<nfe:$1')
      .replace(/<\/([A-Za-z][\w.-]*)/g, '</nfe:$1')
      .replace('<nfe:nfeProc ', '<nfe:nfeProc xmlns:nfe="http://www.portalfiscal.inf.br/nfe" ');
    const proc = parseNFe(prefixado);
    expect(proc.nfe.chave).toBe('35260110562655620245550280000217691341262140');
    expect(proc.nfe.emit.xNome).toBe('Indústria Vale Verde Ltda');
    expect(proc.protNFe?.nProt).toBe('000000622619451');
  });
});

describe('item 7 — defeitos de leiaute', () => {
  const ncm = '72943057'; // literal em tests/fixtures/nfe-cst-00.xml:70

  it('NCM de 8 dígitos não quebra na coluna (retrato e paisagem)', async () => {
    const retrato = itensNaCaixa(
      await itens(await renderDanfe(modelo('nfe-cst-00.xml'))),
      PRODUTOS.quadro,
    ).map((item) => item.str);
    expect(retrato).toContain(ncm);

    const paisagem = itensNaCaixaPagina(
      await itens(await renderDanfe(modelo('nfe-cst-00.xml'), { layout: 'paisagem' })),
      PRODUTOS_PAISAGEM.quadro,
      PAGINA_PAISAGEM.alturaCm,
    ).map((item) => item.str);
    expect(paisagem).toContain(ncm);
  });

  it('CEP e telefone são formatados pt-BR no emitente e no destinatário', async () => {
    const itensDaPagina = await itens(await renderDanfe(modelo('nfe-cst-00.xml')));
    // Valores crus no fixture: CEP 80064391 / fone 4121225867 (dest) e
    // CEP 13039951 / fone 1915476611 (emit).
    expect(textoNaCaixa(itensDaPagina, DESTINATARIO.cep)).toContain('80064-391');
    expect(textoNaCaixa(itensDaPagina, DESTINATARIO.fone)).toContain('(41) 2122-5867');
    expect(textoNaCaixa(itensDaPagina, CABECALHO.emitente)).toContain('13039-951');
    expect(textoNaCaixa(itensDaPagina, CABECALHO.emitente)).toContain('(19) 1547-6611');
  });

  it('paginação derivada da altura mínima de 0,5 cm por item (95 itens → 8 folhas)', async () => {
    // Área útil do quadro: 6,77 − 0,55 = 6,22 cm; altura mínima por item 0,5 cm
    // (MOC §3.8.1) → 12 itens por folha → ceil(95/12) = 8. Antes o NCM
    // quebrava em 2 linhas e inflava a altura para 10 folhas.
    const pdf = await renderDanfe(modelo('nfe-muitos-itens-95.xml'));
    expect((await PDFDocument.load(pdf)).getPageCount()).toBe(8);
  });

  it('segunda linha da chave não encosta na borda inferior do quadro', async () => {
    const itensDaPagina = await itens(await renderDanfe(modelo('nfe-cst-00.xml')));
    const segunda = itensDaPagina.find((item) => item.str.startsWith('8000'));
    expect(segunda).toBeDefined();
    const fundoCaixaPt =
      (PAGINA.alturaCm - CABECALHO.chaveTexto.y - CABECALHO.chaveTexto.altura) * PT_POR_CM;
    expect(segunda!.y - fundoCaixaPt).toBeGreaterThanOrEqual(0.05 * PT_POR_CM);
  });
});

describe('item 8 — lacunas de validação', () => {
  it('modelo 55 sem destinatário é erro; modelo 65 anônimo continua válido', () => {
    const semDest = modelo('nfe-cst-00.xml');
    semDest.nfe.dest = undefined;
    const resultado55 = validateNFe(semDest);
    expect(resultado55.erros.map((p) => p.code)).toContain('DESTINATARIO_OBRIGATORIO');

    const anonima = validateNFe(modelo('nfce-anonima.xml'));
    expect(anonima.erros.map((p) => p.code)).not.toContain('DESTINATARIO_OBRIGATORIO');
  });

  it('pICMS com vírgula decimal gera ParseError com o campo identificado', () => {
    const comVirgula = fixture('nfe-cst-00.xml').replace(
      '<pICMS>18.00</pICMS>',
      '<pICMS>18,00</pICMS>',
    );
    expect(() => parseNFe(comVirgula)).toThrow(/pICMS/);
    expect(() => parseNFe(comVirgula)).toThrow(/inválido|decimal/i);
  });
});
