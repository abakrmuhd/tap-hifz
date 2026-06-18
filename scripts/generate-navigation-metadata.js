import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import mushafMetadata from "../src/data/mushaf-metadata.json" with { type: "json" };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputPath = path.join(__dirname, "..", "src", "data", "navigation-metadata.json");

const SURAH_NAMES = [
  { number: 1, transliteratedName: "Al-Fatihah", englishName: "The Opening", aliases: ["fatiha"] },
  { number: 2, transliteratedName: "Al-Baqarah", englishName: "The Cow" },
  { number: 3, transliteratedName: "Ali 'Imran", englishName: "Family of Imran", aliases: ["aal imran", "al imran"] },
  { number: 4, transliteratedName: "An-Nisa", englishName: "The Women", aliases: ["nisa"] },
  { number: 5, transliteratedName: "Al-Ma'idah", englishName: "The Table Spread", aliases: ["maidah", "maida"] },
  { number: 6, transliteratedName: "Al-An'am", englishName: "The Cattle", aliases: ["anam", "anam"] },
  { number: 7, transliteratedName: "Al-A'raf", englishName: "The Heights", aliases: ["araf", "a raf"] },
  { number: 8, transliteratedName: "Al-Anfal", englishName: "The Spoils of War", aliases: ["anfal"] },
  { number: 9, transliteratedName: "At-Tawbah", englishName: "The Repentance", aliases: ["tawbah", "taubah", "baraah", "baraa"] },
  { number: 10, transliteratedName: "Yunus", englishName: "Jonah" },
  { number: 11, transliteratedName: "Hud", englishName: "Hud" },
  { number: 12, transliteratedName: "Yusuf", englishName: "Joseph" },
  { number: 13, transliteratedName: "Ar-Ra'd", englishName: "The Thunder", aliases: ["rad", "ra d"] },
  { number: 14, transliteratedName: "Ibrahim", englishName: "Abraham" },
  { number: 15, transliteratedName: "Al-Hijr", englishName: "The Rocky Tract", aliases: ["hijr"] },
  { number: 16, transliteratedName: "An-Nahl", englishName: "The Bee", aliases: ["nahl"] },
  { number: 17, transliteratedName: "Al-Isra", englishName: "The Night Journey", aliases: ["isra", "bani israel"] },
  { number: 18, transliteratedName: "Al-Kahf", englishName: "The Cave", aliases: ["kahf"] },
  { number: 19, transliteratedName: "Maryam", englishName: "Mary" },
  { number: 20, transliteratedName: "Ta-Ha", englishName: "Ta Ha", aliases: ["taha"] },
  { number: 21, transliteratedName: "Al-Anbiya", englishName: "The Prophets", aliases: ["anbiya"] },
  { number: 22, transliteratedName: "Al-Hajj", englishName: "The Pilgrimage", aliases: ["hajj"] },
  { number: 23, transliteratedName: "Al-Mu'minun", englishName: "The Believers", aliases: ["muminun", "mu minoon"] },
  { number: 24, transliteratedName: "An-Nur", englishName: "The Light", aliases: ["nur"] },
  { number: 25, transliteratedName: "Al-Furqan", englishName: "The Criterion", aliases: ["furqan"] },
  { number: 26, transliteratedName: "Ash-Shu'ara", englishName: "The Poets", aliases: ["shuara", "shu ara"] },
  { number: 27, transliteratedName: "An-Naml", englishName: "The Ant", aliases: ["naml"] },
  { number: 28, transliteratedName: "Al-Qasas", englishName: "The Stories", aliases: ["qasas"] },
  { number: 29, transliteratedName: "Al-'Ankabut", englishName: "The Spider", aliases: ["ankabut", "ankaboot"] },
  { number: 30, transliteratedName: "Ar-Rum", englishName: "The Romans", aliases: ["rum"] },
  { number: 31, transliteratedName: "Luqman", englishName: "Luqman" },
  { number: 32, transliteratedName: "As-Sajdah", englishName: "The Prostration", aliases: ["sajdah", "sajda"] },
  { number: 33, transliteratedName: "Al-Ahzab", englishName: "The Combined Forces", aliases: ["ahzab"] },
  { number: 34, transliteratedName: "Saba", englishName: "Sheba" },
  { number: 35, transliteratedName: "Fatir", englishName: "Originator" },
  { number: 36, transliteratedName: "Ya-Sin", englishName: "Ya Sin", aliases: ["yasin", "ya seen"] },
  { number: 37, transliteratedName: "As-Saffat", englishName: "Those Who Set The Ranks", aliases: ["saffat", "saffaat"] },
  { number: 38, transliteratedName: "Sad", englishName: "Sad", aliases: ["saad"] },
  { number: 39, transliteratedName: "Az-Zumar", englishName: "The Groups", aliases: ["zumar"] },
  { number: 40, transliteratedName: "Ghafir", englishName: "The Forgiver", aliases: ["mumin", "mu min"] },
  { number: 41, transliteratedName: "Fussilat", englishName: "Explained In Detail", aliases: ["fussilat", "ha mim سجدة", "hamim sajdah"] },
  { number: 42, transliteratedName: "Ash-Shura", englishName: "The Consultation", aliases: ["shura"] },
  { number: 43, transliteratedName: "Az-Zukhruf", englishName: "The Gold Adornments", aliases: ["zukhruf"] },
  { number: 44, transliteratedName: "Ad-Dukhan", englishName: "The Smoke", aliases: ["dukhan"] },
  { number: 45, transliteratedName: "Al-Jathiyah", englishName: "The Crouching", aliases: ["jathiyah", "jathiya"] },
  { number: 46, transliteratedName: "Al-Ahqaf", englishName: "The Wind-Curved Sandhills", aliases: ["ahqaf"] },
  { number: 47, transliteratedName: "Muhammad", englishName: "Muhammad" },
  { number: 48, transliteratedName: "Al-Fath", englishName: "The Victory", aliases: ["fath"] },
  { number: 49, transliteratedName: "Al-Hujurat", englishName: "The Rooms", aliases: ["hujurat"] },
  { number: 50, transliteratedName: "Qaf", englishName: "Qaf", aliases: ["qaaf"] },
  { number: 51, transliteratedName: "Adh-Dhariyat", englishName: "The Winnowing Winds", aliases: ["dhariyat", "zariyat", "zaariyaat"] },
  { number: 52, transliteratedName: "At-Tur", englishName: "The Mount", aliases: ["tur"] },
  { number: 53, transliteratedName: "An-Najm", englishName: "The Star", aliases: ["najm"] },
  { number: 54, transliteratedName: "Al-Qamar", englishName: "The Moon", aliases: ["qamar"] },
  { number: 55, transliteratedName: "Ar-Rahman", englishName: "The Most Merciful", aliases: ["rahman"] },
  { number: 56, transliteratedName: "Al-Waqi'ah", englishName: "The Inevitable", aliases: ["waqiah", "waqia"] },
  { number: 57, transliteratedName: "Al-Hadid", englishName: "The Iron", aliases: ["hadid"] },
  { number: 58, transliteratedName: "Al-Mujadilah", englishName: "The Pleading Woman", aliases: ["mujadilah", "mujadila"] },
  { number: 59, transliteratedName: "Al-Hashr", englishName: "The Exile", aliases: ["hashr"] },
  { number: 60, transliteratedName: "Al-Mumtahanah", englishName: "She That Is To Be Examined", aliases: ["mumtahanah", "mumtahina"] },
  { number: 61, transliteratedName: "As-Saff", englishName: "The Ranks", aliases: ["saff"] },
  { number: 62, transliteratedName: "Al-Jumu'ah", englishName: "The Congregation", aliases: ["jumuah", "jumu a"] },
  { number: 63, transliteratedName: "Al-Munafiqun", englishName: "The Hypocrites", aliases: ["munafiqun", "munafiqoon"] },
  { number: 64, transliteratedName: "At-Taghabun", englishName: "The Mutual Disillusion", aliases: ["taghabun"] },
  { number: 65, transliteratedName: "At-Talaq", englishName: "The Divorce", aliases: ["talaq"] },
  { number: 66, transliteratedName: "At-Tahrim", englishName: "The Prohibition", aliases: ["tahrim"] },
  { number: 67, transliteratedName: "Al-Mulk", englishName: "The Sovereignty", aliases: ["mulk", "tabarak"] },
  { number: 68, transliteratedName: "Al-Qalam", englishName: "The Pen", aliases: ["qalam"] },
  { number: 69, transliteratedName: "Al-Haqqah", englishName: "The Reality", aliases: ["haqqah", "haaqqa"] },
  { number: 70, transliteratedName: "Al-Ma'arij", englishName: "The Ascending Stairways", aliases: ["maarij", "ma arij"] },
  { number: 71, transliteratedName: "Nuh", englishName: "Noah" },
  { number: 72, transliteratedName: "Al-Jinn", englishName: "The Jinn", aliases: ["jinn"] },
  { number: 73, transliteratedName: "Al-Muzzammil", englishName: "The Enshrouded One", aliases: ["muzzammil"] },
  { number: 74, transliteratedName: "Al-Muddaththir", englishName: "The Cloaked One", aliases: ["muddathir", "muddaththir"] },
  { number: 75, transliteratedName: "Al-Qiyamah", englishName: "The Resurrection", aliases: ["qiyamah", "qiyama"] },
  { number: 76, transliteratedName: "Al-Insan", englishName: "Man", aliases: ["insan", "dahr"] },
  { number: 77, transliteratedName: "Al-Mursalat", englishName: "Those Sent Forth", aliases: ["mursalat"] },
  { number: 78, transliteratedName: "An-Naba", englishName: "The Tidings", aliases: ["naba", "amma"] },
  { number: 79, transliteratedName: "An-Nazi'at", englishName: "Those Who Drag Forth", aliases: ["naziat", "nazi aat"] },
  { number: 80, transliteratedName: "'Abasa", englishName: "He Frowned", aliases: ["abasa"] },
  { number: 81, transliteratedName: "At-Takwir", englishName: "The Overthrowing", aliases: ["takwir"] },
  { number: 82, transliteratedName: "Al-Infitar", englishName: "The Cleaving", aliases: ["infitar"] },
  { number: 83, transliteratedName: "Al-Mutaffifin", englishName: "The Defrauding", aliases: ["mutaffifin"] },
  { number: 84, transliteratedName: "Al-Inshiqaq", englishName: "The Splitting Open", aliases: ["inshiqaq"] },
  { number: 85, transliteratedName: "Al-Buruj", englishName: "The Mansions of the Stars", aliases: ["buruj"] },
  { number: 86, transliteratedName: "At-Tariq", englishName: "The Nightcomer", aliases: ["tariq"] },
  { number: 87, transliteratedName: "Al-A'la", englishName: "The Most High", aliases: ["ala", "a la"] },
  { number: 88, transliteratedName: "Al-Ghashiyah", englishName: "The Overwhelming", aliases: ["ghashiyah", "ghaashiyah"] },
  { number: 89, transliteratedName: "Al-Fajr", englishName: "The Dawn", aliases: ["fajr"] },
  { number: 90, transliteratedName: "Al-Balad", englishName: "The City", aliases: ["balad"] },
  { number: 91, transliteratedName: "Ash-Shams", englishName: "The Sun", aliases: ["shams"] },
  { number: 92, transliteratedName: "Al-Layl", englishName: "The Night", aliases: ["layl"] },
  { number: 93, transliteratedName: "Ad-Duhaa", englishName: "The Morning Brightness", aliases: ["duha", "dhuha"] },
  { number: 94, transliteratedName: "Ash-Sharh", englishName: "The Relief", aliases: ["sharh", "inshirah"] },
  { number: 95, transliteratedName: "At-Tin", englishName: "The Fig", aliases: ["tin"] },
  { number: 96, transliteratedName: "Al-'Alaq", englishName: "The Clinging Clot", aliases: ["alaq", "iqra"] },
  { number: 97, transliteratedName: "Al-Qadr", englishName: "The Power", aliases: ["qadr"] },
  { number: 98, transliteratedName: "Al-Bayyinah", englishName: "The Clear Proof", aliases: ["bayyinah", "bayyina"] },
  { number: 99, transliteratedName: "Az-Zalzalah", englishName: "The Earthquake", aliases: ["zalzalah", "zilzal"] },
  { number: 100, transliteratedName: "Al-'Adiyat", englishName: "The Courser", aliases: ["adiyat", "aadiyaat"] },
  { number: 101, transliteratedName: "Al-Qari'ah", englishName: "The Calamity", aliases: ["qariah", "qari a"] },
  { number: 102, transliteratedName: "At-Takathur", englishName: "The Rivalry in World Increase", aliases: ["takathur"] },
  { number: 103, transliteratedName: "Al-'Asr", englishName: "The Declining Day", aliases: ["asr", "a sr"] },
  { number: 104, transliteratedName: "Al-Humazah", englishName: "The Traducer", aliases: ["humazah", "humaza"] },
  { number: 105, transliteratedName: "Al-Fil", englishName: "The Elephant", aliases: ["fil"] },
  { number: 106, transliteratedName: "Quraysh", englishName: "Quraysh", aliases: ["quraish"] },
  { number: 107, transliteratedName: "Al-Ma'un", englishName: "Small Kindnesses", aliases: ["maun", "ma oon"] },
  { number: 108, transliteratedName: "Al-Kawthar", englishName: "Abundance", aliases: ["kawthar", "kausar"] },
  { number: 109, transliteratedName: "Al-Kafirun", englishName: "The Disbelievers", aliases: ["kafirun", "kafiroon"] },
  { number: 110, transliteratedName: "An-Nasr", englishName: "The Divine Support", aliases: ["nasr"] },
  { number: 111, transliteratedName: "Al-Masad", englishName: "The Palm Fiber", aliases: ["masad", "lahab"] },
  { number: 112, transliteratedName: "Al-Ikhlas", englishName: "Sincerity", aliases: ["ikhlas"] },
  { number: 113, transliteratedName: "Al-Falaq", englishName: "The Daybreak", aliases: ["falaq"] },
  { number: 114, transliteratedName: "An-Nas", englishName: "Mankind", aliases: ["nas"] }
];

