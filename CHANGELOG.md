# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e [SemVer](https://semver.org/lang/pt-BR/).

## [Não publicado]

### Adicionado — Marco 6: auditoria da SPEC e endurecimento

- **Hook opcional de validação XSD** (`validaXsd`, `validaNFeComXsd`,
  `detectaEsquemaXsd`, `ESQUEMAS_XSD`): o núcleo continua sem libxml nativo; o
  integrador injeta seu validador (síncrono ou assíncrono) e recebe problemas
  normalizados (`XSD_*`) mesclados ao relatório estrutural. Os XSDs oficiais
  vendados em `schemas/` e o portal SVRS são citados no código e na docs.
- **Correção**: DANFE retrato e paisagem agora imprimem documentos com **CNPJ
  alfanumérico** (NT 2025.001) — antes rejeitavam a chave por conter letras.
  A validação de formato usa a regex oficial (`[0-9]{6}[A-Z0-9]{12}[0-9]{26}`).
- **Endurecimento**: `validateNFe` nunca lança mesmo com modelo incompleto
  (problema `VALIDACAO_INTERNA`); `encodeQrCode` rejeita nível de correção
  inválido com erro claro; a CLI valida PNG/JPEG com o próprio decodificador
  do pdf-lib e devolve código 2 para arquivos corrompidos.
- **Cobertura**: QR Code versão 3 (NT 2025.001 v1.01), BOM/entidades/
  aninhamento profundo, caminhos com espaços e separadores do Windows, lote com
  saída inválida — 36 novos testes de regressão (`tests/xsd.test.ts` e
  `tests/hardening.test.ts`). O corpus passa de 45 para **47 XMLs**, com
  fixtures de exatamente 2 e 10 páginas (SPEC: paginação 1/2/10).
- **CI/Qualidade**: `npm run lint` usa `--max-warnings 0` (warnings = erros).
- **Documentação**: `docs/SPEC-CHECKLIST.md` com o levantamento linha a linha
  da SPEC e o status verificado de cada requisito; READMEs pt-BR/en com exemplos
  de CLI executados e fontes oficiais atualizadas.

### Adicionado — Marco 5: CLI, smoke test de navegador e documentação

- **Binário `danfe`** (`bin` do pacote, build `dist/cli.js`): `danfe nota.xml -o
nota.pdf`, lote de diretórios (`danfe notas/ -o pdfs/`, ignorando arquivos
  não-XML), `--layout retrato|paisagem|nfce` (com detecção automática de NFC-e
  pelo modelo 65), `--papel 80|58`, `--logo` (PNG/JPEG com assinatura
  verificada), `--json` (relatório com chave, modelo, emitente e validação) e
  `--validate`. Códigos de saída: 0 = sucesso, 1 = erro de documento/
  processamento (inclui erros de `--validate`), 2 = uso inválido. A lógica em
  `src/cli/index.ts` é pura (E/S injetada, sem `process.exit`); `src/cli/main.ts`
  é apenas o adaptador do processo.
- **Smoke test do build ESM no navegador**: `tests/browser-esm.test.ts` roda em
  `happy-dom`, importa `dist/index.js` e renderiza DANFE retrato e NFC-e 58 mm,
  validando os bytes com `pdf-lib`. O `globalSetup` do vitest produz o build
  quando necessário, então `npm test` funciona isoladamente.
- **Testes da CLI**: 15 testes com vetores válidos (fixtures autorizadas) e
  inválidos (chave com DV adulterado → `CHAVE_DV`/cStat 253, XML malformado,
  logotipo inválido), incluindo execução do binário real e verificação dos
  códigos de saída 0/1/2.
- **Documentação**: README pt-BR e en com galeria de imagens geradas das
  rasterizações douradas (`npm run docs:images`, script `scripts/generate-readme-images.ts`),
  seção completa da CLI e contagem atualizada; CONTRIBUTING com os novos
  comandos. Imagens versionadas em `docs/images/`.

### Adicionado — Marco 4: DANFE paisagem, NFC-e, ESC/POS e eventos

