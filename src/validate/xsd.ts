/**
 * Hook opcional de validação XSD — SPEC: “optional XSD validation hook (no
 * native libxml requirement in core)”.
 *
 * O núcleo da biblioteca **não** avalia esquemas: isso exigiria libxml2
 * nativo (ou um validador XSD completo, proibido pela lista de dependências
 * da SPEC). Em vez disso, este módulo oferece:
 *   1. `detectaEsquemaXsd(xml)` — identifica a raiz e o XSD oficial vendado
 *      correspondente (os arquivos existem em `schemas/`);
 *   2. `validaXsd(xml, validador)` — chama um validador injetado pelo
 *      integrador (que pode usar libxml, Xerces, um serviço SEFAZ etc.) e
 *      normaliza o resultado para o mesmo formato de problemas da validação
 *      estrutural (`ProblemaValidacao`);
 *   3. `validaNFeComXsd(xml, validador)` — executa a validação estrutural
 *      (`validateNFe`) e a validação XSD e devolve um único relatório.
 *
 * FONTES OFICIAIS (verificadas em 20/11/2026, fetch durante o marco 6):
 * - Portal NF-e SVRS, “Documentos → Schemas” e “Documentos → Manuais”:
 *   https://dfe-portal.svrs.rs.gov.br/NFe/Documentos — MOC 7.00 Anexo I/II
 *   (16/12/2020), pacote PL 009q (NT 2025.001, 26/06/2025), pacote PL 010b
 *   (NT 2025.002 v1.30, 07/10/2025), eventos genérico/cancelamento/CC-e
 *   (30/05/2014 e 21/12/2018). Os arquivos e suas versões também estão
 *   registrados em `schemas/README.md` deste repositório.
 * - NOTA TÉCNICA 2025.001 v1.01 — “NFC-e: Leiaute do QR-Code versão 3”
 *   (26/06/2025, publicada conforme Ato Técnico Conjunto 2/2026):
 *   https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=trSXReoZPuY=
 *   — citada aqui porque o mesmo pacote PL 009q é a fonte do XSD de NFC-e.
 *
 * Nenhuma regra de esquema é inventada: os caminhos abaixo são os arquivos
 * reais vendados em `schemas/` e as regras vêm do validador fornecido.
 */
import type { ProblemaValidacao, SeveridadeValidacao } from '../model/comum';
import type { NFeProc } from '../model/nfe';
import { parseNFe } from '../parse/nfe';
import { node, parseXml } from '../parse/xml';
import { validateNFe, type ResultadoValidacaoNFe } from './validate';

/** Elemento raiz reconhecido para seleção do esquema. */
export type RaizDocumentoXsd =
  'nfeProc' | 'NFe' | 'procEventoNFe' | 'procEventoCancNFe' | 'procCCeNFe' | 'desconhecida';

/** Descritor do esquema oficial aplicável a um documento. */
export interface EsquemaXsd {
  /** Elemento raiz esperado pelo esquema. */
  readonly raiz: RaizDocumentoXsd;
  /** Caminho do XSD vendado, relativo à raiz do repositório/pacote. */
  readonly arquivo: string;
  /** Pacote de liberação / nota técnica que publicou o esquema. */
  readonly pacote: string;
  /** URL oficial de publicação do pacote. */
  readonly urlFonte: string;
}

const URL_SCHEMAS_SVRS = 'https://dfe-portal.svrs.rs.gov.br/NFe/Documentos';

/** Esquemas oficiais vendados em `schemas/` (ver schemas/README.md). */
export const ESQUEMAS_XSD: Readonly<Record<Exclude<RaizDocumentoXsd, 'desconhecida'>, EsquemaXsd>> =
  Object.freeze({
    nfeProc: Object.freeze({
      raiz: 'nfeProc',
      arquivo: 'schemas/PL_009q_NT2025_001_v1.00/procNFe_v4.00.xsd',
      pacote: 'PL 009q — NT 2025.001 v1.00',
      urlFonte: URL_SCHEMAS_SVRS,
    }),
    NFe: Object.freeze({
      raiz: 'NFe',
      arquivo: 'schemas/PL_009q_NT2025_001_v1.00/nfe_v4.00.xsd',
      pacote: 'PL 009q — NT 2025.001 v1.00',
      urlFonte: URL_SCHEMAS_SVRS,
    }),
    procEventoNFe: Object.freeze({
      raiz: 'procEventoNFe',
      arquivo: 'schemas/eventos/generico/procEventoNFe_v1.00.xsd',
      pacote: 'Evento Genérico PL v1.01',
      urlFonte: URL_SCHEMAS_SVRS,
    }),
    procEventoCancNFe: Object.freeze({
      raiz: 'procEventoCancNFe',
      arquivo: 'schemas/eventos/cancelamento/procEventoCancNFe_v1.00.xsd',
      pacote: 'Evento Cancelamento PL v1.01 — NT 2018.004',
      urlFonte: URL_SCHEMAS_SVRS,
    }),
    procCCeNFe: Object.freeze({
      raiz: 'procCCeNFe',
      arquivo: 'schemas/eventos/cce/procCCeNFe_v1.00.xsd',
      pacote: 'Evento CC-e PL v1.01',
      urlFonte: URL_SCHEMAS_SVRS,
    }),
  });

