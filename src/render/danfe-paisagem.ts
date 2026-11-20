/**
 * Renderizador do DANFE paisagem (A4, folhas soltas) com pdf-lib.
 *
 * Leiaute, tamanhos e posições: MOC 7.00 — Anexo II §3.8.2 e Anexo III.04
 * ("DANFE Tamanho A-4 em Modo Paisagem, Folhas Soltas"). URLs oficiais e
 * methodology de medição das colunas em `src/render/layout-paisagem.ts`.
 * Paginação e conteúdo mínimo das folhas de continuação seguem o FAQ oficial
 * citado em `src/render/danfe-retrato.ts`.
 */
import { PDFDocument, degrees, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { NFe, NFeProc } from '../model/nfe';
import {
  ALTURA_PAGINA_PAISAGEM_PT,
  CABECALHO_PAISAGEM,
  CALCULO_IMPOSTO_PAISAGEM,
  CANHOTO_PAISAGEM,
  COLUNAS_PRODUTO_PAISAGEM,
  DADOS_ADICIONAIS_PAISAGEM,
  DESTINATARIO_PAISAGEM,
  FATURA_PAISAGEM,
  ISSQN_PAISAGEM,
  LINHA_PICOTE_X_CM,
  PAGINA_PAISAGEM,
  PRODUTOS_PAISAGEM,
  TITULOS_PAISAGEM,
  TRANSPORTADOR_PAISAGEM,
} from './layout-paisagem';
import { BLOCOS_DADOS_CONTINGENCIA, FONTE_MINIMA, PT_POR_CM, TEXTO, type Caixa } from './layout';
import { desenharCode128, desenharLinha, desenharQuadro } from './codigo-barras';
import { incorporaFontes, type FontesDanfe } from './font';
import {
  aliquotaIcmsItem,
  cnpjCpf,
  cstItem,
  data,
  diaEmissao,
  fretePorConta,
  hora,
  inteiro,
  mascaraChave,
  mascaraDadosContingencia,
  numero,
  soDigitos,
} from './formatacao';
import { detectaSituacao, type Situacao } from './situacao';
import { desenharCampo, desenharTexto, larguraTexto, quebrarLinhas } from './texto';
import { digitoVerificadorChave, formatoChaveAcessoValido } from '../validate/chave';
import type { OpcoesRenderDanfe } from './danfe-retrato';

const ALTURA_LINHA_PRODUTO_CM = (FONTE_MINIMA.produto * 1.15) / PT_POR_CM;

interface Celula {
  linhas: string[];
  alinhamento: 'esquerda' | 'centro' | 'direita';
}

interface ItemPagina {
  celulas: Celula[];
  alturaCm: number;
  alturaConteudoCm: number;
}

function normaliza(documento: NFeProc | NFe): NFeProc {
  if ('nfe' in documento) return documento;
  return { versao: documento.versao, nfe: documento };
}

function campoIcms<T extends number | undefined>(
  icms: { grupo: string } | undefined,
  nome: 'vBC' | 'vICMS' | 'vBCST' | 'vICMSST' | 'vICMSDeson',
): T | undefined {
  if (!icms || !(nome in icms)) return undefined;
  return (icms as unknown as Record<string, number | undefined>)[nome] as T;
}

function valorIpi(item: NFe['det'][number]): number | undefined {
  const ipi = item.imposto.ipi;
  return ipi && 'vIPI' in ipi ? ipi.vIPI : undefined;
}

function aliquotaIpi(item: NFe['det'][number]): number | undefined {
  const ipi = item.imposto.ipi;
  return ipi && 'pIPI' in ipi ? ipi.pIPI : undefined;
}

function informacoesFcp(icms: NFe['det'][number]['imposto']['icms']): string[] {
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

function valorColuna(item: NFe['det'][number], id: string): string {
  const p = item.prod;
  const icms = item.imposto.icms;
  const aliqIcms = aliquotaIcmsItem(icms);
  const aliqIpi = aliquotaIpi(item);
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
    case 'desconto':
      return numero(p.vDesc);
    case 'valorTotal':
      return numero(p.vProd);
    case 'baseIcms':
      return numero(campoIcms(icms, 'vBC'));
    case 'baseIcmsSt':
      return numero(campoIcms(icms, 'vBCST'));
    case 'valorIcms':
      return numero(campoIcms(icms, 'vICMS'));
    case 'valorIcmsSt':
      return numero(campoIcms(icms, 'vICMSST'));
    case 'valorIpi':
      return numero(valorIpi(item));
    case 'aliquotas':
      return [aliqIcms, aliqIpi]
        .filter((v) => v !== undefined)
        .map((v) => numero(v))
        .join(' / ');
    default:
      return '';
  }
}

function preparaItens(proc: NFeProc, fonte: PDFFont): ItemPagina[] {
  return proc.nfe.det.map((item) => {
    const celulas = COLUNAS_PRODUTO_PAISAGEM.map((coluna) => ({
      linhas: quebrarLinhas(
        valorColuna(item, coluna.id),
        fonte,
        FONTE_MINIMA.produto,
        Math.max(1, coluna.larguraCm * PT_POR_CM - 0.08),
      ),
      alinhamento: coluna.alinhamento,
    }));
    const informacoes = [
      ...(item.infAdProd ? item.infAdProd.split(/\r?\n/).map((linha) => linha.trim()) : []),
      ...informacoesFcp(item.imposto.icms),
    ].filter((linha) => linha.length > 0);
    const linhas = Math.max(1, ...celulas.map((c) => c.linhas.length));
    const alturaConteudoCm = linhas * ALTURA_LINHA_PRODUTO_CM;
    const area = PRODUTOS_PAISAGEM.quadro.altura - PRODUTOS_PAISAGEM.alturaCabecalhoCm;
    return {
      celulas,
      alturaCm: Math.min(
        area,
        Math.max(0.4, alturaConteudoCm + 0.08 + (informacoes.length ? 0.1 : 0)),
      ),
      alturaConteudoCm,
    };
  });
}

function informacoesAdicionais(proc: NFeProc, opcoes: OpcoesRenderDanfe): string {
  const nfe = proc.nfe;
  const partes: string[] = [];
  if (nfe.infAdic?.infAdFisco) partes.push(`INF. FISCO: ${nfe.infAdic.infAdFisco}`);
  if (nfe.infAdic?.infCpl) partes.push(nfe.infAdic.infCpl);
  for (const obs of nfe.infAdic?.obsCont ?? []) partes.push(`${obs.xCampo}: ${obs.xTexto}`);
  for (const obs of nfe.infAdic?.obsFisco ?? []) partes.push(`${obs.xCampo}: ${obs.xTexto}`);
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

function planejaPaginas(itens: ItemPagina[], informacoes: string, fonte: PDFFont): ItemPagina[][] {
  const linhasInfo = informacoes
    ? quebrarLinhas(
        informacoes,
        fonte,
        FONTE_MINIMA.informacoesComplementares,
        DADOS_ADICIONAIS_PAISAGEM.informacoes.largura * PT_POR_CM - 0.2,
      )
    : [];
  const paginasInfo = Math.ceil(linhasInfo.length / 16);
  const paginas: ItemPagina[][] = [[]];
  const area = PRODUTOS_PAISAGEM.quadro.altura - PRODUTOS_PAISAGEM.alturaCabecalhoCm;
  let usado = 0;
  for (const item of itens) {
    const atual = paginas[paginas.length - 1]!;
    if (usado + item.alturaCm > area && atual.length > 0) {
      paginas.push([]);
      usado = 0;
    }
    paginas[paginas.length - 1]!.push(item);
    usado += item.alturaCm;
  }
  while (paginas.length < paginasInfo) paginas.push([]);
  return paginas;
}

/** Rótulo de bloco: faixa vertical de 0,51 cm (MOC §3.8.2). */
function tituloVertical(pagina: PDFPage, caixa: Caixa, texto: string, fontes: FontesDanfe): void {
  desenharQuadro(pagina, caixa, ALTURA_PAGINA_PAISAGEM_PT, { espessura: 0.5 });
  const tamanho = FONTE_MINIMA.descritivoBloco;
  const centroX = (caixa.x + caixa.largura / 2) * PT_POR_CM;
  const centroY = ALTURA_PAGINA_PAISAGEM_PT - (caixa.y + caixa.altura / 2) * PT_POR_CM;
  const linhas = texto.split('\n');
  const larguras = linhas.map((linha) => larguraTexto(linha, fontes.negrito, tamanho));
  const espaco = 1;
  const total = larguras.reduce((a, b) => a + b, 0) + espaco * (linhas.length - 1);
  let y = centroY - total / 2;
  linhas.forEach((linha, indice) => {
    pagina.drawText(linha, {
      x: centroX + (tamanho * 0.85) / 2,
      y,
      size: tamanho,
      font: fontes.negrito,
      color: rgb(0, 0, 0),
      rotate: degrees(90),
    });
    y += (larguras[indice] ?? 0) + espaco;
  });
}

function campo(
  pagina: PDFPage,
  caixa: Caixa,
  rotulo: string,
  valor: string,
  fontes: FontesDanfe,
  opcoes: { alinhamento?: 'esquerda' | 'centro' | 'direita'; valorNegrito?: boolean } = {},
): void {
  desenharQuadro(pagina, caixa, ALTURA_PAGINA_PAISAGEM_PT, { espessura: 0.5 });
  desenharCampo(pagina, caixa, rotulo, valor, ALTURA_PAGINA_PAISAGEM_PT, fontes, {
    tamanhoValor: FONTE_MINIMA.demais,
    ...opcoes,
  });
}

function desenhaMarcaDagua(pagina: PDFPage, marcas: Situacao['marcas'], fontes: FontesDanfe): void {
  marcas.forEach((marca, indice) => {
    const tamanho = marcas.length > 2 ? 32 : 44;
    const deslocamento = (indice - (marcas.length - 1) / 2) * 3.2;
    desenharTexto(
      pagina,
      { x: 3.2, y: 9 + deslocamento, largura: 23.2, altura: 2.4 },
      marca.texto,
      ALTURA_PAGINA_PAISAGEM_PT,
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

function desenhaCanhoto(pagina: PDFPage, proc: NFeProc, fontes: FontesDanfe, situacao: Situacao) {
  const nfe = proc.nfe;
  for (const caixa of Object.values(CANHOTO_PAISAGEM)) {
    desenharQuadro(pagina, caixa, ALTURA_PAGINA_PAISAGEM_PT, { espessura: 0.5 });
  }
  tituloVertical(
    pagina,
    CANHOTO_PAISAGEM.nfNumSerie,
    `NF-e\nNº ${numero(nfe.ide.nNF, 0)}\nSÉRIE ${inteiro(nfe.ide.serie, 3)}`,
    fontes,
  );
  tituloVertical(
    pagina,
    CANHOTO_PAISAGEM.recebemos,
    situacao.semValorFiscal
      ? TEXTO.semValorFiscal
      : `RECEBEMOS DE ${nfe.emit.xNome} OS PRODUTOS/SERVIÇOS CONSTANTES DA NOTA FISCAL INDICADA AO LADO`,
    fontes,
  );
  tituloVertical(
    pagina,
    CANHOTO_PAISAGEM.identificacaoAssinatura,
    'IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR',
    fontes,
  );
  tituloVertical(pagina, CANHOTO_PAISAGEM.dataRecebimento, 'DATA DE RECEBIMENTO', fontes);
  desenharLinha(
    pagina,
    LINHA_PICOTE_X_CM,
    0,
    LINHA_PICOTE_X_CM,
    PAGINA_PAISAGEM.alturaCm,
    ALTURA_PAGINA_PAISAGEM_PT,
    { tracejado: true, espessura: 0.4 },
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

async function desenhaCabecalho(
  pagina: PDFPage,
  documento: PDFDocument,
  proc: NFeProc,
  opcoes: OpcoesRenderDanfe,
  fontes: FontesDanfe,
  folha: number,
  totalFolhas: number,
  situacao: Situacao,
): Promise<void> {
  for (const caixa of [
    CABECALHO_PAISAGEM.emitente,
    CABECALHO_PAISAGEM.danfe,
    CABECALHO_PAISAGEM.chaveBarras,
    CABECALHO_PAISAGEM.chaveTexto,
    CABECALHO_PAISAGEM.naturezaOperacao,
    CABECALHO_PAISAGEM.ieEmitente,
    CABECALHO_PAISAGEM.ieStEmitente,
    CABECALHO_PAISAGEM.cnpjEmitente,
  ]) {
    desenharQuadro(pagina, caixa, ALTURA_PAGINA_PAISAGEM_PT, { espessura: 0.6 });
  }
  const nfe = proc.nfe;
  let xConteudo = CABECALHO_PAISAGEM.emitente.x + 0.25;
  let larguraConteudo = CABECALHO_PAISAGEM.emitente.largura - 0.5;
  if (opcoes.logo) {
    let imagem;
    const bytes = Array.from(opcoes.logo.slice(0, 8));
    const ehJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
    try {
      imagem = ehJpeg
        ? await documento.embedJpg(opcoes.logo)
        : await documento.embedPng(opcoes.logo);
    } catch (erro) {
      throw new Error(`Logotipo inválido: ${erro instanceof Error ? erro.message : String(erro)}`, {
        cause: erro,
      });
    }
    const escala = Math.min(2.2 / imagem.width, 2.2 / imagem.height);
    pagina.drawImage(imagem, {
      x: (CABECALHO_PAISAGEM.emitente.x + 0.1) * PT_POR_CM,
      y: ALTURA_PAGINA_PAISAGEM_PT - (CABECALHO_PAISAGEM.emitente.y + 0.1 + 2.2) * PT_POR_CM,
      width: imagem.width * escala * PT_POR_CM,
      height: imagem.height * escala * PT_POR_CM,
    });
    xConteudo = CABECALHO_PAISAGEM.emitente.x + 2.5;
    larguraConteudo = CABECALHO_PAISAGEM.emitente.largura - 2.75;
  }
  const ender = nfe.emit.enderEmit;
  const enderecoPartes = [
    `${ender.xLgr}, ${ender.nro}${ender.xCpl ? `, ${ender.xCpl}` : ''}`,
    `${ender.xBairro} - ${ender.xMun}/${ender.uf} - CEP ${ender.cep ?? ''}`,
    ender.fone ? `Fone: ${ender.fone}` : '',
  ].filter((parte) => parte.length > 0);
  desenharTexto(
    pagina,
    {
      x: xConteudo,
      y: CABECALHO_PAISAGEM.emitente.y + 0.2,
      largura: larguraConteudo,
      altura: 0.7,
    },
    nfe.emit.xFant ?? nfe.emit.xNome,
    ALTURA_PAGINA_PAISAGEM_PT,
    { fonte: fontes.negrito, tamanho: FONTE_MINIMA.emitenteNome, maxLinhas: 1, margemCm: 0.02 },
  );
  desenharTexto(
    pagina,
    {
      x: xConteudo,
      y: CABECALHO_PAISAGEM.emitente.y + 1.0,
      largura: larguraConteudo,
      altura: 1.9,
    },
    enderecoPartes.join('\n'),
    ALTURA_PAGINA_PAISAGEM_PT,
    { fonte: fontes.negrito, tamanho: FONTE_MINIMA.emitenteDados, margemCm: 0.02 },
  );

  const danfe = CABECALHO_PAISAGEM.danfe;
  desenharTexto(
    pagina,
    { x: danfe.x, y: danfe.y + 0.05, largura: danfe.largura, altura: 0.45 },
    TEXTO.danfe,
    ALTURA_PAGINA_PAISAGEM_PT,
    { fonte: fontes.negrito, tamanho: FONTE_MINIMA.danfe, alinhamento: 'centro', margemCm: 0 },
  );
  desenharTexto(
    pagina,
    { x: danfe.x + 0.05, y: danfe.y + 0.5, largura: danfe.largura - 0.1, altura: 1.05 },
    TEXTO.documentoAuxiliar,
    ALTURA_PAGINA_PAISAGEM_PT,
    {
      fonte: fontes.regular,
      tamanho: FONTE_MINIMA.descricaoDocumento,
      alinhamento: 'centro',
      entreLinhas: 1.0,
      margemCm: 0,
    },
  );
  desenharTexto(
    pagina,
    CABECALHO_PAISAGEM.tipoOperacao,
    `${nfe.ide.tpNF === 0 ? 'X' : '-'} 0-${TEXTO.entrada}\n${nfe.ide.tpNF === 1 ? 'X' : '-'} 1-${TEXTO.saida}`,
    ALTURA_PAGINA_PAISAGEM_PT,
    {
      fonte: fontes.negrito,
      tamanho: FONTE_MINIMA.identificacaoDocumento,
      alinhamento: 'centro',
      entreLinhas: 1.0,
      margemCm: 0,
    },
  );
  desenharTexto(
    pagina,
    CABECALHO_PAISAGEM.numeroSerieFolha,
    [
      `Nº ${numero(nfe.ide.nNF, 0)}`,
      `SÉRIE ${inteiro(nfe.ide.serie, 3)}`,
      `FOLHA ${String(folha).padStart(2, '0')}/${String(totalFolhas).padStart(2, '0')}`,
    ].join('\n'),
    ALTURA_PAGINA_PAISAGEM_PT,
    {
      fonte: fontes.negrito,
      tamanho: FONTE_MINIMA.identificacaoDocumento,
      alinhamento: 'centro',
      entreLinhas: 0.92,
      margemCm: 0,
    },
  );
  desenharCode128(pagina, CABECALHO_PAISAGEM.chaveBarras, ALTURA_PAGINA_PAISAGEM_PT, nfe.chave);
  desenharTexto(
    pagina,
    CABECALHO_PAISAGEM.chaveTexto,
    mascaraChave(nfe.chave),
    ALTURA_PAGINA_PAISAGEM_PT,
    {
      fonte: fontes.negrito,
      tamanho: FONTE_MINIMA.chaveAcesso,
      alinhamento: 'centro',
      centralizarVertical: true,
      margemCm: 0,
    },
  );
  if (situacao.contingencia) {
    const dados = dadosContingencia(proc);
    if (dados) {
      desenharQuadro(pagina, CABECALHO_PAISAGEM.dadosBarras, ALTURA_PAGINA_PAISAGEM_PT, {
        espessura: 0.6,
      });
      desenharQuadro(pagina, CABECALHO_PAISAGEM.dadosNfContingencia, ALTURA_PAGINA_PAISAGEM_PT, {
        espessura: 0.6,
      });
      desenharCode128(pagina, CABECALHO_PAISAGEM.dadosBarras, ALTURA_PAGINA_PAISAGEM_PT, dados);
      desenharTexto(
        pagina,
        CABECALHO_PAISAGEM.dadosNfContingencia,
        mascaraDadosContingencia(dados),
        ALTURA_PAGINA_PAISAGEM_PT,
        { fonte: fontes.negrito, tamanho: 7, alinhamento: 'centro', margemCm: 0, maxLinhas: 1 },
      );
    }
  }
  campo(pagina, CABECALHO_PAISAGEM.naturezaOperacao, 'NATUREZA DA OPERAÇÃO', nfe.ide.natOp, fontes);
  campo(pagina, CABECALHO_PAISAGEM.ieEmitente, 'INSCRIÇÃO ESTADUAL', nfe.emit.ie, fontes);
  campo(
    pagina,
    CABECALHO_PAISAGEM.ieStEmitente,
    'INSCRIÇÃO ESTADUAL DO SUBSTITUTO TRIBUTÁRIO',
    nfe.emit.iest ?? '',
    fontes,
  );
  campo(
    pagina,
    CABECALHO_PAISAGEM.cnpjEmitente,
    'CNPJ/CPF',
    cnpjCpf(nfe.emit.cnpj ?? nfe.emit.cpf),
    fontes,
  );
}

function desenhaCorpo(pagina: PDFPage, proc: NFeProc, fontes: FontesDanfe, primeira: boolean) {
  const nfe = proc.nfe;
  tituloVertical(pagina, TITULOS_PAISAGEM.destinatario, 'DESTINATÁRIO/REMETENTE', fontes);
  const ender = nfe.dest?.enderDest;
  const camposDest: [Caixa, string, string][] = [
    [DESTINATARIO_PAISAGEM.razaoSocial, 'NOME/RAZÃO SOCIAL', nfe.dest?.xNome ?? ''],
    [DESTINATARIO_PAISAGEM.cnpj, 'CNPJ/CPF', cnpjCpf(nfe.dest?.cnpj ?? nfe.dest?.cpf)],
    [DESTINATARIO_PAISAGEM.dataEmissao, 'DATA DA EMISSÃO', data(nfe.ide.dhEmi)],
    [DESTINATARIO_PAISAGEM.endereco, 'ENDEREÇO', ender ? `${ender.xLgr}, ${ender.nro}` : ''],
    [DESTINATARIO_PAISAGEM.bairro, 'BAIRRO/DISTRITO', ender?.xBairro ?? ''],
    [DESTINATARIO_PAISAGEM.cep, 'CEP', ender?.cep ?? ''],
    [DESTINATARIO_PAISAGEM.dataEntradaSaida, 'DATA DA ENTRADA/SAÍDA', data(nfe.ide.dhSaiEnt)],
    [DESTINATARIO_PAISAGEM.municipio, 'MUNICÍPIO', ender?.xMun ?? ''],
    [DESTINATARIO_PAISAGEM.fone, 'FONE/FAX', ender?.fone ?? ''],
    [DESTINATARIO_PAISAGEM.uf, 'UF', ender?.uf ?? ''],
    [DESTINATARIO_PAISAGEM.inscricaoEstadual, 'INSCRIÇÃO ESTADUAL', nfe.dest?.ie ?? ''],
    [DESTINATARIO_PAISAGEM.horaEntradaSaida, 'HORA DA ENTRADA/SAÍDA', hora(nfe.ide.dhSaiEnt)],
  ];
  for (const [caixa, rotulo, valor] of camposDest) campo(pagina, caixa, rotulo, valor, fontes);

  tituloVertical(pagina, TITULOS_PAISAGEM.fatura, 'FATURA/DUPLICATAS', fontes);
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
  desenharQuadro(pagina, FATURA_PAISAGEM.conteudo, ALTURA_PAGINA_PAISAGEM_PT, {
    espessura: 0.5,
  });
  desenharTexto(pagina, FATURA_PAISAGEM.conteudo, faturaTexto, ALTURA_PAGINA_PAISAGEM_PT, {
    fonte: fontes.regular,
    tamanho: FONTE_MINIMA.demais,
    centralizarVertical: true,
    margemCm: 0.04,
    maxLinhas: 1,
  });

  tituloVertical(pagina, TITULOS_PAISAGEM.calculoImposto, 'CÁLCULO DO IMPOSTO', fontes);
  const tot = nfe.total.icmsTot;
  const camposImposto: [Caixa, string, string | undefined][] = [
    [CALCULO_IMPOSTO_PAISAGEM.baseIcms, 'BASE DE CÁLCULO DO ICMS', numero(tot.vBC)],
    [CALCULO_IMPOSTO_PAISAGEM.valorIcms, 'VALOR DO ICMS', numero(tot.vICMS)],
    [CALCULO_IMPOSTO_PAISAGEM.baseIcmsSt, 'BASE DE CÁLCULO DO ICMS ST', numero(tot.vBCST)],
    [CALCULO_IMPOSTO_PAISAGEM.valorIcmsSt, 'VALOR DO ICMS ST', numero(tot.vST)],
    [CALCULO_IMPOSTO_PAISAGEM.valorProdutos, 'VALOR TOTAL DOS PRODUTOS', numero(tot.vProd)],
    [CALCULO_IMPOSTO_PAISAGEM.valorFrete, 'VALOR DO FRETE', numero(tot.vFrete)],
    [CALCULO_IMPOSTO_PAISAGEM.valorSeguro, 'VALOR DO SEGURO', numero(tot.vSeg)],
    [CALCULO_IMPOSTO_PAISAGEM.desconto, 'DESCONTO', numero(tot.vDesc)],
    [CALCULO_IMPOSTO_PAISAGEM.outrasDespesas, 'OUTRAS DESPESAS ACESSÓRIAS', numero(tot.vOutro)],
    [CALCULO_IMPOSTO_PAISAGEM.valorIpi, 'VALOR DO IPI', numero(tot.vIPI)],
    [CALCULO_IMPOSTO_PAISAGEM.valorTotal, 'VALOR TOTAL DA NOTA', numero(tot.vNF)],
  ];
  for (const [caixa, rotulo, valor] of camposImposto) {
    campo(pagina, caixa, rotulo, valor ?? '', fontes, {
      alinhamento: 'direita',
      valorNegrito: caixa === CALCULO_IMPOSTO_PAISAGEM.valorTotal,
    });
  }

  tituloVertical(
    pagina,
    TITULOS_PAISAGEM.transportador,
    'TRANSPORTADOR/VOLUMES TRANSPORTADOS',
    fontes,
  );
  const transp = nfe.transp;
  const transporta = transp.transporta;
  const veiculo = transp.veicTransp;
  const volumes = transp.vol[0];
  const camposTransp: [Caixa, string, string][] = [
    [TRANSPORTADOR_PAISAGEM.razaoSocial, 'NOME/RAZÃO SOCIAL', transporta?.xNome ?? ''],
    [TRANSPORTADOR_PAISAGEM.fretePorConta, 'FRETE POR CONTA', fretePorConta(transp.modFrete)],
    [
      TRANSPORTADOR_PAISAGEM.codigoAntt,
      'CÓDIGO ANTT',
      transp.retTransp ? String(transp.retTransp.cMunFG) : '',
    ],
    [TRANSPORTADOR_PAISAGEM.placa, 'PLACA DO VEÍCULO', veiculo?.placa ?? ''],
    [TRANSPORTADOR_PAISAGEM.uf, 'UF', veiculo?.uf ?? ''],
    [TRANSPORTADOR_PAISAGEM.cnpj, 'CNPJ/CPF', cnpjCpf(transporta?.cnpj ?? transporta?.cpf)],
    [TRANSPORTADOR_PAISAGEM.endereco, 'ENDEREÇO', transporta?.xEnder ?? ''],
    [TRANSPORTADOR_PAISAGEM.municipio, 'MUNICÍPIO', transporta?.xMun ?? ''],
    [TRANSPORTADOR_PAISAGEM.uf2, 'UF', transporta?.uf ?? ''],
    [TRANSPORTADOR_PAISAGEM.inscricaoEstadual, 'INSCRIÇÃO ESTADUAL', transporta?.ie ?? ''],
    [
      TRANSPORTADOR_PAISAGEM.quantidadeVolumes,
      'QUANTIDADE DE VOLUMES',
      volumes?.qVol !== undefined ? String(volumes.qVol) : '',
    ],
    [TRANSPORTADOR_PAISAGEM.especie, 'ESPÉCIE', volumes?.esp ?? ''],
    [TRANSPORTADOR_PAISAGEM.marca, 'MARCA', volumes?.marca ?? ''],
    [TRANSPORTADOR_PAISAGEM.numeracao, 'NUMERAÇÃO', volumes?.nVol ?? ''],
    [TRANSPORTADOR_PAISAGEM.pesoBruto, 'PESO BRUTO', numero(volumes?.pesoL)],
    [TRANSPORTADOR_PAISAGEM.pesoLiquido, 'PESO LÍQUIDO', numero(volumes?.pesoB)],
  ];
  for (const [caixa, rotulo, valor] of camposTransp) campo(pagina, caixa, rotulo, valor, fontes);

  if (!primeira) {
    desenharTexto(
      pagina,
      { x: 2.92, y: 10.7, largura: 10, altura: 0.35 },
      'CONTINUAÇÃO',
      ALTURA_PAGINA_PAISAGEM_PT,
      { fonte: fontes.negrito, tamanho: FONTE_MINIMA.descritivoCampo },
    );
  }
}

function desenhaProdutos(pagina: PDFPage, itens: ItemPagina[], fontes: FontesDanfe): void {
  tituloVertical(pagina, TITULOS_PAISAGEM.produtos, 'DADOS DOS PRODUTOS/SERVIÇOS', fontes);
  const quadro = PRODUTOS_PAISAGEM.quadro;
  desenharQuadro(pagina, quadro, ALTURA_PAGINA_PAISAGEM_PT, { espessura: 0.6 });
  let x = quadro.x;
  const alturaCabecalho = PRODUTOS_PAISAGEM.alturaCabecalhoCm;
  for (const coluna of COLUNAS_PRODUTO_PAISAGEM) {
    desenharTexto(
      pagina,
      { x, y: quadro.y, largura: coluna.larguraCm, altura: alturaCabecalho },
      coluna.titulo,
      ALTURA_PAGINA_PAISAGEM_PT,
      {
        fonte: fontes.negrito,
        tamanho: FONTE_MINIMA.descritivoProduto,
        alinhamento: 'centro',
        centralizarVertical: true,
        margemCm: 0.01,
      },
    );
    x += coluna.larguraCm;
  }
  desenharLinha(
    pagina,
    quadro.x,
    quadro.y + alturaCabecalho,
    quadro.x + quadro.largura,
    quadro.y + alturaCabecalho,
    ALTURA_PAGINA_PAISAGEM_PT,
    { espessura: 0.5 },
  );
  x = quadro.x;
  for (const coluna of COLUNAS_PRODUTO_PAISAGEM) {
    x += coluna.larguraCm;
    if (x < quadro.x + quadro.largura - 0.001) {
      desenharLinha(pagina, x, quadro.y, x, quadro.y + quadro.altura, ALTURA_PAGINA_PAISAGEM_PT, {
        espessura: 0.35,
      });
    }
  }
  let y = quadro.y + alturaCabecalho;
  itens.forEach((item, indice) => {
    let xColuna = quadro.x;
    COLUNAS_PRODUTO_PAISAGEM.forEach((coluna, indiceColuna) => {
      const celula = item.celulas[indiceColuna];
      desenharTexto(
        pagina,
        {
          x: xColuna + 0.02,
          y,
          largura: coluna.larguraCm - 0.04,
          altura: item.alturaConteudoCm,
        },
        (celula?.linhas ?? []).join('\n'),
        ALTURA_PAGINA_PAISAGEM_PT,
        {
          fonte: fontes.regular,
          tamanho: FONTE_MINIMA.produto,
          alinhamento: celula?.alinhamento ?? 'esquerda',
          entreLinhas: 1.15,
          margemCm: 0,
          maxLinhas: Math.max(1, Math.ceil(item.alturaConteudoCm / ALTURA_LINHA_PRODUTO_CM)),
        },
      );
      xColuna += coluna.larguraCm;
    });
    if (indice < itens.length - 1) {
      desenharLinha(
        pagina,
        quadro.x,
        y + item.alturaCm,
        quadro.x + quadro.largura,
        y + item.alturaCm,
        ALTURA_PAGINA_PAISAGEM_PT,
        { tracejado: true, espessura: 0.3, cor: [0.55, 0.55, 0.55] },
      );
    }
    y += item.alturaCm;
  });
}

function desenhaRodape(
  pagina: PDFPage,
  proc: NFeProc,
  informacoes: string[],
  fontes: FontesDanfe,
): void {
  tituloVertical(pagina, TITULOS_PAISAGEM.issqn, 'CÁLCULO DO ISSQN', fontes);
  const issqnTot = proc.nfe.total.issqnTot;
  const camposIss: [Caixa, string, string][] = [
    [ISSQN_PAISAGEM.inscricaoMunicipal, 'INSCRIÇÃO MUNICIPAL', proc.nfe.emit.im ?? ''],
    [ISSQN_PAISAGEM.valorServicos, 'VALOR TOTAL DOS SERVIÇOS', numero(issqnTot?.vServ)],
    [ISSQN_PAISAGEM.baseCalculo, 'BASE DE CÁLCULO DO ISSQN', numero(issqnTot?.vBC)],
    [ISSQN_PAISAGEM.valorIssqn, 'VALOR DO ISSQN', numero(issqnTot?.vISS)],
  ];
  for (const [caixa, rotulo, valor] of camposIss) {
    campo(pagina, caixa, rotulo, valor, fontes, { alinhamento: 'direita' });
  }

  tituloVertical(pagina, TITULOS_PAISAGEM.dadosAdicionais, 'DADOS ADICIONAIS', fontes);
  const detalhes = DADOS_ADICIONAIS_PAISAGEM;
  desenharQuadro(pagina, detalhes.informacoes, ALTURA_PAGINA_PAISAGEM_PT, { espessura: 0.6 });
  desenharQuadro(pagina, detalhes.reservadoFisco, ALTURA_PAGINA_PAISAGEM_PT, { espessura: 0.6 });
  desenharTexto(
    pagina,
    {
      x: detalhes.informacoes.x + 0.05,
      y: detalhes.informacoes.y + 0.04,
      largura: detalhes.informacoes.largura - 0.1,
      altura: 0.3,
    },
    TEXTO.informacoesComplementares,
    ALTURA_PAGINA_PAISAGEM_PT,
    { fonte: fontes.negrito, tamanho: FONTE_MINIMA.descritivoBloco },
  );
  desenharTexto(
    pagina,
    {
      x: detalhes.informacoes.x + 0.05,
      y: detalhes.informacoes.y + 0.38,
      largura: detalhes.informacoes.largura - 0.1,
      altura: detalhes.informacoes.altura - 0.43,
    },
    informacoes.join('\n'),
    ALTURA_PAGINA_PAISAGEM_PT,
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
      x: detalhes.reservadoFisco.x + 0.05,
      y: detalhes.reservadoFisco.y + 0.04,
      largura: detalhes.reservadoFisco.largura - 0.1,
      altura: 0.3,
    },
    TEXTO.reservadoFisco,
    ALTURA_PAGINA_PAISAGEM_PT,
    { fonte: fontes.negrito, tamanho: FONTE_MINIMA.descritivoBloco },
  );
}

/**
 * Gera o DANFE paisagem (A4, 29,7 × 21 cm) como PDF.
 *
 * @throws {Error} chave de acesso ausente/malformada, logotipo inválido.
 */
export async function renderDanfePaisagem(
  documento: NFeProc | NFe,
  opcoes: OpcoesRenderDanfe = {},
): Promise<Uint8Array> {
  const proc = normaliza(documento);
  // NT 2025.001 — ver observação idêntica em `danfe-retrato.ts`.
  if (!formatoChaveAcessoValido(proc.nfe.chave)) {
    throw new Error(
      `Chave de acesso inválida: esperados 44 caracteres no formato oficial, recebido ${JSON.stringify(proc.nfe.chave)}.`,
    );
  }
  const pdf = await PDFDocument.create();
  pdf.setTitle(`DANFE ${proc.nfe.chave}`);
  pdf.setAuthor(proc.nfe.emit.xNome);
  pdf.setSubject('Documento Auxiliar da Nota Fiscal Eletrônica — modelo 55, modo paisagem');
  const fontes = await incorporaFontes(pdf);
  const situacao = detectaSituacao(proc, opcoes);
  const itens = preparaItens(proc, fontes.regular);
  const informacoesTexto = informacoesAdicionais(proc, opcoes);
  const paginas = planejaPaginas(itens, informacoesTexto, fontes.regular);
  const informacoesPorPagina = paginas.map((_, indice) => {
    const linhas = quebrarLinhas(
      informacoesTexto,
      fontes.regular,
      FONTE_MINIMA.informacoesComplementares,
      DADOS_ADICIONAIS_PAISAGEM.informacoes.largura * PT_POR_CM - 0.2,
    );
    return linhas.slice(indice * 16, (indice + 1) * 16);
  });

  for (const [indice, itensPagina] of paginas.entries()) {
    const pagina = pdf.addPage([PAGINA_PAISAGEM.larguraCm * PT_POR_CM, ALTURA_PAGINA_PAISAGEM_PT]);
    desenhaMarcaDagua(pagina, situacao.marcas, fontes);
    if (indice === 0 && (opcoes.incluirCanhoto ?? true)) {
      desenhaCanhoto(pagina, proc, fontes, situacao);
    }
    await desenhaCabecalho(pagina, pdf, proc, opcoes, fontes, indice + 1, paginas.length, situacao);
    desenhaCorpo(pagina, proc, fontes, indice === 0);
    desenhaProdutos(pagina, itensPagina, fontes);
    desenhaRodape(pagina, proc, informacoesPorPagina[indice] ?? [], fontes);
  }
  return pdf.save();
}
