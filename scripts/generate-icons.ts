/**
 * Generates the PWA icon set.
 *
 * Why a script instead of committing binaries produced by a design tool: the icons are
 * derived from the brand token in `src/theme/tokens.ts`, and a palette change should be
 * reproducible rather than requiring someone to find the original artwork. Running this
 * again after a token change regenerates every size consistently.
 *
 * Why a hand-rolled PNG encoder instead of `sharp` or `canvas`: both are native
 * dependencies that would be installed on every machine and in CI purely to draw four
 * rectangles. The mark is deliberately simple enough that `zlib` (already in Node) is
 * the only thing needed. See docs/updates/GROUP-16-PWA.md.
 *
 * Usage:
 *   npm run icons:generate
 */

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

// --- Brand ------------------------------------------------------------------

/** `colors.brand.500` from src/theme/tokens.ts. Keep these in step. */
const BRAND = { r: 0x4f, g: 0x5b, b: 0xd5 } as const;
const MARK = { r: 0xff, g: 0xff, b: 0xff } as const;

/**
 * iOS applies its own rounding to `apple-touch-icon`, so that one is drawn square.
 * Android applies a mask to `purpose: "maskable"`, which is why those keep their glyph
 * inside the central safe zone. Everything else gets the squircle radius itself, because
 * desktop installers render the icon as-is.
 */
const SQUIRCLE_RADIUS_RATIO = 0.2237;

// --- PNG encoding -----------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) === 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Buffer): number {
  let c = 0xffffffff;
  for (const byte of bytes) {
    c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed), 0);

  return Buffer.concat([length, typed, crc]);
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type: truecolour with alpha
  header[10] = 0; // deflate
  header[11] = 0; // adaptive filtering
  header[12] = 0; // no interlace

  // Filter type 0 (none) per scanline. The images are flat colour, so the filters that
  // help photographs would only add complexity here.
  const stride = width * 4;
  const raw = Buffer.alloc(height * (1 + stride));
  for (let y = 0; y < height; y += 1) {
    const target = y * (1 + stride);
    raw[target] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, target + 1);
  }

  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * Wraps a PNG in an ICO container.
 *
 * The ICO format permits a PNG payload rather than a BMP, which every browser that still
 * reads `favicon.ico` supports. That avoids writing a second encoder.
 */
function encodeIco(png: Buffer, size: number): Buffer {
  const directory = Buffer.alloc(22);
  directory.writeUInt16LE(0, 0); // reserved
  directory.writeUInt16LE(1, 2); // type: icon
  directory.writeUInt16LE(1, 4); // one image
  directory.writeUInt8(size >= 256 ? 0 : size, 6);
  directory.writeUInt8(size >= 256 ? 0 : size, 7);
  directory.writeUInt8(0, 8); // palette size: not paletted
  directory.writeUInt8(0, 9); // reserved
  directory.writeUInt16LE(1, 10); // colour planes
  directory.writeUInt16LE(32, 12); // bits per pixel
  directory.writeUInt32LE(png.length, 14);
  directory.writeUInt32LE(directory.length, 18);

  return Buffer.concat([directory, png]);
}

// --- Rasterising ------------------------------------------------------------

type Shape = (x: number, y: number) => boolean;

function roundedRect(
  left: number,
  top: number,
  right: number,
  bottom: number,
  radius: number,
): Shape {
  return (x, y) => {
    if (x < left || x > right || y < top || y > bottom) return false;

    // Clamp to the centre of the nearest corner circle. Inside the straight edges this
    // collapses to a zero distance, so one expression covers both cases.
    const cx = Math.min(Math.max(x, left + radius), right - radius);
    const cy = Math.min(Math.max(y, top + radius), bottom - radius);
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= radius * radius;
  };
}

const SAMPLES_PER_AXIS = 4;

/** Fraction of the pixel covered by the shape. Supersampled, so edges are not jagged. */
function coverage(px: number, py: number, shape: Shape): number {
  let hits = 0;
  for (let i = 0; i < SAMPLES_PER_AXIS; i += 1) {
    for (let j = 0; j < SAMPLES_PER_AXIS; j += 1) {
      const x = px + (i + 0.5) / SAMPLES_PER_AXIS;
      const y = py + (j + 0.5) / SAMPLES_PER_AXIS;
      if (shape(x, y)) hits += 1;
    }
  }
  return hits / (SAMPLES_PER_AXIS * SAMPLES_PER_AXIS);
}

type Rgb = { r: number; g: number; b: number };

