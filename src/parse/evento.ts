/**
 * Parser XML → modelo tipado de eventos da NF-e em seu formato de distribuição:
 * `procEventoNFe` (genérico), `procEventoCancNFe` (cancelamento) e
 * `procCCeNFe` (Carta de Correção Eletrônica).
 *
 * Fonte estrutural: `schemas/eventos/generico/leiauteEvento_v1.00.xsd`
 * (TEvento/TRetEvento/TProcEvento), `schemas/eventos/cancelamento/`
 * (leiauteEventoCancNFe_v1.00.xsd — detEvento com `nProt`/`xJust`) e
 * `schemas/eventos/cce/leiauteCCe_v1.00.xsd` (detEvento com
 * `xCorrecao`/`xCondUso`).
 *
 * O `detEvento` é especializado pelo `tpEvento` (110111 = cancelamento,
 * 110110 = CC-e); outros tipos são entregues como `DetEventoGenerico` com os
 * campos texto originais — o schema genérico usa `xs:anyType` justamente para
 * permitir eventos novos sem quebrar leitores.
 */
import {
  TP_EVENTO_CANCELAMENTO,
  TP_EVENTO_CCE,
  type DetEvento,
  type Evento,
  type ProcEventoNFe,
  type RetEvento,
} from '../model/evento';
import { arr, attr, int, node, ParseError, parseXml, requer, txt, type XNode } from './xml';

/** Faz o parse de um XML `procEventoNFe`/`procEventoCancNFe`/`procCCeNFe`. */
export function parseEventoNFe(xml: string): ProcEventoNFe {
  const raiz = parseXml(xml);
  for (const nome of ['procEventoNFe', 'procEventoCancNFe', 'procCCeNFe']) {
    const proc = node(raiz[nome]);
    if (proc) return parseProcEvento(proc, nome);
  }
  throw new ParseError(
    'Documento não reconhecido: esperado procEventoNFe, procEventoCancNFe ou procCCeNFe',
    'raiz',
  );
}

/**
 * Faz o parse de um lote com múltiplos `procEventoNFe` na raiz (formato
 * devolvido pelo Web Service de distribuição de DF-e, NT 2014.002).
 */
export function eventosDeLote(xml: string): ProcEventoNFe[] {
  const raiz = parseXml(xml);
  return arr(raiz['procEventoNFe'])
    .map((p) => node(p))
    .filter((p): p is XNode => p !== undefined)
    .map((p) => parseProcEvento(p, 'procEventoNFe'));
}

function parseProcEvento(proc: XNode, contexto: string): ProcEventoNFe {
  const evento = node(requer(proc['evento'], 'evento', contexto));
  const retEvento = node(requer(proc['retEvento'], 'retEvento', contexto));
  if (!evento || !retEvento) {
    throw new ParseError(
      `Evento de distribuição incompleto: faltam evento/retEvento em ${contexto}`,
      contexto,
    );
  }
  return {
    versao: attr(proc, 'versao') ?? attr(evento, 'versao') ?? '1.00',
    evento: parseEvento(evento, contexto),
    retEvento: parseRetEvento(retEvento, contexto),
  };
}

function parseEvento(evento: XNode, contexto: string): Evento {
  const c = `${contexto}/evento/infEvento`;
  const inf = node(requer(evento['infEvento'], 'infEvento', `${contexto}/evento`));
  if (!inf) {
    throw new ParseError('evento/infEvento ausente', `${contexto}/evento`);
  }
  const tpEvento = requer(txt(inf['tpEvento']), 'tpEvento', c);
  const det = node(requer(inf['detEvento'], 'detEvento', c));
  if (!det) {
    throw new ParseError('evento/infEvento/detEvento ausente', c);
  }

  return {
    versao: attr(evento, 'versao') ?? '1.00',
    infEvento: {
      id: attr(inf, 'Id'),
      cOrgao: requer(int(inf['cOrgao']), 'cOrgao', c),
      tpAmb: requer(int(inf['tpAmb']), 'tpAmb', c) as 1 | 2,
      cnpj: txt(inf['CNPJ']),
      cpf: txt(inf['CPF']),
      chNFe: requer(txt(inf['chNFe']), 'chNFe', c),
      dhEvento: requer(txt(inf['dhEvento']), 'dhEvento', c),
      tpEvento,
      nSeqEvento: requer(int(inf['nSeqEvento']), 'nSeqEvento', c),
      verEvento: requer(txt(inf['verEvento']), 'verEvento', c),
      detEvento: parseDetEvento(tpEvento, det, c),
    },
  };
}

function parseDetEvento(tpEvento: string, det: XNode, c: string): DetEvento {
  const descEvento = txt(det['descEvento']) ?? '';

  if (tpEvento === TP_EVENTO_CANCELAMENTO) {
    return {
      tipo: TP_EVENTO_CANCELAMENTO,
      descEvento: descEvento as 'Cancelamento',
      nProt: requer(txt(det['nProt']), 'nProt', `${c}/detEvento`),
      xJust: requer(txt(det['xJust']), 'xJust', `${c}/detEvento`),
    };
  }

  if (tpEvento === TP_EVENTO_CCE) {
    return {
      tipo: TP_EVENTO_CCE,
      descEvento: descEvento as 'Carta de Correção' | 'Carta de Correcao',
      xCorrecao: requer(txt(det['xCorrecao']), 'xCorrecao', `${c}/detEvento`),
      xCondUso: txt(det['xCondUso']) ?? '',
    };
  }

  // Evento genérico: preserva os campos texto do detEvento (xs:anyType).
  const campos: Record<string, string> = {};
  for (const [chave, valor] of Object.entries(det)) {
    if (chave.startsWith('@_')) continue;
    if (chave === 'Signature') continue;
    if (typeof valor === 'string') {
      campos[chave] = valor;
    } else if (valor !== null && typeof valor === 'object' && !Array.isArray(valor)) {
      const texto = txt(valor);
      if (texto !== undefined) campos[chave] = texto;
    }
  }
  return { tipo: tpEvento, descEvento, campos };
}

function parseRetEvento(ret: XNode, contexto: string): RetEvento {
  const c = `${contexto}/retEvento/infEvento`;
  const inf = node(requer(ret['infEvento'], 'infEvento', `${contexto}/retEvento`));
  if (!inf) {
    throw new ParseError('retEvento/infEvento ausente', `${contexto}/retEvento`);
  }
  return {
    versao: attr(ret, 'versao') ?? '1.00',
    infEvento: {
      id: attr(inf, 'Id'),
      tpAmb: requer(int(inf['tpAmb']), 'tpAmb', c) as 1 | 2,
      verAplic: requer(txt(inf['verAplic']), 'verAplic', c),
      cOrgao: requer(int(inf['cOrgao']), 'cOrgao', c),
      cStat: requer(int(inf['cStat']), 'cStat', c),
      xMotivo: requer(txt(inf['xMotivo']), 'xMotivo', c),
      chNFe: txt(inf['chNFe']),
      tpEvento: txt(inf['tpEvento']),
      xEvento: txt(inf['xEvento']),
      nSeqEvento: int(inf['nSeqEvento']),
      cOrgaoAutor: int(inf['cOrgaoAutor']),
      emailDest: txt(inf['emailDest']),
      dhRegEvento: txt(inf['dhRegEvento']),
      nProt: txt(inf['nProt']),
    },
  };
}
