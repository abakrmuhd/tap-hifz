import { getCountLevelClass } from "./metadata-logic.js";

const EMPTY_COUNT_COLOR = "#e6e6de";
const MASTERED_COUNT_COLOR = "#abda1a";
const LIGHT_COUNT_INK = "#f7f7ef";
const DARK_COUNT_INK = "#263500";

export function buildRepetitionRingState({
  repetitionCount,
  transitionCount,
  repetitionThresholds,
  transitionCountThresholds
}) {
  const hasTransitionRing = transitionCount != null;
  const repetitionCountLevel = getCountLevelClass(repetitionCount, repetitionThresholds);
  const transitionCountLevel =
    transitionCount == null ? null : getCountLevelClass(transitionCount, transitionCountThresholds);
  const repetitionMastered = repetitionCountLevel === "mastered";
  const transitionMastered = !hasTransitionRing || transitionCountLevel === "mastered";
  return {
    repetitionCountLevel,
    repetitionCountColor: buildCountProgressColor(repetitionCount, repetitionThresholds),
    repetitionCountInkColor: buildCountProgressInkColor(repetitionCount, repetitionThresholds),
    transitionCountLevel,
    transitionCountColor:
      transitionCount == null ? null : buildCountProgressColor(transitionCount, transitionCountThresholds),
    transitionCountInkColor:
      transitionCount == null ? null : buildCountProgressInkColor(transitionCount, transitionCountThresholds),
    transitionProgressPercent: hasTransitionRing
      ? buildCountProgressPercent(transitionCount, transitionCountThresholds)
      : 0,
    hasTransitionRing,
    isFullyMastered: repetitionMastered && transitionMastered
  };
}

export function buildCountProgressColor(count, thresholds) {
  const progress = buildCountProgressRatio(count, thresholds);
  return mixHexColors(EMPTY_COUNT_COLOR, MASTERED_COUNT_COLOR, progress);
}

function buildCountProgressPercent(count, thresholds) {
  return Math.round(buildCountProgressRatio(count, thresholds) * 100);
}

function buildCountProgressRatio(count, thresholds) {
  const masteredAt = thresholds.strongMax + 1;
  return masteredAt > 0 ? Math.min(1, Math.max(0, count / masteredAt)) : 1;
}

export function buildCountProgressInkColor(count, thresholds) {
  const color = buildCountProgressColor(count, thresholds);
  const [red, green, blue] = parseHexColor(color).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return luminance > 0.34 ? DARK_COUNT_INK : LIGHT_COUNT_INK;
}

function mixHexColors(from, to, progress) {
  const fromRgb = parseHexColor(from);
  const toRgb = parseHexColor(to);
  const mixed = fromRgb.map((channel, index) => (
    Math.round(channel + (toRgb[index] - channel) * progress)
  ));
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function parseHexColor(color) {
  return [1, 3, 5].map((index) => Number.parseInt(color.slice(index, index + 2), 16));
}

export function buildRepetitionAriaLabel({
  ayahLabel,
  repetitionCountLevel,
  transitionCountLevel
}) {
  return transitionCountLevel
    ? `${ayahLabel}, repetition count ${repetitionCountLevel}, transition count ${transitionCountLevel}`
    : `${ayahLabel}, repetition count ${repetitionCountLevel}`;
}
