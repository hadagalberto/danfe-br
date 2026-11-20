/**
 * Rasterização de PDF para testes visuais.
 *
 * usamos `pdfjs-dist` (legacy build, compatível com Node) e `@napi-rs/canvas`,
 * uma implementação de canvas com binários pré-compilados para Windows,
 * Linux e macOS — sem exigir Cairo, fontconfig ou compilação nativa. Por isso
 * a suíte roda de forma idêntica na CI ubuntu/windows/macos.
 */
import { createCanvas, DOMMatrix, ImageData, Path2D, type Canvas } from '@napi-rs/canvas';
import {
  getDocument,
  type PDFDocumentProxy,
  type PDFPageProxy,
} from 'pdfjs-dist/legacy/build/pdf.mjs';

// O pdf.js espera estas globals do DOM; o @napi-rs/canvas as fornece.
const globalAny = globalThis as unknown as Record<string, unknown>;
if (globalAny['DOMMatrix'] === undefined) globalAny['DOMMatrix'] = DOMMatrix;
if (globalAny['ImageData'] === undefined) globalAny['ImageData'] = ImageData;
if (globalAny['Path2D'] === undefined) globalAny['Path2D'] = Path2D;

interface CanvasAndContext {
  canvas: Canvas;
  context: ReturnType<Canvas['getContext']>;
}

/** Fábrica de canvas do pdf.js baseada em @napi-rs/canvas. */
export class NapiCanvasFactory {
  create(width: number, height: number): CanvasAndContext {
    const canvas = createCanvas(Math.max(1, Math.ceil(width)), Math.max(1, Math.ceil(height)));
    return { canvas, context: canvas.getContext('2d') };
  }

  reset(canvasAndContext: CanvasAndContext, width: number, height: number): void {
    canvasAndContext.canvas.width = Math.max(1, Math.ceil(width));
    canvasAndContext.canvas.height = Math.max(1, Math.ceil(height));
  }

  destroy(canvasAndContext: CanvasAndContext): void {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
  }
}

export interface PaginaRasterizada {
  largura: number;
  altura: number;
  pixels: Uint8ClampedArray;
  pagina: PDFPageProxy;
}

export interface TextoExtraido {
  str: string;
  /** Origem do texto em pontos, no sistema de coordenadas PDF (base inferior). */
  x: number;
  y: number;
  altura: number;
}

export async function abrePdf(pdf: Uint8Array): Promise<PDFDocumentProxy> {
  const tarefa = getDocument({
    data: new Uint8Array(pdf),
    useSystemFonts: false,
    isEvalSupported: false,
    CanvasFactory: NapiCanvasFactory,
  });
  return tarefa.promise;
}

/** Rasteriza todas as páginas com `escala` pixels por ponto PDF. */
export async function rasteriza(pdf: Uint8Array, escala = 1.5): Promise<PaginaRasterizada[]> {
  const documento = await abrePdf(pdf);
  const resultado: PaginaRasterizada[] = [];
  for (let numero = 1; numero <= documento.numPages; numero++) {
    const pagina = await documento.getPage(numero);
    const viewport = pagina.getViewport({ scale: escala });
    const canvas = createCanvas(
      Math.max(1, Math.ceil(viewport.width)),
      Math.max(1, Math.ceil(viewport.height)),
    );
    const contexto = canvas.getContext('2d');
    await pagina.render({ canvasContext: contexto as never, viewport }).promise;
    const imagem = contexto.getImageData(0, 0, canvas.width, canvas.height);
    resultado.push({
      largura: canvas.width,
      altura: canvas.height,
      pixels: imagem.data,
      pagina,
    });
  }
  return resultado;
}

/** Extrai os trechos de texto de uma página já carregada. */
export async function extraiTexto(pagina: PDFPageProxy): Promise<TextoExtraido[]> {
  const conteudo = await pagina.getTextContent();
  const itens: TextoExtraido[] = [];
  for (const item of conteudo.items) {
    if (!('str' in item) || item.str.length === 0) continue;
    const t = item.transform;
    itens.push({
      str: item.str,
      x: t[4],
      y: t[5],
      altura: Math.hypot(t[2], t[3]) || Math.hypot(t[0], t[1]),
    });
  }
  return itens;
}

/**
 * Extrai o texto completo (sem posição) — usado nos testes de marca d'água
 * e de presença de campos.
 */
export async function textoSimples(pdf: Uint8Array): Promise<string[]> {
  const documento = await abrePdf(pdf);
  const paginas: string[] = [];
  for (let numero = 1; numero <= documento.numPages; numero++) {
    const pagina = await documento.getPage(numero);
    paginas.push((await extraiTexto(pagina)).map((item) => item.str).join(''));
  }
  return paginas;
}
