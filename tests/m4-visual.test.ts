/**
 * Regressão visual do Marco 4: paisagem, NFC-e 80/58 mm e eventos.
 * Goldens versionados em `tests/golden/`; regeneração com `npm run golden`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseEventoNFe } from '../src/parse/evento';
import { parseNFe } from '../src/parse/nfe';
import { renderDanfe } from '../src/render/danfe-retrato';
import { renderDanfeNfce } from '../src/render/danfe-nfce';
import { renderEvento } from '../src/render/evento';
import { comparaComGolden, paginasRasterizadas } from './helpers/danfe';

const xml = (arquivo: string) => readFileSync(resolve('tests/fixtures', arquivo), 'utf8');

describe('regressão visual — Marco 4', () => {
  it('DANFE paisagem — leiaute completo do Anexo III.04', async () => {
    const paginas = await paginasRasterizadas(
      await renderDanfe(parseNFe(xml('nfe-cst-00.xml')), { layout: 'paisagem' }),
    );
    expect(paginas).toHaveLength(1);
    comparaComGolden('paisagem-cst-00', paginas[0]!, 1);
  });

  it('DANFE NFC-e 80 mm', async () => {
    const paginas = await paginasRasterizadas(
      await renderDanfeNfce(parseNFe(xml('nfce-consumidor-cpf.xml'))),
    );
    expect(paginas).toHaveLength(1);
    comparaComGolden('nfce-80', paginas[0]!, 1);
  });

  it('DANFE NFC-e 58 mm', async () => {
    const paginas = await paginasRasterizadas(
      await renderDanfeNfce(parseNFe(xml('nfce-consumidor-cpf.xml')), { larguraMm: 58 }),
    );
    expect(paginas).toHaveLength(1);
    comparaComGolden('nfce-58', paginas[0]!, 1);
  });

  it('cancelamento — carimbo CANCELADO', async () => {
    const paginas = await paginasRasterizadas(
      await renderEvento(parseEventoNFe(xml('evento-cancelamento.xml'))),
    );
    expect(paginas).toHaveLength(1);
    comparaComGolden('evento-cancelamento', paginas[0]!, 1);
  });

  it('CC-e — carta de correção', async () => {
    const paginas = await paginasRasterizadas(
      await renderEvento(parseEventoNFe(xml('evento-cce.xml'))),
    );
    expect(paginas).toHaveLength(1);
    comparaComGolden('evento-cce', paginas[0]!, 1);
  });
});
