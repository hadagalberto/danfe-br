/**
 * Renderizador do DANFE retrato (NF-e modelo 55) com pdf-lib.
 *
 * Layout, fontes mínimas, máscaras, marca d'água e paginação seguem o
 * MOC 7.00 — Anexo II "Manual de Especificações Técnicas do DANFE e Código de
 * Barras" (§2, §3.1.1, §3.1.2, §3.1.7, §3.1.8, §3.7, §3.8.1, §3.9.2,
 * §3.10.1, §3.10.2) e o modelo Anexo III.02. Ver `src/render/layout.ts`
 * para as URLs oficiais citadas.
 *
 * Páginas adicionais: conforme o FAQ oficial do Portal da NF-e ("DANFE (18
 * questões)"), cada folha adicional contém, no mínimo, identificação do
 * emitente, DANFE + documento auxiliar, número/série, tipo de operação,
 * número de ordem e total de folhas, códigos de barras, natureza da operação,
 * chave de acesso, IE/IE-ST/CNPJ do emitente; a área restante é usada para os
 * demais itens e/ou informações complementares.
 *   http://www.nfe.fazenda.gov.br/Portal/perguntasFrequentes.aspx?tipoConteudo=7w14caCnJ6E%3D
 */
import { PDFDocument, degrees, type PDFFont, type PDFPage } from 'pdf-lib';
import { digitoVerificadorChave, formatoChaveAcessoValido } from '../validate/chave';
import type { ProcEventoNFe } from '../model/evento';
import type { Det, Icms, Ipi, NFe, NFeProc } from '../model/nfe';
import {
  BLOCOS_CHAVE,
  BLOCOS_DADOS_CONTINGENCIA,
  CABECALHO,
  CALCULO_IMPOSTO,
  CANHOTO,
  COLUNAS_PRODUTO,
  DADOS_ADICIONAIS,
  DESTINATARIO,
  FATURA,
  FONTE_MINIMA,
  ISSQN,
  LINHA_PICOTE_Y_CM,
  PAGINA,
  PRODUTOS,
  PT_POR_CM,
  TEXTO,
  TRANSPORTADOR,
  type Caixa,
} from './layout';
import { desenharCode128, desenharLinha, desenharQuadro } from './codigo-barras';
import { incorporaFontes, type FontesDanfe } from './font';
import {
  aliquotaIcmsItem,
  cep,
  cnpjCpf,
  cstItem,
  data,
  diaEmissao,
  fone,
  fretePorConta,
  hora,
  inteiro,
  mascaraChave,
  mascaraDadosContingencia,
  numero,
  soDigitos,
} from './formatacao';
import { desenharCampo, desenharTexto, quebrarLinhas } from './texto';
import { renderDanfePaisagem } from './danfe-paisagem';
import { detectaSituacao, type Situacao } from './situacao';

/** Opções de renderização do DANFE retrato. */
export interface OpcoesRenderDanfe {
  /** Leiaute da folha: padrão `retrato`; `paisagem` usa o Anexo II §3.8.2. */
  layout?: 'retrato' | 'paisagem';
  /** Logotipo do emitente (PNG ou JPEG). Opcional conforme MOC §3.1.3. */
  logo?: Uint8Array;
  /** Emite o bloco de canhoto no topo (padrão: true). */
  incluirCanhoto?: boolean;
  /** Força a marca d'água "CANCELADA" (ou detecta pelo evento 110111). */
  cancelada?: boolean;
  /** Força a marca d'água "DENEGADA" (ou detecta pelo cStat do protocolo). */
  denegada?: boolean;
  /** Força a marca d'água "CONTINGÊNCIA" (ou detecta por tpEmis ≠ 1). */
  contingencia?: boolean;
  /** Eventos vinculados à NF-e, usados para detectar cancelamento. */
  eventos?: readonly ProcEventoNFe[];
  /** Inclui o "Valor Aproximado dos Tributos" (MOC §3.1, opcional). */
  mostrarValorAproximadoTributos?: boolean;
}

interface CelulaProduto {
  colunaId: string;
  linhas: string[];
  alinhamento: 'esquerda' | 'centro' | 'direita';
}

interface ItemPagina {
  det: Det;
  celulas: CelulaProduto[];
  alturaCm: number;
  alturaConteudoCm: number;
}

interface PaginaPlano {
  itens: ItemPagina[];
  informacoes: string[];
}

const ALTURA_LINHA_PRODUTO_CM = (FONTE_MINIMA.produto * 1.15) / PT_POR_CM;
const CAPACIDADE_INFORMACOES_LINHAS = 12;

function normaliza(documento: NFeProc | NFe): NFeProc {
  if ('nfe' in documento) return documento;
  return { versao: documento.versao, nfe: documento };
}

/** Valor numérico de um campo do ICMS, seja qual for o grupo (CST/CSOSN). */
function campoIcms<T extends number | undefined>(
  icms: Icms | undefined,
  nome: 'vBC' | 'vICMS' | 'vBCST' | 'vICMSST' | 'vICMSDeson',
): T | undefined {
  if (!icms || !(nome in icms)) return undefined;
  return (icms as unknown as Record<string, number | undefined>)[nome] as T;
}

function valorIpi(ipi: Ipi | undefined): number | undefined {
  return ipi && 'vIPI' in ipi ? ipi.vIPI : undefined;
}

function aliquotaIpi(ipi: Ipi | undefined): number | undefined {
  return ipi && 'pIPI' in ipi ? ipi.pIPI : undefined;
}

