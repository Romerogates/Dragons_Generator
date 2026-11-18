import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { CharacterCloudService } from '@core/services/character-cloud.service';
import { HomeSummary, HomeSummaryService } from '@core/services/home-summary.service';
import { GuidePreferencesService } from '@core/services/guide-preferences.service';
import { CODEX_NAV_LINKS } from '@core/config/codex-nav';
import { PatchNotesList } from '@shared/components/patch-notes-list/patch-notes-list';
import {
  homeHeroCtas,
  readGuestAudience,
  writeGuestAudience,
  type HomeHeroCta,
} from '@core/utils/home-hero-cta.util';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, PatchNotesList],
  templateUrl: './home.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class Home implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly cloud = inject(CharacterCloudService);
  private readonly homeSummary = inject(HomeSummaryService);
  private readonly guidePrefs = inject(GuidePreferencesService);
  private readonly router = inject(Router);

  readonly guideNewsCount = this.guidePrefs.unreadNewsCount;

  readonly isLoggedIn = this.auth.isLoggedIn;
  readonly user = this.auth.user;
  readonly savedCharactersCount = signal(0);
  readonly summary = signal<HomeSummary | null>(null);
  readonly summaryLoading = signal(false);
  readonly summaryError = signal(false);
  readonly showRoleOnboarding = signal(false);
  /** Après choix de rôle : CTAs adaptés (pas encore fermé). */
  readonly roleOnboardingChoice = signal<'dm' | 'player' | null>(null);
  /** Visiteur non connecté : MJ / joueur mémorisé en local. */
  readonly guestAudience = signal<'dm' | 'player' | null>(readGuestAudience());

  readonly effectiveAudience = computed(() => {
    if (this.isLoggedIn()) {
      const overlay = this.roleOnboardingChoice();
      if (overlay) return overlay;
      return this.guidePrefs.audience();
    }
    return this.guestAudience() ?? 'all';
  });

  readonly heroCtas = computed(() =>
    homeHeroCtas({ loggedIn: this.isLoggedIn(), audience: this.effectiveAudience() }),
  );

  readonly showGuestRolePicker = computed(
    () => !this.isLoggedIn() && this.guestAudience() == null,
  );

  readonly hasPulse = computed(() => {
    const s = this.summary();
    if (!s) return false;
    return (
      s.unreadChatCount > 0 ||
      s.pendingFriendRequests > 0 ||
      s.pendingCampaignInvites > 0 ||
      !!s.nextSession ||
      !!s.liveTable ||
      this.guideNewsCount() > 0
    );
  });

  readonly journey = [
    {
      kicker: '01',
      title: 'Forgez votre légende',
      body: 'Espèce, classe, équipement, magie — un wizard jusqu’à la fiche PDF, synchronisée sur votre compte.',
      cta: 'Créer un héros',
      path: '/create',
      tone: 'amber',
      icon: 'fluent-emoji:sparkles',
    },
    {
      kicker: '02',
      title: 'Réunissez la table',
      body: 'Campagnes, invitations, documents et sessions live. MJ et joueurs sur le même fil.',
      cta: 'Voir les campagnes',
      path: '/campaigns',
      tone: 'violet',
      icon: 'fluent-emoji:world-map',
    },
    {
      kicker: '03',
      title: 'Maîtrisez le jeu',
      body: 'Le guide explique chaque outil, avec des liens directs et des discussions en widgets.',
      cta: 'Ouvrir le guide',
      path: '/guide',
      tone: 'emerald',
      icon: 'fluent-emoji:books',
    },
  ] as const;

  readonly grimoireLinks: { label: string; path: string; icon: string }[] = CODEX_NAV_LINKS.map(
    (l) => ({ label: l.label, path: l.path, icon: l.icon }),
  );

  ngOnInit(): void {
    this.refreshHeroStats();
    this.loadSummary();
    void this.guidePrefs.load().then(() => this.maybeShowRoleOnboarding());
  }

  chooseRole(role: 'dm' | 'player'): void {
    writeGuestAudience(role);
    this.guidePrefs.setAudience(role);
    this.roleOnboardingChoice.set(role);
  }

  pickGuestRole(role: 'dm' | 'player'): void {
    writeGuestAudience(role);
    this.guestAudience.set(role);
  }

  heroCtaClass(cta: HomeHeroCta): string {
    if (cta.tone === 'violet') {
      return 'flex-1 min-h-13 px-7 py-4 rounded-2xl text-sm font-black uppercase tracking-widest bg-violet-600 text-white shadow-[0_12px_40px_rgba(124,58,237,0.25)] hover:bg-violet-500 hover:scale-[1.02] active:scale-[0.99] transition-all flex items-center justify-center gap-2';
    }
    if (cta.tone === 'amber') {
      return 'flex-1 min-h-13 px-7 py-4 rounded-2xl text-sm font-black uppercase tracking-widest bg-amber-500 text-slate-950 shadow-[0_12px_40px_rgba(245,158,11,0.25)] hover:bg-amber-400 hover:scale-[1.02] active:scale-[0.99] transition-all flex items-center justify-center gap-2';
    }
    return 'flex-1 min-h-13 px-7 py-4 rounded-2xl text-sm font-black uppercase tracking-widest bg-white/5 text-violet-100 border border-violet-400/30 backdrop-blur-sm hover:bg-violet-950/40 hover:border-violet-400/50 hover:scale-[1.02] transition-all flex items-center justify-center gap-2';
  }

  finishRoleOnboarding(path?: string): void {
    this.showRoleOnboarding.set(false);
    this.roleOnboardingChoice.set(null);
    if (path) void this.router.navigateByUrl(path);
  }

  skipRoleOnboarding(): void {
    writeGuestAudience('all');
    this.guidePrefs.setAudience('all');
    this.showRoleOnboarding.set(false);
    this.roleOnboardingChoice.set(null);
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

  retrySummary(): void {
    this.loadSummary();
  }

  private maybeShowRoleOnboarding(): void {
    this.showRoleOnboarding.set(this.auth.isLoggedIn() && this.guidePrefs.needsRoleOnboarding());
  }

  private loadSummary(): void {
    if (!this.auth.isLoggedIn()) {
      this.summary.set(null);
      this.summaryError.set(false);
      return;
    }
    this.summaryLoading.set(true);
    this.summaryError.set(false);
    this.homeSummary.getSummary().subscribe({
      next: (s) => {
        this.summary.set(s);
        if (s) this.savedCharactersCount.set(s.savedCharactersCount);
        this.summaryLoading.set(false);
      },
      error: () => {
        this.summaryLoading.set(false);
        this.summaryError.set(true);
      },
    });
  }

  journeyLink(step: { path: string }): string {
    return step.path;
  }

  journeyQueryParams(_step: { path: string }): Record<string, string> | undefined {
    return undefined;
  }

  scrollToJourney(): void {
    document.getElementById('journey')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private refreshHeroStats(): void {
    if (this.auth.isLoggedIn()) {
      this.cloud.list().subscribe({
        next: (list) => {
          if (!this.summary()) this.savedCharactersCount.set(list.length);
        },
        error: () => this.savedCharactersCount.set(0),
      });
      return;
    }
    this.savedCharactersCount.set(0);
  }
}
