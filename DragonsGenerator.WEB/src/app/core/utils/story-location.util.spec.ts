import {
  campaignRegionFields,
  campaignRegionFromData,
  storyLocationContext,
  storyRegionLabel,
} from './story-location.util';
import { UNKNOWN_REGION_LABEL } from './eana-map';

describe('story-location.util', () => {
  it('builds location context from region and ambiance', () => {
    expect(
      storyLocationContext(
        { kind: 'civilization', id: 'civ-cite-franche', name: 'Cité Franche' },
        'nuit d\'orage',
      ),
    ).toBe("Cité Franche — nuit d'orage");
  });

  it('uses unknown region label', () => {
    expect(storyRegionLabel({ kind: 'unknown' })).toBe(UNKNOWN_REGION_LABEL);
    expect(campaignRegionFields({ kind: 'unknown' })).toEqual({
      regionId: null,
      regionName: UNKNOWN_REGION_LABEL,
    });
  });

  it('restores region from campaign data', () => {
    expect(campaignRegionFromData('civ-kaan', 'Grand Kaan')).toEqual({
      kind: 'civilization',
      id: 'civ-kaan',
      name: 'Grand Kaan',
    });
    expect(campaignRegionFromData(null, UNKNOWN_REGION_LABEL)).toEqual({ kind: 'unknown' });
  });
});
