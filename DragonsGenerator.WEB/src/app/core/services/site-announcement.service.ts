import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '@env/environment';
import type {
  CreateSiteAnnouncementRequest,
  SiteAnnouncement,
} from '@core/models/site-announcement.model';

const DISMISSED_KEY = 'dragons-announcements-dismissed';
const POLL_MS = 5 * 60_000;

/** Annonces site (pannes, maintenance…) : bannière publique + gestion admin. */
@Injectable({ providedIn: 'root' })
export class SiteAnnouncementService {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = environment.apiUrl;

  private readonly activeSignal = signal<SiteAnnouncement[]>([]);
  private readonly dismissedSignal = signal<ReadonlySet<string>>(readDismissed());
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  readonly active = this.activeSignal.asReadonly();
  readonly visible = computed(() => {
    const dismissed = this.dismissedSignal();
    return this.activeSignal().filter((a) => !dismissed.has(a.id));
  });

  init(): void {
    this.refresh();
    if (typeof window === 'undefined' || this.pollTimer) return;
    window.addEventListener('focus', this.onFocus);
    this.pollTimer = setInterval(() => this.refresh(), POLL_MS);
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('focus', this.onFocus);
      if (this.pollTimer) clearInterval(this.pollTimer);
      this.pollTimer = null;
    });
  }

  refresh(): void {
    this.http.get<SiteAnnouncement[]>(`${this.api}/announcements/active`).subscribe({
      next: (list) => {
        const items = Array.isArray(list) ? list : [];
        this.activeSignal.set(items);
        this.pruneDismissed(items);
      },
      error: () => this.activeSignal.set([]),
    });
  }

  isDismissed(id: string): boolean {
    return this.dismissedSignal().has(id);
  }

  dismiss(id: string): void {
    const next = new Set(this.dismissedSignal());
    next.add(id);
    this.dismissedSignal.set(next);
    writeDismissed(next);
  }

  listAll(): Observable<SiteAnnouncement[]> {
    return this.http.get<SiteAnnouncement[]>(`${this.api}/admin/announcements`);
  }

  create(body: CreateSiteAnnouncementRequest): Observable<SiteAnnouncement> {
    return this.http
      .post<SiteAnnouncement>(`${this.api}/admin/announcements`, body)
      .pipe(tap(() => this.refresh()));
  }

  end(id: string): Observable<SiteAnnouncement> {
    return this.http
      .post<SiteAnnouncement>(`${this.api}/admin/announcements/${id}/end`, {})
      .pipe(tap(() => this.refresh()));
  }

  remove(id: string): Observable<void> {
    return this.http
      .delete<void>(`${this.api}/admin/announcements/${id}`)
      .pipe(tap(() => this.refresh()));
  }

  /** Garde le stockage local borné : on oublie les annonces qui ne sont plus actives. */
  private pruneDismissed(active: SiteAnnouncement[]): void {
    const current = this.dismissedSignal();
    if (current.size === 0) return;
    const activeIds = new Set(active.map((a) => a.id));
    const kept = new Set([...current].filter((id) => activeIds.has(id)));
    if (kept.size === current.size) return;
    this.dismissedSignal.set(kept);
    writeDismissed(kept);
  }

  private readonly onFocus = (): void => this.refresh();
}

function readDismissed(): ReadonlySet<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

function writeDismissed(ids: ReadonlySet<string>): void {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
  } catch {
    /* stockage indisponible (navigation privée) */
  }
}
