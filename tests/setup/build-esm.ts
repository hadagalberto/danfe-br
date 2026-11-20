/**
 * Garante que o build ESM (`dist/`) exista antes da suíte: o smoke test de
 * navegador importa `dist/index.js`, e o teste da CLI executa `dist/cli.js`.
 * Assim `npm test` funciona sozinho, sem exigir `npm run build` antes.
 */
import { build } from 'tsup';

export async function setup(): Promise<void> {
  await build({ config: 'tsup.config.ts', silent: true });
}
