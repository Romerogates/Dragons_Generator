import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GuideRulebookPdfService } from '@core/services/guide-rulebook-pdf.service';
import { GuidePreferencesService } from '@core/services/guide-preferences.service';
import { GuideSidebar } from './guide-sidebar/guide-sidebar';
import { guideTopicsByGroup } from './guide-topics';
import type { GuideAudience } from './guide.types';
import {
  getGuideRulebook,
  GUIDE_RULEBOOK_JOUEUR_TABLE,
  type GuideRulebook,
} from './guide-rulebooks';
import {
  classBeginnerPackFilename,
  getGuideClassPlaybook,
  type GuideClassPlaybook,
} from './guide-class-playbooks';

@Component({
  selector: 'app-guide-rulebook',
  standalone: true,
  imports: [RouterLink, GuideSidebar],
  templateUrl: './guide-rulebook.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuideRulebookPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly pdf = inject(GuideRulebookPdfService);
  private readonly prefs = inject(GuidePreferencesService);

  readonly book = signal<GuideRulebook | null>(null);
  readonly classBook = signal<GuideClassPlaybook | null>(null);
  readonly exporting = signal(false);
  readonly exportError = signal<string | null>(null);
  readonly navQuery = signal('');
  readonly audience = signal<GuideAudience | 'all'>('all');

  readonly displayTitle = computed(
    () => this.classBook()?.title ?? this.book()?.title ?? '',
  );
  readonly displaySubtitle = computed(
    () => this.classBook()?.subtitle ?? this.book()?.subtitle ?? '',
  );
  readonly displayChapters = computed(
    () => this.classBook()?.chapters ?? this.book()?.chapters ?? [],
  );
  readonly related = computed(
    () => this.classBook()?.related ?? this.book()?.related ?? [],
  );
  readonly showBeginnerPack = computed(() => this.classBook() != null);

  readonly sidebarSections = computed(() =>
    guideTopicsByGroup(this.audience(), this.navQuery(), 'all'),
  );

  readonly searchEmpty = computed(
    () => this.navQuery().trim().length > 0 && this.sidebarSections().length === 0,
  );

  readonly activeRulebookId = computed(() => this.book()?.id ?? null);

  ngOnInit(): void {
    const aud = this.prefs.audience();
    if (aud === 'dm' || aud === 'player') this.audience.set(aud);

    this.route.paramMap.subscribe((params) => {
      const classId = params.get('classId');
      if (classId) {
        const cb = getGuideClassPlaybook(classId);
        this.classBook.set(cb);
        this.book.set(null);
        this.audience.set('player');
        return;
      }

      const id = String(
        this.route.snapshot.data['rulebookId'] ?? params.get('rulebookId') ?? '',
      );
      const b = getGuideRulebook(id);
      this.book.set(b);
      this.classBook.set(null);
      if (b?.role === 'mj') {
        this.prefs.setAudience('dm');
        this.audience.set('dm');
      }
      if (b?.role === 'joueur') {
        this.prefs.setAudience('player');
        this.audience.set('player');
      }
    });
  }

  async downloadPdf(): Promise<void> {
    const cb = this.classBook();
    const b = this.book();
    const doc = cb ?? b;
    if (!doc || this.exporting()) return;
    this.exporting.set(true);
    this.exportError.set(null);
    try {
      await this.pdf.download({
        title: doc.title,
        subtitle: doc.subtitle,
        pdfFilename: doc.pdfFilename,
        chapters: doc.chapters,
      });
    } catch {
      this.exportError.set('Téléchargement PDF impossible.');
    } finally {
      this.exporting.set(false);
    }
  }

  /** Livret joueur table + guide de classe en un seul PDF. */
  async downloadBeginnerPack(): Promise<void> {
    const cb = this.classBook();
    if (!cb || this.exporting()) return;
    this.exporting.set(true);
    this.exportError.set(null);
    try {
      const table = GUIDE_RULEBOOK_JOUEUR_TABLE;
      await this.pdf.download({
        title: `Pack débutant — ${cb.className}`,
        subtitle:
          'Livret Joueur à la table (stats, fiche annotée, glossaire) + comment jouer votre classe.',
        pdfFilename: classBeginnerPackFilename(cb.classId),
        chapters: [
          ...table.chapters,
          {
            id: 'separateur-classe',
            title: `— Guide de classe : ${cb.className} —`,
            sections: [
              {
                id: 'intro-classe',
                title: 'Suite du pack',
                paragraphs: [
                  `Les pages suivantes sont spécifiques au ${cb.className}. Les chapitres précédents restent valables pour tous les joueurs.`,
                ],
              },
            ],
          },
          ...cb.chapters,
        ],
      });
    } catch {
      this.exportError.set('Téléchargement du pack impossible.');
    } finally {
      this.exporting.set(false);
    }
  }
}
