import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const outputDir = path.join(root, "public", "fonts", "qcf4");

const QCF4_FONT_FILES = [
  "QCF4_QBSML.woff2",
  ...Array.from({ length: 47 }, (_, index) => `QCF4_Hafs_${String(index + 1).padStart(2, "0")}_W.woff2`)
];

async function download(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${url}: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

await fs.mkdir(outputDir, { recursive: true });

for (const file of QCF4_FONT_FILES) {
  const target = path.join(outputDir, file);
  const url = `https://fonts.nuqayah.com/qcf4/${file}`;
  const bytes = await download(url);
  await fs.writeFile(target, bytes);
  console.log(`Wrote ${target}`);
}
