import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { DataService } from '@core/services/data.service';
import { normalizeCharacterClasses } from '@core/utils/class-data.adapter';
import { getClassIcon } from '@core/utils/class-icons';
import { GameIdLabelsPipe } from '@shared/pipes/game-id-label.pipe';
import type { CharacterClass } from '@core/models/CharacterClasses/character-class';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-character-classes',
  standalone: true,
  imports: [CommonModule, RouterLink, GameIdLabelsPipe],
  templateUrl: './character-classes.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CharacterClasses {
  private readonly dataService = inject(DataService);

  protected readonly classes = toSignal(
    this.dataService.getClasses().pipe(map((list) => normalizeCharacterClasses(list))),
    { initialValue: [] },
  );

  protected readonly search = signal('');

  protected readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const list = this.classes();
    if (!term) return list;
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        this.classSummary(c).toLowerCase().includes(term),
    );
  });

  protected iconFor(classId: string): string {
    return getClassIcon(classId);
  }

  protected onSearch(value: string): void {
    this.search.set(value);
  }

  protected classSummary(cls: CharacterClass): string {
    const flavor = cls.data.flavor;
    const summary = flavor?.summary?.trim();
    if (summary) return summary;
    const first = cls.data.features_details?.[0]?.desc?.trim();
    if (first) return first.slice(0, 180) + (first.length > 180 ? '…' : '');
    return `Voie du ${cls.name} — dé de vie d${cls.data.hit_die}.`;
  }
}
