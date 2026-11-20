/**
 * Saída ESC/POS para NFC-e com comando nativo de QR Code.
 *
 * Comandos ESC/POS (Epson): `ESC @` inicializa, `ESC t n` seleciona a tabela
 * de caracteres (n = 18 / 0x12 → PC860, português), `ESC a n` alinha,
 * `ESC E n` liga/desliga negrito, `ESC d n` avança linhas, `GS V n` corta o
 * papel. A família de comandos de código bidimensional `GS ( k` (cn = '1')
 * usa `fn 'A'` (modelo), `'C'` (tamanho do módulo), `'E'` (correção de erro),
 * `'P'` (armazena dados) e `'Q'` (imprime). Referência oficial Epson:
 *   https://support.epson.net/publist/reference_en/?ref=escpos
 * Sequência/modelo implementado conferidos com a implementação de referência
 * escpos-php (MIT), em `Printer::qrCode()`:
 *   https://github.com/mike42/escpos-php/blob/master/src/Mike42/Escpos/Printer.php
 * O QR Code é o conteúdo literal da tag `qrCode` do XML, codificado em UTF-8,
 * com correção de erro M (manual do DANFE NFC-e §4.5).
 *
 * Texto pt-BR é codificado em PC860 (tabela de caracteres 18), cujos bytes
 * 0x80–0xFF são representados pela tabela abaixo (Unicode → byte).
 */
import type { NFe, NFeProc } from '../model/nfe';
import { mascaraChave } from './formatacao';
import { conteudoNfce } from './nfce-conteudo';

const ESC = 0x1b;
const GS = 0x1d;

/** Tabela de caracteres PC860, bytes 0x80–0xFF em ordem. */
const PC860_ALTO =
  '\u00c7\u00fc\u00e9\u00e2\u00e3\u00e0\u00c1\u00e7\u00ea\u00ca\u00e8\u00cd\u00d4' +
  '\u00ec\u00c3\u00c2\u00c9\u00c0\u00c8\u00f4\u00f5\u00f2\u00da\u00f9\u00cc\u00d5' +
  '\u00dc\u00a2\u00a3\u00d9\u20a7\u00d3\u00e1\u00ed\u00f3\u00fa\u00f1\u00d1\u00aa' +
  '\u00ba\u00bf\u00d2\u00ac\u00bd\u00bc\u00a1\u00ab\u00bb\u2591\u2592\u2593\u2502' +
  '\u2524\u2561\u2562\u2556\u2555\u2563\u2551\u2557\u255d\u255c\u255b\u2510\u2514' +
  '\u2534\u252c\u251c\u2500\u253c\u255e\u255f\u255a\u2554\u2569\u2566\u2560\u2550' +
  '\u256c\u2567\u2568\u2564\u2565\u2559\u2558\u2552\u2553\u256b\u256a\u2518\u250c' +
  '\u2588\u2584\u258c\u2590\u2580\u03b1\u00df\u0393\u03c0\u03a3\u03c3\u00b5\u03c4' +
  '\u03a6\u0398\u03a9\u03b4\u221e\u03c6\u03b5\u2229\u2261\u00b1\u2265\u2264\u2320' +
  '\u2321\u00f7\u2248\u00b0\u2219\u00b7\u221a\u207f\u00b2\u25a0\u00a0';

const PC860_REVERSO = new Map<string, number>();
for (let i = 0; i < PC860_ALTO.length; i++) {
  PC860_REVERSO.set(PC860_ALTO[i]!, 0x80 + i);
}
// Glifos tipográficos do PDF que não existem no PC860 são normalizados.
const SUBSTITUICOES: Record<string, string> = {
  '–': '-',
  '—': '-',
  '…': '...',
  '“': '"',
  '”': '"',
  '‘': "'",
  '’': "'",
};

/** Codifica texto pt-BR em PC860; substitui o que não existe na tabela. */
export function codificaPc860(texto: string): Uint8Array {
  const bytes: number[] = [];
  for (const caractere of texto) {
    if (caractere === '\n') {
      bytes.push(0x0d, 0x0a);
      continue;
    }
    if (caractere === '\r') continue;
    const codigo = caractere.codePointAt(0) ?? 0x3f;
    if (codigo < 0x80) {
      bytes.push(codigo);
      continue;
    }
    const substituto = SUBSTITUICOES[caractere];
    if (substituto !== undefined) {
      bytes.push(...codificaPc860(substituto));
      continue;
    }
    bytes.push(PC860_REVERSO.get(caractere) ?? 0x3f);
  }
  return Uint8Array.from(bytes);
}

/** Construtor de fluxo ESC/POS. */
class Fluxo {
  private readonly bytes: number[] = [];

  cru(...valores: number[]): this {
    this.bytes.push(...valores);
    return this;
  }

  texto(valor: string): this {
    return this.cru(...codificaPc860(valor));
  }

  /** Comando `GS ( k`: pL/pH são o tamanho dos parâmetros + 2 (cn e fn). */
  qr(fn: number, parametros: number[]): this {
    const tamanho = parametros.length + 2;
    return this.cru(GS, 0x28, 0x6b, tamanho & 0xff, tamanho >>> 8, 0x31, fn, ...parametros);
  }

