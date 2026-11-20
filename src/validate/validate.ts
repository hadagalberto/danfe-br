/**
 * Orquestrador da validação: `validateNFe(model)` executa todas as
 * verificações estruturais do marco (chave de acesso, documentos CNPJ/CPF,
 * recomputação de totais e protocolo) e devolve um relatório —
 * **reporta, nunca lança**.
 *
 * Cada verificação cita sua fonte oficial no próprio módulo:
 * - chave: `validate/chave.ts` (MOC 7.0 — Visão Geral 2.2.6 / Anexo I A03-10
 *   e B23-10);
 * - documentos: `validate/documentos.ts` (MOC C02-10/E02-10, cStat 207/208,
 *   401, 237; NT 2025.001 para o DV do CNPJ alfanumérico);
 * - totais: `validate/totais.ts` (regras W do Anexo I, cStat 528-609, 610 com
 *   tolerâncias *3/*4);
 * - protocolo: `validate/protocolo.ts` (MOC 4.4.1/4.4.3).
 */
import type { ProblemaValidacao } from '../model/comum';
import type { NFeProc } from '../model/nfe';
import { validaChaveNFe } from './chave';
import { validaDocumentos } from './documentos';
import { analisaProtocolo, type SituacaoProtocolo } from './protocolo';
import { validaItens, validaTotais } from './totais';

export type { ProblemaValidacao };

/** Relatório consolidado da validação de um `nfeProc` (ou NF-e sem protocolo). */
export interface ResultadoValidacaoNFe {
  /** `true` quando não há nenhum problema com severity = 'erro'. */
  valido: boolean;
  /** Todos os problemas encontrados (erros + avisos), na ordem de execução. */
  problemas: ProblemaValidacao[];
  /** Apenas os erros (bloqueiam o uso fiscal do documento). */
  erros: ProblemaValidacao[];
  /** Apenas os avisos (ex.: homologação — “SEM VALOR FISCAL”). */
  avisos: ProblemaValidacao[];
  situacaoProtocolo: SituacaoProtocolo;
  /** Chave de acesso com DV e concatenação consistentes. */
  chaveValida: boolean;
  /** CNPJ/CPF de emitente e destinatário válidos. */
  documentosValidos: boolean;
  /** Totais recomputados batem com os valores declarados. */
  totaisValidos: boolean;
}

function temCodigo(problemas: ProblemaValidacao[], prefixo: string): boolean {
  return problemas.some((p) => p.code === prefixo || p.code.startsWith(prefixo));
}

/**
 * Valida um documento NF-e/NFC-e já parseado e devolve o relatório.
 * Não lança exceções — problemas são reportados no resultado.
 */
export function validateNFe(proc: NFeProc): ResultadoValidacaoNFe {
  try {
    return validaNFeInterno(proc);
  } catch (erro) {
    // Contrato da SPEC: validação reporta, nunca lança. Um modelo vindo de
    // integração em JS pode estar incompleto (campos obrigatórios ausentes);
    // transformamos a falha em problema estruturado em vez de propagar.
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    const problema: ProblemaValidacao = {
      severity: 'erro',
      code: 'VALIDACAO_INTERNA',
      campo: 'NFeProc',
      message: `Não foi possível validar o modelo informado: ${mensagem}`,
    };
    return {
      valido: false,
      problemas: [problema],
      erros: [problema],
      avisos: [],
      situacaoProtocolo: {
        temProtocolo: false,
        autorizada: false,
        denegada: false,
        homologacao: false,
        semValorFiscal: false,
      },
      chaveValida: false,
      documentosValidos: false,
      totaisValidos: false,
    };
  }
}

function validaNFeInterno(proc: NFeProc): ResultadoValidacaoNFe {
  const nfe = proc.nfe;

  const problemasChave = validaChaveNFe(nfe);
  const problemasDocs = validaDocumentos({
    modelo: nfe.ide?.mod,
    emitCnpj: nfe.emit.cnpj,
    emitCpf: nfe.emit.cpf,
    destInformado: nfe.dest !== undefined,
    destCnpj: nfe.dest?.cnpj,
    destCpf: nfe.dest?.cpf,
    destIdEstrangeiro: nfe.dest?.idEstrangeiro,
  });
  const problemasTotais = validaTotais(nfe);
  const problemasItens = validaItens(nfe);
  const { situacao, problemas: problemasProtocolo } = analisaProtocolo(proc);

  const problemas = [
    ...problemasChave,
    ...problemasDocs,
    ...problemasItens,
    ...problemasTotais,
    ...problemasProtocolo,
  ];
  const erros = problemas.filter((p) => p.severity === 'erro');
  const avisos = problemas.filter((p) => p.severity === 'aviso');

  return {
    valido: erros.length === 0,
    problemas,
    erros,
    avisos,
    situacaoProtocolo: situacao,
    chaveValida: !temCodigo(problemasChave, 'CHAVE'),
    documentosValidos:
      !temCodigo(problemasDocs, 'CNPJ') &&
      !temCodigo(problemasDocs, 'CPF') &&
      !temCodigo(problemasDocs, 'EMITENTE_SEM_DOCUMENTO') &&
      !temCodigo(problemasDocs, 'DESTINATARIO_SEM_DOCUMENTO') &&
      !temCodigo(problemasDocs, 'DESTINATARIO_OBRIGATORIO'),
    totaisValidos: !temCodigo(problemasItens, 'ITEM_') && !temCodigo(problemasTotais, 'TOTAL_'),
  };
}
