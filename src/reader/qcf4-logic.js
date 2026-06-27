export function qcf4PagePath(page) {
  return `/public/mushaf-qcf4/page-${String(page).padStart(3, "0")}.json`;
}

export function collectQcf4AyahKeys(pageData) {
  const keys = [];
  for (const line of pageData?.lines || []) {
    for (const group of line.ayahGroups || []) {
      if (group?.key && keys[keys.length - 1] !== group.key) keys.push(group.key);
    }
  }
  return keys;
}

export function buildQcf4PreviousAyahMap(pageData) {
  const keys = collectQcf4AyahKeys(pageData);
  const previousAyahMap = new Map();
  keys.forEach((key, index) => {
    previousAyahMap.set(key, index > 0 ? keys[index - 1] : null);
  });
  return previousAyahMap;
}
