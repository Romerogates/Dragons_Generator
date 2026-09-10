import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { GuidePreferencesService } from '@core/services/guide-preferences.service';
import type { GuideAudience } from './guide.types';
import { GUIDE_NAV_GROUPS, GUIDE_QUICK_CARDS, GUIDE_START_STEPS } from './guide-content';
import { GUIDE_TOPICS, guideTopicsByGroup } from './guide-topics';

const FEATURED_TOPIC_IDS = ['demarrage', 'parcours', 'personnage', 'scenario', 'table', 'faq'] as const;

@Component({
  selector: 'app-guide-index',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './guide-index.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class GuideIndexPage implements OnInit {
  private readonly prefs = inject(GuidePreferencesService);

  readonly query = signal('');
  readonly audience = signal<GuideAudience | 'all'>('all');

  readonly groups = GUIDE_NAV_GROUPS;
  readonly quickCards = GUIDE_QUICK_CARDS;
  readonly startSteps = GUIDE_START_STEPS;

  readonly featured = computed(() => {
    const aud = this.audience();
    return GUIDE_TOPICS.filter((t) => {
      if (!(FEATURED_TOPIC_IDS as readonly string[]).includes(t.id)) return false;
      return aud === 'all' || t.audience === 'all' || t.audience === aud;
    });
  });

  readonly sections = computed(() => guideTopicsByGroup(this.audience(), this.query(), 'all'));
  readonly searchEmpty = computed(
    () => this.query().trim().length > 0 && this.sections().length === 0,
  );

  ngOnInit(): void {
    const aud = this.prefs.audience();
    if (aud === 'dm' || aud === 'player') this.audience.set(aud);
  }

  setAudience(a: GuideAudience | 'all'): void {
    this.audience.set(a);
    if (a === 'dm' || a === 'player') this.prefs.setAudience(a);
  }

  isUnread(id: string): boolean {
    return this.prefs.isSectionUnread(id);
  }
}
