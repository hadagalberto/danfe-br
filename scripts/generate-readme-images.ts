/**
 * Gera as ilustrações dos READMEs a partir das imagens douradas dos testes
 * visuais (`tests/golden/`). Nenhum pixel é desenhado à mão: as imagens são as
 * mesmas rasterizações determinísticas usadas como referência de regressão,
 * recodificadas em PNG para o diretório `docs/images/`.
 *
 * Execute `npm run golden` antes, se as imagens douradas ainda não existirem.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';

const IMAGENS: readonly { origem: string; destino: string; descricao: string }[] = [
  { origem: 'cst-00-p1.png', destino: 'danfe-retrato.png', descricao: 'DANFE retrato' },
  { origem: 'paisagem-cst-00-p1.png', destino: 'danfe-paisagem.png', descricao: 'DANFE paisagem' },
  { origem: 'nfce-80-p1.png', destino: 'danfe-nfce-80.png', descricao: 'DANFE NFC-e 80 mm' },
  { origem: 'nfce-58-p1.png', destino: 'danfe-nfce-58.png', descricao: 'DANFE NFC-e 58 mm' },
  {
    origem: 'homologacao-p1.png',
    destino: 'danfe-homologacao.png',
    descricao: 'DANFE de homologação (SEM VALOR FISCAL)',
  },
  {
    origem: 'evento-cancelamento-p1.png',
    destino: 'evento-cancelamento.png',
    descricao: 'Comprovante de cancelamento',
  },
];

const origem = resolve('tests/golden');
const destino = resolve('docs/images');
mkdirSync(destino, { recursive: true });

for (const imagem of IMAGENS) {
  const golden = PNG.sync.read(readFileSync(resolve(origem, imagem.origem)));
  const png = new PNG({ width: golden.width, height: golden.height });
  png.data = Buffer.from(golden.data);
  const caminho = resolve(destino, imagem.destino);
  writeFileSync(caminho, PNG.sync.write(png));
  console.log(`${imagem.descricao}: ${caminho} (${golden.width}x${golden.height})`);
}
