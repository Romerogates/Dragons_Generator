import {
  downloadBlobUrl,
  namedPdfObjectUrl,
  prefersNativePdfFallback,
} from './pdf-preview.util';

describe('pdf-preview.util', () => {
  describe('prefersNativePdfFallback', () => {
    const originalNavigator = window.navigator;
    const originalMatchMedia = window.matchMedia;

    afterEach(() => {
      Object.defineProperty(window, 'navigator', {
        configurable: true,
        value: originalNavigator,
      });
      window.matchMedia = originalMatchMedia;
    });

    function mockNavigator(
      partial: Partial<Navigator> & {
        userAgent?: string;
        platform?: string;
        maxTouchPoints?: number;
      },
    ): void {
      Object.defineProperty(window, 'navigator', {
        configurable: true,
        value: {
          ...originalNavigator,
          userAgent: '',
          platform: 'Win32',
          maxTouchPoints: 0,
          ...partial,
        },
      });
    }

    function mockCoarse(matches: boolean): void {
      window.matchMedia = ((query: string) =>
        ({
          matches: query.includes('pointer: coarse') ? matches : false,
          media: query,
          onchange: null,
          addListener: () => undefined,
          removeListener: () => undefined,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          dispatchEvent: () => false,
        })) as typeof window.matchMedia;
    }

    it('returns false on desktop fine pointer', () => {
      mockNavigator({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' });
      mockCoarse(false);
      expect(prefersNativePdfFallback()).toBeFalse();
    });

    it('returns true for iPhone / Android / coarse pointer / iPadOS touch', () => {
      mockNavigator({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' });
      mockCoarse(false);
      expect(prefersNativePdfFallback()).toBeTrue();

      mockNavigator({ userAgent: 'Mozilla/5.0 (Linux; Android 14)' });
      expect(prefersNativePdfFallback()).toBeTrue();

      mockNavigator({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' });
      mockCoarse(true);
      expect(prefersNativePdfFallback()).toBeTrue();

      mockNavigator({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        platform: 'MacIntel',
        maxTouchPoints: 5,
      });
      mockCoarse(false);
      expect(prefersNativePdfFallback()).toBeTrue();
    });
  });

  describe('downloadBlobUrl', () => {
    it('creates a temporary anchor and clicks it', () => {
      const click = jasmine.createSpy('click');
      const remove = jasmine.createSpy('remove');
      const appendChild = spyOn(document.body, 'appendChild').and.callFake(
        <T extends Node>(node: T) => node,
      );
      spyOn(document, 'createElement').and.callFake((tag: string) => {
        if (tag !== 'a') return document.createElement(tag);
        return {
          href: '',
          download: '',
          rel: '',
          style: { display: '' },
          click,
          remove,
        } as unknown as HTMLAnchorElement;
      });

      downloadBlobUrl('blob:test', 'fiche.pdf');

      expect(appendChild).toHaveBeenCalled();
      expect(click).toHaveBeenCalled();
      expect(remove).toHaveBeenCalled();
    });
  });

  describe('namedPdfObjectUrl', () => {
    it('wraps the fetched blob in a named File object URL', async () => {
      const blob = new Blob(['%PDF'], { type: 'application/pdf' });
      spyOn(window, 'fetch').and.resolveTo({
        blob: async () => blob,
      } as Response);
      const createObjectURL = spyOn(URL, 'createObjectURL').and.returnValue('blob:named');

      const url = await namedPdfObjectUrl('blob:source', 'hero.pdf');

      expect(url).toBe('blob:named');
      expect(createObjectURL).toHaveBeenCalled();
      const file = createObjectURL.calls.mostRecent().args[0] as File;
      expect(file).toBeInstanceOf(File);
      expect(file.name).toBe('hero.pdf');
      expect(file.type).toBe('application/pdf');
    });
  });
});
