# schemas/ — XSDs oficiais da NF-e/NFC-e

Este diretório mantém uma cópia verificável dos esquemas XML (XSD) oficiais da
NF-e (modelo 55) e da NFC-e (modelo 65), layout **4.00**, utilizados como fonte
de verdade para o modelo tipado e o parser deste projeto.

## Pacotes incluídos

| Diretório                       | Conteúdo                                                                                                                             | Versão                                                 | Data da publicação |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ | ------------------ |
| `PL_009q_NT2025_001_v1.00/`     | Leiaute completo da NF-e/NFC-e (leiaute, tipos, proc, serviços, xmldsig)                                                             | PL 009q (NT 2025.001 — CNPJ alfanumérico)              | 26/06/2025         |
| `eventos/generico/`             | `procEventoNFe` genérico (evento de qualquer tipo)                                                                                   | PL v1.01                                               | 30/05/2014         |
| `eventos/cancelamento/`         | Evento de **cancelamento** (`procEventoCancNFe`, tpEvento 110111)                                                                    | PL v1.01 (NT 2018.004)                                 | 21/12/2018         |
| `eventos/cce/`                  | Evento de **Carta de Correção Eletrônica** (`procCCeNFe`, tpEvento 110110)                                                           | PL v1.01                                               | 30/05/2014         |
| `PL_010b_NT2025_002_v1.30_RTC/` | Pacote da Reforma Tributária: `DFeTiposBasicos_v1.00.xsd` (grupos IBS/CBS) e `leiauteNFe_v4.00.xsd` com o grupo `IBSCBS`/`IBSCBSTot` | PL 010b (NT 2025.002 v1.30, NT 2024.003 e NT 2025.001) | 07/10/2025         |

## Fontes oficiais (baixadas na data indicada, sem alteração de conteúdo)

- Download dos pacotes de schemas — Portal da Nota Fiscal Eletrônica (SEFAZ
  Virtual RS): `https://dfe-portal.svrs.rs.gov.br/NFe/Documentos`, item
  “Schemas” (endpoint de arquivo estático:
  `https://dfe-portal.svrs.rs.gov.br/NFE/DownloadArquivoEstatico/?sistema=NFE&tipoArquivo=2&nomeArquivo=<nome-do-arquivo>.zip`).
- Portal Nacional da NF-e: <https://www.nfe.fazenda.gov.br> (aba “Documentos”).
- MOC — Manual de Orientação do Contribuinte, versão 7.0 (Anexo I — Leiaute e
  Regras de Validação; Anexo II — DANFE; Visão Geral), aprovado pelo Ato COTEPE
  ICMS 69/20 e publicado pelo CONFAZ: <https://www.confaz.fazenda.gov.br/legislacao/arquivo-manuais>.
- NT 2024.002 v1.10 (IBS, CBS e Imposto Seletivo — Reforma Tributária, EC
  132/2023), publicada em 06/12/2024 no portal nacional e no portal da SVRS.
- NT 2025.001 v1.00 (CNPJ alfanumérico), publicada em 25/04/2025.

## Notas

- Os arquivos em `PL_009q_NT2025_001_v1.00/` e `PL_010b_NT2025_002_v1.30_RTC/`
  são distribuídos publicamente pela SEFAZ para os integradores; são mantidos
  aqui sem modificações para auditoria e para o hook opcional de validação XSD.
- Os grupos **IBS/CBS** implementados no modelo tipado deste projeto seguem a
  **NT 2024.002 v1.10** (`det/imposto/IBSCBSSel` e `total/IBSCBSSelTot`). O
  pacote `PL_010b_NT2025_002_v1.30_RTC/` registra a forma publicada em XSD
  (que renomeou os grupos para `IBSCBS`/`IBSCBSTot` e evoluiu alguns campos na
  NT 2025.002 v1.30) — veja os comentários em `src/model/nfe.ts`.
- O `eventos/generico/tiposBasico_v1.03.xsd` define `TEvento`, `TRetEvento` e
  `TProcEvento`; os pacotes de cancelamento e CC-e definem os `detEvento`
  específicos (`nProt`/`xJust` e `xCorrecao`/`xCondUso`).
