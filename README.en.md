# danfe-br (English)

[![CI](https://github.com/hadagalberto/danfe-br/actions/workflows/ci.yml/badge.svg)](https://github.com/hadagalberto/danfe-br/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**danfe-br** is a pure-TypeScript library (no native dependencies) for
Brazilian electronic invoices — **NF-e (model 55)** and **NFC-e (model 65)**.
It parses the authorized XML, validates the document and renders the official
auxiliary documents as PDF: **DANFE** (portrait and landscape) and
**DANFE NFC-e** (80 mm and 58 mm, with the QR Code), plus an **ESC/POS** byte
stream for thermal printers.

> Status: **Milestones 1, 2 and 3 complete** — typed model, parser, validation,
> fixture factory, barcodes (Code 128 / QR Code), XMLDSig verification of
> `infNFe` and **portrait DANFE** PDF rendering per MOC 7.0 Anexo II.
> Landscape DANFE, NFC-e, ESC/POS and the CLI arrive in later milestones.

## Install

```bash
npm install danfe-br
```

Requires **Node.js ≥ 20**. Works in Node and the browser (pure TS, no native
deps). Dual build: ESM + CJS.

## Usage

### Parsing the authorized XML

```ts
import { parseNFe, validateNFe } from 'danfe-br';

const proc = parseNFe(xml); // nfeProc (with protocol) or bare NFe

proc.nfe.chave; // 44-position access key
proc.nfe.ide.nNF; // invoice number
proc.nfe.det[0].imposto.icms; // typed ICMS group (union by CST/CSOSN)
proc.protNFe?.cStat; // 100 = authorized
```

Events (cancellation and correction letter):

```ts
import { parseEventoNFe } from 'danfe-br';

const evento = parseEventoNFe(eventXml);
// root: procEventoNFe, procEventoCancNFe (110111) or procCCeNFe (110110)
evento.evento.infEvento.detEvento; // specialized by tpEvento
```

### Validation (reports, never throws)

```ts
const result = validateNFe(proc);

result.valido; // any errors?
result.problemas; // errors + warnings, with official rule/cStat
result.situacaoProtocolo.autorizada; // cStat 100/150
result.situacaoProtocolo.semValorFiscal; // homologation/unauthorized
```

Validations in this milestone (each cites its official source in code):
access-key check digit (module 11, per MOC 7.0 — Visão Geral 2.2.6.2, rule
B23-10/cStat 253) and consistency with `ide` (A03-10/cStat 502); numeric and
**alphanumeric CNPJ** (ASCII−48 per NT 2025.001, cStat 207/208); CPF (cStat
401/237); totals recomputation (cStat 531-609) including the official `vNF`
formula (W16-10/cStat 610, R$ 0.50 tolerance); per-item recomputation (cStat
629/630, 528, 353); protocol status (cStat 100/150/110/301-303) and the
“SEM VALOR FISCAL” (no fiscal value) rules for homologation.

### Fixture factory (`danfe-br/fixtures`)

Generates **realistic** synthetic XMLs (fictional companies, valid check
digits, totals recomputed to pass validation):

```ts
import {
  montaNFe,
  montaNFeProc,
  nfeProcToXml,
  itemSintetico,
  protNFeSintetico,
} from 'danfe-br/fixtures';

const nfe = montaNFe({
  seed: 'my-invoice',
  itens: [
    itemSintetico({
      seed: 'item-1',
      icms: { grupo: 'ICMS00', orig: 0, cst: '00', modBC: 3, vBC: 1000, pICMS: 18, vICMS: 0 },
    }),
  ],
});
const xml = nfeProcToXml(montaNFeProc(nfe, protNFeSintetico(nfe)));
```

Deterministic: the same `seed` produces identical bytes.

### Barcodes (milestone 2)

```ts
import { encodeCode128, encodeQrCode } from 'danfe-br';

const barcode = encodeCode128(nfe.chave); // Code 128C with Code B fallback
barcode.larguras; // bar/space module widths, ready to rasterize
barcode.larguraModulos; // width excluding the quiet zone

const qr = encodeQrCode(nfceConsultUrl, { nivelCorrecao: 'M' });
qr.versao; // 1–40 (smallest that fits, chosen automatically)
qr.mascara; // 0–7, lowest N1–N4 penalty (ISO/IEC 18004)
qr.modulos; // [y][x] matrix, `true` = dark
qr.paraSvg(4, 4); // standalone SVG with quiet zone
```

Both are pure TS with no runtime dependencies. Tests decode the generated
symbols with independent decoders (`@zxing/library` for Code 128, `jsQR` for
QR), including all 40 QR versions.

### XMLDSig verification (milestone 2)

```ts
import { verificaAssinaturaNFe } from 'danfe-br';

const resultado = verificaAssinaturaNFe(xmlAutorizado);

resultado.valido; // DigestValue (C14N + SHA-1) and SignatureValue (RSA-SHA1) match?
resultado.erros; // failure reasons — never throws on an invalid signature
resultado.detalhes.digestValido;
resultado.detalhes.assinaturaValida;
resultado.detalhes.certificado.bitsModulo; // RSA key extracted from the X.509 cert
```

NF-e profile: C14N 1.0 without comments, SHA-1, RSA-SHA1 (PKCS#1 v1.5) and the
X.509 certificate in `KeyInfo/X509Data/X509Certificate`. The ICP-Brasil trust
chain and certificate validity period are **not** evaluated — only the
cryptographic integrity of `infNFe`.

### Portrait DANFE (milestone 3)

```ts
import { renderDanfe } from 'danfe-br';

const pdf: Uint8Array = await renderDanfe(proc, {
  logo: logoPngOrJpeg, // optional (MOC §3.1.3)
  eventos: [cancellationEvent], // optional — enables the CANCELADA watermark
});
```

A4 portrait PDF following MOC 7.00 Anexo II: canhoto, optional logo, Code 128C
chave barcode, all quadros, minimum font sizes, automatic product pagination
with `FOLHA X/Y` continuation sheets, additional-information overflow and the
`SEM VALOR FISCAL` / `CANCELADA` / `DENEGADA` / `CONTINGÊNCIA` watermarks. The
embedded font is DANFE Sans (subset of Liberation Sans, SIL OFL 1.1 — see
`assets/fonts/`). Visual regression tests rasterize with `pdfjs-dist` +
`@napi-rs/canvas` and compare against `tests/golden/`; regenerate with
`npm run golden`.

## Development

```bash
npm install
npm run verify     # typecheck + lint + format + build + tests
npm run fixtures   # regenerate the corpus in tests/fixtures/ (deterministic)
```

Tests run on **vitest** (173 tests), including a committed corpus of 45 XML
fixtures in `tests/fixtures/` (one invoice per CST/CSOSN family, 10/60/120
items, installments, transport, homologation, denied, no-protocol,
alphanumeric CNPJ, DIFAL, mixed ISSQN, IBS/CBS, three NFC-e's, cancellation
and correction-letter events).

## Official sources

- MOC 7.0 and annexes (CONFAZ, Ato COTEPE ICMS 69/20).
- National NF-e portal and SVRS DFe portal (XSD packages PL_009q, technical
  notes 2024.002 / 2025.001 etc.).
- Official XSDs vendored under [`schemas/`](schemas/README.md) with source
  URLs and versions.

## License

[MIT](LICENSE) © Hadagalberto Junior.
