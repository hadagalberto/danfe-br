/**
 * Modelo tipado dos eventos da NF-e em seu formato de distribuição
 * (`procEventoNFe`): **cancelamento** (tpEvento 110111) e **Carta de Correção
 * Eletrônica** (tpEvento 110110), além do envelope genérico.
 *
 * Fonte: `schemas/eventos/` — pacotes oficiais de eventos da NF-e
 * (Evento_Generico PL v1.01, Evento_Canc PL v1.01 — NT 2018.004 — e
 * Evento_CCe PL v1.01), obtidos em
 * https://dfe-portal.svrs.rs.gov.br/NFe/Documentos.
 *
 * O `detEvento` é um `xs:anyType` no schema genérico; os pacotes de
 * cancelamento e CC-e definem os campos específicos (`nProt`/`xJust` e
 * `xCorrecao`/`xCondUso`).
 */
import type { TpAmb } from './comum';

/** Código do tipo de evento de Cancelamento (NT 2018.004). */
export const TP_EVENTO_CANCELAMENTO = '110111' as const;

/** Código do tipo de evento de Carta de Correção Eletrônica. */
export const TP_EVENTO_CCE = '110110' as const;

/** Registro do evento emitido pelo autor (`evento/infEvento`). */
export interface InfEvento {
  /** Atributo `Id` (`ID1101102106...` — literal `ID` + tpEvento + chave + nSeq). */
  id?: string;
  /** AC02 — órgão de registro do evento (cUF IBGE; 91=AN, 92=SVC etc.). */
  cOrgao: number;
  /** AC03 — ambiente. */
  tpAmb: TpAmb;
  /** AC04/AC05 — CNPJ ou CPF do autor do evento. */
  cnpj?: string;
  cpf?: string;
  /** AC06 — chave da NF-e alvo. */
  chNFe: string;
  /** AC07 — data/hora do evento (ISO-8601 com fuso). */
  dhEvento: string;
  /** AC08 — código do tipo de evento (110110 = CC-e; 110111 = cancelamento). */
  tpEvento: string;
  /** AC09 — sequencial do evento para o mesmo tpEvento (1-20). */
  nSeqEvento: number;
  /** AC10 — versão do layout do evento. */
  verEvento: string;
  detEvento: DetEvento;
}

/** `detEvento` de cancelamento (leiauteEventoCancNFe_v1.00.xsd). */
export interface DetEventoCancelamento {
  tipo: typeof TP_EVENTO_CANCELAMENTO;
  descEvento: 'Cancelamento';
  /** Protocolo de autorização da NF-e que está sendo cancelada. */
  nProt: string;
  xJust: string;
}

/** `detEvento` de Carta de Correção (leiauteCCe_v1.00.xsd). */
export interface DetEventoCce {
  tipo: typeof TP_EVENTO_CCE;
  descEvento: 'Carta de Correção' | 'Carta de Correcao';
  xCorrecao: string;
  /** Texto fixo de condições de uso definido no schema da CC-e. */
  xCondUso: string;
}

/** `detEvento` de qualquer outro tipo de evento (schema genérico, `xs:anyType`). */
export interface DetEventoGenerico {
  tipo: string;
  descEvento: string;
  /** Campos texto do `detEvento` não especializados acima. */
  campos: Record<string, string>;
}

export type DetEvento = DetEventoCancelamento | DetEventoCce | DetEventoGenerico;

/** Processamento do evento pela SEFAZ (`retEvento/infEvento`). */
export interface RetInfEvento {
  id?: string;
  tpAmb: TpAmb;
  verAplic: string;
  cOrgao: number;
  /**
   * cStat do processamento do evento:
   * 135 = evento registrado e vinculado; 136 = registrado não vinculado;
   * 101 = cancelamento homologado; 151 = homologado fora de prazo.
   * (MOC 7.0 — Anexo I, seção 4.4.1.)
   */
  cStat: number;
  xMotivo: string;
  chNFe?: string;
  tpEvento?: string;
  xEvento?: string;
  nSeqEvento?: number;
  cOrgaoAutor?: number;
  emailDest?: string;
  /** Data/hora de registro do evento na SEFAZ. */
  dhRegEvento?: string;
  nProt?: string;
}

/** `evento` (assinado) — TEvento. */
export interface Evento {
  versao: string;
  infEvento: InfEvento;
}

/** `retEvento` — TRetEvento. */
export interface RetEvento {
  versao: string;
  infEvento: RetInfEvento;
}

/**
 * `procEventoNFe` (ou `procEventoCancNFe`/`procCCeNFe`, que são o mesmo
 * envelope com elementos raiz distintos) — evento + resultado do
 * processamento.
 */
export interface ProcEventoNFe {
  versao: string;
  evento: Evento;
  retEvento: RetEvento;
}
