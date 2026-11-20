# danfe-br — SPEC

**danfe-br**: TypeScript library + CLI for Brazilian electronic invoices (NF-e modelo 55 and NFC-e modelo 65):
parse the authorized XML (`nfeProc`), validate it, and render the official auxiliary documents as PDF — **DANFE** (retrato and paisagem)
and **DANFE NFC-e** (thermal 80 mm / 58 mm, with the consultation QR Code) — plus a structured JSON model and a ESC/POS output for thermal printers.
Works in Node and in the browser (pure TS, no native deps). Open source, MIT, "Hadagalberto Junior".
NOT a toy: no stubs, no TODO, no skipped or placeholder tests.

## Sources of truth (fetch and cite during work, never guess)
- Manual de Orientação do Contribuinte (MOC) NF-e versão 7.0 + Notas Técnicas in force (layout 4.00), especially the DANFE section (Anexo II) with field placement and minimum sizes.
- Manual de Especificações Técnicas do DANFE NFC-e e QR Code (versão vigente, QR Code v2 and v3 when published).
- Official XSDs (PL_009 package). Vendor them in `schemas/` with source URL and version recorded in `schemas/README.md`.

## Stack
TypeScript strict, ESM + CJS dual build (tsup), Node ≥ 20, vitest, eslint + prettier, `.gitattributes` `* text=auto eol=lf`.
PDF generation with `pdf-lib` (only runtime deps allowed: pdf-lib, a pure-JS XML parser such as fast-xml-parser, and a barcode/QR implementation written in-house — Code 128C for the chave de acesso and QR Code encoder with error correction M, implemented and tested here).
GitHub Actions CI ubuntu/windows/macos, Node 20/22/24. README.md (pt-BR) + README.en.md, CHANGELOG, CONTRIBUTING, LICENSE. Do not publish to npm.

## Parsing and model
- Parse `nfeProc`, bare `NFe`, `procEventoNFe` (cancelamento, CC-e) and NFC-e; typed model covering ide, emit, dest, det/prod/imposto (ICMS all CSTs/CSOSN, IPI, PIS, COFINS, ICMSUFDest, IBS/CBS from the reforma tributária NT 2024.002 when present), total, transp (volumes, reboque), cobr (fat/dup), pag, infAdic, infRespTec, autXML.
- Validation: chave de acesso check digit (módulo 11) and consistency with ide fields; CNPJ/CPF digits (incl. alphanumeric CNPJ); totals recomputation (vProd, vNF, vICMS...) with tolerance rules; protocol presence (cStat 100/150) vs. "SEM VALOR FISCAL" watermark for homologação or unauthorized; optional XSD validation hook (no native libxml requirement in core).
- Signature: verify the XMLDSig RSA-SHA1 signature of infNFe (C14N implemented and tested against known-good signed samples). Report, never throw, on invalid signatures.

## Rendering
- DANFE retrato and paisagem following Anexo II layout: canhoto, header with logo (optional PNG/JPEG), Code 128C barcode of the chave, all quadros (destinatário, fatura/duplicatas, cálculo do imposto, transportador, produtos with automatic pagination and continuation pages "Folha X/Y", ISSQN, dados adicionais with overflow to continuation), font size rules, cancelled/denegada/contingência watermarks.
- DANFE NFC-e 80 mm and 58 mm: items detail optional, totals, payment, consumer, QR Code built from the XML's `qrCode` field, chave grouped in blocks of 4.
- ESC/POS byte stream for NFC-e (with native QR command) as an alternative output.
- Embed a metric-compatible open font (Liberation Sans or similar, OFL) for deterministic output.

## API / CLI
`parseNFe(xml)`, `validateNFe(model)`, `renderDanfe(model, options): Promise<Uint8Array>`, `renderDanfeNfce(...)`, `toEscPos(...)`.
CLI: `danfe nota.xml -o nota.pdf`, `--layout paisagem`, `--logo logo.png`, `--json`, `--validate` (exit code ≠ 0 on errors), batch over directories.

## Tests
- Corpus of realistic XMLs in `tests/fixtures/` built by the project (synthetic companies, valid check digits) covering every CST family, many items (pagination 1, 2, 10 pages), duplicatas, transport, homologação, cancelled event, NFC-e.
- Visual regression: render PDFs to PNG in tests (pdf.js) and compare against committed golden images with a small pixel tolerance; text extraction tests asserting each field appears in its quadro.
- Barcode/QR: decode generated Code 128 and QR with an independent decoder (e.g. jsQR / zxing-js as devDependency) and assert round-trip.
- Signature verification against known-good and tampered samples.

## Hard constraints
- Never run `git push`, `gh`, `npm publish`, or publish anything. Commit locally after each milestone. Stay inside this repository.
