import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, combineLatest, map, of, switchMap } from 'rxjs';
import { CampaignCloudService } from '@core/services/campaign-cloud.service';
import { DataService } from '@core/services/data.service';
import { CREATURE_ROLE_LABELS } from '@core/models/Campaign/campaign';
import type { StoryCreatureSelection } from '@core/models/Story/story';
import type { Creature } from '@core/models/Creatures/creature';
import { formatChallengeRating } from '@core/utils/creature-display.util';
import {
  BookReaderShell,
  type BookTocItem,
} from '@shared/components/book-reader-shell/book-reader-shell';
import { CreatureBookPage } from '@shared/components/creature-book-page/creature-book-page';

@Component({
  selector: 'app-campaign-bestiary-book',
  standalone: true,
  imports: [BookReaderShell, CreatureBookPage],
  templateUrl: './campaign-bestiary-book.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CampaignBestiaryBookPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly campaigns = inject(CampaignCloudService);
  private readonly data = inject(DataService);

  protected readonly loadError = signal<string | null>(null);
  protected readonly creatureError = signal<string | null>(null);

  protected readonly bundle = toSignal(
    combineLatest([this.route.paramMap, this.route.queryParamMap]).pipe(
      switchMap(([params, query]) => {
        const campaignId = params.get('id') ?? '';
        this.loadError.set(null);
        return this.campaigns.get(campaignId).pipe(
          map((campaign) => {
            const creatures = campaign.data.creatures ?? [];
            let index = query.get('i') != null ? Number(query.get('i')) : 0;
            if (!Number.isFinite(index) || index < 0 || index >= creatures.length) {
              index = 0;
            }
            return {
              campaign,
              campaignId,
              creatures,
              index,
              entry: creatures[index] ?? null,
            };
          }),
          catchError(() => {
            this.loadError.set('Impossible de charger le bestiaire de campagne.');
            return of(null);
          }),
        );
      }),
    ),
    { initialValue: undefined },
  );

  protected readonly campaignTitle = computed(
    () => this.bundle()?.campaign.title ?? 'Campagne',
  );
  protected readonly campaignId = computed(() => this.bundle()?.campaignId ?? '');
  protected readonly backLink = computed(() => {
    const id = this.campaignId();
    return id ? `/campaigns/${id}?tab=prep` : '/campaigns';
  });
  protected readonly entries = computed(() => this.bundle()?.creatures ?? []);
  protected readonly activeIndex = computed(() => this.bundle()?.index ?? 0);
  protected readonly activeEntry = computed(() => this.bundle()?.entry ?? null);

  protected readonly toc = computed<BookTocItem[]>(() =>
    this.entries().map((cr, i) => ({
      id: String(i),
      label: cr.customName || cr.creatureName,
      subtitle: `${cr.creatureName} · ${formatChallengeRating(cr.challengeRating)}`,
    })),
  );

  protected readonly activeId = computed(() => String(this.activeIndex()));

  protected readonly creature = toSignal(
    toObservable(this.activeEntry).pipe(
      switchMap((entry) => {
        if (!entry) return of(null as Creature | null);
        this.creatureError.set(null);
        // Reset display while loading next page
        return this.data.getCreatureById(entry.creatureId).pipe(
          catchError(() => {
            this.creatureError.set('Fiche créature introuvable dans le Codex.');
            return of(null);
          }),
        );
      }),
    ),
    { initialValue: null as Creature | null },
  );

  protected roleLabel(entry: StoryCreatureSelection | null): string | null {
    if (!entry) return null;
    return CREATURE_ROLE_LABELS[entry.role] ?? entry.role;
  }

  protected onSelectToc(id: string): void {
    const campaignId = this.campaignId();
    if (!campaignId) return;
    void this.router.navigate(['/campaigns', campaignId, 'bestiary'], {
      queryParams: { i: id },
      replaceUrl: true,
    });
  }
}
