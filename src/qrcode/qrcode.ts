/**
 * Codificador QR Code (ISO/IEC 18004) — implementação própria, sem
 * dependências. Gera símbolos modelo 2, versões 1–40, modo **byte**
 * (UTF-8), níveis de correção L/M/Q/H com **M como padrão** (exigência do
 * Manual de Especificações Técnicas do DANFE NFC-e e QR Code), seleção
 * automática de versão e de máscara conforme as regras de avaliação de
 * penalidade do padrão (N1–N4).
 *
 * Pipeline (seções do ISO/IEC 18004 entre parênteses):
 * 1. análise: modo byte, indicador de contagem 8/16 bits (§8.4.1);
 * 2. construção do fluxo de bits + terminador + preenchimento 0xEC/0x11
 *    (§8.4.7–8.4.9);
 * 3. correção de erro Reed-Solomon por bloco e entrelaçamento (§8.5–8.6);
 * 4. matriz: padrões de reconhecimento, separadores, tempo, alinhamento,
 *    informações de formato/versão, colocação em zigue-zague (§7.3–7.10,
 *    Anexo E);
 * 5. mascaramento: 8 padrões, penalidades N1–N4, menor pontuação vence
 *    (§8.8.2–8.8.3);
 * 6. zona de silêncio de 4 módulos exigida na rasterização (Anexo S.4).
 *
 * As tabelas de blocos EC vêm de `./tabelas`; a aritmética GF(2^8), de
 * `./reed-solomon`. Referências cruzadas: implementação de referência do
 * Project Nayuki (MIT, https://github.com/nayuki/QR-Code-generator),
 * consultada em 20/11/2026.
 */
import {
  BITS_FORMATO_NIVEL,
  bitsContagemBytes,
  CODIGOS_EC_POR_BLOCO,
  codewordsBrutos,
  codewordsDados,
  indiceNivel,
  modulosBrutos,
  NUMERO_BLOCOS,
  posicoesAlinhamento,
  tamanhoVersao,
  type NivelCorrecao,
} from './tabelas';
import { polinomioGerador, restoReedSolomon } from './reed-solomon';

/** Opções de codificação QR. */
export interface OpcoesQrCode {
  /** Nível de correção — padrão `'M'` (15%), conforme o manual do DANFE NFC-e. */
  nivelCorrecao?: NivelCorrecao;
  /** Versão mínima (1–40). Padrão 1. */
  versaoMinima?: number;
  /** Versão máxima (1–40). Padrão 40. */
  versaoMaxima?: number;
  /**
   * Máscara forçada (0–7). Ausente ⇒ seleção automática pela menor
   * penalidade N1–N4 (ISO/IEC 18004 §8.8).
   */
  mascara?: number;
}

/** Símbolo QR pronto para rasterização. */
export interface QrCodeSimbolo {
  /** Versão (1–40). */
  versao: number;
  /** Tamanho em módulos = 17 + 4 × versão. */
  tamanho: number;
  /** Nível de correção efetivamente aplicado. */
  nivelCorrecao: NivelCorrecao;
  /** Máscara aplicada (0–7), automática ou forçada. */
  mascara: number;
  /** Matriz `[y][x]`; `true` = módulo escuro. Sem zona de silêncio. */
  modulos: boolean[][];
  /** Módulo em (x, y) — `true` = escuro. Fora do símbolo: `false`. */
  escuro(x: number, y: number): boolean;
  /** SVG standalone com zona de silêncio (4 módulos por padrão). */
  paraSvg(escala?: number, zonaSilencio?: number): string;
}

/**
 * Codifica `dados` (texto UTF-8 ou bytes crus) em um QR Code no modo byte.
 *
 * @throws {RangeError} dados maiores que a capacidade da faixa de versões
 *   escolhida, ou opções fora dos limites do padrão.
 */
