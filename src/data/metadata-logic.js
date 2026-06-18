const ARABIC_NUMBER_AT_END = /^(.*?)(?:\s+)?([٠-٩]+)$/;

export function buildMetadataFromPages(pageMap, juzRanges) {
  const pages = {};
  const ayahToPage = {};
  const surahStarts = new Map();
  const surahNames = new Map();

  for (const [pageNumber, pageData] of Object.entries(pageMap)) {
    const page = Number(pageNumber);
    const ayahKeys = [];
    const surahsPresent = new Set();

    for (const line of pageData.lines || []) {
      if (line.surah) {
        const surahNumber = Number(line.surah);
        surahsPresent.add(surahNumber);
        if (!surahStarts.has(surahNumber)) surahStarts.set(surahNumber, page);
        if (line.text && !surahNames.has(surahNumber)) surahNames.set(surahNumber, line.text);
      }
      if (line.verseRange) {
        const [start, end] = line.verseRange.split("-");
        surahsPresent.add(Number(start.split(":")[0]));
        surahsPresent.add(Number(end.split(":")[0]));
      }

      for (const word of line.words || []) {
        if (!ARABIC_NUMBER_AT_END.test(word.word || "")) continue;
        const [surah, ayah] = word.location.split(":").map(Number);
        const key = `${surah}:${ayah}`;
        ayahKeys.push(key);
        ayahToPage[key] = page;
      }
    }

    const uniqueAyahKeys = [...new Set(ayahKeys)];
    const transitionKeys = uniqueAyahKeys.slice(1).map((key, index) => `${page}|${uniqueAyahKeys[index]}|${key}`);
    const labelLine = (pageData.lines || []).find((line) => line.verseRange);

    pages[String(page)] = {
      label: labelLine ? labelLine.verseRange.split("-")[0] : `Page ${page}`,
      surahsPresent: [...surahsPresent].sort((a, b) => a - b),
      juz: juzRanges.find((item) => page >= item.startPage && page <= item.endPage)?.number ?? 1,
      ayahKeys: uniqueAyahKeys,
      transitionKeys
    };
  }

  return {
    pages,
    ayahToPage,
    surahs: [...surahStarts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([number, startPage]) => ({
        number,
        arabicName: surahNames.get(number) || `Surah ${number}`,
        startPage
      })),
    juz: juzRanges
  };
}

export function getStrengthClass(count, thresholds) {
  if (count <= 0) return "empty";
  if (count <= thresholds.weakMax) return "weak";
  if (count <= thresholds.buildingMax) return "building";
  if (count <= thresholds.strongMax) return "strong";
  return "mastered";
}

export function getPageStrength(page, metadata, ayahProgress, thresholds) {
  const ayahKeys = metadata.pages[String(page)]?.ayahKeys || [];
  if (!ayahKeys.length) return "empty";
  const rank = { empty: 0, weak: 1, building: 2, strong: 3, mastered: 4 };
  return ayahKeys
    .map((key) => getStrengthClass(ayahProgress[key]?.repetitionCount || 0, thresholds))
    .sort((a, b) => rank[a] - rank[b])[0];
}

export function buildWeakItems({
  metadata,
  ayahProgress,
  transitionProgress,
  ayahThresholds,
  transitionThresholds,
  labelAyah,
  labelTransition
}) {
  const ayahs = Object.entries(ayahProgress)
    .filter(([, value]) => value.repetitionCount > 0 && value.repetitionCount <= ayahThresholds.weakMax)
    .map(([key, value]) => ({
      kind: "Ayah",
      key,
      count: value.repetitionCount,
      page: metadata.ayahToPage[key],
      label: labelAyah(key),
      level: 1
    }));

  const transitions = Object.entries(transitionProgress)
    .filter(([, value]) => value.repetitionCount > 0 && value.repetitionCount <= transitionThresholds.weakMax)
    .map(([key, value]) => ({
      kind: "Transition",
      key,
      count: value.repetitionCount,
      page: Number(key.split("|")[0]),
      label: labelTransition(key),
      level: 1
    }));

  return [...ayahs, ...transitions].sort((a, b) => a.level - b.level || a.count - b.count || a.page - b.page);
}

export function resolveActiveTarget({ review, routeTarget }) {
  if (review && !review.done) return review.queue[review.index] || null;
  return routeTarget || null;
}
