# danfe-br (English)

[![CI](https://github.com/hadagalberto/danfe-br/actions/workflows/ci.yml/badge.svg)](https://github.com/hadagalberto/danfe-br/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**danfe-br** is a pure-TypeScript library (no native dependencies) for
Brazilian electronic invoices — **NF-e (model 55)** and **NFC-e (model 65)**.
It parses the authorized XML, validates the document and renders the official
auxiliary documents as PDF: **DANFE** (portrait and landscape) and
**DANFE NFC-e** (80 mm and 58 mm, with the QR Code), plus an **ESC/POS** byte
stream for thermal printers.

> Status: **Milestones 1–6 complete** — typed model, parser, validation
> (including an **optional XSD hook**), fixture factory, barcodes (Code 128 /
> QR Code), XMLDSig verification of `infNFe`, portrait **and landscape DANFE**,
> NFC-e (80/58 mm), ESC/POS output, event documents (cancellation and
> correction letter) and the **`danfe` CLI** (single file, batch, `--layout`,
> `--logo`, `--json`, `--validate`). The ESM build is also smoke-tested in a
> browser-like context. Milestone 6 audited every SPEC item and recorded the
> result in [`docs/SPEC-CHECKLIST.md`](docs/SPEC-CHECKLIST.md).

## Gallery

Images generated from the visual regression goldens (`npm run docs:images`):

<p align="center">
  <img src="docs/images/danfe-retrato.png" width="280" alt="Portrait DANFE">
  <img src="docs/images/danfe-paisagem.png" width="380" alt="Landscape DANFE">
</p>
<p align="center"><em>Portrait and landscape DANFE (MOC 7.0 — Anexo II).</em></p>

<p align="center">
  <img src="docs/images/danfe-nfce-80.png" width="180" alt="80 mm NFC-e DANFE">
  <img src="docs/images/danfe-nfce-58.png" width="140" alt="58 mm NFC-e DANFE">
  <img src="docs/images/danfe-homologacao.png" width="180" alt="Homologation DANFE">
  <img src="docs/images/evento-cancelamento.png" width="180" alt="Cancellation receipt">
</p>
<p align="center"><em>80/58 mm NFC-e, homologation watermark and cancellation receipt.</em></p>

## Install

The package is **not published to npm** (per the SPEC). To use it locally:

```bash
git clone https://github.com/hadagalberto/danfe-br
cd danfe-br
npm install
npm run build
```

Requires **Node.js ≥ 20**. Works in Node and the browser (pure TS, no native
deps). Dual build: ESM + CJS. After building, the binary is `dist/cli.js` (use
`node dist/cli.js ...` in the examples below).

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

### Optional XSD validation hook

The core **does not** require native libxml (the SPEC restricts runtime deps to
`pdf-lib`, a pure-JS XML parser and the in-house barcodes). Instead, callers
inject any validator they choose (libxml, Xerces, a SEFAZ service, etc.). The
official PL 009q / PL 010b XSDs are already vendored in
[`schemas/`](schemas/README.md) and `detectaEsquemaXsd` reports which one applies:

```ts
import { validaNFeComXsd, detectaEsquemaXsd } from 'danfe-br';

detectaEsquemaXsd(xml)?.arquivo;
// 'schemas/PL_009q_NT2025_001_v1.00/procNFe_v4.00.xsd'

const result = await validaNFeComXsd(xml, async (conteudo, esquema) => {
  // `esquema.arquivo` points at the official XSD; call your validator here.
  const erros = await meuValidadorXsd(conteudo, esquema.arquivo);
  return { valido: erros.length === 0, problemas: erros };
});

result.valido; // structure (key, documents, totals, protocol) **and** XSD
result.xsd.problemas; // normalized XSD problems (XSD_* codes)
```

The hook may be synchronous or asynchronous. Validator failures are reported
as `XSD_HOOK_FALHA` problems — never thrown. Sources: NF-e SVRS portal
<https://dfe-portal.svrs.rs.gov.br/NFe/Documentos> (MOC 7.00 and schema
packages) and `schemas/README.md`.

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

### Landscape DANFE, NFC-e, ESC/POS and events (milestone 4)

```ts
import { renderDanfe, renderDanfeNfce, toEscPos, renderEvento } from 'danfe-br';

const landscape = await renderDanfe(proc, { layout: 'paisagem' }); // MOC §3.8.2
const receipt80 = await renderDanfeNfce(procNfce);
const receipt58 = await renderDanfeNfce(procNfce, { larguraMm: 58 });
const escpos = toEscPos(procNfce); // native GS ( k QR command, PC860, partial cut
const cancellation = await renderEvento(procCancellation); // CANCELADO stamp
const correction = await renderEvento(procCCe);
```

The NFC-e follows the official
[SVRS NFC-e manuals](https://dfe-portal.svrs.rs.gov.br/Nfce/Documentos)
(Manual de Padrões Técnicos v5.1 and Manual de Especificações Técnicas v5.0):
divisions I–IX, 2 mm margins, 25 × 25 mm QR Code with level M/UTF-8 generated
from the XML `qrCode` field, and the access key in 11 groups of 4 digits.
The QR Code is encoded **verbatim** from the XML `qrCode` field — no parameters
are recomputed — so layouts v1/v2 and the **version 3** payload defined by
[NT 2025.001 v1.01 — “NFC-e: Leiaute do QR-Code versão 3”](https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=trSXReoZPuY=)
(26/06/2025, joint technical act 2/2026) are both supported. A round-trip test
uses a version-3 payload. ESC/POS command bytes are asserted with exact vectors
in the test suite; the Epson references are cited in `src/render/escppos.ts`.

### `danfe` CLI (milestone 5)

The package installs the `danfe` binary:

Examples **executed and verified** in this repository (outputs under `.tmp/`):

```bash
node dist/cli.js tests/fixtures/nfe-cst-00.xml -o .tmp/nota.pdf
# exit 0 → .tmp/nota.pdf (%PDF-)

node dist/cli.js tests/fixtures/nfe-cst-00.xml \
  --layout paisagem --logo docs/images/danfe-retrato.png -o .tmp/nota-paisagem.pdf
# exit 0 → landscape A4 PDF with logo

node dist/cli.js tests/fixtures/nfce-anonima.xml --papel 58 -o .tmp/cupom.pdf
# exit 0 → 58 mm thermal NFC-e (model 65 auto-detected)

node dist/cli.js tests/fixtures/nfe-cst-00.xml --validate
# exit 0, no output: authorized and consistent invoice

mkdir -p .tmp/notas && cp tests/fixtures/nfe-cst-00.xml tests/fixtures/nfe-duplicatas.xml .tmp/notas/
node dist/cli.js .tmp/notas -o .tmp/pdfs/
# exit 0 → .tmp/pdfs/nfe-cst-00.pdf and .tmp/pdfs/nfe-duplicatas.pdf

node dist/cli.js tests/fixtures/nfe-cst-00.xml --validate --json
# exit 0 → JSON with key, model, number, series, issuer and validation

node dist/cli.js --help          # exit 0
node dist/cli.js --version       # exit 0 → danfe-br 0.1.0
```

`--json` includes, among other fields,
`"chave": "35260110562655620245550280000217691341262140"`,
`"modelo": 55`, `"emitente": "Indústria Vale Verde Ltda"` and
`"validacao": { "valido": true, ... }`. Combined with `--validate`, no PDF is
written. To see a real validation error, change the check digit in a copy of
the XML and run `--validate`: the result is `exit 1` with
`erro CHAVE_DV [B23-10] (cStat 253): Dígito verificador ... inválido`.

- `--layout` accepts `retrato` (default), `paisagem` and `nfce`; when omitted,
  model 65 documents are rendered as NFC-e automatically. `--papel` selects
  80 mm (default) or 58 mm.
- `--logo` accepts PNG or JPEG (file signature checked).
- `--json` prints the key, model, number, series, issuer and the full validation
  result; it can be combined with PDF generation.
- `--validate` writes no PDF and exits **1** on any validation error (access
  key digit, CNPJ/CPF, totals, protocol), **0** otherwise. Warnings (e.g.
  homologation "SEM VALOR FISCAL") do not change the exit code.
- Exit codes: **0** success, **1** invalid document/processing error,
  **2** invalid usage (unknown option, `--output` unsuitable for a batch, etc.).
- Batch mode ignores non-`.xml` files and creates the output directory if
  needed. Without `-o`, each PDF is written next to its source XML.

## Development

```bash
npm install
npm run verify     # typecheck + lint + format + build + tests
npm run fixtures   # regenerate the corpus in tests/fixtures/ (deterministic)
npm run golden     # regenerate tests/golden/
npm run docs:images # regenerate docs/images/ from tests/golden/
```

Tests run on **vitest** (313 tests), including a committed corpus of 47 XML
fixtures in `tests/fixtures/` (one invoice per CST/CSOSN family, 10/60/120
items (10/20/60/95/120 → 1/2/6/10/12 pages), installments, transport,
homologation, denied, no-protocol, alphanumeric CNPJ, DIFAL, mixed ISSQN,
IBS/CBS, three NFC-e's, cancellation and correction-letter events), 15 CLI
tests, 3 ESM-build tests in happy-dom, 13 XSD-hook tests, 21 hardening
tests and 2 new dynamic corpus cases (milestone 6).
The browser test imports the **published ESM bundle** (`dist/index.js`) inside
happy-dom and validates real rendered PDFs with `pdf-lib`; the CLI suite also
spawns the actual binary to assert exit codes 0/1/2.

## Official sources

- MOC 7.0 and annexes (CONFAZ, Ato COTEPE ICMS 69/20), including the landscape
  layout in Anexo II §3.8.2 / Anexo III.04.
- SVRS NFC-e manuals portal: DANFE NFC-e technical specification v5.0 and DANFE
  NFC-e standards manual v5.1.
- National NF-e portal and SVRS DFe portal (XSD packages PL_009q / PL_010b,
  technical notes 2024.002 / 2025.001 etc.).
- [NT 2025.001 v1.01 — NFC-e QR Code version 3](https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=trSXReoZPuY=)
  (26/06/2025): `https://endereco-consulta-QRCode?p=|<chave>|...`.
- Official XSDs vendored under [`schemas/`](schemas/README.md) with source
  URLs and versions.

## License

[MIT](LICENSE) © Hadagalberto Junior.
