import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CampaignCloudService, CampaignActivityItem } from '@core/services/campaign-cloud.service';
import { FriendsService } from '@core/services/friends.service';
import { CharacterCloudService } from '@core/services/character-cloud.service';
import { AuthService } from '@core/services/auth.service';
import { NotificationService } from '@core/services/notification.service';
import { DataService } from '@core/services/data.service';
import { forkJoin, catchError, map, of, Observable, throwError } from 'rxjs';
import { CampaignPdfService, CreaturePrintEntry } from '@core/services/campaign-pdf.service';
import { ProfileAvatarComponent } from '@shared/components/profile-avatar/profile-avatar';
import { Character } from '@core/models/Character/character';
import {
  CampaignData,
  CampaignMember,
  CampaignPregen,
  CampaignSession,
  CampaignSessionStatus,
  CREATURE_ROLE_LABELS,
  PREGEN_STATUS_LABELS,
  createCampaignPregenEntry,
  createEncounterFromCreatures,
  encounterPendingXp,
  encounterTotalXp,
  EncounterGroup,
  FriendUser,
  type CampaignDetail as CampaignDetailModel,
} from '@core/models/Campaign/campaign';
import { ADVENTURE_TONE_LABELS } from '@core/models/Story/story';
import { formatChallengeRating, getCreatureCategoryLabel } from '@core/utils/creature-display.util';
import { StoryBuilderService } from '@core/services/story-builder.service';
import { CampaignPregenGeneratorService } from '@core/services/campaign-pregen-generator.service';
import { firstValueFrom } from 'rxjs';

type Tab = 'overview' | 'creatures' | 'encounters' | 'players' | 'pregens' | 'activity';

