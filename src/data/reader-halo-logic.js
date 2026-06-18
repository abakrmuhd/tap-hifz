import { getStrengthClass } from "./metadata-logic.js";

export function buildAyahRingState({
  ayahCount,
  transitionCount,
  ayahThresholds,
  transitionThresholds
}) {
  return {
    ayahStrength: getStrengthClass(ayahCount, ayahThresholds),
    transitionStrength:
      transitionCount == null ? null : getStrengthClass(transitionCount, transitionThresholds),
    hasTransitionRing: transitionCount != null
  };
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
