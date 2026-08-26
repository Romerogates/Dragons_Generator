import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { DataService } from '@core/services/data.service';

const CATEGORY_LABELS: Record<string, string> = {
  standard: 'Standard',
  special_attack: 'Attaque spéciale',
  reaction: 'Réaction',
  bonus: 'Bonus',
};

const COST_LABELS: Record<string, string> = {
  action: 'Action',
  bonus_action: 'Action bonus',
  reaction: 'Réaction',
};

const COST_ICONS: Record<string, string> = {
  action: 'fluent-emoji:crossed-swords',
  bonus_action: 'fluent-emoji:high-voltage',
  reaction: 'fluent-emoji:counterclockwise-arrows-button',
};

const MECHANIC_LABELS: Record<string, string> = {
  trigger: 'Déclencheur',
  response: 'Réponse',
  limit: 'Limite',
  spell_rules: 'Règles de sort',
  casting_time: 'Temps d’incantation',
  concentration: 'Concentration',
  note: 'Note',
  options: 'Options',
  type: 'Type',
  effect: 'Effet',
  duration: 'Durée',
  range_m: 'Portée (m)',
  attack_types: 'Types d’attaque',
  special_attacks: 'Attaques spéciales',
  tests: 'Tests',
  dm_decides: 'Décision du MJ',
  effects: 'Effets',
  attacks_against_you: 'Attaques contre vous',
  modifier: 'Modificateur',
  condition: 'Condition',
  dexterity_saves: 'Jets de sauvegarde de Dextérité',
  ends_if: 'Prend fin si',
  targets: 'Cibles',
  save: 'Jet de sauvegarde',
  ability: 'Caractéristique',
  dc_formula: 'DD',
  skills: 'Compétences',
  save_advantage_if: 'Avantage au jet si',
  save_disadvantage_if: 'Désavantage au jet si',
  on_fail: 'En cas d’échec',
  critical_fail: 'Échec critique',
  replaces: 'Remplace',
  target_restrictions: 'Restrictions de cible',
  max_size_difference: 'Écart de taille max',
  range: 'Portée',
  requirement: 'Prérequis',
  prerequisite: 'Prérequis',
  contest: 'Opposition',
  attacker: 'Attaquant',
  defender: 'Défenseur',
  on_success: 'En cas de succès',
  escape: 'Échapper',
  cost: 'Coût',
  move_grappled: 'Déplacer une cible agrippée',
  speed: 'Vitesse',
  exception: 'Exception',
  attack: 'Attaque',
  timing: 'Timing',
  not_provoked_by: 'Non provoquée par',
  second_weapon: 'Seconde arme',
  damage: 'Dégâts',
  thrown: 'Lancer',
  use_cases: 'Cas d’usage',
  test: 'Test',
};

export type MechanicNode =
  | { kind: 'primitive'; value: string }
  | { kind: 'list'; items: MechanicNode[] }
  | { kind: 'object'; entries: { key: string; label: string; value: MechanicNode }[] }
  | { kind: 'link'; id: string; label: string }
  | { kind: 'bool'; value: boolean };

@Component({
  selector: 'app-combat-action-by-id',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './combat-action-by-id.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CombatActionById {
  private dataService = inject(DataService);
  private route = inject(ActivatedRoute);

  protected error = signal<string | null>(null);
  protected notFound = signal(false);

  protected action = toSignal(
    this.route.paramMap.pipe(
      switchMap((params) => {
        const id = params.get('id') ?? '';
        this.error.set(null);
        this.notFound.set(false);
        return this.dataService.getCombatActionById(id).pipe(
          catchError((err) => {
            if (err?.status === 404) this.notFound.set(true);
            else this.error.set('Impossible de charger cette action.');
            return of(null);
          }),
        );
      }),
    ),
    { initialValue: undefined },
  );

  categoryLabel(cat: string | null | undefined): string {
    if (!cat) return '—';
    return CATEGORY_LABELS[cat] ?? cat;
  }

  costLabel(cost: string | null | undefined): string {
    if (!cost) return '—';
    return COST_LABELS[cost] ?? cost;
  }

  costIcon(cost: string | null | undefined): string {
    if (!cost) return 'fluent-emoji:crossed-swords';
    return COST_ICONS[cost] ?? 'fluent-emoji:crossed-swords';
  }

  sourceLabel(source: string | null | undefined): string {
    if (!source) return '';
    if (source === 'livre_de_base') return 'Livre de base';
    return source.replace(/_/g, ' ');
  }

  mechanicsTree(mechanics: unknown): MechanicNode | null {
    if (mechanics == null) return null;
    return this.toNode(mechanics);
  }

  private toNode(value: unknown): MechanicNode {
    if (typeof value === 'boolean') return { kind: 'bool', value };
    if (typeof value === 'number') return { kind: 'primitive', value: String(value) };
    if (typeof value === 'string') {
      if (value.startsWith('act-')) {
        return { kind: 'link', id: value, label: this.actionIdLabel(value) };
      }
      return { kind: 'primitive', value: this.humanize(value) };
    }
    if (Array.isArray(value)) {
      return { kind: 'list', items: value.map((v) => this.toNode(v)) };
    }
    if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>).map(([key, v]) => ({
        key,
        label: MECHANIC_LABELS[key] ?? this.humanize(key),
        value: this.toNode(v),
      }));
      return { kind: 'object', entries };
    }
    return { kind: 'primitive', value: String(value) };
  }

  private actionIdLabel(id: string): string {
    return id
      .replace(/^act-/, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private humanize(value: string): string {
    if (value.includes(' ') || /[A-ZÀ-Ü]/.test(value)) return value;
    return value.replace(/_/g, ' ');
  }
}
