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
import { GuideCommentsService, type GuideTopicStats } from '@core/services/guide-comments.service';
import { GuidePreferencesService } from '@core/services/guide-preferences.service';
import type { GuideAudience } from './guide.types';
import { GUIDE_NAV_GROUPS, GUIDE_QUICK_CARDS } from './guide-content';
import { guideTopicsByGroup } from './guide-topics';

@Component({
  selector: 'app-guide-index',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './guide-index.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class GuideIndexPage implements OnInit {
  private readonly commentsApi = inject(GuideCommentsService);
  private readonly prefs = inject(GuidePreferencesService);

  readonly query = signal('');
  readonly audience = signal<GuideAudience | 'all'>('all');
  readonly groupFilter = signal<string | 'all'>('all');
  readonly stats = signal<Record<string, GuideTopicStats>>({});

  readonly groups = GUIDE_NAV_GROUPS;
  readonly quickCards = GUIDE_QUICK_CARDS;

  readonly sections = computed(() =>
    guideTopicsByGroup(this.audience(), this.query(), this.groupFilter()),
  );

  ngOnInit(): void {
    const aud = this.prefs.audience();
    if (aud === 'dm' || aud === 'player') this.audience.set(aud);
    this.commentsApi.listStats().subscribe({
      next: (list) => {
        const map: Record<string, GuideTopicStats> = {};
        for (const s of list) map[s.topicId] = s;
        this.stats.set(map);
      },
      error: () => this.stats.set({}),
    });
  }

  setAudience(a: GuideAudience | 'all'): void {
    this.audience.set(a);
    if (a === 'dm' || a === 'player') this.prefs.setAudience(a);
  }

  relativeTime(iso: string | null | undefined): string {
    if (!iso) return '';
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return '';
    const diff = Date.now() - t;
    const mins = Math.floor(diff / 60_000);
    if (mins < 60) return `Il y a ${Math.max(1, mins)} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 48) return `Il y a ${hours} h`;
    const days = Math.floor(hours / 24);
    return `Il y a ${days} j`;
  }
}
