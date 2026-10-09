import { PLAY_SESSION_TABS } from '@core/utils/play-table.util';
import { CampaignPlayPanel } from './campaign-play-panel';

describe('CampaignPlayPanel', () => {
  it('is the table shell and uses the six exclusive views', () => {
    expect(CampaignPlayPanel).toBeDefined();
    expect(PLAY_SESSION_TABS.map((t) => t.id)).toEqual([
      'resume',
      'notes',
      'combat',
      'encounters',
      'dungeon',
      'history',
    ]);
  });
});
