/**
 * Canonical XML 1.0 **sem comentários** (W3C Recommendation 15/03/2001,
 * http://www.w3.org/TR/2001/REC-xml-c14n-20010315) — a variante usada pelo
 * perfil de assinatura da NF-e (transform `C14N` do XMLDSig, MOC — padrões
 * de assinatura digital do projeto NF-e).
 *
 * Regras implementadas (números da seção 2 da REC):
 * - §2.1 entrada: quebras de linha normalizadas para #xA (feita no leitor),
 *   valores de atributo normalizados, CDATA vira texto, referências de
 *   entidade/caractere resolvidas;
 * - §2.2 eixo de namespace antes do eixo de atributos; namespaces em ordem
 *   lexicográfica pelo prefixo (default primeiro — nome local vazio);
 * - §2.3 elemento ápice: renderiza **todos** os namespaces em escopo
 *   (herdados de ancestrais fora do subconjunto inclusive); declarações
 *   supérfluas são omitidas nos descendentes (§4.6); `xmlns=""` só quando o
 *   pai canônico tem default não vazio (§2.3/§4.7); o prefixo `xml`
 *   nunca é declarado (predefinido);
 * - §2.4 subconjunto: atributos do namespace `xml:` de ancestrais
 *   omitidos são herdados pelo elemento ápice;
 * - §2.3 atributos em ordem lexicográfica por (URI, nome local) — URI
 *   vazia (atributos sem prefixo) primeiro; delimitador sempre `"`; escapos
 *   `& < " #x9 #xA #xD` no valor e `& < > #xD` no texto;
 * - comentários descartados; instruções de processamento renderizadas
 *   (`<?alvo dados?>`); elementos vazios viram par start/end;
 * - limitação documentada: sem suporte a DTD (atributos default de
 *   ATTLIST não são aplicados — o leiaute da NF-e não usa DTDs; ver
 *   xml-reader.ts).
 *
 * Os exemplos normativos 3.2, 3.3, 3.4 e 3.7 da própria REC são usados
 * como vetores de teste em `tests/c14n.test.ts`.
 */
import { URI_XML, type NoElemento, type NoXml } from './xml-reader';

/** Opções da canonicalização de um elemento. */
export interface OpcoesC14n {
  /**
   * Transform `enveloped-signature` do XMLDSig: exclui do resultado os
   * elementos `Signature` (namespace xmldsig) contidos no subconjunto.
   * NF-e real mantém o `Signature` irmão do `infNFe`, mas a transform é
   * declarada e deve ser aplicada quando o alvo a contém.
   */
  excluirAssinatura?: boolean;
}

/** URI do namespace XMLDSig (W3C XML Signature Core). */
const URI_XMLDSIG = 'http://www.w3.org/2000/09/xmldsig#';

/**
 * Forma canônica (sem comentários) do subconjunto composto pelo elemento
 * `no` e todos os seus descendentes. A representação em bytes é UTF-8; a
 * função devolve a string (cada code point já corresponde à sequência
 * UTF-8 final — não há normalização Unicode na C14N, §4.2).
 */
export function canonicalizaElemento(no: NoElemento, opcoes?: OpcoesC14n): string {
  const partes: string[] = [];
  renderizaElemento(no, escopoAncestrais(no), true, partes, opcoes?.excluirAssinatura === true);
  return partes.join('');
}

/** Escopo efetivo de namespaces do ápice: ancestrais + declarações próprias. */
function escopoAncestrais(apice: NoElemento): Map<string, string> {
  const escopo = new Map<string, string>();
  for (const ancestral of cadeiaAncestrais(apice)) {
    for (const { prefixo, uri } of ancestral.declaracoes) escopo.set(prefixo, uri);
  }
  return escopo;
}

/** Cadeia ancestral do nó (mais externo primeiro). */
function cadeiaAncestrais(no: NoElemento): NoElemento[] {
  const cadeia: NoElemento[] = [];
  for (let p = no.pai; p; p = p.pai) cadeia.push(p);
  return cadeia.reverse();
}

