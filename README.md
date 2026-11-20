# danfe-br

[![CI](https://github.com/hadagalberto/danfe-br/actions/workflows/ci.yml/badge.svg)](https://github.com/hadagalberto/danfe-br/actions/workflows/ci.yml)
[![Licença: MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-blue.svg)](LICENSE)

**danfe-br** é uma biblioteca TypeScript (pura, sem dependências nativas) para
documentos fiscais eletrônicos brasileiros — **NF-e (modelo 55)** e
**NFC-e (modelo 65)** — que parseia o XML autorizado, valida o documento e
renderiza os documentos auxiliares oficiais em PDF: **DANFE** (retrato e
paisagem) e **DANFE NFC-e** (80 mm e 58 mm, com QR Code), além de saída
**ESC/POS** para impressoras térmicas.

> Status: **Marco 1 concluído** — modelo tipado completo, parser e validação
> (chave de acesso, CNPJ/CPF, totais e protocolo) + fábrica de fixtures.
> A renderização de PDF/DANFE, o QR Code e o CLI chegam nos marcos seguintes.

## Instalação

```bash
npm install danfe-br
```

Requer **Node.js ≥ 20**. Funciona em Node e no navegador (TypeScript puro,
sem dependências nativas). Build dual: ESM + CJS.

## Uso

### Parse do XML autorizado

```ts
import { parseNFe, validateNFe } from 'danfe-br';

const proc = parseNFe(xmlDaNota); // nfeProc (com protocolo) ou NFe "raiz"

proc.nfe.chave; // chave de acesso (44 posições)
proc.nfe.ide.nNF; // número da nota
proc.nfe.det[0].imposto.icms; // grupo de ICMS tipado (união por CST/CSOSN)
proc.protNFe?.cStat; // 100 = uso autorizado
```

Aceita `nfeProc` e `NFe` (com ou sem protocolo). Eventos:

```ts
import { parseEventoNFe } from 'danfe-br';

const evento = parseEventoNFe(xmlDeEvento);
// raiz procEventoNFe, procEventoCancNFe (cancelamento, 110111)
// ou procCCeNFe (Carta de Correção, 110110)
evento.evento.infEvento.detEvento; // tipado por tpEvento
```

### Validação (reporta, nunca lança)

```ts
const resultado = validateNFe(proc);

resultado.valido; // sem erros?
resultado.problemas; // erros + avisos, com regra e cStat oficiais
resultado.situacaoProtocolo.autorizada; // cStat 100/150
resultado.situacaoProtocolo.semValorFiscal; // homologação/não autorizada
```

O que é validado neste marco (cada item cita a fonte oficial no código):

| Verificação                                             | Fonte oficial                                           |
| ------------------------------------------------------- | ------------------------------------------------------- |
| DV da chave de acesso (módulo 11)                       | MOC 7.0 — Visão Geral 2.2.6.2; regra B23-10 (cStat 253) |
| Consistência da chave com `ide`/emitente                | MOC 7.0 — Anexo I, regra A03-10 (cStat 502)             |
| CNPJ numérico **e alfanumérico** (ASCII−48, A=17..Z=42) | NT 2025.001 + RFB; MOC C02-10/E02-10 (cStat 207/208)    |
| CPF (rejeita zeros e dígitos repetidos)                 | MOC cStat 401/237 (NT 2012/003)                         |
| Recomputação de totais (vProd, vICMS, vST, ...)         | MOC 7.0 — Anexo I, regras W (cStat 531-609)             |
| Fórmula do vNF (W16-10, tolerância R$ 0,50)             | MOC 7.0 — Anexo I, cStat 610 (nota *3, NT 2012/003)     |
| Item: vProd = qCom × vUnCom (tolerância R$ 0,01)        | MOC cStat 629/630 (nota *4)                             |
| Item: vICMS = vBC × pICMS (CST 00/10/20/70)             | MOC regra N17-20, cStat 528                             |
| CST 51: vICMS = vICMSOp − vICMSDif                      | MOC regra N17-10, cStat 353                             |
| Situação do protocolo (100/150/110/301-303)             | MOC 7.0 — Anexo I, seções 4.4.1/4.4.3                   |
| Homologação → “SEM VALOR FISCAL”                        | MOC 7.0 — Anexo II                                      |

### Fábrica de fixtures (`danfe-br/fixtures`)

Gera XMLs sintéticos **realistas** (empresas fictícias, chaves com DV válidos,
totais recomputados que passam na validação) — útil para testes de
integrações:

```ts
import {
  montaNFe,
  montaNFeProc,
  nfeProcToXml,
  itemSintetico,
  protNFeSintetico,
  montaEvento,
  eventoToXml,
  cnpjSintetico,
} from 'danfe-br/fixtures';

const nfe = montaNFe({
  seed: 'minha-nota',
  itens: [
    itemSintetico({
      seed: 'item-1',
      icms: { grupo: 'ICMS00', orig: 0, cst: '00', modBC: 3, vBC: 1000, pICMS: 18, vICMS: 0 },
    }),
  ],
});
const xml = nfeProcToXml(montaNFeProc(nfe, protNFeSintetico(nfe)));
```

Determinística: a mesma `seed` produz os mesmos bytes.

## Cobertura do modelo tipado

Layout **4.00** conforme os XSDs oficiais (vendados em [`schemas/`](schemas/)):

- `ide` (incluindo `NFref`), `emit`, `dest`;
- `det/prod` e `det/imposto`: **todos os grupos de ICMS** (CST 00, 02, 10, 15,
  20, 30, 40/41/50, 51, 53, 60, 61, 70, 90 + `ICMSPart` + `ICMSST`) e
  **todos os CSOSN** (101, 102/103/300/400, 201, 202/203, 500, 900), `IPI`
  (IPITrib/IPINT), `PIS`/`COFINS` (Aliq/Qtde/NT/Outr), `ICMSUFDest`, `II`,
  `ISSQN` por item e **IBS/CBS da Reforma Tributária (NT 2024.002 v1.10)**;
- `total` (`ICMSTot`, `ISSQNtot`, `retTrib`, `IBSCBSSelTot`);
- `transp` (transporta, `retTransp`, veículo, reboques, volumes com lacres);
- `cobr` (fatura e duplicatas), `pag` (todas as formas de pagamento, cartões,
  troco), `infAdic`, `infRespTec`, `autXML` e `infNFeSupl` (QR Code da NFC-e,
  em CDATA);
- protocolo `protNFe` e eventos (`procEventoNFe`, cancelamento e CC-e),
  incluindo o `detEvento` genérico (`xs:anyType`).

## Desenvolvimento

```bash
npm install        # dependências
npm run verify     # typecheck + lint + format + build + testes
npm run fixtures   # regenera o corpus em tests/fixtures/ (determinístico)
```

- Testes: **vitest** — 173 testes, incluindo o corpus com 45 XMLs em
  `tests/fixtures/` (uma nota por CST/CSOSN, 10/60/120 itens, duplicatas,
  transporte, homologação, denegada, sem protocolo, CNPJ alfanumérico, DIFAL,
  ISSQN conjugado, IBS/CBS, 3 NFC-e's, cancelamento e CC-e).
- Finais de linha: **LF** (`.gitattributes`).
- CI: GitHub Actions em ubuntu/windows/macos × Node 20/22/24.

## Fontes oficiais

- [MOC 7.0 e anexos](https://www.confaz.fazenda.gov.br/legislacao/arquivo-manuais)
  (Ato COTEPE ICMS 69/20) — Visão Geral, Anexo I (leiaute e regras de
  validação) e Anexo II (DANFE).
- [Portal Nacional da NF-e](https://www.nfe.fazenda.gov.br) e
  [Portal DFe da SVRS](https://dfe-portal.svrs.rs.gov.br/NFe/Documentos)
  (schemas XSD PL_009q e notas técnicas 2024.002, 2025.001 etc.).
- XSDs oficiais vendados em [`schemas/`](schemas/README.md) com fonte e data.

## Licença

[MIT](LICENSE) © Hadagalberto Junior.
