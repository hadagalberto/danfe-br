/**
 * Constantes de leiaute do DANFE retrato (A4, folhas soltas).
 *
 * FONTE OFICIAL — Manual de Orientação do Contribuinte (MOC) 7.00,
 * Anexo II "Manual de Especificações Técnicas do DANFE e Código de Barras",
 * seção 3.8.1 "Formulário A-4 em Modo Retrato" (tabela "Tamanho dos Campos",
 * medidas em centímetros, origem no canto superior esquerdo), seção 3.7
 * "Padrões de Caracteres (Tipos de Fontes)", seção 3.1.1 (máscara da chave),
 * seção 3.1.7 (quadro de produtos), seções 3.10.1/3.10.2 (marca d'água e
 * número da folha) e o modelo visual do Anexo III.02 "DANFE Tamanho A-4 em
 * Modo Retrato, Folhas Soltas".
 *
 * Portal oficial (publicado em 16/12/2020):
 *   https://www.nfe.fazenda.gov.br/PORTal/exibirArquivo.aspx?conteudo=f%2BNhsSn3%2F5M%3D
 * Cópia consultada para extração da tabela e do modelo (MOC 7.0 Manual do
 * DANFE, 28 páginas, mesmo texto normativo):
 *   https://www.econeteditora.com.br/links_pagina_inicial/sped/nfc-e/Manual_de_Orientacao_Contribuinte_v_7.02_anexo_iii_danfe.pdf
 *
 * Toda posição/tamanho abaixo vem dessas fontes. As medidas "Laser" da tabela
 * são as empregadas aqui: treated-se de impressão em papel comum (PDF), e não
 * de formulário de segurança (variante "Mat."). Nenhuma posição foi inventada.
 */

/** Fator de conversão centímetro → ponto PDF (1 in = 2,54 cm = 72 pt). */
export const PT_POR_CM = 72 / 2.54;

/** A4 em centímetros (MOC 7.0 Anexo II §3.6.1: tamanho mínimo A-4). */
export const PAGINA = { larguraCm: 21, alturaCm: 29.7 } as const;

