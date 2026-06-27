import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const outputDir = path.join(root, "public", "qcf4-source");
const outputPath = path.join(outputDir, "qcf4-hafs-words.json");
const muhaffidhUrl = "https://muhaffidh.app/";
const charBase = 0xf100;

function parseJsStringLiteral(value) {
  return JSON.parse(`"${value}"`);
}

function parseCenteredLines(bundle) {
  const match = bundle.match(/centered_lines:(\{[^}]+\}),custom_header_surah_glyph_offset_fix:/);
  if (!match) throw new Error("Could not find Muhaffidh centered_lines mapping");

  const centeredLines = {};
  for (const item of match[1].matchAll(/(\d+):\[(.*?)\]/g)) {
    centeredLines[item[1]] = item[2].split(",").filter(Boolean).map(Number);
  }
  return centeredLines;
}

function parseHeaderOffsetFixes(bundle) {
  const match = bundle.match(/custom_header_surah_glyph_offset_fix:(\{[^}]*\})/);
  if (!match) return {};

  const fixes = {};
  for (const item of match[1].matchAll(/(\d+):(-?\d+)/g)) {
    fixes[item[1]] = Number(item[2]);
  }
  return fixes;
}

function extractBundleSource(html) {
  const scriptMatches = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)];
  const bundle = scriptMatches.map((match) => match[1]).find((source) => source.includes("Sura,Verse,PageNo,LineNo,FontFile,FontCode,Type"));
  if (!bundle) throw new Error("Could not find Muhaffidh QCF4 data bundle");
  return bundle;
}

function extractRows(bundle) {
  const typesMatch = bundle.match(/Ri=(\[[^\]]+\]),ji="/);
  if (!typesMatch) throw new Error("Could not find Muhaffidh glyph type names");

  const csvMatch = bundle.match(/ji="((?:\\.|[^"])*)"\.split\("\\n"\)\.map/);
  if (!csvMatch) throw new Error("Could not find Muhaffidh QCF4 CSV rows");

  const typeNames = JSON.parse(typesMatch[1]);
  const csv = parseJsStringLiteral(csvMatch[1]);
  const centeredLines = parseCenteredLines(bundle);
  const headerOffsetFixes = parseHeaderOffsetFixes(bundle);
  const [, ...dataLines] = csv.trim().split("\n");
  const counters = new Map();

  const rows = dataLines.map((line) => {
    const [surah, ayah, page, lineNumber, fontNumber, fontCode, typeIndex] = line.split(",").map(Number);
    const type = typeNames[typeIndex - 1];
    const key = `${page}|${surah}|${ayah}`;
    const nextWordIndex = type === "word" ? (counters.get(key) || 0) + 1 : null;
    if (nextWordIndex) counters.set(key, nextWordIndex);

    return {
      page,
      lineNumber,
      surah,
      ayah,
      fontNumber,
      fontFamily: `QCF2${String(fontNumber).padStart(3, "0")}`,
      fontCode,
      glyph: String.fromCharCode(charBase + fontCode),
      typeIndex,
      type,
      wordIndex: nextWordIndex,
      centered: Boolean(centeredLines[String(page)]?.includes(lineNumber))
    };
  });

  return {
    source: muhaffidhUrl,
    generatedAt: new Date().toISOString(),
    charBase,
    typeNames,
    centeredLines,
    headerOffsetFixes,
    rows
  };
}

async function main() {
  const response = await fetch(muhaffidhUrl);
  if (!response.ok) throw new Error(`Failed to fetch ${muhaffidhUrl}: ${response.status} ${response.statusText}`);

  const html = await response.text();
  const bundle = extractBundleSource(html);
  const data = extractRows(bundle);
  const pageCount = new Set(data.rows.map((row) => row.page)).size;

  if (pageCount !== 604) throw new Error(`Expected 604 QCF4 pages, found ${pageCount}`);
  if (!data.rows.some((row) => row.type === "ayah-marker")) throw new Error("Missing ayah-marker rows");
  if (!data.rows.some((row) => row.type === "surah")) throw new Error("Missing surah header rows");
  if (!data.rows.some((row) => row.type === "basmalah")) throw new Error("Missing basmalah rows");

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Wrote ${data.rows.length} QCF4 rows across ${pageCount} pages to ${path.relative(root, outputPath)}`);
}

await main();