/** Textos de FCP exigidos no item pela MOC §3.1.7. */
function informacoesFcp(icms: Icms | undefined): string[] {
  if (!icms) return [];
  const campos = icms as unknown as Record<string, number | undefined>;
  const partes: string[] = [];
  if (campos.vFCP !== undefined) {
    partes.push(
      `FCP: ${campos.vBCFCP !== undefined ? `BC ${numero(campos.vBCFCP)} ` : ''}` +
        `${campos.pFCP !== undefined ? `alíq ${numero(campos.pFCP)}% ` : ''}` +
        `valor ${numero(campos.vFCP)}`,
    );
  }
  if (campos.vFCPST !== undefined) {
    partes.push(
      `FCP ST: ${campos.vBCFCPST !== undefined ? `BC ${numero(campos.vBCFCPST)} ` : ''}` +
        `${campos.pFCPST !== undefined ? `alíq ${numero(campos.pFCPST)}% ` : ''}` +
        `valor ${numero(campos.vFCPST)}`,
    );
  }
  if (campos.vFCPSTRet !== undefined) partes.push(`FCP ST retido: ${numero(campos.vFCPSTRet)}`);
  return partes;
}

function valorColuna(det: Det, id: string, icms: Icms | undefined): string {
  const p = det.prod;
  switch (id) {
    case 'codigo':
      return p.cProd;
    case 'descricao':
      return p.cEAN && p.cEAN !== 'SEM GTIN' ? `${p.xProd}\nEAN ${p.cEAN}` : p.xProd;
    case 'ncm':
      return p.ncm;
    case 'cst':
      return cstItem(icms);
    case 'cfop':
      return p.cfop;
    case 'unidade':
      return p.uCom;
    case 'quantidade':
      return numero(p.qCom, 4);
    case 'valorUnitario':
      return numero(p.vUnCom, 4);
    case 'valorTotal':
      return numero(p.vProd);
    case 'baseIcms':
      return numero(campoIcms(icms, 'vBC'));
    case 'valorIcms':
      return numero(campoIcms(icms, 'vICMS'));
    case 'valorIpi':
      return numero(valorIpi(det.imposto.ipi));
    case 'aliquotaIcms':
      return numero(aliquotaIcmsItem(icms));
    case 'aliquotaIpi':
      return numero(aliquotaIpi(det.imposto.ipi));
    default:
      return '';
  }
}

function preparaItens(proc: NFeProc, fonte: PDFFont): ItemPagina[] {
  return proc.nfe.det.map((det) => {
    const icms = det.imposto.icms;
    const celulas: CelulaProduto[] = COLUNAS_PRODUTO.map((coluna) => {
      const largura = coluna.larguraCm * PT_POR_CM - 0.08;
      const linhas = quebrarLinhas(
        valorColuna(det, coluna.id, icms),
        fonte,
        FONTE_MINIMA.produto,
        Math.max(1, largura),
      );
      return { colunaId: coluna.id, linhas, alinhamento: coluna.alinhamento };
    });
    const informacoes = [
      ...(det.infAdProd ? det.infAdProd.split(/\r?\n/).map((linha) => linha.trim()) : []),
      ...informacoesFcp(icms),
    ].filter((linha) => linha.length > 0);
    const linhas = Math.max(1, ...celulas.map((c) => c.linhas.length));
    const alturaConteudoCm = linhas * ALTURA_LINHA_PRODUTO_CM;
    const alturaCm = Math.min(
      PRODUTOS.quadro.altura - PRODUTOS.alturaCabecalhoCm,
      Math.max(0.5, alturaConteudoCm + 0.08 + (informacoes.length > 0 ? 0.12 : 0)),
    );
    return { det, celulas, alturaCm, alturaConteudoCm };
  });
}

/** Texto das informações adicionais (MOC §3.1.8). */
function informacoesAdicionais(proc: NFeProc, opcoes: OpcoesRenderDanfe): string {
  const nfe = proc.nfe;
  const partes: string[] = [];
  if (nfe.infAdic?.infAdFisco) partes.push(`INF. FISCO: ${nfe.infAdic.infAdFisco}`);
  if (nfe.infAdic?.infCpl) partes.push(nfe.infAdic.infCpl);
  for (const obs of nfe.infAdic?.obsCont ?? []) {
    partes.push(`${obs.xCampo}: ${obs.xTexto}`);
  }
  for (const obs of nfe.infAdic?.obsFisco ?? []) {
    partes.push(`${obs.xCampo}: ${obs.xTexto}`);
  }
  const tot = nfe.total.icmsTot;
  if (
    tot.vICMSUFDest !== undefined ||
    tot.vFCPUFDest !== undefined ||
    tot.vICMSUFRemet !== undefined
  ) {
    partes.push(
      `ICMS interestadual (NT 2015.003): FCP UF dest ${numero(tot.vFCPUFDest)}` +
        ` — vICMS UF dest ${numero(tot.vICMSUFDest)}` +
        ` — vICMS UF remet ${numero(tot.vICMSUFRemet)}`,
    );
  }
  if (opcoes.mostrarValorAproximadoTributos && tot.vTotTrib !== undefined) {
    partes.push(`VALOR APROXIMADO DOS TRIBUTOS: ${numero(tot.vTotTrib)}`);
  }
  return partes.join(' | ');
}

function planejaPaginas(itens: ItemPagina[], informacoes: string, fonte: PDFFont): PaginaPlano[] {
  const linhasInfo = informacoes
    ? quebrarLinhas(
        informacoes,
        fonte,
        FONTE_MINIMA.informacoesComplementares,
        DADOS_ADICIONAIS.informacoes.largura * PT_POR_CM - 0.2,
      )
    : [];
  const paginas: PaginaPlano[] = [{ itens: [], informacoes: [] }];
  const areaProdutos = PRODUTOS.quadro.altura - PRODUTOS.alturaCabecalhoCm;
  let usado = 0;
  for (const item of itens) {
    const atual = paginas[paginas.length - 1]!;
    if (usado + item.alturaCm > areaProdutos && atual.itens.length > 0) {
      paginas.push({ itens: [], informacoes: [] });
      usado = 0;
    }
    paginas[paginas.length - 1]!.itens.push(item);
    usado += item.alturaCm;
  }
  const paginasInfo = Math.ceil(linhasInfo.length / CAPACIDADE_INFORMACOES_LINHAS);
  while (paginas.length < paginasInfo) paginas.push({ itens: [], informacoes: [] });
  paginas.forEach((pagina, indice) => {
    pagina.informacoes = linhasInfo.slice(
      indice * CAPACIDADE_INFORMACOES_LINHAS,
      (indice + 1) * CAPACIDADE_INFORMACOES_LINHAS,
    );
  });
  return paginas;
}

