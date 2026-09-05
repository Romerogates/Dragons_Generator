import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import {
  clearPersistedAiRateLimit,
  formatAiRateLimitRemaining,
  isAiGenerationRequest,
  isAiRateLimitHttpError,
  parseAiRateLimitError,
  persistAiRateLimitUntil,
  readPersistedAiRateLimitUntil,
} from './ai-rate-limit.util';

describe('ai-rate-limit.util', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('detects AI generation URLs', () => {
    expect(isAiGenerationRequest('/api/generate-backstory')).toBeTrue();
    expect(isAiGenerationRequest('/api/generate-adventure?x=1')).toBeTrue();
    expect(isAiGenerationRequest('/api/generate-creature-story')).toBeTrue();
    expect(isAiGenerationRequest('/api/generate-creature-stories-batch')).toBeTrue();
    expect(isAiGenerationRequest('/api/characters')).toBeFalse();
  });

  it('parses applicative 429 with Retry-After header and body overrides', () => {
    const err = new HttpErrorResponse({
      status: 429,
      url: '/api/generate-backstory',
      headers: new HttpHeaders({ 'Retry-After': '120' }),
      error: {
        code: 'ai_rate_limit',
        retryAfterSeconds: 90,
        suggestLogin: true,
        message: 'Trop de requêtes',
      },
    });
    const info = parseAiRateLimitError(err);
    expect(info).toEqual({
      retryAfterSeconds: 90,
      suggestLogin: true,
      message: 'Trop de requêtes',
    });
    expect(isAiRateLimitHttpError(err)).toBeTrue();
  });

  it('uses Retry-After when body has no retryAfterSeconds', () => {
    const err = new HttpErrorResponse({
      status: 429,
      url: '/api/generate-adventure',
      headers: new HttpHeaders({ 'Retry-After': '45' }),
      error: { code: 'ai_rate_limit' },
    });
    expect(parseAiRateLimitError(err)?.retryAfterSeconds).toBe(45);
    expect(parseAiRateLimitError(err)?.message).toContain('Limite');
  });

  it('ignores non-AI 429 and invalid Retry-After', () => {
    expect(
      parseAiRateLimitError(
        new HttpErrorResponse({
          status: 429,
          url: '/api/other',
          error: { code: 'ai_rate_limit' },
        }),
      ),
    ).toBeNull();
    expect(
      parseAiRateLimitError(
        new HttpErrorResponse({
          status: 500,
          url: '/api/generate-backstory',
          error: { code: 'ai_rate_limit' },
        }),
      ),
    ).toBeNull();
    expect(
      parseAiRateLimitError(
        new HttpErrorResponse({
          status: 429,
          url: '/api/generate-backstory',
          headers: new HttpHeaders({ 'Retry-After': 'nope' }),
          error: { code: 'ai_rate_limit' },
        }),
      )?.retryAfterSeconds,
    ).toBe(3600);
    expect(isAiRateLimitHttpError(new Error('x'))).toBeFalse();
  });

  it('persists and clears rate-limit until timestamps', () => {
    const future = Date.now() + 60_000;
    persistAiRateLimitUntil(future);
    expect(readPersistedAiRateLimitUntil()).toBe(future);

    persistAiRateLimitUntil(Date.now() - 1);
    expect(readPersistedAiRateLimitUntil()).toBeNull();

    persistAiRateLimitUntil(future);
    clearPersistedAiRateLimit();
    expect(readPersistedAiRateLimitUntil()).toBeNull();
  });

  it('formats remaining duration buckets', () => {
    expect(formatAiRateLimitRemaining(0)).toBe('Disponible');
    expect(formatAiRateLimitRemaining(-1)).toBe('Disponible');
    expect(formatAiRateLimitRemaining(1500)).toMatch(/s$/);
    expect(formatAiRateLimitRemaining(90_000)).toMatch(/min/);
    expect(formatAiRateLimitRemaining(3_700_000)).toMatch(/h/);
  });
});
