/** Testes dos comprovantes de eventos: cancelamento e Carta de Correção. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DetEvento } from '../src/model/evento';
import { parseEventoNFe } from '../src/parse/evento';
import { renderEvento } from '../src/render/evento';
import { textoSimples } from './helpers/raster';

const evento = (arquivo: string) =>
  parseEventoNFe(readFileSync(resolve('tests/fixtures', arquivo), 'utf8'));

describe('renderização de eventos', () => {
  it('cancelamento: carimbo CANCELADO, SEM VALOR FISCAL e campos do evento', async () => {
    const pdf = await renderEvento(evento('evento-cancelamento.xml'));
    const texto = (await textoSimples(pdf)).join(' ');
    for (const trecho of [
      'COMPROVANTE DE CANCELAMENTO',
      'SEM VALOR FISCAL',
      'CANCELADO',
      '3526 0916 3430 4748 9847 5507 2000 3395 5317 0257 6782',
      '000000862723424',
      'Erro na emissão: valores divergentes do pedido.',
      '101 — Cancelamento de NF-e homologado',
    ]) {
      expect(texto, `trecho ausente: ${trecho}`).toContain(trecho);
    }
  });

  it('CC-e: correção e condições de uso no documento', async () => {
    const pdf = await renderEvento(evento('evento-cce.xml'));
    const texto = (await textoSimples(pdf)).join(' ');
    for (const trecho of [
      'CARTA DE CORREÇÃO ELETRÔNICA',
      'CC-e',
      'Corrigir razão social do destinatário para "Comercial Horizonte S.A.".',
      'CONDIÇÕES DE USO',
      '000000463107121',
      '135 — Evento registrado e vinculado a NF-e',
    ]) {
      expect(texto, `trecho ausente: ${trecho}`).toContain(trecho);
    }
  });

  it('carimbo personalizado e supressão da marca SEM VALOR FISCAL', async () => {
    const texto = (
      await textoSimples(
        await renderEvento(evento('evento-cancelamento.xml'), {
          carimbo: 'ANULADO',
          semMarcaValorFiscal: true,
        }),
      )
    ).join(' ');
    expect(texto).toContain('ANULADO');
    expect(texto).not.toContain('SEM VALOR FISCAL');
  });

  it('rejeita evento sem renderizador implementado', async () => {
    const base = evento('evento-cce.xml');
    const desconhecido = {
      ...base,
      evento: {
        ...base.evento,
        infEvento: {
          ...base.evento.infEvento,
          detEvento: { tipo: '999999', descEvento: 'Outro', campos: {} } as DetEvento,
        },
      },
    };
    await expect(renderEvento(desconhecido)).rejects.toThrow(/Renderizador indisponível/);
  });
});
