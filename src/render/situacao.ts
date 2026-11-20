/** Situação fiscal compartilhada pelos renderizadores retrato e paisagem. */
import type { ProcEventoNFe } from '../model/evento';
import type { NFe, NFeProc } from '../model/nfe';
import { TP_EVENTO_CANCELAMENTO } from '../model/evento';
import { CSTAT_DENEGADO } from '../validate/protocolo';
import { TEXTO } from './layout';

export interface Situacao {
  homologacao: boolean;
  semValorFiscal: boolean;
  denegada: boolean;
  cancelada: boolean;
  contingencia: boolean;
  marcas: { texto: string; cor: [number, number, number] }[];
}

/** Opções de situação aceitas por ambos os renderizadores. */
export interface OpcoesSituacao {
  cancelada?: boolean;
  denegada?: boolean;
  contingencia?: boolean;
  eventos?: readonly ProcEventoNFe[];
}

/**
 * Marca d'água e situação do documento (MOC 7.0 Anexo II §3.10.1). As opções
 * explícitas prevalecem sobre a inferência por protocolo/evento/ide.
 */
export function detectaSituacao(proc: NFeProc | NFe, opcoes: OpcoesSituacao): Situacao {
  const nfe = 'nfe' in proc ? proc.nfe : proc;
  const protNFe = 'protNFe' in proc ? proc.protNFe : undefined;
  const ide = nfe.ide;
  const homologacao = ide.tpAmb === 2;
  const denegada = opcoes.denegada ?? (protNFe !== undefined && CSTAT_DENEGADO.has(protNFe.cStat));
  const cancelada =
    opcoes.cancelada ??
    opcoes.eventos?.some(
      (evento) =>
        evento.evento.infEvento.tpEvento === TP_EVENTO_CANCELAMENTO &&
        (evento.retEvento.infEvento.cStat === 135 ||
          evento.retEvento.infEvento.cStat === 101 ||
          evento.retEvento.infEvento.cStat === 151),
    ) ??
    false;
  const contingencia = opcoes.contingencia ?? ide.tpEmis !== 1;
  const autorizada = protNFe !== undefined && (protNFe.cStat === 100 || protNFe.cStat === 150);
  const semValorFiscal = homologacao || !autorizada || cancelada || denegada;

  const marcas: Situacao['marcas'] = [];
  if (semValorFiscal) {
    marcas.push({ texto: TEXTO.semValorFiscal, cor: [0.55, 0.55, 0.55] });
  }
  if (contingencia) {
    marcas.push({ texto: TEXTO.contingencia, cor: [0.45, 0.45, 0.45] });
  }
  if (cancelada) {
    marcas.push({ texto: TEXTO.cancelada, cor: [0.75, 0.12, 0.12] });
  }
  if (denegada) {
    marcas.push({ texto: TEXTO.denegada, cor: [0.75, 0.12, 0.12] });
  }
  return { homologacao, semValorFiscal, denegada, cancelada, contingencia, marcas };
}