export function encodeQrCode(dados: string | Uint8Array, opcoes?: OpcoesQrCode): QrCodeSimbolo {
  const nivel = opcoes?.nivelCorrecao ?? 'M';
  const versaoMinima = opcoes?.versaoMinima ?? 1;
  const versaoMaxima = opcoes?.versaoMaxima ?? 40;
  const mascaraForcada = opcoes?.mascara;

  if (versaoMinima < 1 || versaoMinima > 40 || versaoMaxima < 1 || versaoMaxima > 40) {
    throw new RangeError('encodeQrCode: versão fora do intervalo 1–40 do padrão.');
  }
  if (versaoMinima > versaoMaxima) {
    throw new RangeError('encodeQrCode: versaoMinima > versaoMaxima.');
  }
  if (mascaraForcada !== undefined && (mascaraForcada < 0 || mascaraForcada > 7)) {
    throw new RangeError('encodeQrCode: máscara fora do intervalo 0–7.');
  }

  const bytes = typeof dados === 'string' ? new TextEncoder().encode(dados) : dados;

  // 1. Menor versão da faixa em que o fluxo byte cabe.
  let versao = 0;
  for (let v = versaoMinima; v <= versaoMaxima; v++) {
    const bitsNecessarios = 4 + bitsContagemBytes(v) + 8 * bytes.length;
    if (bitsNecessarios <= codewordsDados(v, nivel) * 8) {
      versao = v;
      break;
    }
  }
  if (versao === 0) {
    throw new RangeError(
      `encodeQrCode: ${bytes.length} bytes não cabem no nível ${nivel} entre as ` +
        `versões ${versaoMinima}–${versaoMaxima} (ISO/IEC 18004: capacidade ` +
        `máxima do modo byte no nível ${nivel}, versão 40, é ` +
        `${codewordsDados(40, nivel) - 2} bytes).`,
    );
  }

  // 2. Fluxo de bits: modo byte + contagem + dados + terminador + padding.
  const capacidadeBits = codewordsDados(versao, nivel) * 8;
  const bits: number[] = [];
  acrescentaBits(0b0100, 4, bits); // indicador de modo byte (0100)
  acrescentaBits(bytes.length, bitsContagemBytes(versao), bits);
  for (const b of bytes) acrescentaBits(b, 8, bits);

  acrescentaBits(0, Math.min(4, capacidadeBits - bits.length), bits); // terminador
  acrescentaBits(0, (8 - (bits.length % 8)) % 8, bits); // alinhamento de byte
  for (let pad = 0xec; bits.length < capacidadeBits; pad ^= 0xec ^ 0x11) {
    acrescentaBits(pad, 8, bits); // preenchimento alternado 0xEC/0x11
  }

  const dadosCodewords = new Uint8Array(bits.length / 8);
  bits.forEach((b, i) => {
    dadosCodewords[i >>> 3] |= b << (7 - (i & 7));
  });

  // 3. Reed-Solomon por bloco + entrelaçamento (§8.5–8.6).
  const codewords = adicionaEcEEntrelaca(dadosCodewords, versao, nivel);

  // 4–5. Matriz, máscara e informações de formato/versão.
  const builder = new MatrizQr(versao, nivel);
  builder.colocaCodewords(codewords);
  let mascara: number;
  if (mascaraForcada !== undefined) {
    builder.aplicaMascara(mascaraForcada);
    builder.desenhaFormato(mascaraForcada);
    mascara = mascaraForcada;
  } else {
    let menorPenalidade = Number.POSITIVE_INFINITY;
    let melhorMascara = 0;
    for (let m = 0; m < 8; m++) {
      builder.aplicaMascara(m); // XOR — aplicar duas vezes desfaz
      builder.desenhaFormato(m);
      const penalidade = builder.penalidade();
      if (penalidade < menorPenalidade) {
        menorPenalidade = penalidade;
        melhorMascara = m;
      }
      builder.aplicaMascara(m);
    }
    builder.aplicaMascara(melhorMascara);
    builder.desenhaFormato(melhorMascara);
    mascara = melhorMascara;
  }

  return builder.simbolo(mascara);
}

/** Anexa os `n` bits menos significativos de `valor` ao buffer. */
function acrescentaBits(valor: number, n: number, buffer: number[]): void {
  for (let i = n - 1; i >= 0; i--) buffer.push((valor >>> i) & 1);
}

/** Bit `i` de `x` (0 = menos significativo). */
function bit(x: number, i: number): boolean {
  return ((x >>> i) & 1) !== 0;
}

/**
 * Divide os codewords de dados nos blocos da versão/nível, calcula o
 * Reed-Solomon de cada bloco e devolve a sequência entrelaçada
 * (§8.6: interleave dos dados e depois dos EC de todos os blocos).
 */
