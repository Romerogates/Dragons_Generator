import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CampaignCloudService,
  InitiativeBoard,
  InitiativeBoardCombatant,
} from '@core/services/campaign-cloud.service';
import { AuthService } from '@core/services/auth.service';
import { DiceRollComponent } from '@shared/components/dice-roll/dice-roll';

@Component({
  selector: 'app-campaign-initiative-inline',
  standalone: true,
  imports: [FormsModule, DiceRollComponent],
  templateUrl: './campaign-initiative-inline.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CampaignInitiativeInline {
  private readonly campaigns = inject(CampaignCloudService);
  private readonly auth = inject(AuthService);

  readonly campaignId = input.required<string>();
  readonly board = input.required<InitiativeBoard>();
  readonly submitted = output<void>();

  readonly selectedId = signal('');
  readonly roll = signal<number | null>(null);
  readonly useDice = signal(true);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  readonly myCombatants = computed(() => {
    const userId = this.auth.user()?.id;
    const list = this.board().combatants ?? [];
    if (!userId) return [];
    return list.filter((c) => c.memberUserId === userId);
  });

  constructor() {
    effect(() => {
      const mine = this.myCombatants();
      if (!this.selectedId() && mine.length === 1 && !mine[0].hasRoll) {
        this.selectedId.set(mine[0].id);
      }
    });
  }

  selectedCombatant(): InitiativeBoardCombatant | null {
    const id = this.selectedId();
    return this.myCombatants().find((c) => c.id === id) ?? null;
  }

  formatBonus(bonus: number): string {
    return bonus >= 0 ? `+${bonus}` : `${bonus}`;
  }

  onDieRolled(value: number): void {
    this.roll.set(value);
  }

  ensureSelection(): void {
    if (!this.selectedId() && this.myCombatants().length === 1) {
      this.selectedId.set(this.myCombatants()[0].id);
    }
  }

  submit(): void {
    this.ensureSelection();
    const combatantId = this.selectedId();
    const roll = this.roll();
    const code = this.board().code;
    if (!combatantId || roll == null || !code) {
      this.error.set('Choisissez un personnage et un jet.');
      return;
    }
    if (roll < 1 || roll > 30) {
      this.error.set('Le jet doit être entre 1 et 30.');
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.campaigns.submitInitiative(this.campaignId(), { code, combatantId, roll }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.success.set('Jet enregistré !');
        this.submitted.emit();
      },
      error: (err) => {
        this.submitting.set(false);
        const msg =
          err?.error?.errors?.[0]?.reason ||
          err?.error?.message ||
          'Échec (code ou collecte fermée).';
        this.error.set(typeof msg === 'string' ? msg : 'Échec.');
      },
    });
  }

  combatantLabel(c: InitiativeBoardCombatant): string {
    return c.hasRoll ? `${c.name} ✓` : c.name;
  }
}
