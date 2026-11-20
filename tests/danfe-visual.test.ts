/**
 * Regressão visual: rasteriza o PDF com pdf.js + @napi-rs/canvas e compara
 * com imagens douradas versionadas em `tests/golden/`, com tolerância para
 * diferenças de antialiasing. Regeneração: `npm run golden`.
 */
import { describe, expect, it } from 'vitest';
import { comparaComGolden, paginasRasterizadas, renderiza } from './helpers/danfe';

describe('regressão visual do DANFE retrato', () => {
  it('nfe-cst-00 — leiaute completo de uma folha', async () => {
    const paginas = await paginasRasterizadas(await renderiza('nfe-cst-00.xml'));
    expect(paginas).toHaveLength(1);
    comparaComGolden('cst-00', paginas[0]!, 1);
  });

  it('nfe-duplicatas — quadro fatura preenchido', async () => {
    const paginas = await paginasRasterizadas(await renderiza('nfe-duplicatas.xml'));
    expect(paginas).toHaveLength(1);
    comparaComGolden('duplicatas', paginas[0]!, 1);
  });

  it('nfe-homologacao — marca d’água SEM VALOR FISCAL', async () => {
    const paginas = await paginasRasterizadas(await renderiza('nfe-homologacao.xml'));
    expect(paginas).toHaveLength(1);
    comparaComGolden('homologacao', paginas[0]!, 1);
  });

  it('nfe-denegada — marca d’água DENEGADA', async () => {
    const paginas = await paginasRasterizadas(await renderiza('nfe-denegada.xml'));
    expect(paginas).toHaveLength(1);
    comparaComGolden('denegada', paginas[0]!, 1);
  });

  it('nfe-muitos-itens-60 — primeira e segunda folhas com continuação', async () => {
    const paginas = await paginasRasterizadas(await renderiza('nfe-muitos-itens-60.xml'));
    expect(paginas.length).toBeGreaterThanOrEqual(2);
    comparaComGolden('muitos-itens', paginas[0]!, 1);
    comparaComGolden('muitos-itens', paginas[1]!, 2);
  });
});
