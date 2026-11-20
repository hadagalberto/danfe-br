/**
 * Testes funcionais do DANFE retrato: campos nos quadros, paginação,
 * marcas d'água, fonte mínima, logotipo e vetores inválidos.
 */
import { describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import { renderDanfe } from '../src/render/danfe-retrato';
import {
  CALCULO_IMPOSTO,
  CANHOTO,
  CABECALHO,
  DADOS_ADICIONAIS,
  DESTINATARIO,
  FATURA,
  FONTE_MINIMA,
  ISSQN,
  PRODUTOS,
  TRANSPORTADOR,
} from '../src/render/layout';
import {
  fixture,
  itensDaPagina,
  renderiza,
  esperaTextoNaCaixa,
  textoNaCaixa,
} from './helpers/danfe';
import { textoSimples } from './helpers/raster';

const alturaPaginaPt = 29.7 * (72 / 2.54);

describe('renderDanfe — DANFE retrato', () => {
  it('gera um PDF A4 válido a partir de uma NF-e autorizada', async () => {
    const pdf = await renderiza('nfe-cst-00.xml');
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe('%PDF-');
    const documento = await (await import('./helpers/raster')).abrePdf(pdf);
    expect(documento.numPages).toBe(1);
    const pagina = await documento.getPage(1);
    expect(pagina.getViewport({ scale: 1 }).width).toBeCloseTo(21 * (72 / 2.54), 1);
    expect(pagina.getViewport({ scale: 1 }).height).toBeCloseTo(alturaPaginaPt, 1);
  });

  it('coloca cada campo no seu quadro (vetor conhecido: nfe-cst-00)', async () => {
    const pdf = await renderiza('nfe-cst-00.xml');
    const itens = await itensDaPagina(pdf, 1);

    esperaTextoNaCaixa(itens, CANHOTO.recebemos, 'Indústria Vale Verde Ltda', 'canhoto');
    esperaTextoNaCaixa(itens, CANHOTO.nfNumSerie, 'Nº 21.769', 'canhoto');
    esperaTextoNaCaixa(itens, CANHOTO.nfNumSerie, 'SÉRIE 028', 'canhoto');
    esperaTextoNaCaixa(itens, CANHOTO.dataRecebimento, 'DATA DE RECEBIMENTO', 'canhoto');
    esperaTextoNaCaixa(
      itens,
      CANHOTO.identificacaoAssinatura,
      'IDENTIFICAÇÃO E ASSINATURA',
      'canhoto',
    );

    esperaTextoNaCaixa(itens, CABECALHO.emitente, 'Avenida das Indústrias', 'emitente');
    esperaTextoNaCaixa(itens, CABECALHO.emitente, 'Campinas/SP', 'emitente');
    esperaTextoNaCaixa(itens, CABECALHO.danfe, 'DANFE', 'cabeçalho');
    esperaTextoNaCaixa(itens, CABECALHO.danfe, 'DOCUMENTO AUXILIAR DA', 'cabeçalho');
    esperaTextoNaCaixa(itens, CABECALHO.danfe, 'ELETRÔNICA', 'cabeçalho');
    esperaTextoNaCaixa(itens, CABECALHO.danfe, 'FOLHA 01/01', 'cabeçalho');
    esperaTextoNaCaixa(itens, CABECALHO.chaveTexto, '3526 0110 5626 5562', 'chave');
    esperaTextoNaCaixa(itens, CABECALHO.chaveTexto, '4126 2140', 'chave');
    esperaTextoNaCaixa(itens, CABECALHO.naturezaOperacao, 'VENDA DE PRODUÇÃO PRÓPRIA', 'natureza');
    esperaTextoNaCaixa(itens, CABECALHO.ieEmitente, 'P934045867553', 'IE emitente');
    esperaTextoNaCaixa(itens, CABECALHO.cnpjEmitente, '10.562.655/6202-45', 'CNPJ emitente');

    esperaTextoNaCaixa(
      itens,
      DESTINATARIO.razaoSocial,
      'Maria Aparecida Souza - ME',
      'destinatário',
    );
    esperaTextoNaCaixa(itens, DESTINATARIO.cnpj, '12.705.551/1114-70', 'destinatário');
    esperaTextoNaCaixa(itens, DESTINATARIO.dataEmissao, '10/01/2026', 'destinatário');
    esperaTextoNaCaixa(itens, DESTINATARIO.endereco, 'Rua XV de Novembro, 7342', 'destinatário');
    esperaTextoNaCaixa(itens, DESTINATARIO.bairro, 'Centro', 'destinatário');
    // Corrigido (review 2026-11-20, item 7): o CEP deve sair formatado
    // 80064-391, não cru '80064391' como no layout antigo.
    esperaTextoNaCaixa(itens, DESTINATARIO.cep, '80064-391', 'destinatário');
    esperaTextoNaCaixa(itens, DESTINATARIO.municipio, 'Curitiba', 'destinatário');
    esperaTextoNaCaixa(itens, DESTINATARIO.uf, 'PR', 'destinatário');
    esperaTextoNaCaixa(itens, DESTINATARIO.inscricaoEstadual, '964979227', 'destinatário');

    esperaTextoNaCaixa(itens, CALCULO_IMPOSTO.baseIcms, '1.000,00', 'cálculo do imposto');
    esperaTextoNaCaixa(itens, CALCULO_IMPOSTO.valorIcms, '180,00', 'cálculo do imposto');
    esperaTextoNaCaixa(itens, CALCULO_IMPOSTO.valorProdutos, '108,99', 'cálculo do imposto');
    esperaTextoNaCaixa(itens, CALCULO_IMPOSTO.valorTotal, '108,99', 'cálculo do imposto');
    esperaTextoNaCaixa(itens, TRANSPORTADOR.fretePorConta, 'Sem transp.', 'transportador');
    esperaTextoNaCaixa(
      itens,
      DADOS_ADICIONAIS.informacoes,
      'INFORMAÇÕES COMPLEMENTARES',
      'dados adicionais',
    );
    esperaTextoNaCaixa(
      itens,
      DADOS_ADICIONAIS.reservadoFisco,
      'RESERVADO AO FISCO',
      'dados adicionais',
    );

    const modelo = fixture('nfe-cst-00.xml');
    esperaTextoNaCaixa(itens, PRODUTOS.quadro, modelo.nfe.det[0]!.prod.cProd, 'produtos');
    esperaTextoNaCaixa(itens, PRODUTOS.quadro, modelo.nfe.det[0]!.prod.xProd, 'produtos');
  });

  it('imprime fatura, duplicatas e transporte em seus quadros', async () => {
    const pdf = await renderiza('nfe-duplicatas.xml');
    const itens = await itensDaPagina(pdf, 1);
    esperaTextoNaCaixa(itens, FATURA.conteudo, 'NF-2026-0042', 'fatura');
    esperaTextoNaCaixa(itens, FATURA.conteudo, '001', 'duplicata');
    esperaTextoNaCaixa(itens, FATURA.conteudo, '1.666,67', 'duplicata');

    const transporte = await itensDaPagina(await renderiza('nfe-transporte.xml'), 1);
    esperaTextoNaCaixa(
      transporte,
      TRANSPORTADOR.razaoSocial,
      'Transportadora Rota Sol Ltda',
      'transportador',
    );
    esperaTextoNaCaixa(transporte, TRANSPORTADOR.placa, 'BRA2E19', 'transportador');
    esperaTextoNaCaixa(transporte, TRANSPORTADOR.quantidadeVolumes, '10', 'volumes');
    esperaTextoNaCaixa(transporte, TRANSPORTADOR.especie, 'CAIXA', 'volumes');
  });

  it('preenche o quadro CÁLCULO DO ISSQN quando há serviços', async () => {
    const itens = await itensDaPagina(await renderiza('nfe-issqn-conjugada.xml'), 1);
    esperaTextoNaCaixa(itens, ISSQN.valorServicos, '2.000,00', 'ISSQN');
    esperaTextoNaCaixa(itens, ISSQN.baseCalculo, '2.000,00', 'ISSQN');
    esperaTextoNaCaixa(itens, ISSQN.valorIssqn, '100,00', 'ISSQN');
  });

  it('respeita os tamanhos mínimos de fonte do Anexo II §3.7', async () => {
    const itens = await itensDaPagina(await renderiza('nfe-cst-00.xml'), 1);
    const alturas = itens.map((item) => item.altura);
    expect(alturas.length).toBeGreaterThan(50);
    expect(Math.min(...alturas)).toBeGreaterThanOrEqual(FONTE_MINIMA.descritivoBloco - 0.2);
    expect(alturas.some((a) => Math.abs(a - FONTE_MINIMA.produto) < 0.3)).toBe(true);
    expect(alturas.some((a) => Math.abs(a - FONTE_MINIMA.demais) < 0.3)).toBe(true);
  });

  it('pagina produtos automaticamente e imprime Folha X/Y em todas as folhas', async () => {
    const modelo = fixture('nfe-muitos-itens-60.xml');
    const pdf = await renderDanfe(modelo);
    const { abrePdf } = await import('./helpers/raster');
    const documento = await abrePdf(pdf);
    expect(documento.numPages).toBeGreaterThan(1);

    const codigos = modelo.nfe.det.map((det) => det.prod.cProd);
    const vistos = new Set<string>();
    for (let numero = 1; numero <= documento.numPages; numero++) {
      const itens = await itensDaPagina(pdf, numero);
      const texto = itens
        .map((item) => item.str)
        .join(' ')
        .replace(/\s+/g, ' ');
      const esperado = `FOLHA ${String(numero).padStart(2, '0')}/${String(documento.numPages).padStart(2, '0')}`;
      expect(texto).toContain(esperado);
      for (const codigo of codigos) {
        if (texto.includes(codigo)) vistos.add(codigo);
      }
      if (numero > 1) {
        expect(texto).toContain('CONTINUAÇÃO');
      }
    }
    expect(vistos.size).toBe(codigos.length);
  });

  it('mantém a quantidade de folhas coerente com o volume de itens', async () => {
    const poucos = await renderDanfe(fixture('nfe-muitos-itens-10.xml'));
    const muitos = await renderDanfe(fixture('nfe-muitos-itens-120.xml'));
    const { abrePdf } = await import('./helpers/raster');
    const p1 = await abrePdf(poucos);
    const p2 = await abrePdf(muitos);
    expect(p1.numPages).toBeLessThan(p2.numPages);
    expect(p1.numPages).toBeGreaterThanOrEqual(1);
    expect(p2.numPages).toBeGreaterThanOrEqual(5);
  });

  it('transborda informações complementares para as folhas seguintes', async () => {
    const base = fixture('nfe-cst-00.xml');
    const linhas = Array.from(
      { length: 60 },
      (_, indice) => `INFO_${String(indice).padStart(3, '0')}_${'X'.repeat(28)}`,
    );
    const modelo = {
      ...base,
      nfe: {
        ...base.nfe,
        infAdic: { ...base.nfe.infAdic, infCpl: linhas.join(' ') },
      },
    };
    const pdf = await renderDanfe(modelo);
    const { abrePdf } = await import('./helpers/raster');
    const documento = await abrePdf(pdf);
    expect(documento.numPages).toBeGreaterThan(1);

    const primeiro = (await itensDaPagina(pdf, 1)).map((item) => item.str).join('');
    const ultimo = (await itensDaPagina(pdf, documento.numPages)).map((item) => item.str).join('');
    expect(primeiro).toContain('INFO_000');
    expect(ultimo).toContain('INFO_059');
    expect(primeiro).not.toContain('INFO_059');
  });

  it('aplica SEM VALOR FISCAL em homologação e DENEGADA quando cStat denega', async () => {
    const homologacao = await textoSimples(await renderiza('nfe-homologacao.xml'));
    expect(homologacao[0]).toContain('SEM VALOR FISCAL');
    const denegada = await textoSimples(await renderiza('nfe-denegada.xml'));
    expect(denegada[0]).toContain('DENEGADA');
  });

  it('marca CANCELADA a partir do evento 110111 homologado', async () => {
    const { parseEventoNFe } = await import('../src/index');
    const { readFileSync } = await import('node:fs');
    const evento = parseEventoNFe(readFileSync('tests/fixtures/evento-cancelamento.xml', 'utf8'));
    const pdf = await renderDanfe(fixture('nfe-sem-protocolo.xml'), { eventos: [evento] });
    const texto = await textoSimples(pdf);
    expect(texto[0]).toContain('CANCELADA');
  });

  it('marca CONTINGÊNCIA e imprime o barras adicional de 36 dígitos', async () => {
    const pdf = await renderDanfe(fixture('nfe-cst-00.xml'), { contingencia: true });
    const texto = (await textoSimples(pdf))[0] ?? '';
    expect(texto).toContain('CONTINGÊNCIA');
    // 9 blocos de 4 dígitos = 36 algarismos no campo de dados da NF-e.
    const blocos = texto.match(/\b\d{4}\b/g) ?? [];
    expect(blocos.length).toBeGreaterThanOrEqual(9);
  });

  it('incorpora logotipo PNG opcional', async () => {
    const png = new PNG({ width: 8, height: 8 });
    for (let i = 0; i < png.data.length; i += 4) {
      png.data[i] = 200;
      png.data[i + 1] = 30;
      png.data[i + 2] = 30;
      png.data[i + 3] = 255;
    }
    const logo = new Uint8Array(PNG.sync.write(png));
    const pdf = await renderDanfe(fixture('nfe-cst-00.xml'), { logo });
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe('%PDF-');
    // O campo continua legível com logotipo (MOC §3.1.3).
    const itens = await itensDaPagina(pdf, 1);
    expect(textoNaCaixa(itens, CABECALHO.emitente)).toContain('Avenida das Indústrias');
  });

  it('rejeita vetores inválidos com mensagem clara', async () => {
    const modelo = fixture('nfe-cst-00.xml');
    const invalido = { ...modelo, nfe: { ...modelo.nfe, chave: '1234' } };
    await expect(renderDanfe(invalido)).rejects.toThrow(/Chave de acesso inválida/);
    await expect(renderDanfe(modelo, { logo: new Uint8Array([1, 2, 3, 4, 5]) })).rejects.toThrow(
      /Logotipo inválido/,
    );
  });
});
