/**
 * Codificador Code 128 (ISO/IEC 15417:2007) — implementação própria, sem
 * dependências. Alimenta o DANFE (código de barras da chave de acesso, MOC
 * 7.0 — Anexo II, item 6.4: "o código de barras ... será impresso em CODE
 * 128C") e o DANFE NFC-e.
 *
 * Estratégia de conjuntos — "Code C com fallback em Code B", conforme a
 * tabela de compressão da GS1 General Specifications (seção 5.4.7.7,
 * "Use of Start, Code Set, and Shift symbols to Minimize Symbol Length"):
 *
 * | posição dos dígitos         | dígitos consecutivos para valer C |
 * | --------------------------- | ---------------------------------- |
 * | início do dado              | ≥ 4 (ou a string inteira com 2)    |
 * | fim do dado                 | ≥ 4                                |
 * | meio (cercado por não dígitos) | ≥ 6                             |
 * | string inteira              | 2 ou ≥ 4 (não 3)                   |
 *
 * Sequências ímpares: o dígito excedente fica no Code B na *borda inicial*
 * do trecho ("delayed switch", mesma referência GS1), mantendo o Code C
 * apenas com pares completos. O conjunto A (caracteres de controle 0–31)
 * não é necessário para os códigos de barras fiscais e não é suportado —
 * entrada fora de ASCII 32–126 é rejeitada com `RangeError`.
 *
 * Fonte das larguras (valores 0–106, 6 larguras barra/espaço por símbolo,
 * mais o padrão de parada de 13 módulos) e da soma de verificação
 * (módulo 103, start pesando 1): ISO/IEC 15417:2007 Annex A/B — tabela
 * conferida com a referência pública em
 * https://en.wikipedia.org/wiki/Code_128 (espelho do Anexo A do padrão),
 * consultada em 20/11/2026.
 */

/** Zona de silêncio mínima, em módulos (ISO/IEC 15417: 10X à esquerda e à direita). */
export const ZONA_SILENCIO_CODE128 = 10;

/** Start Code B (ASCII 32–126). */
const VALOR_START_B = 104;
/** Start Code C (pares de dígitos). */
const VALOR_START_C = 105;
/** Valor do símbolo de parada (13 módulos: 2331112). */
const VALOR_STOP = 106;
/** Símbolo "Code C" dentro dos conjuntos A/B. */
const VALOR_CODE_C = 99;
/** Símbolo "Code B" dentro do conjunto C. */
const VALOR_CODE_B_EM_C = 100;

/**
 * Larguras barra/espaço por valor (0–106): seis algarismos por símbolo
 * (barra, espaço, barra, espaço, barra, espaço), cada largura 1–4 módulos,
 * sempre somando 11 módulos. O valor 106 (parada) soma 13 módulos
 * (2331112 — inclui a barra final de 2 módulos).
 */
const LARGURAS: readonly string[] = [
  '212222', // 0
  '222122', // 1
  '222221', // 2
  '121223', // 3
  '121322', // 4
  '131222', // 5
  '122213', // 6
  '122312', // 7
  '132212', // 8
  '221213', // 9
  '221312', // 10
  '231212', // 11
  '112232', // 12
  '122132', // 13
  '122231', // 14
  '113222', // 15
  '123122', // 16
  '123221', // 17
  '223211', // 18
  '221132', // 19
  '221231', // 20
  '213212', // 21
  '223112', // 22
  '312131', // 23
  '311222', // 24
  '321122', // 25
  '321221', // 26
  '312212', // 27
  '322112', // 28
  '322211', // 29
  '212123', // 30
  '212321', // 31
  '232121', // 32
  '111323', // 33
  '131123', // 34
  '131321', // 35
  '112313', // 36
  '132113', // 37
  '132311', // 38
  '211313', // 39
  '231113', // 40
  '231311', // 41
  '112133', // 42
  '112331', // 43
  '132131', // 44
  '113123', // 45
  '113321', // 46
  '133121', // 47
  '313121', // 48
  '211331', // 49
  '231131', // 50
  '213113', // 51
  '213311', // 52
  '213131', // 53
  '311123', // 54
  '311321', // 55
  '331121', // 56
  '312113', // 57
  '312311', // 58
  '332111', // 59
  '314111', // 60
  '221411', // 61
  '431111', // 62
  '111224', // 63
  '111422', // 64
  '121124', // 65
  '121421', // 66
  '141122', // 67
  '141221', // 68
  '112214', // 69
  '112412', // 70
  '122114', // 71
  '122411', // 72
  '142112', // 73
  '142211', // 74
  '241211', // 75
  '221114', // 76
  '413111', // 77
  '241112', // 78
  '134111', // 79
  '111242', // 80
  '121142', // 81
  '121241', // 82
  '114212', // 83
  '124112', // 84
  '124211', // 85
  '411212', // 86
  '421112', // 87
  '421211', // 88
  '212141', // 89
  '214121', // 90
  '412121', // 91
  '111143', // 92
  '111341', // 93
  '131141', // 94
  '114113', // 95
  '114311', // 96
  '411113', // 97
  '411311', // 98
  '113141', // 99
  '114131', // 100
  '311141', // 101
  '411131', // 102
  '211412', // 103 — start A (não usado; documentado)
  '211214', // 104 — start B
  '211232', // 105 — start C
  '2331112', // 106 — parada (13 módulos)
];