/** Renderiza `<qname ns attrs>conteúdo</qname>`. */
function renderizaElemento(
  no: NoElemento,
  escopoPai: Map<string, string> | undefined,
  apice: boolean,
  partes: string[],
  excluirAssinatura: boolean,
): void {
  if (excluirAssinatura && no.uri === URI_XMLDSIG && no.local === 'Signature' && !apice) {
    return; // transform enveloped-signature aplicada ao subconjunto
  }

  // Escopo corrente = escopo do pai (no ápice: ancestrais + próprias) +
  // declarações do elemento.
  const escopo = new Map(escopoPai);
  for (const { prefixo, uri } of no.declaracoes) escopo.set(prefixo, uri);

  partes.push('<', no.qname);
  partes.push(...declaracoesNamespace(escopo, escopoPai, apice));
  partes.push(...atributosOrdenados(no, apice));
  partes.push('>');

  // Filhos em ordem do documento; textos consecutivos são um único nó.
  let textoAcumulado: string[] | undefined;
  for (const filho of no.filhos) {
    if (filho.tipo === 'texto') {
      (textoAcumulado ??= []).push(filho.conteudo);
      continue;
    }
    if (textoAcumulado) {
      partes.push(escapeTexto(textoAcumulado.join('')));
      textoAcumulado = undefined;
    }
    if (filho.tipo === 'pi') {
      partes.push('<?', filho.alvo);
      if (filho.dados.length > 0) partes.push(' ', filho.dados);
      partes.push('?>');
      continue;
    }
    renderizaElemento(filho, escopo, false, partes, excluirAssinatura);
  }
  if (textoAcumulado) partes.push(escapeTexto(textoAcumulado.join('')));

  partes.push('</', no.qname, '>');
}

/**
 * Declarações de namespace a renderizar no elemento (§2.2/§2.3/§4.6):
 * - ápice: todas as ligações em escopo, exceto default vazio e `xml`;
 * - descendente: apenas as que diferem do escopo já renderizado pelo pai
 *   canônico (supérfluas são omitidas).
 */
function declaracoesNamespace(
  escopo: Map<string, string>,
  escopoPai: Map<string, string> | undefined,
  apice: boolean,
): string[] {
  const renderizadas: string[] = [];
  const prefixos = [...escopo.keys()].sort(); // default ('') é lexicograficamente primeiro
  for (const prefixo of prefixos) {
    if (prefixo === 'xml') continue; // predefinido, nunca declarado (§2.3)
    const uri = escopo.get(prefixo)!;
    if (prefixo === '' && uri === '') {
      // `xmlns=""` só quando o pai canônico tem default não vazio (§2.3/§4.7).
      if (!apice && escopoPai?.get('') !== undefined && escopoPai.get('') !== '') {
        renderizadas.push(' xmlns=""');
      }
      continue;
    }
    if (!apice && escopoPai?.get(prefixo) === uri) continue; // supérflua (§4.6)
    renderizadas.push(
      prefixo === ''
        ? ` xmlns="${escapeAtributo(uri)}"`
        : ` xmlns:${prefixo}="${escapeAtributo(uri)}"`,
    );
  }
  return renderizadas;
}

/**
 * Atributos em ordem lexicográfica por (URI, nome local) — URI vazia
 * primeiro (§2.2). No ápice, herda atributos `xml:*` de ancestrais
 * omitidos, removidos os que o ápice próprio redeclara (§2.4).
 */
function atributosOrdenados(no: NoElemento, apice: boolean): string[] {
  const lista = [...no.atributos];
  if (apice) {
    const locaisXmlProprios = new Set(
      no.atributos.filter((a) => a.uri === URI_XML).map((a) => a.local),
    );
    for (const ancestral of [...cadeiaAncestrais(no)].reverse()) {
      for (const a of ancestral.atributos) {
        if (
          a.uri === URI_XML &&
          !locaisXmlProprios.has(a.local) &&
          !lista.some((p) => p.local === a.local && p.uri === URI_XML)
        ) {
          lista.push(a);
        }
      }
    }
  }
  lista.sort((a, b) => {
    const ua = a.uri ?? '';
    const ub = b.uri ?? '';
    if (ua !== ub) return ua < ub ? -1 : 1;
    return a.local < b.local ? -1 : a.local > b.local ? 1 : 0;
  });
  return lista.map((a) => ` ${a.qname}="${escapeAtributo(a.valor)}"`);
}

/** Escapos de texto (§2.3 nós de texto): `& < > #xD`. */
function escapeTexto(texto: string): string {
  return texto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\r', '&#xD;');
}

/** Escapos de valor de atributo (§2.3 nós de atributo): `& < " #x9 #xA #xD`. */
function escapeAtributo(valor: string): string {
  return valor
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\t', '&#x9;')
    .replaceAll('\n', '&#xA;')
    .replaceAll('\r', '&#xD;');
}

/** Exportado para tipagem do consumidor: reutilizado por verify.ts. */
export type { NoXml };
