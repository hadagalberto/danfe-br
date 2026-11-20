# Review independente (2026-11-20) — correções

Escopo: os 8 achados do revisor independente. Cada item ganhou **primeiro** um
teste de regressão com valor esperado derivado à mão (MOC Anexo II, XSD,
literais do fixture ou medição independente dos pixels); os 17 testes falharam
antes das correções e passaram depois. Nenhum teste existente foi deletado ou
pulado. Suíte final: `npm run verify` — typecheck, lint (`--max-warnings 0`),
`format:check`, build ESM+CJS+DTS, **23 arquivos / 331 testes, 0 falhas**.

Fonte oficial consultada: MOC NF-e 7.00 — Anexo II (CONFAZ,
<https://www.confaz.fazenda.gov.br/legislacao/arquivo-manuais/moc7-anexo-ii-manual-especificacoes-tecnicas-danfe-codigo-barras.pdf>),
§§3.7.6, 3.8.1, 3.8.2, 3.9.1/3.9.2; Anexo I E01 (grupo `dest` obrigatório no
modelo 55, opcional no 65); ISO/IEC 15417 (zona de silêncio ≥ 10X).

| #   | Achado                                                     | Teste de regressão (`tests/review-regressions.test.ts`)                                                                                                                                        | Correção (causa raiz)                                                                                                                                                                                                                                                                        | Status |
| --- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 1   | CRITICAL — faltava PROTOCOLO DE AUTORIZAÇÃO DE USO         | `retrato imprime o rótulo e nProt + dhRecbto ao lado de natureza da operação`; `paisagem imprime ... DADOS DA NF-e`; `retrato e paisagem trazem o texto de consulta de autenticidade`          | Novos campos `CABECALHO.protocolo` / `CABECALHO_PAISAGEM.protocolo` nas posições da tabela MOC §3.8.1/§3.8.2; `campo()` imprime rótulo + `nProt` + `data/hora` de `dhRecbto`. Texto de autenticidade em duas linhas no Campo 1 (MOC §3.9.1) quando não há contingência.                      | ✅     |
| 2   | MAJOR — emitente mostrava `xFant ?? xNome`                 | `retrato/paisagem/NFC-e mostra(m) a razão social e o fantasia apenas como linha extra`                                                                                                         | `xNome` (razão social) passou a ser a linha principal nos 3 renderizadores; `xFant`, quando presente, virou linha extra `Fantasia: …` no bloco de endereço/cabeçalho (MOC §3.7.6).                                                                                                           | ✅     |
| 3   | MAJOR — CST perdia o dígito de origem                      | `cstItem concatena origem e CST/CSOSN segundo tabela derivada à mão`; `renderizador usa a origem do ICMS na coluna CST`                                                                        | `cstItem()` agora imprime `orig + cst` (ex.: `000`) ou `orig + csosn` (ex.: `0102`), com `orig ?? 0`; retrato e paisagem usam a mesma função.                                                                                                                                                | ✅     |
| 4   | MINOR — zona de silêncio do Code 128 ≈ 9,5X                | `retrato/paisagem: silêncio ≥ 10X e ZXing decodifica o recorte do PDF`                                                                                                                         | `desenharCode128()` reserva a espessura da moldura (0,6 pt) + folga antes de calcular `moduloCm`/`margemCm`; a zona útil passa a ≥ 10X. Teste rasteriza o PDF com `transform` do pdf.js, mede X e o silêncio em pixels e decodifica com `@zxing/library`. Antes: 8,88X/9,26X; depois: ≥ 10X. | ✅     |
| 5   | MINOR — entidades de DTD inline expandidas                 | `parseNFe não expande entidade definida em DTD interno`                                                                                                                                        | `parseXml()` rejeita `<!DOCTYPE` (inclusive com espaços) antes do parser, com `ParseError` contextual; mantém `processEntities` para entidades XML legítimas (`&amp;` etc.).                                                                                                                 | ✅     |
| 6   | MINOR — namespaces com prefixo rejeitados                  | `parseNFe aceita <nfe:nfeProc> com prefixo declarado`                                                                                                                                          | `XMLParser` com `removeNSPrefix: true`; `<nfe:nfeProc xmlns:nfe=…>` passa a ser reconhecido sem alterar documentos com namespace padrão.                                                                                                                                                     | ✅     |
| 7   | MINOR — NCM quebra, CEP/fone crus, chave encosta na borda  | `NCM de 8 dígitos não quebra ...`; `CEP e telefone são formatados pt-BR ...`; `paginação derivada ... (95 itens → 8 folhas)`; `segunda linha da chave não encosta na borda inferior do quadro` | Colunas NCM ampliadas (retrato 0,8→1,1 cm; paisagem 0,77→1,05, compensadas na descrição) para 8 dígitos a 6 pt; novos formatadores `cep()` (`00000-000`) e `fone()` (`(11) 3333-4444`) aplicados a emitente/destinatário/NFC-e/ESC-POS; linhas da chave repositionadas com 0,06 cm de folga. | ✅     |
| 8   | MINOR — modelo 55 sem `dest` ok; `pICMS` com vírgula limpo | `modelo 55 sem destinatário é erro; modelo 65 anônimo continua válido`; `pICMS com vírgula decimal gera ParseError com o campo identificado`                                                   | `validaDocumentos()` passa a receber `modelo` e emite `DESTINATARIO_OBRIGATORIO` para 55 (Anexo I E01), preservando NFC-e anônima; `num()` lança `ParseError` com o nome do campo para texto decimal inválido em vez de devolver `undefined` (logo `?? 0`).                                  | ✅     |

## Asserções existentes corrigidas (com justificativa)

- `tests/danfe-retrato.test.ts` — CEP esperado `80064391` → `80064-391`
  (item 7; o valor antigo codificava o CEP sem formatação).
- `tests/escppos.test.ts` — fluxo hexadecimal esperado atualizado apenas nos
  segmentos do cabeçalho: razão social, linha `Fantasia:` e CEP `13010-001`
  (itens 2 e 7).
- `tests/hardening.test.ts` — `nfe-muitos-itens-95.xml`: 10 → 8 folhas.
  Derivação: área útil 6,22 cm ÷ altura mínima 0,5 cm/item = 12 itens/folha;
  `ceil(95/12)=8`. As 10 folhas anteriores vinham da quebra indevida do NCM
  (item 7). Nenhum `skip`, `todo` ou afrouxamento de asserção.
- Oracle do item 3 substituído por tabela escrita à mão (origem 0/1 × CST/CSOSN);
  o oracle do item 4 é a própria imagem rasterizada, medida em pixels, não um
  valor produzido pelo renderizador.

## Imagens douradas

`npm run golden` regenerou os 11 PNGs em `tests/golden/`. Todos foram **lidos e
conferidos** visualmente: razão social + fantasia, protocolo e autenticidade,
CEP/fone formatados, NCM em uma linha, CST `000`, barraCode 128 com folga,
marcas d'água, Code 128 e páginas de continuação. Nenhuma diferença permanece após
`npm run verify`.

## Comandos finais

```text
npm run verify
  typecheck ........ OK
  lint (--max-warnings 0) ... OK
  format:check ..... OK
  build ESM+CJS+DTS  OK
  test ............. 23 arquivos, 331 testes, 0 falhas
npm run golden → 11 PNGs regenerados, git diff conferido
```
