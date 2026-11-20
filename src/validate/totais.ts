/**
 * Recomputação dos totais da NF-e a partir dos itens.
 *
 * Fontes oficiais (MOC 7.0 — Anexo I, seções 4.2/4.4 — Regras de Validação
 * do grupo W e códigos de rejeição):
 * - W07-10 (cStat 564): “Total do Produto / Serviço difere do somatório dos
 *   itens” — vProd = Σ vProd dos itens com indTot = 1;
 * - W08-10 (535), W09-10 (536), W10-10 (537): frete, seguro e desconto;
 * - W03-10 (531)/W04-10 (532): vBC e vICMS; W05-10 (533)/W06-10 (534):
 *   vBCST e vST; 795: vICMSDeson; 861/862/859: vFCP, vFCPST, vFCPSTRet;
 *   798/799/800: partilha do ICMSUFDest; 601: vII; 538: vIPI;
 *   602/603: vPIS e vCOFINS (itens sujeitos ao ICMS); 604: vOutro.
 * - W16-10 (cStat 610) — fórmula oficial do valor total da nota:
 *     vNF = vProd − vDesc − vICMSDeson + vST + vFCPST + vFrete + vSeg +
 *           vOutro + vII + vIPI + vIPIDevol + vServ
 *   com tolerância de R$ 0,50 (nota (*3) do Anexo I, NT 2012/003) e com a
 *   Exceção 3: aceita também a fórmula sem a subtração do vICMSDeson.
 * - I11-10 (cStat 629): “Valor do Produto difere do produto Valor Unitário e
 *   Quantidade” — vProd do item = qCom × vUnCom com arredondamento em 2 casas
 *   e tolerância de R$ 0,01 (nota (*4) do Anexo I); cStat 630 idem para o
 *   par tributável (qTrib × vUnTrib);
 * - N17-20 (cStat 528): “Se CST de ICMS = 00, 10, 20, 70 e finNFe = 1: Valor
 *   ICMS difere de Base de Cálculo × Alíquota” com a mesma tolerância de
 *   R$ 0,01 (nota (*4)); N17-10 (cStat 353) para o CST 51 (diferimento).
 * - NT 2024.002 v1.10 (seção 8.5): com o grupo IBSCBSSelTot presente, os
 *   tributos por fora somam ao total: vNF também inclui vIBSTot + vCBS +
 *   vImpSel.
 *
 * A aritmética é feita em centavos (inteiros) para evitar erros de ponto
 * flutuante: cada valor do XML tem exatamente 2 casas decimais (TDec_1302).
 */
import type { ProblemaValidacao } from '../model/comum';
import type { Det, IcmsTot, NFe } from '../model/nfe';

/** Tolerância oficial para multiplicações (regras 528/629/630, nota *4): R$ 0,01. */
export const TOLERANCIA_ITEM_CENTAVOS = 1;

/** Tolerância oficial da regra W16-10 (nota *3, NT 2012/003): R$ 0,50. */
export const TOLERANCIA_VNF_CENTAVOS = 50;

const centavos = (v: number): number => Math.round(v * 100);

const arredonda2 = (v: number): number => Math.round(v * 100) / 100;

interface SomaAcumulada {
  vProd: number;
  vFrete: number;
  vSeg: number;
  vDesc: number;
  vOutro: number;
  vBC: number;
  vICMS: number;
  vICMSDeson: number;
  vFCP: number;
  vBCST: number;
  vST: number;
  vFCPST: number;
  vFCPSTRet: number;
  vII: number;
  vIPI: number;
  vIPIDevol: number;
  vPIS: number;
  vCOFINS: number;
  vFCPUFDest: number;
  vICMSUFDest: number;
  vICMSUFRemet: number;
  vServ: number;
  vBCIss: number;
  vISS: number;
  vPisIss: number;
  vCofinsIss: number;
}

