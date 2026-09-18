import { UI_BANNER_IDS } from './ui-banner-preferences.service';

describe('UiBannerPreferencesService constants', () => {
  it('exposes stable banner ids from the Vague A plan', () => {
    expect(UI_BANNER_IDS.setupGuide).toBe('setup-guide');
    expect(UI_BANNER_IDS.dungeonToast).toBe('dungeon-toast');
    expect(UI_BANNER_IDS.welcomeCampaign).toBe('welcome-campaign');
    expect(UI_BANNER_IDS.firstSessionComplete).toBe('first-session-complete');
  });
});
