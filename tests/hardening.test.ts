/**
 * Auditoria e endurecimento (marco 6): entradas hostis, bordas e ambientes
 * hostis. Cada caso nasceu de uma falha observada ao exercitar a API e a CLI
 * com dados malformados — os vetores válidos vêm do corpus versionado.
 */
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { executaCli, type IoCli } from '../src/cli/index';
import type { NFeProc } from '../src/model/nfe';
import { parseNFe } from '../src/parse/nfe';
import { encodeQrCode } from '../src/qrcode/qrcode';
import { renderDanfe } from '../src/render/danfe-retrato';
import { renderDanfeNfce } from '../src/render/danfe-nfce';
import { validateNFe } from '../src/validate/validate';
import { decodificaQr } from './helpers/decodificadores';
import { rasteriza } from './helpers/raster';

const FIXTURAS = resolve('tests/fixtures');
const xml = (nome: string) => resolve(FIXTURAS, nome);
const conteudo = (nome: string) => readFileSync(xml(nome), 'utf8');

function io(): { api: IoCli; erros: string[] } {
  const erros: string[] = [];
  return { api: { escreve: () => undefined, erro: (t) => erros.push(t) }, erros };
}

describe('entradas hostis no parser', () => {
  const casos = ['', '   \n ', 'texto simples', '<foo/>', '<NFe/>', '<nfeProc/>', '\uFEFF'];

  for (const caso of casos) {
    it(`parseNFe rejeita ${JSON.stringify(caso)} com ParseError`, () => {
      expect(() => parseNFe(caso)).toThrow(/Documento não reconhecido/);
    });
  }

  it('aceita BOM UTF-8 em documento válido', () => {
    const modelo = parseNFe(`\uFEFF${conteudo('nfe-cst-00.xml')}`);
    expect(modelo.nfe.chave).toHaveLength(44);
    expect(modelo.nfe.det).toHaveLength(1);
  });

  it('não expande entidades externas (billion laughs)', () => {
    const expansivel = `<!DOCTYPE lolz [
      <!ENTITY lol "lol">
      <!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
      <!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">
      <!ENTITY lol4 "&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;&lol3;">
      ]><lolz>&lol4;</lolz>`;
    expect(() => parseNFe(expansivel)).toThrow(/Documento não reconhecido/);
  });

  it('rejeita aninhamento profundo sem estouro de pilha', () => {
    const profundo = `<a>${'<a>'.repeat(5000)}x${'</a>'.repeat(5000)}</a>`;
    expect(() => parseNFe(profundo)).toThrow();
  });
});

describe('validação reporta, nunca lança', () => {
  it('modelo com campos obrigatórios ausentes vira problema VALIDACAO_INTERNA', () => {
    const quebrado = { nfe: {} } as unknown as NFeProc;
    const resultado = validateNFe(quebrado);
    expect(resultado.valido).toBe(false);
    expect(resultado.erros.map((p) => p.code)).toContain('VALIDACAO_INTERNA');
    expect(resultado.situacaoProtocolo.autorizada).toBe(false);
  });

  it('modelo com chave não-string não interrompe a validação', () => {
    const proc = parseNFe(conteudo('nfe-cst-00.xml'));
    (proc.nfe as unknown as { chave: unknown }).chave = undefined;
    const resultado = validateNFe(proc);
    expect(resultado.valido).toBe(false);
    expect(resultado.problemas.length).toBeGreaterThan(0);
  });
});

describe('corpus de paginação (SPEC — 1, 2 e 10 páginas)', () => {
  it('renderiza exatamente 1, 2 e 10 páginas nos fixtures correspondentes', async () => {
    const casos = [
      ['nfe-muitos-itens-10.xml', 1],
      ['nfe-muitos-itens-20.xml', 2],
      ['nfe-muitos-itens-95.xml', 10],
    ] as const;
    for (const [arquivo, paginas] of casos) {
      const pdf = await renderDanfe(parseNFe(conteudo(arquivo)));
      expect((await PDFDocument.load(pdf)).getPageCount(), arquivo).toBe(paginas);
    }
  });
});

