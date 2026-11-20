/**
 * CLI `danfe` — linha de comando para o danfe-br.
 *
 * Aceita um arquivo XML ou um diretório inteiro (lote), renderiza o DANFE
 * retrato/paisagem ou o DANFE NFC-e em PDF e expõe a validação com códigos de
 * saída estáveis:
 *   0 = sucesso; 1 = documento inválido/erro de processamento; 2 = uso inválido.
 *
 * Nenhuma regra fiscal é inventada aqui: a CLI apenas orquestra `parseNFe`,
 * `validateNFe` e os renderizadores, todos com as fontes oficiais citadas em
 * seus próprios módulos.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import type { ResultadoValidacaoNFe } from '../validate/validate';
import { parseNFe } from '../parse/nfe';
import { validateNFe } from '../validate/validate';
import { renderDanfe } from '../render/danfe-retrato';
import { renderDanfeNfce } from '../render/danfe-nfce';

/** Versão exibida por `--version`; validada contra package.json nos testes. */
export const VERSAO_CLI = '0.1.0';

export const USO_CLI = `Uso: danfe <arquivo.xml|diretorio> [opcoes]

Opcoes:
  -o, --output <arquivo.pdf|diretorio>  Saida (arquivo para 1 XML, diretorio para lote)
  -l, --layout <retrato|paisagem|nfce>  Leiaute do PDF (padrao: retrato; NFC-e detectado automaticamente)
      --papel <80|58>                   Largura do papel do NFC-e em mm (padrao: 80)
      --logo <arquivo.png|jpg>          Logotipo do emitente (MOC 7.0 §3.1.3)
      --json                            Imprime o relatorio estruturado em JSON no stdout
      --validate                        Apenas valida; saida != 0 se houver erros
  -h, --help                            Mostra esta ajuda
  -V, --version                         Mostra a versao

Codigos de saida: 0 = ok, 1 = documento/processamento invalido, 2 = uso invalido.`;

export type LayoutCli = 'retrato' | 'paisagem' | 'nfce';

/** Opcoes já normalizadas pelo analisador de argumentos. */
export interface OpcoesCli {
  entradas: string[];
  saida?: string;
  layout?: LayoutCli;
  larguraMm: 80 | 58;
  logo?: string;
  json: boolean;
  validate: boolean;
  ajuda: boolean;
  versao: boolean;
}

export type AnaliseArgumentos =
  { readonly ok: true; readonly opcoes: OpcoesCli } | { readonly ok: false; readonly erro: string };

/** Interface de E/S injetável — mantém a lógica testável sem tocar no processo. */
export interface IoCli {
  escreve(texto: string): void;
  erro(texto: string): void;
}

/** Uma entrada processada, também usada pelo relatório `--json`. */
export interface RelatorioEntrada {
  entrada: string;
  chave: string;
  modelo: number;
  numero: number;
  serie: number;
  emitente: string;
  validacao: ResultadoValidacaoNFe;
  pdf?: string;
}

export interface ResultadoCli {
  codigo: 0 | 1 | 2;
  pdfs: string[];
  relatorio: { arquivos: RelatorioEntrada[] };
}

const LAYOUTS: ReadonlySet<string> = new Set(['retrato', 'paisagem', 'nfce']);

function proximoValor(argv: readonly string[], indice: number, opcao: string): string | undefined {
  const atual = argv[indice];
  if (atual?.startsWith(`${opcao}=`)) return atual.slice(opcao.length + 1);
  return argv[indice + 1];
}

function consomeValorComIgualdade(argv: readonly string[], indice: number, opcao: string): boolean {
  return argv[indice]?.startsWith(`${opcao}=`) ?? false;
}

