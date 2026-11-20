/**
 * Fonte vetorial embutida usada pelo renderizador de DANFE.
 *
 * A MOC 7.0 — Anexo II §3.7 exige Times New Roman ou Courier New e define
 * tamanhos mínimos em pontos. Para saída determinística em qualquer sistema
 * operacional (sem depender de fontes instaladas) embutimos "DANFE Sans",
 * uma versão subconjunto e renomeada de Liberation Sans 2.1.5, distribuída
 * sob a SIL Open Font License 1.1. Liberation Sans é metricamente compatível
 * com Arial, atendendo à exigência de fonte open e disponível em:
 *   https://github.com/liberationfonts/liberation-fonts/releases/tag/2.1.5
 * O subconjunto, o renome e a licença estão documentados em
 * `assets/fonts/README.md`; o texto integral da OFL está em
 * `assets/fonts/OFL.txt`. A renome é exigida pela cláusula 3.3 da OFL (o nome
 * "Liberation" é Reserved Font Name).
 */
import fontkit from '@pdf-lib/fontkit';
import type { PDFDocument, PDFFont } from 'pdf-lib';
import { FONTE_BOLD_BASE64, FONTE_REGULAR_BASE64 } from './font-data';

export interface FontesDanfe {
  regular: PDFFont;
  negrito: PDFFont;
}

function decodificaBase64(base64: string): Uint8Array {
  // `atob` existe no Node >= 16 e em todos os navegadores modernos.
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

/** Registra o fontkit e incorpora as duas fontes ao documento. */
export async function incorporaFontes(documento: PDFDocument): Promise<FontesDanfe> {
  documento.registerFontkit(fontkit);
  const [regular, negrito] = await Promise.all([
    documento.embedFont(decodificaBase64(FONTE_REGULAR_BASE64), { subset: true }),
    documento.embedFont(decodificaBase64(FONTE_BOLD_BASE64), { subset: true }),
  ]);
  return { regular, negrito };
}