- **`renderDanfe(modelo, { layout: 'paisagem' })`** (e o atalho
  `renderDanfePaisagem`): PDF A4 paisagem conforme o MOC 7.00 — Anexo II §3.8.2
  e modelo Anexo III.04, com canhoto vertical, rótulos girados, Code 128C da
  chave (máscara em 11 blocos de 4), todos os quadros, colunas de produtos na
  ordem normativa, paginação com `FOLHA X/Y` e marcas d'água. Larguras de
  colunas medidas no desenho oficial e normalizadas para os 26,54 cm do quadro;
  URLs e metodologia citadas em `src/render/layout-paisagem.ts`.
- **`renderDanfeNfce(modelo, { larguraMm: 80 | 58, ... })`**: DANFE NFC-e em
  papel térmico com as divisões I–IX do _Manual de Especificações Técnicas do
  DANFE NFC-e e QR Code_ v5.0 / _Manual de Padrões Técnicos do DANFE-NFC-e e QR
  Code_ v5.1 (portal SVRS, URLs citadas em `src/render/nfce-conteudo.ts`).
  Margens de 2 mm, QR Code de 25 × 25 mm (22 mm de conteúdo + 3 mm de zona
  silenciosa, nível M/UTF-8) gerado **somente** a partir de `infNFeSupl/qrCode`,
  chave em 11 blocos de 4, consumidor, protocolo e mensagens de contingência /
  homologação. Detecta modelo 65; rejeita nota sem QR.
- **`toEscPos(modelo)`**: fluxo ESC/POS com comando nativo de QR Code `GS ( k`
  (modelo 2, módulo 3, correção M), tabela de caracteres PC860 para pt-BR,
  alinhamento/negrito, avanço de linhas e corte parcial. Comandos e referência
  Epson citados em `src/render/escppos.ts`.
- **`renderEvento(procEventoNFe)`**: comprovante A4 de cancelamento (carimbo
  `CANCELADO`, `SEM VALOR FISCAL`, justificativa e protocolos) e Carta de
  Correção Eletrônica (`CC-e`, correção, condições de uso e protocolo).
- **Testes**: 29 novos testes funcionais (posições por quadro, paginação,
  marcas d'água, fontes mínimas, QR decodificado por jsQR, byte stream ESC/POS
  exato e vetores inválidos) e 5 regressões visuais com goldens em
  `tests/golden/` para paisagem, NFC-e 80/58 mm, cancelamento e CC-e.

### Adicionado — Marco 3: renderização do DANFE retrato

- **`renderDanfe(modelo, opcoes?)`**: PDF A4 retrato integralmente baseado no
  MOC 7.0 — Anexo II (`Manual de Especificações Técnicas do DANFE e Código de
Barras`, seções 2, 3.1.1, 3.1.2, 3.1.7, 3.1.8, 3.7, 3.8.1, 3.9.2, 3.10.1,
  3.10.2 e Anexo III.02), com URL oficial citada em `src/render/layout.ts`.
  Inclui canhoto, cabeçalho com logotipo opcional, Code 128C da chave, todos
  os quadros, tamanhos mínimos de fonte (§3.7), códigos de barras da chave e
  dos dados em contingência (36 dígitos, §3.9.2) e máscaras de 11/9 blocos.
- **Paginação** automática de produtos com folhas de continuação contendo o
  mínimo exigido pelo FAQ oficial, `FOLHA X/Y` em todas as folhas e destaque
  divisório entre itens (§3.1.7); transbordo de informações complementares
  para as folhas seguintes (§3.1.8).
- **Marcas d'água**: `SEM VALOR FISCAL` (homologação/não autorizado),
  `CANCELADA` (evento 110111 ou opção explícita), `DENEGADA` (cStat
  110/301-303) e `CONTINGÊNCIA` (tpEmis ≠ 1), desenhadas atrás do conteúdo.
- **Fonte OFL embutida**: DANFE Sans (subconjunto renomeado de Liberation
  Sans 2.1.5, SIL OFL 1.1) em `assets/fonts/` e Base64 em
  `src/render/font-data.ts` — saída determinística em Node e navegador, sem
  fontes do sistema. `@pdf-lib/fontkit` é o acompanhante do `pdf-lib` usado
  para incorporar a fonte.
