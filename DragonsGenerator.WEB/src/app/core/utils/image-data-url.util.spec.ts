import { fileToSquareJpegDataUrl, sanitizeTokenImageUrl } from './image-data-url.util';

/** PNG 1×1 blanc. */
const TINY_PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  ),
  (c) => c.charCodeAt(0),
);

const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('image-data-url.util', () => {
  it('rejects non-image files', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'notes.txt', { type: 'text/plain' });
    await expectAsync(fileToSquareJpegDataUrl(file)).toBeRejectedWithError(/image/i);
  });

  it('converts a tiny PNG to a JPEG data URL', async () => {
    const file = new File([TINY_PNG], 'dot.png', { type: 'image/png' });
    const dataUrl = await fileToSquareJpegDataUrl(file, 32, 0.9);
    expect(dataUrl.startsWith('data:image/jpeg')).toBe(true);
    expect(dataUrl.length).toBeGreaterThan(32);
  });

  it('rejects when canvas context is unavailable', async () => {
    const file = new File([TINY_PNG], 'dot.png', { type: 'image/png' });
    const orig = HTMLCanvasElement.prototype.getContext;
    spyOn(HTMLCanvasElement.prototype, 'getContext').and.returnValue(null);
    try {
      await expectAsync(fileToSquareJpegDataUrl(file, 16)).toBeRejectedWithError(/Canvas/i);
    } finally {
      HTMLCanvasElement.prototype.getContext = orig;
    }
  });

  it('rejects when the image fails to load', async () => {
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'bad.jpg', { type: 'image/jpeg' });
    await expectAsync(fileToSquareJpegDataUrl(file)).toBeRejectedWithError(/Impossible/i);
  });

  describe('sanitizeTokenImageUrl', () => {
    it('keeps http(s) URLs', async () => {
      expect(await sanitizeTokenImageUrl('https://cdn.example/t.png')).toBe(
        'https://cdn.example/t.png',
      );
      expect(await sanitizeTokenImageUrl('http://localhost/t.jpg')).toBe(
        'http://localhost/t.jpg',
      );
    });

    it('rejects non-image / empty / javascript schemes', async () => {
      expect(await sanitizeTokenImageUrl('')).toBeNull();
      expect(await sanitizeTokenImageUrl(null)).toBeNull();
      expect(await sanitizeTokenImageUrl(undefined)).toBeNull();
      expect(await sanitizeTokenImageUrl('   ')).toBeNull();
      expect(await sanitizeTokenImageUrl('javascript:alert(1)')).toBeNull();
      expect(await sanitizeTokenImageUrl('data:text/plain,hi')).toBeNull();
    });

    it('rejects oversized data URLs without loading', async () => {
      const huge = 'data:image/png;base64,' + 'A'.repeat(200_001);
      expect(await sanitizeTokenImageUrl(huge)).toBeNull();
    });

    it('recompresses a tiny data:image to JPEG', async () => {
      const out = await sanitizeTokenImageUrl(TINY_PNG_DATA_URL, 32);
      expect(out).toBeTruthy();
      expect(out!.startsWith('data:image/jpeg')).toBe(true);
    });

    it('returns null when image load fails', async () => {
      expect(await sanitizeTokenImageUrl('data:image/png;base64,@@@')).toBeNull();
    });

    it('returns null when canvas context is unavailable during sanitize', async () => {
      const orig = HTMLCanvasElement.prototype.getContext;
      spyOn(HTMLCanvasElement.prototype, 'getContext').and.returnValue(null);
      try {
        expect(await sanitizeTokenImageUrl(TINY_PNG_DATA_URL, 16)).toBeNull();
      } finally {
        HTMLCanvasElement.prototype.getContext = orig;
      }
    });
  });
});
