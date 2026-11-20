/**
 * Escritor XML mínimo e determinístico usado pela fábrica de fixtures.
 *
 * Emitir XML “na mão” (em vez de usar um builder genérico) garante controle
 * total da ordem dos elementos — que deve seguir o XSD oficial
 * (`schemas/PL_009q_NT2025_001_v1.00/leiauteNFe_v4.00.xsd`) — e saída
 * estável byte-a-byte para o corpus versionado em `tests/fixtures/`.
 */

/** Escapa os caracteres especiais do XML em valores de texto e atributos. */
export function escapaXml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Formata um decimal com quantidade fixa de casas (padrão TDec do leiaute). */
export function fmt(valor: number, casas = 2): string {
  return valor.toFixed(casas);
}

export class EscritorXml {
  private readonly linhas: string[] = [];
  private nivel = 0;

  /** Prólogo XML com codificação UTF-8. */
  prologo(): this {
    this.linhas.push('<?xml version="1.0" encoding="UTF-8"?>');
    return this;
  }

  /** Abre um elemento com atributos (`attrs` sem prefixo). */
  abre(tag: string, attrs?: Record<string, string>): this {
    const atributos =
      attrs === undefined
        ? ''
        : Object.entries(attrs)
            .map(([k, v]) => ` ${k}="${escapaXml(v)}"`)
            .join('');
    this.linhas.push(`${this.ind()}<${tag}${atributos}>`);
    this.nivel++;
    return this;
  }

  /** Fecha um elemento aberto. */
  fecha(tag: string): this {
    this.nivel--;
    this.linhas.push(`${this.ind()}</${tag}>`);
    return this;
  }

  /** Elemento folha com texto escapado. */
  texto(tag: string, valor: string | number | undefined): this {
    if (valor === undefined) return this;
    const conteudo = typeof valor === 'number' ? String(valor) : valor;
    this.linhas.push(`${this.ind()}<${tag}>${escapaXml(conteudo)}</${tag}>`);
    return this;
  }

  /** Elemento folha com valor decimal com casas fixas. */
  decimal(tag: string, valor: number | undefined, casas = 2): this {
    if (valor === undefined) return this;
    this.linhas.push(`${this.ind()}<${tag}>${escapaXml(fmt(valor, casas))}</${tag}>`);
    return this;
  }

  /** Elemento folha com conteúdo CDATA (usado no qrCode da NFC-e). */
  cdata(tag: string, valor: string | undefined): this {
    if (valor === undefined) return this;
    this.linhas.push(`${this.ind()}<${tag}><![CDATA[${valor}]]></${tag}>`);
    return this;
  }

  /** Agrupa `abre` + `fecha` em volta de uma função de conteúdo. */
  grupo(tag: string, attrs: Record<string, string> | undefined, fn: () => void): this {
    this.abre(tag, attrs);
    fn();
    this.fecha(tag);
    return this;
  }

  /** XML final com quebras de linha LF. */
  construir(): string {
    return `${this.linhas.join('\n')}\n`;
  }

  private ind(): string {
    return '  '.repeat(this.nivel);
  }
}
