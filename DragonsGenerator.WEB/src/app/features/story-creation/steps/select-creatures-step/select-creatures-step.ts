import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of } from 'rxjs';
import { DataService } from '@core/services/data.service';
import { StoryBuilderService } from '@core/services/story-builder.service';
import { StoryCreatureSelection } from '@core/models/Story/story';
import {
  CR_TIER_LABELS,
  CrTier,
  formatChallengeRating,
  getCategoryIcon,
  getCreatureCategoryLabel,
  getCrTier,
} from '@core/utils/creature-display.util';
import {
  getLevelRangePreset,
  LEVEL_RANGE_PRESETS,
  partyLevelFromRange,
  pickCreaturesForLevelRange,
} from '@core/utils/story-creature-picker.util';

@Component({
  selector: 'app-select-creatures-step',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './select-creatures-step.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class SelectCreaturesStep implements OnInit {
  readonly builder = inject(StoryBuilderService);
  private dataService = inject(DataService);

  readonly search = signal('');
  readonly categoryFilter = signal<string | null>(null);
  readonly crTierFilter = signal<CrTier | null>(null);
  readonly autoPickError = signal<string | null>(null);
  readonly autoPreview = signal<StoryCreatureSelection[]>([]);

  protected creatures = toSignal(
    this.dataService.getCreaturesSummary().pipe(catchError(() => of([]))),
    { initialValue: null },
  );

  readonly levelRanges = LEVEL_RANGE_PRESETS;
  readonly autoCounts = [3, 4, 5, 6, 8, 10, 12, 15];

  readonly categories = computed(() => {
    const list = this.creatures() ?? [];
    return [...new Set(list.map((c) => c.category))].sort((a, b) =>
      getCreatureCategoryLabel(a).localeCompare(getCreatureCategoryLabel(b), 'fr'),
    );
  });

  readonly filteredCreatures = computed(() => {
    const list = this.creatures() ?? [];
    const term = this.search().trim().toLowerCase();
    const cat = this.categoryFilter();
    const tier = this.crTierFilter();

    return list
      .filter((c) => {
        if (cat && c.category !== cat) return false;
        if (tier && getCrTier(c.challengeRating) !== tier) return false;
        if (!term) return true;
        return (
          c.name.toLowerCase().includes(term) ||
          getCreatureCategoryLabel(c.category).toLowerCase().includes(term)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  });

  readonly selectedCount = computed(() => this.builder.creatures().length);

  readonly selectedLevelRange = computed(() =>
    getLevelRangePreset(this.builder.levelRangeId()),
  );

  constructor() {
    effect(() => {
      if (this.builder.selectionMode() !== 'auto') return;
      this.refreshAutoPreview();
    });
  }

  ngOnInit(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  setMode(mode: 'manual' | 'auto'): void {
    this.autoPickError.set(null);
    this.builder.setSelectionMode(mode);
  }

  toggle(creature: NonNullable<ReturnType<typeof this.creatures>>[number]): void {
    this.builder.toggleCreature({
      creatureId: creature.id,
      creatureName: creature.name,
      category: creature.category,
      challengeRating: creature.challengeRating,
    });
  }

  isSelected(id: string): boolean {
    return this.builder.isCreatureSelected(id);
  }

  rerollAuto(): void {
    this.autoPickError.set(null);
    this.refreshAutoPreview();
  }

  confirm(): void {
    this.autoPickError.set(null);

    if (this.builder.selectionMode() === 'auto') {
      const preview = this.autoPreview();
      if (preview.length === 0) {
        this.autoPickError.set(
          'Aucune créature trouvée pour cette plage de niveau. Essayez une autre tranche ou passez en sélection manuelle.',
        );
        return;
      }
      this.builder.creatures.set(preview.map((c) => ({ ...c, backstory: '' })));
      const preset = getLevelRangePreset(this.builder.levelRangeId());
      if (preset) {
        this.builder.partyLevel.set(partyLevelFromRange(preset));
      }
    }

    this.builder.nextStep();
  }

  private refreshAutoPreview(): void {
    const list = this.creatures();
    const preset = getLevelRangePreset(this.builder.levelRangeId());
    const count = this.builder.autoCreatureCount();
    if (!list || !preset) {
      this.autoPreview.set([]);
      return;
    }
    this.autoPreview.set(pickCreaturesForLevelRange(list, preset, count));
  }

  protected categoryLabel = getCreatureCategoryLabel;
  protected formatCr = formatChallengeRating;
  protected categoryIcon = getCategoryIcon;
  protected crTierLabels = CR_TIER_LABELS;
  protected crTiers: CrTier[] = ['low', 'mid', 'high', 'legendary'];
}