function paint(canvas: Uint8Array, size: number, shape: Shape, colour: Rgb, opacity = 1): void {
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const alpha = coverage(x, y, shape) * opacity;
      if (alpha <= 0) continue;

      const index = (y * size + x) * 4;
      const dstAlpha = canvas[index + 3]! / 255;
      const outAlpha = alpha + dstAlpha * (1 - alpha);
      if (outAlpha <= 0) continue;

      const mix = (src: number, dst: number) =>
        Math.round((src * alpha + dst * dstAlpha * (1 - alpha)) / outAlpha);

      canvas[index] = mix(colour.r, canvas[index]!);
      canvas[index + 1] = mix(colour.g, canvas[index + 1]!);
      canvas[index + 2] = mix(colour.b, canvas[index + 2]!);
      canvas[index + 3] = Math.round(outAlpha * 255);
    }
  }
}

type IconVariant = "rounded" | "square" | "maskable";

/**
 * The mark: three descending bars, a ledger reduced to its essentials.
 *
 * Chosen because it stays legible at 16px, where anything with fine detail turns to
 * mush, and because it needs no font — an icon that depends on a glyph renders
 * differently on every machine that generates it.
 */
function renderIcon(size: number, variant: IconVariant): Buffer {
  const canvas = new Uint8Array(size * size * 4);

  const backgroundRadius = variant === "rounded" ? size * SQUIRCLE_RADIUS_RATIO : 0;
  paint(canvas, size, roundedRect(0, 0, size, size, backgroundRadius), BRAND);

  // Android's mask can clip up to 20% off each edge, so the maskable glyph is smaller.
  const inset = variant === "maskable" ? size * 0.3 : size * 0.26;
  const glyphLeft = inset;
  const glyphTop = inset;
  const glyphWidth = size - inset * 2;
  const glyphHeight = size - inset * 2;

  // Three bars and two gaps fill the glyph box exactly: 3(0.24) + 2(0.14) = 1.
  const barHeight = glyphHeight * 0.24;
  const gap = glyphHeight * 0.14;
  const widths = [1, 0.72, 0.44];

  widths.forEach((widthRatio, row) => {
    const top = glyphTop + row * (barHeight + gap);
    const right = glyphLeft + glyphWidth * widthRatio;
    paint(canvas, size, roundedRect(glyphLeft, top, right, top + barHeight, barHeight / 2), MARK);
  });

  return encodePng(size, size, canvas);
}

// --- SVG --------------------------------------------------------------------

/**
 * A vector copy of the same mark.
 *
 * Declared in the manifest alongside the PNGs so a desktop installer that can use vector
 * artwork gets a sharp icon at any size, and so the source of truth for the shape is
 * readable rather than only existing as pixels.
 */
function renderSvg(): string {
  const size = 512;
  const inset = size * 0.26;
  const glyph = size - inset * 2;
  const barHeight = glyph * 0.24;
  const gap = glyph * 0.14;
  const radius = (size * SQUIRCLE_RADIUS_RATIO).toFixed(2);

  const bars = [1, 0.72, 0.44]
    .map((widthRatio, row) => {
      const y = (inset + row * (barHeight + gap)).toFixed(2);
      const width = (glyph * widthRatio).toFixed(2);
      return (
        `  <rect x="${inset.toFixed(2)}" y="${y}" width="${width}" ` +
        `height="${barHeight.toFixed(2)}" rx="${(barHeight / 2).toFixed(2)}" fill="#ffffff" />`
      );
    })
    .join("\n");

  const brand = `#${BRAND.r.toString(16)}${BRAND.g.toString(16)}${BRAND.b.toString(16)}`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Expense Tracker">`,
    `  <rect width="${size}" height="${size}" rx="${radius}" fill="${brand}" />`,
    bars,
    `</svg>`,
    ``,
  ].join("\n");
}

// --- Output -----------------------------------------------------------------

const ROOT = join(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const ICONS_DIR = join(ROOT, "public", "icons");

type Output = { file: string; bytes: Buffer };

function build(): Output[] {
  const outputs: Output[] = [
    { file: join(ICONS_DIR, "icon-192.png"), bytes: renderIcon(192, "rounded") },
    { file: join(ICONS_DIR, "icon-512.png"), bytes: renderIcon(512, "rounded") },
    { file: join(ICONS_DIR, "icon-maskable-192.png"), bytes: renderIcon(192, "maskable") },
    { file: join(ICONS_DIR, "icon-maskable-512.png"), bytes: renderIcon(512, "maskable") },
    // iOS ignores transparency and rounds the corners itself, so this one is square.
    { file: join(ICONS_DIR, "apple-touch-icon.png"), bytes: renderIcon(180, "square") },
    { file: join(ICONS_DIR, "icon.svg"), bytes: Buffer.from(renderSvg(), "utf8") },
  ];

  const favicon = renderIcon(32, "rounded");
  outputs.push({ file: join(ROOT, "public", "favicon.ico"), bytes: encodeIco(favicon, 32) });

  return outputs;
}

function main(): void {
  mkdirSync(ICONS_DIR, { recursive: true });

  for (const { file, bytes } of build()) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, bytes);
    console.log(`${relative(ROOT, file)}  ${bytes.length} bytes`);
  }
}

main();