/** Analisa argv (sem o nome do programa) sem efeitos colaterais. */
export function analisaArgumentos(argv: readonly string[]): AnaliseArgumentos {
  const opcoes: OpcoesCli = {
    entradas: [],
    larguraMm: 80,
    json: false,
    validate: false,
    ajuda: false,
    versao: false,
  };

  let apenasPosicionais = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? '';
    if (apenasPosicionais) {
      opcoes.entradas.push(arg);
      continue;
    }
    if (arg === '--') {
      apenasPosicionais = true;
      continue;
    }
    if (arg === '-h' || arg === '--help') {
      opcoes.ajuda = true;
      continue;
    }
    if (arg === '-V' || arg === '--version') {
      opcoes.versao = true;
      continue;
    }
    if (arg === '--json') {
      opcoes.json = true;
      continue;
    }
    if (arg === '--validate') {
      opcoes.validate = true;
      continue;
    }

    const opcaoComValor = (nome: string, curto?: string): string | undefined => {
      const longo = `--${nome}`;
      const alias = curto ? `-${curto}` : undefined;
      if (arg === longo || arg === alias || arg.startsWith(`${longo}=`)) {
        const valor = proximoValor(argv, i, longo);
        if (valor === undefined || valor === '' || valor.startsWith('-')) return undefined;
        if (!consomeValorComIgualdade(argv, i, longo)) i++;
        return valor;
      }
      return undefined;
    };

    if (arg === '-o' || arg === '--output' || arg.startsWith('--output=')) {
      const valor = opcaoComValor('output', 'o');
      if (valor === undefined) return { ok: false, erro: 'opção --output sem valor' };
      opcoes.saida = valor;
      continue;
    }
    if (arg === '-l' || arg === '--layout' || arg.startsWith('--layout=')) {
      const valor = opcaoComValor('layout', 'l');
      if (valor === undefined) return { ok: false, erro: 'opção --layout sem valor' };
      const normalizado = valor.toLowerCase();
      if (!LAYOUTS.has(normalizado)) {
        return {
          ok: false,
          erro: `leiaute desconhecido: ${valor} (use retrato, paisagem ou nfce)`,
        };
      }
      opcoes.layout = normalizado as LayoutCli;
      continue;
    }
    if (arg === '--papel' || arg.startsWith('--papel=')) {
      const valor = opcaoComValor('papel');
      if (valor === undefined) return { ok: false, erro: 'opção --papel sem valor' };
      if (valor !== '80' && valor !== '58') {
        return { ok: false, erro: `largura de papel inválida: ${valor} (use 80 ou 58)` };
      }
      opcoes.larguraMm = Number(valor) as 80 | 58;
      continue;
    }
    if (arg === '--logo' || arg.startsWith('--logo=')) {
      const valor = opcaoComValor('logo');
      if (valor === undefined) return { ok: false, erro: 'opção --logo sem valor' };
      opcoes.logo = valor;
      continue;
    }
    if (arg.startsWith('-')) {
      return { ok: false, erro: `opção desconhecida: ${arg}` };
    }
    opcoes.entradas.push(arg);
  }

  if (!opcoes.ajuda && !opcoes.versao && opcoes.entradas.length === 0) {
    return { ok: false, erro: 'nenhum arquivo XML ou diretório informado' };
  }
  return { ok: true, opcoes };
}

/**
 * PNG válido na estrutura mínima exigida pelo `embedPng` do pdf-lib:
 * assinatura de 8 bytes (RFC 2083 / ISO/IEC 15948) seguida do comprimento
 * e do tipo do primeiro chunk, que deve ser `IHDR` (13 bytes).
 */
function ehPng(bytes: Uint8Array): boolean {
  const assinatura = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!assinatura.every((byte, i) => bytes[i] === byte)) return false;
  return (
    bytes[8] === 0x00 &&
    bytes[9] === 0x00 &&
    bytes[10] === 0x00 &&
    bytes[11] === 0x0d &&
    bytes[12] === 0x49 &&
    bytes[13] === 0x48 &&
    bytes[14] === 0x44 &&
    bytes[15] === 0x52
  );
}

/** JPEG válido na estrutura mínima (ITU-T T.81): SOI + marcador + EOI. */
function ehJpeg(bytes: Uint8Array): boolean {
  const n = bytes.length;
  return (
    n >= 4 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff &&
    bytes[n - 2] === 0xff &&
    bytes[n - 1] === 0xd9
  );
}

/**
 * Valida o logotipo com o mesmo decodificador usado na renderização: assinatura
 * de arquivo + decodificação real pelo pdf-lib. Assim um PNG/JPEG truncado é erro de uso
 * (código 2) e não uma falha de renderização avançada (código 1).
 */
async function logotipoDecodificavel(bytes: Uint8Array): Promise<boolean> {
  if (!ehPng(bytes) && !ehJpeg(bytes)) return false;
  try {
    const pdf = await PDFDocument.create();
    if (ehPng(bytes)) await pdf.embedPng(bytes);
    else await pdf.embedJpg(bytes);
    return true;
  } catch {
    return false;
  }
}

function mensagemErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro);
}

function arquivosDeEntrada(entradas: readonly string[], erro: (texto: string) => void): string[] {
  const arquivos: string[] = [];
  for (const entrada of entradas) {
    const caminho = resolve(entrada);
    if (!existsSync(caminho)) {
      erro(`danfe: arquivo ou diretório não encontrado: ${entrada}`);
      continue;
    }
    if (statSync(caminho).isDirectory()) {
      const nomes = readdirSync(caminho)
        .filter((nome) => extname(nome).toLowerCase() === '.xml')
        .sort();
      if (nomes.length === 0) {
        erro(`danfe: nenhum arquivo .xml em ${entrada}`);
        continue;
      }
      for (const nome of nomes) arquivos.push(join(caminho, nome));
    } else {
      arquivos.push(caminho);
    }
  }
  return arquivos;
}

function caminhoSaida(arquivo: string, opcoes: OpcoesCli, único: boolean): string {
  if (opcoes.saida && único && extname(opcoes.saida).toLowerCase() === '.pdf') {
    return resolve(opcoes.saida);
  }
  const diretorio = opcoes.saida ? resolve(opcoes.saida) : dirname(arquivo);
  return join(diretorio, `${basename(arquivo, extname(arquivo))}.pdf`);
}

/**
 * Executa a CLI com E/S injetada e devolve o código de saída. Não chama
 * `process.exit` — o binário em `src/cli/main.ts` converte o resultado.
 */
