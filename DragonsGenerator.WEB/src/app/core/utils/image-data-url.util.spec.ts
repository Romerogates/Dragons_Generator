import { fileToSquareJpegDataUrl } from './image-data-url.util';

/** PNG 1×1 blanc. */
const TINY_PNG = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  ),
  (c) => c.charCodeAt(0),
);

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
});
