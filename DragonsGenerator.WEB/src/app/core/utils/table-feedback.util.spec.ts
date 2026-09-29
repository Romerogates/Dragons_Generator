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
});
