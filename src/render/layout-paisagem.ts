/**
 * Constantes de leiaute do DANFE paisagem (A4, folhas soltas).
 *
 * FONTE OFICIAL — Manual de Orientação do Contribuinte (MOC) 7.00, Anexo II
 * "Manual de Especificações Técnicas do DANFE e Código de Barras", seção 3.8.2
 * "Formulário A-4 em Modo Paisagem" (tabela "Tamanho dos Campos": colunas
 * Altura, Largura, Esquerda e Superior, em centímetros, origem no canto
 * superior esquerdo) e modelo Anexo III.04 "DANFE Tamanho A-4 em Modo
 * Paisagem, Folhas Soltas". As seções 3.7 (fontes mínimas), 3.1.1 (máscara da
 * chave), 3.1.7 (quadro de produtos), 3.9.2 (dados de contingência), 3.10.1
 * (marca d'água) e 3.10.2 (folha X/Y) continuam aplicáveis.
 *
 * Portal oficial SVRS (publicado em 16/12/2020):
 *   https://dfe-portal.svrs.rs.gov.br/NFe/Documentos
 * Download do Anexo II (consultado em 20/11/2026):
 *   https://dfe-portal.svrs.rs.gov.br/NFe/DownloadArquivoEstatico/?sistema=NFE&tipoArquivo=1&nomeArquivo=moc7-anexo-ii-manual-especificacoes-tecnicas-danfe-codigo-barras.pdf
 * Cópia no domínio federal (CONFAZ):
 *   https://www.confaz.fazenda.gov.br/legislacao/arquivo-manuais/moc7-anexo-ii-manual-especificacoes-tecnicas-danfe-codigo-barras.pdf
 *
 * O canhoto no modo paisagem é uma faixa vertical à esquerda: as alturas da
 * tabela (16,95 / 9,21 / 6,75 cm) são as dimensões verticais dos campos e as
 * larguras (1,02 / 1,05 cm) as horizontais. Os rótulos dos blocos também são
 * faixas verticais de 0,51 cm na abscissa 2,41 cm, por isso o texto é girado.
 *
 * A tabela normativa não dá a largura das colunas do quadro de produtos
 * (Obs. 4 apenas fixa a ordem). As larguras abaixo foram medidas no desenho
 * oficial do Anexo III.04 (rasterização a 4×, limites entre colunas lidos em
 * coordenadas de vetor da própria folha) e normalizadas para os 26,54 cm de
 * largura determinados na tabela de tamanhos — nenhuma posição foi inventada.
 */
import { PT_POR_CM, type Caixa } from './layout';

/** A4 paisagem (MOC §3.6.1: tamanho mínimo A-4; §3.8.2: modo paisagem). */
export const PAGINA_PAISAGEM = { larguraCm: 29.7, alturaCm: 21 } as const;

function caixa(x: number, y: number, largura: number, altura: number): Caixa {
  return { x, y, largura, altura };
}

/** Campos do canhoto (MOC §3.8.2, linhas "CANHOTO"). */
export const CANHOTO_PAISAGEM = {
  /** "NF-e / Nº 000.000.000 / SÉRIE 000" — 4,53 × 2,03 em (0,13 ; 0,47). */
  nfNumSerie: caixa(0.13, 0.47, 2.03, 4.53),
  /** "RECEBEMOS DE..." — 16,95 × 1,02 em (0,13 ; 5,00). */
  recebemos: caixa(0.13, 5.0, 1.02, 16.95),
  /** "IDENTIFICAÇÃO E ASSINATURA..." — 9,21 × 1,02 em (1,15 ; 5,00). */
  identificacaoAssinatura: caixa(1.15, 5.0, 1.02, 9.21),
  /** "DATA DE RECEBIMENTO" — 6,75 × 1,05 em (1,15 ; 14,21). */
  dataRecebimento: caixa(1.15, 14.21, 1.05, 6.75),
} as const;

/** Linha vertical de picote entre o canhoto e o restante da folha. */
export const LINHA_PICOTE_X_CM = 2.2;

/** Quadros do cabeçalho (MOC §3.8.2, "DADOS DA NF-e"). */
export const CABECALHO_PAISAGEM = {
  emitente: caixa(2.41, 0.47, 11.43, 3.1),
  danfe: caixa(13.84, 0.47, 3.05, 3.1),
  /** Variante Laser: 12,57 × 1,19 cm em (16,89 ; 0,47). */
  chaveBarras: caixa(16.89, 0.47, 12.57, 1.19),
  chaveTexto: caixa(16.89, 1.66, 12.57, 0.64),
  /** Código de barras adicional, exclusivo de contingência (Obs. 9). */
  dadosBarras: caixa(16.89, 2.38, 12.57, 1.19),
  dadosNfContingencia: caixa(16.89, 3.57, 12.57, 0.64),
  /** Quadros invisíveis dentro de "DANFE" (Obs. 6 e 7). */
  tipoOperacao: caixa(13.89, 1.8, 2.95, 0.72),
  numeroSerieFolha: caixa(13.89, 2.55, 2.95, 1.05),
  naturezaOperacao: caixa(2.92, 3.57, 13.97, 0.64),
  /** Campo 2 (MOC §3.9): PROTOCOLO DE AUTORIZAÇÃO DE USO. */
  protocolo: caixa(16.89, 3.57, 12.57, 0.64),
  ieEmitente: caixa(2.92, 4.21, 8.89, 0.64),
  ieStEmitente: caixa(11.81, 4.21, 8.89, 0.64),
  cnpjEmitente: caixa(20.7, 4.21, 8.76, 0.64),
} as const;

