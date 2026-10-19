// Renders the PNG icon set from public/icons/icon.svg (the single source of truth).
// Run after editing the SVG: `npm run icons`. The PNGs are committed, so builds don't need sharp.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ICONS = fileURLToPath(new URL("../public/icons/", import.meta.url));
const BRAND = "#c2410c"; // gradient end; flattening colour for opaque icons

const source = await readFile(path.join(ICONS, "icon.svg"), "utf8");
const defs = source.match(/<defs>[\s\S]*?<\/defs>/)?.[0];
const art = source.match(/<g id="art"[\s\S]*?<\/g>/)?.[0];
if (!defs || !art) throw new Error('icon.svg must contain <defs> and a flat <g id="art">');

const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}${body}</svg>`;
const rounded = '<rect width="512" height="512" rx="112" fill="url(#bg)"/>';
const fullBleed = '<rect width="512" height="512" fill="url(#bg)"/>';
const scaled = (scale) => `<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${art}</g>`;

/** A 24-unit lucide glyph (same icons as the app's tab bar), white on the brand tile. */
function glyphIcon(paths) {
  const scale = (512 * 0.54) / 24;
  const offset = (512 - 24 * scale) / 2;
  const glyph =
    `<g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="#fff" stroke-width="2" ` +
    `stroke-linecap="round" stroke-linejoin="round">${paths}</g>`;
  return svg(rounded + glyph);
}

const GLYPHS = {
  // lucide "calendar-plus"
  log: '<path d="M16 18h6M16 2v3M19 15v6M21 11.5V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8.3M3 9h18M8 2v3"/>',
  // lucide "book-plus"
  recipe: '<path d="M12 7v6M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20M9 10h6"/>',
  // lucide "clipboard-paste"
  import:
    '<path d="M11 14h10M16 4h2a2 2 0 0 1 2 2v1.344M17 18l4-4-4-4M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 1.793-1.113"/>' +
    '<rect x="8" y="2" width="8" height="4" rx="1"/>',
};

const outputs = [
  { file: "icon-192.png", size: 192, svg: source },
  { file: "icon-512.png", size: 512, svg: source },
  // Android masks this to a circle/squircle: full-bleed tile, artwork well inside the 80% safe zone.
  { file: "icon-maskable-512.png", size: 512, svg: svg(fullBleed + scaled(0.86)), opaque: true },
  // iOS rounds the corners itself and shows transparency as black, so this one is square and opaque.
  { file: "apple-touch-icon.png", size: 180, svg: svg(fullBleed + scaled(1)), opaque: true },
  { file: "favicon-32.png", size: 32, svg: source },
  { file: "shortcut-log-96.png", size: 96, svg: glyphIcon(GLYPHS.log) },
  { file: "shortcut-recipe-96.png", size: 96, svg: glyphIcon(GLYPHS.recipe) },
  { file: "shortcut-import-96.png", size: 96, svg: glyphIcon(GLYPHS.import) },
];

for (const { file, size, svg: text, opaque } of outputs) {
  // Rendering straight at the target size (instead of resizing a big bitmap) keeps edges crisp.
  let image = sharp(Buffer.from(text.replace("<svg ", `<svg width="${size}" height="${size}" `)));
  if (opaque) image = image.flatten({ background: BRAND });
  const info = await image.png({ compressionLevel: 9, palette: size <= 96 }).toFile(path.join(ICONS, file));
  console.log(`  ${file.padEnd(26)} ${String(size).padStart(3)}px  ${(info.size / 1024).toFixed(1)} KB`);
}
console.log(`Icons written to ${path.relative(process.cwd(), ICONS) || "."}`);
