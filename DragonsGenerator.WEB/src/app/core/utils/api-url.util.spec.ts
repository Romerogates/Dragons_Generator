import { resolveApiAssetUrl } from './api-url.util';

describe('api-url.util', () => {
  it('returns absolute URLs unchanged', () => {
    expect(resolveApiAssetUrl('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png');
  });

  it('prefixes API paths with environment base', () => {
    expect(resolveApiAssetUrl('/support/tickets/x/attachment')).toMatch(/\/support\/tickets\/x\/attachment$/);
    expect(resolveApiAssetUrl('/species')).toMatch(/\/species$/);
    expect(resolveApiAssetUrl('classes')).toMatch(/\/classes$/);
  });

  it('returns # for empty path', () => {
    expect(resolveApiAssetUrl(null)).toBe('#');
    expect(resolveApiAssetUrl('')).toBe('#');
  });
});
