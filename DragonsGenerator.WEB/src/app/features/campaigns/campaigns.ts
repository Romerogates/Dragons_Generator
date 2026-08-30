import { ChangeDetectionStrategy, Component, Injector, inject, OnInit, signal, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CampaignCloudService } from '@core/services/campaign-cloud.service';
import { OfflineSyncService } from '@core/services/offline-sync.service';
import { ConnectivityService } from '@core/services/connectivity.service';
import { FriendsService } from '@core/services/friends.service';
import { NotificationService } from '@core/services/notification.service';
import { AuthService } from '@core/services/auth.service';
import { DataService } from '@core/services/data.service';
import { getCampaignPdfService } from '@core/services/campaign-pdf.loader';
import type { CreaturePrintEntry } from '@core/services/campaign-pdf.types';
import { CampaignData, CampaignInvite, CampaignSummary } from '@core/models/Campaign/campaign';
import { forkJoin, catchError, map, of, Observable } from 'rxjs';

@Component({
  selector: 'app-campaigns',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './campaigns.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class Campaigns implements OnInit {
  private campaigns = inject(CampaignCloudService);
  private friends = inject(FriendsService);
  private notifications = inject(NotificationService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private data = inject(DataService);
  private injector = inject(Injector);
  private readonly offlineSync = inject(OfflineSyncService);
  private readonly connectivity = inject(ConnectivityService);

  readonly isOnline = this.connectivity.isOnline;
  readonly pendingSyncCount = this.offlineSync.pendingCount;

  readonly list = signal<CampaignSummary[]>([]);
  readonly invites = signal<CampaignInvite[]>([]);
  readonly loading = signal(true);
  readonly toDelete = signal<CampaignSummary | null>(null);
  readonly deleteConfirmName = signal('');
  readonly deleteError = signal<string | null>(null);
  readonly deleting = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly cardActionId = signal<string | null>(null);
  readonly isLoggedIn = this.auth.isLoggedIn;

  ngOnInit(): void {
    if (!this.auth.isLoggedIn()) {
      this.loading.set(false);
      return;
    }
    this.reload();
    this.friends.listCampaignInvites().subscribe((i) => this.invites.set(i));
  }

  reload(): void {
    this.loading.set(true);
    this.actionError.set(null);

    if (!this.connectivity.isOnline()) {
      this.list.set(this.offlineSync.getLocalCampaignSummaries());
      this.loading.set(false);
      return;
    }

    this.offlineSync.flushIfPossible();
    this.campaigns.list().subscribe({
      next: (items) => {
        this.list.set(this.offlineSync.mergeCampaignLists(items));
        this.loading.set(false);
        this.notifications.refresh();
      },
      error: () => {
        this.list.set(this.offlineSync.mergeCampaignLists([]));
        this.actionError.set('Impossible de charger vos campagnes. Affichage des brouillons locaux.');
        this.loading.set(false);
      },
    });
  }

  open(c: CampaignSummary): void {
    if (c.pendingSync) {
      this.actionError.set(
        'Campagne en attente de synchronisation. Reconnecte-toi pour l\'envoyer au cloud.',
      );
      return;
    }
    this.router.navigate(['/campaigns', c.id]);
  }

  acceptInvite(inv: CampaignInvite): void {
    this.friends.acceptCampaignInvite(inv.id).subscribe(() => {
      this.reload();
      this.friends.listCampaignInvites().subscribe((i) => this.invites.set(i));
    });
  }

  declineInvite(inv: CampaignInvite): void {
    this.friends.declineCampaignInvite(inv.id).subscribe(() => {
      this.friends.listCampaignInvites().subscribe((i) => this.invites.set(i));
    });
  }

  confirmDelete(c: CampaignSummary): void {
    this.deleteConfirmName.set('');
    this.deleteError.set(null);
    this.toDelete.set(c);
  }

  cancelDelete(): void {
    this.deleteConfirmName.set('');
    this.deleteError.set(null);
    this.toDelete.set(null);
  }

  canConfirmDelete(): boolean {
    const c = this.toDelete();
    if (!c) return false;
    return this.deleteConfirmName().trim() === c.title.trim();
  }

  deleteCampaign(): void {
    const c = this.toDelete();
    if (!c || !this.canConfirmDelete() || this.deleting()) return;
    this.deleting.set(true);
    this.deleteError.set(null);
    this.campaigns.delete(c.id).subscribe({
      next: () => {
        this.deleteConfirmName.set('');
        this.deleteError.set(null);
        this.toDelete.set(null);
        this.deleting.set(false);
        this.reload();
      },
      error: () => {
        this.deleteError.set('Échec de la suppression cloud. Réessayez dans un instant.');
        this.deleting.set(false);
      },
    });
  }

  duplicateCampaign(c: CampaignSummary, event: Event): void {
    event.stopPropagation();
    if (c.role !== 'dm') return;
    this.cardActionId.set(c.id);
    this.actionError.set(null);
    this.campaigns.get(c.id).subscribe({
      next: (detail) => {
        const data: CampaignData = {
          ...detail.data,
          encounters: [],
        };
        this.campaigns.create(`${detail.title} (copie)`, data).subscribe({
          next: () => {
            this.cardActionId.set(null);
            this.reload();
          },
          error: () => {
            this.actionError.set('Impossible de dupliquer la campagne.');
            this.cardActionId.set(null);
          },
        });
      },
      error: () => {
        this.actionError.set('Campagne introuvable.');
        this.cardActionId.set(null);
      },
    });
  }

  downloadBestiary(c: CampaignSummary, event: Event): void {
    event.stopPropagation();
    if (c.role !== 'dm') return;
    this.cardActionId.set(c.id);
    this.actionError.set(null);
    this.campaigns.get(c.id).subscribe({
      next: (detail) => {
        if (!detail.data.creatures.length) {
          this.actionError.set('Cette campagne ne contient aucune créature.');
          this.cardActionId.set(null);
          return;
        }
        this.loadCreatureEntries(detail.data).subscribe({
          next: async (entries) => {
            try {
              const pdf = await getCampaignPdfService(this.injector);
              await pdf.downloadCreaturesCompilation(entries, detail.title);
            } catch {
              this.actionError.set('Échec de la génération du PDF bestiaire.');
            } finally {
              this.cardActionId.set(null);
            }
          },
          error: () => {
            this.actionError.set('Impossible de charger les fiches créatures.');
            this.cardActionId.set(null);
          },
        });
      },
      error: () => {
        this.actionError.set('Campagne introuvable.');
        this.cardActionId.set(null);
      },
    });
  }

  isCardBusy(c: CampaignSummary): boolean {
    return this.cardActionId() === c.id;
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'Récemment';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Récemment';
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  private loadCreatureEntries(data: CampaignData): Observable<CreaturePrintEntry[]> {
    const selections = data.creatures;
    if (!selections.length) return of([]);
    return forkJoin(
      selections.map((s) =>
        this.data.getCreatureById(s.creatureId).pipe(
          catchError(() => of(null)),
          map(
            (creature): CreaturePrintEntry | null =>
              creature
                ? {
                    creature,
                    customName: s.customName,
                    role: s.role,
                    backstory: s.backstory,
                  }
                : null,
          ),
        ),
      ),
    ).pipe(map((list) => list.filter((x): x is CreaturePrintEntry => x !== null)));
  }
}
