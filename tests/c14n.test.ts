/**
 * Canonical XML 1.0 sem comentários (W3C Recommendation 15/03/2001,
 * https://www.w3.org/TR/2001/REC-xml-c14n-20010315) — vetores normativos
 * adaptados (sem DTD/ATTLIST, cujo suporte é documentado como fora de
 * escopo: o leiaute da NF-e não usa DTDs).
 */
import { describe, expect, it } from 'vitest';
import { canonicalizaElemento } from '../src/signature/c14n';
import { ErroXml, lerXml, procuraElemento } from '../src/signature/xml-reader';

function canonica(xml: string): string {
  return canonicalizaElemento(lerXml(xml).raiz);
}

function apex(xml: string, local: string, opcoes?: { excluirAssinatura?: boolean }): string {
  const no = procuraElemento(lerXml(xml).raiz, local);
  if (!no) throw new Error(`Elemento ${local} nao encontrado.`);
  return canonicalizaElemento(no, opcoes);
}

describe('C14N 1.0 (sem comentários)', () => {
  it('W3C §3.2 — preserva todo whitespace do conteúdo', () => {
    const xml = `<doc>
   <clean>   </clean>
   <dirty>   A   B   </dirty>
   <mixed>
      A
      <clean>   </clean>
      B
      <dirty>   A   B   </dirty>
      C
   </mixed>
</doc>`;
    expect(canonica(xml)).toBe(xml);
  });

  it('W3C §3.3 —start/end tags, namespace e ordem de atributos', () => {
    const xml = `<doc>
   <e1   />
   <e2   ></e2>
   <e3   name = "elem3"   id="elem3"   />
   <e4   name="elem4"   id="elem4"   ></e4>
   <e5 a:attr="out" b:attr="sorted" attr2="all" attr="I'm"
      xmlns:b="http://www.ietf.org"
      xmlns:a="http://www.w3.org"
      xmlns="http://example.org"/>
   <e6 xmlns="" xmlns:a="http://www.w3.org">
      <e7 xmlns="http://www.ietf.org">
         <e8 xmlns="" xmlns:a="http://www.w3.org">
            <e9 />
         </e8>
      </e7>
   </e6>
</doc>`;
    const esperado = `<doc>
   <e1></e1>
   <e2></e2>
   <e3 id="elem3" name="elem3"></e3>
   <e4 id="elem4" name="elem4"></e4>
   <e5 xmlns="http://example.org" xmlns:a="http://www.w3.org" xmlns:b="http://www.ietf.org" attr="I'm" attr2="all" b:attr="sorted" a:attr="out"></e5>
   <e6 xmlns:a="http://www.w3.org">
      <e7 xmlns="http://www.ietf.org">
         <e8 xmlns="">
            <e9></e9>
         </e8>
      </e7>
   </e6>
</doc>`;
    expect(canonica(xml)).toBe(esperado);
  });

  it('W3C §3.4 — referências de caractere, CDATA e normalização de atributo', () => {
    const xml = `<doc>
   <text>First line&#x0d;&#10;Second line</text>
   <value>&#x32;</value>
   <compute><![CDATA[value>"0" && value<"10" ?"valid":"error"]]></compute>
   <compute expr='value>"0" &amp;&amp; value&lt;"10" ?"valid":"error"'>valid</compute>
   <norm attr=' &apos;   &#x20;&#13;&#xa;&#9;   &apos; '></norm>
</doc>`;
    const esperado = `<doc>
   <text>First line&#xD;
Second line</text>
   <value>2</value>
   <compute>value&gt;"0" &amp;&amp; value&lt;"10" ?"valid":"error"</compute>
   <compute expr="value>&quot;0&quot; &amp;&amp; value&lt;&quot;10&quot; ?&quot;valid&quot;:&quot;error&quot;">valid</compute>
   <norm attr=" '    &#xD;&#xA;&#x9;   ' "></norm>
</doc>`;
    expect(canonica(xml)).toBe(esperado);
  });

  it('W3C §3.7 — namespaces herdados no ápice e xmlns=""', () => {
    const xml = `<doc xmlns="http://www.ietf.org" xmlns:w3c="http://www.w3.org"><e1><e3 xmlns="" id="E3"></e3></e1></doc>`;
    expect(apex(xml, 'e1')).toBe(
      '<e1 xmlns="http://www.ietf.org" xmlns:w3c="http://www.w3.org"><e3 xmlns="" id="E3"></e3></e1>',
    );
  });

  it('W3C §2.4 — atributos xml:* de ancestrais herdados pelo ápice', () => {
    expect(apex('<doc xml:lang="pt-BR"><e><f></f></e></doc>', 'e')).toBe(
      '<e xml:lang="pt-BR"><f></f></e>',
    );
  });

  it('W3C §2.3 — comentários descartados; PI no conteúdo preservada', () => {
    expect(canonica('<doc><?pi   dados   ?>a<!-- x -->b</doc>')).toBe(
      '<doc><?pi dados   ?>ab</doc>',
    );
  });

  it('transform enveloped-signature remove Signature do subconjunto', () => {
    const xml = `<raiz xmlns="urn:nfe">
  <infNFe Id="NFe1">
    <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignedInfo/></ds:Signature>
    <ide><cUF>35</cUF></ide>
  </infNFe>
</raiz>`;
    const comAssinatura = apex(xml, 'infNFe');
    expect(comAssinatura).toContain('<ds:Signature');
    const semAssinatura = apex(xml, 'infNFe', { excluirAssinatura: true });
    expect(semAssinatura).not.toContain('Signature');
    expect(semAssinatura).toContain('<ide><cUF>35</cUF></ide>');
  });

  it('rejeita XML mal formado', () => {
    expect(() => lerXml('<a><b></a>')).toThrow(ErroXml);
    expect(() => lerXml('<a>&desconhecida;</a>')).toThrow(ErroXml);
    expect(() => lerXml('<a p:q="1"/>')).toThrow(ErroXml);
  });
});
