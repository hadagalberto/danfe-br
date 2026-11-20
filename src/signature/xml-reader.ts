/**
 * Leitor XML mínimo e estrito usado pela canonicalização (C14N) e pela
 * verificação de assinatura (XMLDSig).
 *
 * Por que não reutilizar o `fast-xml-parser` do módulo `parse`: a
 * canonicalização exige detalhes que parsers de conveniência descartam —
 * o QName **como escrito** (prefixo original), o escopo de namespaces por
 * elemento, a ordem relativa de texto/elementos, instruções de
 * processamento e o contexto ancestral. Este leitor preserva tudo.
 *
 * Regras aplicadas (XML 1.0 + Namespaces in XML):
 * - quebras de linha normalizadas para #xA **antes** do parse (C14N §2.1);
 * - declarações de namespace (`xmlns`, `xmlns:p`) fora do eixo de
 *   atributos; prefixo `xml` predefinido;
 * - normalização de valor de atributo como processador validador
 *   (espaços literais #x9/#xA/#xD viram espaço; referências de caractere
 *   permanecem) — C14N §2.1;
 * - CDATA vira texto literal (sem processamento de entidades);
 * - comentários e o DOCTYPE são descartados (variante *without comments*
 *   da C14N usada pela NF-e; DTDs não existem no leiaute da NF-e —
 *   atributos default de ATTLIST não são suportados, limitação documentada);
 * - instruções de processamento são preservadas (C14N as renderiza).
 */

/** Namespace do prefixo `xml` (Namespaces in XML §1). */
export const URI_XML = 'http://www.w3.org/XML/1998/namespace';

/** Erro de leitura com a posição aproximada no documento. */
export class ErroXml extends Error {
  readonly posicao: number;
  constructor(mensagem: string, posicao: number) {
    super(`${mensagem} (posição ${posicao})`);
    this.name = 'ErroXml';
    this.posicao = posicao;
  }
}

/** Atributo XML com QName como escrito e valor já normalizado. */
export interface AtributoXml {
  /** QName completo como escrito (ex.: `Id`, `xsi:type`). */
  qname: string;
  /** Prefixo (`''` para sem prefixo). */
  prefixo: string;
  /** Nome local. */
  local: string;
  /** URI do namespace — atributos sem prefixo NÃO têm namespace (não usam o default). */
  uri: string | undefined;
  valor: string;
}

/** Elemento XML. */
export interface NoElemento {
  tipo: 'elemento';
  qname: string;
  prefixo: string;
  local: string;
  uri: string | undefined;
  atributos: AtributoXml[];
  /** Declarações `xmlns`/`xmlns:p` escritas neste elemento, na ordem original. */
  declaracoes: ReadonlyArray<{ prefixo: string; uri: string }>;
  filhos: NoXml[];
  pai: NoElemento | undefined;
}

/** Texto de elemento (CDATA já fundido como texto). */
export interface NoTexto {
  tipo: 'texto';
  conteudo: string;
}

/** Instrução de processamento. */
export interface NoPi {
  tipo: 'pi';
  alvo: string;
  dados: string;
}

export type NoXml = NoElemento | NoTexto | NoPi;

/** Documento parseado: elemento raiz (comentários/DOCTYPE descartados). */
export interface DocumentoXml {
  raiz: NoElemento;
  /** Caminho ancestral da raiz para buscas (raiz.pai === undefined). */
  ancestrais(no: NoElemento): NoElemento[];
}

/**
 * Faz o parse de um documento XML completo.
 *
 * @throws {ErroXml} documento mal formado, entidade desconhecida, prefixo
 *   não declarado ou tags sem parência.
 */
export function lerXml(xml: string): DocumentoXml {
  // C14N §2.1: quebras de linha normalizadas para #xA na entrada.
  const texto = xml.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const leitor = new Leitor(texto);
  const raiz = leitor.leDocumento();
  return {
    raiz,
    ancestrais: (no: NoElemento): NoElemento[] => {
      const cadeia: NoElemento[] = [];
      for (let p: NoElemento | undefined = no.pai; p; p = p.pai) cadeia.push(p);
      return cadeia.reverse();
    },
  };
}

/** Procura em profundidade o primeiro elemento com nome local `local`. */
export function procuraElemento(
  base: NoElemento,
  local: string,
  uri?: string,
): NoElemento | undefined {
  if (base.local === local && (uri === undefined || base.uri === uri)) return base;
  for (const filho of base.filhos) {
    if (filho.tipo !== 'elemento') continue;
    const achado = procuraElemento(filho, local, uri);
    if (achado) return achado;
  }
  return undefined;
}

