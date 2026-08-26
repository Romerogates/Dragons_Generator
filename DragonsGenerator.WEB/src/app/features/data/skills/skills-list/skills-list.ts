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
import { catchError, of } from 'rxjs';
import { DataService } from '@core/services/data.service';
import { Skill } from '@core/models/Skills/skill';
import { buildSkillMap, normalizeSkillId } from '@core/utils/skill.utils';

const ABILITY_LABELS: Record<string, string> = {
  FOR: 'Force',
  DEX: 'Dextérité',
  CON: 'Constitution',
  INT: 'Intelligence',
  SAG: 'Sagesse',
  CHA: 'Charisme',
};

@Component({
  selector: 'app-skills-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './skills-list.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class SkillsList {
  private dataService = inject(DataService);

  protected error = signal<string | null>(null);
  readonly search = signal('');
  readonly abilityFilter = signal<string | null>(null);

  protected skills = toSignal(
    this.dataService.getSkills().pipe(
      catchError(() => {
        this.error.set('Impossible de charger les compétences.');
        return of([] as Skill[]);
      }),
    ),
    { initialValue: null },
  );

  readonly skillIcons = computed(() => {
    const list = this.skills();
    return list ? buildSkillMap(list) : {};
  });

  readonly abilities = computed(() => {
    const list = this.skills() ?? [];
    return [...new Set(list.map((s) => s.ability))].sort();
  });

  readonly filteredSkills = computed(() => {
    const list = this.skills();
    if (!list) return [];

    const term = this.search().trim().toLowerCase();
    const ability = this.abilityFilter();

    return list.filter((s) => {
      if (ability && s.ability !== ability) return false;
      if (!term) return true;
      return (
        s.name.toLowerCase().includes(term) ||
        s.description.toLowerCase().includes(term) ||
        s.ability.toLowerCase().includes(term)
      );
    });
  });

  onSearch(value: string): void {
    this.search.set(value);
  }

  setAbilityFilter(ability: string | null): void {
    this.abilityFilter.set(ability);
  }

  abilityLabel(code: string): string {
    return ABILITY_LABELS[code] ?? code;
  }

  skillIcon(skill: Skill): string {
    return this.skillIcons()[normalizeSkillId(skill.id)]?.icon ?? 'fluent-emoji:bookmark-tabs';
  }
}
