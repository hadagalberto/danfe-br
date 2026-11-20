import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseNFe } from '../src/parse/nfe';
import { parseEventoNFe } from '../src/parse/evento';
import { validateNFe } from '../src/validate/validate';

const DIR_RAIZ = join(import.meta.dirname, '..');
const DIR_FIXTURES = join(import.meta.dirname, 'fixtures');

interface EntradaManifest {
  arquivo: string;
  descricao: string;
  tipo: 'nfeProc' | 'NFe' | 'evento';
  chave: string;
  mod: 55 | 65;
  tpAmb: 1 | 2;
  cStat: number | null;
  itens: number;
  csosn?: string;
  cst?: string;
  valido: boolean;
  problemas?: string[];
}

interface Manifest {
  gerado: string;
  entradas: EntradaManifest[];
}

const manifest: Manifest = JSON.parse(
  readFileSync(join(DIR_FIXTURES, 'manifest.json'), 'utf8'),
) as Manifest;

/**
 * O corpus é gerado por `npm run fixtures` (scripts/generate-fixtures.ts) e
 * versionado aqui. Este teste garante que:
 * 1. o manifest cobre exatamente os arquivos do diretório (nenhum órfão);
 * 2. todo XML parseia;
 * 3. a validação reproduce as expectativas declaradas por fixture
 *    (código/cStat/itens/validade/códigos de problema);
 * 4. as chaves e DVs são únicos e válidos entre as notas.
 */
describe('corpus de fixtures (tests/fixtures + manifest.json)', () => {
  it('manifest cobre exatamente os arquivos do diretório', () => {
    const arquivosDir = new Set(
      readdirSync(DIR_FIXTURES)
        .filter((f) => f.endsWith('.xml'))
        .sort(),
    );
    const arquivosManifest = new Set(manifest.entradas.map((e) => e.arquivo));
    expect(arquivosManifest).toEqual(arquivosDir);
    expect(manifest.gerado).toBe('scripts/generate-fixtures.ts');
  });

  it('chaves são únicas no corpus', () => {
    const chaves = manifest.entradas.map((e) => e.chave);
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it.each(manifest.entradas)('$arquivo: parse + validação conforme manifest', (entrada) => {
    const xml = readFileSync(join(DIR_FIXTURES, entrada.arquivo), 'utf8');
    expect(xml.endsWith('\n')).toBe(true); // LF, sem CRLF (SPEC .gitattributes)

    if (entrada.tipo === 'evento') {
      const proc = parseEventoNFe(xml);
      expect(proc.evento.infEvento.chNFe).toBe(entrada.chave);
      expect(proc.retEvento.infEvento.cStat).toBe(entrada.cStat);
      return;
    }

    const proc = parseNFe(xml);
    const nfe = proc.nfe;
    expect(nfe.chave).toBe(entrada.chave);
    expect(nfe.ide.mod).toBe(entrada.mod);
    expect(nfe.ide.tpAmb).toBe(entrada.tpAmb);
    expect(nfe.det).toHaveLength(entrada.itens);
    if (entrada.cst !== undefined) {
      const icms = nfe.det[0]!.imposto.icms!;
      expect(
        icms.grupo.startsWith('ICMSSN') ? undefined : 'cst' in icms ? icms.cst : undefined,
      ).toBe(entrada.cst);
    }
    if (entrada.csosn !== undefined) {
      const icms = nfe.det[0]!.imposto.icms!;
      expect('csosn' in icms ? icms.csosn : undefined).toBe(entrada.csosn);
    }
    if (entrada.tipo === 'nfeProc') {
      expect(proc.protNFe?.cStat).toBe(entrada.cStat);
    } else {
      expect(proc.protNFe).toBeUndefined();
      expect(entrada.cStat).toBeNull();
    }

    const resultado = validateNFe(proc);
    expect(resultado.valido).toBe(entrada.valido);
    const codigosProblemas = resultado.problemas.map((p) => p.code);
    expect(codigosProblemas).toEqual(entrada.problemas ?? []);
  });

  it('cobertura do corpus: todas as famílias de CST e CSOSN', () => {
    const csts = new Set(manifest.entradas.filter((e) => e.cst !== undefined).map((e) => e.cst));
    const csosns = new Set(
      manifest.entradas.filter((e) => e.csosn !== undefined).map((e) => e.csosn),
    );
    expect(csts).toEqual(
      new Set([
        '00',
        '02',
        '10',
        '15',
        '20',
        '30',
        '40',
        '41',
        '50',
        '51',
        '53',
        '60',
        '61',
        '70',
        '90',
      ]),
    );
    expect(csosns).toEqual(
      new Set(['101', '102', '103', '201', '202', '203', '300', '400', '500', '900']),
    );
  });

  it('cobertura do corpus: NFC-e, homologação, denegada, sem protocolo, IBS/CBS, ISSQN, DIFAL', () => {
    const descricoes = manifest.entradas.map((e) => e.descricao).join(' | ');
    expect(descricoes).toContain('NFC-e');
    expect(descricoes).toContain('homologação');
    expect(descricoes).toContain('denegada');
    expect(descricoes).toContain('sem protocolo');
    expect(descricoes).toContain('IBS/CBS');
    expect(descricoes).toContain('ISSQN');
    expect(descricoes).toContain('DIFAL');
    expect(descricoes).toContain('120 itens');
    expect(descricoes).toContain('duplicatas');
    expect(descricoes).toContain('cancelamento');
    expect(descricoes).toContain('Carta de Correção');
  });

  it('regeneração determinística: executar o gerador reproduz os mesmos bytes', () => {
    const saida = join(DIR_RAIZ, '.tmp', 'corpus-regenerado');
    // `node --import tsx` registra o loader do TS sem depender de shims .cmd
    // do npm (Windows/CI incluídos).
    execFileSync(process.execPath, ['--import', 'tsx', 'scripts/generate-fixtures.ts'], {
      cwd: DIR_RAIZ,
      env: { ...process.env, DANFE_BR_FIXTURES_DIR: saida },
      stdio: 'pipe',
    });
    const regenerados = readdirSync(saida)
      .filter((f) => f.endsWith('.xml'))
      .sort();
    const versionados = readdirSync(DIR_FIXTURES)
      .filter((f) => f.endsWith('.xml'))
      .sort();
    expect(regenerados).toEqual(versionados);
    for (const arquivo of versionados) {
      const a = readFileSync(join(DIR_FIXTURES, arquivo));
      const b = readFileSync(join(saida, arquivo));
      expect(b.equals(a), `${arquivo} divergiu da versão commitada`).toBe(true);
    }
  }, 60_000);
});
