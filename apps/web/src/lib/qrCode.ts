/**
 * Minimal QR Code generator for pairing URLs.
 *
 * Encodes a string into a QR code matrix and renders it as an SVG data URL.
 * Uses alphanumeric encoding where possible, byte mode otherwise.
 * Supports version 1-10 with error correction level L for maximum data capacity.
 *
 * This is intentionally a simplified implementation sufficient for encoding
 * pairing URLs (typically under 200 characters). For production-grade QR
 * generation with full spec compliance, consider a dedicated library.
 */

// ── Galois Field GF(256) arithmetic ──────────────────────────────────

const EXP_TABLE = new Uint8Array(256);
const LOG_TABLE = new Uint8Array(256);

(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP_TABLE[i] = x;
    LOG_TABLE[x] = i;
    x = x << 1;
    if (x & 0x100) x ^= 0x11d;
  }
  EXP_TABLE[255] = EXP_TABLE[0]!;
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP_TABLE[(LOG_TABLE[a]! + LOG_TABLE[b]!) % 255]!;
}

function generateECBytes(data: Uint8Array, ecCount: number): Uint8Array {
  // Build generator polynomial
  const gen = new Uint8Array(ecCount + 1);
  gen[0] = 1;
  for (let i = 0; i < ecCount; i++) {
    for (let j = i + 1; j >= 1; j--) {
      gen[j] = gen[j]! ^ gfMul(gen[j - 1]!, EXP_TABLE[i]!);
    }
  }

  const result = new Uint8Array(ecCount);
  for (let i = 0; i < data.length; i++) {
    const coef = data[i]! ^ result[0]!;
    result.copyWithin(0, 1);
    result[ecCount - 1] = 0;
    if (coef !== 0) {
      for (let j = 0; j < ecCount; j++) {
        result[j] = result[j]! ^ gfMul(gen[j + 1]!, coef);
      }
    }
  }
  return result;
}

// ── QR Code version parameters (L error correction) ─────────────────

interface VersionInfo {
  version: number;
  size: number;
  dataBytes: number;
  ecBytesPerBlock: number;
  group1Blocks: number;
  group1DataBytes: number;
  group2Blocks: number;
  group2DataBytes: number;
}

const VERSIONS: VersionInfo[] = [
  {
    version: 1,
    size: 21,
    dataBytes: 19,
    ecBytesPerBlock: 7,
    group1Blocks: 1,
    group1DataBytes: 19,
    group2Blocks: 0,
    group2DataBytes: 0,
  },
  {
    version: 2,
    size: 25,
    dataBytes: 34,
    ecBytesPerBlock: 10,
    group1Blocks: 1,
    group1DataBytes: 34,
    group2Blocks: 0,
    group2DataBytes: 0,
  },
  {
    version: 3,
    size: 29,
    dataBytes: 55,
    ecBytesPerBlock: 15,
    group1Blocks: 1,
    group1DataBytes: 55,
    group2Blocks: 0,
    group2DataBytes: 0,
  },
  {
    version: 4,
    size: 33,
    dataBytes: 80,
    ecBytesPerBlock: 20,
    group1Blocks: 1,
    group1DataBytes: 80,
    group2Blocks: 0,
    group2DataBytes: 0,
  },
  {
    version: 5,
    size: 37,
    dataBytes: 108,
    ecBytesPerBlock: 26,
    group1Blocks: 1,
    group1DataBytes: 108,
    group2Blocks: 0,
    group2DataBytes: 0,
  },
  {
    version: 6,
    size: 41,
    dataBytes: 136,
    ecBytesPerBlock: 18,
    group1Blocks: 2,
    group1DataBytes: 68,
    group2Blocks: 0,
    group2DataBytes: 0,
  },
  {
    version: 7,
    size: 45,
    dataBytes: 156,
    ecBytesPerBlock: 20,
    group1Blocks: 2,
    group1DataBytes: 78,
    group2Blocks: 0,
    group2DataBytes: 0,
  },
  {
    version: 8,
    size: 49,
    dataBytes: 194,
    ecBytesPerBlock: 24,
    group1Blocks: 2,
    group1DataBytes: 97,
    group2Blocks: 0,
    group2DataBytes: 0,
  },
  {
    version: 9,
    size: 53,
    dataBytes: 232,
    ecBytesPerBlock: 30,
    group1Blocks: 2,
    group1DataBytes: 116,
    group2Blocks: 0,
    group2DataBytes: 0,
  },
  {
    version: 10,
    size: 57,
    dataBytes: 274,
    ecBytesPerBlock: 18,
    group1Blocks: 2,
    group1DataBytes: 68,
    group2Blocks: 2,
    group2DataBytes: 69,
  },
];

