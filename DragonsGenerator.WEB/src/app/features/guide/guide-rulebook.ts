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
import {
  getGuideSubclassPlaybook,
  type GuideSubclassPlaybook,
} from './guide-subclass-playbooks';
import {
  getGuideSpeciesPlaybook,
  type GuideSpeciesPlaybook,
} from './guide-species-playbooks';

type GuideExtraBook = GuideClassPlaybook | GuideSubclassPlaybook | GuideSpeciesPlaybook;

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
  readonly subclassBook = signal<GuideSubclassPlaybook | null>(null);
  readonly speciesBook = signal<GuideSpeciesPlaybook | null>(null);
  readonly exporting = signal(false);
  readonly exportError = signal<string | null>(null);
  readonly navQuery = signal('');
  readonly audience = signal<GuideAudience | 'all'>('all');

  private readonly extraBook = computed(
    (): GuideExtraBook | null =>
      this.classBook() ?? this.subclassBook() ?? this.speciesBook() ?? null,
  );

  readonly displayTitle = computed(
    () => this.extraBook()?.title ?? this.book()?.title ?? '',
  );
  readonly displaySubtitle = computed(
    () => this.extraBook()?.subtitle ?? this.book()?.subtitle ?? '',
  );
  readonly displayChapters = computed(
    () => this.extraBook()?.chapters ?? this.book()?.chapters ?? [],
  );
  readonly related = computed(
    () => this.extraBook()?.related ?? this.book()?.related ?? [],
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
        this.classBook.set(getGuideClassPlaybook(classId));
        this.subclassBook.set(null);
        this.speciesBook.set(null);
        this.book.set(null);
        this.audience.set('player');
        return;
      }

      const subclassId = params.get('subclassId');
      if (subclassId) {
        this.subclassBook.set(getGuideSubclassPlaybook(subclassId));
        this.classBook.set(null);
        this.speciesBook.set(null);
        this.book.set(null);
        this.audience.set('player');
        return;
      }

      const speciesId = params.get('speciesId');
      if (speciesId) {
        this.speciesBook.set(getGuideSpeciesPlaybook(speciesId));
        this.classBook.set(null);
        this.subclassBook.set(null);
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
      this.subclassBook.set(null);
      this.speciesBook.set(null);
      if (b?.role === 'mj') {
        this.prefs.setAudience('dm');
        this.audience.set('dm');
      }
      if (b?.role === 'joueur') {
        this.prefs.setAudience('player');
        this.audience.set('player');
      }
      if (b?.role === 'all') {
        this.audience.set('all');
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
