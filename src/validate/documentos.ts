/**
 * Validação de CNPJ (numérico e alfanumérico) e CPF.
 *
 * CNPJ — módulo 11 unificado numérico/alfanumérico:
 * - NT 2025.001 v1.00 (Nota Técnica Conjunta DFe — CNPJ Alfanumérico,
 *   25/04/2025, seção 2 e Anexo I): “os valores numéricos e alfanuméricos
 *   serão substituídos pelo valor decimal correspondente ao código constante
 *   na tabela ASCII e dele subtraído o valor 48” — logo, `0`–`9` valem 0–9 e
 *   `A`–`Z` valem 17–42. Pesos 2–9 distribuídos da direita para a esquerda;
 *   resto 0 ou 1 ⇒ DV 0.
 * - Referência oficial RFB: “Cálculo dos dígitos verificadores de CNPJ
 *   alfanumérico” (gov.br/receitafederal, documento técnico;
 *   exemplo validado: CNPJ `12.ABC.345/01DE-35` ⇒ DV `35`).
 * - O mesmo cálculo reproduz exatamente o DV dos CNPJs numéricos atuais.
 *
 * CPF — módulo 11 clássico com rejeição de zeros e dígitos repetidos,
 * conforme descrito nas regras do MOC 7.0 — Anexo I:
 * “CPF com zeros, nulo, 111..., 222..., ... ou dígito de controle inválido”
 * (regras que resultam nas rejeições 401 — emitente — e 237 — destinatário;
 * NT 2012/003).
 */
import type { ProblemaValidacao } from '../model/comum';

/** Pesos do 1º DV do CNPJ (sobre as 12 primeiras posições). */
const PESOS_CNPJ_DV1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
/** Pesos do 2º DV do CNPJ (sobre as 13 primeiras posições, incluindo o 1º DV). */
const PESOS_CNPJ_DV2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/** Valor de cada caractere para o DV do CNPJ: ASCII − 48 (NT 2025.001, seção 2). */
function valorCaractereCnpj(ch: string): number {
  return ch.charCodeAt(0) - 48;
}

function dvModulo11(soma: number): number {
  const resto = soma % 11;
  return resto === 0 || resto === 1 ? 0 : 11 - resto;
}

/**
 * Verifica se um CNPJ (numérico ou alfanumérico) é válido.
 *
 * Critérios (NT 2025.001 v1.00, Anexo I — implementação de referência em
 * JavaScript; e MOC 7.0 — Anexo I, regras C02-10/E02-10: “CNPJ com zeros,
 * nulo ou DV inválido”):
 * - 14 posições, as 12 primeiras `[A-Z0-9]`, os 2 DVs numéricos;
 * - não pode ser o CNPJ zerado;
 * - DVs conferem pelo módulo 11 com valores ASCII − 48.
 *
 * Exemplos conhecidos:
 * - `11222333000181` (11.222.333/0001-81, exemplo clássico numérico) → válido;
 * - `12ABC34501DE35` (12.ABC.345/01DE-35, exemplo da NT 2025.001/RFB) → válido.
 */
export function cnpjValido(cnpj: string): boolean {
  if (!/^[A-Z0-9]{12}[0-9]{2}$/.test(cnpj)) return false;
  if (cnpj === '00000000000000') return false;

  const base = cnpj.slice(0, 12);
  let somaDv1 = 0;
  let somaDv2 = 0;
  for (let i = 0; i < 12; i++) {
    const valor = valorCaractereCnpj(base[i]!);
    somaDv1 += valor * PESOS_CNPJ_DV1[i]!;
    somaDv2 += valor * PESOS_CNPJ_DV2[i]!;
  }
  const dv1 = dvModulo11(somaDv1);
  somaDv2 += dv1 * PESOS_CNPJ_DV2[12]!;
  const dv2 = dvModulo11(somaDv2);

  const informado = cnpj.slice(12);
  const calculado = `${dv1}${dv2}`;
  return informado === calculado;
}

/**
 * Verifica se um CPF (11 dígitos) é válido — módulo 11 clássico
 * (resto 0 ou 1 ⇒ DV 0), rejeitando zeros e dígitos repetidos
 * (MOC 7.0 — Anexo I, regras 401/237, NT 2012/003).
 *
 * Exemplos conhecidos: `11144477735` e `52998224725` → válidos;
 * `11144477736` (DV trocado) e `11111111111` (repetido) → inválidos.
 */
export function cpfValido(cpf: string): boolean {
  if (!/^[0-9]{11}$/.test(cpf)) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false; // zeros e sequências repetidas

  const digitos = cpf;
  let somaDv1 = 0;
  for (let i = 0; i < 9; i++) {
    somaDv1 += (digitos.charCodeAt(i) - 48) * (10 - i);
  }
  const dv1 = dvModulo11(somaDv1);

  let somaDv2 = 0;
  for (let i = 0; i < 10; i++) {
    const valor = i === 9 ? dv1 : digitos.charCodeAt(i) - 48;
    somaDv2 += valor * (11 - i);
  }
  const dv2 = dvModulo11(somaDv2);

  return Number(digitos.slice(9)) === dv1 * 10 + dv2;
}

/**
 * Calcula os dois dígitos verificadores de um CNPJ (base com 12 caracteres
 * `[A-Z0-9]`). Usado pela fábrica de fixtures.
 */
