import { extractFastEndpointsError } from './auth-api-error.util';

describe('extractFastEndpointsError', () => {
  it('reads generalErrors from FastEndpoints', () => {
    expect(
      extractFastEndpointsError({
        error: {
          message: 'One or more errors occurred!',
          errors: { generalErrors: ['Ce pseudo est déjà utilisé. Choisissez-en un autre.'] },
        },
      }),
    ).toBe('Ce pseudo est déjà utilisé. Choisissez-en un autre.');
  });

  it('reads reason array', () => {
    expect(
      extractFastEndpointsError({
        error: { errors: [{ reason: 'google_register_required' }] },
      }),
    ).toBe('google_register_required');
  });

  it('uses fallback when empty', () => {
    expect(extractFastEndpointsError({ error: {} }, 'Inscription Google impossible.')).toBe(
      'Inscription Google impossible.',
    );
  });

  it('reads a plain string body', () => {
    expect(extractFastEndpointsError({ error: '  Compte bloqué.  ' })).toBe('Compte bloqué.');
  });

  it('reads another dictionary list', () => {
    expect(
      extractFastEndpointsError({
        error: { errors: { DisplayName: ['Trop court.'] } },
      }),
    ).toBe('Trop court.');
  });

  it('skips the generic FastEndpoints title', () => {
    expect(
      extractFastEndpointsError({ error: { message: 'One or more errors occurred!' } }, 'x'),
    ).toBe('x');
  });

  it('explains a disconnected API', () => {
    expect(extractFastEndpointsError({ status: 0, error: {} })).toContain('serveur');
  });

  it('returns fallback when nothing is provided', () => {
    expect(extractFastEndpointsError(null, 'rien')).toBe('rien');
  });
});