/** Rótulos verticais dos blocos (faixas de 0,51 cm em x = 2,41). */
export const TITULOS_PAISAGEM = {
  destinatario: caixa(2.41, 4.85, 0.51, 1.92),
  fatura: caixa(2.41, 6.77, 0.51, 0.64),
  calculoImposto: caixa(2.41, 7.41, 0.51, 1.28),
  transportador: caixa(2.41, 8.69, 0.51, 1.92),
  produtos: caixa(2.41, 10.61, 0.51, 6.67),
  issqn: caixa(2.41, 17.28, 0.51, 0.67),
  dadosAdicionais: caixa(2.41, 17.95, 0.51, 2.94),
} as const;

/** Quadro DESTINATÁRIO/REMETENTE (MOC §3.8.2). */
export const DESTINATARIO_PAISAGEM = {
  razaoSocial: caixa(2.92, 4.85, 16.38, 0.64),
  cnpj: caixa(19.3, 4.85, 5.84, 0.64),
  dataEmissao: caixa(25.14, 4.85, 4.32, 0.64),
  endereco: caixa(2.92, 5.49, 12.45, 0.64),
  bairro: caixa(15.37, 5.49, 5.84, 0.64),
  cep: caixa(21.21, 5.49, 3.94, 0.64),
  dataEntradaSaida: caixa(25.14, 5.49, 4.32, 0.64),
  municipio: caixa(2.92, 6.13, 10.03, 0.64),
  fone: caixa(12.95, 6.13, 5.08, 0.64),
  uf: caixa(18.03, 6.13, 1.27, 0.64),
  inscricaoEstadual: caixa(19.3, 6.13, 5.84, 0.64),
  horaEntradaSaida: caixa(25.14, 6.13, 4.32, 0.64),
} as const;

/** Quadro FATURA/DUPLICATAS (MOC §3.8.2, Obs. 1). */
export const FATURA_PAISAGEM = {
  conteudo: caixa(2.92, 6.77, 26.54, 0.64),
} as const;

/** Quadro CÁLCULO DO IMPOSTO (MOC §3.8.2). */
export const CALCULO_IMPOSTO_PAISAGEM = {
  baseIcms: caixa(2.92, 7.41, 5.33, 0.64),
  valorIcms: caixa(8.25, 7.41, 5.33, 0.64),
  baseIcmsSt: caixa(13.58, 7.41, 5.33, 0.64),
  valorIcmsSt: caixa(18.91, 7.41, 5.33, 0.64),
  valorProdutos: caixa(24.24, 7.41, 5.21, 0.64),
  valorFrete: caixa(2.92, 8.05, 4.32, 0.64),
  valorSeguro: caixa(7.24, 8.05, 4.32, 0.64),
  desconto: caixa(11.56, 8.05, 4.32, 0.64),
  outrasDespesas: caixa(15.88, 8.05, 4.32, 0.64),
  valorIpi: caixa(20.2, 8.05, 4.32, 0.64),
  valorTotal: caixa(24.52, 8.05, 4.95, 0.64),
} as const;

/** Quadro TRANSPORTADOR/VOLUMES TRANSPORTADOS (MOC §3.8.2, Obs. 8). */
export const TRANSPORTADOR_PAISAGEM = {
  razaoSocial: caixa(2.92, 8.69, 11.56, 0.64),
  fretePorConta: caixa(14.48, 8.69, 2.79, 0.64),
  codigoAntt: caixa(17.27, 8.69, 2.54, 0.64),
  placa: caixa(19.81, 8.69, 3.81, 0.64),
  uf: caixa(23.62, 8.69, 1.02, 0.64),
  cnpj: caixa(24.64, 8.69, 4.83, 0.64),
  endereco: caixa(2.92, 9.33, 11.56, 0.64),
  municipio: caixa(14.48, 9.33, 9.14, 0.64),
  uf2: caixa(23.62, 9.33, 1.02, 0.64),
  inscricaoEstadual: caixa(24.64, 9.33, 4.83, 0.64),
  quantidadeVolumes: caixa(2.92, 9.97, 3.56, 0.64),
  especie: caixa(6.48, 9.97, 3.81, 0.64),
  marca: caixa(10.29, 9.97, 4.19, 0.64),
  numeracao: caixa(14.48, 9.97, 5.08, 0.64),
  pesoBruto: caixa(19.56, 9.97, 5.08, 0.64),
  pesoLiquido: caixa(24.64, 9.97, 4.83, 0.64),
} as const;

