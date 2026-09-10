import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';
import { GuideCommentsService, type GuideComment } from '@core/services/guide-comments.service';
import { GuidePreferencesService } from '@core/services/guide-preferences.service';
import { GUIDE_TOPICS, getGuideTopic, type GuideTopic } from './guide-topics';
import { GUIDE_NAV_GROUPS, GUIDE_QUICK_CARDS } from './guide-content';
import type { GuideAudience } from './guide.types';

@Component({
  selector: 'app-guide-topic',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './guide-topic.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class GuideTopicPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly commentsApi = inject(GuideCommentsService);
  private readonly prefs = inject(GuidePreferencesService);
  private readonly auth = inject(AuthService);

  readonly topicId = signal('');
  readonly topic = computed(() => getGuideTopic(this.topicId()));
  readonly comments = signal<GuideComment[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly draft = signal('');
  readonly replyTo = signal<string | null>(null);
  readonly posting = signal(false);
  readonly navQuery = signal('');
  readonly audience = signal<GuideAudience | 'all'>('all');

  readonly groups = GUIDE_NAV_GROUPS;
  readonly quickCards = GUIDE_QUICK_CARDS;
  readonly allTopics = GUIDE_TOPICS;

  readonly sidebarTopics = computed(() => {
    const q = this.navQuery().trim().toLowerCase();
    const aud = this.audience();
    return this.allTopics.filter((t) => {
      if (aud !== 'all' && t.audience !== 'all' && t.audience !== aud) return false;
      if (!q) return true;
      return t.title.toLowerCase().includes(q) || t.summary.toLowerCase().includes(q);
    });
  });

  readonly related = computed((): GuideTopic[] => {
    const t = this.topic();
    if (!t) return [];
    return this.allTopics
      .filter((x) => x.id !== t.id && (x.groupId === t.groupId || x.audience === t.audience))
      .slice(0, 4);
  });

  readonly roots = computed(() =>
    this.comments()
      .filter((c) => !c.parentId)
      .slice()
      .sort((a, b) => b.likeCount - a.likeCount || +new Date(b.createdAt) - +new Date(a.createdAt)),
  );

  readonly repliesOf = computed(() => {
    const map = new Map<string, GuideComment[]>();
    for (const c of this.comments()) {
      if (!c.parentId) continue;
      const list = map.get(c.parentId) ?? [];
      list.push(c);
      map.set(c.parentId, list);
    }
    return map;
  });

  readonly meId = computed(() => this.auth.user()?.id ?? null);

  ngOnInit(): void {
    const aud = this.prefs.audience();
    if (aud === 'dm' || aud === 'player') this.audience.set(aud);
    this.route.paramMap.subscribe((p) => {
      const id = p.get('topicId') ?? '';
      this.topicId.set(id);
      if (id) this.prefs.markSectionRead(id);
      this.reload();
    });
  }

  isUnread(id: string): boolean {
    return this.prefs.isSectionUnread(id);
  }

  setAudience(a: GuideAudience | 'all'): void {
    this.audience.set(a);
    if (a === 'dm' || a === 'player') this.prefs.setAudience(a);
  }

  reload(): void {
    const id = this.topicId();
    if (!id) return;
    this.loading.set(true);
    this.error.set(null);
    this.commentsApi.listComments(id).subscribe({
      next: (list) => {
        this.comments.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger les commentaires.');
        this.loading.set(false);
      },
    });
  }

  submit(): void {
    const body = this.draft().trim();
    const id = this.topicId();
    if (!body || !id || this.posting()) return;
    this.posting.set(true);
    this.commentsApi.createComment(id, body, this.replyTo()).subscribe({
      next: () => {
        this.draft.set('');
        this.replyTo.set(null);
        this.posting.set(false);
        this.reload();
      },
      error: () => {
        this.posting.set(false);
        this.error.set('Envoi impossible.');
      },
    });
  }

  toggleLike(c: GuideComment): void {
    this.commentsApi.toggleLike(c.id).subscribe({
      next: (updated) => {
        this.comments.update((list) => list.map((x) => (x.id === updated.id ? updated : x)));
      },
    });
  }

  remove(c: GuideComment): void {
    if (!confirm('Supprimer ce commentaire ?')) return;
    this.commentsApi.deleteComment(c.id).subscribe({ next: () => this.reload() });
  }

  startReply(id: string): void {
    this.replyTo.set(id);
  }

  cancelReply(): void {
    this.replyTo.set(null);
  }

  formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleString('fr-FR', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }
}
