/**
 * Enregistre les smileys / icônes Iconify offline au boot.
 * Charge le bundle une seule fois (fichier cacheable) — plus de flash CDN page par page.
 */
import { addCollection } from 'iconify-icon';
import { isPaintedAssetPath, resolvePaintedIcon } from '@core/utils/painted-icon.util';

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
  installPaintedIconify();
}

/**
 * Iconify décharge les SVG hors viewport (IntersectionObserver) → flash au scroll.
 * noobserver + observer DOM pour toutes les icônes, y compris celles ajoutées plus tard.
 */
function disableIconifyViewportObserver(): void {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;

  const mark = (el: Element): void => {
    if (el.tagName !== 'ICONIFY-ICON') return;
    if (!el.hasAttribute('noobserver')) el.setAttribute('noobserver', '');
    paintIconifyHost(el as HTMLElement);
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

const paintedHosts = new WeakSet<HTMLElement>();

function paintIconifyHost(el: HTMLElement): void {
  const raw = el.getAttribute('icon') || '';
  const src = resolvePaintedIcon(raw);
  if (!isPaintedAssetPath(src)) return;
  const size = el.getAttribute('width') || el.getAttribute('height') || '1.15em';

  const apply = (): void => {
    const root = el.shadowRoot;
    if (!root) {
      requestAnimationFrame(apply);
      return;
    }
    if (!root.querySelector('style[data-dg-paint]')) {
      const style = document.createElement('style');
      style.setAttribute('data-dg-paint', '');
      style.textContent =
        ':host{display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;line-height:0}' +
        'svg,.iconify{display:none!important}' +
        `img{width:${size};height:${size};object-fit:contain;display:block}`;
      root.prepend(style);
    }
    let img = root.querySelector('img[data-dg-paint]');
    if (!img) {
      img = document.createElement('img');
      img.setAttribute('data-dg-paint', '');
      img.setAttribute('alt', '');
      root.appendChild(img);
    }
    if (img.getAttribute('src') !== src) img.setAttribute('src', src);
    root.querySelectorAll('svg').forEach((s) => s.remove());
    if (!paintedHosts.has(el)) {
      paintedHosts.add(el);
      new MutationObserver(() => apply()).observe(root, { childList: true, subtree: true });
    }
  };
  apply();
}

/** Remplace les smileys fluent-emoji par les portraits peints, partout. */
function installPaintedIconify(): void {
  if (typeof customElements === 'undefined') return;

  const hook = (el: Element): void => {
    if (el.tagName === 'ICONIFY-ICON') paintIconifyHost(el as HTMLElement);
  };

  void customElements.whenDefined('iconify-icon').then(() => {
    const Ctor = customElements.get('iconify-icon');
    if (!Ctor) return;
    const proto = Ctor.prototype as {
      connectedCallback?: () => void;
      attributeChangedCallback?: (name: string, old: string | null, val: string | null) => void;
    };

    const origConn = proto.connectedCallback;
    proto.connectedCallback = function connectedCallback(this: HTMLElement) {
      origConn?.call(this);
      queueMicrotask(() => paintIconifyHost(this));
    };

    const origAttr = proto.attributeChangedCallback;
    proto.attributeChangedCallback = function attributeChangedCallback(
      this: HTMLElement,
      name: string,
      old: string | null,
      val: string | null,
    ) {
      origAttr?.call(this, name, old, val);
      if (name === 'icon') queueMicrotask(() => paintIconifyHost(this));
    };

    const desc = Object.getOwnPropertyDescriptor(proto, 'icon');
    if (desc?.set) {
      const origSet = desc.set;
      Object.defineProperty(proto, 'icon', {
        configurable: true,
        enumerable: desc.enumerable,
        get: desc.get,
        set(this: HTMLElement, v: string) {
          origSet.call(this, v);
          queueMicrotask(() => paintIconifyHost(this));
        },
      });
    }

    document.querySelectorAll('iconify-icon').forEach(hook);
  });
}
