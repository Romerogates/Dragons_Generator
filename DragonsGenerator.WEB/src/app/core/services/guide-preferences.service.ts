import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { AuthService } from './auth.service';

const READ_NEWS_KEY = 'dragons-guide-read-news';

interface GuidePreferencesDto {
  readNewsIds: string[];
}

@Injectable({ providedIn: 'root' })
export class GuidePreferencesService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly api = environment.apiUrl;

  readonly readNewsIds = signal<Record<string, true>>({});

  async load(): Promise<void> {
    const localIds = this.loadLocalIds();
    if (!this.auth.isLoggedIn()) {
      this.readNewsIds.set(this.toRecord(localIds));
      return;
    }

    try {
      const remote = await firstValueFrom(
        this.http.get<GuidePreferencesDto>(`${this.api}/me/guide-preferences`),
      );
      const remoteIds = remote.readNewsIds ?? [];
      const merged = [...new Set([...localIds, ...remoteIds])];
      this.readNewsIds.set(this.toRecord(merged));
      const needsSync =
        merged.length !== remoteIds.length ||
        localIds.some((id) => !remoteIds.includes(id));
      if (needsSync) {
        await this.persistRemote(merged);
      }
      if (localIds.length) this.clearLocal();
    } catch {
      this.readNewsIds.set(this.toRecord(localIds));
    }
  }

  markRead(newsId: string): void {
    if (this.readNewsIds()[newsId]) return;
    const nextIds = [...Object.keys(this.readNewsIds()), newsId];
    this.readNewsIds.update((current) => ({ ...current, [newsId]: true }));
    this.persist(nextIds);
  }

  markAll(ids: string[]): void {
    this.readNewsIds.set(this.toRecord(ids));
    this.persist(ids);
  }

  private persist(ids: string[]): void {
    if (this.auth.isLoggedIn()) {
      void this.persistRemote(ids).catch(() => this.saveLocal(ids));
    } else {
      this.saveLocal(ids);
    }
  }

  private async persistRemote(ids: string[]): Promise<void> {
    await firstValueFrom(
      this.http.put<GuidePreferencesDto>(`${this.api}/me/guide-preferences`, {
        readNewsIds: ids,
      }),
    );
  }

  private loadLocalIds(): string[] {
    try {
      const raw = localStorage.getItem(READ_NEWS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  }

  private saveLocal(ids: string[]): void {
    try {
      localStorage.setItem(READ_NEWS_KEY, JSON.stringify(ids));
    } catch {
      /* ignore */
    }
  }

  private clearLocal(): void {
    try {
      localStorage.removeItem(READ_NEWS_KEY);
    } catch {
      /* ignore */
    }
  }

  private toRecord(ids: string[]): Record<string, true> {
    return Object.fromEntries(ids.map((id) => [id, true as const]));
  }
}