const RAIZES = Object.keys(ESQUEMAS_XSD) as Exclude<RaizDocumentoXsd, 'desconhecida'>[];

/**
 * Identifica a raiz do XML e o XSD oficial correspondente.
 * Retorna `undefined` para XML malformado ou raiz não reconhecida — nunca lança.
 */
export function detectaEsquemaXsd(xml: string): EsquemaXsd | undefined {
  try {
    const raiz = parseXml(xml);
    for (const nome of RAIZES) {
      if (node(raiz[nome])) return ESQUEMAS_XSD[nome];
    }
  } catch {
    // XML malformado não tem esquema aplicável; o chamador reporta o problema.
  }
  return undefined;
}

/** Um problema de esquema devolvido pelo validador injetado. */
export interface ProblemaValidadorXsd {
  severity?: SeveridadeValidacao;
  code?: string;
  campo?: string;
  message: string;
  linha?: number;
  coluna?: number;
}

/** Contrato do validador XSD injetado (pode ser assíncrono). */
export interface ResultadoValidadorXsd {
  valido: boolean;
  problemas?: readonly ProblemaValidadorXsd[];
}

export type ValidadorXsd = (
  xml: string,
  esquema: EsquemaXsd,
) => ResultadoValidadorXsd | Promise<ResultadoValidadorXsd>;

/** Resultado normalizado da validação XSD. */
export interface ResultadoValidacaoXsd {
  valido: boolean;
  problemas: ProblemaValidacao[];
  esquema?: EsquemaXsd;
}

function problemaXsd(parcial: ProblemaValidadorXsd): ProblemaValidacao {
  const local = [parcial.linha, parcial.coluna].filter((n): n is number => n !== undefined);
  const sufixo = local.length > 0 ? ` (linha ${local.join(', coluna ')})` : '';
  return {
    severity: parcial.severity ?? 'erro',
    code: `XSD_${parcial.code ?? 'ERRO'}`,
    campo: parcial.campo,
    message: `${parcial.message}${sufixo}`,
  };
}

function problemaInterno(code: string, message: string): ProblemaValidacao {
  return { severity: 'erro', code: `XSD_${code}`, message };
}

function normalizaResultado(
  bruto: ResultadoValidadorXsd | undefined,
  esquema: EsquemaXsd | undefined,
): ResultadoValidacaoXsd {
  if (bruto === undefined || typeof bruto !== 'object' || typeof bruto.valido !== 'boolean') {
    return {
      valido: false,
      problemas: [
        problemaInterno(
          'RESULTADO_INVALIDO',
          'Validador XSD injetado não devolveu { valido: boolean, problemas?: [] }.',
        ),
      ],
      esquema,
    };
  }
  const problemas = (bruto.problemas ?? []).map(problemaXsd);
  if (!bruto.valido && problemas.length === 0) {
    problemas.push(
      problemaInterno('INVALIDO', 'Validador XSD rejeitou o documento sem informar motivos.'),
    );
  }
  return {
    valido: problemas.every((p) => p.severity !== 'erro'),
    problemas,
    esquema,
  };
}

/**
 * Executa o validador XSD injetado e normaliza seu resultado. Nunca lança:
 * falhas do validador são reportadas como problemas (`XSD_HOOK_FALHA`).
 */
export async function validaXsd(
  xml: string,
  validador: ValidadorXsd,
): Promise<ResultadoValidacaoXsd> {
  const esquema = detectaEsquemaXsd(xml);
  if (!esquema) {
    return {
      valido: false,
      problemas: [
        problemaInterno(
          'RAIZ_DESCONHECIDA',
          'Não foi possível identificar a raiz nfeProc/NFe/procEventoNFe para escolher o XSD.',
        ),
      ],
    };
  }
  let bruto: ResultadoValidadorXsd;
  try {
    bruto = await validador(xml, esquema);
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    return {
      valido: false,
      problemas: [problemaInterno('HOOK_FALHA', `Validador XSD falhou: ${mensagem}`)],
      esquema,
    };
  }
  return normalizaResultado(bruto, esquema);
}

/** Relatório que combina validação estrutural e validação XSD. */
export interface ResultadoValidacaoComXsd extends ResultadoValidacaoNFe {
  /** Resultado da etapa XSD (hook). */
  xsd: ResultadoValidacaoXsd;
  /** `valido` da estrutura **e** do XSD. */
  valido: boolean;
}

/**
 * Valida um `nfeProc`/`NFe` estruturalmente **e** com o validador XSD injetado.
 *
 * @throws {ParseError} se o XML não for uma NF-e/NFC-e reconhecida (o parse
 * é etapa separada; a validação em si continua reportando, nunca lançando).
 */
export async function validaNFeComXsd(
  xml: string,
  validador: ValidadorXsd,
): Promise<ResultadoValidacaoComXsd> {
  const proc: NFeProc = parseNFe(xml);
  const estrutural = validateNFe(proc);
  const xsd = await validaXsd(xml, validador);
  const problemas = [...estrutural.problemas, ...xsd.problemas];
  const erros = problemas.filter((p) => p.severity === 'erro');
  const avisos = problemas.filter((p) => p.severity === 'aviso');
  return {
    ...estrutural,
    valido: erros.length === 0,
    problemas,
    erros,
    avisos,
    xsd,
  };
}
