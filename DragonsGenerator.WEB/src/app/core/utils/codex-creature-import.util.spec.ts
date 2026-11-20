import {
  ownerCampaignIdForCodex,
  showCodexAddToEncounter,
  showCodexAddToTable,
} from './codex-creature-import.util';

describe('codex-creature-import.util', () => {
  it('hides both CTAs when browsing the Codex with no campaign', () => {
    expect(
      showCodexAddToTable({ loggedIn: true, sessionOpen: false, isOwner: false }),
    ).toBeFalse();
    expect(showCodexAddToEncounter({ loggedIn: true, ownerCampaignId: null })).toBeFalse();
    expect(
      showCodexAddToEncounter({ loggedIn: false, ownerCampaignId: 'c1' }),
    ).toBeFalse();
  });

  it('shows table only for the MJ with an open session', () => {
    expect(
      showCodexAddToTable({ loggedIn: true, sessionOpen: true, isOwner: true }),
    ).toBeTrue();
    expect(
      showCodexAddToTable({ loggedIn: true, sessionOpen: true, isOwner: false }),
    ).toBeFalse();
    expect(
      showCodexAddToTable({ loggedIn: true, sessionOpen: false, isOwner: true }),
    ).toBeFalse();
  });

  it('shows encounter when a MJ campaign is remembered, even without a live session', () => {
    expect(showCodexAddToEncounter({ loggedIn: true, ownerCampaignId: 'c1' })).toBeTrue();
    expect(
      ownerCampaignIdForCodex({ live: { id: 'c1', isOwner: true }, persistedId: null }),
    ).toBe('c1');
    expect(
      ownerCampaignIdForCodex({ live: { id: 'c1', isOwner: false }, persistedId: 'c9' }),
    ).toBeNull();
    expect(ownerCampaignIdForCodex({ live: null, persistedId: 'c2' })).toBe('c2');
  });
});
