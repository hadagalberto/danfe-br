/**
 * Infraestrutura de parsing: parser XML puro (fast-xml-parser — dependência
 * permitida pela SPEC: “um parser XML puro em JS”) e helpers de normalização
 * tipados.
 *
 * Decisões de parsing (documentadas para auditoria):
 * - `parseTagValue: false` — todos os valores chegam como `string` e são
 *   convertidos explicitamente por `num`/`int`; nenhum número é “adivinhado”.
 * - atributos preservados com prefixo `@_`.
 * - elementos repetidos (det, dup, vol, autXML, ...) são normalizados para
 *   array por `arr()`.
 * - CDATA (usado no `qrCode` da NFC-e) é entregue como texto comum.
 */
import { XMLParser } from 'fast-xml-parser';

const PARSER = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,
});

/** Número de ponto flutuante estrito no formato TDec do leiaute (ex.: `1234.56`). */
const RE_DECIMAL = /^-?\d{1,15}(\.\d{1,10})?$/;
const RE_INTEIRO = /^\d{1,16}$/;

export type XNode = Record<string, unknown>;

/** Faz o parse de um XML completo para a árvore de nós (raiz incluída). */
export function parseXml(xml: string): XNode {
  return PARSER.parse(xml) as XNode;
}

/** Converte o valor de um elemento repetível em array (ausente ⇒ []). */
export function arr(v: unknown): unknown[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

/** Nó objeto (grupo XML). Retorna `undefined` para texto/ausente/array. */
export function node(v: unknown): XNode | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v !== 'object' || Array.isArray(v)) return undefined;
  return v as XNode;
}

/** Valor texto de um elemento folha (aceita `{'#text': ...}` quando há atributos). */
export function txt(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object' && !Array.isArray(v)) {
    const inner = (v as XNode)['#text'];
    if (typeof inner === 'string') return inner;
    if (typeof inner === 'number') return String(inner);
    return undefined;
  }
  return undefined;
}

/** Valor inteiro não negativo (códigos, quantidades inteiras). */
export function int(v: unknown): number | undefined {
  const s = txt(v);
  if (s === undefined || !RE_INTEIRO.test(s)) return undefined;
  return Number(s);
}

/** Valor decimal do leiaute (TDec_*), convertido para `number`. */
export function num(v: unknown): number | undefined {
  const s = txt(v);
  if (s === undefined || !RE_DECIMAL.test(s)) return undefined;
  return Number(s);
}

/** Booleano 0/1 do leiaute. */
export function bit(v: unknown): 0 | 1 | undefined {
  const n = int(v);
  if (n === 0 || n === 1) return n;
  return undefined;
}

/** Atributo `@_nome` de um nó. */
export function attr(n: XNode | undefined, nome: string): string | undefined {
  if (!n) return undefined;
  return txt(n[`@_${nome}`]);
}

/** Texto obrigatório com mensagem de erro contextual. */
export function requer<T>(valor: T | undefined, campo: string, contexto: string): T {
  if (valor === undefined) {
    throw new ParseError(`Campo obrigatório ausente: ${contexto}/${campo}`);
  }
  return valor;
}

/** Grupo XML obrigatório: falha com ParseError quando ausente ou não é objeto. */
export function requerNode(valor: unknown, campo: string, contexto: string): XNode {
  const n = node(valor);
  if (!n) {
    throw new ParseError(`Campo obrigatório ausente: ${contexto}/${campo}`);
  }
  return n;
}

/** Erro de parsing com contexto (tag/caminho). */
export class ParseError extends Error {
  readonly campo: string;
  constructor(mensagem: string, campo = '') {
    super(mensagem);
    this.name = 'ParseError';
    this.campo = campo;
  }
}
