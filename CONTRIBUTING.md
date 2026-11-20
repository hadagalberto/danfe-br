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

### CLI

O binário `danfe` é gerado em `dist/cli.js` a partir de `src/cli/main.ts`.
Toda a lógica (análise de argumentos, lote, saída, JSON e códigos de saída)
fica em `src/cli/index.ts`, com E/S injetada — mantenha-a livre de
`process.exit` para que os testes possam exercitá-la diretamente.

```bash
npm run build
node dist/cli.js --help
node dist/cli.js tests/fixtures/nfe-cst-00.xml -o /tmp/nota.pdf
node dist/cli.js tests/fixtures/nfe-cst-00.xml --validate
```

### Testes

- Suíte: **vitest** (`npm run test`; `npm run test:watch` para modo watch).
  O `globalSetup` (`tests/setup/build-esm.ts`) roda o tsup antes da suíte,
  então `npm test` funciona sem um `npm run build` prévio.
- `tests/cli.test.ts` cobre arquivo único, lote, leiautes, logotipo, JSON,
  códigos de saída e o binário real (`spawnSync`).
- `tests/browser-esm.test.ts` usa `// @vitest-environment happy-dom` e importa
  o **build ESM** (`dist/index.js`) — nunca os fontes em `src/` — para provar
  que o artefato distribuído funciona no navegador.
- Corpus de fixtures: `tests/fixtures/` é gerado por `npm run fixtures`
  (scripts/generate-fixtures.ts). **Não edite os XMLs à mão** — altere o
  gerador e rode o script. O teste `tests/corpus.test.ts` verifica a
  regeneração byte a byte, então qualquer mudança manual falha no CI.
- Vetores inválidos (DV errado, CNPJ inválido etc.) vivem nos testes
  unitários como mutações de fixtures/objetos — não no corpus, que contém
  apenas documentos válidos.
- Imagens dos READMEs: rode `npm run golden` e depois `npm run docs:images`.
  As imagens em `docs/images/` são recodificações determinísticas dos goldens;
  não as edite manualmente.

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
src/cli/       binário danfe (index.ts = lógica, main.ts = adaptador)
schemas/       XSDs oficiais vendados (PL_009q, eventos, PL_010b/RTC)
scripts/       geradores do corpus, dos goldens e das imagens dos READMEs
tests/         vitest + corpus em tests/fixtures/ + goldens em tests/golden/
tests/setup/   globalSetup que garante o build ESM antes da suíte
docs/images/   ilustrações dos READMEs (geradas de tests/golden/)
```

Ao adicionar grupos do leiaute, siga o padrão existente: nomes idênticos às
tags XML, IDs do MOC nos comentários (B02, W07, UB01...) e obrigatoriedade
espelhando o XSD.