export async function executaCli(
  argv: readonly string[],
  io: IoCli = {
    escreve: (texto) => process.stdout.write(texto),
    erro: (texto) => process.stderr.write(texto),
  },
): Promise<ResultadoCli> {
  const analise = analisaArgumentos(argv);
  if (!analise.ok) {
    io.erro(`danfe: ${analise.erro}\n${USO_CLI}\n`);
    return { codigo: 2, pdfs: [], relatorio: { arquivos: [] } };
  }
  const opcoes = analise.opcoes;
  if (opcoes.ajuda) {
    io.escreve(`${USO_CLI}\n`);
    return { codigo: 0, pdfs: [], relatorio: { arquivos: [] } };
  }
  if (opcoes.versao) {
    io.escreve(`danfe-br ${VERSAO_CLI}\n`);
    return { codigo: 0, pdfs: [], relatorio: { arquivos: [] } };
  }

  let logo: Uint8Array | undefined;
  if (opcoes.logo) {
    try {
      logo = readFileSync(resolve(opcoes.logo));
    } catch (erro) {
      io.erro(`danfe: não foi possível ler o logotipo: ${mensagemErro(erro)}\n`);
      return { codigo: 2, pdfs: [], relatorio: { arquivos: [] } };
    }
    if (!(await logotipoDecodificavel(logo))) {
      io.erro(
        'danfe: logotipo deve ser PNG ou JPEG válido e não corrompido (assinatura/estrutura inválida)\n',
      );
      return { codigo: 2, pdfs: [], relatorio: { arquivos: [] } };
    }
  }

  const falhas: string[] = [];
  const arquivos = arquivosDeEntrada(opcoes.entradas, (texto) => {
    falhas.push(texto);
    io.erro(`${texto}\n`);
  });

  const lotes = opcoes.entradas.some(
    (entrada) => existsSync(resolve(entrada)) && statSync(resolve(entrada)).isDirectory(),
  );
  const único = !lotes && arquivos.length === 1;
  if (opcoes.saida && !único && extname(opcoes.saida).toLowerCase() === '.pdf') {
    io.erro('danfe: para lote, --output deve ser um diretório (não um .pdf)\n');
    return { codigo: 2, pdfs: [], relatorio: { arquivos: [] } };
  }

  const relatorio: RelatorioEntrada[] = [];
  const pdfs: string[] = [];

  for (const arquivo of arquivos) {
    const nome = basename(arquivo);
    let xml: string;
    try {
      xml = readFileSync(arquivo, 'utf8');
    } catch (erro) {
      io.erro(`danfe: ${nome}: ${mensagemErro(erro)}\n`);
      falhas.push(nome);
      continue;
    }

    let proc;
    try {
      proc = parseNFe(xml);
    } catch (erro) {
      io.erro(`danfe: ${nome}: falha ao analisar XML: ${mensagemErro(erro)}\n`);
      falhas.push(nome);
      continue;
    }

    const validacao = validateNFe(proc);
    for (const problema of validacao.problemas) {
      const cStat = problema.cStat === undefined ? '' : ` (cStat ${problema.cStat})`;
      const regra = problema.regra === undefined ? '' : ` [${problema.regra}]`;
      io.erro(
        `danfe: ${nome}: ${problema.severity} ${problema.code}${regra}${cStat}: ${problema.message}\n`,
      );
    }
    if (opcoes.validate && !validacao.valido) {
      falhas.push(nome);
      relatorio.push({
        entrada: arquivo,
        chave: proc.nfe.chave,
        modelo: proc.nfe.ide.mod,
        numero: proc.nfe.ide.nNF,
        serie: proc.nfe.ide.serie,
        emitente: proc.nfe.emit.xNome,
        validacao,
      });
      continue;
    }

    const item: RelatorioEntrada = {
      entrada: arquivo,
      chave: proc.nfe.chave,
      modelo: proc.nfe.ide.mod,
      numero: proc.nfe.ide.nNF,
      serie: proc.nfe.ide.serie,
      emitente: proc.nfe.emit.xNome,
      validacao,
    };

    if (!opcoes.validate) {
      const layout = opcoes.layout ?? (proc.nfe.ide.mod === 65 ? 'nfce' : 'retrato');
      try {
        const pdf =
          layout === 'nfce'
            ? await renderDanfeNfce(proc, { larguraMm: opcoes.larguraMm })
            : await renderDanfe(proc, { layout, logo });
        const destino = caminhoSaida(arquivo, opcoes, único);
        mkdirSync(dirname(destino), { recursive: true });
        writeFileSync(destino, pdf);
        item.pdf = destino;
        pdfs.push(destino);
      } catch (erro) {
        io.erro(`danfe: ${nome}: falha ao renderizar: ${mensagemErro(erro)}\n`);
        falhas.push(nome);
        relatorio.push(item);
        continue;
      }
    }

    relatorio.push(item);
  }

  if (opcoes.json) io.escreve(`${JSON.stringify({ arquivos: relatorio }, null, 2)}\n`);
  return { codigo: falhas.length > 0 ? 1 : 0, pdfs, relatorio: { arquivos: relatorio } };
}