function titulo(
  pagina: PDFPage,
  caixa: Caixa,
  texto: string,
  fontes: FontesDanfe,
  alturaPt: number,
) {
  desenharQuadro(pagina, caixa, alturaPt, { espessura: 0.5 });
  desenharTexto(pagina, caixa, texto, alturaPt, {
    fonte: fontes.negrito,
    tamanho: FONTE_MINIMA.descritivoBloco,
    centralizarVertical: true,
    margemCm: 0.02,
  });
}

function campo(
  pagina: PDFPage,
  caixa: Caixa,
  rotulo: string,
  valor: string,
  fontes: FontesDanfe,
  alturaPt: number,
  opcoes: {
    tamanhoValor?: number;
    valorNegrito?: boolean;
    alinhamento?: 'esquerda' | 'centro' | 'direita';
  } = {},
) {
  desenharQuadro(pagina, caixa, alturaPt, { espessura: 0.5 });
  desenharCampo(pagina, caixa, rotulo, valor, alturaPt, fontes, opcoes);
}

function desenhaMarcaDagua(
  pagina: PDFPage,
  marcas: Situacao['marcas'],
  fontes: FontesDanfe,
  alturaPt: number,
) {
  marcas.forEach((marca, indice) => {
    const tamanho = marcas.length > 2 ? 42 : 56;
    const deslocamento = (indice - (marcas.length - 1) / 2) * 4.2;
    desenharTexto(
      pagina,
      {
        x: 1.4,
        y: 13.6 + deslocamento,
        largura: 18.2,
        altura: 3,
      },
      marca.texto,
      alturaPt,
      {
        fonte: fontes.negrito,
        tamanho,
        alinhamento: 'centro',
        centralizarVertical: true,
        cor: marca.cor,
        opacidade: 0.16,
        margemCm: 0,
        rotate: degrees(35),
      },
    );
  });
}

function desenhaCanhoto(
  pagina: PDFPage,
  proc: NFeProc,
  fontes: FontesDanfe,
  alturaPt: number,
  situacao: Situacao,
) {
  const nfe = proc.nfe;
  if (situacao.semValorFiscal) {
    desenharQuadro(pagina, CANHOTO.recebemos, alturaPt, { espessura: 0.5 });
    desenharTexto(pagina, CANHOTO.recebemos, TEXTO.semValorFiscal, alturaPt, {
      fonte: fontes.negrito,
      tamanho: 8,
      centralizarVertical: true,
      alinhamento: 'centro',
    });
  } else {
    desenharQuadro(pagina, CANHOTO.recebemos, alturaPt, { espessura: 0.5 });
    desenharTexto(
      pagina,
      { ...CANHOTO.recebemos, altura: 0.42 },
      `${TEXTO.recebemosDe} ${nfe.emit.xNome}`,
      alturaPt,
      {
        fonte: fontes.regular,
        tamanho: 6,
        maxLinhas: 2,
        margemCm: 0.04,
      },
    );
  }
  desenharQuadro(pagina, CANHOTO.nfNumSerie, alturaPt, { espessura: 0.5 });
  desenharTexto(pagina, { x: 16.4, y: 0.45, largura: 4.4, altura: 0.45 }, 'NF-e', alturaPt, {
    fonte: fontes.negrito,
    tamanho: 8,
    alinhamento: 'centro',
  });
  desenharTexto(
    pagina,
    { x: 16.4, y: 0.9, largura: 4.4, altura: 0.55 },
    `Nº ${numero(nfe.ide.nNF, 0)}`,
    alturaPt,
    {
      fonte: fontes.negrito,
      tamanho: FONTE_MINIMA.identificacaoDocumento,
      alinhamento: 'centro',
    },
  );
  desenharTexto(
    pagina,
    { x: 16.4, y: 1.45, largura: 4.4, altura: 0.55 },
    `SÉRIE ${inteiro(nfe.ide.serie, 3)}`,
    alturaPt,
    {
      fonte: fontes.negrito,
      tamanho: FONTE_MINIMA.identificacaoDocumento,
      alinhamento: 'centro',
    },
  );
  campo(pagina, CANHOTO.dataRecebimento, TEXTO.dataRecebimento, '', fontes, alturaPt);
  campo(
    pagina,
    CANHOTO.identificacaoAssinatura,
    TEXTO.identificacaoAssinatura,
    '',
    fontes,
    alturaPt,
  );
  desenharLinha(pagina, 0.25, LINHA_PICOTE_Y_CM, 20.82, LINHA_PICOTE_Y_CM, alturaPt, {
    tracejado: true,
    espessura: 0.4,
  });
}

