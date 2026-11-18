/** Carrousel forge (classe / espèce) : géométrie scroll + verso. */

export function toggleFlipId(current: Set<string>, cardId: string): Set<string> {
  const next = new Set(current);
  if (next.has(cardId)) next.delete(cardId);
  else next.add(cardId);
  return next;
}

export function carouselIndexFromScroll(viewport: HTMLElement): number {
  const viewportCenter = viewport.getBoundingClientRect().left + viewport.clientWidth / 2;
  let best = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  viewport.querySelectorAll<HTMLElement>('[data-carousel-index]').forEach((el) => {
    const rect = el.getBoundingClientRect();
    const mid = rect.left + rect.width / 2;
    const dist = Math.abs(mid - viewportCenter);
    if (dist < bestDist) {
      bestDist = dist;
      best = Number(el.dataset['carouselIndex'] ?? 0);
    }
  });
  return best;
}

export function carouselScrollDeltaToIndex(viewport: HTMLElement, index: number): number | null {
  const card = viewport.querySelector<HTMLElement>(`[data-carousel-index="${index}"]`);
  if (!card) return null;
  const viewportRect = viewport.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  return cardRect.left + cardRect.width / 2 - (viewportRect.left + viewport.clientWidth / 2);
}
