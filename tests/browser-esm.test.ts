// @vitest-environment happy-dom
/**
 * Smoke test de navegador: carrega o **build ESM** (`dist/index.js`) dentro de
 * um contexto happy-dom e renderiza PDFs reais a partir de fixtures válidas.
 *
 * O build é produzido pelo globalSetup (tests/setup/build-esm.ts), então este
 * arquivo também funciona quando `npm test` é executado isoladamente. Usar o
 * bundle publicado (e não os fontes em src/) é o que torna o teste uma prova de
 * que o artefato que chega ao navegador funciona sem Node.js.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import type * as Api from '../src/index';

const especificador = pathToFileURL(resolve('dist/index.js')).href;
const api = (await import(/* @vite-ignore */ especificador)) as typeof Api;

function xml(nome: string): string {
  return readFileSync(resolve('tests/fixtures', nome), 'utf8');
}

function cabecalhoPdf(bytes: Uint8Array): string {
  return new TextDecoder('latin1').decode(bytes.subarray(0, 8));
}

describe('build ESM em ambiente de navegador (happy-dom)', () => {
  it('roda em contexto de navegador e expõe a API pública', () => {
    const globais = globalThis as { window?: unknown; document?: unknown };
    expect(typeof globais.window).toBe('object');
    expect(typeof globais.document).toBe('object');
    expect(especificador).toContain('dist/index.js');
    expect(typeof api.parseNFe).toBe('function');
    expect(typeof api.validateNFe).toBe('function');
    expect(typeof api.renderDanfe).toBe('function');
    expect(typeof api.renderDanfeNfce).toBe('function');
    expect(typeof api.encodeQrCode).toBe('function');
  });

  it('renderiza um DANFE retrato válido a partir da fixture canônica', async () => {
    const proc = api.parseNFe(xml('nfe-cst-00.xml'));
    expect(api.validateNFe(proc).valido).toBe(true);

    const pdf = await api.renderDanfe(proc);
    expect(cabecalhoPdf(pdf)).toMatch(/^%PDF-\d/);

    // pdf-lib (puro JS) valida a estrutura de objetos, xref e trailer do PDF.
    const documento = await PDFDocument.load(pdf);
    expect(documento.getPageCount()).toBeGreaterThanOrEqual(1);
    const pagina = documento.getPage(0);
    expect(pagina.getWidth()).toBeGreaterThan(400);
    expect(pagina.getHeight()).toBeGreaterThan(pagina.getWidth());
  });

  it('renderiza um DANFE NFC-e 58 mm válido no mesmo bundle', async () => {
    const proc = api.parseNFe(xml('nfce-consumidor-cpf.xml'));
    const pdf = await api.renderDanfeNfce(proc, { larguraMm: 58 });
    expect(cabecalhoPdf(pdf)).toMatch(/^%PDF-\d/);

    const documento = await PDFDocument.load(pdf);
    expect(documento.getPageCount()).toBe(1);
    // 58 mm ≈ 164 pt; 80 mm ≈ 227 pt — confirma o papel térmico correto.
    expect(documento.getPage(0).getWidth()).toBeGreaterThan(150);
    expect(documento.getPage(0).getWidth()).toBeLessThan(200);
  });
});
