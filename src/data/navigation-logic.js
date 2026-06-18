export function normalizeSearchText(value = "") {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .toLowerCase();
}

function buildSurahTerms(surah) {
  const values = [
    surah.arabicName,
    surah.transliteratedName,
    surah.englishName,
    ...(surah.aliases || [])
  ];

  const terms = new Set();
  values.forEach((value) => {
    const normalized = normalizeSearchText(value);
    if (!normalized) return;
    terms.add(normalized);
    terms.add(normalized.replace(/\s+/g, ""));
    if (normalized.startsWith("al ")) terms.add(normalized.slice(3));
  });
  return [...terms];
}

function scoreSurahQuery(query, surah) {
  const terms = buildSurahTerms(surah);
  let best = Number.POSITIVE_INFINITY;

  for (const term of terms) {
    if (!term) continue;
    if (query === term) best = Math.min(best, 0);
    else if (query === term.replace(/\s+/g, "")) best = Math.min(best, 0);
    else if (query.startsWith(term) || term.startsWith(query)) best = Math.min(best, 1);
    else if (query.includes(term) || term.includes(query)) best = Math.min(best, 2);
  }

  return Number.isFinite(best) ? best : null;
}

export function resolveNavigationTarget(value, metadata, pageCount) {
  const text = normalizeSearchText(value);
  if (!text) return null;

  const juzMatch = text.match(/\bjuz\s+(\d{1,2})\b/);
  if (juzMatch) {
    const number = Number(juzMatch[1]);
    const juz = metadata.juz.find((item) => item.number === number);
    return juz ? { page: juz.startPage, kind: "juz" } : null;
  }

  const surahMatch = text.match(/\bsurah\s+(\d{1,3})\b/);
  if (surahMatch) {
    const number = Number(surahMatch[1]);
    const surah = metadata.surahs.find((item) => item.number === number);
    return surah ? { page: surah.startPage, kind: "surah" } : null;
  }

  const pageMatch = text.match(/\bpage\s+(\d{1,3})\b/);
  if (pageMatch) {
    const page = Number(pageMatch[1]);
    return page >= 1 && page <= pageCount ? { page, kind: "page" } : null;
  }

  if (/^\d{1,3}$/.test(text)) {
    const page = Number(text);
    return page >= 1 && page <= pageCount ? { page, kind: "page" } : null;
  }

  const ranked = metadata.surahs
    .map((surah) => ({ surah, score: scoreSurahQuery(text, surah) }))
    .filter((item) => item.score !== null)
    .sort((a, b) => a.score - b.score || a.surah.startPage - b.surah.startPage);

  if (!ranked.length) return null;
  return { page: ranked[0].surah.startPage, kind: "surah" };
}