export function calculaDvCnpj(base12: string): string {
  if (!/^[A-Z0-9]{12}$/.test(base12)) {
    throw new Error(`Base de CNPJ inválida (esperado 12 caracteres [A-Z0-9]): ${base12}`);
  }
  let somaDv1 = 0;
  let somaDv2 = 0;
  for (let i = 0; i < 12; i++) {
    const valor = valorCaractereCnpj(base12[i]!);
    somaDv1 += valor * PESOS_CNPJ_DV1[i]!;
    somaDv2 += valor * PESOS_CNPJ_DV2[i]!;
  }
  const dv1 = dvModulo11(somaDv1);
  somaDv2 += dv1 * PESOS_CNPJ_DV2[12]!;
  const dv2 = dvModulo11(somaDv2);
  return `${dv1}${dv2}`;
}

/**
 * Calcula os dois dígitos verificadores de um CPF (base com 9 dígitos).
 * Usado pela fábrica de fixtures. O mesmo módulo 11 das regras 401/237.
 */
export function calculaDvCpf(base9: string): string {
  if (!/^[0-9]{9}$/.test(base9)) {
    throw new Error(`Base de CPF inválida (esperado 9 dígitos): ${base9}`);
  }
  let somaDv1 = 0;
  for (let i = 0; i < 9; i++) {
    somaDv1 += (base9.charCodeAt(i) - 48) * (10 - i);
  }
  const dv1 = dvModulo11(somaDv1);
  let somaDv2 = 0;
  for (let i = 0; i < 9; i++) {
    somaDv2 += (base9.charCodeAt(i) - 48) * (11 - i);
  }
  somaDv2 += dv1 * 2;
  const dv2 = dvModulo11(somaDv2);
  return `${dv1}${dv2}`;
}

/**
 * Valida os documentos (CNPJ/CPF) de emitente e destinatário de uma NF-e.
 *
 * Regras citadas (MOC 7.0 — Anexo I, seção 4.4.2):
 * - C02-10 → cStat 207 “CNPJ do emitente inválido”;
 * - E02-10 → cStat 208 “CNPJ do destinatário inválido”;
 * - 401 “CPF do emitente inválido”; 237 “CPF do destinatário inválido”.
 */
export function validaDocumentos(input: {
  /** modelo do documento (55 = NF-e, 65 = NFC-e). */
  modelo?: number;
  emitCnpj?: string;
  emitCpf?: string;
  destInformado: boolean;
  destCnpj?: string;
  destCpf?: string;
  destIdEstrangeiro?: string;
}): ProblemaValidacao[] {
  const problemas: ProblemaValidacao[] = [];

  // MOC Anexo I — grupo E01 (dest): obrigatório para NF-e modelo 55 e
  // opcional para NFC-e modelo 65 (venda a consumidor anônima).
  if (input.modelo === 55 && !input.destInformado) {
    problemas.push({
      severity: 'erro',
      code: 'DESTINATARIO_OBRIGATORIO',
      regra: 'E01-10',
      campo: 'dest',
      message: 'NF-e modelo 55 sem grupo dest: o destinatário é obrigatório (E01).',
    });
  }
  if (input.emitCnpj === undefined && input.emitCpf === undefined) {
    problemas.push({
      severity: 'erro',
      code: 'EMITENTE_SEM_DOCUMENTO',
      campo: 'emit/CNPJ | emit/CPF',
      message: 'Emitente sem CNPJ ou CPF informado (o layout exige a escolha CNPJ/CPF).',
    });
  }
  if (input.emitCnpj !== undefined && !cnpjValido(input.emitCnpj)) {
    problemas.push({
      severity: 'erro',
      code: 'CNPJ_EMITENTE_INVALIDO',
      regra: 'C02-10',
      cStat: 207,
      campo: 'emit/CNPJ',
      message: `CNPJ do emitente inválido (DV ou formato): ${input.emitCnpj}.`,
    });
  }
  if (input.emitCpf !== undefined && !cpfValido(input.emitCpf)) {
    problemas.push({
      severity: 'erro',
      code: 'CPF_EMITENTE_INVALIDO',
      cStat: 401,
      campo: 'emit/CPF',
      message: `CPF do emitente inválido (zeros, dígitos repetidos ou DV): ${input.emitCpf}.`,
    });
  }
  if (input.destCnpj !== undefined && !cnpjValido(input.destCnpj)) {
    problemas.push({
      severity: 'erro',
      code: 'CNPJ_DESTINATARIO_INVALIDO',
      regra: 'E02-10',
      cStat: 208,
      campo: 'dest/CNPJ',
      message: `CNPJ do destinatário inválido (DV ou formato): ${input.destCnpj}.`,
    });
  }
  if (input.destCpf !== undefined && !cpfValido(input.destCpf)) {
    problemas.push({
      severity: 'erro',
      code: 'CPF_DESTINATARIO_INVALIDO',
      cStat: 237,
      campo: 'dest/CPF',
      message: `CPF do destinatário inválido (zeros, dígitos repetidos ou DV): ${input.destCpf}.`,
    });
  }
  if (
    input.destInformado &&
    input.destCnpj === undefined &&
    input.destCpf === undefined &&
    input.destIdEstrangeiro === undefined
  ) {
    problemas.push({
      severity: 'erro',
      code: 'DESTINATARIO_SEM_DOCUMENTO',
      campo: 'dest/CNPJ | dest/CPF | dest/idEstrangeiro',
      message: 'Destinatário informado sem CNPJ, CPF ou identificador de estrangeiro.',
    });
  }
  return problemas;
}
