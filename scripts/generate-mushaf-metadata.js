import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JUZ_RANGES } from "../src/data/juz.js";
import { buildMetadataFromPages } from "../src/data/metadata-logic.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const mushafDir = path.join(root, "public", "mushaf");
const outputPath = path.join(root, "src", "data", "mushaf-metadata.json");

const files = (await fs.readdir(mushafDir)).filter((name) => name.endsWith(".json")).sort();
const pageMap = {};

for (const file of files) {
  const fullPath = path.join(mushafDir, file);
  const pageData = JSON.parse(await fs.readFile(fullPath, "utf8"));
  pageMap[pageData.page] = pageData;
}

const juzRanges = JUZ_RANGES.map(([number, startPage, endPage]) => ({ number, startPage, endPage }));
const metadata = buildMetadataFromPages(pageMap, juzRanges);

await fs.writeFile(outputPath, JSON.stringify(metadata, null, 2));
console.log(`Wrote ${outputPath}`);
