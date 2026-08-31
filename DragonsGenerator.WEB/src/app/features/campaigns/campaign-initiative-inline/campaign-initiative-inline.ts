import {
  ChangeDetectionStrategy,
  Component,
  computed,
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

@Component({
  selector: 'app-campaign-initiative-inline',
  standalone: true,
  imports: [FormsModule],
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
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);

  readonly myCombatants = computed(() => {
    const userId = this.auth.user()?.id;
    const list = this.board().combatants ?? [];
    if (!userId) return list;
    const linked = list.filter((c) => c.memberUserId === userId);
    return linked.length ? linked : list;
  });

  submit(): void {
    const combatantId = this.selectedId();
    const roll = this.roll();
    const code = this.board().code;
    if (!combatantId || roll == null || !code) {
      this.error.set('Choisissez un personnage et un jet.');
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