@Component({
  selector: 'app-campaign-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ProfileAvatarComponent],
  templateUrl: './campaign-detail.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CampaignDetailPage implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private campaigns = inject(CampaignCloudService);
  private friends = inject(FriendsService);
  private characters = inject(CharacterCloudService);
  private auth = inject(AuthService);
  private notifications = inject(NotificationService);
  private data = inject(DataService);
  private pdf = inject(CampaignPdfService);
  private sanitizer = inject(DomSanitizer);
  private storyBuilder = inject(StoryBuilderService);
  private pregenGenerator = inject(CampaignPregenGeneratorService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly tab = signal<Tab>('overview');
  readonly campaign = signal<CampaignDetailModel | null>(null);
  readonly printing = signal(false);
  readonly friendsList = signal<FriendUser[]>([]);
  readonly myCharacters = signal<{ id: string; name: string }[]>([]);
  readonly dmCharacters = signal<{ id: string; name: string }[]>([]);
  readonly importingPregen = signal(false);
  readonly generatingAutoPregen = signal(false);
  readonly pregenPdfLoadingId = signal<string | null>(null);
  readonly activity = signal<CampaignActivityItem[]>([]);
  readonly activityLoading = signal(false);
  /** Session en mode édition (MJ) — sinon carte lecture. */
  readonly editingSessionId = signal<string | null>(null);

  readonly creatureXpMap = signal<Record<string, number>>({});
  readonly isLoadingPreview = signal(false);
  readonly pdfPreviewUrl = signal<SafeResourceUrl | null>(null);
  private rawBlobUrl: string | null = null;
  private previewCampaignId: string | null = null;
  private sessionSaveTimer: ReturnType<typeof setTimeout> | null = null;

  readonly isLoggedIn = this.auth.isLoggedIn;

  readonly players = computed(() =>
    (this.campaign()?.members ?? []).filter((m) => m.role === 'player'),
  );

  readonly totalXpAwarded = computed(() =>
    (this.campaign()?.members ?? [])
      .filter((m) => m.role === 'player')
      .reduce((s, m) => s + m.xpEarnedInCampaign, 0),
  );

  /** Onglets visibles : créatures / rencontres réservés au MJ. */
  readonly visibleTabs = computed(() => {
    const owner = this.campaign()?.isOwner === true;
    const tabs: { id: Tab; label: string }[] = [
      { id: 'overview', label: 'Résumé' },
      { id: 'activity', label: 'Activité' },
    ];
    if (owner) {
      tabs.push({ id: 'creatures', label: 'Personnages & créatures' });
    }
    tabs.push({ id: 'pregens', label: 'Héros pré-tirés' });
    if (owner) {
      tabs.push({ id: 'encounters', label: 'Rencontres & XP' });
    }
    tabs.push({ id: 'players', label: 'Joueurs' });
    return tabs;
  });

  protected roleLabels = CREATURE_ROLE_LABELS;
  protected toneLabels = ADVENTURE_TONE_LABELS;
  protected pregenStatusLabels = PREGEN_STATUS_LABELS;
  protected formatCr = formatChallengeRating;
  protected categoryLabel = getCreatureCategoryLabel;
  protected encounterTotalXp = encounterTotalXp;
  protected encounterPendingXp = encounterPendingXp;

  ngOnInit(): void {
    if (!this.auth.isLoggedIn()) {
      this.loading.set(false);
      return;
    }

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/campaigns']);
      return;
    }

    this.data.getCreaturesSummary().pipe(catchError(() => of([]))).subscribe((list) => {
      const map: Record<string, number> = {};
      for (const c of list) map[c.id] = c.xp;
      this.creatureXpMap.set(map);
    });

    this.reload(id);
    this.friends.listFriends().subscribe((f) => this.friendsList.set(f));
    this.characters.list().subscribe((chars) => {
      this.myCharacters.set(chars.map((c) => ({ id: c.id, name: c.name })));
      if (this.campaign()?.isOwner) {
        this.dmCharacters.set(chars.map((c) => ({ id: c.id, name: c.name })));
      }
    });
  }

  ngOnDestroy(): void {
    this.flushSessionSave();
    this.revokePreviewUrl();
  }

  reload(id?: string): void {
    const campaignId = id ?? this.campaign()?.id;
    if (!campaignId) return;
    this.loading.set(true);
    this.campaigns.get(campaignId).subscribe({
      next: (c) => {
        this.campaign.set(c);
        this.loading.set(false);
        this.notifications.refresh();
        const t = this.tab();
        if (!c.isOwner && (t === 'creatures' || t === 'encounters')) {
          this.tab.set('overview');
        }
      },
      error: () => {
        this.error.set('Campagne introuvable.');
        this.loading.set(false);
      },
    });
  }

  setTab(t: Tab): void {
    if (!this.campaign()?.isOwner && (t === 'creatures' || t === 'encounters')) {
      this.tab.set('overview');
      return;
    }
    this.tab.set(t);
    if (t === 'creatures') {
      this.loadBestiaryPreview();
    }
    if (t === 'activity') {
      this.loadActivity();
    }
  }

  loadActivity(): void {
    const c = this.campaign();
    if (!c) return;
    this.activityLoading.set(true);
    this.campaigns.listActivity(c.id).subscribe({
      next: (items) => {
        this.activity.set(items);
        this.activityLoading.set(false);
      },
      error: () => {
        this.activity.set([]);
        this.activityLoading.set(false);
      },
    });
  }

  activityLabel(kind: string): string {
    const labels: Record<string, string> = {
      invite_sent: 'Invitation envoyée',
      invite_accepted: 'Invitation acceptée',
      member_joined: 'Joueur rejoint',
      character_proposed: 'Personnage proposé',
      character_approved: 'Personnage approuvé',
      character_rejected: 'Personnage refusé',
      xp_awarded: 'XP attribuée',
      session_scheduled: 'Session planifiée',
      session_updated: 'Session modifiée',
      pregen_assigned: 'Pré-tiré assigné',
    };
    return labels[kind] ?? kind.replace(/_/g, ' ');
  }

  activityIcon(kind: string): string {
    const icons: Record<string, string> = {
      invite_sent: 'fluent-emoji:envelope',
      invite_accepted: 'fluent-emoji:handshake',
      member_joined: 'fluent-emoji:waving-hand',
      character_proposed: 'fluent-emoji:scroll',
      character_approved: 'fluent-emoji:check-mark-button',
      character_rejected: 'fluent-emoji:cross-mark',
      xp_awarded: 'fluent-emoji:sparkles',
      session_scheduled: 'fluent-emoji:calendar',
      session_updated: 'fluent-emoji:spiral-calendar',
      pregen_assigned: 'fluent-emoji:bust-in-silhouette',
    };
    return icons[kind] ?? 'fluent-emoji:memo';
  }

  activityDetail(item: CampaignActivityItem): string | null {
    try {
      const raw = item.payloadJson ? JSON.parse(item.payloadJson) : null;
      if (!raw || typeof raw !== 'object') return null;
      const p = raw as Record<string, unknown>;
      if (typeof p['message'] === 'string' && p['message'].trim()) return p['message'].trim();
      if (typeof p['title'] === 'string' && p['title'].trim()) {
        const loc = typeof p['location'] === 'string' && p['location'] ? ` · ${p['location']}` : '';
        return `${p['title']}${loc}`;
      }
      if (typeof p['campaignTitle'] === 'string') return String(p['campaignTitle']);
      return null;
    } catch {
      return null;
    }
  }

  relativeActivityTime(iso: string): string {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return '';
    const diffSec = Math.round((Date.now() - t) / 1000);
    if (diffSec < 60) return 'à l’instant';
    if (diffSec < 3600) return `il y a ${Math.floor(diffSec / 60)} min`;
    if (diffSec < 86400) return `il y a ${Math.floor(diffSec / 3600)} h`;
    if (diffSec < 86400 * 7) return `il y a ${Math.floor(diffSec / 86400)} j`;
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatSessionDate(iso: string): string {
    return new Date(iso).toLocaleString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  addSession(): void {
    const c = this.campaign();
    if (!c?.isOwner) return;
    this.flushSessionSave();
    const session: CampaignSession = {
      id: crypto.randomUUID?.() ?? `session-${Date.now()}`,
      title: 'Nouvelle session',
      scheduledAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      status: 'planned',
    };
    this.editingSessionId.set(session.id);
    this.saveData({ sessions: [...(c.data.sessions ?? []), session] });
  }

  startEditSession(sessionId: string): void {
    this.flushSessionSave();
    this.editingSessionId.set(sessionId);
  }

  stopEditSession(): void {
    this.flushSessionSave();
    this.editingSessionId.set(null);
  }

  /** Mise à jour locale immédiate + sauvegarde (debounce pour texte). */
  updateSession(sessionId: string, patch: Partial<CampaignSession>, options?: { immediate?: boolean }): void {
    const c = this.campaign();
    if (!c?.isOwner) return;
    const sessions = (c.data.sessions ?? []).map((s) =>
      s.id === sessionId ? { ...s, ...patch } : s,
    );
    this.campaign.update((prev) =>
      prev ? { ...prev, data: { ...prev.data, sessions } } : prev,
    );

    const immediate = options?.immediate === true;
    if (immediate) {
      if (this.sessionSaveTimer) {
        clearTimeout(this.sessionSaveTimer);
        this.sessionSaveTimer = null;
      }
      this.saveData({ sessions });
      return;
    }

    if (this.sessionSaveTimer) clearTimeout(this.sessionSaveTimer);
    this.sessionSaveTimer = setTimeout(() => {
      this.sessionSaveTimer = null;
      const latest = this.campaign();
      if (!latest) return;
      this.saveData({ sessions: latest.data.sessions ?? [] });
    }, 700);
  }

  private flushSessionSave(): void {
    if (!this.sessionSaveTimer) return;
    clearTimeout(this.sessionSaveTimer);
    this.sessionSaveTimer = null;
    const latest = this.campaign();
    if (!latest?.isOwner) return;
    this.saveData({ sessions: latest.data.sessions ?? [] });
  }

  removeSession(sessionId: string): void {
    const c = this.campaign();
    if (!c?.isOwner) return;
    if (!confirm('Supprimer cette session ?')) return;
    this.flushSessionSave();
    if (this.editingSessionId() === sessionId) this.editingSessionId.set(null);
    this.saveData({
      sessions: (c.data.sessions ?? []).filter((s) => s.id !== sessionId),
    });
  }

  sessionStatusLabel(status: CampaignSessionStatus): string {
    const labels: Record<CampaignSessionStatus, string> = {
      planned: 'Planifiée',
      played: 'Jouée',
      cancelled: 'Annulée',
    };
    return labels[status];
  }

  sessionStatusChipClass(status: CampaignSessionStatus): string {
    switch (status) {
      case 'played':
        return 'border-emerald-800/50 text-emerald-300 bg-emerald-950/30';
      case 'cancelled':
        return 'border-red-900/40 text-red-300 bg-red-950/20';
      default:
        return 'border-amber-800/50 text-amber-300 bg-amber-950/30';
    }
  }

  sessionInputValue(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  onSessionDateChange(sessionId: string, value: string): void {
    if (!value) return;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return;
    this.updateSession(sessionId, { scheduledAt: parsed.toISOString() }, { immediate: true });
  }

  upcomingSessions(): CampaignSession[] {
    const sessions = this.campaign()?.data.sessions ?? [];
    return [...sessions]
      .filter((s) => s.status === 'planned')
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }

  sortedSessions(): CampaignSession[] {
    const sessions = this.campaign()?.data.sessions ?? [];
    return [...sessions].sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    );
  }

  openBestiaryFullscreen(): void {
    if (this.rawBlobUrl) window.open(this.rawBlobUrl, '_blank');
  }

  private revokePreviewUrl(): void {
    if (this.rawBlobUrl) {
      URL.revokeObjectURL(this.rawBlobUrl);
      this.rawBlobUrl = null;
    }
    this.pdfPreviewUrl.set(null);
    this.previewCampaignId = null;
  }

  private loadBestiaryPreview(): void {
    const c = this.campaign();
    if (!c?.isOwner || !c.data.creatures.length) {
      this.revokePreviewUrl();
      return;
    }
    if (this.previewCampaignId === c.id && this.pdfPreviewUrl()) return;

    this.isLoadingPreview.set(true);
    this.loadCreatureEntries(c.data).subscribe({
      next: async (entries) => {
        try {
          if (!entries.length) {
            this.revokePreviewUrl();
            return;
          }
          this.revokePreviewUrl();
          const url = await this.pdf.generateCreaturesPdfBlob(entries, c.title, c.data);
          this.rawBlobUrl = url;
          this.previewCampaignId = c.id;
          this.pdfPreviewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
        } catch {
          this.revokePreviewUrl();
        } finally {
          this.isLoadingPreview.set(false);
        }
      },
      error: () => {
        this.revokePreviewUrl();
        this.isLoadingPreview.set(false);
      },
    });
  }

  saveData(patch: Partial<CampaignData>): void {
    const c = this.campaign();
    if (!c) return;
    const data = { ...c.data, ...patch };
    this.persist(c.title, data);
  }

  saveTitle(title: string): void {
    const c = this.campaign();
    if (!c) return;
    this.persist(title, c.data);
  }

  private persist(title: string, data: CampaignData): void {
    const c = this.campaign();
    if (!c) return;
    this.saving.set(true);
    this.campaigns.update(c.id, title, data).subscribe({
      next: () => {
        this.campaign.update((prev) => (prev ? { ...prev, title, data } : prev));
        this.saving.set(false);
        if (this.tab() === 'activity') this.loadActivity();
      },
      error: () => {
        this.error.set('Échec de la sauvegarde.');
        this.saving.set(false);
      },
    });
  }

  generateEncountersFromStory(): void {
    const c = this.campaign();
    if (!c || c.data.creatures.length === 0) return;
    const xpMap = this.creatureXpMap();
    const antagonists = c.data.creatures.filter((x) => x.role === 'antagonist');
    const others = c.data.creatures.filter((x) => x.role !== 'antagonist');
    const groups: EncounterGroup[] = [];
    if (antagonists.length) {
      groups.push(createEncounterFromCreatures('Confrontation principale', antagonists, xpMap));
    }
    if (others.length) {
      groups.push(createEncounterFromCreatures('Rencontres secondaires', others, xpMap));
    }
    this.saveData({ encounters: [...c.data.encounters, ...groups] });
  }

  markDefeated(encounterId: string, creatureIndex: number): void {
    const c = this.campaign();
    if (!c || !c.isOwner) return;
    const encounters = c.data.encounters.map((enc) => {
      if (enc.id !== encounterId) return enc;
      const creatures = enc.creatures.map((cr, i) => {
        if (i !== creatureIndex || cr.defeated >= cr.quantity) return cr;
        return { ...cr, defeated: cr.defeated + 1 };
      });
      return { ...enc, creatures };
    });
    this.saveData({ encounters });
  }

  distributeEncounterXp(encounter: EncounterGroup): void {
    const c = this.campaign();
    if (!c || !c.isOwner || encounter.xpAwarded) return;
    const xpGained = encounterTotalXp(encounter);
    if (xpGained <= 0) return;

    const approved = this.players().filter((p) => p.proposalStatus === 'approved');
    if (approved.length === 0) {
      this.error.set('Aucun joueur avec un personnage approuvé.');
      return;
    }

    const share = Math.floor(xpGained / approved.length);
    if (share <= 0) return;

    let completed = 0;
    for (const player of approved) {
      this.campaigns.awardXp(c.id, player.id, share).subscribe({
        next: () => {
          completed++;
          if (completed === approved.length) {
            const encounters = c.data.encounters.map((e) =>
              e.id === encounter.id ? { ...e, xpAwarded: true } : e,
            );
            this.saveData({ encounters });
            this.reload();
          }
        },
      });
    }
  }

  inviteFriend(userId: string): void {
    const c = this.campaign();
    if (!c) return;
    this.campaigns.invitePlayer(c.id, userId).subscribe({
      next: () => {
        this.error.set(null);
        if (this.tab() === 'activity') this.loadActivity();
      },
      error: (err) => {
        const msg = err?.error?.errors?.[0]?.reason ?? 'Invitation impossible.';
        this.error.set(msg);
      },
    });
  }

  proposeCharacter(characterId: string): void {
    const c = this.campaign();
    if (!c) return;
    this.campaigns.proposeCharacter(c.id, characterId).subscribe({
      next: () => this.reload(),
      error: () => this.error.set('Impossible de proposer ce personnage.'),
    });
  }

  approveMember(member: CampaignMember): void {
    const c = this.campaign();
    if (!c) return;
    this.campaigns.approveProposal(c.id, member.id).subscribe(() => this.reload());
  }

  rejectMember(member: CampaignMember): void {
    const c = this.campaign();
    if (!c) return;
    this.campaigns.rejectProposal(c.id, member.id).subscribe(() => this.reload());
  }

  isMyPlayerMember(): CampaignMember | undefined {
    const userId = this.auth.user()?.id;
    if (!userId) return undefined;
    return this.players().find((p) => p.userId === userId);
  }

  editScenario(): void {
    const c = this.campaign();
    if (!c?.isOwner) return;
    this.storyBuilder.loadCampaignIntoBuilder(c, 'full');
    this.router.navigate(['/story/create']);
  }

  addCreaturesOnly(): void {
    const c = this.campaign();
    if (!c?.isOwner) return;
    this.storyBuilder.loadCampaignIntoBuilder(c, 'creatures-only');
    this.router.navigate(['/story/create']);
  }

  async generateAutoPregen(): Promise<void> {
    const c = this.campaign();
    if (!c?.isOwner || this.generatingAutoPregen()) return;

    this.generatingAutoPregen.set(true);
    this.error.set(null);
    try {
      const generated = await this.pregenGenerator.generateOriginalPlayable(c, true);
      const entry = createCampaignPregenEntry(
        generated.characterId,
        generated.characterName,
        generated.speciesLabel,
        generated.classLabel,
      );
      entry.publicHook = generated.publicHook;
      entry.dmBackstory = generated.dmBackstory;
      entry.status = 'ready';
      this.saveData({
        pregenCharacters: [...(c.data.pregenCharacters ?? []), entry],
      });
    } catch {
      this.error.set('Génération impossible. Réessayez dans quelques instants.');
    } finally {
      this.generatingAutoPregen.set(false);
    }
  }

  async importPregenFromCharacter(characterId: string): Promise<void> {
    const c = this.campaign();
    if (!c?.isOwner || this.importingPregen()) return;
    this.importingPregen.set(true);
    this.error.set(null);
    try {
      const generated = await this.pregenGenerator.generatePlayableDuplicate(c, characterId, false);
      const entry = createCampaignPregenEntry(
        generated.characterId,
        generated.characterName,
        generated.speciesLabel,
        generated.classLabel,
      );
      entry.publicHook = generated.publicHook;
      entry.dmBackstory = generated.dmBackstory;
      entry.status = 'ready';
      this.saveData({
        pregenCharacters: [...(c.data.pregenCharacters ?? []), entry],
      });
    } catch {
      this.error.set('Impossible d\'importer ce personnage.');
    } finally {
      this.importingPregen.set(false);
    }
  }

  updatePregen(pregenId: string, patch: Partial<CampaignPregen>): void {
    const c = this.campaign();
    if (!c) return;
    const pregens = (c.data.pregenCharacters ?? []).map((p) =>
      p.id === pregenId ? { ...p, ...patch } : p,
    );
    this.saveData({ pregenCharacters: pregens });
  }

  markPregenReady(pregenId: string): void {
    this.updatePregen(pregenId, { status: 'ready' });
  }

  removePregen(pregenId: string): void {
    const c = this.campaign();
    if (!c) return;
    this.saveData({
      pregenCharacters: (c.data.pregenCharacters ?? []).filter((p) => p.id !== pregenId),
    });
  }

  assignPregen(pregen: CampaignPregen, member: CampaignMember): void {
    const c = this.campaign();
    if (!c?.isOwner) return;
    this.campaigns.assignPregen(c.id, pregen.id, member.userId, member.displayName).subscribe({
      next: () => this.reload(),
      error: () => this.error.set('Assignation impossible.'),
    });
  }

  claimPregen(pregenId: string): void {
    const c = this.campaign();
    if (!c) return;
    this.campaigns.claimPregen(c.id, pregenId).subscribe({
      next: () => {
        this.error.set(null);
        this.reload();
        this.router.navigate(['/characters']);
      },
      error: () => this.error.set('Impossible de revendiquer ce personnage.'),
    });
  }

  printPregenHandout(pregen: CampaignPregen): void {
    const c = this.campaign();
    if (!c) return;
    const meta = [pregen.speciesLabel, pregen.classLabel].filter(Boolean).join(' · ');
    void this.pdf.downloadPregenHandout(c.title, pregen.characterName, pregen.publicHook, meta);
  }

  printPregenFullSheet(pregen: CampaignPregen): void {
    if (this.pregenPdfLoadingId()) return;
    this.pregenPdfLoadingId.set(pregen.id);
    this.error.set(null);
    this.loadPregenCharacter(pregen).subscribe({
      next: (character) => {
        void this.pdf.downloadPlayerFullSheet(character).finally(() => {
          this.pregenPdfLoadingId.set(null);
        });
      },
      error: () => {
        this.pregenPdfLoadingId.set(null);
        this.error.set('Impossible de générer la fiche PDF.');
      },
    });
  }

  viewPregenCharacter(pregen: CampaignPregen): void {
    this.pregenPdfLoadingId.set(pregen.id);
    this.error.set(null);
    this.loadPregenCharacter(pregen).subscribe({
      next: (character) => {
        localStorage.setItem('dragons-current-character', JSON.stringify(character));
        this.pregenPdfLoadingId.set(null);
        this.router.navigate(['/character-sheet']);
      },
      error: () => {
        this.pregenPdfLoadingId.set(null);
        this.error.set('Impossible d\'ouvrir la fiche.');
      },
    });
  }

  private loadPregenCharacter(pregen: CampaignPregen): Observable<Character> {
    const c = this.campaign();
    if (!c) return throwError(() => new Error('Campagne introuvable'));

    const mapResponse = (res: { data: unknown; name?: string }) => {
      const character = { ...(res.data as object) } as Character;
      if (res.name) character.name = res.name;
      return character;
    };

    if (c.isOwner) {
      return this.characters.get(pregen.characterId).pipe(map((res) => mapResponse(res)));
    }

    return this.campaigns.getPregenCharacter(c.id, pregen.id).pipe(map((res) => mapResponse(res)));
  }

  myAssignedPregens(): CampaignPregen[] {
    const userId = this.auth.user()?.id;
    if (!userId) return [];
    return (this.campaign()?.data.pregenCharacters ?? []).filter(
      (p) => p.assignedUserId === userId && p.status === 'assigned',
    );
  }

  printBestiary(): void {
    this.runPrint(async (entries) => {
      const c = this.campaign()!;
      await this.pdf.downloadCreaturesCompilation(entries, c.title, c.data);
    });
  }

  printPackMj(): void {
    this.runPrint(async (entries) => {
      const c = this.campaign()!;
      const summaries = await this.loadPlayerSummaries();
      await this.pdf.downloadCampaignPack(c.title, c.data, entries, summaries);
    });
  }

  printPlayerSummariesPdf(): void {
    void this.runPrintPlayerSummariesOnly();
  }

  printAllPlayerSheets(): void {
    void this.runPrintPlayerFullSheets();
  }

  private runPrint(action: (entries: CreaturePrintEntry[]) => Promise<void>): void {
    const c = this.campaign();
    if (!c?.data.creatures.length) {
      this.error.set('Aucune créature à imprimer.');
      return;
    }
    this.printing.set(true);
    this.error.set(null);
    this.loadCreatureEntries(c.data).subscribe({
      next: (entries) => {
        action(entries)
          .catch(() => this.error.set('Échec de la génération PDF.'))
          .finally(() => this.printing.set(false));
      },
      error: () => {
        this.error.set('Impossible de charger les fiches créatures.');
        this.printing.set(false);
      },
    });
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

  private async loadPlayerSummaries() {
    const approved = this.players().filter(
      (p) => p.proposalStatus === 'approved' && p.approvedCharacterId,
    );
    const summaries = await Promise.all(
      approved.map(
        (p) =>
          new Promise<ReturnType<CampaignPdfService['buildPlayerGmSummary']> | null>((resolve) => {
            this.characters.get(p.approvedCharacterId!).subscribe({
              next: (res) => resolve(this.pdf.buildPlayerGmSummary(res.data as Character)),
              error: () => resolve(null),
            });
          }),
      ),
    );
    return summaries.filter((s): s is NonNullable<typeof s> => s !== null);
  }

  private async runPrintPlayerSummariesOnly(): Promise<void> {
    this.printing.set(true);
    try {
      const summaries = await this.loadPlayerSummaries();
      if (!summaries.length) {
        this.error.set('Aucun joueur avec personnage approuvé.');
        return;
      }
      await this.pdf.downloadPlayerSummaries(this.campaign()?.title ?? 'Campagne', summaries);
    } catch {
      this.error.set('Échec de la génération PDF.');
    } finally {
      this.printing.set(false);
    }
  }

  private async runPrintPlayerFullSheets(): Promise<void> {
    const approved = this.players().filter(
      (p) => p.proposalStatus === 'approved' && p.approvedCharacterId,
    );
    if (!approved.length) {
      this.error.set('Aucun joueur avec personnage approuvé.');
      return;
    }
    this.printing.set(true);
    try {
      for (const p of approved) {
        await new Promise<void>((resolve, reject) => {
          this.characters.get(p.approvedCharacterId!).subscribe({
            next: async (res) => {
              try {
                await this.pdf.downloadPlayerFullSheet(res.data as Character);
                resolve();
              } catch {
                reject();
              }
            },
            error: () => reject(),
          });
        });
      }
    } catch {
      this.error.set('Échec lors de la génération des fiches joueurs.');
    } finally {
      this.printing.set(false);
    }
  }
}
