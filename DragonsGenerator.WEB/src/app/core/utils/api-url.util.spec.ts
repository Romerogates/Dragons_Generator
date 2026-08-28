import { resolveApiAssetUrl } from './api-url.util';

describe('api-url.util', () => {
  it('returns absolute URLs unchanged', () => {
    expect(resolveApiAssetUrl('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png');
  });

  it('keeps uploads on same origin', () => {
    expect(resolveApiAssetUrl('/uploads/tickets/x.pdf')).toBe('/uploads/tickets/x.pdf');
  });

  it('prefixes API paths with environment base', () => {
    expect(resolveApiAssetUrl('/species')).toMatch(/\/species$/);
    expect(resolveApiAssetUrl('classes')).toMatch(/\/classes$/);
  });

  it('returns # for empty path', () => {
    expect(resolveApiAssetUrl(null)).toBe('#');
    expect(resolveApiAssetUrl('')).toBe('#');
  });
});
