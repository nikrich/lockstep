// Rasterize the master icon (lockstep/icon.svg) into the PNG/ICO assets that
// browsers + Polar need. One-off build tool — install deps first (kept out of
// package.json so they're not a runtime dependency):
//   npm install --no-save sharp png-to-ico
//   node dashboard/gen-icons.mjs
import sharp from "sharp";
import pngToIco from "png-to-ico";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const svg = fs.readFileSync(path.join(dir, "lockstep", "icon.svg"));
const out = (rel) => path.join(dir, rel);
const render = (size, file) =>
  sharp(svg, { density: 384 }).resize(size, size).png().toFile(out(file)).then(() => `${file} (${size}px)`);

const made = [];
made.push(await render(1024, "lockstep/icon-1024.png")); // Polar org/product logo
made.push(await render(512, "lockstep/icon-512.png"));
made.push(await render(192, "icon-192.png")); // PWA / Android
made.push(await render(180, "apple-touch-icon.png")); // iOS
made.push(await render(32, "favicon-32.png"));
made.push(await render(16, "favicon-16.png"));

const icoBufs = await Promise.all(
  [16, 32, 48].map((s) => sharp(svg, { density: 384 }).resize(s, s).png().toBuffer()),
);
fs.writeFileSync(out("favicon.ico"), await pngToIco(icoBufs));
made.push("favicon.ico (16/32/48)");

console.log("generated:\n  " + made.join("\n  "));