const SOMA_ZERADA: SomaAcumulada = {
  vProd: 0,
  vFrete: 0,
  vSeg: 0,
  vDesc: 0,
  vOutro: 0,
  vBC: 0,
  vICMS: 0,
  vICMSDeson: 0,
  vFCP: 0,
  vBCST: 0,
  vST: 0,
  vFCPST: 0,
  vFCPSTRet: 0,
  vII: 0,
  vIPI: 0,
  vIPIDevol: 0,
  vPIS: 0,
  vCOFINS: 0,
  vFCPUFDest: 0,
  vICMSUFDest: 0,
  vICMSUFRemet: 0,
  vServ: 0,
  vBCIss: 0,
  vISS: 0,
  vPisIss: 0,
  vCofinsIss: 0,
};

/**
 * Acumula os valores de um item nos totais. Itens com `indTot = 0`
 * (I17b — valor do item não compõe o total da NF-e) são ignorados nos
 * somatórios, conforme comportamento da SEFAZ.
 */
function acumulaItem(det: Det, soma: SomaAcumulada): void {
  const { prod, imposto } = det;

  // Itens de serviço (grupo U): compõem os totais do ISSQN (regras 605-609)
  // independente de indTot — na NF-e conjugada os itens de serviço usam
  // indTot = 0, e o valor entra na nota via vServ (W16-10, cStat 610).
  const vPis = imposto.pis ? vPisDoGrupo(imposto.pis) : undefined;
  const vCofins = imposto.cofins ? vCofinsDoGrupo(imposto.cofins) : undefined;
  if (imposto.issqn) {
    soma.vServ += centavos(prod.vProd);
    soma.vBCIss += centavos(imposto.issqn.vBC);
    soma.vISS += centavos(imposto.issqn.vISSQN);
    if (vPis !== undefined) soma.vPisIss += centavos(vPis);
    if (vCofins !== undefined) soma.vCofinsIss += centavos(vCofins);
  }

  if (prod.indTot !== 1) return;

  soma.vProd += centavos(prod.vProd);
  if (prod.vFrete !== undefined) soma.vFrete += centavos(prod.vFrete);
  if (prod.vSeg !== undefined) soma.vSeg += centavos(prod.vSeg);
  if (prod.vDesc !== undefined) soma.vDesc += centavos(prod.vDesc);
  if (prod.vOutro !== undefined) soma.vOutro += centavos(prod.vOutro);

  const icms = imposto.icms;
  if (icms) {
    if ('vBC' in icms && icms.vBC !== undefined) soma.vBC += centavos(icms.vBC);
    if ('vICMS' in icms && icms.vICMS !== undefined) soma.vICMS += centavos(icms.vICMS);
    if ('vFCP' in icms && icms.vFCP !== undefined) soma.vFCP += centavos(icms.vFCP);
    if ('vBCST' in icms && icms.vBCST !== undefined) soma.vBCST += centavos(icms.vBCST);
    if ('vICMSST' in icms && icms.vICMSST !== undefined) soma.vST += centavos(icms.vICMSST);
    if ('vFCPST' in icms && icms.vFCPST !== undefined) soma.vFCPST += centavos(icms.vFCPST);
    if ('vFCPSTRet' in icms && icms.vFCPSTRet !== undefined) {
      soma.vFCPSTRet += centavos(icms.vFCPSTRet);
    }
    if ('vICMSDeson' in icms && icms.vICMSDeson !== undefined) {
      soma.vICMSDeson += centavos(icms.vICMSDeson);
    }
  }

  if (imposto.ipi?.grupo === 'IPITrib') {
    soma.vIPI += centavos(imposto.ipi.vIPI);
  }
  if (imposto.ii) {
    soma.vII += centavos(imposto.ii.vII);
  }
  if (det.impostoDevol) {
    soma.vIPIDevol += centavos(det.impostoDevol.ipiDevol.vIPIDevol);
  }
  if (imposto.icmsUfDest) {
    if (imposto.icmsUfDest.vFCPUFDest !== undefined) {
      soma.vFCPUFDest += centavos(imposto.icmsUfDest.vFCPUFDest);
    }
    soma.vICMSUFDest += centavos(imposto.icmsUfDest.vICMSUFDest);
    soma.vICMSUFRemet += centavos(imposto.icmsUfDest.vICMSUFRemet);
  }

  // PIS/COFINS dos itens sujeitos ao ICMS (regras 602/603): itens de serviço
  // entram nos totais do ISSQN (608/609), não nestes.
  if (!imposto.issqn) {
    if (vPis !== undefined) soma.vPIS += centavos(vPis);
    if (vCofins !== undefined) soma.vCOFINS += centavos(vCofins);
  }
}

