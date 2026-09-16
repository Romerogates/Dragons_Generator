import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '@core/services/auth.service';
import { GuideCommentsService, type GuideComment } from '@core/services/guide-comments.service';
import { GuidePreferencesService } from '@core/services/guide-preferences.service';
import { ConfirmDialog } from '@shared/components/confirm-dialog/confirm-dialog';
import { GUIDE_TOPICS, getGuideTopic, guideTopicsByGroup, type GuideTopic } from './guide-topics';
import type { GuideAudience } from './guide.types';
import { GuideSidebar } from './guide-sidebar/guide-sidebar';
import { GuideRulebookPdfService } from '@core/services/guide-rulebook-pdf.service';
import type { GuidePdfChapter } from '@core/services/guide-rulebook-pdf.service';

const CHECKLIST_STORAGE_KEY = 'dg-guide-checklist';

@Component({
  selector: 'app-guide-topic',
  standalone: true,
  imports: [RouterLink, FormsModule, ConfirmDialog, GuideSidebar],
  templateUrl: './guide-topic.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuideTopicPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly commentsApi = inject(GuideCommentsService);
  private readonly prefs = inject(GuidePreferencesService);
  private readonly auth = inject(AuthService);
  private readonly guidePdf = inject(GuideRulebookPdfService);

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
  readonly checklistDone = signal<Record<string, boolean>>(loadChecklistDone());
  readonly exportingPdf = signal(false);
  readonly confirmDialog = signal<{
    title: string;
    body: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  readonly allTopics = GUIDE_TOPICS;

  readonly sidebarSections = computed(() =>
    guideTopicsByGroup(this.audience(), this.navQuery(), 'all'),
  );

  readonly searchEmpty = computed(
    () => this.navQuery().trim().length > 0 && this.sidebarSections().length === 0,
  );

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
  readonly isLoggedIn = computed(() => this.auth.isLoggedIn());

  constructor() {
    effect(() => {
      const a = this.audience();
      if (a === 'dm' || a === 'player') this.prefs.setAudience(a);
    });
  }

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

  async downloadTopicPdf(): Promise<void> {
    const t = this.topic();
    if (!t || this.exportingPdf()) return;
    this.exportingPdf.set(true);
    try {
      const chapters: GuidePdfChapter[] = [];
      if (t.paragraphs.length) {
        chapters.push({
          title: 'Présentation',
          sections: [{ title: t.summary, paragraphs: t.paragraphs }],
        });
      }
      if (t.flow.length) {
        chapters.push({
          title: 'Parcours',
          sections: [{ title: 'Étapes', numbered: t.flow }],
        });
      }
      if (t.steps.length) {
        chapters.push({
          title: 'Détail',
          sections: t.steps.map((s) => ({
            title: s.title,
            paragraphs: [s.body],
          })),
        });
      }
      if (t.checklist.length) {
        chapters.push({
          title: 'Checklist',
          sections: [
            {
              title: 'À cocher',
              bullets: t.checklist.map((c) => c.label),
            },
          ],
        });
      }
      await this.guidePdf.download({
        title: t.title,
        subtitle: t.summary,
        pdfFilename: `dragons-guide-${t.id}.pdf`,
        chapters:
          chapters.length > 0
            ? chapters
            : [{ title: t.title, sections: [{ title: 'Contenu', paragraphs: [t.summary] }] }],
      });
    } finally {
      this.exportingPdf.set(false);
    }
  }

  setAudience(a: GuideAudience | 'all'): void {
    this.audience.set(a);
    if (a === 'dm' || a === 'player') this.prefs.setAudience(a);
  }

  toggleChecklist(id: string): void {
    this.checklistDone.update((m) => {
      const next = { ...m, [id]: !m[id] };
      persistChecklistDone(next);
      return next;
    });
  }

  checklistProgress(items: { id: string }[]): { done: number; total: number } {
    const done = items.filter((i) => this.checklistDone()[i.id]).length;
    return { done, total: items.length };
  }

  reload(): void {
    const id = this.topicId();
    if (!id) return;
    this.loading.set(true);
    this.error.set(null);
    if (!this.auth.isLoggedIn()) {
      this.comments.set([]);
      this.loading.set(false);
      return;
    }
    this.commentsApi.listComments(id).subscribe({
      next: (list) => {
        this.comments.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.comments.set([]);
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
    this.askConfirm('Supprimer le commentaire', 'Supprimer ce commentaire ?', () => {
      this.commentsApi.deleteComment(c.id).subscribe({ next: () => this.reload() });
    });
  }

  cancelConfirmDialog(): void {
    this.confirmDialog.set(null);
  }

  runConfirmDialog(): void {
    const dialog = this.confirmDialog();
    if (!dialog) return;
    this.confirmDialog.set(null);
    dialog.onConfirm();
  }

  private askConfirm(title: string, body: string, onConfirm: () => void, confirmLabel = 'Supprimer'): void {
    this.confirmDialog.set({ title, body, confirmLabel, onConfirm });
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

function loadChecklistDone(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(CHECKLIST_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function persistChecklistDone(map: Record<string, boolean>): void {
  try {
    localStorage.setItem(CHECKLIST_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}