async function desenhaCabecalho(
  pagina: PDFPage,
  documento: PDFDocument,
  proc: NFeProc,
  opcoes: OpcoesRenderDanfe,
  fontes: FontesDanfe,
  alturaPt: number,
  folha: number,
  totalFolhas: number,
  situacao: Situacao,
) {
  const nfe = proc.nfe;
  for (const caixa of [
    CABECALHO.emitente,
    CABECALHO.danfe,
    CABECALHO.chaveBarras,
    CABECALHO.chaveTexto,
    CABECALHO.naturezaOperacao,
    CABECALHO.ieEmitente,
    CABECALHO.ieStEmitente,
    CABECALHO.cnpjEmitente,
  ]) {
    desenharQuadro(pagina, caixa, alturaPt, { espessura: 0.6 });
  }

  let xConteudo = CABECALHO.emitente.x + 0.25;
  let larguraConteudo = CABECALHO.emitente.largura - 0.5;
  if (opcoes.logo) {
    let imagem;
    const bytes = Array.from(opcoes.logo.slice(0, 8));
    const ehJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
    try {
      imagem = ehJpeg
        ? await documentsEmbedJpg(documento, opcoes.logo)
        : await documentsEmbedPng(documento, opcoes.logo);
    } catch (erro) {
      throw new Error(`Logotipo inválido: ${erro instanceof Error ? erro.message : String(erro)}`, {
        cause: erro,
      });
    }
    const escala = Math.min(2.9 / imagem.width, 2.9 / imagem.height);
    pagina.drawImage(imagem, {
      x: (CABECALHO.emitente.x + 0.15) * PT_POR_CM,
      y: alturaPt - (CABECALHO.emitente.y + 0.15 + 2.9) * PT_POR_CM,
      width: imagem.width * escala * PT_POR_CM,
      height: imagem.height * escala * PT_POR_CM,
    });
    xConteudo = CABECALHO.emitente.x + 3.2;
    larguraConteudo = CABECALHO.emitente.largura - 3.45;
  }

  const ender = nfe.emit.enderEmit;
  const enderecoPartes = [
    // MOC §3.7.6: a razão social é o campo do emitente; o fantasia, quando
    // existir, aparece apenas como linha extra (não no lugar da razão social).
    nfe.emit.xFant ? `Fantasia: ${nfe.emit.xFant}` : '',
    `${ender.xLgr}, ${ender.nro}${ender.xCpl ? `, ${ender.xCpl}` : ''}`,
    `${ender.xBairro} - ${ender.xMun}/${ender.uf} - CEP ${cep(ender.cep)}`,
    ender.fone ? `Fone: ${fone(ender.fone)}` : '',
  ].filter((parte) => parte.length > 0);
  desenharTexto(
    pagina,
    { x: xConteudo, y: CABECALHO.emitente.y + 0.35, largura: larguraConteudo, altura: 1.0 },
    nfe.emit.xNome,
    alturaPt,
    { fonte: fontes.negrito, tamanho: FONTE_MINIMA.emitenteNome, maxLinhas: 1, margemCm: 0.02 },
  );
  desenharTexto(
    pagina,
    { x: xConteudo, y: CABECALHO.emitente.y + 1.5, largura: larguraConteudo, altura: 2.1 },
    enderecoPartes.join('\n'),
    alturaPt,
    { fonte: fontes.negrito, tamanho: FONTE_MINIMA.emitenteDados, margemCm: 0.02 },
  );
  desenharTexto(
    pagina,
    {
      x: CABECALHO.danfe.x,
      y: CABECALHO.danfe.y + 0.06,
      largura: CABECALHO.danfe.largura,
      altura: 0.45,
    },
    TEXTO.danfe,
    alturaPt,
    {
      fonte: fontes.negrito,
      tamanho: FONTE_MINIMA.danfe,
      alinhamento: 'centro',
      margemCm: 0.01,
    },
  );
  desenharTexto(
    pagina,
    {
      x: CABECALHO.danfe.x + 0.05,
      y: CABECALHO.danfe.y + 0.52,
      largura: CABECALHO.danfe.largura - 0.1,
      altura: 1.16,
    },
    TEXTO.documentoAuxiliar,
    alturaPt,
    {
      fonte: fontes.regular,
      tamanho: FONTE_MINIMA.descricaoDocumento,
      alinhamento: 'centro',
      entreLinhas: 1.0,
      margemCm: 0.01,
    },
  );
  desenharTexto(
    pagina,
    CABECALHO.tipoOperacao,
    `${nfe.ide.tpNF === 0 ? 'X' : '-'} 0-${TEXTO.entrada}\n${nfe.ide.tpNF === 1 ? 'X' : '-'} 1-${TEXTO.saida}`,
    alturaPt,
    {
      fonte: fontes.negrito,
      tamanho: FONTE_MINIMA.identificacaoDocumento,
      alinhamento: 'centro',
      entreLinhas: 1.0,
      margemCm: 0,
    },
  );
  const identificacao = [
    `Nº ${numero(nfe.ide.nNF, 0)}`,
    `SÉRIE ${inteiro(nfe.ide.serie, 3)}`,
    `FOLHA ${String(folha).padStart(2, '0')}/${String(totalFolhas).padStart(2, '0')}`,
  ].join('\n');
  desenharTexto(pagina, CABECALHO.numeroSerieFolha, identificacao, alturaPt, {
    fonte: fontes.negrito,
    tamanho: FONTE_MINIMA.identificacaoDocumento,
    alinhamento: 'centro',
    entreLinhas: 1.0,
  });
  desenharCode128(pagina, CABECALHO.chaveBarras, alturaPt, nfe.chave);
  desenharTexto(
    pagina,
    {
      x: CABECALHO.chaveTexto.x + 0.05,
      y: CABECALHO.chaveTexto.y,
      largura: CABECALHO.chaveTexto.largura - 0.1,
      altura: 0.22,
    },
    TEXTO.chaveAcesso,
    alturaPt,
    {
      fonte: fontes.negrito,
      tamanho: FONTE_MINIMA.descritivoCampo,
      alinhamento: 'centro',
      margemCm: 0,
    },
  );
  const blocos = mascaraChave(nfe.chave).split(' ');
  const linhasChave = [
    blocos.slice(0, BLOCOS_CHAVE - 5).join(' '),
    blocos.slice(BLOCOS_CHAVE - 5).join(' '),
  ];
  for (const [indice, linha] of linhasChave.entries()) {
    desenharTexto(
      pagina,
      {
        x: CABECALHO.chaveTexto.x + 0.05,
        // 0,19 + 2 × 0,30 = 0,79 cm: a segunda linha conserva 0,06 cm de
        // folga até a borda inferior do quadro (0,85 cm no MOC §3.8.1).
        y: CABECALHO.chaveTexto.y + 0.19 + indice * 0.3,
        largura: CABECALHO.chaveTexto.largura - 0.1,
        altura: 0.3,
      },
      linha,
      alturaPt,
      {
        fonte: fontes.negrito,
        tamanho: FONTE_MINIMA.chaveAcesso,
        alinhamento: 'centro',
        margemCm: 0,
      },
    );
  }

  if (situacao.contingencia) {
    const dados = dadosContingencia(proc);
    if (dados) {
      desenharQuadro(pagina, CABECALHO.dadosBarras, alturaPt, { espessura: 0.6 });
      desenharQuadro(pagina, CABECALHO.dadosNfContingencia, alturaPt, { espessura: 0.6 });
      desenharCode128(pagina, CABECALHO.dadosBarras, alturaPt, dados);
      const emBlocos = mascaraDadosContingencia(dados);
      desenharTexto(pagina, CABECALHO.dadosNfContingencia, emBlocos, alturaPt, {
        fonte: fontes.negrito,
        tamanho: 6,
        alinhamento: 'centro',
        maxLinhas: 2,
        entreLinhas: 1.0,
      });
    }
  } else {
    // MOC §3.9.1 (emissão normal/SVC): Campo 1 = consulta de autenticidade,
    // Campo 2 = protocolo de autorização de uso (nProt + dhRecbto).
    desenharQuadro(pagina, CABECALHO.dadosBarras, alturaPt, { espessura: 0.5 });
    desenharTexto(
      pagina,
      CABECALHO.dadosBarras,
      `${TEXTO.autenticidade1}\n${TEXTO.autenticidade2}`,
      alturaPt,
      {
        fonte: fontes.regular,
        tamanho: FONTE_MINIMA.descritivoCampo,
        alinhamento: 'centro',
        centralizarVertical: true,
        entreLinhas: 1.0,
        margemCm: 0.03,
      },
    );
    const prot = proc.protNFe;
    const valorProtocolo = prot?.nProt
      ? `${prot.nProt}${prot.dhRecbto ? ` ${data(prot.dhRecbto)} ${hora(prot.dhRecbto)}` : ''}`
      : '';
    campo(pagina, CABECALHO.protocolo, TEXTO.protocoloUso, valorProtocolo, fontes, alturaPt, {
      tamanhoValor: FONTE_MINIMA.demais,
    });
  }

  campo(
    pagina,
    CABECALHO.naturezaOperacao,
    'NATUREZA DA OPERAÇÃO',
    nfe.ide.natOp,
    fontes,
    alturaPt,
    {
      tamanhoValor: FONTE_MINIMA.demais,
    },
  );
  campo(pagina, CABECALHO.ieEmitente, 'INSCRIÇÃO ESTADUAL', nfe.emit.ie, fontes, alturaPt);
  campo(
    pagina,
    CABECALHO.ieStEmitente,
    'INSCRIÇÃO ESTADUAL DO SUBSTITUTO TRIBUTÁRIO',
    nfe.emit.iest ?? '',
    fontes,
    alturaPt,
  );
  campo(
    pagina,
    CABECALHO.cnpjEmitente,
    'CNPJ/CPF',
    cnpjCpf(nfe.emit.cnpj ?? nfe.emit.cpf),
    fontes,
    alturaPt,
  );
}

