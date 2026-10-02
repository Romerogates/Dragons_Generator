/** Redimensionne une image fichier en JPEG data-URL carré (jetons / embeds). */
export async function fileToSquareJpegDataUrl(
  file: File,
  size = 192,
  quality = 0.82,
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Fichier image requis.');
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    return canvasToSquareJpeg(img, size, quality);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

const TOKEN_MAX_BYTES = 48 * 1024;
const TOKEN_MAX_DATA_URL_CHARS = 200_000;

/**
 * Valide / normalise une URL de jeton :
 * - http(s) : conservée telle quelle
 * - data:image : recompressée en JPEG carré (≤ ~48 ko, côté 192)
 * - autre / trop volumineux : rejeté (null)
 */
export async function sanitizeTokenImageUrl(
  url: string | null | undefined,
  size = 192,
): Promise<string | null> {
  const trimmed = (url ?? '').trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (!trimmed.startsWith('data:image/')) return null;
  if (trimmed.length > TOKEN_MAX_DATA_URL_CHARS) return null;

  try {
    const img = await loadImage(trimmed);
    let quality = 0.82;
    let dataUrl = canvasToSquareJpeg(img, size, quality);
    while (approxDataUrlBytes(dataUrl) > TOKEN_MAX_BYTES && quality > 0.4) {
      quality -= 0.1;
      dataUrl = canvasToSquareJpeg(img, size, quality);
    }
    if (approxDataUrlBytes(dataUrl) > TOKEN_MAX_BYTES) return null;
    return dataUrl;
  } catch {
    return null;
  }
}

function approxDataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  return Math.floor((b64.length * 3) / 4);
}

function canvasToSquareJpeg(
  img: HTMLImageElement,
  size: number,
  quality: number,
): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponible.');
  const sw = img.naturalWidth || img.width;
  const sh = img.naturalHeight || img.height;
  const side = Math.min(sw, sh);
  const sx = (sw - side) / 2;
  const sy = (sh - side) / 2;
  ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
  return canvas.toDataURL('image/jpeg', quality);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Impossible de lire l’image.'));
    img.src = src;
  });
}
