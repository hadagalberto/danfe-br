#!/usr/bin/env node
/** Binário `danfe`. Toda a lógica vive em `./index.ts` (testável sem processo). */
import { executaCli } from './index';

// Sem top-level await: o mesmo arquivo é compilado para ESM e CJS pelo tsup.
executaCli(process.argv.slice(2)).then(
  (resultado) => {
    process.exitCode = resultado.codigo;
  },
  (erro: unknown) => {
    const mensagem = erro instanceof Error ? erro.message : String(erro);
    process.stderr.write(`danfe: falha inesperada: ${mensagem}\n`);
    process.exitCode = 1;
  },
);
