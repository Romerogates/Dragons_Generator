import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit, signal, computed, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CampaignCloudService } from '@core/services/campaign-cloud.service';
import { OfflineSyncService } from '@core/services/offline-sync.service';
import { ConnectivityService } from '@core/services/connectivity.service';
import { FriendsService } from '@core/services/friends.service';
import { NotificationService } from '@core/services/notification.service';
import { AuthService } from '@core/services/auth.service';
import { CampaignData, CampaignInvite, CampaignSummary, emptyCampaignData } from '@core/models/Campaign/campaign';

type RoleFilter = 'all' | 'dm' | 'player';

@Component({
  selector: 'app-campaigns',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './campaigns.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class Campaigns implements OnInit, OnDestroy {
  private campaigns = inject(CampaignCloudService);
  private friends = inject(FriendsService);
  private notifications = inject(NotificationService);
  private auth = inject(AuthService);
  private router = inject(Router);
  private readonly offlineSync = inject(OfflineSyncService);
  private readonly connectivity = inject(ConnectivityService);

  readonly isOnline = this.connectivity.isOnline;
  readonly pendingSyncCount = this.offlineSync.pendingCount;

  readonly list = signal<CampaignSummary[]>([]);
  readonly invites = signal<CampaignInvite[]>([]);
  readonly roleFilter = signal<RoleFilter>('all');
  readonly loading = signal(true);
  readonly toDelete = signal<CampaignSummary | null>(null);
  readonly deleteConfirmName = signal('');
  readonly deleteError = signal<string | null>(null);
  readonly deleting = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly cardActionId = signal<string | null>(null);
  readonly creatingEmpty = signal(false);
  readonly showEmptyCampaignModal = signal(false);
  readonly emptyCampaignTitle = signal('Nouvelle campagne');
  readonly emptyCampaignTemplate = signal<'blank' | 'oneshot-classic' | 'oneshot-dungeon' | 'oneshot-intrigue'>('blank');
  readonly isLoggedIn = this.auth.isLoggedIn;

  private softPollTimer: ReturnType<typeof setInterval> | null = null;

  readonly filteredList = computed(() => {
    const filter = this.roleFilter();
    const items = this.list();
    if (filter === 'all') return items;
    return items.filter((c) => c.role === filter);
  });

  readonly dmCount = computed(() => this.list().filter((c) => c.role === 'dm').length);
  readonly playerCount = computed(() => this.list().filter((c) => c.role === 'player').length);

  ngOnInit(): void {
    if (!this.auth.isLoggedIn()) {
      this.loading.set(false);
      return;
    }
    this.reload();
    this.refreshInvites();
    this.softPollTimer = setInterval(() => this.softRefresh(), 12_000);
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', this.onWindowFocus);
    }
  }

  ngOnDestroy(): void {
    if (this.softPollTimer) clearInterval(this.softPollTimer);
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', this.onWindowFocus);
    }
  }

  private readonly onWindowFocus = (): void => {
    if (this.auth.isLoggedIn()) this.softRefresh();
  };

  setRoleFilter(filter: RoleFilter): void {
    this.roleFilter.set(filter);
  }

  private refreshInvites(): void {
    this.friends.listCampaignInvites().subscribe((i) => this.invites.set(i));
  }

  /** Sans spinner : invitations + liste (ex. acceptation ailleurs). */
  private softRefresh(): void {
    if (!this.auth.isLoggedIn() || !this.connectivity.isOnline()) return;
    this.refreshInvites();
    this.campaigns.list().subscribe({
      next: (items) => {
        this.list.set(this.offlineSync.mergeCampaignLists(items));
        this.notifications.refresh();
      },
      error: () => {
        /* ignore soft poll errors */
      },
    });
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
    this.refreshInvites();
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

  openEmptyCampaignModal(): void {
    if (!this.auth.isLoggedIn() || this.creatingEmpty()) return;
    this.emptyCampaignTitle.set('Nouvelle campagne');
    this.emptyCampaignTemplate.set('blank');
    this.showEmptyCampaignModal.set(true);
  }

  cancelEmptyCampaignModal(): void {
    if (this.creatingEmpty()) return;
    this.showEmptyCampaignModal.set(false);
  }

  createEmptyCampaign(): void {
    if (!this.auth.isLoggedIn() || this.creatingEmpty()) return;
    const title = this.emptyCampaignTitle().trim() || 'Nouvelle campagne';
    this.showEmptyCampaignModal.set(false);
    this.creatingEmpty.set(true);
    this.actionError.set(null);
    const data = this.buildEmptyCampaignData(this.emptyCampaignTemplate());

    if (!this.connectivity.isOnline()) {
      const local = this.offlineSync.queueCampaignCreate(title, data);
      this.creatingEmpty.set(false);
      this.router.navigate(['/campaigns', local.id]);
      return;
    }

    this.campaigns.create(title, data).subscribe({
      next: (created) => {
        this.creatingEmpty.set(false);
        this.router.navigate(['/campaigns', created.id]);
      },
      error: () => {
        this.actionError.set('Impossible de créer la campagne vide.');
        this.creatingEmpty.set(false);
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
      this.refreshInvites();
    });
  }

  declineInvite(inv: CampaignInvite): void {
    this.friends.declineCampaignInvite(inv.id).subscribe(() => {
      this.refreshInvites();
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

  private buildEmptyCampaignData(
    template: 'blank' | 'oneshot-classic' | 'oneshot-dungeon' | 'oneshot-intrigue',
  ): CampaignData {
    const data = emptyCampaignData();
    if (template === 'blank') return data;

    const sessionId = crypto.randomUUID?.() ?? `s-${Date.now()}`;
    const scheduledAt = new Date(Date.now() + 7 * 86_400_000).toISOString();

    if (template === 'oneshot-classic') {
      return {
        ...data,
        notes: 'Acte 1 — Accroche · Acte 2 — Confrontation · Acte 3 — Twist + boss',
        sessions: [
          {
            id: sessionId,
            title: 'One-shot — 3 actes',
            scheduledAt,
            status: 'planned',
            timeline: [
              { id: 'tl-1', kind: 'note', label: 'Accroche (10 min)' },
              { id: 'tl-2', kind: 'encounter', label: 'Rencontre principale' },
              { id: 'tl-3', kind: 'break', label: 'Pause', durationMin: 10 },
              { id: 'tl-4', kind: 'encounter', label: 'Boss final' },
            ],
          },
        ],
      };
    }

    if (template === 'oneshot-dungeon') {
      return {
        ...data,
        notes: 'Exploration donjon — pièges, salles, boss',
        sessions: [
          {
            id: sessionId,
            title: 'One-shot donjon',
            scheduledAt,
            status: 'planned',
            timeline: [
              { id: 'tl-1', kind: 'note', label: 'Entrée du donjon' },
              { id: 'tl-2', kind: 'encounter', label: 'Salles 1 à 3' },
              { id: 'tl-3', kind: 'encounter', label: 'Boss salle finale' },
            ],
          },
        ],
      };
    }

    return {
      ...data,
      tone: 'mysterious',
      notes: 'Intrigue sociale — indices, PNJ, révélation',
      sessions: [
        {
          id: sessionId,
          title: 'One-shot intrigue',
          scheduledAt,
          status: 'planned',
          timeline: [
            { id: 'tl-1', kind: 'note', label: 'Mise en place des PNJ' },
            { id: 'tl-2', kind: 'handout', label: 'Indice #1' },
            { id: 'tl-3', kind: 'note', label: 'Révélation finale' },
          ],
        },
      ],
    };
  }
}
