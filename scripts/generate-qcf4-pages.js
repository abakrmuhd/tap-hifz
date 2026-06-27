import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "public", "qcf4-source", "qcf4-hafs-words.json");
const outputDir = path.join(root, "public", "mushaf-qcf4");

function groupBy(items, buildKey) {
  const map = new Map();
  for (const item of items) {
    const key = buildKey(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function compareRows(a, b) {
  return a.page - b.page || a.lineNumber - b.lineNumber || a.fontCode - b.fontCode;
}

function buildTextGroups(rows) {
  const groups = [];
  let current = null;

  for (const row of rows) {
    if (!current || current.surah !== row.surah || current.ayah !== row.ayah) {
      current = {
        key: `${row.surah}:${row.ayah}`,
        surah: row.surah,
        ayah: row.ayah,
        items: []
      };
      groups.push(current);
    }

    const item = {
      type: row.type,
      glyph: row.glyph,
      fontFamily: row.fontFamily,
      fontNumber: row.fontNumber,
      fontCode: row.fontCode
    };
    if (row.wordIndex) item.wordIndex = row.wordIndex;
    current.items.push(item);
  }

  return groups;
}

function buildLine(lineNumber, rows) {
  const types = new Set(rows.map((row) => row.type));
  const base = {
    line: lineNumber,
    lineNumber,
    centered: rows.some((row) => row.centered)
  };

  if (types.size === 1 && types.has("surah")) {
    return {
      ...base,
      type: "surah-header",
      surah: rows[0].surah,
      glyphs: rows.map((row) => ({
        glyph: row.glyph,
        fontFamily: row.fontFamily,
        fontNumber: row.fontNumber,
        fontCode: row.fontCode,
        type: row.type
      }))
    };
  }

  if (types.size === 1 && types.has("basmalah")) {
    return {
      ...base,
      type: "basmala",
      glyphs: rows.map((row) => ({
        glyph: row.glyph,
        fontFamily: row.fontFamily,
        fontNumber: row.fontNumber,
        fontCode: row.fontCode,
        type: row.type
      }))
    };
  }

  const ayahGroups = buildTextGroups(rows.filter((row) => row.ayah > 0));
  const first = ayahGroups[0];
  const last = ayahGroups.at(-1);

  return {
    ...base,
    type: "text",
    verseRange: first && last ? `${first.key}-${last.key}` : "",
    justify: !base.centered,
    ayahGroups
  };
}

async function main() {
  const source = JSON.parse(await fs.readFile(sourcePath, "utf8"));
  const rowsByPage = groupBy(source.rows.toSorted(compareRows), (row) => row.page);
  await fs.mkdir(outputDir, { recursive: true });

  for (let page = 1; page <= 604; page += 1) {
    const pageRows = rowsByPage.get(page);
    if (!pageRows?.length) throw new Error(`Missing QCF4 rows for page ${page}`);

    const rowsByLine = groupBy(pageRows, (row) => row.lineNumber);
    const lines = [...rowsByLine.entries()]
      .sort(([a], [b]) => a - b)
      .map(([lineNumber, rows]) => buildLine(lineNumber, rows));

    const data = {
      page,
      renderer: "qcf4",
      lines
    };
    const outputPath = path.join(outputDir, `page-${String(page).padStart(3, "0")}.json`);
    await fs.writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`);
  }

  console.log(`Generated 604 QCF4 page files in ${path.relative(root, outputDir)}`);
}

await main();
