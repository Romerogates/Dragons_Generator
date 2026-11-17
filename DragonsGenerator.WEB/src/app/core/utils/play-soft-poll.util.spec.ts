import { hubSoftPollMs, playSoftPollMs } from './play-soft-poll.util';

describe('play-soft-poll.util', () => {
  it('skips poll when live is connected', () => {
    expect(playSoftPollMs(true, true)).toBeNull();
    expect(hubSoftPollMs(true, true, true)).toBeNull();
  });

  it('polls MJ and players when live is down', () => {
    expect(playSoftPollMs(false, true)).toBe(5_000);
    expect(playSoftPollMs(false, false)).toBe(4_000);
    expect(hubSoftPollMs(false, true, true)).toBe(6_000);
    expect(hubSoftPollMs(false, false, true)).toBe(12_000);
  });
});