describe('chave com CNPJ alfanumérico (NT 2025.001)', () => {
  it('renderiza retrato e paisagem sem exigir 44 dígitos', async () => {
    const modelo = parseNFe(conteudo('nfe-cnpj-alfanumerico.xml'));
    expect(modelo.nfe.chave).toMatch(/^[0-9]{6}[A-Z0-9]{12}[0-9]{26}$/);
    const retrato = await renderDanfe(modelo);
    const paisagem = await renderDanfe(modelo, { layout: 'paisagem' });
    const cabecalho = new TextDecoder('latin1');
    expect(cabecalho.decode(retrato.subarray(0, 5))).toBe('%PDF-');
    expect(cabecalho.decode(paisagem.subarray(0, 5))).toBe('%PDF-');
  });

  it('continua rejeitando chave com formato inválido', async () => {
    const modelo = parseNFe(conteudo('nfe-cst-00.xml'));
    modelo.nfe.chave = 'curta';
    await expect(renderDanfe(modelo)).rejects.toThrow(/Chave de acesso inválida/);
  });
});

describe('QR Code — entradas hostis', () => {
  it('nível de correção inválido falha com mensagem clara', () => {
    expect(() => encodeQrCode('abc', { nivelCorrecao: 'Z' as never })).toThrow(
      /nível de correção inválido/,
    );
  });

  it('payload maior que a capacidade falha com RangeError informativa', () => {
    expect(() => encodeQrCode('x'.repeat(4000))).toThrow(/não cabem no nível M/);
  });

  it('QR Code versão 3 (NT 2025.001 v1.01) é codificado e decodificado pelo renderizador', async () => {
    // NT 2025.001 v1.01 — modelo oficial online: https://endereco-consulta-QRCode?p=|<chave>|...
    // https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=trSXReoZPuY=
    const nfce = parseNFe(conteudo('nfce-anonima.xml'));
    const chave = nfce.nfe.chave;
    const qrV3 = `https://endereco-consulta-qrcode/?p=|${chave}|1|1|100|22.87|0.00`;
    if (nfce.infNFeSupl) nfce.infNFeSupl.qrCode = qrV3;
    const pagina = (await rasteriza(await renderDanfeNfce(nfce), 3))[0]!;
    expect(
      decodificaQr({ dados: pagina.pixels, largura: pagina.largura, altura: pagina.altura }),
    ).toBe(qrV3);
  });
});

describe('CLI — caminhos e arquivos hostis', () => {
  it('rejeita logotipo com assinatura válida mas conteúdo corrompido (código 2)', async () => {
    const diretorio = mkdtempSync(join(tmpdir(), 'danfe-hardening-'));
    try {
      const pngFalso = join(diretorio, 'falso.png');
      writeFileSync(
        pngFalso,
        Buffer.from([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82, 1,
        ]),
      );
      const { api, erros } = io();
      const resultado = await executaCli([xml('nfe-cst-00.xml'), '--logo', pngFalso], api);
      expect(resultado.codigo).toBe(2);
      expect(erros.join(' ')).toMatch(/logotipo/);
    } finally {
      rmSync(diretorio, { recursive: true, force: true });
    }
  });

  it('aceita diretórios com espaços e separadores do Windows', async () => {
    const diretorio = mkdtempSync(join(tmpdir(), 'danfe hardening '));
    try {
      const entrada = join(diretorio, 'nota de teste.xml');
      const saida = join(diretorio, 'pdfs gerados');
      copyFileSync(xml('nfe-cst-00.xml'), entrada);
      mkdirSync(saida, { recursive: true });
      const { api } = io();
      const resultado = await executaCli([entrada, '-o', saida], api);
      expect(resultado.codigo).toBe(0);
      expect(basename(resultado.pdfs[0] ?? '')).toBe('nota de teste.pdf');
    } finally {
      rmSync(diretorio, { recursive: true, force: true });
    }
  });

  it('rejeita --output .pdf para lote com código 2', async () => {
    const diretorio = mkdtempSync(join(tmpdir(), 'danfe-hardening-'));
    try {
      const { api, erros } = io();
      const resultado = await executaCli([FIXTURAS, '-o', join(diretorio, 'lote.pdf')], api);
      expect(resultado.codigo).toBe(2);
      expect(erros.join(' ')).toMatch(/--output deve ser um diretório/);
    } finally {
      rmSync(diretorio, { recursive: true, force: true });
    }
  });
});
