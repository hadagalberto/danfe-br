/** Utilitários de medida, quebra e desenho de texto sobre o PDF. */
import { rgb, type PDFFont, type PDFPage, type Rotation } from 'pdf-lib';
import { PT_POR_CM, type Caixa } from './layout';

/** Proporção usada para converter o tamanho nominal em altura de ascendente. */
const ASCENTE = 0.85;

export type Alinhamento = 'esquerda' | 'centro' | 'direita';

export interface OpcoesTexto {
  fonte: PDFFont;
  tamanho: number;
  alinhamento?: Alinhamento;
  cor?: [number, number, number];
  opacidade?: number;
  /** Multiplicador da altura de linha (padrão 1,15). */
  entreLinhas?: number;
  centralizarVertical?: boolean;
  margemCm?: number;
  maxLinhas?: number;
  rotate?: Rotation;
}

/** Remove caracteres de controle e substitui glifos fora do subconjunto da fonte. */
export function sanitizarTexto(texto: string): string {
  let resultado = '';
  for (const caractere of texto.replace(/\r\n?/g, '\n')) {
    const codigo = caractere.codePointAt(0) ?? 63;
    if (caractere === '\n' || codigo === 9) {
      resultado += caractere;
    } else if (
      (codigo >= 0x20 && codigo <= 0x24f) ||
      (codigo >= 0x2000 && codigo <= 0x206f) ||
      codigo === 0x20ac ||
      codigo === 0x2122
    ) {
      resultado += caractere;
    } else {
      resultado += '?';
    }
  }
  return resultado;
}

export function larguraTexto(texto: string, fonte: PDFFont, tamanho: number): number {
  return fonte.widthOfTextAtSize(sanitizarTexto(texto), tamanho);
}

/**
 * Quebra o texto em linhas que caibam em `larguraMaxPt`.
 * Palavras maiores que a linha são cortadas; se o número de linhas exceder
 * `maxLinhas`, as excedentes são fundidas na última linha com reticências.
 */
export function quebrarLinhas(
  texto: string,
  fonte: PDFFont,
  tamanho: number,
  larguraMaxPt: number,
  maxLinhas = Number.POSITIVE_INFINITY,
): string[] {
  const linhas: string[] = [];
  for (const paragrafo of sanitizarTexto(texto).split('\n')) {
    const palavras = paragrafo
      .trim()
      .split(/\s+/)
      .filter((p) => p.length > 0);
    if (palavras.length === 0) {
      linhas.push('');
      continue;
    }
    let linha = '';
    for (const palavra of palavras) {
      const candidata = linha.length === 0 ? palavra : `${linha} ${palavra}`;
      if (larguraTexto(candidata, fonte, tamanho) <= larguraMaxPt) {
        linha = candidata;
        continue;
      }
      if (linha.length > 0) {
        linhas.push(linha);
        linha = '';
      }
      // Palavra individual maior que a coluna: corta por caracteres.
      let parte = '';
      for (const caractere of palavra) {
        if (larguraTexto(parte + caractere, fonte, tamanho) > larguraMaxPt && parte.length > 0) {
          linhas.push(parte);
          parte = '';
        }
        parte += caractere;
      }
      linha = parte;
    }
    if (linha.length > 0) linhas.push(linha);
  }

  if (linhas.length <= maxLinhas) return linhas;
  const mantidas = linhas.slice(0, Math.max(1, maxLinhas));
  let ultima = mantidas[mantidas.length - 1] ?? '';
  for (const extra of linhas.slice(mantidas.length)) {
    ultima = truncaComReticencias(`${ultima} ${extra}`.trim(), fonte, tamanho, larguraMaxPt);
  }
  mantidas[mantidas.length - 1] = ultima;
  return mantidas;
}

/** Trunca `texto` com "…" até caber em `larguraMaxPt`. */
export function truncaComReticencias(
  texto: string,
  fonte: PDFFont,
  tamanho: number,
  larguraMaxPt: number,
): string {
  if (larguraTexto(texto, fonte, tamanho) <= larguraMaxPt) return texto;
  let candidato = texto;
  while (candidato.length > 1 && larguraTexto(`${candidato}…`, fonte, tamanho) > larguraMaxPt) {
    candidato = candidato.slice(0, -1);
  }
  return `${candidato.trimEnd()}…`;
}

