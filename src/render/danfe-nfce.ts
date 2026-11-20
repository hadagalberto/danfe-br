/**
 * Renderizador do DANFE NFC-e (papel térmico 80 mm / 58 mm) com pdf-lib.
 *
 * FONTE OFICIAL — "Manual de Padrões Técnicos do DANFE-NFC-e e QR Code",
 * versão 5.1 (01/12/2019), seções 3.1.1–3.1.9, 3.3 (margens mínimas de
 * 2 mm), 3.4 e 4.5 (QR Code com nível de correção M e codificação UTF-8), e
 * "Manual de Especificações Técnicas do DANFE NFC-e e QR Code", versão 5.0,
 * com o mesmo leiaute. Portal oficial SVRS:
 *   https://dfe-portal.svrs.rs.gov.br/Nfce/Documentos
 * URLs de download citadas em `src/render/nfce-conteudo.ts`.
 * O QR Code é gerado a partir da tag `qrCode` do XML (§3.1.5/§4.2), nunca
 * recalculado, e a chave aparece em 11 blocos de 4 dígitos (§3.1.4).
 */
import { PDFDocument, rgb, type PDFPage } from 'pdf-lib';
import type { NFe, NFeProc } from '../model/nfe';
import { encodeQrCode, type QrCodeSimbolo } from '../qrcode/qrcode';
import { PT_POR_CM } from './layout';
import { desenharLinha } from './codigo-barras';
import { incorporaFontes, type FontesDanfe } from './font';
import { mascaraChave } from './formatacao';
import { conteudoNfce } from './nfce-conteudo';
import { desenharTexto, quebrarLinhas } from './texto';

/** Opções de impressão do DANFE NFC-e. */
export interface OpcoesRenderDanfeNfce {
  /** Largura do papel em milímetros: 80 (padrão) ou 58. */
  larguraMm?: 80 | 58;
  /** Imprime a divisão II (detalhamento dos itens). Padrão: true. */
  detalharItens?: boolean;
  /** Identifica a 2ª via como "Via do Estabelecimento" (§3.1.8). */
  viaEstabelecimento?: boolean;
}

interface Bloco {
  alturaCm: number;
  desenhar(pagina: PDFPage, yCm: number): void;
}

interface Medidas {
  larguraCm: number;
  margemCm: number;
  conteudoCm: number;
  alturaPaginaPt: number;
}

/** 2 mm de margem lateral em cada lado, conforme §3.3. */
const MARGEM_CM = 0.2;
const TAMANHO_CORPO = 8;
const TAMANHO_TITULO = 9;
const ENTRELINHAS = 1.15;
const MARGEM_VERTICAL_CM = 0.3;

function alturaLinhaCm(tamanho: number): number {
  return (tamanho * ENTRELINHAS) / PT_POR_CM;
}

function textoBloco(
  texto: string,
  fontes: FontesDanfe,
  medidas: Medidas,
  opcoes: {
    tamanho?: number;
    negrito?: boolean;
    centralizar?: boolean;
    separadorApos?: number;
  } = {},
): Bloco {
  const tamanho = opcoes.tamanho ?? TAMANHO_CORPO;
  const fonte = opcoes.negrito ? fontes.negrito : fontes.regular;
  const linhas = quebrarLinhas(texto, fonte, tamanho, medidas.conteudoCm * PT_POR_CM - 0.04);
  const separador = opcoes.separadorApos ?? 0;
  const alturaTexto = linhas.length * alturaLinhaCm(tamanho);
  return {
    alturaCm: alturaTexto + separador,
    desenhar(pagina, yCm) {
      desenharTexto(
        pagina,
        { x: medidas.margemCm, y: yCm, largura: medidas.conteudoCm, altura: alturaTexto },
        linhas.join('\n'),
        medidas.alturaPaginaPt,
        {
          fonte,
          tamanho,
          alinhamento: opcoes.centralizar ? 'centro' : 'esquerda',
          entreLinhas: ENTRELINHAS,
          maxLinhas: linhas.length,
          margemCm: 0,
        },
      );
      if (separador > 0) {
        const yLinha = yCm + alturaTexto + separador / 2;
        desenharLinha(
          pagina,
          medidas.margemCm,
          yLinha,
          medidas.margemCm + medidas.conteudoCm,
          yLinha,
          medidas.alturaPaginaPt,
          { tracejado: true, espessura: 0.3, cor: [0.45, 0.45, 0.45] },
        );
      }
    },
  };
}

/** QR Code de 25 × 25 mm (22 mm de conteúdo + 3 mm de margem segura, §3.4). */
function qrBloco(simbolo: QrCodeSimbolo, medidas: Medidas): Bloco {
  const totalCm = 2.8;
  const conteudoCm = 2.2;
  const zonaCm = 0.3;
  const separador = 0.14;
  return {
    alturaCm: totalCm + separador,
    desenhar(pagina, yCm) {
      const xCm = (medidas.larguraCm - totalCm) / 2;
      const yTopCm = yCm + separador / 2;
      pagina.drawRectangle({
        x: xCm * PT_POR_CM,
        y: medidas.alturaPaginaPt - (yTopCm + totalCm) * PT_POR_CM,
        width: totalCm * PT_POR_CM,
        height: totalCm * PT_POR_CM,
        color: rgb(1, 1, 1),
      });
      const moduloCm = conteudoCm / simbolo.tamanho;
      const ponto = moduloCm * PT_POR_CM;
      for (let y = 0; y < simbolo.tamanho; y++) {
        let x = 0;
        while (x < simbolo.tamanho) {
          if (!simbolo.escuro(x, y)) {
            x++;
            continue;
          }
          let fim = x;
          while (fim < simbolo.tamanho && simbolo.escuro(fim, y)) fim++;
          pagina.drawRectangle({
            x: (xCm + zonaCm + x * moduloCm) * PT_POR_CM,
            y: medidas.alturaPaginaPt - (yTopCm + zonaCm + (y + 1) * moduloCm) * PT_POR_CM,
            width: (fim - x) * ponto,
            height: ponto,
            color: rgb(0, 0, 0),
          });
          x = fim;
        }
      }
    },
  };
}