function vPisDoGrupo(pis: NonNullable<Det['imposto']['pis']>): number | undefined {
  switch (pis.grupo) {
    case 'PISAliq':
    case 'PISQtde':
    case 'PISOutr':
      return pis.vPIS;
    default:
      return undefined;
  }
}

function vCofinsDoGrupo(cofins: NonNullable<Det['imposto']['cofins']>): number | undefined {
  switch (cofins.grupo) {
    case 'COFINSAliq':
    case 'COFINSQtde':
    case 'COFINSOutr':
      return cofins.vCOFINS;
    default:
      return undefined;
  }
}

function problemaDivergencia(
  code: string,
  cStat: number,
  campo: string,
  esperadoCentavos: number,
  informado: number,
): ProblemaValidacao {
  const esperado = (esperadoCentavos / 100).toFixed(2);
  return {
    severity: 'erro',
    code,
    cStat,
    campo,
    message: `Total divergente do somatório dos itens (regra W/MOC cStat ${cStat}): ${campo} informado ${informado.toFixed(2)}, soma calculada ${esperado}.`,
  };
}

/**
 * Recomputa e compara os totais (`total/ICMSTot`) contra os itens.
 * Anota problemas — nunca lança exceções.
 */
export function validaTotais(nfe: NFe): ProblemaValidacao[] {
  const problemas: ProblemaValidacao[] = [];
  const soma: SomaAcumulada = { ...SOMA_ZERADA };
  for (const det of nfe.det) {
    acumulaItem(det, soma);
  }

  const t: IcmsTot = nfe.total.icmsTot;

  const checagens: {
    code: string;
    cStat: number;
    campo: string;
    esperado: number;
    informado?: number;
  }[] = [
    { code: 'TOTAL_VPROD', cStat: 564, campo: 'vProd', esperado: soma.vProd, informado: t.vProd },
    {
      code: 'TOTAL_VFRETE',
      cStat: 535,
      campo: 'vFrete',
      esperado: soma.vFrete,
      informado: t.vFrete,
    },
    { code: 'TOTAL_VSEG', cStat: 536, campo: 'vSeg', esperado: soma.vSeg, informado: t.vSeg },
    { code: 'TOTAL_VDESC', cStat: 537, campo: 'vDesc', esperado: soma.vDesc, informado: t.vDesc },
    {
      code: 'TOTAL_VOUTRO',
      cStat: 604,
      campo: 'vOutro',
      esperado: soma.vOutro,
      informado: t.vOutro,
    },
    { code: 'TOTAL_VBC', cStat: 531, campo: 'vBC', esperado: soma.vBC, informado: t.vBC },
    { code: 'TOTAL_VICMS', cStat: 532, campo: 'vICMS', esperado: soma.vICMS, informado: t.vICMS },
    {
      code: 'TOTAL_VICMSDESON',
      cStat: 795,
      campo: 'vICMSDeson',
      esperado: soma.vICMSDeson,
      informado: t.vICMSDeson,
    },
    { code: 'TOTAL_VFCP', cStat: 861, campo: 'vFCP', esperado: soma.vFCP, informado: t.vFCP },
    { code: 'TOTAL_VBCST', cStat: 533, campo: 'vBCST', esperado: soma.vBCST, informado: t.vBCST },
    { code: 'TOTAL_VST', cStat: 534, campo: 'vST', esperado: soma.vST, informado: t.vST },
    {
      code: 'TOTAL_VFCPST',
      cStat: 862,
      campo: 'vFCPST',
      esperado: soma.vFCPST,
      informado: t.vFCPST,
    },
    {
      code: 'TOTAL_VFCPSTRET',
      cStat: 859,
      campo: 'vFCPSTRet',
      esperado: soma.vFCPSTRet,
      informado: t.vFCPSTRet,
    },
    { code: 'TOTAL_VII', cStat: 601, campo: 'vII', esperado: soma.vII, informado: t.vII },
    { code: 'TOTAL_VIPI', cStat: 538, campo: 'vIPI', esperado: soma.vIPI, informado: t.vIPI },
    {
      code: 'TOTAL_VIPIDEVOL',
      cStat: 863,
      campo: 'vIPIDevol',
      esperado: soma.vIPIDevol,
      informado: t.vIPIDevol,
    },
    { code: 'TOTAL_VPIS', cStat: 602, campo: 'vPIS', esperado: soma.vPIS, informado: t.vPIS },
    {
      code: 'TOTAL_VCOFINS',
      cStat: 603,
      campo: 'vCOFINS',
      esperado: soma.vCOFINS,
      informado: t.vCOFINS,
    },
  ];

  for (const c of checagens) {
    if (c.informado === undefined) continue;
    if (centavos(c.informado) !== c.esperado) {
      problemas.push(
        problemaDivergencia(c.code, c.cStat, `total/ICMSTot/${c.campo}`, c.esperado, c.informado),
      );
    }
  }

  // Partilha do ICMS interestadual (W04a/W04b/W04c — cStat 798/799/800).
  const partilha: {
    code: string;
    cStat: number;
    campo: string;
    esperado: number;
    informado?: number;
  }[] = [
    {
      code: 'TOTAL_VFCPUFDEST',
      cStat: 798,
      campo: 'vFCPUFDest',
      esperado: soma.vFCPUFDest,
      informado: t.vFCPUFDest,
    },
    {
      code: 'TOTAL_VICMSUFDEST',
      cStat: 799,
      campo: 'vICMSUFDest',
      esperado: soma.vICMSUFDest,
      informado: t.vICMSUFDest,
    },
    {
      code: 'TOTAL_VICMSUFREMET',
      cStat: 800,
      campo: 'vICMSUFRemet',
      esperado: soma.vICMSUFRemet,
      informado: t.vICMSUFRemet,
    },
  ];
  for (const c of partilha) {
    if (c.informado === undefined) continue;
    if (centavos(c.informado) !== c.esperado) {
      problemas.push(
        problemaDivergencia(c.code, c.cStat, `total/ICMSTot/${c.campo}`, c.esperado, c.informado),
      );
    }
  }

  // Grupo ISSQNtot (regras 605-609, itens sujeitos ao ISS):
  // 605 vServ (Σ vProd dos itens de serviço), 606 vBC, 607 vISS,
  // 608 vPIS e 609 vCOFINS (somatório dos itens de serviço).
  const iss = nfe.total.issqnTot;
  if (iss) {
    const checagensIss: {
      code: string;
      cStat: number;
      campo: string;
      esperado: number;
      informado?: number;
    }[] = [
      {
        code: 'TOTAL_VSERV',
        cStat: 605,
        campo: 'vServ',
        esperado: soma.vServ,
        informado: iss.vServ,
      },
      {
        code: 'TOTAL_VBC_ISS',
        cStat: 606,
        campo: 'vBC',
        esperado: soma.vBCIss,
        informado: iss.vBC,
      },
      { code: 'TOTAL_VISS', cStat: 607, campo: 'vISS', esperado: soma.vISS, informado: iss.vISS },
      {
        code: 'TOTAL_VPIS_ISS',
        cStat: 608,
        campo: 'vPIS',
        esperado: soma.vPisIss,
        informado: iss.vPIS,
      },
      {
        code: 'TOTAL_VCOFINS_ISS',
        cStat: 609,
        campo: 'vCOFINS',
        esperado: soma.vCofinsIss,
        informado: iss.vCOFINS,
      },
    ];
    for (const c of checagensIss) {
      if (c.informado === undefined) continue;
      if (centavos(c.informado) !== c.esperado) {
        problemas.push(
          problemaDivergencia(
            c.code,
            c.cStat,
            `total/ISSQNtot/${c.campo}`,
            c.esperado,
            c.informado,
          ),
        );
      }
    }
  }

  problemas.push(...validaValorTotalNf(nfe));

  return problemas;
}