  resultado(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}

/** Opções da saída ESC/POS (mesmas do DANFE NFC-e). */
export interface OpcoesEscPos {
  larguraMm?: 80 | 58;
  detalharItens?: boolean;
  viaEstabelecimento?: boolean;
  /** Linhas antes do corte (padrão: 3). */
  linhasApos?: number;
  /** Inclui o corte parcial `GS V 1` no final (padrão: true). */
  cortar?: boolean;
}

/** Quantidade de caracteres por linha na largura de papel escolhida. */
export function colunasPapel(larguraMm: 80 | 58): number {
  return larguraMm === 80 ? 32 : 24;
}

/**
 * Gera o byte stream ESC/POS do DANFE NFC-e.
 *
 * @throws {Error} modelo diferente de 65 ou sem `infNFeSupl/qrCode`.
 */
export function toEscPos(documento: NFeProc | NFe, opcoes: OpcoesEscPos = {}): Uint8Array {
  const larguraMm = opcoes.larguraMm ?? 80;
  if (larguraMm !== 80 && larguraMm !== 58) {
    throw new Error(`Largura de papel inválida: ${String(larguraMm)} mm (use 80 ou 58).`);
  }
  const conteudo = conteudoNfce(documento, opcoes.detalharItens ?? true);
  const colunas = colunasPapel(larguraMm);
  const separador = '-'.repeat(colunas);
  const fluxo = new Fluxo();

  fluxo.cru(ESC, 0x40); // ESC @ — initialize
  fluxo.cru(ESC, 0x74, 0x12); // ESC t 18 — PC860 (português)
  fluxo.cru(ESC, 0x61, 0x01); // ESC a 1 — centralizado

  fluxo.texto(`${conteudo.cabecalho[0] ?? ''}\n`);
  fluxo.cru(ESC, 0x45, 0x01);
  fluxo.texto(`${conteudo.cabecalho[1] ?? ''}\n`);
  fluxo.cru(ESC, 0x45, 0x00);
  for (const linha of conteudo.cabecalho.slice(2)) fluxo.texto(`${linha}\n`);
  fluxo.texto(`${separador}\n`);

  if (conteudo.contingencia) {
    fluxo.cru(ESC, 0x45, 0x01);
    fluxo.texto('EMITIDA EM CONTINGÊNCIA\nPendente de autorização\n');
    fluxo.cru(ESC, 0x45, 0x00);
  }

  fluxo.cru(ESC, 0x61, 0x00); // ESC a 0 — alinhado à esquerda
  for (const item of conteudo.itens) {
    fluxo.cru(ESC, 0x45, 0x01);
    fluxo.texto(`${item.codigo} - ${item.descricao}\n`);
    fluxo.cru(ESC, 0x45, 0x00);
    fluxo.texto(`${item.detalhe}\n`);
  }
  fluxo.texto(`${separador}\n`);
  for (const linha of conteudo.totais) fluxo.texto(`${linha}\n`);
  fluxo.texto(`${separador}\n`);

  fluxo.cru(ESC, 0x61, 0x01);
  fluxo.texto(`${conteudo.consultaChave}\n`);
  fluxo.texto(`${mascaraChave(conteudo.chave)}\n`);

  // QR Code nativo: modelo 2, módulo 3, correção M ('1'), dados UTF-8.
  fluxo.qr(0x41, [0x32, 0x00]);
  fluxo.qr(0x43, [0x03]);
  fluxo.qr(0x45, [0x31]);
  const dadosQr = new TextEncoder().encode(conteudo.qrCode);
  fluxo.qr(0x50, [0x30, ...dadosQr]);
  fluxo.qr(0x51, [0x30]);

  for (const linha of conteudo.consumidor) fluxo.texto(`${linha}\n`);
  fluxo.cru(ESC, 0x61, 0x00);
  for (const linha of conteudo.identificacao) fluxo.texto(`${linha}\n`);
  if (opcoes.viaEstabelecimento) fluxo.texto('Via do Estabelecimento\n');
  if (conteudo.contingencia) {
    fluxo.cru(ESC, 0x61, 0x01);
    fluxo.cru(ESC, 0x45, 0x01);
    fluxo.texto('EMITIDA EM CONTINGÊNCIA\nPendente de autorização\n');
    fluxo.cru(ESC, 0x45, 0x00);
  }
  for (const linha of conteudo.mensagensFiscais) fluxo.texto(`${linha}\n`);
  if (conteudo.mensagemContribuinte) {
    fluxo.texto(`${separador}\n`);
    fluxo.texto(`${conteudo.mensagemContribuinte}\n`);
  }

  fluxo.cru(ESC, 0x64, opcoes.linhasApos ?? 3); // ESC d n — avança n linhas
  if (opcoes.cortar ?? true) fluxo.cru(GS, 0x56, 0x01); // GS V 1 — corte parcial
  return fluxo.resultado();
}
