/** API pública dos renderizadores de documentos auxiliares. */
export { renderDanfe } from './danfe-retrato';
export type { OpcoesRenderDanfe } from './danfe-retrato';
export { renderDanfePaisagem } from './danfe-paisagem';
export { renderDanfeNfce } from './danfe-nfce';
export type { OpcoesRenderDanfeNfce } from './danfe-nfce';
export { toEscPos, colunasPapel, codificaPc860 } from './escppos';
export type { OpcoesEscPos } from './escppos';
export { renderEvento } from './evento';
export type { OpcoesRenderEvento } from './evento';
export { conteudoNfce, nomePagamento } from './nfce-conteudo';
export type { ConteudoNfce, LinhaItemNfce } from './nfce-conteudo';
export { FONTE_MINIMA, LAYOUT_RETRATO, PAGINA, PT_POR_CM, COLUNAS_PRODUTO } from './layout';
export type { Caixa, ColunaProduto } from './layout';
export {
  ALTURA_PAGINA_PAISAGEM_PT,
  LAYOUT_PAISAGEM,
  PAGINA_PAISAGEM,
  COLUNAS_PRODUTO_PAISAGEM,
} from './layout-paisagem';
export type { ColunaProdutoPaisagem } from './layout-paisagem';
