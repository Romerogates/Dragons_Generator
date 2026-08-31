import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, shareReplay } from 'rxjs/operators';
import { environment } from '@env/environment';
import type { AiStatusResponse } from '@core/models/ai-generation.model';

const DEFAULT_STATUS: AiStatusResponse = {
  localLlmEnabled: false,
  groqConfigured: true,
  shortGeneration: {
    primary: 'groq',
    fallback: null,
    primaryLabel: 'Groq (cloud)',
    fallbackLabel: null,
  },
  adventureGeneration: {
    primary: 'groq',
    fallback: null,
    primaryLabel: 'Groq (cloud)',
    fallbackLabel: null,
  },
};

@Injectable({ providedIn: 'root' })
export class AiStatusService {
  private readonly http = inject(HttpClient);
  private readonly cache$ = this.http
    .get<AiStatusResponse>(`${environment.apiUrl}/ai/status`)
    .pipe(
      catchError(() => of(DEFAULT_STATUS)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

  getStatus(): Observable<AiStatusResponse> {
    return this.cache$;
  }
}