/** Código adicional "Dados da NF-e" — 36 caracteres (MOC §3.9.2). */
function dadosContingencia(proc: NFeProc): string | undefined {
  const ide = proc.nfe.ide;
  if (ide.tpEmis !== 2 && ide.tpEmis !== 5) return undefined;
  const dest = proc.nfe.dest;
  const cuf = dest?.enderDest?.cMun
    ? String(dest.enderDest.cMun).slice(0, 2)
    : String(ide.cUF).padStart(2, '0');
  const documento = soDigitos(dest?.cnpj ?? dest?.cpf)
    .padStart(14, '0')
    .slice(-14);
  const vnf = Math.round(Math.abs(proc.nfe.total.icmsTot.vNF) * 100)
    .toString()
    .padStart(14, '0')
    .slice(-14);
  const tot = proc.nfe.total.icmsTot;
  const icmsp = Math.abs(tot.vICMS) > 0 ? '1' : '2';
  const icmss = Math.abs(tot.vST) > 0 ? '1' : '2';
  const trintaECinco =
    cuf.slice(0, 2) + String(ide.tpEmis) + documento + vnf + icmsp + icmss + diaEmissao(ide.dhEmi);
  if (trintaECinco.length !== BLOCOS_DADOS_CONTINGENCIA * 4 - 1) return undefined;
  const dv = digitoVerificadorChave(trintaECinco);
  return dv === undefined ? undefined : `${trintaECinco}${dv}`;
}

