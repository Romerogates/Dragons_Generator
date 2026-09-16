import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { GuidePreferencesService } from '@core/services/guide-preferences.service';
import type { GuideAudience } from './guide.types';
import { GUIDE_QUICK_CARDS } from './guide-content';
import { GUIDE_TOPICS, guideTopicsByGroup } from './guide-topics';
import { GuideSidebar } from './guide-sidebar/guide-sidebar';
import { GUIDE_CLASS_PLAYBOOKS } from './guide-class-playbooks';

/** Chapitres secondaires du hub (les tutos débutants sont en avant). */
const FEATURED_TOPIC_IDS = ['parcours', 'personnage', 'scenario', 'table', 'initiative', 'faq'] as const;

@Component({
  selector: 'app-guide-index',
  standalone: true,
  imports: [RouterLink, FormsModule, GuideSidebar],
  templateUrl: './guide-index.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuideIndexPage implements OnInit {
  private readonly prefs = inject(GuidePreferencesService);

  readonly query = signal('');
  readonly audience = signal<GuideAudience | 'all'>('all');
  readonly quickCards = GUIDE_QUICK_CARDS;
  readonly classPlaybooks = GUIDE_CLASS_PLAYBOOKS;

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

  constructor() {
    effect(() => {
      const a = this.audience();
      if (a === 'dm' || a === 'player') this.prefs.setAudience(a);
    });
  }

  ngOnInit(): void {
    const aud = this.prefs.audience();
    if (aud === 'dm' || aud === 'player') this.audience.set(aud);
  }
}
