/**
 * Conteúdo das divisões do DANFE NFC-e, compartilhado pelo PDF e pelo
 * ESC/POS. Textos, ordem das divisões e regras de preenchimento segundo o
 * "Manual de Padrões Técnicos do DANFE-NFC-e e QR Code" (versão 5.1,
 * §§3.1.1–3.1.9) e o "Manual de Especificações Técnicas do DANFE NFC-e e
 * QR Code" (versão 5.0), ambos publicados no portal oficial SVRS:
 *   https://dfe-portal.svrs.rs.gov.br/Nfce/Documentos
 *   https://dfe-portal.svrs.rs.gov.br/NFCE/DownloadArquivoEstatico/?sistema=NFCE&tipoArquivo=1&nomeArquivo=Manual%20de%20Padr%C3%B5es%20T%C3%A9cnicos%20do%20DANFE-NFC-e%20e%20QR%20Code%20-%20Vers%C3%A3o%205.1.pdf
 * A chave é impressa em 11 blocos de 4 dígitos (§3.1.4) e o QR Code é gerado
 * exclusivamente a partir da tag `qrCode` do XML (§3.1.5/§4.2).
 */
import type { NFe, NFeProc } from '../model/nfe';
import { cnpjCpf, data, hora, numero } from './formatacao';

/** Tabela de meios de pagamento (IT 2024.002 / tabela oficial de tPag). */
const MEIOS_PAGAMENTO: Record<string, string> = {
  '01': 'Dinheiro',
  '02': 'Cheque',
  '03': 'Cartão de Crédito',
  '04': 'Cartão de Débito',
  '05': 'Crédito Loja',
  '10': 'Vale Alimentação',
  '11': 'Vale Refeição',
  '12': 'Vale Presente',
  '13': 'Vale Combustível',
  '14': 'Duplicata Mercantil',
  '15': 'Boleto Bancário',
  '16': 'Depósito Bancário',
  '17': 'Pagamento Instantâneo (PIX)',
  '18': 'Transferência Bancária',
  '19': 'Programa de Benefícios',
  '20': 'Pagamento em Criptoativos',
  '90': 'Sem Pagamento',
  '99': 'Outros',
};

export function nomePagamento(codigo: string, xPag?: string): string {
  return xPag ?? MEIOS_PAGAMENTO[codigo] ?? codigo;
}

export interface LinhaItemNfce {
  codigo: string;
  descricao: string;
  /** "2,0000 UN x 4,5000 = 9,00" — linha compacta exigida pela divisão II. */
  detalhe: string;
}

export interface ConteudoNfce {
  /** Divisão I. */
  cabecalho: string[];
  /** Divisão II (vazia quando `detalharItens` for falso). */
  itens: LinhaItemNfce[];
  /** Divisão III. */
  totais: string[];
  /** Divisão IV. */
  consultaChave: string;
  chave: string;
  /** Divisão V — conteúdo literal da tag `qrCode` do XML. */
  qrCode: string;
  /** Divisão VI. */
  consumidor: string[];
  /** Divisão VII. */
  identificacao: string[];
  /** Divisão VIII. */
  mensagensFiscais: string[];
  /** Divisão IX. */
  mensagemContribuinte: string;
  homologacao: boolean;
  contingencia: boolean;
}

function normaliza(documento: NFeProc | NFe): NFeProc {
  if ('nfe' in documento) return documento;
  return { versao: documento.versao, nfe: documento };
}

/**
 * Extrai o conteúdo das divisões do DANFE NFC-e.
 *
 * @throws {Error} documento não é modelo 65 ou não contém `infNFeSupl/qrCode`.
 */
