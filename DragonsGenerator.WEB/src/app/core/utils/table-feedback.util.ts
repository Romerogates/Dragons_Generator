/** Feedback soft optionnel (critique, tour, XP) — désactivable via prefs locales. */

const PREF_KEY = 'dg.tableSoftFeedback';

export type SoftFeedbackKind = 'crit' | 'fumble' | 'turn' | 'xp' | 'dice' | 'ready';

export function isSoftFeedbackEnabled(): boolean {
  if (typeof localStorage === 'undefined') return true;
  try {
    const v = localStorage.getItem(PREF_KEY);
    if (v === null) return true;
    return v !== '0' && v !== 'false';
  } catch {
    return true;
  }
}

export function setSoftFeedbackEnabled(on: boolean): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(PREF_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

/** Petit bip Web Audio + vibration courte si dispo. */
export function softTablePulse(kind: SoftFeedbackKind = 'dice'): void {
  if (!isSoftFeedbackEnabled()) return;
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      const pattern =
        kind === 'crit' ? [12, 40, 18] : kind === 'fumble' ? [30] : kind === 'xp' ? [10, 20, 10] : [12];
      navigator.vibrate(pattern);
    }
  } catch {
    /* ignore */
  }
  try {
    const Ctx =
      typeof window !== 'undefined'
        ? window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        : undefined;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const freq =
      kind === 'crit' ? 880 : kind === 'fumble' ? 180 : kind === 'xp' ? 660 : kind === 'turn' ? 520 : 440;
    osc.frequency.value = freq;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t0 = ctx.currentTime;
    gain.gain.setValueAtTime(0.04, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
    osc.start(t0);
    osc.stop(t0 + 0.13);
    osc.onended = () => void ctx.close();
  } catch {
    /* ignore */
  }
}