function desenhaCorpoPrimeiraPagina(
  pagina: PDFPage,
  proc: NFeProc,
  fontes: FontesDanfe,
  alturaPt: number,
) {
  const nfe = proc.nfe;
  titulo(pagina, DESTINATARIO.titulo, 'DESTINATÁRIO/REMETENTE', fontes, alturaPt);
  campo(
    pagina,
    DESTINATARIO.razaoSocial,
    'NOME/RAZÃO SOCIAL',
    nfe.dest?.xNome ?? '',
    fontes,
    alturaPt,
  );
  campo(
    pagina,
    DESTINATARIO.cnpj,
    'CNPJ/CPF',
    cnpjCpf(nfe.dest?.cnpj ?? nfe.dest?.cpf),
    fontes,
    alturaPt,
    {
      valorNegrito: true,
    },
  );
  campo(pagina, DESTINATARIO.dataEmissao, 'DATA DA EMISSÃO', data(nfe.ide.dhEmi), fontes, alturaPt);
  const ender = nfe.dest?.enderDest;
  campo(
    pagina,
    DESTINATARIO.endereco,
    'ENDEREÇO',
    ender ? `${ender.xLgr}, ${ender.nro}` : '',
    fontes,
    alturaPt,
  );
  campo(pagina, DESTINATARIO.bairro, 'BAIRRO/DISTRITO', ender?.xBairro ?? '', fontes, alturaPt);
  campo(pagina, DESTINATARIO.cep, 'CEP', cep(ender?.cep), fontes, alturaPt);
  campo(
    pagina,
    DESTINATARIO.dataEntradaSaida,
    'DATA DA ENTRADA/SAÍDA',
    data(nfe.ide.dhSaiEnt),
    fontes,
    alturaPt,
    { valorNegrito: true },
  );
  campo(pagina, DESTINATARIO.municipio, 'MUNICÍPIO', ender?.xMun ?? '', fontes, alturaPt);
  campo(pagina, DESTINATARIO.fone, 'FONE/FAX', fone(ender?.fone), fontes, alturaPt);
  campo(pagina, DESTINATARIO.uf, 'UF', ender?.uf ?? '', fontes, alturaPt);
  campo(
    pagina,
    DESTINATARIO.inscricaoEstadual,
    'INSCRIÇÃO ESTADUAL',
    nfe.dest?.ie ?? '',
    fontes,
    alturaPt,
  );
  campo(
    pagina,
    DESTINATARIO.horaEntradaSaida,
    'HORA DA ENTRADA/SAÍDA',
    hora(nfe.ide.dhSaiEnt),
    fontes,
    alturaPt,
    { valorNegrito: true },
  );

  titulo(pagina, FATURA.titulo, 'FATURA/DUPLICATAS', fontes, alturaPt);
  const fat = nfe.cobr?.fat;
  const duplicatas = (nfe.cobr?.dup ?? [])
    .map((dup) => `${dup.nDup ?? ''} ${data(dup.dVenc)} ${numero(dup.vDup)}`.trim())
    .join(' | ');
  const faturaTexto = [
    fat?.nFat ? `FATURA ${fat.nFat}` : '',
    fat?.vOrig !== undefined ? `ORIG ${numero(fat.vOrig)}` : '',
    fat?.vDesc !== undefined ? `DESC ${numero(fat.vDesc)}` : '',
    fat?.vLiq !== undefined ? `LIQ ${numero(fat.vLiq)}` : '',
    duplicatas,
  ]
    .filter((parte) => parte.length > 0)
    .join('    ');
  desenharQuadro(pagina, FATURA.conteudo, alturaPt, { espessura: 0.5 });
  desenharTexto(pagina, FATURA.conteudo, faturaTexto, alturaPt, {
    fonte: fontes.regular,
    tamanho: FONTE_MINIMA.demais,
    centralizarVertical: true,
    margemCm: 0.04,
    maxLinhas: 1,
  });

  const tot = nfe.total.icmsTot;
  titulo(pagina, CALCULO_IMPOSTO.titulo, 'CÁLCULO DO IMPOSTO', fontes, alturaPt);
  const camposCalculo: [Caixa, string, string | undefined][] = [
    [CALCULO_IMPOSTO.baseIcms, 'BASE DE CÁLCULO DO ICMS', numero(tot.vBC)],
    [CALCULO_IMPOSTO.valorIcms, 'VALOR DO ICMS', numero(tot.vICMS)],
    [CALCULO_IMPOSTO.baseIcmsSt, 'BASE DE CÁLCULO DO ICMS ST', numero(tot.vBCST)],
    [CALCULO_IMPOSTO.valorIcmsSt, 'VALOR DO ICMS ST', numero(tot.vST)],
    [CALCULO_IMPOSTO.valorProdutos, 'VALOR TOTAL DOS PRODUTOS', numero(tot.vProd)],
    [CALCULO_IMPOSTO.valorFrete, 'VALOR DO FRETE', numero(tot.vFrete)],
    [CALCULO_IMPOSTO.valorSeguro, 'VALOR DO SEGURO', numero(tot.vSeg)],
    [CALCULO_IMPOSTO.desconto, 'DESCONTO', numero(tot.vDesc)],
    [CALCULO_IMPOSTO.outrasDespesas, 'OUTRAS DESPESAS ACESSÓRIAS', numero(tot.vOutro)],
    [CALCULO_IMPOSTO.valorIpi, 'VALOR DO IPI', numero(tot.vIPI)],
    [CALCULO_IMPOSTO.valorTotal, 'VALOR TOTAL DA NOTA', numero(tot.vNF)],
  ];
  for (const [caixa, rotulo, valor] of camposCalculo) {
    campo(pagina, caixa, rotulo, valor ?? '', fontes, alturaPt, {
      alinhamento: 'direita',
      valorNegrito: caixa === CALCULO_IMPOSTO.valorTotal,
    });
  }

  titulo(pagina, TRANSPORTADOR.titulo, 'TRANSPORTADOR/VOLUMES TRANSPORTADOS', fontes, alturaPt);
  const transp = nfe.transp;
  const transporta = transp.transporta;
  const veiculo = transp.veicTransp;
  const volumes = transp.vol[0];
  const camposTransp: [Caixa, string, string][] = [
    [TRANSPORTADOR.razaoSocial, 'NOME/RAZÃO SOCIAL', transporta?.xNome ?? ''],
    [TRANSPORTADOR.fretePorConta, 'FRETE POR CONTA', fretePorConta(transp.modFrete)],
    [
      TRANSPORTADOR.codigoAntt,
      'CÓDIGO ANTT',
      transp.retTransp ? String(transp.retTransp.cMunFG) : '',
    ],
    [TRANSPORTADOR.placa, 'PLACA DO VEÍCULO', veiculo?.placa ?? ''],
    [TRANSPORTADOR.uf, 'UF', veiculo?.uf ?? ''],
    [TRANSPORTADOR.cnpj, 'CNPJ/CPF', cnpjCpf(transporta?.cnpj ?? transporta?.cpf)],
    [TRANSPORTADOR.endereco, 'ENDEREÇO', transporta?.xEnder ?? ''],
    [TRANSPORTADOR.municipio, 'MUNICÍPIO', transporta?.xMun ?? ''],
    [TRANSPORTADOR.uf2, 'UF', transporta?.uf ?? ''],
    [TRANSPORTADOR.inscricaoEstadual, 'INSCRIÇÃO ESTADUAL', transporta?.ie ?? ''],
    [
      TRANSPORTADOR.quantidadeVolumes,
      'QUANTIDADE DE VOLUMES',
      volumes?.qVol !== undefined ? String(volumes.qVol) : '',
    ],
    [TRANSPORTADOR.especie, 'ESPÉCIE', volumes?.esp ?? ''],
    [TRANSPORTADOR.marca, 'MARCA', volumes?.marca ?? ''],
    [TRANSPORTADOR.numeracao, 'NUMERAÇÃO', volumes?.nVol ?? ''],
    [TRANSPORTADOR.pesoBruto, 'PESO BRUTO', numero(volumes?.pesoL)],
    [TRANSPORTADOR.pesoLiquido, 'PESO LÍQUIDO', numero(volumes?.pesoB)],
  ];
  for (const [caixa, rotulo, valor] of camposTransp) {
    campo(pagina, caixa, rotulo, valor, fontes, alturaPt);
  }
}

