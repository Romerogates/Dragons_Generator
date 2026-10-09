import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SiteAnnouncementService } from '@core/services/site-announcement.service';
import {
  SITE_ANNOUNCEMENT_LIMITS,
  type SiteAnnouncement,
  type SiteAnnouncementSeverity,
} from '@core/models/site-announcement.model';

const SEVERITY_LABELS: Record<SiteAnnouncementSeverity, string> = {
  info: 'Information',
  warning: 'Attention',
  outage: 'Panne / incident',
};

@Component({
  selector: 'app-admin-announcements',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-announcements.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAnnouncements implements OnInit {
  private readonly service = inject(SiteAnnouncementService);

  readonly limits = SITE_ANNOUNCEMENT_LIMITS;
  readonly severities: SiteAnnouncementSeverity[] = ['info', 'warning', 'outage'];
  readonly history = signal<SiteAnnouncement[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly message = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  title = '';
  body = '';
  severity: SiteAnnouncementSeverity = 'info';
  durationDays = 1;

  ngOnInit(): void {
    this.load();
  }

  severityLabel(s: SiteAnnouncementSeverity): string {
    return SEVERITY_LABELS[s] ?? s;
  }

  canSubmit(): boolean {
    const len = this.body.trim().length;
    const days = Number(this.durationDays);
    return (
      !this.saving() &&
      len >= this.limits.messageMin &&
      len <= this.limits.messageMax &&
      Number.isInteger(days) &&
      days >= this.limits.minDays &&
      days <= this.limits.maxDays
    );
  }

  load(): void {
    this.loading.set(true);
    this.service.listAll().subscribe({
      next: (list) => {
        this.history.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.history.set([]);
        this.loading.set(false);
        this.error.set('Impossible de charger les annonces.');
      },
    });
  }

  submit(): void {
    if (!this.canSubmit()) return;
    this.saving.set(true);
    this.error.set(null);
    this.message.set(null);
    this.service
      .create({
        title: this.title.trim() || null,
        message: this.body.trim(),
        severity: this.severity,
        durationDays: Number(this.durationDays),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.title = '';
          this.body = '';
          this.message.set('Annonce publiée : bannière + notifications.');
          this.load();
        },
        error: (err: { error?: { errors?: { generalErrors?: string[] } } }) => {
          this.saving.set(false);
          this.error.set(err?.error?.errors?.generalErrors?.[0] ?? 'Publication impossible.');
        },
      });
  }

  end(a: SiteAnnouncement): void {
    this.service.end(a.id).subscribe({
      next: () => {
        this.message.set('Annonce terminée.');
        this.load();
      },
      error: () => this.error.set('Impossible de terminer l’annonce.'),
    });
  }

  remove(a: SiteAnnouncement): void {
    if (typeof window !== 'undefined' && !window.confirm('Supprimer définitivement cette annonce ?')) {
      return;
    }
    this.service.remove(a.id).subscribe({
      next: () => {
        this.message.set('Annonce supprimée.');
        this.load();
      },
      error: () => this.error.set('Suppression impossible.'),
    });
  }
}
