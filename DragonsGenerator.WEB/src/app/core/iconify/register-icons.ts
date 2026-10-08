/**
 * Enregistre les smileys / icônes Iconify offline au boot.
 * Charge le bundle une seule fois (fichier cacheable) — plus de flash CDN page par page.
 */
import { addCollection } from 'iconify-icon';

let registered = false;

interface IconifyCollection {
  prefix: string;
  icons: Record<string, unknown>;
  width?: number;
  height?: number;
}

/** À await une seule fois avant le bootstrap Angular. */
export async function registerAppIcons(): Promise<void> {
  if (registered) return;
  registered = true;

  const ctrl = new AbortController();
  const abortTimer = setTimeout(() => ctrl.abort(), 8_000);
  try {
    const res = await fetch('/assets/iconify/dg-icons.json', {
      credentials: 'same-origin',
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const collections = (await res.json()) as IconifyCollection[];
    for (const col of collections) {
      if (col?.prefix && col.icons) {
        addCollection(col as never);
      }
    }
  } catch (e) {
    console.warn('[iconify] bundle offline indisponible — fallback API', e);
  } finally {
    clearTimeout(abortTimer);
  }

  disableIconifyViewportObserver();
}

/**
 * Iconify décharge les SVG hors viewport (IntersectionObserver) → flash au scroll.
 * noobserver + observer DOM pour toutes les icônes, y compris celles ajoutées plus tard.
 */
function disableIconifyViewportObserver(): void {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;

  const mark = (el: Element): void => {
    if (el.tagName === 'ICONIFY-ICON' && !el.hasAttribute('noobserver')) {
      el.setAttribute('noobserver', '');
    }
  };

  const scan = (root: ParentNode): void => {
    if (root instanceof Element) mark(root);
    root.querySelectorAll?.('iconify-icon').forEach(mark);
  };

  scan(document);
  new MutationObserver((records) => {
    for (const rec of records) {
      rec.addedNodes.forEach((node) => {
        if (node instanceof Element || node instanceof DocumentFragment) scan(node);
      });
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
}