function desenhaProdutos(
  pagina: PDFPage,
  plano: PaginaPlano,
  fontes: FontesDanfe,
  alturaPt: number,
) {
  titulo(pagina, PRODUTOS.titulo, 'DADOS DOS PRODUTOS/SERVIÇOS', fontes, alturaPt);
  const quadro = PRODUTOS.quadro;
  desenharQuadro(pagina, quadro, alturaPt, { espessura: 0.6 });

  let x = quadro.x;
  const alturaCabecalho = PRODUTOS.alturaCabecalhoCm;
  for (const coluna of COLUNAS_PRODUTO) {
    const caixa: Caixa = { x, y: quadro.y, largura: coluna.larguraCm, altura: alturaCabecalho };
    desenharTexto(pagina, caixa, coluna.titulo, alturaPt, {
      fonte: fontes.negrito,
      tamanho: FONTE_MINIMA.descritivoProduto,
      alinhamento: 'centro',
      centralizarVertical: true,
      margemCm: 0.01,
    });
    x += coluna.larguraCm;
  }
  desenharLinha(
    pagina,
    quadro.x,
    quadro.y + alturaCabecalho,
    quadro.x + quadro.largura,
    quadro.y + alturaCabecalho,
    alturaPt,
    { espessura: 0.5 },
  );

  // Linhas verticais das colunas.
  x = quadro.x;
  for (const coluna of COLUNAS_PRODUTO) {
    x += coluna.larguraCm;
    if (x < quadro.x + quadro.largura - 0.001) {
      desenharLinha(pagina, x, quadro.y, x, quadro.y + quadro.altura, alturaPt, {
        espessura: 0.35,
      });
    }
  }

  let y = quadro.y + alturaCabecalho;
  plano.itens.forEach((item, indiceItem) => {
    const altura = item.alturaCm;
    let xColuna = quadro.x;
    COLUNAS_PRODUTO.forEach((coluna, indiceColuna) => {
      const celula = item.celulas[indiceColuna];
      const caixa: Caixa = {
        x: xColuna + 0.03,
        y,
        largura: coluna.larguraCm - 0.06,
        altura: item.alturaConteudoCm,
      };
      desenharTexto(pagina, caixa, (celula?.linhas ?? []).join('\n'), alturaPt, {
        fonte: fontes.regular,
        tamanho: FONTE_MINIMA.produto,
        alinhamento: celula?.alinhamento ?? 'esquerda',
        entreLinhas: 1.15,
        margemCm: 0,
        maxLinhas: Math.max(1, Math.ceil(item.alturaConteudoCm / ALTURA_LINHA_PRODUTO_CM)),
      });
      xColuna += coluna.larguraCm;
    });

    const informacoes = [
      ...(item.det.infAdProd ? item.det.infAdProd.split(/\r?\n/).map((l) => l.trim()) : []),
      ...informacoesFcp(item.det.imposto.icms),
    ].filter((linha) => linha.length > 0);
    if (informacoes.length > 0) {
      desenharTexto(
        pagina,
        {
          x: quadro.x + COLUNAS_PRODUTO[1]!.larguraCm + 0.03,
          y: y + item.alturaConteudoCm + 0.01,
          largura: COLUNAS_PRODUTO[1]!.larguraCm - 0.06,
          altura: Math.max(0.2, altura - item.alturaConteudoCm - 0.06),
        },
        informacoes.join(' | '),
        alturaPt,
        { fonte: fontes.regular, tamanho: FONTE_MINIMA.produto, margemCm: 0, entreLinhas: 1.0 },
      );
    }

    // Destaque divisório entre itens (MOC §3.1.7).
    if (indiceItem < plano.itens.length - 1) {
      desenharLinha(pagina, quadro.x, y + altura, quadro.x + quadro.largura, y + altura, alturaPt, {
        tracejado: true,
        espessura: 0.3,
        cor: [0.55, 0.55, 0.55],
      });
    }
    y += altura;
  });
}

