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

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
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
  readonly showRoleOnboarding = signal(false);

  readonly hasPulse = computed(() => {
    const s = this.summary();
    if (!s) return false;
    return (
      s.unreadChatCount > 0 ||
      s.pendingFriendRequests > 0 ||
      s.pendingCampaignInvites > 0 ||
      !!s.nextSession ||
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

  readonly grimoireLinks: { label: string; path: string; icon: string }[] = [
    { label: 'Espèces', path: '/species', icon: 'fluent-emoji:dna' },
    { label: 'Classes', path: '/classes', icon: 'fluent-emoji:crossed-swords' },
    { label: 'Civilisations', path: '/civilisations', icon: 'fluent-emoji:japanese-castle' },
    { label: 'Sorts', path: '/spells', icon: 'fluent-emoji:magic-wand' },
    { label: 'Bestiaire', path: '/creatures', icon: 'fluent-emoji:dragon' },
    { label: 'Équipements', path: '/equipments', icon: 'fluent-emoji:shield' },
    { label: 'Compétences', path: '/skills', icon: 'fluent-emoji:bookmark-tabs' },
    { label: 'Dons', path: '/feats', icon: 'fluent-emoji:trophy' },
    { label: 'Historiques', path: '/backgrounds', icon: 'fluent-emoji:scroll' },
    { label: 'Combat', path: '/combat-actions', icon: 'fluent-emoji:collision' },
    { label: 'Divinités', path: '/deities', icon: 'fluent-emoji:glowing-star' },
  ];

  ngOnInit(): void {
    this.refreshHeroStats();
    this.loadSummary();
    void this.guidePrefs.load().then(() => this.maybeShowRoleOnboarding());
  }

  chooseRole(role: 'dm' | 'player'): void {
    this.guidePrefs.setAudience(role);
    this.showRoleOnboarding.set(false);
    void this.router.navigate(['/guide']);
  }

  skipRoleOnboarding(): void {
    this.guidePrefs.setAudience('all');
    this.showRoleOnboarding.set(false);
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

  private maybeShowRoleOnboarding(): void {
    this.showRoleOnboarding.set(this.auth.isLoggedIn() && this.guidePrefs.needsRoleOnboarding());
  }

  private loadSummary(): void {
    if (!this.auth.isLoggedIn()) {
      this.summary.set(null);
      return;
    }
    this.summaryLoading.set(true);
    this.homeSummary.getSummary().subscribe({
      next: (s) => {
        this.summary.set(s);
        if (s) this.savedCharactersCount.set(s.savedCharactersCount);
        this.summaryLoading.set(false);
      },
      error: () => this.summaryLoading.set(false),
    });
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