- **Testes**: 13 novos testes funcionais (campos por quadro, paginação,
  marcas d'água, fontes mínimas, logotipo e vetores inválidos) e 5 testes de
  regressão visual, com rasterização via `pdfjs-dist` + `@napi-rs/canvas`
  (instalável em todos os SOs) e goldens em `tests/golden/`.

### Adicionado — Marco 2: códigos de barras e assinatura XMLDSig

- **Code 128** próprio (`encodeCode128`): Code C com fallback em Code B pela
  tabela de compressão GS1, dígito verificador módulo 103 e larguras
  ISO/IEC 15417. Testado por decodificação com `@zxing/library` em dezenas de
  payloads aleatórios e na chave de acesso de 44 dígitos.
- **QR Code** próprio (`encodeQrCode`): modo byte (UTF-8), versões 1–40,
  níveis L/M/Q/H (M padrão), Reed-Solomon por bloco com entrelaçamento,
  máscara automática por penalidades N1–N4 (ISO/IEC 18004) e `paraSvg`.
  Testado por decodificação com `jsQR` em todas as versões e dezenas de
  payloads aleatórios.
- **Verificação XMLDSig** (`verificaAssinaturaNFe`): leitor XML que preserva
  QNames/escopo de namespaces, C14N 1.0 sem comentários (vetores W3C), SHA-1,
  RSA PKCS#1 v1.5, extração da chave pública de certificado X.509 DER e
  checagem do `DigestValue` do `infNFe`. Reporta falhas, nunca lança.
- Testes com certificado autoassinado (fixture RSA 2048) assinando em tempo
  de teste com `node:crypto`: caso válido, conteúdo adulterado, assinatura
  adulterada, certificado trocado e algoritmos não suportados.

### Adicionado — Marco 1: modelo tipado, parser e validação

- **Modelo tipado completo** do layout 4.00 da NF-e (modelo 55) e da NFC-e
  (modelo 65): `ide` (com `NFref`), `emit`, `dest`, `det/prod`,
  `det/imposto` com **todos os grupos de ICMS** (CST 00, 02, 10, 15, 20, 30,
  40/41/50, 51, 53, 60, 61, 70, 90, `ICMSPart`, `ICMSST`) e **todos os
  CSOSN** (101, 102/103/300/400, 201, 202/203, 500, 900), `IPI`, `PIS`,
  `COFINS`, `ICMSUFDest`, `II`, `ISSQN` por item e os grupos **IBS/CBS da
  Reforma Tributária (NT 2024.002 v1.10)**; `total` (`ICMSTot`, `ISSQNtot`,
  `retTrib`, `IBSCBSSelTot`), `transp` (transporta, `retTransp`, veículos,
  reboques, volumes com lacres), `cobr` (fatura/duplicatas), `pag` (todas as
  formas de pagamento, cartões, troco), `infAdic`, `infRespTec`, `autXML` e
  `infNFeSupl` (QR Code da NFC-e em CDATA).
- **Parser** (`parseNFe`) para `nfeProc` e `NFe` (com/sem protocolo) e
  (`parseEventoNFe`) para `procEventoNFe`, `procEventoCancNFe`
  (cancelamento, tpEvento 110111) e `procCCeNFe` (Carta de Correção,
  tpEvento 110110), com `detEvento` genérico para eventos futuros.
- **Validação** (`validateNFe`) que reporta, nunca lança:
  DV da chave de acesso (módulo 11) e consistência com `ide`/emitente
  (cStat 253/502, incluindo chaves com CNPJ alfanumérico — NT 2025.001);
  CNPJ numérico/alfanumérico (cStat 207/208) e CPF (cStat 401/237);
  recomputação de totais (cStat 531-609) com a fórmula oficial do vNF
  (W16-10, cStat 610, tolerância de R$ 0,50 e Exceção 3); checagens por item
  (cStat 629/630/528/353); situação do protocolo (100/150 autorizada,
  110/301-303 denegada) e homologação → “SEM VALOR FISCAL”.
- **Fábrica de fixtures** (`danfe-br/fixtures`) determinística e o corpus
  versionado de 45 XMLs em `tests/fixtures/` com `manifest.json`
  (regenerável byte a byte por `npm run fixtures`).
- **Scaffold** do projeto: build dual ESM/CJS com `tsup`, TypeScript
  `strict` (+`noUncheckedIndexedAccess`), vitest, ESLint (type-checked) +
  Prettier, `.gitattributes` com LF, CI GitHub Actions
  (ubuntu/windows/macos × Node 20/22/24), XSDs oficiais vendados em
  `schemas/` (PL_009q, eventos e PL_010b/RTC) com fonte documentada.
- README (pt-BR e en), CHANGELOG, CONTRIBUTING e LICENSE (MIT).
