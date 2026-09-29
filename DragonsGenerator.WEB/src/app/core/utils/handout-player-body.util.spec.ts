import { handoutPlayerBody, type CampaignHandout } from '@core/models/Campaign/campaign';

describe('handoutPlayerBody', () => {
  it('returns body when no published pages', () => {
    const h: CampaignHandout = {
      id: '1',
      title: 'Doc',
      body: 'Corps principal',
      kind: 'letter',
      published: true,
      createdAt: '',
      pages: [{ id: 'p1', title: 'Secret', body: 'spoiler', published: false }],
    };
    expect(handoutPlayerBody(h)).toBe('Corps principal');
  });

  it('concatenates published pages', () => {
    const h: CampaignHandout = {
      id: '1',
      title: 'Doc',
      body: 'ignoré',
      kind: 'letter',
      published: true,
      createdAt: '',
      pages: [
        { id: 'p1', title: 'Acte 1', body: 'Début', published: true },
        { id: 'p2', title: '', body: 'Suite', published: true },
        { id: 'p3', title: 'Caché', body: 'non', published: false },
      ],
    };
    const text = handoutPlayerBody(h);
    expect(text).toContain('## Acte 1');
    expect(text).toContain('Début');
    expect(text).toContain('Suite');
    expect(text).not.toContain('Caché');
  });
});
