/**
 * Verificação do protocolo de autorização da NF-e (protNFe).
 *
 * Fontes oficiais:
 * - MOC 7.0 — Anexo I, seção 4.4.1 (Tabela de Códigos de Resultado de
 *   Processamento): 100 “Autorizado o uso da NF-e”; 150 “Autorizado o uso da
 *   NF-e, autorização fora de prazo”; 110 “Uso Denegado”; 301/302/303 denegações
 *   (seção 4.4.3).
 * - MOC 7.0 — Anexo II (Manual de Especificações Técnicas do DANFE):
 *   documentos de homologação (tpAmb = 2) e não autorizados não têm valor
 *   fiscal — a inscrição “SEM VALOR FISCAL” acompanha o DANFE nesses casos.
 */
import type { ProblemaValidacao } from '../model/comum';
import type { NFeProc } from '../model/nfe';

/** cStat de uso autorizado (MOC 7.0 — Anexo I, 4.4.1). */
export const CSTAT_AUTORIZADO = new Set([100, 150]);

/** cStat de uso denegado (MOC 7.0 — Anexo I, 4.4.3). */
export const CSTAT_DENEGADO = new Set([110, 301, 302, 303]);

export interface SituacaoProtocolo {
  /** Existe um protNFe anexado ao documento. */
  temProtocolo: boolean;
  /** cStat 100 ou 150 — uso autorizado da NF-e. */
  autorizada: boolean;
  /** cStat 110/301/302/303 — uso denegado. */
  denegada: boolean;
  /** Documento de homologação (tpAmb = 2). */
  homologacao: boolean;
  /** Deve receber a inscrição “SEM VALOR FISCAL” no DANFE. */
  semValorFiscal: boolean;
}

export interface AnaliseProtocolo {
  situacao: SituacaoProtocolo;
  problemas: ProblemaValidacao[];
}

/**
 * Analisa o protocolo da NF-e e anota os problemas correspondentes —
 * nunca lança exceções:
 * - sem protocolo → erro (documento não autorizado pela SEFAZ);
 * - cStat fora de 100/150 → erro (rejeitada/denegada/outro status);
 * - chave do protocolo ≠ chave do infNFe → erro de integridade;
 * - ambiente do protocolo ≠ ambiente da NF-e → erro (MOC B24-10, cStat 252);
 * - homologação (tpAmb = 2) → aviso “SEM VALOR FISCAL”.
 */
export function analisaProtocolo(proc: NFeProc): AnaliseProtocolo {
  const problemas: ProblemaValidacao[] = [];
  const prot = proc.protNFe;
  const homologacao = proc.nfe.ide.tpAmb === 2;

  let autorizada = false;
  let denegada = false;
  let temProtocolo = false;

  if (!prot) {
    problemas.push({
      severity: 'erro',
      code: 'SEM_PROTOCOLO',
      campo: 'nfeProc/protNFe',
      message:
        'Documento sem protocolo de autorização (protNFe ausente) — NF-e não autorizada pela SEFAZ.',
    });
  } else {
    temProtocolo = true;
    if (prot.chNFe !== proc.nfe.chave) {
      problemas.push({
        severity: 'erro',
        code: 'PROTOCOLO_CHAVE_DIVERGENTE',
        campo: 'protNFe/chNFe',
        message: `Chave de acesso do protocolo (${prot.chNFe}) difere da chave do documento (${proc.nfe.chave}).`,
      });
    }
    if (CSTAT_AUTORIZADO.has(prot.cStat)) {
      autorizada = true;
    } else if (CSTAT_DENEGADO.has(prot.cStat)) {
      denegada = true;
      problemas.push({
        severity: 'erro',
        code: 'USO_DENEGADO',
        campo: 'protNFe/cStat',
        cStat: prot.cStat,
        message: `Uso denegado (cStat ${prot.cStat} — ${prot.xMotivo}).`,
      });
    } else {
      problemas.push({
        severity: 'erro',
        code: 'NAO_AUTORIZADA',
        campo: 'protNFe/cStat',
        cStat: prot.cStat,
        message: `NF-e não autorizada (cStat ${prot.cStat} — ${prot.xMotivo}).`,
      });
    }
    if (prot.tpAmb !== proc.nfe.ide.tpAmb) {
      problemas.push({
        severity: 'erro',
        code: 'AMBIENTE_DIVERGENTE',
        regra: 'B24-10',
        cStat: 252,
        campo: 'protNFe/tpAmb',
        message: `Ambiente do protocolo (tpAmb ${prot.tpAmb}) difere do ambiente da NF-e (tpAmb ${proc.nfe.ide.tpAmb}).`,
      });
    }
  }

  if (homologacao) {
    problemas.push({
      severity: 'aviso',
      code: 'AMBIENTE_HOMOLOGACAO',
      campo: 'ide/tpAmb',
      message:
        'Documento emitido em ambiente de homologação (tpAmb = 2) — sem valor fiscal (DANFE deve exibir “SEM VALOR FISCAL”).',
    });
  }

  return {
    situacao: {
      temProtocolo,
      autorizada,
      denegada,
      homologacao,
      semValorFiscal: homologacao || !autorizada,
    },
    problemas,
  };
}
