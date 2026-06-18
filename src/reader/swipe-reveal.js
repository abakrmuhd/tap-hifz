export function getRevealDirection({ dx, dy, startThreshold }) {
  if (Math.abs(dx) <= startThreshold) return null;
  if (Math.abs(dx) <= Math.abs(dy)) return null;
  return dx > 0 ? "next" : "previous";
}

export function shouldCommitSwipe({ dx, dy, commitDistance, verticalLimit }) {
  return Math.abs(dx) > commitDistance && Math.abs(dy) < verticalLimit;
}

export function clampRevealOffset(dx, { maxOffset, dragRatio }) {
  const scaled = dx * dragRatio;
  return Math.max(-maxOffset, Math.min(maxOffset, scaled));
}

export function getRevealPage({ currentPage, direction, pageCount }) {
  if (direction === "next") return currentPage < pageCount ? currentPage + 1 : null;
  if (direction === "previous") return currentPage > 1 ? currentPage - 1 : null;
  return null;
}

export function getTask2RevealDirection({ currentPage, pageCount, navigationDelta = 0 }) {
  if (navigationDelta > 0) return "next";
  if (navigationDelta < 0) return "previous";
  return currentPage < pageCount ? "next" : "previous";
}

export function buildRevealSurfaceState({ currentPage, direction, pageCount }) {
  return {
    activePage: currentPage,
    revealedPage: getRevealPage({ currentPage, direction, pageCount })
  };
}
