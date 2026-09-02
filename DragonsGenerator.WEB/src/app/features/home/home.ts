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

interface StatItem {
  value: string;
  label: string;
}

interface FeatureItem {
  title: string;
  description: string;
  icon: string;
}

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

  readonly guideNewsCount = this.guidePrefs.unreadCount;

  readonly isLoggedIn = this.auth.isLoggedIn;
  readonly user = this.auth.user;
  readonly savedCharactersCount = signal(0);
  readonly summary = signal<HomeSummary | null>(null);
  readonly summaryLoading = signal(false);
  readonly showRoleOnboarding = signal(false);

  readonly resumeLink = computed((): string[] => {
    const s = this.summary();
    if (s?.nextSession) return ['/campaigns', s.nextSession.campaignId];
    if (s?.recentCampaign) return ['/campaigns', s.recentCampaign.id];
    return ['/characters'];
  });

  readonly resumeLabel = computed(() => {
    const s = this.summary();
    if (s?.nextSession) return 'Reprendre la session';
    if (s?.recentCampaign) return 'Reprendre la campagne';
    return 'Mes héros';
  });

  readonly stats: StatItem[] = [
    { value: '9', label: 'Peuples' },
    { value: '13', label: 'Classes' },
    { value: '18', label: 'Civilisations' },
    { value: '∞', label: 'Aventures' },
  ];

  readonly features: FeatureItem[] = [
    {
      title: 'Création guidée',
      description:
        "Un assistant pas à pas pour forger votre héros, de l'espèce à l'équipement final.",
      icon: 'fluent-emoji:man-mage',
    },
    {
      title: 'Campagnes & scénarios',
      description: 'Créez des aventures, invitez des joueurs et gérez votre table en ligne.',
      icon: 'fluent-emoji:world-map',
    },
    {
      title: 'Grimoire de règles',
      description:
        "Espèces, sorts, équipement et bestiaire d'Eana à portée de main pendant la séance.",
      icon: 'fluent-emoji:books',
    },
  ];

  readonly grimoireLinks: { label: string; path: string; icon: string }[] = [
    { label: 'Espèces', path: '/species', icon: 'fluent-emoji:dna' },
    { label: 'Classes', path: '/classes', icon: 'fluent-emoji:crossed-swords' },
    { label: 'Sorts', path: '/spells', icon: 'fluent-emoji:magic-wand' },
    { label: 'Bestiaire', path: '/creatures', icon: 'fluent-emoji:dragon' },
    { label: 'Équipements', path: '/equipments', icon: 'fluent-emoji:shield' },
    { label: 'Historiques', path: '/backgrounds', icon: 'fluent-emoji:scroll' },
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

  hasTableReminders(s: HomeSummary): boolean {
    return (
      s.unreadChatCount > 0 ||
      s.pendingFriendRequests > 0 ||
      s.pendingCampaignInvites > 0 ||
      !!s.nextSession ||
      !!s.recentCampaign
    );
  }

  private maybeShowRoleOnboarding(): void {
    this.showRoleOnboarding.set(
      this.auth.isLoggedIn() && this.guidePrefs.needsRoleOnboarding(),
    );
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
      error: () => {
        this.summaryLoading.set(false);
      },
    });
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