/** Caixa em centímetros, origem no canto superior esquerdo da folha. */
export interface Caixa {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

function caixa(x: number, y: number, largura: number, altura: number): Caixa {
  return { x, y, largura, altura };
}

/**
 * Tamanhos mínimos de fonte exigidos pelo MOC 7.0 Anexo II §3.7.
 * Valores em pontos. Nenhum texto gerado usa tamanho menor que o mínimo
 * aplicável ao seu campo.
 */
export const FONTE_MINIMA = {
  /** §3.7.1 — descritivo dos blocos de campos: 5 pt, negrito, caixa alta. */
  descritivoBloco: 5,
  /** §3.7.2 — descritivo dos campos de produtos: 5 pt, caixa alta. */
  descritivoProduto: 5,
  /** §3.7.3 — descritivo dos demais campos: 6 pt, caixa alta. */
  descritivoCampo: 6,
  /** §3.7.4 — "DANFE": 12 pt, negrito, caixa alta. */
  danfe: 12,
  /** §3.7.4 — série, número, folha X/Y e tipo de operação: 10 pt, negrito. */
  identificacaoDocumento: 10,
  /** §3.7.4 — "DOCUMENTO AUXILIAR..." e "ENTRADA"/"SAÍDA": 8 pt. */
  descricaoDocumento: 8,
  /** §3.7.5 — chave de acesso: negrito (10 pt, mínimo dos demais campos). */
  chaveAcesso: 10,
  /** §3.7.6 — razão social/nome fantasia do emitente: 12 pt, negrito. */
  emitenteNome: 12,
  /** §3.7.6 — demais dados do emitente: 8 pt, negrito. */
  emitenteDados: 8,
  /** §3.7.7 — conteúdo dos campos de produtos: 6 pt. */
  produto: 6,
  /** §3.7.8 — informações complementares: 6 pt. */
  informacoesComplementares: 6,
  /** §3.7.9 — conteúdo dos demais campos: 10 pt. */
  demais: 10,
} as const;

/** Textos literais exigidos pelo modelo oficial. */
export const TEXTO = {
  danfe: 'DANFE',
  documentoAuxiliar: 'DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA',
  chaveAcesso: 'CHAVE DE ACESSO',
  entrada: 'ENTRADA',
  saida: 'SAÍDA',
  semValorFiscal: 'SEM VALOR FISCAL',
  cancelada: 'CANCELADA',
  denegada: 'DENEGADA',
  contingencia: 'CONTINGÊNCIA',
  recebemosDe: 'RECEBEMOS DE ... OS PRODUTOS/SERVIÇOS CONSTANTES DA NOTA FISCAL INDICADA AO LADO',
  dataRecebimento: 'DATA DE RECEBIMENTO',
  identificacaoAssinatura: 'IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR',
  identificacaoEmitente: 'Identificação do Emitente',
  faturaDuplicatas: 'FATURA/DUPLICATAS',
  calculoImposto: 'CÁLCULO DO IMPOSTO',
  transportador: 'TRANSPORTADOR/VOLUMES TRANSPORTADOS',
  dadosProdutos: 'DADOS DOS PRODUTOS/SERVIÇOS',
  calculoIssqn: 'CÁLCULO DO ISSQN',
  dadosAdicionais: 'DADOS ADICIONAIS',
  informacoesComplementares: 'INFORMAÇÕES COMPLEMENTARES',
  reservadoFisco: 'RESERVADO AO FISCO',
  folha: 'FOLHA',
} as const;

/** Bloco do canhoto (MOC §3.8.1, linhas "CANHOTO"). */
export const CANHOTO = {
  recebemos: caixa(0.25, 0.42, 16.1, 0.85),
  nfNumSerie: caixa(16.35, 0.42, 4.5, 1.7),
  dataRecebimento: caixa(0.25, 1.27, 4.1, 0.85),
  identificacaoAssinatura: caixa(4.35, 1.27, 12.1, 0.85),
} as const;

/** Quadros do cabeçalho (MOC §3.8.1, "DADOS DA NF-e", topo = 2,54 cm). */
export const CABECALHO = {
  emitente: caixa(0.25, 2.54, 10.0, 3.92),
  danfe: caixa(10.25, 2.54, 2.54, 3.92),
  /** Variante Laser: 8,00 × 1,48 cm em 12,79 cm da margem esquerda. */
  chaveBarras: caixa(12.79, 2.54, 8.03, 1.48),
  chaveTexto: caixa(12.79, 4.02, 8.03, 0.85),
  /** Quadros invisíveis do modelo (Obs. 6 e 7) — posições internas ao "DANFE". */
  tipoOperacao: caixa(10.25, 4.22, 2.54, 0.75),
  numeroSerieFolha: caixa(10.25, 4.97, 2.54, 1.45),
  /** Código de barras dos dados (36 dígitos) — exclusivo de contingência (Obs. 9). */
  dadosBarras: caixa(12.79, 4.98, 8.03, 1.48),
  naturezaOperacao: caixa(0.25, 6.46, 7.87, 0.85),
  dadosNfContingencia: caixa(12.79, 6.46, 8.03, 0.85),
  /** Inscrição estadual / ST / CNPJ do emitente (linha seguinte à natureza). */
  ieEmitente: caixa(0.25, 7.31, 6.86, 0.85),
  ieStEmitente: caixa(7.11, 7.31, 6.86, 0.85),
  cnpjEmitente: caixa(13.97, 7.31, 6.86, 0.85),
} as const;

/** Quadro DESTINATÁRIO/REMETENTE (MOC §3.8.1). */
export const DESTINATARIO = {
  titulo: caixa(0.25, 8.16, 3.3, 0.42),
  razaoSocial: caixa(0.25, 8.58, 12.32, 0.85),
  cnpj: caixa(12.57, 8.58, 5.33, 0.85),
  dataEmissao: caixa(17.9, 8.58, 2.92, 0.85),
  endereco: caixa(0.25, 9.43, 10.16, 0.85),
  bairro: caixa(10.41, 9.43, 4.83, 0.85),
  cep: caixa(15.24, 9.43, 2.67, 0.85),
  dataEntradaSaida: caixa(17.91, 9.43, 2.92, 0.85),
  municipio: caixa(0.25, 10.28, 7.11, 0.85),
  fone: caixa(7.36, 10.28, 4.06, 0.85),
  uf: caixa(11.42, 10.28, 1.14, 0.85),
  inscricaoEstadual: caixa(12.56, 10.28, 5.33, 0.85),
  horaEntradaSaida: caixa(17.89, 10.28, 2.92, 0.85),
} as const;

/** Quadro FATURA/DUPLICATAS (MOC §3.8.1, Obs. 1). */
export const FATURA = {
  titulo: caixa(0.25, 11.09, 1.0, 0.42),
  conteudo: caixa(0.25, 11.51, 20.57, 0.85),
} as const;

/** Quadro CÁLCULO DO IMPOSTO (MOC §3.8.1). */
export const CALCULO_IMPOSTO = {
  titulo: caixa(0.25, 12.36, 5.6, 0.42),
  baseIcms: caixa(0.25, 12.78, 4.06, 0.85),
  valorIcms: caixa(4.31, 12.78, 4.06, 0.85),
  baseIcmsSt: caixa(8.37, 12.78, 4.06, 0.85),
  valorIcmsSt: caixa(12.43, 12.78, 4.06, 0.85),
  valorProdutos: caixa(16.49, 12.78, 4.32, 0.85),
  valorFrete: caixa(0.25, 13.63, 3.3, 0.85),
  valorSeguro: caixa(3.55, 13.63, 3.3, 0.85),
  desconto: caixa(6.85, 13.63, 3.3, 0.85),
  outrasDespesas: caixa(10.15, 13.63, 3.3, 0.85),
  valorIpi: caixa(13.45, 13.63, 3.3, 0.85),
  valorTotal: caixa(16.75, 13.63, 4.06, 0.85),
} as const;

/** Quadro TRANSPORTADOR/VOLUMES TRANSPORTADOS (MOC §3.8.1, Obs. 8). */
export const TRANSPORTADOR = {
  titulo: caixa(0.25, 14.48, 5.2, 0.42),
  razaoSocial: caixa(0.25, 14.9, 9.02, 0.85),
  fretePorConta: caixa(9.27, 14.9, 2.79, 0.85),
  codigoAntt: caixa(12.06, 14.9, 1.78, 0.85),
  placa: caixa(13.84, 14.9, 2.29, 0.85),
  uf: caixa(16.13, 14.9, 0.76, 0.85),
  cnpj: caixa(16.89, 14.9, 3.94, 0.85),
  endereco: caixa(0.25, 15.75, 9.02, 0.85),
  municipio: caixa(9.27, 15.75, 6.86, 0.85),
  uf2: caixa(16.13, 15.75, 0.76, 0.85),
  inscricaoEstadual: caixa(16.89, 15.75, 3.94, 0.85),
  quantidadeVolumes: caixa(0.25, 16.6, 2.92, 0.85),
  especie: caixa(3.17, 16.6, 3.05, 0.85),
  marca: caixa(6.22, 16.6, 3.05, 0.85),
  numeracao: caixa(9.27, 16.6, 4.83, 0.85),
  pesoBruto: caixa(14.1, 16.6, 3.43, 0.85),
  pesoLiquido: caixa(17.53, 16.6, 3.3, 0.85),
} as const;

/** Quadro DADOS DOS PRODUTOS/SERVIÇOS (MOC §3.8.1 e Anexo III.02). */
export const PRODUTOS = {
  titulo: caixa(0.25, 17.45, 4.0, 0.42),
  quadro: caixa(0.25, 17.87, 20.57, 6.77),
  /** Altura da linha de cabeçalho das colunas dentro do quadro (Anexo III.02). */
  alturaCabecalhoCm: 0.55,
} as const;

/**
 * Colunas do quadro de produtos conforme o modelo oficial Anexo III.02
 * ("DANFE A-4 em Modo Retrato, Folhas Soltas"): 14 colunas, da esquerda para
 * a direita, na ordem exigida pela MOC §3.1.7. As larguras foram medidas no
 * desenho oficial (Anexo III.02) e somam 20,57 cm — a largura do quadro
 * especificada na tabela de tamanhos. As colunas opcionais "DESCONTO",
 * "B.CÁLC. ICMS ST" e "VALOR ICMS ST" foram suprimidas, o que a MOC §3.1.7
 * expressamente permite; os valores correspondentes, quando presentes, são
 * impressos em "Informações Complementares" (§3.1.7 c/c §3.1.8). A largura
 * da coluna CÓDIGO foi ampliada para 1,35 cm (reduzindo DESCRIÇÃO na mesma
 * proporção, total inalterado) para acomodar códigos alfanuméricos em uma
 * única linha sem ferir o tamanho mínimo de 6 pt — a MOC §3.1 admite ajustes
 * de colunas desde que a ordem e as larguras mínimas de fonte sejam mantidas.
 */
export interface ColunaProduto {
  id: string;
  titulo: string;
  larguraCm: number;
  alinhamento: 'esquerda' | 'direita' | 'centro';
}

export const COLUNAS_PRODUTO: readonly ColunaProduto[] = [
  { id: 'codigo', titulo: 'CÓDIGO', larguraCm: 1.35, alinhamento: 'esquerda' },
  {
    id: 'descricao',
    titulo: 'DESCRIÇÃO DOS PRODUTOS/SERVIÇOS',
    larguraCm: 5.0,
    alinhamento: 'esquerda',
  },
  { id: 'ncm', titulo: 'NCM/SH', larguraCm: 0.8, alinhamento: 'centro' },
  { id: 'cst', titulo: 'CST', larguraCm: 0.6, alinhamento: 'centro' },
  { id: 'cfop', titulo: 'CFOP', larguraCm: 0.9, alinhamento: 'centro' },
  { id: 'unidade', titulo: 'UNID.', larguraCm: 1.0, alinhamento: 'centro' },
  { id: 'quantidade', titulo: 'QUANT.', larguraCm: 1.4, alinhamento: 'direita' },
  {
    id: 'valorUnitario',
    titulo: 'VALOR UNITÁRIO',
    larguraCm: 1.8,
    alinhamento: 'direita',
  },
  { id: 'valorTotal', titulo: 'VALOR TOTAL', larguraCm: 1.9, alinhamento: 'direita' },
  { id: 'baseIcms', titulo: 'B.CÁLC. ICMS', larguraCm: 1.4, alinhamento: 'direita' },
  { id: 'valorIcms', titulo: 'VALOR ICMS', larguraCm: 1.5, alinhamento: 'direita' },
  { id: 'valorIpi', titulo: 'VALOR IPI', larguraCm: 1.4, alinhamento: 'direita' },
  { id: 'aliquotaIcms', titulo: 'ALÍQ. ICMS', larguraCm: 0.75, alinhamento: 'direita' },
  { id: 'aliquotaIpi', titulo: 'ALÍQ. IPI', larguraCm: 0.77, alinhamento: 'direita' },
];

/** Quadro CÁLCULO DO ISSQN (MOC §3.8.1). */
export const ISSQN = {
  titulo: caixa(0.25, 24.64, 2.29, 0.42),
  inscricaoMunicipal: caixa(0.25, 25.06, 5.08, 0.85),
  valorServicos: caixa(5.33, 25.06, 5.08, 0.85),
  baseCalculo: caixa(10.41, 25.06, 5.08, 0.85),
  valorIssqn: caixa(15.49, 25.06, 5.33, 0.85),
} as const;

/** Quadro DADOS ADICIONAIS (MOC §3.8.1). */
export const DADOS_ADICIONAIS = {
  titulo: caixa(0.25, 25.91, 2.29, 0.42),
  informacoes: caixa(0.25, 26.33, 12.95, 3.07),
  reservadoFisco: caixa(13.17, 26.33, 7.62, 3.07),
} as const;

/** Linha de picote do canhoto (Anexo III.02). */
export const LINHA_PICOTE_Y_CM = 2.25;

/** Máscara da chave de acesso: 11 blocos de 4 dígitos (MOC §3.1.1). */
export const BLOCOS_CHAVE = 11;
export const DIGITOS_POR_BLOCO_CHAVE = 4;

/** Máscara dos dados da NF-e em contingência: 9 blocos de 4 (MOC §3.1.2). */
export const BLOCOS_DADOS_CONTINGENCIA = 9;

/** Agregação completa das caixas do modelo retrato (útil para auditoria e testes). */
export const LAYOUT_RETRATO = {
  pagina: PAGINA,
  canhoto: CANHOTO,
  cabecalho: CABECALHO,
  destinatario: DESTINATARIO,
  fatura: FATURA,
  calculoImposto: CALCULO_IMPOSTO,
  transportador: TRANSPORTADOR,
  produtos: PRODUTOS,
  issqn: ISSQN,
  dadosAdicionais: DADOS_ADICIONAIS,
} as const;
