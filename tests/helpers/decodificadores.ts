/**
 * Helpers de teste: rasterizacao dos simbolos gerados em memoria e decoding
 * com bibliotecas **independentes** (declaradas apenas como devDependencies):
 *
 * - `@zxing/library` (Apache-2.0) decodifica o Code 128;
 * - `jsQR` (Apache-2.0) decodifica o QR Code.
 *
 * Nenhum decoder e usado em `src/` — a producao permanece puro TS.
 */
import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from '@zxing/library';
import jsQR from 'jsqr';
import {
  encodeCode128,
  ZONA_SILENCIO_CODE128,
  type CodigoBarrasCode128,
} from '../../src/barcode/code128';
import type { QrCodeSimbolo } from '../../src/qrcode/qrcode';

export interface Imagem {
  dados: Uint8ClampedArray;
  largura: number;
  altura: number;
}

/** Rasteriza um Code 128 em escala de cinza (1 byte por pixel) para o ZXing. */
export function rasterizaCode128(codigo: CodigoBarrasCode128, escala = 4, altura = 80): Imagem {
  const modulos = ZONA_SILENCIO_CODE128 + codigo.larguraModulos + ZONA_SILENCIO_CODE128;
  const largura = modulos * escala;
  const dados = new Uint8ClampedArray(largura * altura).fill(255);
  let modulo = ZONA_SILENCIO_CODE128;
  for (let i = 0; i < codigo.larguras.length; i++) {
    const larguraModulo = codigo.larguras[i]!;
    if (i % 2 === 0) {
      // barra (preta): idx par; espaco (branco): idx impar
      for (let x = modulo * escala; x < (modulo + larguraModulo) * escala; x++) {
        for (let y = 0; y < altura; y++) dados[y * largura + x] = 0;
      }
    }
    modulo += larguraModulo;
  }
  return { dados, largura, altura };
}

/** Codifica e rasteriza texto em Code 128 para decodificacao independente. */
export function imagemCode128(texto: string): Imagem {
  return rasterizaCode128(encodeCode128(texto));
}

/** Decodifica a imagem com o ZXing; lanca se nao encontrar um Code 128. */
export function decodificaCode128(imagem: Imagem): string {
  const fonte = new RGBLuminanceSource(imagem.dados, imagem.largura, imagem.altura);
  const bitmap = new BinaryBitmap(new HybridBinarizer(fonte));
  const leitor = new MultiFormatReader();
  const dicas = new Map<DecodeHintType, unknown>();
  dicas.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128]);
  dicas.set(DecodeHintType.TRY_HARDER, true);
  return leitor.decode(bitmap, dicas).getText();
}

/** Rasteriza um QR Code em RGBA com zona de silencio para o jsQR. */
export function rasterizaQr(simbolo: QrCodeSimbolo, escala = 4, zonaSilencio = 4): Imagem {
  const n = simbolo.tamanho;
  const lado = (n + 2 * zonaSilencio) * escala;
  const dados = new Uint8ClampedArray(lado * lado * 4);
  for (let i = 0; i < dados.length; i += 4) {
    dados[i] = 255;
    dados[i + 1] = 255;
    dados[i + 2] = 255;
    dados[i + 3] = 255;
  }
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!simbolo.escuro(x, y)) continue;
      for (let py = (y + zonaSilencio) * escala; py < (y + zonaSilencio + 1) * escala; py++) {
        for (let px = (x + zonaSilencio) * escala; px < (x + zonaSilencio + 1) * escala; px++) {
          const deslocamento = (py * lado + px) * 4;
          dados[deslocamento] = 0;
          dados[deslocamento + 1] = 0;
          dados[deslocamento + 2] = 0;
          dados[deslocamento + 3] = 255;
        }
      }
    }
  }
  return { dados, largura: lado, altura: lado };
}

/** Decodifica a imagem com o jsQR; lanca se nao encontrar um QR Code. */
export function decodificaQr(imagem: Imagem): string {
  const resultado = jsQR(imagem.dados, imagem.largura, imagem.altura, {
    inversionAttempts: 'dontInvert',
  });
  if (!resultado) throw new Error('jsQR nao conseguiu decodificar o simbolo.');
  return resultado.data;
}

/** Decodifica e devolve os bytes brutos do segmento (jsQR `binaryData`). */
export function decodificaQrBytes(imagem: Imagem): number[] {
  const resultado = jsQR(imagem.dados, imagem.largura, imagem.altura, {
    inversionAttempts: 'dontInvert',
  });
  if (!resultado) throw new Error('jsQR nao conseguiu decodificar o simbolo.');
  return resultado.binaryData;
}

/** PRNG determinístico (mulberry32) — random reproducível sem depender de Math.random. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
