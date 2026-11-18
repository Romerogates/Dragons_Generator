import { homeHeroCtas, GUEST_AUDIENCE_KEY, readGuestAudience, writeGuestAudience } from './home-hero-cta.util';

describe('homeHeroCtas', () => {
  it('defaults to forge + guide', () => {
    const { primary, secondary } = homeHeroCtas({ loggedIn: false, audience: 'all' });
    expect(primary).toEqual(jasmine.objectContaining({ path: '/create', label: 'Forger une légende' }));
    expect(secondary.path).toBe('/guide');
  });

  it('sends a logged-in MJ to campaigns first', () => {
    const { primary, secondary } = homeHeroCtas({ loggedIn: true, audience: 'dm' });
    expect(primary).toEqual(jasmine.objectContaining({ path: '/campaigns', label: 'Créer une table', tone: 'violet' }));
    expect(secondary.path).toBe('/create');
  });

  it('asks a guest MJ to log in with return to campaigns', () => {
    const { primary } = homeHeroCtas({ loggedIn: false, audience: 'dm' });
    expect(primary.path).toBe('/login');
    expect(primary.queryParams).toEqual({ returnUrl: '/campaigns' });
  });

  it('sends a player to forge, then campaigns', () => {
    const logged = homeHeroCtas({ loggedIn: true, audience: 'player' });
    expect(logged.primary.path).toBe('/create');
    expect(logged.secondary.path).toBe('/campaigns');
    const guest = homeHeroCtas({ loggedIn: false, audience: 'player' });
    expect(guest.secondary.path).toBe('/login');
  });
});

describe('guest audience storage', () => {
  beforeEach(() => localStorage.removeItem(GUEST_AUDIENCE_KEY));

  it('reads and writes dm / player, and clears on all', () => {
    expect(readGuestAudience()).toBeNull();
    writeGuestAudience('dm');
    expect(readGuestAudience()).toBe('dm');
    writeGuestAudience('player');
    expect(readGuestAudience()).toBe('player');
    writeGuestAudience('all');
    expect(readGuestAudience()).toBeNull();
  });
});