/**
 * Gera o DANFE NFC-e como PDF de largura fixa (80/58 mm) e altura variável.
 *
 * @throws {Error} modelo diferente de 65, sem `qrCode`, ou largura inválida.
 */
export async function renderDanfeNfce(
  documento: NFeProc | NFe,
  opcoes: OpcoesRenderDanfeNfce = {},
): Promise<Uint8Array> {
  const larguraMm = opcoes.larguraMm ?? 80;
  if (larguraMm !== 80 && larguraMm !== 58) {
    throw new Error(`Largura de papel inválida: ${String(larguraMm)} mm (use 80 ou 58).`);
  }
  const conteudo = conteudoNfce(documento, opcoes.detalharItens ?? true);
  const pdf = await PDFDocument.create();
  pdf.setTitle(`DANFE NFC-e ${conteudo.chave}`);
  pdf.setSubject('Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica');
  const fontes = await incorporaFontes(pdf);
  const medidas: Medidas = {
    larguraCm: larguraMm / 10,
    margemCm: MARGEM_CM,
    conteudoCm: larguraMm / 10 - 2 * MARGEM_CM,
    alturaPaginaPt: 0,
  };
  const bloco = (texto: string, opcoesTexto?: Parameters<typeof textoBloco>[3]) =>
    textoBloco(texto, fontes, medidas, opcoesTexto);
  const separador = () => bloco('', { separadorApos: 0.14, tamanho: 1 });

  const blocos: Bloco[] = [];
  // Divisão I — cabeçalho do emitente.
  blocos.push(bloco(conteudo.cabecalho[0] ?? '', { negrito: true, centralizar: true }));
  blocos.push(
    bloco(conteudo.cabecalho[1] ?? '', {
      negrito: true,
      tamanho: TAMANHO_TITULO,
      centralizar: true,
    }),
  );
  for (const linha of conteudo.cabecalho.slice(2)) {
    blocos.push(bloco(linha, { centralizar: true }));
  }
  blocos.push(separador());

  // Contingência: texto em destaque abaixo do cabeçalho (§3.1.8).
  if (conteudo.contingencia) {
    blocos.push(
      bloco('EMITIDA EM CONTINGÊNCIA\nPendente de autorização', {
        negrito: true,
        centralizar: true,
        separadorApos: 0.14,
      }),
    );
  }

  // Divisão II — detalhamento de produtos/serviços (§3.1.2).
  for (const item of conteudo.itens) {
    blocos.push(bloco(`${item.codigo} - ${item.descricao}`, { negrito: true }));
    blocos.push(bloco(item.detalhe, { separadorApos: 0.1 }));
  }

  // Divisão III — totais e pagamento (§3.1.3).
  for (const linha of conteudo.totais) {
    blocos.push(bloco(linha, { separadorApos: linha === conteudo.totais.at(-1) ? 0.14 : 0 }));
  }

  // Divisão IV — consulta pela chave de acesso em 11 blocos de 4 (§3.1.4).
  blocos.push(bloco(conteudo.consultaChave, { centralizar: true }));
  blocos.push(bloco(mascaraChave(conteudo.chave), { centralizar: true, separadorApos: 0.14 }));

  // Divisão V — QR Code (§3.1.5), nível M e UTF-8 (§4.5).
  const simbolo = encodeQrCode(conteudo.qrCode, { nivelCorrecao: 'M' });
  blocos.push(qrBloco(simbolo, medidas));

  // Divisão VI — consumidor (§3.1.6).
  for (const linha of conteudo.consumidor) blocos.push(bloco(linha, { centralizar: true }));

  // Divisão VII — identificação e protocolo (§3.1.7).
  const identificacao = [...conteudo.identificacao];
  if (opcoes.viaEstabelecimento) identificacao.push('Via do Estabelecimento');
  for (const linha of identificacao) blocos.push(bloco(linha));

  // Divisão VIII — mensagens fiscais, inclusive contingência (segundo local).
  if (conteudo.contingencia) {
    blocos.push(
      bloco('EMITIDA EM CONTINGÊNCIA\nPendente de autorização', {
        negrito: true,
        centralizar: true,
      }),
    );
  }
  for (const linha of conteudo.mensagensFiscais) {
    blocos.push(bloco(linha, { negrito: true, centralizar: true }));
  }

  // Divisão IX — mensagem de interesse do contribuinte (§3.1.9).
  if (conteudo.mensagemContribuinte) {
    blocos.push(separador());
    blocos.push(bloco(conteudo.mensagemContribuinte));
  }

  const alturaCm =
    2 * MARGEM_VERTICAL_CM + blocos.reduce((total, item) => total + item.alturaCm, 0);
  medidas.alturaPaginaPt = alturaCm * PT_POR_CM;
  const pagina = pdf.addPage([medidas.larguraCm * PT_POR_CM, medidas.alturaPaginaPt]);
  let y = MARGEM_VERTICAL_CM;
  for (const item of blocos) {
    item.desenhar(pagina, y);
    y += item.alturaCm;
  }
  return pdf.save();
}