function adicionaEcEEntrelaca(
  dados: Uint8Array,
  versao: number,
  nivel: NivelCorrecao,
): Uint8Array {
  const i = indiceNivel(nivel);
  const numBlocos = NUMERO_BLOCOS[i]![versao]!;
  const ecPorBloco = CODIGOS_EC_POR_BLOCO[i]![versao]!;
  const brutos = codewordsBrutos(versao);
  const numCurtos = numBlocos - (brutos % numBlocos);
  const tamanhoCurto = Math.floor(brutos / numBlocos);

  const blocos: Uint8Array[] = [];
  const gerador = polinomioGerador(ecPorBloco);
  let k = 0;
  for (let b = 0; b < numBlocos; b++) {
    const tamDados = tamanhoCurto - ecPorBloco + (b < numCurtos ? 0 : 1);
    const dadosBloco = dados.slice(k, k + tamDados);
    k += tamDados;
    const ec = restoReedSolomon(dadosBloco, gerador);
    // Bloco completo = dados + EC; nos blocos curtos, a posição do último
    // codeword de dados é saltada no entrelaçamento (§8.6).
    const bloco = new Uint8Array(tamDados + ecPorBloco + (b < numCurtos ? 1 : 0));
    bloco.set(dadosBloco, 0);
    bloco.set(ec, bloco.length - ecPorBloco);
    blocos.push(bloco);
  }

  const resultado = new Uint8Array(brutos);
  let pos = 0;
  for (let idx = 0; idx < blocos[0]!.length; idx++) {
    for (let b = 0; b < blocos.length; b++) {
      // Pula a posição reservada dos blocos curtos (pseudo-codeword 0).
      if (idx !== tamanhoCurto - ecPorBloco || b >= numCurtos) {
        resultado[pos++] = blocos[b]![idx]!;
      }
    }
  }
  return resultado;
}

/** Estado de construção da matriz do símbolo. */
class MatrizQr {
  readonly versao: number;
  readonly tamanho: number;
  private readonly nivel: NivelCorrecao;
  private readonly modulos: boolean[][];
  private readonly funcao: boolean[][];

  constructor(versao: number, nivel: NivelCorrecao) {
    this.versao = versao;
    this.tamanho = tamanhoVersao(versao);
    this.nivel = nivel;
    this.modulos = [];
    this.funcao = [];
    for (let y = 0; y < this.tamanho; y++) {
      this.modulos.push(new Array<boolean>(this.tamanho).fill(false));
      this.funcao.push(new Array<boolean>(this.tamanho).fill(false));
    }
    this.desenhaFuncoes();
  }

  /** Símbolo imutável para o consumidor. */
  simbolo(mascara: number): QrCodeSimbolo {
    const modulos = this.modulos.map((linha) => linha.slice());
    const tamanho = this.tamanho;
    return {
      versao: this.versao,
      tamanho,
      nivelCorrecao: this.nivel,
      mascara,
      modulos,
      escuro: (x, y) => 0 <= x && x < tamanho && 0 <= y && y < tamanho && modulos[y]![x] === true,
      paraSvg: (escala = 4, zonaSilencio = 4) => this.svg(modulos, escala, zonaSilencio),
    };
  }

  // -- padrões de função (§7.3–7.10) -------------------------------------

  private desenhaFuncoes(): void {
    // Padrões de tempo (linha/coluna 6) — alternância começando escuro.
    for (let i = 0; i < this.tamanho; i++) {
      this.defineFuncao(6, i, i % 2 === 0);
      this.defineFuncao(i, 6, i % 2 === 0);
    }
    // Padrões de reconhecimento nos três cantos (com separadores embutidos).
    this.desenhaReconhecimento(3, 3);
    this.desenhaReconhecimento(this.tamanho - 4, 3);
    this.desenhaReconhecimento(3, this.tamanho - 4);
    // Padrões de alinhamento — fora dos cantos com reconhecimento.
    const centros = posicoesAlinhamento(this.versao);
    centros.forEach((cx, i) => {
      centros.forEach((cy, j) => {
        const canto =
          (i === 0 && j === 0) ||
          (i === 0 && j === centros.length - 1) ||
          (i === centros.length - 1 && j === 0);
        if (!canto) this.desenhaAlinhamento(cx, cy);
      });
    });
    // Informações de formato (máscara provisória; reescritas no final) e de
    // versão (versões 7+).
    this.desenhaFormato(0);
    this.desenhaVersao();
  }