function selectVersion(byteLength: number): VersionInfo {
  // Data capacity = dataBytes - mode/length overhead (4 bits mode + 8/16 bits length)
  for (const v of VERSIONS) {
    const overhead = v.version >= 10 ? 3 : 2; // mode indicator + char count indicator
    if (v.dataBytes - overhead >= byteLength) return v;
  }
  throw new Error(`Data too long for QR code (${byteLength} bytes)`);
}

// ── Data encoding (byte mode) ────────────────────────────────────────

function encodeData(text: string, version: VersionInfo): Uint8Array {
  const textBytes = new TextEncoder().encode(text);
  const dataBytes = new Uint8Array(version.dataBytes);
  let bitPos = 0;

  function writeBits(value: number, length: number) {
    for (let i = length - 1; i >= 0; i--) {
      if (value & (1 << i)) {
        dataBytes[bitPos >> 3] = dataBytes[bitPos >> 3]! | (0x80 >> (bitPos & 7));
      }
      bitPos++;
    }
  }

  // Mode indicator: byte mode = 0100
  writeBits(0b0100, 4);
  // Character count indicator
  const countBits = version.version >= 10 ? 16 : 8;
  writeBits(textBytes.length, countBits);
  // Data
  for (const byte of textBytes) {
    writeBits(byte, 8);
  }
  // Terminator
  writeBits(0, Math.min(4, version.dataBytes * 8 - bitPos));

  // Pad to byte boundary
  bitPos = Math.ceil(bitPos / 8) * 8;

  // Pad bytes
  const padBytes = [0xec, 0x11];
  let padIndex = 0;
  while (bitPos < version.dataBytes * 8) {
    writeBits(padBytes[padIndex % 2]!, 8);
    padIndex++;
  }

  return dataBytes;
}

// ── Error correction and interleaving ────────────────────────────────

function computeCodewords(data: Uint8Array, version: VersionInfo): Uint8Array {
  const blocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let offset = 0;

  for (let g = 0; g < 2; g++) {
    const blockCount = g === 0 ? version.group1Blocks : version.group2Blocks;
    const blockDataBytes = g === 0 ? version.group1DataBytes : version.group2DataBytes;
    for (let b = 0; b < blockCount; b++) {
      const blockData = data.slice(offset, offset + blockDataBytes);
      blocks.push(blockData);
      ecBlocks.push(generateECBytes(blockData, version.ecBytesPerBlock));
      offset += blockDataBytes;
    }
  }

  // Interleave data blocks
  const result: number[] = [];
  const maxDataLen = Math.max(...blocks.map((b) => b.length));
  for (let i = 0; i < maxDataLen; i++) {
    for (const block of blocks) {
      if (i < block.length) result.push(block[i]!);
    }
  }
  // Interleave EC blocks
  for (let i = 0; i < version.ecBytesPerBlock; i++) {
    for (const block of ecBlocks) {
      if (i < block.length) result.push(block[i]!);
    }
  }

  return new Uint8Array(result);
}

// ── Matrix construction ──────────────────────────────────────────────

const ALIGNMENT_POSITIONS: Record<number, number[]> = {
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 52],
};