/** Símbolo Code 128 pronto para rasterização. */
export interface CodigoBarrasCode128 {
  /**
   * Valores dos símbolos na ordem: start, dados (incluindo símbolos de
   * troca de conjunto), dígito verificador e parada (106).
   */
  valores: number[];
  /**
   * Larguras alternadas em módulos — barra, espaço, barra, ... — do primeiro
   * símbolo (start) até a parada. `larguras.length` é sempre par.
   */
  larguras: number[];
  /** Largura total em módulos, **sem** as zonas de silêncio. */
  larguraModulos: number;
  /** Texto codificado (referência). */
  texto: string;
  /** Conjunto inicial escolhido (`'B'` ou `'C'`). */
  conjuntoInicial: 'B' | 'C';
}

/**
 * Codifica `texto` em Code 128 com Code C para trechos de dígitos e Code B
 * para o restante (conjunto A não suportado — ver cabeçalho do módulo).
 *
 * @throws {RangeError} texto vazio ou com caracteres fora de ASCII 32–126.
 */
export function encodeCode128(texto: string): CodigoBarrasCode128 {
  if (texto.length === 0) {
    throw new RangeError('Code 128: texto vazio não é codificável.');
  }
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i);
    if (c < 32 || c > 126) {
      throw new RangeError(
        `Code 128: caractere ${JSON.stringify(texto[i])} (posição ${i}) ` +
          'fora do intervalo ASCII 32–126 — conjunto A (controles) e ' +
          'Latin-1 via FNC4 não são suportados.',
      );
    }
  }

  const valores: number[] = [];
  const segmentos = segmenta(texto);
  const conjuntoInicial = segmentos[0]!.conjunto;
  valores.push(conjuntoInicial === 'C' ? VALOR_START_C : VALOR_START_B);

  let conjunto = conjuntoInicial;
  for (const seg of segmentos) {
    if (seg.conjunto !== conjunto) {
      // Troca de conjunto: do B para C usa o valor 99; do C para B, o 100.
      valores.push(seg.conjunto === 'C' ? VALOR_CODE_C : VALOR_CODE_B_EM_C);
      conjunto = seg.conjunto;
    }
    if (seg.conjunto === 'C') {
      for (let i = 0; i < seg.texto.length; i += 2) {
        valores.push(Number(seg.texto.slice(i, i + 2)));
      }
    } else {
      for (const ch of seg.texto) valores.push(ch.charCodeAt(0) - 32);
    }
  }

  // DV módulo 103: o start pesa 1; o k-ésimo símbolo de dados pesa k
  // (start e primeiro símbolo ocupam a posição 1 — ISO/IEC 15417 B.1).
  let soma = valores[0]!;
  for (let k = 1; k < valores.length; k++) soma += valores[k]! * k;
  valores.push(soma % 103);
  valores.push(VALOR_STOP);

  const larguras: number[] = [];
  let larguraModulos = 0;
  for (const v of valores) {
    for (const d of LARGURAS[v]!) {
      const n = d.charCodeAt(0) - 48;
      larguras.push(n);
      larguraModulos += n;
    }
  }

  return { valores, larguras, larguraModulos, texto, conjuntoInicial };
}

/** Trecho contíguo codificado em um único conjunto. */
interface Segmento {
  conjunto: 'B' | 'C';
  texto: string;
}

/**
 * Divide o texto em segmentos B/C pela tabela de compressão GS1. Sequências
 * ímpares qualificadas deixam o dígito excedente no Code B, na borda
 * inicial do trecho ("delayed switch").
 */
function segmenta(texto: string): Segmento[] {
  const segmentos: Segmento[] = [];
  let i = 0;
  while (i < texto.length) {
    if (!eDigito(texto.charCodeAt(i))) {
      const j = fimNaoDigitos(texto, i);
      segmentos.push({ conjunto: 'B', texto: texto.slice(i, j) });
      i = j;
      continue;
    }
    const j = fimDigitos(texto, i);
    const noInicio = i === 0;
    const noFim = j === texto.length;
    const comprimento = j - i;
    const qualifica = noFim
      ? noInicio
        ? comprimento === 2 || comprimento >= 4 // string inteira: 2 ou 4+ (não 3)
        : comprimento >= 4 // fim do dado: 4+
      : noInicio
        ? comprimento >= 4 // início do dado: 4+
        : comprimento >= 6; // meio: 6+

    if (qualifica && comprimento % 2 === 1) {
      // Trecho ímpar: primeiro dígito permanece em B, o resto (par) vai em C.
      if (i < j - 1) segmentos.push({ conjunto: 'B', texto: texto.slice(i, i + 1) });
      segmentos.push({ conjunto: 'C', texto: texto.slice(i + 1, j) });
    } else if (qualifica) {
      segmentos.push({ conjunto: 'C', texto: texto.slice(i, j) });
    } else if (qualifica) {
      segmentos.push({ conjunto: 'C', texto: texto.slice(i, j) });
    } else {
      // Trecho curto demais para valer a troca: dígitos seguem em Code B.
      segmentos.push({ conjunto: 'B', texto: texto.slice(i, j) });
    }
    i = j;
  }
  return segmentos;
}

/** Posição após o trecho de não dígitos iniciado em `i`. */
function fimNaoDigitos(texto: string, i: number): number {
  let j = i;
  while (j < texto.length && !eDigito(texto.charCodeAt(j))) j++;
  return j;
}

/** Posição após o trecho de dígitos iniciado em `i`. */
function fimDigitos(texto: string, i: number): number {
  let j = i;
  while (j < texto.length && eDigito(texto.charCodeAt(j))) j++;
  return j;
}

function eDigito(c: number): boolean {
  return c >= 48 && c <= 57;
}
