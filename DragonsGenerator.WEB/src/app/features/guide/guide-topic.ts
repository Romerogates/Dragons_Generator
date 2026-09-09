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
import { getGuideTopic } from './guide-topics';

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

  readonly roots = computed(() => this.comments().filter((c) => !c.parentId));
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
    this.route.paramMap.subscribe((p) => {
      const id = p.get('topicId') ?? '';
      this.topicId.set(id);
      if (id) this.prefs.markSectionRead(id);
      this.reload();
    });
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
        this.comments.update((list) =>
          list
            .map((x) => (x.id === updated.id ? updated : x))
            .sort((a, b) => b.likeCount - a.likeCount || +new Date(b.createdAt) - +new Date(a.createdAt)),
        );
      },
    });
  }

  remove(c: GuideComment): void {
    if (!confirm('Supprimer ce commentaire ?')) return;
    this.commentsApi.deleteComment(c.id).subscribe({
      next: () => this.reload(),
    });
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