/** Todos os elementos descendentes (DFS, ordem do documento) com o local dado. */
export function listaElementos(base: NoElemento, local: string, uri?: string): NoElemento[] {
  const achados: NoElemento[] = [];
  if (base.local === local && (uri === undefined || base.uri === uri)) achados.push(base);
  for (const filho of base.filhos) {
    if (filho.tipo === 'elemento') achados.push(...listaElementos(filho, local, uri));
  }
  return achados;
}

/** Valor texto concatenado dos filhos de texto de um elemento. */
export function textoDe(no: NoElemento): string {
  return no.filhos
    .filter((f): f is NoTexto => f.tipo === 'texto')
    .map((f) => f.conteudo)
    .join('');
}

/** Atributo pelo nome local (ignora namespace), ou `undefined`. */
export function atributo(no: NoElemento, local: string): string | undefined {
  return no.atributos.find((a) => a.local === local)?.valor;
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

const ENTIDADES: Readonly<Record<string, string>> = {
  lt: '<',
  gt: '>',
  amp: '&',
  quot: '"',
  apos: "'",
};

/** Escopo de namespaces para resolução durante o parse. */
class Escopo {
  private readonly ligacoes = new Map<string, string>();

  constructor(private readonly pai: Escopo | undefined) {}

  declara(prefixo: string, uri: string): void {
    this.ligacoes.set(prefixo, uri);
  }

  /** URI para `prefixo`; `''` devolve o namespace default (possivelmente `''`). */
  resolve(prefixo: string, posicao: number): string | undefined {
    if (prefixo === 'xml') return URI_XML;
    if (this.ligacoes.has(prefixo)) return this.ligacoes.get(prefixo)!;
    if (this.pai) return this.pai.resolve(prefixo, posicao);
    if (prefixo === '') return ''; // sem default declarado ⇒ sem namespace
    throw new ErroXml(`Prefixo não declarado: ${prefixo}`, posicao);
  }
}

/** Leitor caractere a caractere com contexto de posição. */
class Leitor {
  private pos = 0;
  private pilha: { qname: string; no: NoElemento; escopo: Escopo }[] = [];

  constructor(private readonly s: string) {}

  leDocumento(): NoElemento {
    let raiz: NoElemento | undefined;
    while (!this.fim()) {
      this.pulaEspacosEntreNodos();
      if (this.fim()) break;
      this.exige('<');
      const c = this.espia();
      if (c === '?') {
        const pi = this.lePi();
        // `<?xml ...?>` é prólogo; outras PIs fora da raiz são descartadas
        // (a C14N de subárvore nunca as alcança; NF-e não as usa).
        if (pi && pi.alvo !== 'xml' && !raiz) {
          // PI antes da raiz: ignorada silenciosamente (fora do elemento
          // assinado em qualquer cenário da NF-e).
        }
        continue;
      }
      if (c === '!') {
        this.pulaDeclOuComentario();
        continue;
      }
      const no = this.leElemento(new Escopo(undefined));
      if (!raiz) {
        raiz = no;
      } else {
        throw new ErroXml('Mais de um elemento raiz', this.pos);
      }
    }
    if (!raiz) throw new ErroXml('Documento sem elemento raiz', this.pos);
    return raiz;
  }

  private fim(): boolean {
    return this.pos >= this.s.length;
  }

  private espia(): string {
    if (this.fim()) throw new ErroXml('Fim inesperado do documento', this.pos);
    return this.s[this.pos]!;
  }

  private exige(ch: string): void {
    if (this.s[this.pos] !== ch) {
      throw new ErroXml(`Esperado '${ch}'`, this.pos);
    }
    this.pos++;
  }

  private pulaEspacosEntreNodos(): void {
    while (this.pos < this.s.length && /\s/.test(this.s[this.pos]!)) this.pos++;
  }

  /** `<? ... ?>`; devolve a PI (exceto prólogo `<?xml`, que devolve undefined). */
  private lePi(): NoPi | undefined {
    const inicio = this.pos;
    this.exige('?');
    let alvo = '';
    while (!this.fim() && /[A-Za-z0-9._:-]/.test(this.s[this.pos]!)) {
      alvo += this.s[this.pos++]!;
    }
    if (alvo === 'xml' && !this.pilha.length) {
      // prólogo: pula até '?>'
      this.ateFim('?>', inicio);
      return undefined;
    }
    this.pulaEspacosEntreNodos();
    let dados = '';
    while (this.pos < this.s.length && !this.s.startsWith('?>', this.pos)) {
      dados += this.s[this.pos++]!;
    }
    this.exige('?');
    this.exige('>');
    return { tipo: 'pi', alvo, dados };
  }

  private pulaDeclOuComentario(): void {
    const inicio = this.pos;
    this.exige('!');
    if (this.s.startsWith('--', this.pos)) {
      this.pos += 2;
      const fim = this.s.indexOf('-->', this.pos);
      if (fim < 0) throw new ErroXml('Comentário sem fechamento', inicio);
      this.pos = fim + 3;
      return;
    }
    if (this.s.startsWith('DOCTYPE', this.pos)) {
      // DTD: pula o conjunto interno [ ... ] e o '>' final. Atributos
      // default de ATTLIST não são suportados (limitação documentada).
      this.pos += 7;
      while (!this.fim() && this.s[this.pos] !== '>') {
        if (this.s[this.pos] === '[') {
          const fim = this.s.indexOf(']', this.pos);
          if (fim < 0) throw new ErroXml('DOCTYPE sem fim do subconjunto interno', inicio);
          this.pos = fim;
        }
        this.pos++;
      }
      this.exige('>');
      return;
    }
    if (this.s.startsWith('[CDATA[', this.pos)) {
      throw new ErroXml('CDATA fora de conteúdo de elemento', inicio);
    }
    throw new ErroXml('Declaração <!...> desconhecida', inicio);
  }

  private leElemento(escopo: Escopo): NoElemento {
    const inicio = this.pos;
    this.exige('<');
    const qname = this.leQName();
    const declaracoes: { prefixo: string; uri: string }[] = [];
    const atributos: AtributoXml[] = [];
    const escopoLocal = new Escopo(escopo);

    while (!this.fim() && this.s[this.pos] !== '>' && !this.s.startsWith('/>', this.pos)) {
      this.pulaEspacosEntreNodos();
      if (this.s[this.pos] === '>' || this.s.startsWith('/>', this.pos)) break;
      const nomeAtributo = this.leQName();
      this.pulaEspacosEntreNodos();
      this.exige('=');
      this.pulaEspacosEntreNodos();
      const valor = this.leValorAtributo();
      if (nomeAtributo === 'xmlns' || nomeAtributo.startsWith('xmlns:')) {
        const prefixo = nomeAtributo === 'xmlns' ? '' : nomeAtributo.slice(6);
        if (prefixo === 'xml') {
          throw new ErroXml("Declaração do prefixo reservado 'xml'", inicio);
        }
        escopoLocal.declara(prefixo, valor);
        declaracoes.push({ prefixo, uri: valor });
        continue;
      }
      const [prefixo, local] = divideQName(nomeAtributo);
      if (atributos.some((a) => a.qname === nomeAtributo)) {
        throw new ErroXml(`Atributo duplicado: ${nomeAtributo}`, inicio);
      }
      atributos.push({
        qname: nomeAtributo,
        prefixo,
        local,
        // Atributos sem prefixo não usam o namespace default (Namespaces §5.2).
        uri: prefixo === '' ? undefined : escopoLocal.resolve(prefixo, inicio),
        valor,
      });
    }

    const [prefixo, local] = divideQName(qname);
    const uri = escopoLocal.resolve(prefixo, inicio);
    const vazia = this.s.startsWith('/>', this.pos);
    if (vazia) this.pos += 2;
    else this.exige('>');

    const no: NoElemento = {
      tipo: 'elemento',
      qname,
      prefixo,
      local,
      uri,
      atributos,
      declaracoes,
      filhos: [],
      pai: this.pilha.length ? this.pilha[this.pilha.length - 1]!.no : undefined,
    };

    if (vazia) return no;

    this.pilha.push({ qname, no, escopo: escopoLocal });
    this.leConteudo(no, escopoLocal);
    this.pilha.pop();
    return no;
  }

  private leConteudo(no: NoElemento, escopo: Escopo): void {
    while (true) {
      if (this.fim()) {
        throw new ErroXml(`Elemento <${no.qname}> sem fechamento`, this.pos);
      }
      const iMenor = this.s.indexOf('<', this.pos);
      if (iMenor < 0) {
        throw new ErroXml(`Elemento <${no.qname}> sem fechamento`, this.pos);
      }
      const textoBruto = this.s.slice(this.pos, iMenor);
      if (textoBruto.length > 0) {
        no.filhos.push({ tipo: 'texto', conteudo: this.resolveEntidades(textoBruto, this.pos) });
      }
      this.pos = iMenor;

      if (this.s.startsWith('</', this.pos)) {
        this.pos += 2;
        const qname = this.leQName();
        this.pulaEspacosEntreNodos();
        this.exige('>');
        if (qname !== no.qname) {
          throw new ErroXml(`Fechamento </${qname}> não casa com <${no.qname}>`, this.pos);
        }
        return;
      }
      if (this.s.startsWith('<!--', this.pos)) {
        this.pulaDeclOuComentario();
        continue;
      }
      if (this.s.startsWith('<![CDATA[', this.pos)) {
        this.pos += 9;
        const fim = this.s.indexOf(']]>', this.pos);
        if (fim < 0) throw new ErroXml('CDATA sem fechamento', this.pos);
        no.filhos.push({ tipo: 'texto', conteudo: this.s.slice(this.pos, fim) });
        this.pos = fim + 3;
        continue;
      }
      if (this.s.startsWith('<?', this.pos)) {
        const pi = this.lePi();
        if (pi) no.filhos.push(pi);
        continue;
      }
      // Elemento filho.
      const escopoFilho = new Escopo(escopo);
      const filho = this.leElemento(escopoFilho);
      no.filhos.push(filho);
    }
  }

  private leQName(): string {
    const inicio = this.pos;
    const primeiro = this.s[this.pos];
    if (primeiro === undefined || !/[A-Za-z_]/.test(primeiro)) {
      throw new ErroXml('QName esperado', inicio);
    }
    let qname = primeiro;
    this.pos++;
    while (!this.fim()) {
      const c = this.s[this.pos]!;
      if (/[\w.-]/.test(c) || (c === ':' && !qname.includes(':'))) {
        qname += c;
        this.pos++;
      } else {
        break;
      }
    }
    if (qname.endsWith(':') || qname.includes('::')) {
      throw new ErroXml(`QName inválido: ${qname}`, inicio);
    }
    return qname;
  }

  private leValorAtributo(): string {
    const aspa = this.s[this.pos];
    if (aspa !== '"' && aspa !== "'") {
      throw new ErroXml("Valor de atributo deve começar com aspas", this.pos);
    }
    this.pos++;
    let bruto = '';
    while (true) {
      if (this.fim()) throw new ErroXml('Valor de atributo sem fechamento', this.pos);
      const c = this.s[this.pos]!;
      if (c === aspa) {
        this.pos++;
        break;
      }
      if (c === '<') throw new ErroXml("'<' em valor de atributo", this.pos);
      bruto += c;
      this.pos++;
    }
    const resolvido = this.resolveEntidades(bruto, this.pos);
    // Normalização de atributo (processador validador, XML 1.0 §3.3.3):
    // espaços literais (tab/quebra/CR) viram espaço; referências de
    // caractere permanecem intactas (já resolvidas acima sem colapsar).
    return resolvido.replace(/[\t\n\r]/g, ' ');
  }

  private resolveEntidades(bruto: string, posicao: number): string {
    if (!bruto.includes('&')) return bruto;
    let saida = '';
    let i = 0;
    while (i < bruto.length) {
      const c = bruto[i]!;
      if (c !== '&') {
        saida += c;
        i++;
        continue;
      }
      const fim = bruto.indexOf(';', i);
      if (fim < 0) throw new ErroXml('Entidade sem ";"', posicao + i);
      const nome = bruto.slice(i + 1, fim);
      if (nome.startsWith('#x')) {
        const codigo = parseInt(nome.slice(2), 16);
        saida += String.fromCodePoint(codigo);
      } else if (nome.startsWith('#')) {
        saida += String.fromCodePoint(parseInt(nome.slice(1), 10));
      } else {
        const valor = ENTIDADES[nome];
        if (valor === undefined) throw new ErroXml(`Entidade desconhecida: &${nome};`, posicao + i);
        saida += valor;
      }
      i = fim + 1;
    }
    return saida;
  }

  private ateFim(marcador: string, posicao: number): void {
    const fim = this.s.indexOf(marcador, this.pos);
    if (fim < 0) throw new ErroXml(`Sem fechamento '${marcador}'`, posicao);
    this.pos = fim + marcador.length;
  }
}

/** Divide um QName em [prefixo, local] (prefixo `''` quando sem `:`). */
function divideQName(qname: string): [string, string] {
  const i = qname.indexOf(':');
  return i < 0 ? ['', qname] : [qname.slice(0, i), qname.slice(i + 1)];
}
