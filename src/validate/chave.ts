/**
 * Validação da chave de acesso da NF-e (44 posições).
 *
 * Fontes oficiais:
 * - MOC 7.0 — Visão Geral, seção 2.2.6 (Chave de Acesso, layout 4.00) e
 *   2.2.6.2 (Cálculo do DV módulo 11, com exemplo completo;
 *   Ato COTEPE ICMS 69/20).
 * - MOC 7.0 — Anexo I, regras A03-10 (cStat 502: Id não corresponde à
 *   concatenação dos campos) e B23-10 (cStat 253: DV inválido).
 * - NT 2025.001 v1.00 (CNPJ Alfanumérico), seção 5: a chave passa a aceitar
 *   letras nas 12 posições da base do CNPJ — expressão regular oficial
 *   `[0-9]{6}[A-Z0-9]{12}[0-9]{26}` — e o DV da chave substitui cada
 *   caractere pelo seu código ASCII menos 48 (A=17, B=18, ...) antes do
 *   módulo 11. Para chaves numéricas o cálculo é idêntico ao do MOC
 *   (dígitos valem 0-9).
 *
 * Composição da chave (MOC 7.0 — Visão Geral, Tabela 2-1):
 *   cUF(2) + AAMM(4, extraído de dhEmi) + CNPJ/CPF do emitente(14) +
 *   mod(2) + série(3) + nNF(9) + tpEmis(1) + cNF(8) + DV(1)
 */
import type { ProblemaValidacao } from '../model/comum';
import type { NFe } from '../model/nfe';

/** Pesos do módulo 11: 2, 3, 4, ..., 9, 2, 3, ... da direita para a esquerda. */
const PESOS_MOD11 = [2, 3, 4, 5, 6, 7, 8, 9];

/**
 * Chave de acesso sem o DV (43 posições): 6 dígitos (cUF + AAMM) + 12
 * alfanuméricos (base do CNPJ; dígitos quando o emitente tem CNPJ numérico
 * ou CPF) + 25 dígitos (NT 2025.001, seção 5).
 */
const RE_CHAVE_SEM_DV = /^[0-9]{6}[A-Z0-9]{12}[0-9]{25}$/;

/** Chave de acesso completa (44 posições, NT 2025.001: `[0-9]{6}[A-Z0-9]{12}[0-9]{26}`). */
const RE_CHAVE_COMPLETA = /^[0-9]{6}[A-Z0-9]{12}[0-9]{26}$/;

/**
 * Valor de um caractere para o módulo 11 da chave: ASCII − 48 (NT 2025.001,
 * seção 5) — dígitos 0-9 valem 0-9 e letras A-Z valem 17-42.
 */
function valorCaractere(ch: string): number {
  return ch.charCodeAt(0) - 48;
}

/**
 * Calcula o dígito verificador (módulo 11) dos 43 primeiros caracteres da
 * chave de acesso (MOC 7.0 — Visão Geral, 2.2.6.2: “DV = 11 − resto”; quando o
 * resto for 0 ou 1, o DV é 0; NT 2025.001: caracteres convertidos por
 * ASCII − 48).
 *
 * Exemplo oficial do MOC: a chave `5206043300991100250655012000000780026730161`
 * tem somatória de ponderações 644, resto 6 e DV `5`.
 */
export function digitoVerificadorChave(chave43: string): number | undefined {
  if (!RE_CHAVE_SEM_DV.test(chave43)) return undefined;
  let soma = 0;
  for (let i = chave43.length - 1, peso = 0; i >= 0; i--, peso++) {
    soma += valorCaractere(chave43[i]!) * PESOS_MOD11[peso % PESOS_MOD11.length]!;
  }
  const resto = soma % 11;
  return resto === 0 || resto === 1 ? 0 : 11 - resto;
}

/**
 * Verifica se a chave de acesso tem 44 posições no formato oficial e DV
 * válido (MOC B23-10, cStat 253; regex da NT 2025.001, seção 5).
 */
export function chaveAcessoValida(chave: string): boolean {
  if (!RE_CHAVE_COMPLETA.test(chave)) return false;
  const dvInformado = Number(chave.slice(43));
  const dvCalculado = digitoVerificadorChave(chave.slice(0, 43));
  return dvCalculado === dvInformado;
}

/**
 * Extrai AAMM (ano/mês) de um `dhEmi` ISO-8601 no formato do layout 4.00
 * (`AAAA-MM-DDTHH:MM:SS±HH:MM` ou `AAAA-MM-DDTHH:MM:SSZ`).
 */
export function aammDeDhEmi(dhEmi: string): string | undefined {
  const m = /^(\d{4})-(\d{2})-\d{2}T/.exec(dhEmi);
  if (!m) return undefined;
  return `${m[1]!.slice(2)}${m[2]}`;
}

