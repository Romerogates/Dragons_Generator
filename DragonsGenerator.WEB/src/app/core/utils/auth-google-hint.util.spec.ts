import { GOOGLE_TWO_ACCOUNT_HINT, withGoogleLoginHint } from './auth-google-hint.util';

describe('auth-google-hint.util', () => {
  it('appends the two-account reminder once', () => {
    expect(withGoogleLoginHint('Email ou mot de passe incorrect.')).toContain(GOOGLE_TWO_ACCOUNT_HINT);
    expect(withGoogleLoginHint(GOOGLE_TWO_ACCOUNT_HINT)).toBe(GOOGLE_TWO_ACCOUNT_HINT);
  });
});
