import { CharacterHandoffService, CHARACTER_HANDOFF_TTL_MS } from './character-handoff.service';
import type { Character } from '@core/models/Character/character';

describe('CharacterHandoffService', () => {
  let service: CharacterHandoffService;

  beforeEach(() => {
    sessionStorage.clear();
    service = new CharacterHandoffService();
  });

  afterEach(() => sessionStorage.clear());

  it('defaults to own mode', () => {
    service.setCurrent({ name: 'Aria' } as Character);
    expect(service.peekMode()).toBe('own');
    expect(service.peekSourceLabel()).toBeNull();
  });

  it('stores consult mode and source label', () => {
    service.setCurrent({ name: 'Borin' } as Character, {
      mode: 'consult',
      sourceLabel: 'Pré-tiré',
      returnUrl: '/campaigns/1/play',
    });
    expect(service.peekCurrent()?.name).toBe('Borin');
    expect(service.peekMode()).toBe('consult');
    expect(service.peekSourceLabel()).toBe('Pré-tiré');
    expect(service.peekReturnUrl()).toBe('/campaigns/1/play');
    expect(service.peekProposalReview()).toBeNull();
  });

  it('stores proposal review context for DM accept/reject', () => {
    service.setCurrent({ name: 'Mira' } as Character, {
      mode: 'consult',
      sourceLabel: 'Proposition de Alice',
      returnUrl: '/campaigns/42?tab=players',
      proposalReview: {
        campaignId: '42',
        memberId: 'm1',
        memberDisplayName: 'Alice',
      },
    });
    expect(service.peekProposalReview()).toEqual({
      campaignId: '42',
      memberId: 'm1',
      memberDisplayName: 'Alice',
    });
  });

  it('clears mode with character', () => {
    service.setCurrent({ name: 'X' } as Character, {
      mode: 'consult',
      sourceLabel: 'Chat',
      returnUrl: '/play',
      proposalReview: { campaignId: '1', memberId: '2' },
    });
    service.clearCurrent();
    expect(service.peekCurrent()).toBeNull();
    expect(service.peekMode()).toBe('own');
    expect(service.peekSourceLabel()).toBeNull();
    expect(service.peekReturnUrl()).toBeNull();
    expect(service.peekProposalReview()).toBeNull();
  });

  it('expires handoff after TTL', () => {
    service.setCurrent({ name: 'Old' } as Character);
    const metaRaw = sessionStorage.getItem('dragons-current-character-meta');
    expect(metaRaw).toBeTruthy();
    const meta = JSON.parse(metaRaw!);
    meta.savedAt = Date.now() - CHARACTER_HANDOFF_TTL_MS - 1000;
    sessionStorage.setItem('dragons-current-character-meta', JSON.stringify(meta));
    expect(service.isHandoffFresh()).toBeFalse();
    expect(service.peekCurrent()).toBeNull();
  });

  it('keeps fresh handoff within TTL', () => {
    service.setCurrent({ name: 'Fresh' } as Character);
    expect(service.isHandoffFresh()).toBeTrue();
    expect(service.peekCurrent()?.name).toBe('Fresh');
  });
});
