import { getStrengthClass } from "./metadata-logic.js";

export function describeDetailTarget(detailTarget, options) {
  const isAyah = detailTarget.kind === "ayah";
  const count = isAyah
    ? options.getAyahCount(detailTarget.key)
    : options.getTransitionCount(detailTarget.key);
  const thresholds = isAyah
    ? options.settings.ayahThresholds
    : options.settings.transitionThresholds;

  return {
    title: isAyah ? options.labelAyah(detailTarget.key) : options.labelTransition(detailTarget.key),
    kindLabel: isAyah ? "Ayah" : "Transition",
    count,
    strength: getStrengthClass(count, thresholds),
    canBookmark: isAyah,
    bookmarked: isAyah ? options.isAyahBookmarked(detailTarget.key) : false
  };
}
