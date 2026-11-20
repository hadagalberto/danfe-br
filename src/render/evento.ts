/**
 * Renderizador dos documentos auxiliares dos eventos da NF-e:
 * cancelamento (tpEvento 110111) e Carta de Correção Eletrônica (110110).
 *
 * Fontes: schemas oficiais de eventos (Evento_Canc PL v1.01 — NT 2018.004 e
 * Evento_CCe PL v1.01) obtidos em https://dfe-portal.svrs.rs.gov.br/NFe/Documentos
 * e MOC 7.0 — Anexo I §4.4.1 (cStat 101/135/151 e 135 para CC-e). Os textos
 * impressos ("CANCELADO", "SEM VALOR FISCAL", "CARTA DE CORREÇÃO ELETRÔNICA")
 * e os campos exibidos correspondem aos dados do `procEventoNFe`.
 */
import { PDFDocument, degrees, type PDFPage } from 'pdf-lib';
import type { DetEventoCce, DetEventoCancelamento, ProcEventoNFe } from '../model/evento';
import { TP_EVENTO_CCE, TP_EVENTO_CANCELAMENTO } from '../model/evento';
import { PAGINA, PT_POR_CM, type Caixa } from './layout';
import { desenharQuadro } from './codigo-barras';
import { incorporaFontes, type FontesDanfe } from './font';
import { cnpjCpf, data, hora, mascaraChave } from './formatacao';
import { desenharCampo, desenharTexto } from './texto';

/** Opções de renderização do comprovante de evento. */
export interface OpcoesRenderEvento {
  /** Substitui o carimbo padrão ("CANCELADO" / "CC-e"). */
  carimbo?: string;
  /** Omite a marca d'água "SEM VALOR FISCAL" no cancelamento. */
  semMarcaValorFiscal?: boolean;
}

const ALTURA_PAGINA_PT = PAGINA.alturaCm * PT_POR_CM;
const LARGURA_PAGINA_PT = PAGINA.larguraCm * PT_POR_CM;
const MARGEM_CM = 1;
const LARGURA_CM = PAGINA.larguraCm - 2 * MARGEM_CM;

function caixa(y: number, altura = 1.1): Caixa {
  return { x: MARGEM_CM, y, largura: LARGURA_CM, altura };
}

function campo(
  pagina: PDFPage,
  y: number,
  rotulo: string,
  valor: string,
  fontes: FontesDanfe,
  altura = 1.1,
): void {
  const caixaCampo = caixa(y, altura);
  desenharQuadro(pagina, caixaCampo, ALTURA_PAGINA_PT, { espessura: 0.5 });
  desenharCampo(pagina, caixaCampo, rotulo, valor, ALTURA_PAGINA_PT, fontes);
}

function blocoTexto(
  pagina: PDFPage,
  y: number,
  rotulo: string,
  texto: string,
  fontes: FontesDanfe,
  altura: number,
): void {
  const caixaTexto = caixa(y, altura);
  desenharQuadro(pagina, caixaTexto, ALTURA_PAGINA_PT, { espessura: 0.5 });
  desenharTexto(
    pagina,
    { x: MARGEM_CM, y, largura: LARGURA_CM, altura: 0.32 },
    rotulo,
    ALTURA_PAGINA_PT,
    { fonte: fontes.negrito, tamanho: 6, margemCm: 0.04 },
  );
  desenharTexto(
    pagina,
    { x: MARGEM_CM + 0.05, y: y + 0.36, largura: LARGURA_CM - 0.1, altura: altura - 0.4 },
    texto,
    ALTURA_PAGINA_PT,
    { fonte: fontes.regular, tamanho: 9, margemCm: 0, entreLinhas: 1.15 },
  );
}

function cabecalho(pagina: PDFPage, titulo: string, fontes: FontesDanfe): void {
  desenharQuadro(pagina, caixa(1, 1.4), ALTURA_PAGINA_PT, { espessura: 0.8 });
  desenharTexto(pagina, caixa(1, 1.4), titulo, ALTURA_PAGINA_PT, {
    fonte: fontes.negrito,
    tamanho: 16,
    alinhamento: 'centro',
    centralizarVertical: true,
  });
}

function carimbo(
  pagina: PDFPage,
  texto: string,
  cor: [number, number, number],
  fontes: FontesDanfe,
): void {
  desenharTexto(pagina, { x: 1.5, y: 13.2, largura: 18, altura: 3.2 }, texto, ALTURA_PAGINA_PT, {
    fonte: fontes.negrito,
    tamanho: 54,
    alinhamento: 'centro',
    centralizarVertical: true,
    cor,
    opacidade: 0.3,
    margemCm: 0,
    rotate: degrees(28),
  });
}

