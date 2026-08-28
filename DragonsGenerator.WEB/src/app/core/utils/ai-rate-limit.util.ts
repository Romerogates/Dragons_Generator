import { HttpErrorResponse } from '@angular/common/http';

export interface AiRateLimitInfo {
  retryAfterSeconds: number;
  suggestLogin: boolean;
  message: string;
}

const STORAGE_KEY = 'dragons-ai-rate-limit-until';

export function parseAiRateLimitError(err: unknown): AiRateLimitInfo | null {
  if (!(err instanceof HttpErrorResponse) || err.status !== 429) return null;

  const body =
    err.error && typeof err.error === 'object' ? (err.error as Record<string, unknown>) : null;

  let retryAfterSeconds = 3600;
  const retryHeader = err.headers.get('Retry-After');
  if (retryHeader) {
    const parsed = parseInt(retryHeader, 10);
    if (!Number.isNaN(parsed) && parsed > 0) retryAfterSeconds = parsed;
  }
  if (typeof body?.['retryAfterSeconds'] === 'number' && body['retryAfterSeconds'] > 0) {
    retryAfterSeconds = body['retryAfterSeconds'];
  }

  const message =
    (typeof body?.['message'] === 'string' && body['message']) ||
    'Limite de génération IA atteinte pour le moment.';

  return {
    retryAfterSeconds,
    suggestLogin: body?.['suggestLogin'] === true,
    message,
  };
}

export function persistAiRateLimitUntil(untilMs: number): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, String(untilMs));
  } catch {
    /* ignore */
  }
}

export function readPersistedAiRateLimitUntil(): number | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const until = parseInt(raw, 10);
    if (Number.isNaN(until) || until <= Date.now()) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return until;
  } catch {
    return null;
  }
}

export function clearPersistedAiRateLimit(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function formatAiRateLimitRemaining(ms: number): string {
  if (ms <= 0) return 'Disponible';
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`;
  if (m > 0) return `${String(m).padStart(2, '0')} min ${String(s).padStart(2, '0')} s`;
  return `${s} s`;
}