/**
 * W16-10 (cStat 610) — fórmula do vNF com tolerância de R$ 0,50
 * (nota *3 do Anexo I, NT 2012/003) e Exceção 3 (aceita a fórmula sem
 * subtrair o vICMSDeson). Conforme a redação oficial, a fórmula soma os
 * **campos declarados no grupo W** (vProd id:W07, vDesc id:W10, ...,
 * vServ id:W18) — que são verificados à parte contra os itens pelas regras
 * 531-609. Com os tributos por fora da RTC (NT 2024.002), soma vIBSTot +
 * vCBS + vImpSel do grupo IBSCBSSelTot.
 */
function validaValorTotalNf(nfe: NFe): ProblemaValidacao[] {
  const problemas: ProblemaValidacao[] = [];
  const t = nfe.total.icmsTot;
  const vServ = nfe.total.issqnTot?.vServ ?? 0;

  const tributosPorFora = centavos(
    (nfe.total.ibscbsSelTot?.gIBS.gIBSMunTot.vIBSTot ?? 0) +
      (nfe.total.ibscbsSelTot?.gCBS.vCBS ?? 0) +
      (nfe.total.ibscbsSelTot?.gSel?.vImpSel ?? 0),
  );

  const formulaPadrao =
    centavos(t.vProd) -
    centavos(t.vDesc) -
    centavos(t.vICMSDeson) +
    centavos(t.vST) +
    centavos(t.vFCPST) +
    centavos(t.vFrete) +
    centavos(t.vSeg) +
    centavos(t.vOutro) +
    centavos(t.vII) +
    centavos(t.vIPI) +
    centavos(t.vIPIDevol) +
    centavos(vServ) +
    tributosPorFora;

  // Exceção 3 (NT 2016.002): aceitar também sem a subtração do vICMSDeson.
  const formulaSemDeson = formulaPadrao + centavos(t.vICMSDeson);

  const vNfCentavos = centavos(t.vNF);
  const dentroPadrao = Math.abs(vNfCentavos - formulaPadrao) <= TOLERANCIA_VNF_CENTAVOS;
  const dentroSemDeson = Math.abs(vNfCentavos - formulaSemDeson) <= TOLERANCIA_VNF_CENTAVOS;

  if (!dentroPadrao && !dentroSemDeson) {
    const esperado = (formulaPadrao / 100).toFixed(2);
    problemas.push({
      severity: 'erro',
      code: 'TOTAL_VNF',
      regra: 'W16-10',
      cStat: 610,
      campo: 'total/ICMSTot/vNF',
      message: `Valor total da NF-e (${t.vNF.toFixed(2)}) diverge da fórmula oficial (vProd − vDesc − vICMSDeson + vST + vFCPST + vFrete + vSeg + vOutro + vII + vIPI + vIPIDevol + vServ${tributosPorFora > 0 ? ' + vIBSTot + vCBS + vImpSel' : ''}) com tolerância de R$ 0,50; calculado: ${esperado}.`,
    });
  }
  return problemas;
}

