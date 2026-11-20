/**
 * Gera as imagens douradas (golden PNGs) dos testes de regressão visual.
 * Execute com `npm run golden` após alterações intencionais no leiaute.
 *
 * As imagens são rasterizações determinísticas de PDFs produzidos a partir
 * das fixtures versionadas, usando pdf.js + @napi-rs/canvas (binários
 * pré-compilados para todos os sistemas operacionais).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import { parseNFe } from '../src/parse/nfe';
import { renderDanfe, type OpcoesRenderDanfe } from '../src/render/danfe-retrato';
import { rasteriza } from '../tests/helpers/raster';

interface CasoGolden {
  arquivo: string;
  nome: string;
  opcoes?: OpcoesRenderDanfe;
  /** Quantidade máxima de páginas a versionar. */
  limite?: number;
}

const CASOS: readonly CasoGolden[] = [
  { arquivo: 'nfe-cst-00.xml', nome: 'cst-00' },
  { arquivo: 'nfe-duplicatas.xml', nome: 'duplicatas' },
  { arquivo: 'nfe-homologacao.xml', nome: 'homologacao' },
  { arquivo: 'nfe-denegada.xml', nome: 'denegada' },
  { arquivo: 'nfe-muitos-itens-60.xml', nome: 'muitos-itens', limite: 2 },
];

const destino = resolve('tests/golden');
mkdirSync(destino, { recursive: true });

for (const caso of CASOS) {
  const xml = readFileSync(resolve('tests/fixtures', caso.arquivo), 'utf8');
  const modelo = parseNFe(xml);
  const pdf = await renderDanfe(modelo, caso.opcoes);
  const paginas = await rasteriza(pdf, 1.0);
  const quantidade = Math.min(paginas.length, caso.limite ?? paginas.length);
  for (let indice = 0; indice < quantidade; indice++) {
    const pagina = paginas[indice]!;
    const png = new PNG({ width: pagina.largura, height: pagina.altura });
    png.data = Buffer.from(pagina.pixels);
    const caminho = resolve(destino, `${caso.nome}-p${indice + 1}.png`);
    writeFileSync(caminho, PNG.sync.write(png));
    console.log(`${caminho} (${pagina.largura}x${pagina.altura})`);
  }
  console.log(`${caso.nome}: ${paginas.length} página(s)`);
}