function normalizeAlias(value = "") {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
}

function buildAliases({ transliteratedName, englishName, aliases = [] }) {
  const seed = [
    transliteratedName,
    englishName,
    ...aliases
  ];
  const set = new Set();

  for (const value of seed) {
    const normalized = normalizeAlias(value);
    if (!normalized) continue;
    set.add(normalized);
    set.add(normalized.replace(/\s+/g, ""));
    if (normalized.startsWith("al ")) set.add(normalized.slice(3));
    if (normalized.startsWith("an ")) set.add(normalized.slice(3));
    if (normalized.startsWith("ar ")) set.add(normalized.slice(3));
    if (normalized.startsWith("ash ")) set.add(normalized.slice(4));
    if (normalized.startsWith("as ")) set.add(normalized.slice(3));
    if (normalized.startsWith("at ")) set.add(normalized.slice(3));
    if (normalized.startsWith("az ")) set.add(normalized.slice(3));
    if (normalized.startsWith("ad ")) set.add(normalized.slice(3));
  }

  return [...set].sort();
}

const startPages = new Map(mushafMetadata.surahs.map((surah) => [surah.number, surah]));
for (const [page, pageData] of Object.entries(mushafMetadata.pages)) {
  for (const number of pageData.surahsPresent || []) {
    if (!startPages.has(number)) {
      startPages.set(number, {
        number,
        arabicName: "",
        startPage: Number(page)
      });
    }
  }
}

const navigationMetadata = {
  pages: mushafMetadata.pages,
  juz: mushafMetadata.juz,
  surahs: SURAH_NAMES.map((surah) => {
    const pageData = startPages.get(surah.number);
    if (!pageData) throw new Error(`Missing mushaf metadata for surah ${surah.number}`);

    return {
      number: surah.number,
      arabicName: pageData.arabicName || surah.transliteratedName,
      transliteratedName: surah.transliteratedName,
      englishName: surah.englishName,
      startPage: pageData.startPage,
      aliases: buildAliases(surah)
    };
  })
};

await writeFile(outputPath, `${JSON.stringify(navigationMetadata, null, 2)}\n`, "utf8");
console.log(outputPath);
