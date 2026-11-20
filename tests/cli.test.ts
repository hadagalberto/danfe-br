import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { PNG } from 'pngjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  analisaArgumentos,
  executaCli,
  USO_CLI,
  VERSAO_CLI,
  type IoCli,
  type ResultadoCli,
} from '../src/cli/index';

const FIXTURAS = resolve('tests/fixtures');
const CHAVE_VALIDO = '35260110562655620245550280000217691341262140';

interface Captura {
  io: IoCli;
  saida: string[];
  erros: string[];
}

function captura(): Captura {
  const saida: string[] = [];
  const erros: string[] = [];
  return {
    io: { escreve: (texto) => saida.push(texto), erro: (texto) => erros.push(texto) },
    saida,
    erros,
  };
}

function caminho(nome: string): string {
  return resolve(FIXTURAS, nome);
}

async function pdfValido(caminhoPdf: string): Promise<PDFDocument> {
  const bytes = readFileSync(caminhoPdf);
  expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  return PDFDocument.load(bytes);
}

let temporario: string;

beforeEach(() => {
  temporario = mkdtempSync(join(tmpdir(), 'danfe-cli-'));
});

afterEach(() => {
  rmSync(temporario, { recursive: true, force: true });
});

describe('analisaArgumentos', () => {
  it('normaliza a linha de comando completa', () => {
    const analise = analisaArgumentos([
      'nota.xml',
      '-o',
      'saida/nota.pdf',
      '--layout',
      'PAISAGEM',
      '--logo',
      'logo.png',
      '--papel',
      '58',
      '--json',
      '--validate',
    ]);
    expect(analise.ok).toBe(true);
    if (!analise.ok) return;
    expect(analise.opcoes).toMatchObject({
      entradas: ['nota.xml'],
      saida: 'saida/nota.pdf',
      layout: 'paisagem',
      logo: 'logo.png',
      larguraMm: 58,
      json: true,
      validate: true,
    });
  });

  it('aceita --opcao=valor, -- e ajuda sem entrada', () => {
    const analise = analisaArgumentos(['--layout=nfce', '--', '-arquivo.xml']);
    expect(analise.ok).toBe(true);
    if (!analise.ok) return;
    expect(analise.opcoes.layout).toBe('nfce');
    expect(analise.opcoes.entradas).toEqual(['-arquivo.xml']);
    expect(analisaArgumentos(['--help']).ok).toBe(true);
    expect(analisaArgumentos(['--version']).ok).toBe(true);
  });

  it('rejeita leiaute, largura e opções desconhecidas', () => {
    expect(analisaArgumentos(['nota.xml', '--layout', 'quadro'])).toMatchObject({ ok: false });
    expect(analisaArgumentos(['nota.xml', '--papel', '42'])).toMatchObject({ ok: false });
    expect(analisaArgumentos(['nota.xml', '--faz-de-conta'])).toMatchObject({ ok: false });
    expect(analisaArgumentos(['nota.xml', '--output'])).toMatchObject({ ok: false });
    expect(analisaArgumentos([])).toMatchObject({ ok: false });
  });
});