export function conteudoNfce(documento: NFeProc | NFe, detalharItens = true): ConteudoNfce {
  const proc = normaliza(documento);
  const nfe = proc.nfe;
  if (nfe.ide.mod !== 65) {
    throw new Error(`DANFE NFC-e exige modelo 65; recebido modelo ${String(nfe.ide.mod)}.`);
  }
  const supl = proc.infNFeSupl;
  if (!supl?.qrCode) {
    throw new Error('NFC-e sem infNFeSupl/qrCode: não é possível gerar o QR Code (§3.1.5).');
  }
  const qrCode = supl.qrCode;
  const ender = nfe.emit.enderEmit;
  const cabecalho = [
    `${cnpjCpf(nfe.emit.cnpj ?? nfe.emit.cpf)}`,
    nfe.emit.xFant ?? nfe.emit.xNome,
    `${ender.xLgr}, ${ender.nro}${ender.xCpl ? `, ${ender.xCpl}` : ''}`,
    `${ender.xBairro} - ${ender.xMun}/${ender.uf} - CEP ${ender.cep ?? ''}`,
    'Documento Auxiliar da Nota Fiscal de Consumidor Eletrônica',
  ];

  const itens: LinhaItemNfce[] = detalharItens
    ? nfe.det.map((det) => ({
        codigo: det.prod.cProd,
        descricao: det.prod.xProd,
        detalhe: `${numero(det.prod.qCom, 4)} ${det.prod.uCom} x ${numero(
          det.prod.vUnCom,
          4,
        )} = ${numero(det.prod.vProd)}`,
      }))
    : [];

  const tot = nfe.total.icmsTot;
  const totais = [`Qtde. Total de Itens: ${nfe.det.length}`, `Valor Total R$ ${numero(tot.vProd)}`];
  const acrEsc = tot.vFrete + tot.vSeg + tot.vOutro;
  if (acrEsc !== 0) totais.push(`Acréscimos R$ ${numero(acrEsc)}`);
  if (tot.vDesc !== 0) totais.push(`Desconto R$ ${numero(tot.vDesc)}`);
  totais.push(`Valor a Pagar R$ ${numero(tot.vNF)}`);
  for (const detPag of nfe.pag.detPag) {
    totais.push(`FORMA PAGAMENTO: ${nomePagamento(String(detPag.tPag), detPag.xPag)}`);
    totais.push(`Valor Pago R$ ${numero(detPag.vPag)}`);
  }
  if (nfe.pag.vTroco !== undefined) totais.push(`Troco R$ ${numero(nfe.pag.vTroco)}`);

  const urlChave = supl.urlChave;
  const consultaChave = `Consulte pela Chave de Acesso em ${urlChave}`;

  const consumidor: string[] = [];
  const dest = nfe.dest;
  if (dest?.cnpj) consumidor.push(`CONSUMIDOR CNPJ: ${cnpjCpf(dest.cnpj)}`);
  else if (dest?.cpf) consumidor.push(`CONSUMIDOR CPF: ${cnpjCpf(dest.cpf)}`);
  else if (dest?.idEstrangeiro)
    consumidor.push(`CONSUMIDOR Id. Estrangeiro: ${dest.idEstrangeiro}`);
  else consumidor.push('CONSUMIDOR NÃO IDENTIFICADO');
  if (dest?.xNome) consumidor.push(dest.xNome);
  if (dest?.enderDest) {
    const e = dest.enderDest;
    consumidor.push(`${e.xLgr}, ${e.nro}${e.xCpl ? `, ${e.xCpl}` : ''}`);
    consumidor.push(`${e.xBairro} - ${e.xMun}/${e.uf} - CEP ${e.cep ?? ''}`);
  }

  const homologacao = nfe.ide.tpAmb === 2;
  const contingencia = nfe.ide.tpEmis !== 1;
  const identificacao = [
    `NFC-e nº ${numero(nfe.ide.nNF, 0)} Série ${nfe.ide.serie}`,
    `Data/Hora Emissão: ${data(nfe.ide.dhEmi)} ${hora(nfe.ide.dhEmi)}`,
  ];
  if (!contingencia && proc.protNFe?.nProt) {
    identificacao.push(
      `Protocolo de autorização: ${proc.protNFe.nProt} ${data(proc.protNFe.dhRecbto)} ${hora(
        proc.protNFe.dhRecbto,
      )}`,
    );
  }
  const mensagensFiscais: string[] = [];
  if (homologacao) {
    mensagensFiscais.push('EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO – SEM VALOR FISCAL');
  }
  // A contingência é impressa em dois locais pelo renderizador (§3.1.8),
  // portanto não entra nesta lista para não duplicar o texto.
  if (nfe.infAdic?.infAdFisco) mensagensFiscais.push(nfe.infAdic.infAdFisco);

  return {
    cabecalho,
    itens,
    totais,
    consultaChave,
    chave: nfe.chave,
    qrCode,
    consumidor,
    identificacao,
    mensagensFiscais,
    mensagemContribuinte: nfe.infAdic?.infCpl ?? '',
    homologacao,
    contingencia,
  };
}