function createMatrix(version: VersionInfo, codewords: Uint8Array): boolean[][] {
  const size = version.size;
  const matrix: (boolean | null)[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null),
  );

  function setModule(row: number, col: number, value: boolean) {
    if (row >= 0 && row < size && col >= 0 && col < size) {
      matrix[row]![col] = value;
    }
  }

  function isReserved(row: number, col: number): boolean {
    return matrix[row]?.[col] !== null && matrix[row]?.[col] !== undefined;
  }

  // Finder patterns
  function placeFinderPattern(row: number, col: number) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const isBlack =
          (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
          (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        setModule(row + r, col + c, r >= 0 && r <= 6 && c >= 0 && c <= 6 ? isBlack : false);
      }
    }
  }

  placeFinderPattern(0, 0);
  placeFinderPattern(0, size - 7);
  placeFinderPattern(size - 7, 0);

  // Alignment patterns
  const positions = ALIGNMENT_POSITIONS[version.version];
  if (positions) {
    for (const r of positions) {
      for (const c of positions) {
        // Skip if overlapping with finder patterns
        if (r <= 8 && c <= 8) continue;
        if (r <= 8 && c >= size - 8) continue;
        if (r >= size - 8 && c <= 8) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const isBlack = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
            setModule(r + dr, c + dc, isBlack);
          }
        }
      }
    }
  }

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    setModule(6, i, i % 2 === 0);
    setModule(i, 6, i % 2 === 0);
  }

  // Dark module
  setModule(size - 8, 8, true);

  // Reserve format info areas
  for (let i = 0; i < 15; i++) {
    // Around top-left finder
    if (i < 6) setModule(8, i, false);
    else if (i < 8) setModule(8, i + 1, false);
    else if (i < 9) setModule(8 - (i - 8), 8, false);
    else setModule(14 - i, 8, false);

    // Around other finders
    if (i < 8) setModule(size - 1 - i, 8, false);
    else setModule(8, size - 15 + i, false);
  }

  // Place data bits
  let bitIndex = 0;
  const totalBits = codewords.length * 8;
  let upward = true;

  for (let col = size - 1; col >= 1; col -= 2) {
    if (col === 6) col = 5; // Skip timing column

    const rows = upward
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    for (const row of rows) {
      for (let c = 0; c < 2; c++) {
        const actualCol = col - c;
        if (isReserved(row, actualCol)) continue;
        if (bitIndex < totalBits) {
          const bit = (codewords[bitIndex >> 3]! >> (7 - (bitIndex & 7))) & 1;
          matrix[row]![actualCol] = bit === 1;
          bitIndex++;
        } else {
          matrix[row]![actualCol] = false;
        }
      }
    }
    upward = !upward;
  }

  // Apply mask pattern 0 (checkerboard) and write format info
  const maskedMatrix: boolean[][] = matrix.map((row, r) =>
    row.map((cell, c) => {
      const val = cell ?? false;
      return (r + c) % 2 === 0 ? !val : val;
    }),
  );

  // Write format info for mask 0, EC level L
  // Pre-computed format string for L/mask0: 111011111000100
  const formatBits = 0b111011111000100;
  for (let i = 0; i < 15; i++) {
    const bit = ((formatBits >> (14 - i)) & 1) === 1;
    // Around top-left
    if (i < 6) maskedMatrix[8]![i] = bit;
    else if (i < 8) maskedMatrix[8]![i + 1] = bit;
    else if (i < 9) maskedMatrix[8 - (i - 8)]![8] = bit;
    else maskedMatrix[14 - i]![8] = bit;
    // Around bottom-left and top-right
    if (i < 8) maskedMatrix[size - 1 - i]![8] = bit;
    else maskedMatrix[8]![size - 15 + i] = bit;
  }

  return maskedMatrix;
}

// ── SVG rendering ────────────────────────────────────────────────────

function matrixToSvg(matrix: boolean[][], quietZone: number = 4): string {
  const size = matrix.length + quietZone * 2;
  const paths: string[] = [];

  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r]!.length; c++) {
      if (matrix[r]![c]) {
        paths.push(`M${c + quietZone},${r + quietZone}h1v1h-1z`);
      }
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">`,
    `<rect width="${size}" height="${size}" fill="#fff"/>`,
    `<path d="${paths.join("")}" fill="#000"/>`,
    "</svg>",
  ].join("");
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Generate a QR code SVG string from the given text.
 */
export function generateQrSvg(text: string): string {
  const textBytes = new TextEncoder().encode(text);
  const version = selectVersion(textBytes.length);
  const data = encodeData(text, version);
  const codewords = computeCodewords(data, version);
  const matrix = createMatrix(version, codewords);
  return matrixToSvg(matrix);
}

/**
 * Generate a QR code as a data URL (SVG) from the given text.
 */
export function generateQrDataUrl(text: string): string {
  const svg = generateQrSvg(text);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