describe('CLI — arquivo único', () => {
  it('renderiza DANFE retrato e grava PDF válido', async () => {
    const destino = join(temporario, 'nota.pdf');
    const cap = captura();
    const resultado = await executaCli([caminho('nfe-cst-00.xml'), '-o', destino], cap.io);

    expect(resultado.codigo).toBe(0);
    expect(resultado.pdfs).toEqual([destino]);
    expect(cap.erros.join('')).toBe('');
    const documento = await pdfValido(destino);
    expect(documento.getPageCount()).toBe(1);
    const pagina = documento.getPage(0);
    expect(pagina.getWidth()).toBeLessThan(pagina.getHeight());
    expect(resultado.relatorio.arquivos[0]?.chave).toBe(CHAVE_VALIDO);
  });

  it('--layout paisagem produz folha A4 na horizontal', async () => {
    const destino = join(temporario, 'paisagem.pdf');
    const resultado = await executaCli(
      [caminho('nfe-cst-00.xml'), '--layout', 'paisagem', '-o', destino],
      captura().io,
    );

    expect(resultado.codigo).toBe(0);
    const pagina = (await pdfValido(destino)).getPage(0);
    expect(pagina.getWidth()).toBeGreaterThan(pagina.getHeight());
  });

  it('detecta NFC-e e aplica --papel 58', async () => {
    const destino = join(temporario, 'cupom.pdf');
    const resultado = await executaCli(
      [caminho('nfce-consumidor-cpf.xml'), '--papel', '58', '-o', destino],
      captura().io,
    );

    expect(resultado.codigo).toBe(0);
    expect(resultado.relatorio.arquivos[0]?.modelo).toBe(65);
    const pagina = (await pdfValido(destino)).getPage(0);
    expect(pagina.getWidth()).toBeGreaterThan(150);
    expect(pagina.getWidth()).toBeLessThan(200);
  });

  it('--logo incorpora um PNG válido; assinatura inválida falha', async () => {
    const imagem = new PNG({ width: 8, height: 8 });
    imagem.data.fill(0xff);
    const logo = join(temporario, 'logo.png');
    writeFileSync(logo, PNG.sync.write(imagem));

    const semLogo = join(temporario, 'sem-logo.pdf');
    const comLogo = join(temporario, 'com-logo.pdf');
    expect(
      (await executaCli([caminho('nfe-cst-00.xml'), '-o', semLogo], captura().io)).codigo,
    ).toBe(0);
    const resultado = await executaCli(
      [caminho('nfe-cst-00.xml'), '--logo', logo, '-o', comLogo],
      captura().io,
    );
    expect(resultado.codigo).toBe(0);
    expect(readFileSync(comLogo).length).toBeGreaterThan(readFileSync(semLogo).length);
    await pdfValido(comLogo);

    const invalido = join(temporario, 'logo.txt');
    writeFileSync(invalido, 'não sou uma imagem');
    const cap = captura();
    const falha = await executaCli(
      [caminho('nfe-cst-00.xml'), '--logo', invalido, '-o', join(temporario, 'x.pdf')],
      cap.io,
    );
    expect(falha.codigo).toBe(2);
    expect(cap.erros.join('')).toMatch(/PNG ou JPEG/);
  });

  it('--json imprime relatório estruturado com validação real', async () => {
    const destino = join(temporario, 'nota.pdf');
    const cap = captura();
    const resultado = await executaCli(
      [caminho('nfe-cst-00.xml'), '--json', '-o', destino],
      cap.io,
    );

    expect(resultado.codigo).toBe(0);
    expect(cap.saida).toHaveLength(1);
    const relatorio = JSON.parse(cap.saida[0] ?? '') as {
      arquivos: {
        chave: string;
        modelo: number;
        numero: number;
        serie: number;
        validacao: { valido: boolean; chaveValida: boolean; totaisValidos: boolean };
        pdf: string;
      }[];
    };
    expect(relatorio.arquivos).toHaveLength(1);
    const item = relatorio.arquivos[0]!;
    expect(item.chave).toBe(CHAVE_VALIDO);
    expect(item.modelo).toBe(55);
    expect(item.numero).toBeGreaterThan(0);
    expect(item.serie).toBeGreaterThan(0);
    expect(item.validacao).toMatchObject({
      valido: true,
      chaveValida: true,
      totaisValidos: true,
    });
    expect(item.pdf).toBe(destino);
  });
});