/**
 * Componha a chave de acesso a partir dos dados de `ide` e do documento do
 * emitente (MOC 7.0 — Visão Geral, Tabela 2-1). CNPJ/CPF é completado com
 * zeros à esquerda até 14 posições (com um CNPJ alfanumérico as letras
 * permanecem — NT 2025.001, seção 5); série/nNF/cNF idem até seus tamanhos.
 */
export function montaChaveDeAcesso(input: {
  cUF: number;
  aamm: string;
  docEmitente: string;
  mod: number;
  serie: number;
  nNF: number;
  tpEmis: number;
  cNF: string;
}): string {
  const doc = input.docEmitente.padStart(14, '0');
  const chave43 =
    String(input.cUF).padStart(2, '0') +
    input.aamm +
    doc +
    String(input.mod).padStart(2, '0') +
    String(input.serie).padStart(3, '0') +
    String(input.nNF).padStart(9, '0') +
    String(input.tpEmis) +
    input.cNF.padStart(8, '0');
  const dv = digitoVerificadorChave(chave43);
  if (dv === undefined) {
    throw new Error(`Não foi possível calcular o DV da chave: ${chave43}`);
  }
  return `${chave43}${dv}`;
}

/**
 * Chave de acesso esperada para uma NF-e já parseada (concatenação oficial
 * dos campos de `ide` + documento do emitente).
 */
export function chaveEsperada(nfe: NFe): string | undefined {
  const aamm = aammDeDhEmi(nfe.ide.dhEmi);
  if (!aamm) return undefined;
  const doc = nfe.emit.cnpj ?? nfe.emit.cpf;
  if (!doc) return undefined;
  return montaChaveDeAcesso({
    cUF: nfe.ide.cUF,
    aamm,
    docEmitente: doc,
    mod: nfe.ide.mod,
    serie: nfe.ide.serie,
    nNF: nfe.ide.nNF,
    tpEmis: nfe.ide.tpEmis,
    cNF: nfe.ide.cNF,
  });
}

/**
 * Valida o DV da chave (MOC B23-10, cStat 253) e a consistência da chave com os
 * campos de `ide` e do emitente (MOC A03-10, cStat 502), além da coesão do
 * `cDV` declarado em `ide`. Anota problemas — não lança exceções.
 */
export function validaChaveNFe(nfe: NFe): ProblemaValidacao[] {
  const problemas: ProblemaValidacao[] = [];
  const chave = nfe.chave;

  if (!RE_CHAVE_COMPLETA.test(chave)) {
    problemas.push({
      severity: 'erro',
      code: 'CHAVE_FORMATO',
      campo: 'infNFe@Id',
      message: `Chave de acesso fora do formato oficial [0-9]{{6}}[A-Z0-9]{{12}}[0-9]{{26}} (NT 2025.001): ${chave.length} caracteres.`,
    });
    return problemas;
  }

  const dvInformado = Number(chave.slice(43));
  const dvCalculado = digitoVerificadorChave(chave.slice(0, 43));
  if (dvCalculado !== dvInformado) {
    problemas.push({
      severity: 'erro',
      code: 'CHAVE_DV',
      regra: 'B23-10',
      cStat: 253,
      campo: 'infNFe@Id',
      message: `Dígito verificador da chave de acesso inválido: informado ${dvInformado}, calculado ${dvCalculado}.`,
    });
  }

  // cDV declarado em ide deve ser o DV da chave (B23).
  if (nfe.ide.cDV !== dvCalculado) {
    problemas.push({
      severity: 'erro',
      code: 'CHAVE_CDV_DIVERGENTE',
      regra: 'A03-10',
      cStat: 502,
      campo: 'ide/cDV',
      message: `cDV informado (${nfe.ide.cDV}) diverge do dígito verificador calculado (${dvCalculado}).`,
    });
  }

  // Consistência com os campos de ide/emit (A03-10, cStat 502).
  const esperada = chaveEsperada(nfe);
  if (esperada === undefined) {
    problemas.push({
      severity: 'erro',
      code: 'CHAVE_DADOS_INSUFICIENTES',
      campo: 'ide/dhEmi | emit/CNPJ|CPF',
      message:
        'Não foi possível remontar a chave de acesso (dhEmi em formato inválido ou emitente sem CNPJ/CPF).',
    });
  } else if (esperada !== chave) {
    problemas.push({
      severity: 'erro',
      code: 'CHAVE_CONSISTENCIA',
      regra: 'A03-10',
      cStat: 502,
      campo: 'infNFe@Id',
      message: `Chave de acesso não corresponde à concatenação dos campos (esperada ${esperada}).`,
    });
  }

  return problemas;
}
