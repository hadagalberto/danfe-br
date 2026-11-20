# Corpus de fixtures

XMLs sintéticos gerados por `npm run fixtures` (scripts/generate-fixtures.ts,
via `src/fixtures/factory.ts`). **Determinístico**: reexecutar o gerador
reproduz estes arquivos byte a byte — `tests/corpus.test.ts` verifica isso.

- Todos os documentos são **válidos** (chaves com DV módulo 11 corretos,
  CNPJs/CPFs com DV válidos, totais recomputados que passam na validação).
  Vetores inválidos vivem nos testes unitários, não aqui.
- `manifest.json` descreve cada arquivo e as expectativas verificadas
  (tipo, chave, modelo, ambiente, cStat, itens, validade e códigos de
  problema esperados).
- Empresas, pessoas e valores são fictícios (seeds determinísticas).

## Cobertura

| Grupo                                                           | Arquivos                                     |
| --------------------------------------------------------------- | -------------------------------------------- |
| CST 00/02/10/15/20/30/40/41/50/51/53/60/61/70/90                | `nfe-cst-*.xml`                              |
| ICMSPart (10) e ICMSST (60)                                     | `nfe-icms-part-10.xml`, `nfe-icms-st-60.xml` |
| CSOSN 101/102/103/201/202/203/300/400/500/900                   | `nfe-csosn-*.xml`                            |
| Muitos itens (10/60/120)                                        | `nfe-muitos-itens-*.xml`                     |
| Fatura + 3 duplicatas                                           | `nfe-duplicatas.xml`                         |
| Transporte completo                                             | `nfe-transporte.xml`                         |
| Homologação (tpAmb = 2)                                         | `nfe-homologacao.xml`                        |
| Fora de prazo (cStat 150) / denegada (cStat 110)                | `nfe-fora-prazo.xml`, `nfe-denegada.xml`     |
| Sem protocolo (raiz `NFe`)                                      | `nfe-sem-protocolo.xml`                      |
| CNPJ alfanumérico (NT 2025.001)                                 | `nfe-cnpj-alfanumerico.xml`                  |
| DIFAL (ICMSUFDest)                                              | `nfe-difal.xml`                              |
| ISSQN conjugado (peça + serviço)                                | `nfe-issqn-conjugada.xml`                    |
| IBS/CBS (NT 2024.002 v1.10)                                     | `nfe-rtc-ibscbs.xml`                         |
| NFC-e (CPF + cartão + QR Code, anônima + PIX, 20 itens + troco) | `nfce-*.xml`                                 |
| Eventos: cancelamento (110111) e CC-e (110110)                  | `evento-*.xml`                               |

Observações honestas sobre o que é sintético de propósito neste marco:

- O campo `qrCode` da NFC-e traz os parâmetros reais da nota (chave,
  ambiente, valores) e **marcadores sintéticos** para `digVal`/`cHashQRCode`:
  a construção byte a byte do QR (HMAC-SHA1, Manual de Especificações
  Técnicas do DANFE NFC-e e QR Code) pertence ao marco de renderização; o
  parser deste marco apenas lê o campo (CDATA inclusive).
- Os XMLs não possuem assinatura XMLDSig (a verificação de assinatura é
  objeto de marco próprio, com C14N e amostras assinadas conhecidas).
