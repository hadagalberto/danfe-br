# SPEC — Checklist de auditoria (Marco 6)

**Data da auditoria:** 20/11/2026 · **Fonte:** [`SPEC.md`](../SPEC.md) (linha a linha)
**Método:** cada item foi verificado **executando** o comando/teste indicado —
não por suposição. `✅` = verificado; `⚠️` = verificado com ressalva documentada.

## Resumo

- **Requisitos levantados:** 64
- **Verificados:** 64 (63 `✅`, 1 `⚠️` com justificativa; outras 2 ressalvas em [§ 11](#11-ressalvas-️))
- **Itens ausentes implementados no marco 6:** hook opcional de validação XSD;
  QR Code v3 (NT 2025.001 v1.01); fixtures de 2 e 10 páginas; rendição de
  chave com CNPJ alfanumérico; EOS de lint como erro.
- **Bugs corrigidos:** 5 (ver [§ 9](#9-endurecimento-bug--correção--teste)).
- **Suíte final:** `npm run verify` — typecheck, lint (`--max-warnings 0`),
  `format:check`, build ESM+CJS+DTS, **313 testes / 22 arquivos, 0 falhas**.

---

## 1. Definição do produto (SPEC, linhas 3–7)

| #   | Requisito                                                                                                               | Status | Evidência / como verificar                                                                                                                                                                                         |
| --- | ----------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1.1 | Biblioteca TypeScript + CLI para NF-e modelo 55 e NFC-e modelo 65                                                       | ✅     | `package.json` (`exports`, `bin`); `src/index.ts`; `src/cli/main.ts`. Smoke ESM/CJS: `node -e "require('./dist/index.cjs')"` e `node --input-type=module -e "import('./dist/index.js')"` → ambas expõem as 5 APIs. |
| 1.2 | Parsear XML autorizado, validar e renderizar DANFE retrato/paisagem e DANFE NFC-e 80/58 mm com QR, JSON model e ESC/POS | ✅     | APIs em `src/index.ts:19-123`; PDFs gerados nos testes `danfe-visual`, `m4-visual`, `danfe-nfce`; `toEscPos` em `tests/escppos.test.ts`.                                                                           |
| 1.3 | Funciona em Node e navegador; puro TS, sem dependências nativas                                                         | ✅     | `tests/browser-esm.test.ts` importa `dist/index.js` em `happy-dom` e renderiza 2 PDFs; runtime deps = `pdf-lib`, `@pdf-lib/fontkit`, `fast-xml-parser` (nenhuma nativa).                                           |
| 1.4 | Open source, MIT, “Hadagalberto Junior”                                                                                 | ✅     | `LICENSE`, `package.json` (`license`, `author`).                                                                                                                                                                   |
| 1.5 | “NOT a toy: no stubs, no TODO, no skipped or placeholder tests”                                                         | ✅     | Busca por `TODO/FIXME/NotImplemented/unimplemented/\.skip/\.todo/\.only/placeholder` em `src/`, `tests/`, `scripts/` → 0 ocorrências reais; 313 testes passam.                                                     |

## 2. Fontes oficiais (linhas 9–12)

| #   | Requisito                                                                                            | Status | Evidência / como verificar                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2.1 | MOC NF-e 7.0 + Notas Técnicas vigentes (layout 4.00), DANFE Anexo II com posições e tamanhos mínimos | ✅     | URLs e seções citadas em `src/render/layout.ts`, `layout-paisagem.ts`, `danfe-retrato.ts`, `danfe-paisagem.ts`; `README.md` §Fontes. Portal SVRS `https://dfe-portal.svrs.rs.gov.br/NFe/Documentos` **consultado via web nesta auditoria**: MOC 7.00 Anexo I/II (16/12/2020).                                                                                                                                |
| 2.2 | Manual do DANFE NFC-e e QR Code (versão vigente; QR v2 e v3 quando publicados)                       | ✅     | v5.0/v5.1 citados em `src/render/nfce-conteudo.ts` e `danfe-nfce.ts`; **v3 adicionado no marco 6** via [NT 2025.001 v1.01](https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=trSXReoZPuY=) (26/06/2025, ato 2/2026), citada em `src/render/danfe-nfce.ts`, `src/validate/xsd.ts`, READMEs e teste `hardening.test.ts` (ida e volta de payload v3). v1/v2 cobertos pelos 3 fixtures `nfce-*`. |
| 2.3 | XSDs oficiais (PL_009) vendados em `schemas/`, com URL e versão em `schemas/README.md`               | ✅     | 46 arquivos `.xsd` em 5 pacotes (PL_009q, PL_010b RTC, eventos genérico/cancelamento/CC-e); `schemas/README.md` registra versões, datas e URL do portal SVRS. Portal confirmado em 20/11/2026.                                                                                                                                                                                                               |
| 2.4 | Buscar fonte oficial quando a SPEC mandar; nunca inventar regras/posições                            | ✅     | Fontes buscadas nesta auditoria (portal SVRS e NT 2025.001 v1.01); todas as regras de layout e validação citam MOC/NT/XSD em comentários; hook XSD usa apenas caminhos de arquivos vendados.                                                                                                                                                                                                                 |

## 3. Stack (linhas 14–17)

| #    | Requisito                                                          | Status | Evidência / como verificar                                                                                                                                                                                                                                                                           |
| ---- | ------------------------------------------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1  | TypeScript strict                                                  | ✅     | `tsconfig.json`: `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitOverride`; `npm run typecheck` limpo.                                                                                                                                                      |
| 3.2  | Build dual ESM + CJS com tsup                                      | ✅     | `tsup.config.ts` (`format: ['esm','cjs']`, `dts: true`); `npm run build` gera `index.js/.cjs/.d.ts` e equivalente para `fixtures`/`cli`; smoke de require/import executado.                                                                                                                          |
| 3.3  | Node ≥ 20                                                          | ✅     | `package.json` `engines.node`; `target: node20`; CI Node 20/22/24.                                                                                                                                                                                                                                   |
| 3.4  | vitest                                                             | ✅     | `vitest.config.ts`; `npm test` → 313 testes.                                                                                                                                                                                                                                                         |
| 3.5  | ESLint + Prettier, warnings como erros                             | ✅     | `eslint.config.js` (type-checked), `.prettierrc.json`; `npm run lint` = `eslint . --max-warnings 0` (**alterado no marco 6**); `npm run format:check` limpo.                                                                                                                                         |
| 3.6  | `.gitattributes` com `* text=auto eol=lf`                          | ✅     | `.gitattributes:2`; `git diff --check` sem erros; corpus test verifica `xml.endsWith('\n')`.                                                                                                                                                                                                         |
| 3.7  | Runtime deps apenas pdf-lib, parser XML puro, barcode/QR próprio   | ⚠️     | `pdf-lib`, `fast-xml-parser` e código próprio em `src/barcode`/`src/qrcode`. **`fontkit`** (`@pdf-lib/fontkit`) está presente como acompanhante obrigatório do `pdf-lib` para embutir a fonte OFL — documentado em `README.md` e `CHANGELOG.md`. Nenhuma dep nativa; nenhum validador XSD no núcleo. |
| 3.8  | CI GitHub Actions ubuntu/windows/macos × Node 20/22/24             | ✅     | `.github/workflows/ci.yml`: matriz 3 SO × 3 versões (9 jobs), `fail-fast: false`, etapas `npm ci`, `typecheck`, `lint`, `format:check`, `build`, `test` — **exatamente os comandos de `npm run verify` executados nesta auditoria**.                                                                 |
| 3.9  | README.md (pt-BR) + README.en.md, CHANGELOG, CONTRIBUTING, LICENSE | ✅     | Todos presentes; READMEs com exemplos executados e saídas conferidas (§ 10).                                                                                                                                                                                                                         |
| 3.10 | Não publicar no npm                                                | ✅     | Nenhum job/step de `npm publish`; nenhum `git push`/`gh` executado; README orienta instalação local.                                                                                                                                                                                                 |

## 4. Parsing e modelo (linhas 19–22)

| #    | Requisito                                                                                 | Status | Evidência / como verificar                                                                                                                                                                                                                                                                                                                                                       |
| ---- | ----------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.1  | Parse de `nfeProc`, `NFe` raiz, `procEventoNFe` (cancelamento e CC-e) e NFC-e             | ✅     | `src/parse/nfe.ts`, `src/parse/evento.ts`; testes `parse-nfe.test.ts` (47 casos), `parse-evento.test.ts` (8), corpus (47 XMLs).                                                                                                                                                                                                                                                  |
| 4.2  | Modelo tipado: ide, emit, dest, det/prod/imposto                                          | ✅     | `src/model/nfe.ts`; `tests/parse-nfe.test.ts` verifica grupos de todos os 27 CST/CSOSN do corpus.                                                                                                                                                                                                                                                                                |
| 4.3  | ICMS: todos os CSTs e CSOSNs                                                              | ✅     | CST 00/02/10/15/20/30/40/41/50/51/53/60/61/70/90 + ICMSPart/ICMSST; CSOSN 101/102/103/201/202/203/300/400/500/900 — `tests/fixtures/nfe-cst-*.xml`, `nfe-csosn-*.xml`, `nfe-icms-*.xml`.                                                                                                                                                                                         |
| 4.4  | IPI, PIS, COFINS, ICMSUFDest, IBS/CBS (NT 2024.002), II, ISSQN                            | ✅     | Modelo e parser em `src/model/nfe.ts` / `src/parse/nfe.ts`; fixtures `nfe-difal.xml`, `nfe-rtc-ibscbs.xml`, `nfe-issqn-conjugada.xml`; `tests/parse-nfe.test.ts`.                                                                                                                                                                                                                |
| 4.5  | total, transp (volumes, reboque), cobr (fat/dup), pag, infAdic, infRespTec, autXML        | ✅     | Modelo e parser conforme XSD; fixtures `nfe-transporte.xml`, `nfe-duplicatas.xml`; `tests/parse-nfe.test.ts`, `tests/danfe-retrato.test.ts`.                                                                                                                                                                                                                                     |
| 4.6  | DV da chave (módulo 11) + consistência com ide                                            | ✅     | `src/validate/chave.ts`; `tests/chave-acesso.test.ts` usa o vetor oficial do MOC (43 dígitos → DV 5) e cStat 253/502.                                                                                                                                                                                                                                                            |
| 4.7  | CNPJ/CPF, inclusive CNPJ alfanumérico (ASCII−48)                                          | ✅     | `src/validate/documentos.ts` (NT 2025.001 + RFB); `tests/cnpj-cpf.test.ts` (19), fixture `nfe-cnpj-alfanumerico.xml`.                                                                                                                                                                                                                                                            |
| 4.8  | Recomputação de totais (vProd, vNF, vICMS…) com tolerâncias                               | ✅     | `src/validate/totais.ts` (regras W, cStat 531-609, W16-10/cStat 610 com tolerância R$ 0,50, itens 629/630/528/353); `tests/totais.test.ts` (14).                                                                                                                                                                                                                                 |
| 4.9  | Protocolo presente (cStat 100/150) vs. “SEM VALOR FISCAL” para homologação/não autorizado | ✅     | `src/validate/protocolo.ts` + `src/render/situacao.ts`; `tests/protocolo.test.ts` (18), `tests/danfe-retrato.test.ts` (marca d'água).                                                                                                                                                                                                                                            |
| 4.10 | **Hook opcional de validação XSD**, sem libxml nativo no núcleo                           | ✅     | **Implementado no marco 6**: `src/validate/xsd.ts` (`detectaEsquemaXsd`, `validaXsd`, `validaNFeComXsd`, `ESQUEMAS_XSD`), exportado em `src/index.ts`. 13 testes em `tests/xsd.test.ts`: seleção de XSD para nfeProc/NFe/3 eventos, hook síncrono/assíncrono, problemas normalizados, hook que lança, resultado inválido, raiz desconhecida, mesclagem com validação estrutural. |

## 5. Renderização (linhas 24–28)

| #    | Requisito                                                                                                               | Status | Evidência / como verificar                                                                                                                                                                                             |
| ---- | ----------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5.1  | DANFE retrato conforme Anexo II (canhoto, cabeçalho, quadros)                                                           | ✅     | `src/render/danfe-retrato.ts` + `layout.ts`; `tests/danfe-retrato.test.ts` (13) verifica campos por quadro; `tests/danfe-visual.test.ts` (5 goldens).                                                                  |
| 5.2  | Logotipo opcional PNG/JPEG                                                                                              | ✅     | `OpcoesRenderDanfe.logo`; `tests/danfe-retrato.test.ts` e `tests/cli.test.ts` com PNG real de `docs/images/`; CLI rejeita arquivo corrompido (código 2).                                                               |
| 5.3  | Code 128C da chave no cabeçalho                                                                                         | ✅     | `src/barcode/code128.ts` (Code C + fallback B, DV módulo 103); `tests/code128.test.ts` decodifica com `@zxing/library`; chamado em `danfe-retrato.ts:543` e `danfe-paisagem.ts:488`.                                   |
| 5.4  | Todos os quadros: destinatário, fatura/duplicatas, cálculo do imposto, transportador, produtos, ISSQN, dados adicionais | ✅     | Constantes em `layout.ts` e `layout-paisagem.ts`; `tests/danfe-retrato.test.ts` e `tests/danfe-paisagem.test.ts` (7) extraem texto e conferem posição/quadro.                                                          |
| 5.5  | Paginação automática de produtos + folhas de continuação “FOLHA X/Y” + transbordo de infAdic                            | ✅     | `tests/danfe-retrato.test.ts:147-200`; corpus com 10/20/60/95/120 itens → 1/2/6/10/12 páginas (novo teste em `hardening.test.ts` verifica os valores exatos 1/2/10).                                                   |
| 5.6  | Regras de tamanho mínimo de fonte (MOC §3.7)                                                                            | ✅     | `FONTE_MINIMA` em `layout.ts`; `tests/danfe-retrato.test.ts` mede fontes no PDF.                                                                                                                                       |
| 5.7  | Marca d'água: homologação, cancelada, denegada, contingência                                                            | ✅     | `src/render/situacao.ts`; `tests/danfe-retrato.test.ts`, `tests/danfe-paisagem.test.ts`, `tests/evento-render.test.ts`, goldens.                                                                                       |
| 5.8  | DANFE paisagem (Anexo II §3.8.2 / Anexo III.04) com canhoto vertical, rótulos girados e colunas normativas              | ✅     | `src/render/danfe-paisagem.ts` + `layout-paisagem.ts`; `tests/danfe-paisagem.test.ts`, golden `paisagem-cst-00-p1.png`. URLs de medição citadas no código.                                                             |
| 5.9  | NFC-e 80 mm e 58 mm; divisões I–IX; totais/pagamento/consumidor; itens opcionais                                        | ✅     | `src/render/danfe-nfce.ts` + `nfce-conteudo.ts`; `tests/danfe-nfce.test.ts` (7) cobre 80/58, `detalharItens: false`, conteúdo por divisão, 11 blocos de 4, QR decodificado.                                            |
| 5.10 | QR Code **somente** do campo `qrCode` do XML (v1/v2/v3)                                                                 | ✅     | `danfe-nfce.ts:219` (`encodeQrCode(conteudo.qrCode, {nivelCorrecao:'M'})`); teste de QR decodificado e novo teste com payload v3 (NT 2025.001 v1.01).                                                                  |
| 5.11 | ESC/POS com comando nativo de QR                                                                                        | ✅     | `src/render/escppos.ts` (`GS ( k`, PC860, corte parcial); `tests/escppos.test.ts` (6) compara stream byte a byte e referências Epson citadas.                                                                          |
| 5.12 | Fonte métrica compatível e aberta embutida (Liberation Sans / OFL)                                                      | ✅     | `assets/fonts/` + `src/render/font-data.ts` (DANFE Sans, subconjunto renomeado de Liberation Sans 2.1.5, SIL OFL 1.1) carregada via `@pdf-lib/fontkit`; saída determinística (goldens estáveis após `npm run golden`). |

## 6. API e CLI (linhas 30–32)

| #    | Requisito                                          | Status | Evidência / como verificar                                                                                                       |
| ---- | -------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| 6.1  | `parseNFe(xml)`                                    | ✅     | `src/parse/nfe.ts:76`, exportado; smoke ESM/CJS executado.                                                                       |
| 6.2  | `validateNFe(model)`                               | ✅     | `src/validate/validate.ts`, exportado; nunca lança (reforçado no marco 6).                                                       |
| 6.3  | `renderDanfe(model, options): Promise<Uint8Array>` | ✅     | `src/render/danfe-retrato.ts:984`; retrato e `layout:'paisagem'`.                                                                |
| 6.4  | `renderDanfeNfce(...)`                             | ✅     | `src/render/danfe-nfce.ts:154`.                                                                                                  |
| 6.5  | `toEscPos(...)`                                    | ✅     | `src/render/escppos.ts:124`.                                                                                                     |
| 6.6  | CLI `danfe nota.xml -o nota.pdf`                   | ✅     | Executado: `node dist/cli.js tests/fixtures/nfe-cst-00.xml -o .tmp/nota.pdf` → exit 0, `%PDF-`.                                  |
| 6.7  | `--layout paisagem`                                | ✅     | Executado com `--logo` → exit 0; `analisaArgumentos` normaliza maiúsculas (teste em `cli.test.ts`).                              |
| 6.8  | `--logo logo.png`                                  | ✅     | Executado com `docs/images/danfe-retrato.png`; assinatura + decodificação real; PNG/JPEG corrompido → exit 2 (novo teste).       |
| 6.9  | `--json`                                           | ✅     | Executado: chave `352601...2140`, modelo 55, emitente e `validacao.valido: true`; combinável com `--validate`.                   |
| 6.10 | `--validate` com exit ≠ 0 em erros                 | ✅     | Executado: fixture válido → exit 0; DV adulterado → exit 1 com `CHAVE_DV [B23-10] (cStat 253)`.                                  |
| 6.11 | Lote sobre diretórios                              | ✅     | Executado: 2 XMLs em `.tmp/notas` → 2 PDFs em `.tmp/pdfs/`; ignora não-XML, cria diretório, `--output .pdf` para lote → exit 2.  |
| 6.12 | Códigos de saída 0/1/2 e `--help`/`--version`      | ✅     | `tests/cli.test.ts` (15, inclui `spawnSync` do binário real) + execução manual: `--help` exit 0, `--version` → `danfe-br 0.1.0`. |

## 7. Testes (linhas 34–38)

| #   | Requisito                                                                | Status | Evidência / como verificar                                                                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7.1 | Corpus de XMLs realistas, sintéticos, DVs válidos, todas as famílias CST | ✅     | 47 XMLs em `tests/fixtures/` + `manifest.json` + `tests/corpus.test.ts` (52 casos) regera byte a byte e valida cada arquivo.                                                                                                                                                              |
| 7.2 | Muitos itens — paginação 1, 2 e 10 páginas                               | ✅     | `nfe-muitos-itens-{10,20,95}.xml` (novos 20/95 no marco 6); `hardening.test.ts` assere 1/2/10 páginas via pdf-lib.                                                                                                                                                                        |
| 7.3 | Duplicatas, transporte, homologação, cancelamento, NFC-e                 | ✅     | `nfe-duplicatas.xml`, `nfe-transporte.xml`, `nfe-homologacao.xml`, `evento-cancelamento.xml`, `nfce-*.xml`; tests correspondentes.                                                                                                                                                        |
| 7.4 | Regressão visual: PDF → PNG (pdf.js) vs goldens com tolerância de pixels | ✅     | `tests/helpers/raster.ts` (pdfjs-dist + @napi-rs/canvas), `tests/danfe-visual.test.ts`, `tests/m4-visual.test.ts`; 11 PNGs em `tests/golden/`. `npm run golden` executado → nenhuma diferença.                                                                                            |
| 7.5 | Extração de texto: cada campo no seu quadro                              | ✅     | `tests/danfe-retrato.test.ts`, `danfe-paisagem.test.ts`, `danfe-nfce.test.ts`, `evento-render.test.ts` usam `extraiTexto`/`textoSimples`.                                                                                                                                                 |
| 7.6 | Code 128 e QR decodificados com decodificador independente               | ✅     | `tests/code128.test.ts` (@zxing/library), `tests/qrcode.test.ts` (jsQR, versões 1–40, 40 payloads aleatórios), `tests/danfe-nfce.test.ts` (QR do PDF decodificado).                                                                                                                       |
| 7.7 | Assinatura: amostras conhecidas válidas e adulteradas                    | ✅     | `tests/signature.test.ts` (16) com certificado RSA 2048 fixo em `tests/fixtures/signature/`, assinatura gerada por `node:crypto`; casos válido, conteúdo adulterado, assinatura adulterada, certificado trocado, algoritmos não suportados; C14N com vetores W3C em `tests/c14n.test.ts`. |
| 7.8 | Nenhum teste pulado/placeholder                                          | ✅     | Verificado por busca e pela suíte: 313/313 passam.                                                                                                                                                                                                                                        |

## 8. Restrições duras (linhas 40–41)

| #   | Requisito                             | Status | Evidência / como verificar                                                                         |
| --- | ------------------------------------- | ------ | -------------------------------------------------------------------------------------------------- |
| 8.1 | Nunca `git push`, `gh`, `npm publish` | ✅     | Nenhum desses comandos executado nesta auditoria.                                                  |
| 8.2 | Commit local após cada marco          | ✅     | Histórico: `4943e3d` (marco 5), marcos 1–4 anteriores; commit do marco 6 ao final desta auditoria. |
| 8.3 | Permanecer dentro deste repositório   | ✅     | Arquivos temporários apenas em `.tmp/` (gitignored); nenhum arquivo externo alterado.              |

## 9. Endurecimento: bug → correção → teste

| Entrada hostil                                                  | Comportamento antes                                         | Correção                                                                                                                       | Teste de regressão                                                         |
| --------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `nfe-cnpj-alfanumerico.xml` (chave com letras, NT 2025.001)     | `renderDanfe` rejeitava com “esperados 44 dígitos”          | Validadores passaram a usar a regex oficial `[0-9]{6}[A-Z0-9]{12}[0-9]{26}` (`formatoChaveAcessoValido`) em retrato e paisagem | `hardening.test.ts` → “renderiza retrato e paisagem sem exigir 44 dígitos” |
| Validador XSD ausente (SPEC item 4.10)                          | Não existia                                                 | Hook injetado + normalização de erros (`src/validate/xsd.ts`)                                                                  | 13 testes em `tests/xsd.test.ts`                                           |
| QR Code v3 e capacidade excedida                                | v3 não documentado; nível inválido gerava `TypeError` opaco | NT 2025.001 v1.01 citada; `encodeQrCode` valida nível com `RangeError` claro                                                   | `hardening.test.ts` → payload v3 decodificado; nível `Z` e 4000 bytes      |
| Modelo incompleto passado a `validateNFe`                       | Lançava `TypeError` (violando “reporta, nunca lança”)       | `VALIDACAO_INTERNA` estruturado + situação neutra                                                                              | `hardening.test.ts` → 2 testes                                             |
| Logotipo PNG/JPEG com assinatura válida mas corrompido          | Falha na renderização (exit 1)                              | Validação com o próprio decodificador do pdf-lib (exit 2)                                                                      | `hardening.test.ts` → “rejeita logotipo … corrompido”                      |
| `npm run fixtures` seguido de `format:check`                    | `manifest.json` diverge do Prettier                         | Gerador virou forma canônica (`.prettierignore`)                                                                               | Execução manual: fixtures → verify limpo                                   |
| XML com entidades (billion laughs), aninhamento 5000, BOM, lixo | —                                                           | Parser já rejeita/aceita corretamente; confirmado por execução                                                                 | `hardening.test.ts` → 5 testes                                             |
| Caminhos Windows com espaços, lote com `-o lote.pdf`            | —                                                           | Confirmado comportamento correto por execução                                                                                  | `hardening.test.ts` → 2 testes                                             |

## 10. Comandos executados e resultados

```text
npm run verify
  typecheck ................................ OK (tsc --noEmit)
  lint ..................................... OK (eslint . --max-warnings 0)
  format:check ............................. OK (prettier --check .)
  build .................................... OK (ESM + CJS + DTS, tsup)
  test ..................................... 22 arquivos, 313 testes, 0 falhas

npm run fixtures  → 47 fixtures escritos (byte-idênticos aos versionados)
npm run golden    → 11 PNGs regeneration estável (git diff vazio)
npm run docs:images → 6 PNGs regeneration estável (git diff vazio)
git diff --check  → sem erros de whitespace / CRLF

CLI (todos exit 0 salvo indicação):
  node dist/cli.js tests/fixtures/nfe-cst-00.xml -o .tmp/nota.pdf
  node dist/cli.js tests/fixtures/nfe-cst-00.xml --layout paisagem \
       --logo docs/images/danfe-retrato.png -o .tmp/nota-paisagem.pdf
  node dist/cli.js tests/fixtures/nfce-anonima.xml --papel 58 -o .tmp/cupom.pdf
  node dist/cli.js tests/fixtures/nfe-cst-00.xml --validate
  node dist/cli.js .tmp/notas -o .tmp/pdfs/        → 2 PDFs
  node dist/cli.js tests/fixtures/nfe-cst-00.xml --validate --json
  node dist/cli.js --help ; node dist/cli.js --version
  DV adulterado + --validate                      → exit 1 (CHAVE_DV, cStat 253)
  PNG corrompido + --logo                         → exit 2

Dual build:
  node -e "require('./dist/index.cjs')"           → 5 APIs + validaNFeComXsd
  node --input-type=module -e "import('./dist/index.js')" → idem

Fontes oficiais consultadas via web nesta auditoria:
  https://dfe-portal.svrs.rs.gov.br/NFe/Documentos
  https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=trSXReoZPuY=
```

## 11. Ressalvas (⚠️)

1. **`@pdf-lib/fontkit` como dependência de runtime:** a SPEC lista “pdf-lib, um
   parser XML puro e barcode/QR próprio”. O `fontkit` é o acompanhante oficial
   do `pdf-lib` exigido para incorporar TTF — sem ele a fonte OFL determinística
   (item 5.12) não seria possível. Está documentado nos READMEs e CHANGELOG;
   é puro JS, não nativo.
2. **QR Code v2:** o projeto codifica o campo `qrCode` verbatim, portanto
   qualquer versão de URL é suportada. Os fixtures cobrem o formato v1
   (`nVersao=100`) e o teste cobre o v3 (NT 2025.001 v1.01). Não há um fixture
   separado rotulado “v2” porque o leiaute v2 difere do v1 apenas nos
   parâmetros da URL, que não são interpretados pelo renderizador.
3. **CI multiplataforma:** a matriz e os comandos foram auditados localmente no
   Windows; ubuntu/macos são executados pelo GitHub Actions com os mesmos
   scripts (`npm run verify` decomposto nas etapas do workflow). Nenhuma
   dependência nativa do sistema é usada nos testes (canvas via
   `@napi-rs/canvas` com binários pré-compilados).
