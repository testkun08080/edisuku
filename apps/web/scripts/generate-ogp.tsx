import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const WIDTH = 1200;
const HEIGHT = 630;
const SQUARE_SIZE = 1200;
const FOREGROUND_BG_HEX = "#FFFFFF";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const outputPath = resolve(rootDir, "public", "og-image.png");
const squareOutputPath = resolve(rootDir, "public", "og-image-square.png");
const logoSvgPath = resolve(rootDir, "assets", "logo.svg");
const logoDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(readFileSync(logoSvgPath, "utf-8"))}`;

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

const renderPng = (sourceSvg: string, width: number) =>
  new Resvg(sourceSvg, {
    fitTo: {
      mode: "width",
      value: width,
    },
  })
    .render()
    .asPng();

const pngBuffer = renderPng(svg, WIDTH);
const squarePngBuffer = renderPng(squareSvg, SQUARE_SIZE);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, pngBuffer);
writeFileSync(squareOutputPath, squarePngBuffer);

console.log(`Generated: ${outputPath}`);
console.log(`Generated: ${squareOutputPath}`);