/** Quadro DADOS DOS PRODUTOS/SERVIÇOS (MOC §3.8.2, quadro 26,54 × 6,67). */
export const PRODUTOS_PAISAGEM = {
  quadro: caixa(2.92, 10.61, 26.54, 6.67),
  /** Altura da faixa de cabeçalho das colunas (medida no Anexo III.04). */
  alturaCabecalhoCm: 0.55,
} as const;

export interface ColunaProdutoPaisagem {
  id: string;
  titulo: string;
  larguraCm: number;
  alinhamento: 'esquerda' | 'centro' | 'direita';
}

/**
 * Larguras brutas medidas no Anexo III.04, na ordem exigida pela MOC §3.8.2
 * (Obs. 4). Normalizadas abaixo para a largura normativa de 26,54 cm.
 */
const LARGURAS_MEDIDAS = [
  // NCM (índice 2) ampliado de 0,77 para 1,05 e DESCRIÇÃO reduzida na mesma
  // proporção: 8 dígitos a 6 pt não cabiam na largura medida do Anexo III.04.
  1.86, 6.28, 1.05, 0.74, 1.02, 1.01, 1.27, 2.03, 2.03, 1.78, 1.76, 1.41, 1.64, 1.27, 0.76, 0.85,
] as const;
const FATOR = PRODUTOS_PAISAGEM.quadro.largura / LARGURAS_MEDIDAS.reduce((a, b) => a + b, 0);

function coluna(
  id: string,
  titulo: string,
  indice: number,
  alinhamento: ColunaProdutoPaisagem['alinhamento'],
): ColunaProdutoPaisagem {
  return {
    id,
    titulo,
    larguraCm: Math.round((LARGURAS_MEDIDAS[indice] ?? 0) * FATOR * 10000) / 10000,
    alinhamento,
  };
}

/** Colunas do quadro de produtos na ordem do Anexo III.04. */
export const COLUNAS_PRODUTO_PAISAGEM: readonly ColunaProdutoPaisagem[] = [
  coluna('codigo', 'CÓDIGO', 0, 'esquerda'),
  coluna('descricao', 'DESCRIÇÃO DOS PRODUTOS/SERVIÇOS', 1, 'esquerda'),
  coluna('ncm', 'NCM/SH', 2, 'centro'),
  coluna('cst', 'CST', 3, 'centro'),
  coluna('cfop', 'CFOP', 4, 'centro'),
  coluna('unidade', 'UNID.', 5, 'centro'),
  coluna('quantidade', 'QUANT.', 6, 'direita'),
  coluna('valorUnitario', 'VALOR UNITÁRIO', 7, 'direita'),
  coluna('desconto', 'DESCONTO', 8, 'direita'),
  coluna('valorTotal', 'VALOR TOTAL', 9, 'direita'),
  coluna('baseIcms', 'B.CÁLC. ICMS', 10, 'direita'),
  coluna('baseIcmsSt', 'B.CÁLC. ICMS ST', 11, 'direita'),
  coluna('valorIcms', 'VALOR ICMS', 12, 'direita'),
  coluna('valorIcmsSt', 'VALOR ICMS ST', 13, 'direita'),
  coluna('valorIpi', 'VALOR IPI', 14, 'direita'),
  coluna('aliquotas', 'ALÍQUOTAS ICMS IPI', 15, 'centro'),
];

/** Quadro CÁLCULO DO ISSQN (MOC §3.8.2). */
export const ISSQN_PAISAGEM = {
  inscricaoMunicipal: caixa(2.92, 17.28, 6.6, 0.67),
  valorServicos: caixa(9.52, 17.28, 6.6, 0.67),
  baseCalculo: caixa(16.12, 17.28, 6.6, 0.67),
  valorIssqn: caixa(22.72, 17.28, 6.73, 0.67),
} as const;

/** Quadro DADOS ADICIONAIS (MOC §3.8.2). */
export const DADOS_ADICIONAIS_PAISAGEM = {
  informacoes: caixa(2.92, 17.95, 19.05, 2.94),
  reservadoFisco: caixa(21.97, 17.95, 7.49, 2.94),
} as const;

/** Agregação das caixas do modelo paisagem (auditoria e testes). */
export const LAYOUT_PAISAGEM = {
  pagina: PAGINA_PAISAGEM,
  canhoto: CANHOTO_PAISAGEM,
  cabecalho: CABECALHO_PAISAGEM,
  titulos: TITULOS_PAISAGEM,
  destinatario: DESTINATARIO_PAISAGEM,
  fatura: FATURA_PAISAGEM,
  calculoImposto: CALCULO_IMPOSTO_PAISAGEM,
  transportador: TRANSPORTADOR_PAISAGEM,
  produtos: PRODUTOS_PAISAGEM,
  issqn: ISSQN_PAISAGEM,
  dadosAdicionais: DADOS_ADICIONAIS_PAISAGEM,
} as const;

/** Altura da página em pontos — helpers de texto usam coordenadas do topo. */
export const ALTURA_PAGINA_PAISAGEM_PT = PAGINA_PAISAGEM.alturaCm * PT_POR_CM;
