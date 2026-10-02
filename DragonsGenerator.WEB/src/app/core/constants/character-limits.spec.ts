import { maxCampaignPregens, MAX_CAMPAIGN_PREGENS_BASE, MAX_CHARACTERS_PER_USER } from './character-limits';

describe('character-limits', () => {
  it('keeps personal cloud cap at 10', () => {
    expect(MAX_CHARACTERS_PER_USER).toBe(10);
  });

  it('caps campaign pregens at 10 + player count', () => {
    expect(MAX_CAMPAIGN_PREGENS_BASE).toBe(10);
    expect(maxCampaignPregens(0)).toBe(10);
    expect(maxCampaignPregens(3)).toBe(13);
    expect(maxCampaignPregens(-2)).toBe(10);
    expect(maxCampaignPregens(2.9)).toBe(12);
    expect(maxCampaignPregens(Number.NaN)).toBe(10);
  });
});