function desenhaRodape(
  pagina: PDFPage,
  proc: NFeProc,
  plano: PaginaPlano,
  fontes: FontesDanfe,
  alturaPt: number,
) {
  titulo(pagina, ISSQN.titulo, 'CÁLCULO DO ISSQN', fontes, alturaPt);
  const issqnTot = proc.nfe.total.issqnTot;
  const camposIss: [Caixa, string, string][] = [
    [ISSQN.inscricaoMunicipal, 'INSCRIÇÃO MUNICIPAL', proc.nfe.emit.im ?? ''],
    [ISSQN.valorServicos, 'VALOR TOTAL DOS SERVIÇOS', numero(issqnTot?.vServ)],
    [ISSQN.baseCalculo, 'BASE DE CÁLCULO DO ISSQN', numero(issqnTot?.vBC)],
    [ISSQN.valorIssqn, 'VALOR DO ISSQN', numero(issqnTot?.vISS)],
  ];
  for (const [caixa, rotulo, valor] of camposIss) {
    campo(pagina, caixa, rotulo, valor, fontes, alturaPt, { alinhamento: 'direita' });
  }

  titulo(pagina, DADOS_ADICIONAIS.titulo, 'DADOS ADICIONAIS', fontes, alturaPt);
  desenharQuadro(pagina, DADOS_ADICIONAIS.informacoes, alturaPt, { espessura: 0.6 });
  desenharQuadro(pagina, DADOS_ADICIONAIS.reservadoFisco, alturaPt, { espessura: 0.6 });
  desenharTexto(
    pagina,
    {
      x: DADOS_ADICIONAIS.informacoes.x + 0.05,
      y: DADOS_ADICIONAIS.informacoes.y + 0.05,
      largura: DADOS_ADICIONAIS.informacoes.largura - 0.1,
      altura: 0.35,
    },
    TEXTO.informacoesComplementares,
    alturaPt,
    { fonte: fontes.negrito, tamanho: FONTE_MINIMA.descritivoBloco },
  );
  desenharTexto(
    pagina,
    {
      x: DADOS_ADICIONAIS.informacoes.x + 0.05,
      y: DADOS_ADICIONAIS.informacoes.y + 0.42,
      largura: DADOS_ADICIONAIS.informacoes.largura - 0.1,
      altura: DADOS_ADICIONAIS.informacoes.altura - 0.47,
    },
    plano.informacoes.join('\n'),
    alturaPt,
    {
      fonte: fontes.regular,
      tamanho: FONTE_MINIMA.informacoesComplementares,
      entreLinhas: 1.0,
      margemCm: 0,
    },
  );
  desenharTexto(
    pagina,
    {
      x: DADOS_ADICIONAIS.reservadoFisco.x + 0.05,
      y: DADOS_ADICIONAIS.reservadoFisco.y + 0.05,
      largura: DADOS_ADICIONAIS.reservadoFisco.largura - 0.1,
      altura: 0.35,
    },
    TEXTO.reservadoFisco,
    alturaPt,
    { fonte: fontes.negrito, tamanho: FONTE_MINIMA.descritivoBloco },
  );
}

async function documentsEmbedPng(documento: PDFDocument, bytes: Uint8Array) {
  return documento.embedPng(bytes);
}

async function documentsEmbedJpg(documento: PDFDocument, bytes: Uint8Array) {
  return documento.embedJpg(bytes);
}

/**
 * Gera o DANFE retrato (A4) como PDF.
 *
 * @throws {Error} chave de acesso ausente/malformada, logotipo inválido.
 */
export async function renderDanfe(
  documento: NFeProc | NFe,
  opcoes: OpcoesRenderDanfe = {},
): Promise<Uint8Array> {
  const proc = normaliza(documento);
  if (opcoes.layout === 'paisagem') return renderDanfePaisagem(proc, opcoes);
  // NT 2025.001: CNPJ alfanumérico coloca letras nas 12 posições da base do
  // CNPJ; o DANFE deve ser impresso normalmente (Code 128 usa fallback B).
  if (!formatoChaveAcessoValido(proc.nfe.chave)) {
    throw new Error(
      `Chave de acesso inválida: esperados 44 caracteres no formato oficial, recebido ${JSON.stringify(proc.nfe.chave)}.`,
    );
  }
  const alturaPt = PAGINA.alturaCm * PT_POR_CM;
  const larguraPt = PAGINA.larguraCm * PT_POR_CM;
  const pdf = await PDFDocument.create();
  pdf.setTitle(`DANFE ${proc.nfe.chave}`);
  pdf.setAuthor(proc.nfe.emit.xNome);
  pdf.setSubject('Documento Auxiliar da Nota Fiscal Eletrônica — modelo 55');
  const fontes = await incorporaFontes(pdf);
  const situacao = detectaSituacao(proc, opcoes);

  const itens = preparaItens(proc, fontes.regular);
  const plano = planejaPaginas(itens, informacoesAdicionais(proc, opcoes), fontes.regular);
  const totalFolhas = plano.length;

  for (const [indice, paginaPlano] of plano.entries()) {
    const pagina = pdf.addPage([larguraPt, alturaPt]);
    desenhaMarcaDagua(pagina, situacao.marcas, fontes, alturaPt);
    const primeira = indice === 0;
    if (primeira && (opcoes.incluirCanhoto ?? true)) {
      desenhaCanhoto(pagina, proc, fontes, alturaPt, situacao);
    }
    await desenhaCabecalho(
      pagina,
      pdf,
      proc,
      opcoes,
      fontes,
      alturaPt,
      indice + 1,
      totalFolhas,
      situacao,
    );
    if (primeira) {
      desenhaCorpoPrimeiraPagina(pagina, proc, fontes, alturaPt);
    } else {
      // Nas folhas seguintes, apenas o mínimo exigido pelo FAQ oficial:
      // cabeçalho (já desenhado), produtos e informações complementares.
      desenharLinha(pagina, 0.25, 8.1, 20.82, 8.1, alturaPt, { espessura: 0.5 });
      desenharTexto(
        pagina,
        { x: 0.25, y: 7.65, largura: 8, altura: 0.4 },
        `CONTINUAÇÃO — FOLHA ${String(indice + 1).padStart(2, '0')}/${String(totalFolhas).padStart(2, '0')}`,
        alturaPt,
        { fonte: fontes.negrito, tamanho: FONTE_MINIMA.descritivoCampo },
      );
    }
    desenhaProdutos(pagina, paginaPlano, fontes, alturaPt);
    desenhaRodape(pagina, proc, paginaPlano, fontes, alturaPt);
  }

  return pdf.save();
}
