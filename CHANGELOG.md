# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e [SemVer](https://semver.org/lang/pt-BR/).

## [Não publicado]

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
