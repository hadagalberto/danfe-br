# Contribuindo com o danfe-br

Obrigado pelo interesse! Este documento resume o processo.

## Requisitos

- Node.js ≥ 20 (o CI roda 20/22/24 em ubuntu, windows e macos).
- npm.

## Fluxo básico

```bash
git clone https://github.com/hadagalberto/danfe-br
cd danfe-br
npm install
npm run verify   # typecheck + lint + format:check + build + test
```

`npm run verify` deve terminar limpo antes de qualquer commit. O projeto roda
com TypeScript `strict` (+ `noUncheckedIndexedAccess`) e ESLint com regras
com verificação de tipos — warnings são tratados como erros.

### Testes

- Suíte: **vitest** (`npm run test`; `npm run test:watch` para modo watch).
- Corpus de fixtures: `tests/fixtures/` é gerado por `npm run fixtures`
  (scripts/generate-fixtures.ts). **Não edite os XMLs à mão** — altere o
  gerador e rode o script. O teste `tests/corpus.test.ts` verifica a
  regeneração byte a byte, então qualquer mudança manual falha no CI.
- Vetores inválidos (DV errado, CNPJ inválido etc.) vivem nos testes
  unitários como mutações de fixtures/objetos — não no corpus, que contém
  apenas documentos válidos.

### Regras de ouro (da SPEC)

1. **Nada de stub/TODO/NotImplementedException** — tudo implementado ou nada.
2. **Nunca invente regras fiscais.** Toda regra de validação/leiaute deve citar
   a fonte oficial (MOC 7.0 e anexos, notas técnicas, XSD) em comentário —
   se precisar, **busque a fonte** antes de escrever o código. Os XSDs
   oficiais estão em `schemas/`.
3. **Não enfraqueça testes para fazê-los passar** — corrija a causa raiz.
4. **Finais de linha LF** em tudo (`.gitattributes` cuida disso; verifique
   `git diff --check`).
5. **Não publique** o pacote no npm nem faça push de releases — a SPEC
   proíbe publicação.

### Mensagens de commit

Formato [Conventional Commits](https://www.conventionalcommits.org/pt-br):
`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, etc.

### Estrutura

```
src/model/     tipos do leiaute (nfe, eventos, tipos básicos)
src/parse/     XML -> modelo tipado (nfeProc, NFe, eventos)
src/validate/  chave, documentos, totais, protocolo, orquestrador
src/fixtures/  fábrica de XMLs sintéticos + escritor XML
schemas/       XSDs oficiais vendados (PL_009q, eventos, PL_010b/RTC)
scripts/       gerador do corpus de fixtures
tests/         vitest + corpus em tests/fixtures/
```

Ao adicionar grupos do leiaute, siga o padrão existente: nomes idênticos às
tags XML, IDs do MOC nos comentários (B02, W07, UB01...) e obrigatoriedade
espelhando o XSD.