/**
 * Desenha texto dentro de uma caixa (coordenadas MOC: origem no topo à esquerda).
 * O textos são alinhados e centrados verticalmente conforme as opções.
 */
export function desenharTexto(
  pagina: PDFPage,
  caixa: Caixa,
  texto: string,
  alturaPaginaPt: number,
  opcoes: OpcoesTexto,
): string[] {
  const margemPt = (opcoes.margemCm ?? 0.05) * PT_POR_CM;
  const larguraUtilPt = Math.max(1, caixa.largura * PT_POR_CM - 2 * margemPt);
  const alturaLinhaPt = opcoes.tamanho * (opcoes.entreLinhas ?? 1.15);
  const alturaMaxLinhas = Math.max(
    1,
    Math.floor((caixa.altura * PT_POR_CM - 2 * margemPt) / alturaLinhaPt),
  );
  const limite = opcoes.maxLinhas ?? alturaMaxLinhas;
  const linhas = quebrarLinhas(texto, opcoes.fonte, opcoes.tamanho, larguraUtilPt, limite);
  const blocoPt = linhas.length * alturaLinhaPt;
  const folgaVerticalPt = Math.max(0, caixa.altura * PT_POR_CM - blocoPt - 2 * margemPt);
  const deslocamentoTopoPt = opcoes.centralizarVertical ? folgaVerticalPt / 2 : 0;
  const topoPt = caixa.y * PT_POR_CM + margemPt + deslocamentoTopoPt;
  const [r, g, b] = opcoes.cor ?? [0, 0, 0];

  linhas.forEach((linha, indice) => {
    const largura = larguraTexto(linha, opcoes.fonte, opcoes.tamanho);
    let x = caixa.x * PT_POR_CM + margemPt;
    if (opcoes.alinhamento === 'centro') {
      x = (caixa.x + caixa.largura / 2) * PT_POR_CM - largura / 2;
    } else if (opcoes.alinhamento === 'direita') {
      x = (caixa.x + caixa.largura) * PT_POR_CM - margemPt - largura;
    }
    const y = alturaPaginaPt - topoPt - opcoes.tamanho * ASCENTE - indice * alturaLinhaPt;
    pagina.drawText(linha, {
      x,
      y,
      size: opcoes.tamanho,
      font: opcoes.fonte,
      color: rgb(r, g, b),
      opacity: opcoes.opacidade,
      rotate: opcoes.rotate,
    });
  });
  return linhas;
}

/** Desenha um campo com rótulo (caixa alta, 6 pt) e valor (10 pt), MOC §3.7.3/§3.7.9. */
export function desenharCampo(
  pagina: PDFPage,
  caixa: Caixa,
  rotulo: string,
  valor: string,
  alturaPaginaPt: number,
  fontes: { regular: PDFFont; negrito: PDFFont },
  opcoes: { tamanhoValor?: number; valorNegrito?: boolean; alinhamento?: Alinhamento } = {},
): void {
  const tamanhoValor = opcoes.tamanhoValor ?? 10;
  const alturaRotuloCm = 0.32;
  desenharTexto(
    pagina,
    { x: caixa.x, y: caixa.y, largura: caixa.largura, altura: alturaRotuloCm },
    rotulo.toUpperCase(),
    alturaPaginaPt,
    { fonte: fontes.negrito, tamanho: 6, margemCm: 0.04 },
  );
  desenharTexto(
    pagina,
    {
      x: caixa.x,
      y: caixa.y + alturaRotuloCm,
      largura: caixa.largura,
      altura: caixa.altura - alturaRotuloCm,
    },
    valor,
    alturaPaginaPt,
    {
      fonte: opcoes.valorNegrito ? fontes.negrito : fontes.regular,
      tamanho: tamanhoValor,
      alinhamento: opcoes.alinhamento ?? 'esquerda',
      centralizarVertical: true,
      margemCm: 0.04,
      maxLinhas: 1,
    },
  );
}

/** Converte uma caixa CDP em caixa PDF (origem inferior-esquerda, em pontos). */
export function caixaPdf(
  caixa: Caixa,
  alturaPaginaPt: number,
): {
  x: number;
  y: number;
  largura: number;
  altura: number;
} {
  return {
    x: caixa.x * PT_POR_CM,
    y: alturaPaginaPt - (caixa.y + caixa.altura) * PT_POR_CM,
    largura: caixa.largura * PT_POR_CM,
    altura: caixa.altura * PT_POR_CM,
  };
}
