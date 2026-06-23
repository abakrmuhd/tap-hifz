import { getStrengthClass } from "./metadata-logic.js";

export function buildAyahRingState({
  ayahCount,
  transitionCount,
  ayahThresholds,
  transitionThresholds
}) {
  const hasTransitionRing = transitionCount != null;
  return {
    ayahStrength: getStrengthClass(ayahCount, ayahThresholds),
    transitionStrength:
      transitionCount == null ? null : getStrengthClass(transitionCount, transitionThresholds),
    hasTransitionRing,
    transitionArcDegrees: hasTransitionRing
      ? buildTransitionArcDegrees(transitionCount, transitionThresholds)
      : 0
  };
}

function buildTransitionArcDegrees(count, thresholds) {
  const target = buildTargetCount(count, thresholds);
  return Math.min(360, Math.round((count / target) * 360));
}

function buildTargetCount(count, thresholds) {
  if (count <= thresholds.weakMax) return thresholds.weakMax + 1;
  if (count <= thresholds.buildingMax) return thresholds.buildingMax + 1;
  if (count <= thresholds.strongMax) return thresholds.strongMax + 1;
  return thresholds.strongMax + 1;
}

export function buildAyahAriaLabel({
  ayahLabel,
  ayahStrength,
  transitionStrength
}) {
  return transitionStrength
    ? `${ayahLabel}, ayah ${ayahStrength}, transition ${transitionStrength}`
    : `${ayahLabel}, ayah ${ayahStrength}`;
}
