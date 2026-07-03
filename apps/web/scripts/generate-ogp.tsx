import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const WIDTH = 1200;
const HEIGHT = 630;
const SQUARE_SIZE = 1200;
const FAVICON_48 = 48;
const FAVICON_192 = 192;
const APPLE_TOUCH = 180;
const FOREGROUND_BG_HEX = "#FFFFFF";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const publicDir = resolve(rootDir, "public");
const outputPath = resolve(publicDir, "og-image.png");
const squareOutputPath = resolve(publicDir, "og-image-square.png");
const favicon48Path = resolve(publicDir, "favicon-48.png");
const favicon192Path = resolve(publicDir, "favicon-192.png");
const appleTouchPath = resolve(publicDir, "apple-touch-icon.png");
const faviconIcoPath = resolve(publicDir, "favicon.ico");
const logoSvgPath = resolve(rootDir, "assets", "logo.svg");
const logoDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(readFileSync(logoSvgPath, "utf-8"))}`;

const renderPng = (sourceSvg: string, width: number) =>
  new Resvg(sourceSvg, {
    fitTo: {
      mode: "width",
      value: width,
    },
  })
    .render()
    .asPng();

const iconSvg = (size: number, logoSize: number, offset: number) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${FOREGROUND_BG_HEX}" />
  <image href="${logoDataUri}" x="${offset}" y="${offset}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet" />
</svg>
`;

const svg = `
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${FOREGROUND_BG_HEX}" />
  <image href="${logoDataUri}" x="450" y="165" width="300" height="300" preserveAspectRatio="xMidYMid meet" />
</svg>
`;

const squareSvg = `
<svg width="${SQUARE_SIZE}" height="${SQUARE_SIZE}" viewBox="0 0 ${SQUARE_SIZE} ${SQUARE_SIZE}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="${SQUARE_SIZE}" height="${SQUARE_SIZE}" fill="${FOREGROUND_BG_HEX}" />
  <image href="${logoDataUri}" x="390" y="390" width="420" height="420" preserveAspectRatio="xMidYMid meet" />
</svg>
`;

/** PNG を 1 枚含む ICO（Vista+ の PNG-in-ICO 形式） */
function pngToIco(pngBuffer: Buffer, size: number): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  entry[0] = size >= 256 ? 0 : size;
  entry[1] = size >= 256 ? 0 : size;
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(pngBuffer.length, 8);
  entry.writeUInt32LE(22, 12);

  return Buffer.concat([header, entry, pngBuffer]);
}

mkdirSync(publicDir, { recursive: true });

const outputs: Array<{ path: string; buffer: Buffer }> = [
  { path: outputPath, buffer: renderPng(svg, WIDTH) },
  { path: squareOutputPath, buffer: renderPng(squareSvg, SQUARE_SIZE) },
  { path: favicon48Path, buffer: renderPng(iconSvg(FAVICON_48, 40, 4), FAVICON_48) },
  { path: favicon192Path, buffer: renderPng(iconSvg(FAVICON_192, 160, 16), FAVICON_192) },
  {
    path: appleTouchPath,
    buffer: renderPng(iconSvg(APPLE_TOUCH, 150, 15), APPLE_TOUCH),
  },
];

for (const { path, buffer } of outputs) {
  writeFileSync(path, buffer);
  console.log(`Generated: ${path}`);
}

const favicon48Buffer = renderPng(iconSvg(FAVICON_48, 40, 4), FAVICON_48);
writeFileSync(faviconIcoPath, pngToIco(favicon48Buffer, FAVICON_48));
console.log(`Generated: ${faviconIcoPath}`);
