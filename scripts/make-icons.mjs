import sharp from "sharp";
import { readFileSync } from "node:fs";
const svg = readFileSync("public/icons/icon.svg");
await sharp(svg).resize(192, 192).png().toFile("public/icons/icon-192.png");
await sharp(svg).resize(512, 512).png().toFile("public/icons/icon-512.png");
// maskable: full-bleed background with the mark inside the safe zone
const mask = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#050a16"/><g transform="translate(76 76) scale(.703)"><path d="M118 168l62 190 76-150 76 150 62-190" fill="none" stroke="#3b82f6" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;
await sharp(Buffer.from(mask)).resize(512, 512).png().toFile("public/icons/icon-maskable-512.png");
console.log("icons written");
