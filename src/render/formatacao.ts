/** Formatação determinística (pt-BR) de valores, datas e documentos. */

/** Número com separador de milhar "." e decimal "," — independente do ICU. */
export function numero(valor: number | undefined, casas = 2): string {
  if (valor === undefined || !Number.isFinite(valor)) return '';
  const s = Math.abs(valor).toFixed(casas);
  const [inteira, decimal] = s.split('.');
  const agrupada = (inteira ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${valor < 0 ? '-' : ''}${agrupada}${decimal ? `,${decimal}` : ''}`;
}

export function inteiro(valor: number | undefined, digitos = 0): string {
  if (valor === undefined || !Number.isFinite(valor)) return '';
  return Math.trunc(Math.abs(valor)).toString().padStart(digitos, '0');
}

/** Data ISO-8601 → DD/MM/AAAA (a data é lida antes do "T", sem fuso). */
export function data(iso: string | undefined): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** Hora ISO-8601 → HH:MM:SS. */
export function hora(iso: string | undefined): string {
  if (!iso) return '';
  const m = /T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(iso);
  return m ? `${m[1]}:${m[2]}:${m[3] ?? '00'}` : '';
}

/** Dia da emissão (DD) — usado no código de barras de contingência (MOC §3.9.2). */
export function diaEmissao(iso: string): string {
  const m = /^\d{4}-\d{2}-(\d{2})/.exec(iso);
  return m?.[1] ?? '00';
}

/** Remove a formatação de um documento, mantendo apenas dígitos. */
export function soDigitos(valor: string | undefined): string {
  return (valor ?? '').replace(/\D/g, '');
}

export function cnpjCpf(documento: string | undefined): string {
  const d = soDigitos(documento);
  if (d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  if (d.length === 11) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  return documento ?? '';
}

/** CEP brasileiro: `00000-000` (8 dígitos). */
export function cep(valor: string | undefined): string {
  const d = soDigitos(valor);
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : (valor ?? '');
}

/** Telefone: `(11) 3333-4444` (10 dígitos) ou `(11) 93333-4444` (11). */
export function fone(valor: string | undefined): string {
  const d = soDigitos(valor);
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 8) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return valor ?? '';
}

/** Chave de acesso: 11 blocos de 4 dígitos (MOC §3.1.1). */
export function mascaraChave(chave: string): string {
  const blocos: string[] = [];
  for (let i = 0; i < chave.length; i += 4) blocos.push(chave.slice(i, i + 4));
  return blocos.join(' ');
}

/** Dados da NF-e em contingência: 9 blocos de 4 dígitos (MOC §3.1.2). */
export function mascaraDadosContingencia(dados: string): string {
  const blocos: string[] = [];
  for (let i = 0; i < dados.length; i += 4) blocos.push(dados.slice(i, i + 4));
  return blocos.join(' ');
}

/** Modalidade do frete (MOC X02 / item 3.8.1, Obs. 8). */
const FRETE_POR_CONTA: Record<number, string> = {
  0: '1) Remetente',
  1: '2) Destinatário',
  2: '3) Terceiros',
  3: '4) Própria Remetente',
  4: '5) Própria Destinatário',
  9: '9) Sem transp.',
};

export function fretePorConta(modFrete: number): string {
  return FRETE_POR_CONTA[modFrete] ?? '';
}

/**
 * CST do item: MOC Anexo I exige **orig + CST** (ou **orig + CSOSN** no
 * Simples Nacional), por exemplo origem 0/CST 00 → "000" e origem 0/CSOSN
 * 102 → "0102". O dígito da origem (0–6) não pode ser descartado.
 */
export function cstItem(
  icms: { orig?: number | string; cst?: string; csosn?: string; grupo: string } | undefined,
): string {
  if (!icms) return '';
  const origem = icms.orig ?? 0;
  const codigo = icms.cst ?? icms.csosn ?? icms.grupo.replace(/^ICMS/, '').slice(0, 2);
  return `${origem}${codigo}`;
}

/** Alíquota do ICMS do item, quando informada. */
export function aliquotaIcmsItem(icms: object | undefined): number | undefined {
  if (!icms) return undefined;
  const grupo = icms as Record<string, unknown>;
  const valor = 'pICMS' in grupo ? grupo.pICMS : grupo.pCredSN;
  return typeof valor === 'number' ? valor : undefined;
}
