import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { DataService } from '@core/services/data.service';

@Component({
  selector: 'app-character-classes-summary',
  imports: [RouterLink],
  templateUrl: './character-classes-summary.html',
  styleUrl: './character-classes-summary.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CharacterClassesSummary {
  private readonly dataService = inject(DataService);

  protected readonly classes = toSignal(this.dataService.getClassesSummary(), {
    initialValue: [],
  });

  protected readonly search = signal('');

  protected readonly filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const list = this.classes();
    if (!term) return list;
    return list.filter((c) => c.name.toLowerCase().includes(term));
  });

  protected onSearch(value: string): void {
    this.search.set(value);
  }
}
