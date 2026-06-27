import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const fontDir = path.join(root, "public", "fonts", "qcf4");
const sourcePath = path.join(root, "public", "qcf4-source", "qcf4-hafs-words.json");

const requiredFonts = [
  "QCF4_QBSML.woff2",
  ...Array.from({ length: 47 }, (_, index) => `QCF4_Hafs_${String(index + 1).padStart(2, "0")}_W.woff2`)
];

async function assertFile(file) {
  const stat = await fs.stat(file).catch(() => null);
  if (!stat?.isFile() || stat.size === 0) throw new Error(`Missing required file: ${file}`);
}

for (const font of requiredFonts) {
  await assertFile(path.join(fontDir, font));
}

await assertFile(sourcePath);
const source = JSON.parse(await fs.readFile(sourcePath, "utf8"));
const rows = Array.isArray(source.rows) ? source.rows : [];
const pages = new Set(rows.map((row) => row.page));
const types = new Set(rows.map((row) => row.type));

if (pages.size !== 604) throw new Error(`Expected 604 QCF4 source pages, found ${pages.size}`);
for (const type of ["word", "ayah-marker", "basmalah", "surah"]) {
  if (!types.has(type)) throw new Error(`Missing QCF4 source row type: ${type}`);
}

console.log(`Validated ${requiredFonts.length} QCF4 font files`);
console.log(`Validated ${rows.length} QCF4 source rows across ${pages.size} pages`);