  /** Padrão de reconhecimento 7×7 + separador 1 módulo (área 9×9). */
  private desenhaReconhecimento(cx: number, cy: number): void {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || x >= this.tamanho || y < 0 || y >= this.tamanho) continue;
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        // dist 0 (centro) e 1 (bloco 3×3) escuros; 2 = anel claro;
        // 3 = borda escura do 7×7; 4 = separador claro.
        this.defineFuncao(x, y, dist !== 2 && dist !== 4);
      }
    }
  }

  /** Padrão de alinhamento 5×5 centrado em (cx, cy) (§7.3.5). */
  private desenhaAlinhamento(cx: number, cy: number): void {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        this.defineFuncao(cx + dx, cy + dy, dist !== 1);
      }
    }
  }

  /**
   * Informações de formato (§7.4): 15 bits = 5 bits (nível + máscara) com
   * detecção de erro BCH(15,5), XOR com 0x5412; duas cópias.
   */
  desenhaFormato(mascara: number): void {
    const dados = (BITS_FORMATO_NIVEL[this.nivel] << 3) | mascara;
    let resto = dados;
    for (let i = 0; i < 10; i++) resto = (resto << 1) ^ ((resto >>> 9) * 0x537);
    const bits = ((dados << 10) | resto) ^ 0x5412;

    // Primeira cópia: ao redor do canto superior esquerdo.
    for (let i = 0; i <= 5; i++) this.defineFuncao(8, i, bit(bits, i));
    this.defineFuncao(8, 7, bit(bits, 6));
    this.defineFuncao(8, 8, bit(bits, 7));
    this.defineFuncao(7, 8, bit(bits, 8));
    for (let i = 9; i < 15; i++) this.defineFuncao(14 - i, 8, bit(bits, i));

    // Segunda cópia: coluna 8 abaixo + linha 8 à direita.
    for (let i = 0; i < 8; i++) this.defineFuncao(this.tamanho - 1 - i, 8, bit(bits, i));
    for (let i = 8; i < 15; i++) this.defineFuncao(8, this.tamanho - 15 + i, bit(bits, i));
    // Módulo escuro permanente junto ao padrão de reconhecimento inferior.
    this.defineFuncao(8, this.tamanho - 8, true);
  }

  /**
   * Informações de versão (§7.5): 18 bits (6 da versão + 12 BCH com gerador
   * 0x1F25), para as versões 7–40, em duas cópias 3×6.
   */
  private desenhaVersao(): void {
    if (this.versao < 7) return;
    let resto = this.versao;
    for (let i = 0; i < 12; i++) resto = (resto << 1) ^ ((resto >>> 11) * 0x1f25);
    const bits = (this.versao << 12) | resto;
    for (let i = 0; i < 18; i++) {
      const escuro = bit(bits, i);
      const a = this.tamanho - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.defineFuncao(a, b, escuro);
      this.defineFuncao(b, a, escuro);
    }
  }

  private defineFuncao(x: number, y: number, escuro: boolean): void {
    this.modulos[y]![x] = escuro;
    this.funcao[y]![x] = true;
  }

  // -- colocação de dados (§8.7) e máscara (§8.8) ------------------------

  /** Coloca os codewords em zigue-zague, dois módulos por coluna. */
  colocaCodewords(codewords: Uint8Array): void {
    if (codewords.length !== codewordsBrutos(this.versao)) {
      throw new RangeError(
        `Codewords (${codewords.length}) divergem do esperado para a versão ` +
          `${this.versao} (${codewordsBrutos(this.versao)}).`,
      );
    }
    let i = 0; // índice de bit
    for (let direita = this.tamanho - 1; direita >= 1; direita -= 2) {
      if (direita === 6) direita = 5; // salta a coluna do padrão de tempo
      for (let vert = 0; vert < this.tamanho; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = direita - j;
          const paraCima = ((direita + 1) & 2) === 0;
          const y = paraCima ? this.tamanho - 1 - vert : vert;
          if (!this.funcao[y]![x] && i < codewords.length * 8) {
            this.modulos[y]![x] = bit(codewords[i >>> 3]!, 7 - (i & 7));
            i++;
          }
          // Bits remanescentes (< 8 por versão) ficam claros antes da máscara.
        }
      }
    }
    if (i !== codewords.length * 8) {
      throw new RangeError(`Colocação de dados consumiu ${i} bits; esperado ${codewords.length * 8}.`);
    }
  }

  /** Aplica (ou desfaz, por XOR) o padrão de máscara `m` (§8.8.1). */
  aplicaMascara(m: number): void {
    if (m < 0 || m > 7) throw new RangeError(`Máscara ${m} fora do intervalo 0–7.`);
    for (let y = 0; y < this.tamanho; y++) {
      for (let x = 0; x < this.tamanho; x++) {
        let inverte: boolean;
        switch (m) {
          case 0:
            inverte = (x + y) % 2 === 0;
            break;
          case 1:
            inverte = y % 2 === 0;
            break;
          case 2:
            inverte = x % 3 === 0;
            break;
          case 3:
            inverte = (x + y) % 3 === 0;
            break;
          case 4:
            inverte = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
            break;
          case 5:
            inverte = ((x * y) % 2) + ((x * y) % 3) === 0;
            break;
          case 6:
            inverte = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
            break;
          default:
            inverte = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
            break;
        }
        if (!this.funcao[y]![x] && inverte) this.modulos[y]![x] = !this.modulos[y]![x];
      }
    }
  }

  /**
   * Pontuação de penalidade N1–N4 (§8.8.3): sequências longas de mesma cor
   * (N1), blocos 2×2 (N2), padrões semelhantes ao de reconhecimento
   * 1011101 com margem clara ≥ 4 (N3) e desequilíbrio de cor (N4).
   */
  penalidade(): number {
    let total = 0;
    // N1 e N3 em linhas e colunas.
    for (let y = 0; y < this.tamanho; y++) total += this.penalidadeLinha(x => this.modulos[y]![x]!);
    for (let x = 0; x < this.tamanho; x++) total += this.penalidadeLinha(y => this.modulos[y]![x]!);
    // N2: blocos 2×2 de mesma cor.
    for (let y = 0; y < this.tamanho - 1; y++) {
      for (let x = 0; x < this.tamanho - 1; x++) {
        const cor = this.modulos[y]![x]!;
        if (
          cor === this.modulos[y]![x + 1] &&
          cor === this.modulos[y + 1]![x] &&
          cor === this.modulos[y + 1]![x + 1]
        ) {
          total += 3;
        }
      }
    }
    // N4: 10 × passos de 5% de desvio de 50% de módulos escuros.
    let escuros = 0;
    for (const linha of this.modulos) {
      for (const m of linha) if (m) escuros++;
    }
    const percentual = (escuros * 100) / (this.tamanho * this.tamanho);
    total += Math.floor(Math.abs(percentual - 50) / 5) * 10;
    return total;
  }

  /** N1 + N3 para uma linha/coluna (acesso via `leitor`). */
  private penalidadeLinha(leitor: (i: number) => boolean): number {
    let total = 0;
    const n = this.tamanho;
    // N1: sequências de 5+ módulos de mesma cor, qualquer cor.
    for (let i = 0; i < n; ) {
      let j = i;
      const cor = leitor(i);
      while (j < n && leitor(j) === cor) j++;
      if (j - i >= 5) total += 3 + (j - i - 5);
      i = j;
    }
    // N3: padrão 1011101 com margem clara ≥ 4 em pelo menos uma borda; fora
    // do símbolo conta como claro (§8.8.3, penalidade 3).
    for (let i = 0; i + 7 <= n; i++) {
      if (
        leitor(i) &&
        !leitor(i + 1) &&
        leitor(i + 2) &&
        leitor(i + 3) &&
        leitor(i + 4) &&
        !leitor(i + 5) &&
        leitor(i + 6)
      ) {
        if (this.margemClara(leitor, i - 1, -1) || this.margemClara(leitor, i + 7, 1)) {
          total += 40;
        }
      }
    }
    return total;
  }

  /** 4 módulos claros consecutivos a partir de `inicio`, na direção `passo`. */
  private margemClara(leitor: (i: number) => boolean, inicio: number, passo: number): boolean {
    const n = this.tamanho;
    for (let k = 0; k < 4; k++) {
      const i = inicio + k * passo;
      if (i < 0 || i >= n) continue; // fora do símbolo = claro
      if (leitor(i)) return false;
    }
    return true;
  }

  /** SVG do símbolo com zona de silêncio (para depuração e documentação). */
  private svg(modulos: boolean[][], escala: number, zonaSilencio: number): string {
    const n = this.tamanho;
    const total = (n + 2 * zonaSilencio) * escala;
    const partes: string[] = [];
    for (let y = 0; y < n; y++) {
      // Traços contíguos por linha para um path compacto.
      let x = 0;
      while (x < n) {
        if (!modulos[y]![x]) {
          x++;
          continue;
        }
        let fim = x;
        while (fim < n && modulos[y]![fim]) fim++;
        const px = (zonaSilencio + x) * escala;
        const py = (zonaSilencio + y) * escala;
        partes.push(`M${px} ${py}h${(fim - x) * escala}v${escala}h${-(fim - x) * escala}z`);
        x = fim;
      }
    }
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${total}" ` +
      `viewBox="0 0 ${total} ${total}">` +
      `<rect width="${total}" height="${total}" fill="#fff"/>` +
      `<path d="${partes.join('')}" fill="#000"/></svg>`
    );
  }
}

/** Exportado para validação/testes: contagem de módulos brutos por versão. */
export { modulosBrutos, codewordsDados, codewordsBrutos };
