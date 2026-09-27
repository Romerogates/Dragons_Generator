import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

export interface AiProviderOption {
  id: string;
  label: string;
  defaultModel: string;
  baseUrlHint: string;
}

export interface AiSettingsDto {
  enabled: boolean;
  provider: string | null;
  model: string | null;
  hasApiKey: boolean;
  apiKeyHint: string | null;
  providers: AiProviderOption[];
}

export interface UpdateAiSettingsRequest {
  enabled: boolean;
  provider?: string | null;
  model?: string | null;
  apiKey?: string | null;
  clearApiKey?: boolean;
}

@Injectable({ providedIn: 'root' })
export class AiSettingsService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  get(): Observable<AiSettingsDto> {
    return this.http.get<AiSettingsDto>(`${this.api}/me/ai-settings`);
  }

  save(body: UpdateAiSettingsRequest): Observable<AiSettingsDto> {
    return this.http.put<AiSettingsDto>(`${this.api}/me/ai-settings`, body);
  }

  clear(): Observable<void> {
    return this.http.delete<void>(`${this.api}/me/ai-settings`);
  }
}
