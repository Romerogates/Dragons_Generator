import { DOCUMENT, ViewportScroller } from '@angular/common';
import { Injectable, Injector, inject } from '@angular/core';
import { Router } from '@angular/router';

/** `router.navigate(..., { state: KEEP_SCROLL_STATE })` : pas de remontée en haut après la navigation. */
export const KEEP_SCROLL_STATE = { keepScroll: true } as const;

/**
 * `ViewportScroller` navigateur, sauf qu'il ignore le « retour en haut » du routeur
 * pour les navigations marquées `KEEP_SCROLL_STATE` (ex. onglets synchronisés dans l'URL).
 */
@Injectable()
export class KeepScrollViewportScroller extends ViewportScroller {
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private offset: () => [number, number] = () => [0, 0];

  setOffset(offset: [number, number] | (() => [number, number])): void {
    this.offset = Array.isArray(offset) ? () => offset : offset;
  }

  getScrollPosition(): [number, number] {
    return [window.scrollX, window.scrollY];
  }

  scrollToPosition(position: [number, number], options?: ScrollOptions): void {
    if (!options && position[0] === 0 && position[1] === 0 && this.lastNavigationKeepsScroll()) {
      return;
    }
    window.scrollTo({ ...options, left: position[0], top: position[1] });
  }

  scrollToAnchor(anchor: string, options?: ScrollOptions): void {
    const el =
      this.document.getElementById(anchor) ?? this.document.getElementsByName(anchor)[0] ?? null;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const [ox, oy] = this.offset();
    window.scrollTo({
      ...options,
      left: rect.left + window.scrollX - ox,
      top: rect.top + window.scrollY - oy,
    });
    el.focus?.();
  }

  setHistoryScrollRestoration(scrollRestoration: 'auto' | 'manual'): void {
    try {
      window.history.scrollRestoration = scrollRestoration;
    } catch {
      /* iframe sandbox */
    }
  }

  private lastNavigationKeepsScroll(): boolean {
    const nav = this.injector.get(Router).lastSuccessfulNavigation;
    return nav?.extras.state?.['keepScroll'] === true;
  }
}
