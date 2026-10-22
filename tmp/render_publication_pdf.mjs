import fs from 'node:fs/promises';
import { createCanvas, DOMMatrix, ImageData, Path2D } from 'file:///C:/Users/Administrador/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@napi-rs/canvas/index.js';
import { getDocument } from 'file:///C:/Users/Administrador/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs';
globalThis.DOMMatrix = DOMMatrix; globalThis.ImageData = ImageData; globalThis.Path2D = Path2D;
const input = process.argv[2]; const out = process.argv[3];
const pdf = await getDocument({ data: new Uint8Array(await fs.readFile(input)), disableWorker: true, useSystemFonts: true }).promise;
console.log(`pages=${pdf.numPages}`);
for (let n=1; n<=pdf.numPages; n++) {
 const page=await pdf.getPage(n); const viewport=page.getViewport({scale:1.35}); const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
 await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
 await fs.writeFile(`${out}/page-${n}.png`,canvas.toBuffer('image/png'));
}