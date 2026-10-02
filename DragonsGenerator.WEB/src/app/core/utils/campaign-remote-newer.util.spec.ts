import { isRemoteNewer } from './campaign-remote-newer.util';

describe('isRemoteNewer', () => {
  it('compares valid ISO timestamps', () => {
    expect(isRemoteNewer('2026-10-02T12:00:01.000Z', '2026-10-02T12:00:00.000Z')).toBeTrue();
    expect(isRemoteNewer('2026-10-02T12:00:00.000Z', '2026-10-02T12:00:01.000Z')).toBeFalse();
    expect(isRemoteNewer('2026-10-02T12:00:00.000Z', '2026-10-02T12:00:00.000Z')).toBeFalse();
  });

  it('falls back to string compare when parse fails', () => {
    expect(isRemoteNewer('b', 'a')).toBeTrue();
  });
});
