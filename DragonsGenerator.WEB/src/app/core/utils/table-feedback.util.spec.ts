import {
  isSoftFeedbackEnabled,
  setSoftFeedbackEnabled,
  softTablePulse,
} from './table-feedback.util';

describe('table-feedback.util', () => {
  beforeEach(() => {
    try {
      localStorage.removeItem('dg.tableSoftFeedback');
    } catch {
      /* ignore */
    }
  });

  it('defaults soft feedback to enabled', () => {
    expect(isSoftFeedbackEnabled()).toBe(true);
    setSoftFeedbackEnabled(false);
    expect(isSoftFeedbackEnabled()).toBe(false);
    setSoftFeedbackEnabled(true);
    expect(isSoftFeedbackEnabled()).toBe(true);
  });

  it('softTablePulse does not throw when audio/vibrate unavailable', () => {
    expect(() => softTablePulse('crit')).not.toThrow();
    expect(() => softTablePulse('fumble')).not.toThrow();
    expect(() => softTablePulse('turn')).not.toThrow();
  });

  it('honore false/0 et pulse chaque kind', () => {
    localStorage.setItem('dg.tableSoftFeedback', 'false');
    expect(isSoftFeedbackEnabled()).toBe(false);
    expect(() => softTablePulse('xp')).not.toThrow();
    localStorage.setItem('dg.tableSoftFeedback', '0');
    expect(isSoftFeedbackEnabled()).toBe(false);
    setSoftFeedbackEnabled(true);
    const vibrate = jasmine.createSpy('vibrate');
    (navigator as Navigator & { vibrate: (p: number[]) => boolean }).vibrate = vibrate;
    for (const kind of ['crit', 'fumble', 'xp', 'turn', 'dice', 'ready'] as const) {
      expect(() => softTablePulse(kind)).not.toThrow();
    }
    expect(vibrate).toHaveBeenCalled();
  });

  it('ignore setSoftFeedback si localStorage jette', () => {
    const proto = Object.getPrototypeOf(localStorage) as Storage;
    spyOn(proto, 'setItem').and.throwError('quota');
    expect(() => setSoftFeedbackEnabled(false)).not.toThrow();
    spyOn(proto, 'getItem').and.throwError('blocked');
    expect(isSoftFeedbackEnabled()).toBe(true);
  });

  it('joue un oscillo Web Audio pour chaque kind', () => {
    class FakeOsc {
      type = '';
      frequency = { value: 0 };
      onended: (() => void) | null = null;
      connect(): void {}
      start(): void {}
      stop(): void {
        this.onended?.();
      }
    }
    class FakeGain {
      gain = {
        value: 0,
        setValueAtTime(): void {},
        exponentialRampToValueAtTime(): void {},
      };
      connect(): void {}
    }
    class FakeCtx {
      currentTime = 0;
      destination = {};
      createOscillator(): FakeOsc {
        return new FakeOsc();
      }
      createGain(): FakeGain {
        return new FakeGain();
      }
      close(): Promise<void> {
        return Promise.resolve();
      }
    }
    const prev = window.AudioContext;
    (window as unknown as { AudioContext: typeof FakeCtx }).AudioContext = FakeCtx;
    setSoftFeedbackEnabled(true);
    expect(() => softTablePulse('ready')).not.toThrow();
    expect(() => softTablePulse('dice')).not.toThrow();
    (window as unknown as { AudioContext: typeof AudioContext }).AudioContext = prev;
  });
});