/**
 * Verificações por item:
 * - cStat 629 (I11-10): vProd = qCom × vUnCom (2 casas, tolerância R$ 0,01);
 * - cStat 630: vProd = qTrib × vUnTrib (idem);
 * - cStat 528 (regra N17-20 — MOC 7.0 Anexo I): “Se CST de ICMS = 00, 10, 20,
 *   70 e finNFe = 1: Valor ICMS difere de Base de Cálculo × Alíquota” com a
 *   tolerância R$ 0,01 da nota (*4). Regra aplicada apenas a esses CSTs;
 * - cStat 353 (regra N17-10): no CST 51, vICMS = vICMSOp − vICMSDif
 *   (não aplicada quando um dos dois não é informado).
 */
export function validaItens(nfe: NFe): ProblemaValidacao[] {
  const problemas: ProblemaValidacao[] = [];

  for (const det of nfe.det) {
    const { prod, imposto } = det;
    const etiqueta = `[nItem:${det.nItem}]`;

    const prodCom = arredonda2(prod.qCom * prod.vUnCom);
    if (Math.abs(centavos(prodCom) - centavos(prod.vProd)) > TOLERANCIA_ITEM_CENTAVOS) {
      problemas.push({
        severity: 'erro',
        code: 'ITEM_VPROD',
        cStat: 629,
        campo: `det@nItem=${det.nItem}/prod/vProd`,
        message: `${etiqueta} valor do produto (${prod.vProd.toFixed(2)}) difere do produto qCom × vUnCom (${prodCom.toFixed(2)}) com tolerância de R$ 0,01.`,
      });
    }

    const prodTrib = arredonda2(prod.qTrib * prod.vUnTrib);
    if (Math.abs(centavos(prodTrib) - centavos(prod.vProd)) > TOLERANCIA_ITEM_CENTAVOS) {
      problemas.push({
        severity: 'erro',
        code: 'ITEM_VPROD_TRIB',
        cStat: 630,
        campo: `det@nItem=${det.nItem}/prod/vProd`,
        message: `${etiqueta} valor do produto (${prod.vProd.toFixed(2)}) difere do produto qTrib × vUnTrib (${prodTrib.toFixed(2)}) com tolerância de R$ 0,01.`,
      });
    }

    const icms = imposto.icms;
    if (!icms) continue;

    // N17-20 (cStat 528): CST 00, 10, 20 e 70 com finNFe = 1 (finalidade normal).
    const cstsProdutoBc = ['00', '10', '20', '70'];
    if (
      nfe.ide.finNFe === 1 &&
      'cst' in icms &&
      cstsProdutoBc.includes(icms.cst) &&
      'vBC' in icms &&
      icms.vBC !== undefined &&
      'pICMS' in icms &&
      icms.pICMS !== undefined &&
      'vICMS' in icms &&
      icms.vICMS !== undefined
    ) {
      const esperado = arredonda2((icms.vBC * icms.pICMS) / 100);
      if (Math.abs(centavos(esperado) - centavos(icms.vICMS)) > TOLERANCIA_ITEM_CENTAVOS) {
        problemas.push({
          severity: 'erro',
          code: 'ITEM_VICMS',
          cStat: 528,
          campo: `det@nItem=${det.nItem}/imposto/ICMS/vICMS`,
          message: `${etiqueta} valor do ICMS (${icms.vICMS.toFixed(2)}) difere do produto vBC × pICMS (${esperado.toFixed(2)}) com tolerância de R$ 0,01.`,
        });
      }
    }

    // N17-10 (cStat 353): CST 51 — vICMS = vICMSOp − vICMSDif.
    if (icms.grupo === 'ICMS51' && icms.vICMS !== undefined && icms.vICMSDif !== undefined) {
      const esperado = arredonda2((icms.vICMSOp ?? 0) - icms.vICMSDif);
      if (Math.abs(centavos(esperado) - centavos(icms.vICMS)) > TOLERANCIA_ITEM_CENTAVOS) {
        problemas.push({
          severity: 'erro',
          code: 'ITEM_VICMS_DIFERIDO',
          regra: 'N17-10',
          cStat: 353,
          campo: `det@nItem=${det.nItem}/imposto/ICMS/vICMS`,
          message: `${etiqueta} valor do ICMS no CST=51 (${icms.vICMS.toFixed(2)}) não corresponde à diferença do ICMS operação e ICMS diferido (${esperado.toFixed(2)}).`,
        });
      }
    }
  }
  return problemas;
}
