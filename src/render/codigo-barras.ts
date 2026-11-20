/** Desenho vetorial de quadros e do Code 128C da chave de acesso. */
import { rgb, type PDFPage } from 'pdf-lib';
import { encodeCode128, ZONA_SILENCIO_CODE128 } from '../barcode/code128';
import { PT_POR_CM, type Caixa } from './layout';
import { caixaPdf } from './texto';

export interface EstiloQuadro {
  corBorda?: [number, number, number];
  espessura?: number;
  corPreenchimento?: [number, number, number];
}

export function desenharQuadro(
  pagina: PDFPage,
  caixa: Caixa,
  alturaPaginaPt: number,
  estilo: EstiloQuadro = {},
): void {
  const { x, y, largura, altura } = caixaPdf(caixa, alturaPaginaPt);
  const [r, g, b] = estilo.corBorda ?? [0, 0, 0];
  if (estilo.corPreenchimento) {
    const [pr, pg, pb] = estilo.corPreenchimento;
    pagina.drawRectangle({ x, y, width: largura, height: altura, color: rgb(pr, pg, pb) });
  }
  pagina.drawRectangle({
    x,
    y,
    width: largura,
    height: altura,
    borderColor: rgb(r, g, b),
    borderWidth: estilo.espessura ?? 0.6,
  });
}

export function desenharLinha(
  pagina: PDFPage,
  x1Cm: number,
  y1Cm: number,
  x2Cm: number,
  y2Cm: number,
  alturaPaginaPt: number,
  opcoes: { cor?: [number, number, number]; espessura?: number; tracejado?: boolean } = {},
): void {
  const [r, g, b] = opcoes.cor ?? [0, 0, 0];
  pagina.drawLine({
    start: { x: x1Cm * PT_POR_CM, y: alturaPaginaPt - y1Cm * PT_POR_CM },
    end: { x: x2Cm * PT_POR_CM, y: alturaPaginaPt - y2Cm * PT_POR_CM },
    thickness: opcoes.espessura ?? 0.5,
    color: rgb(r, g, b),
    dashArray: opcoes.tracejado ? [3, 2] : undefined,
  });
}

/**
 * Code 128C conforme MOC 7.0 Anexo II §2: Start C, dados, DV módulo 103 e
 * Stop, com zona de silêncio mínima de 10 módulos em cada lado, altura mínima
 * de barra de 0,8 cm e largura mínima de módulo de 0,02 cm (impressão laser).
 *
 * Fonte: tabela de larguras ISO/IEC 15417 Anexo A (já validada em
 * `src/barcode/code128.ts`) e o manual oficial:
 * https://www.confaz.fazenda.gov.br/legislacao/arquivo-manuais/moc7-anexo-ii-manual-especificacoes-tecnicas-danfe-codigo-barras.pdf
 */
export function desenharCode128(
  pagina: PDFPage,
  caixa: Caixa,
  alturaPaginaPt: number,
  dados: string,
): void {
  const simbolo = encodeCode128(dados);
  const modulosTotais = simbolo.larguraModulos + 2 * ZONA_SILENCIO_CODE128;
  // A moldura do quadro (0,6 pt) é desenhada sobre a borda da caixa. Sem
  // reservar esse espaço, a zona de silêncio efetiva cai para ~9,5 módulos e
  // leitores (ZXing) falham no recorte completo — ISO 15417 exige ≥ 10X.
  const espessuraBordaCm = 0.6 / PT_POR_CM;
  const reservaCm = espessuraBordaCm + 0.02;
  const larguraUtilCm = Math.max(0.1, caixa.largura - 2 * reservaCm);
  const moduloCm = Math.min(larguraUtilCm / modulosTotais, 0.06);
  const margemCm = (caixa.largura - modulosTotais * moduloCm) / 2;
  const alturaBarraCm = Math.min(caixa.altura - 0.06, 1.3);
  const topoCm = caixa.y + (caixa.altura - alturaBarraCm) / 2;

  let posicaoModulo = 0;
  simbolo.larguras.forEach((larguraModulos, indice) => {
    if (indice % 2 === 0) {
      // índice par = barra preta; ímpar = espaço branco.
      const xCm = caixa.x + margemCm + (ZONA_SILENCIO_CODE128 + posicaoModulo) * moduloCm;
      const larguraCm = larguraModulos * moduloCm;
      pagina.drawRectangle({
        x: xCm * PT_POR_CM,
        y: alturaPaginaPt - (topoCm + alturaBarraCm) * PT_POR_CM,
        width: larguraCm * PT_POR_CM,
        height: alturaBarraCm * PT_POR_CM,
        color: rgb(0, 0, 0),
      });
    }
    posicaoModulo += larguraModulos;
  });
}