describe('CLI — validação e códigos de saída', () => {
  it('--validate com documento válido não gera PDF e retorna 0', async () => {
    const cap = captura();
    const resultado = await executaCli([caminho('nfe-cst-00.xml'), '--validate'], cap.io);
    expect(resultado.codigo).toBe(0);
    expect(resultado.pdfs).toEqual([]);
    expect(cap.erros.join('')).toBe('');
  });

  it('--validate com dígito verificador adulterado retorna 1', async () => {
    const original = readFileSync(caminho('nfe-cst-00.xml'), 'utf8');
    const adulterado = original.replaceAll(CHAVE_VALIDO, `${CHAVE_VALIDO.slice(0, -1)}7`);
    expect(adulterado).not.toBe(original);
    const entrada = join(temporario, 'invalida.xml');
    writeFileSync(entrada, adulterado);

    const cap = captura();
    const resultado: ResultadoCli = await executaCli([entrada, '--validate'], cap.io);
    expect(resultado.codigo).toBe(1);
    expect(resultado.pdfs).toEqual([]);
    const erros = cap.erros.join('');
    expect(erros).toContain('CHAVE_DV');
    expect(erros).toContain('cStat 253');
    expect(resultado.relatorio.arquivos[0]?.validacao.chaveValida).toBe(false);
  });

  it('XML malformado é reportado sem gerar PDF', async () => {
    const entrada = join(temporario, 'quebrado.xml');
    writeFileSync(entrada, '<nfeProc><NFe>');
    const cap = captura();
    const resultado = await executaCli([entrada, '-o', join(temporario, 'nao.pdf')], cap.io);
    expect(resultado.codigo).toBe(1);
    expect(resultado.pdfs).toEqual([]);
    expect(cap.erros.join('')).toContain('falha ao analisar XML');
  });

  it('ajuda, versão e erro de uso escrevem no stream correto', async () => {
    const ajuda = captura();
    expect((await executaCli(['--help'], ajuda.io)).codigo).toBe(0);
    expect(ajuda.saida.join('')).toContain('--validate');
    expect(ajuda.erros).toEqual([]);

    const versao = captura();
    expect((await executaCli(['--version'], versao.io)).codigo).toBe(0);
    const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as { version: string };
    expect(versao.saida.join('')).toBe(`danfe-br ${pkg.version}\n`);
    expect(VERSAO_CLI).toBe(pkg.version);

    const uso = captura();
    expect((await executaCli([], uso.io)).codigo).toBe(2);
    expect(uso.erros.join('')).toContain(USO_CLI.trim());
    expect(uso.saida).toEqual([]);
  });
});

describe('CLI — lote de diretórios', () => {
  it('renderiza todos os XMLs do diretório para outro diretório', async () => {
    const entrada = join(temporario, 'xmls');
    const saida = join(temporario, 'pdfs');
    mkdirSync(entrada, { recursive: true });
    for (const nome of ['nfe-cst-00.xml', 'nfe-duplicatas.xml', 'nfce-consumidor-cpf.xml']) {
      copyFileSync(caminho(nome), join(entrada, nome));
    }
    writeFileSync(join(entrada, 'ignorado.txt'), 'não é XML');

    const cap = captura();
    const resultado = await executaCli([entrada, '-o', saida], cap.io);
    expect(resultado.codigo).toBe(0);
    expect(resultado.pdfs).toHaveLength(3);
    const gerados = readdirSync(saida).sort();
    expect(gerados).toEqual(['nfce-consumidor-cpf.pdf', 'nfe-cst-00.pdf', 'nfe-duplicatas.pdf']);
    for (const nome of gerados) await pdfValido(join(saida, nome));

    const capJson = captura();
    const comJson = await executaCli([entrada, '--json', '-o', saida], capJson.io);
    expect(comJson.codigo).toBe(0);
    const relatorio = JSON.parse(capJson.saida[0] ?? '') as { arquivos: unknown[] };
    expect(relatorio.arquivos).toHaveLength(3);
  });

  it('rejeita --output terminado em .pdf para lote', async () => {
    const cap = captura();
    const resultado = await executaCli(
      [resolve(FIXTURAS), '-o', join(temporario, 'lote.pdf')],
      cap.io,
    );
    expect(resultado.codigo).toBe(2);
    expect(cap.erros.join('')).toContain('para lote');
  });
});

describe('CLI — binário publicado (dist/cli.js)', () => {
  const binario = resolve('dist/cli.js');

  it('usa códigos de saída reais do processo', () => {
    const destino = join(temporario, 'binario.pdf');
    const ok = spawnSync(process.execPath, [binario, caminho('nfe-cst-00.xml'), '-o', destino], {
      encoding: 'utf8',
    });
    expect(ok.status).toBe(0);
    expect(existsSync(destino)).toBe(true);

    const entrada = join(temporario, 'invalida-binario.xml');
    writeFileSync(
      entrada,
      readFileSync(caminho('nfe-cst-00.xml'), 'utf8').replaceAll(
        CHAVE_VALIDO,
        `${CHAVE_VALIDO.slice(0, -1)}7`,
      ),
    );
    const invalido = spawnSync(process.execPath, [binario, entrada, '--validate'], {
      encoding: 'utf8',
    });
    expect(invalido.status).toBe(1);
    expect(invalido.stderr).toContain('CHAVE_DV');

    const uso = spawnSync(process.execPath, [binario, '--layout', 'nope'], { encoding: 'utf8' });
    expect(uso.status).toBe(2);
    expect(uso.stderr).toContain('Uso: danfe');
  });
});
