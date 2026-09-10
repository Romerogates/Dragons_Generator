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
import {
  GuideCommentsService,
  type GuideComment,
  type GuideCommentWidgetSize,
} from '@core/services/guide-comments.service';
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
  readonly editingWidgetId = signal<string | null>(null);
  readonly newWidgetSize = signal<GuideCommentWidgetSize>('half');

  readonly widgetSizes: { id: GuideCommentWidgetSize; label: string }[] = [
    { id: 'third', label: '1/3' },
    { id: 'half', label: '1/2' },
    { id: 'full', label: '1/1' },
  ];

  readonly roots = computed(() =>
    this.comments()
      .filter((c) => !c.parentId)
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder || b.likeCount - a.likeCount),
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
    this.route.paramMap.subscribe((p) => {
      const id = p.get('topicId') ?? '';
      this.topicId.set(id);
      if (id) this.prefs.markSectionRead(id);
      this.editingWidgetId.set(null);
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
        this.comments.set(
          list.map((c) => ({
            ...c,
            widgetSize: (c.widgetSize as GuideCommentWidgetSize) || 'half',
            sortOrder: c.sortOrder ?? 0,
          })),
        );
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
    this.commentsApi
      .createComment(id, body, this.replyTo(), this.replyTo() ? undefined : this.newWidgetSize())
      .subscribe({
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
      next: (updated) => this.mergeComment(updated),
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
    this.editingWidgetId.set(null);
  }

  cancelReply(): void {
    this.replyTo.set(null);
  }

  isEditing(id: string): boolean {
    return this.editingWidgetId() === id;
  }

  startEditWidget(id: string): void {
    this.editingWidgetId.set(id);
    this.replyTo.set(null);
  }

  doneEditWidget(): void {
    this.editingWidgetId.set(null);
  }

  setWidgetSize(c: GuideComment, size: GuideCommentWidgetSize): void {
    this.commentsApi.patchLayout(c.id, { widgetSize: size }).subscribe({
      next: (updated) => this.mergeComment(updated),
    });
  }

  moveWidget(c: GuideComment, dir: -1 | 1): void {
    const roots = this.roots();
    const idx = roots.findIndex((x) => x.id === c.id);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= roots.length) return;
    this.commentsApi.patchLayout(c.id, { sortOrder: next }).subscribe({
      next: () => this.reload(),
    });
  }

  padSpanClass(c: GuideComment): string {
    const size = c.widgetSize ?? 'half';
    if (size === 'full') return 'col-span-6';
    if (size === 'third') return 'col-span-6 sm:col-span-2';
    return 'col-span-6 sm:col-span-3';
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

  private mergeComment(updated: GuideComment): void {
    this.comments.update((list) =>
      list.map((x) =>
        x.id === updated.id
          ? {
              ...updated,
              widgetSize: (updated.widgetSize as GuideCommentWidgetSize) || 'half',
              sortOrder: updated.sortOrder ?? x.sortOrder,
            }
          : x,
      ),
    );
  }
}
