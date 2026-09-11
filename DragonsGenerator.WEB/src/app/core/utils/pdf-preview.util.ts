/** Heuristique : aperçu PDF en iframe souvent cassé (iOS/iPadOS/Android WebView). */
export function prefersNativePdfFallback(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const coarse =
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(pointer: coarse)').matches;
  return iOS || android || coarse;
}

export function downloadBlobUrl(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Donne un vrai nom de fichier au blob (sinon la tablette affiche un UUID). */
export async function namedPdfObjectUrl(
  sourceUrl: string,
  filename: string,
): Promise<string> {
  const res = await fetch(sourceUrl);
  const blob = await res.blob();
  const file = new File([blob], filename, { type: 'application/pdf' });
  return URL.createObjectURL(file);
}
