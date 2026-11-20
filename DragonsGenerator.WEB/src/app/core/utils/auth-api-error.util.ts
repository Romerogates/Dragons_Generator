/** Message FastEndpoints (`AddError`) depuis une réponse HTTP Angular. */
export function extractFastEndpointsError(
  err: { status?: number; error?: unknown } | null | undefined,
  fallback = '',
): string {
  if (!err) return fallback;
  const body = err.error;
  if (typeof body === 'string' && body.trim()) return body.trim();

  const e = body as {
    errors?: { reason?: string }[] | Record<string, unknown>;
    message?: string;
  } | null;

  if (Array.isArray(e?.errors) && e.errors[0]?.reason) return e.errors[0].reason;

  if (e?.errors && typeof e.errors === 'object' && !Array.isArray(e.errors)) {
    const dict = e.errors;
    for (const key of ['generalErrors', 'GeneralErrors'] as const) {
      const list = dict[key];
      if (Array.isArray(list) && typeof list[0] === 'string' && list[0].trim()) {
        return list[0].trim();
      }
    }
    const first = Object.values(dict).flat()[0];
    if (typeof first === 'string' && first.trim()) return first.trim();
  }

  if (e?.message && e.message !== 'One or more errors occurred!') return e.message;
  if (err.status === 0) {
    return 'Impossible de joindre le serveur. Vérifiez votre connexion.';
  }
  return fallback;
}
