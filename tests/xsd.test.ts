/**
 * Hook opcional de validação XSD (SPEC — sem libxml nativo no núcleo).
 *
 * Vetores: fixtures oficiais sintéticos do corpus (`nfeProc`, `NFe` raiz,
 * eventos) para seleção de esquema; validador injetado com respostas
 * conhecidas válidas/inválidas, exceção e formato inválido — nenhum teste
 * depende de rede ou de validador externo.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  ESQUEMAS_XSD,
  detectaEsquemaXsd,
  validaNFeComXsd,
  validaXsd,
  type ValidadorXsd,
} from '../src/validate/xsd';

function fixture(nome: string): string {
  return readFileSync(resolve('tests/fixtures', nome), 'utf8');
}

const NFE_PROC = fixture('nfe-cst-00.xml');
const NFE_RAIZ = fixture('nfe-sem-protocolo.xml');
const CANCELAMENTO = fixture('evento-cancelamento.xml');
const CCE = fixture('evento-cce.xml');

const aprovado: ValidadorXsd = () => ({ valido: true, problemas: [] });

describe('detectaEsquemaXsd — seleção do XSD oficial vendado', () => {
  it('seleciona procNFe_v4.00.xsd para nfeProc', () => {
    expect(detectaEsquemaXsd(NFE_PROC)).toEqual(ESQUEMAS_XSD.nfeProc);
    expect(detectaEsquemaXsd(NFE_PROC)?.arquivo).toBe(
      'schemas/PL_009q_NT2025_001_v1.00/procNFe_v4.00.xsd',
    );
  });

  it('seleciona nfe_v4.00.xsd para NFe raiz (sem protocolo)', () => {
    expect(detectaEsquemaXsd(NFE_RAIZ)).toEqual(ESQUEMAS_XSD.NFe);
  });

  it('seleciona os XSDs de eventos cancelamento e CC-e', () => {
    expect(detectaEsquemaXsd(CANCELAMENTO)?.arquivo).toContain('cancelamento');
    expect(detectaEsquemaXsd(CCE)?.arquivo).toContain('cce');
    expect(detectaEsquemaXsd(CANCELAMENTO)?.raiz).toBe('procEventoCancNFe');
    expect(detectaEsquemaXsd(CCE)?.raiz).toBe('procCCeNFe');
  });

  it('cita a fonte oficial em todo esquema e retorna undefined sem lançar', () => {
    for (const esquema of Object.values(ESQUEMAS_XSD)) {
      expect(esquema.urlFonte).toMatch(/^https:\/\//);
      expect(esquema.pacote.length).toBeGreaterThan(0);
    }
    expect(detectaEsquemaXsd('')).toBeUndefined();
    expect(detectaEsquemaXsd('<foo/>')).toBeUndefined();
    expect(detectaEsquemaXsd('xml quebrado <')).toBeUndefined();
  });
});

describe('validaXsd — normalize o resultado do validador injetado', () => {
  it('entrega o XML e o esquema ao hook e aceita documento válido', async () => {
    const validador = vi.fn(aprovado);
    const resultado = await validaXsd(NFE_PROC, validador);
    expect(resultado.valido).toBe(true);
    expect(resultado.problemas).toEqual([]);
    expect(resultado.esquema).toEqual(ESQUEMAS_XSD.nfeProc);
    expect(validador).toHaveBeenCalledTimes(1);
    expect(validador.mock.calls[0]?.[0]).toBe(NFE_PROC);
    expect(validador.mock.calls[0]?.[1]).toEqual(ESQUEMAS_XSD.nfeProc);
  });

  it('mapeia problemas com severidade, código, campo e localização', async () => {
    const validador: ValidadorXsd = () => ({
      valido: false,
      problemas: [
        {
          code: 'cStat-556',
          campo: 'infNFe/ide/cUF',
          message: 'cUF inválido',
          linha: 12,
          coluna: 7,
        },
        { severity: 'aviso', code: 'AVISO', message: 'Aviso do esquema' },
      ],
    });
    const resultado = await validaXsd(NFE_PROC, validador);
    expect(resultado.valido).toBe(false);
    expect(resultado.problemas).toEqual([
      {
        severity: 'erro',
        code: 'XSD_cStat-556',
        campo: 'infNFe/ide/cUF',
        message: 'cUF inválido (linha 12, coluna 7)',
      },
      { severity: 'aviso', code: 'XSD_AVISO', campo: undefined, message: 'Aviso do esquema' },
    ]);
  });

  it('aceita validador assíncrono', async () => {
    const validador: ValidadorXsd = () => Promise.resolve({ valido: true });
    expect((await validaXsd(NFE_PROC, validador)).valido).toBe(true);
  });

  it('reporta rejeição sem detalhes como problema XSD_INVALIDO', async () => {
    const resultado = await validaXsd(NFE_PROC, () => ({ valido: false }));
    expect(resultado.valido).toBe(false);
    expect(resultado.problemas[0]?.code).toBe('XSD_INVALIDO');
  });

  it('reporta falha do hook sem propagar a exceção', async () => {
    const resultado = await validaXsd(NFE_PROC, () => {
      throw new Error('libxml indisponível');
    });
    expect(resultado.valido).toBe(false);
    expect(resultado.problemas).toEqual([
      {
        severity: 'erro',
        code: 'XSD_HOOK_FALHA',
        campo: undefined,
        message: 'Validador XSD falhou: libxml indisponível',
      },
    ]);
  });

  it('reporta resultado inválido do hook e raiz desconhecida', async () => {
    const invalido = await validaXsd(NFE_PROC, (() => undefined) as unknown as ValidadorXsd);
    expect(invalido.problemas[0]?.code).toBe('XSD_RESULTADO_INVALIDO');
    const desconhecida = await validaXsd('<foo/>', aprovado);
    expect(desconhecida.problemas[0]?.code).toBe('XSD_RAIZ_DESCONHECIDA');
    expect(desconhecida.esquema).toBeUndefined();
  });
});

describe('validaNFeComXsd — validação estrutural + XSD em um só relatório', () => {
  it('aprova documento estruturalmente válido e XSD válido', async () => {
    const resultado = await validaNFeComXsd(NFE_PROC, aprovado);
    expect(resultado.valido).toBe(true);
    expect(resultado.erros).toEqual([]);
    expect(resultado.xsd.valido).toBe(true);
    expect(resultado.chaveValida).toBe(true);
    expect(resultado.situacaoProtocolo.autorizada).toBe(true);
  });

  it('reprova quando o XSD rejeita mesmo com estrutura válida', async () => {
    const resultado = await validaNFeComXsd(NFE_PROC, () => ({
      valido: false,
      problemas: [{ code: 'XSD_556', message: 'Rejeição 556' }],
    }));
    expect(resultado.valido).toBe(false);
    expect(resultado.erros.map((p) => p.code)).toContain('XSD_XSD_556');
    expect(resultado.totaisValidos).toBe(true);
  });

  it('reprova quando a estrutura é inválida mesmo com XSD válido', async () => {
    const validador = vi.fn(aprovado);
    const resultado = await validaNFeComXsd(NFE_RAIZ, validador);
    expect(resultado.valido).toBe(false);
    expect(resultado.erros.map((p) => p.code)).toContain('SEM_PROTOCOLO');
    expect(resultado.xsd.valido).toBe(true);
    expect(validador).toHaveBeenCalledTimes(1);
  });
});
