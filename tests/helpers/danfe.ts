/** Helpers compartilhados pelos testes do renderizador de DANFE. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect } from 'vitest';
import { PNG } from 'pngjs';
import { parseNFe } from '../../src/parse/nfe';
import { renderDanfe, type OpcoesRenderDanfe } from '../../src/render/danfe-retrato';
import { PAGINA, PT_POR_CM, type Caixa } from '../../src/render/layout';
import {
  abrePdf,
  extraiTexto,
  rasteriza,
  type PaginaRasterizada,
  type TextoExtraido,
} from './raster';

export function fixture(arquivo: string) {
  return parseNFe(readFileSync(resolve('tests/fixtures', arquivo), 'utf8'));
}

export async function renderiza(arquivo: string, opcoes?: OpcoesRenderDanfe): Promise<Uint8Array> {
  return renderDanfe(fixture(arquivo), opcoes);
}

/** Textos cuja origem cai dentro da caixa (coordenadas MOC, origem no topo). */
export function itensNaCaixaPagina(
  itens: TextoExtraido[],
  caixa: Caixa,
  alturaCm: number = PAGINA.alturaCm,
): TextoExtraido[] {
  const alturaPt = alturaCm * PT_POR_CM;
  const tolerancia = 0.15;
  return itens.filter((item) => {
    const xCm = item.x / PT_POR_CM;
    const yCm = (alturaPt - item.y) / PT_POR_CM;
    return (
      xCm >= caixa.x - tolerancia &&
      xCm <= caixa.x + caixa.largura + tolerancia &&
      yCm >= caixa.y - tolerancia &&
      yCm <= caixa.y + caixa.altura + tolerancia
    );
  });
}

export function itensNaCaixa(itens: TextoExtraido[], caixa: Caixa): TextoExtraido[] {
  return itensNaCaixaPagina(itens, caixa);
}

/** Texto concatenado de uma caixa, normalizado para comparação. */
export function textoNaCaixa(itens: TextoExtraido[], caixa: Caixa): string {
  return itensNaCaixa(itens, caixa)
    .map((item) => item.str)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function esperaTextoNaCaixa(
  itens: TextoExtraido[],
  caixa: Caixa,
  trecho: string,
  descricao = '',
): void {
  const texto = textoNaCaixa(itens, caixa);
  expect(
    texto,
    `${descricao} — esperado ${JSON.stringify(trecho)}; obtido ${JSON.stringify(texto)}`,
  ).toContain(trecho);
}

export async function itensDaPagina(pdf: Uint8Array, numero: number): Promise<TextoExtraido[]> {
  const documento = await abrePdf(pdf);
  expect(documento.numPages).toBeGreaterThanOrEqual(numero);
  return extraiTexto(await documento.getPage(numero));
}

/**
 * Compara a rasterização com a imagem dourada versionada.
 * Tolerância: no máximo 0,5% dos pixels podem diferir em mais de 12 níveis
 * em algum canal — absorve pequenas diferenças de antialiasing entre
 * versões do motor de rasterização sem esconder mudanças de leiaute.
 */
export function comparaComGolden(nome: string, pagina: PaginaRasterizada, numero: number): void {
  const esperado = PNG.sync.read(readFileSync(resolve('tests/golden', `${nome}-p${numero}.png`)));
  expect(pagina.largura, 'largura da imagem').toBe(esperado.width);
  expect(pagina.altura, 'altura da imagem').toBe(esperado.height);
  const atual = pagina.pixels;
  const referencia = esperado.data;
  let divergentes = 0;
  for (let i = 0; i < atual.length; i += 4) {
    const diff = Math.max(
      Math.abs((atual[i] ?? 0) - (referencia[i] ?? 0)),
      Math.abs((atual[i + 1] ?? 0) - (referencia[i + 1] ?? 0)),
      Math.abs((atual[i + 2] ?? 0) - (referencia[i + 2] ?? 0)),
    );
    if (diff > 12) divergentes++;
  }
  const total = atual.length / 4;
  const razao = divergentes / total;
  expect(razao, `pixels divergentes: ${divergentes}/${total}`).toBeLessThanOrEqual(0.005);
}

export async function paginasRasterizadas(pdf: Uint8Array): Promise<PaginaRasterizada[]> {
  return rasteriza(pdf, 1.0);
}