function dadosComuns(
  pagina: PDFPage,
  proc: ProcEventoNFe,
  fontes: FontesDanfe,
  yInicial: number,
): number {
  const inf = proc.evento.infEvento;
  const ret = proc.retEvento.infEvento;
  let y = yInicial;
  campo(pagina, y, 'CHAVE DE ACESSO (44 DÍGITOS)', mascaraChave(inf.chNFe), fontes);
  y += 1.1;
  campo(pagina, y, 'AUTOR DO EVENTO', cnpjCpf(inf.cnpj ?? inf.cpf), fontes);
  y += 1.1;
  campo(pagina, y, 'DATA/HORA DO EVENTO', `${data(inf.dhEvento)} ${hora(inf.dhEvento)}`, fontes);
  y += 1.1;
  campo(
    pagina,
    y,
    'TIPO DE EVENTO / SEQUENCIAL',
    `${inf.tpEvento} / ${String(inf.nSeqEvento).padStart(2, '0')}`,
    fontes,
  );
  y += 1.1;
  campo(
    pagina,
    y,
    'PROTOCOLO DO EVENTO',
    ret.nProt ? `${ret.nProt} — ${data(ret.dhRegEvento)} ${hora(ret.dhRegEvento)}` : '',
    fontes,
  );
  return y + 1.1;
}

function resultado(pagina: PDFPage, proc: ProcEventoNFe, fontes: FontesDanfe, y: number): void {
  const ret = proc.retEvento.infEvento;
  campo(pagina, y, 'RESULTADO DO PROCESSAMENTO', `${ret.cStat} — ${ret.xMotivo}`, fontes);
}

/** Renderiza o comprovante de cancelamento (A4) com carimbo CANCELADO. */
function renderCancelamento(
  pdf: PDFDocument,
  proc: ProcEventoNFe,
  det: DetEventoCancelamento,
  fontes: FontesDanfe,
  opcoes: OpcoesRenderEvento,
): void {
  const pagina = pdf.addPage([LARGURA_PAGINA_PT, ALTURA_PAGINA_PT]);
  cabecalho(pagina, 'COMPROVANTE DE CANCELAMENTO', fontes);
  if (!opcoes.semMarcaValorFiscal) {
    desenharTexto(pagina, caixa(2.6, 0.6), 'SEM VALOR FISCAL', ALTURA_PAGINA_PT, {
      fonte: fontes.negrito,
      tamanho: 11,
      alinhamento: 'centro',
      centralizarVertical: true,
      cor: [0.6, 0.1, 0.1],
    });
  }
  let y = dadosComuns(pagina, proc, fontes, 3.4);
  campo(pagina, y, 'PROTOCOLO DA NF-e CANCELADA', det.nProt, fontes);
  y += 1.1;
  blocoTexto(pagina, y, 'JUSTIFICATIVA DO CANCELAMENTO', det.xJust, fontes, 3.4);
  y += 3.4;
  resultado(pagina, proc, fontes, y);
  carimbo(pagina, opcoes.carimbo ?? 'CANCELADO', [0.75, 0.12, 0.12], fontes);
}

/** Renderiza a Carta de Correção Eletrônica (A4). */
function renderCce(
  pdf: PDFDocument,
  proc: ProcEventoNFe,
  det: DetEventoCce,
  fontes: FontesDanfe,
  opcoes: OpcoesRenderEvento,
): void {
  const pagina = pdf.addPage([LARGURA_PAGINA_PT, ALTURA_PAGINA_PT]);
  cabecalho(pagina, 'CARTA DE CORREÇÃO ELETRÔNICA', fontes);
  let y = dadosComuns(pagina, proc, fontes, 2.8);
  blocoTexto(pagina, y, 'CORREÇÃO', det.xCorrecao, fontes, 3.2);
  y += 3.2;
  blocoTexto(pagina, y, 'CONDIÇÕES DE USO', det.xCondUso, fontes, 6.2);
  y += 6.2;
  resultado(pagina, proc, fontes, y);
  carimbo(pagina, opcoes.carimbo ?? 'CC-e', [0.12, 0.35, 0.6], fontes);
}

/**
 * Gera o PDF do comprovante do evento.
 *
 * @throws {Error} tipo de evento sem renderizador implementado.
 */
export async function renderEvento(
  proc: ProcEventoNFe,
  opcoes: OpcoesRenderEvento = {},
): Promise<Uint8Array> {
  const det = proc.evento.infEvento.detEvento;
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Evento ${proc.evento.infEvento.tpEvento} — ${proc.evento.infEvento.chNFe}`);
  pdf.setSubject('Documento auxiliar do evento da NF-e');
  const fontes = await incorporaFontes(pdf);
  if (det.tipo === TP_EVENTO_CANCELAMENTO && 'nProt' in det && 'xJust' in det) {
    renderCancelamento(pdf, proc, det, fontes, opcoes);
  } else if (det.tipo === TP_EVENTO_CCE && 'xCorrecao' in det && 'xCondUso' in det) {
    renderCce(pdf, proc, det, fontes, opcoes);
  } else {
    throw new Error(
      `Renderizador indisponível para o evento ${String(proc.evento.infEvento.tpEvento)}.`,
    );
  }
  return pdf.save();
}
