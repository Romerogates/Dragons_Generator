import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
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
import { ProfileAvatarComponent } from '@shared/components/profile-avatar/profile-avatar';

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
  imports: [CommonModule, RouterLink, ProfileAvatarComponent],
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
        "Un assistant pas à pas pour forger votre héros, de l'espèce à l'équipement.",
      icon: 'fluent-emoji:man-mage',
    },
    {
      title: 'Campagnes & table',
      description:
        'Scénarios, invitations, sessions live et combats — le MJ et les joueurs sur la même table.',
      icon: 'fluent-emoji:world-map',
    },
    {
      title: 'Guide communautaire',
      description:
        'Sommaire type forum : fiches, commentaires et likes pour progresser ensemble.',
      icon: 'fluent-emoji:books',
    },
    {
      title: 'Grimoire d’Eana',
      description:
        'Espèces, sorts, bestiaire et règles à portée de main, synchronisés sur votre compte.',
      icon: 'fluent-emoji:scroll',
    },
  ];

  readonly grimoireLinks: { label: string; path: string; icon: string; hover: string }[] = [
    { label: 'Espèces', path: '/species', icon: 'fluent-emoji:dna', hover: 'amber' },
    { label: 'Classes', path: '/classes', icon: 'fluent-emoji:crossed-swords', hover: 'amber' },
    {
      label: 'Civilisations',
      path: '/civilisations',
      icon: 'fluent-emoji:japanese-castle',
      hover: 'amber',
    },
    { label: 'Sorts', path: '/spells', icon: 'fluent-emoji:magic-wand', hover: 'amber' },
    { label: 'Bestiaire', path: '/creatures', icon: 'fluent-emoji:dragon', hover: 'rose' },
    { label: 'Équipements', path: '/equipments', icon: 'fluent-emoji:shield', hover: 'amber' },
    { label: 'Compétences', path: '/skills', icon: 'fluent-emoji:bookmark-tabs', hover: 'sky' },
    { label: 'Dons', path: '/feats', icon: 'fluent-emoji:trophy', hover: 'amber' },
    { label: 'Historiques', path: '/backgrounds', icon: 'fluent-emoji:scroll', hover: 'teal' },
    { label: 'Combat', path: '/combat-actions', icon: 'fluent-emoji:collision', hover: 'rose' },
    { label: 'Divinités', path: '/deities', icon: 'fluent-emoji:glowing-star', hover: 'violet' },
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

  /** Hide "campagne récente" when it's already covered by the next-session card. */
  showRecentCampaign(s: HomeSummary): boolean {
    if (!s.recentCampaign) return false;
    if (s.nextSession && s.recentCampaign.id === s.nextSession.campaignId) return false;
    return true;
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

  hoverBorder(kind: string): string {
    switch (kind) {
      case 'sky':
        return 'hover:border-sky-500/50';
      case 'rose':
        return 'hover:border-rose-500/50';
      case 'violet':
        return 'hover:border-violet-500/50';
      case 'teal':
        return 'hover:border-teal-500/50';
      default:
        return 'hover:border-amber-500/50';
    }
  }

  hoverText(kind: string): string {
    switch (kind) {
      case 'sky':
        return 'group-hover:text-sky-500';
      case 'rose':
        return 'group-hover:text-rose-400';
      case 'violet':
        return 'group-hover:text-violet-400';
      case 'teal':
        return 'group-hover:text-teal-400';
      default:
        return 'group-hover:text-amber-500';
    }
  }

  scrollToStats(): void {
    document.getElementById('stats-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
