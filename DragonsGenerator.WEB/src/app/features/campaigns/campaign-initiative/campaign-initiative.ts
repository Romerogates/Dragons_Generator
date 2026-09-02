import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  CampaignCloudService,
  InitiativeBoard,
  InitiativeBoardCombatant,
} from '@core/services/campaign-cloud.service';
import { AuthService } from '@core/services/auth.service';

@Component({
  selector: 'app-campaign-initiative',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './campaign-initiative.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CampaignInitiativePage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly campaigns = inject(CampaignCloudService);
  private readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly success = signal<string | null>(null);
  readonly board = signal<InitiativeBoard | null>(null);
  readonly campaignId = signal('');
  readonly code = signal('');
  readonly selectedId = signal('');
  readonly roll = signal<number | null>(null);

  private pollTimer: ReturnType<typeof setInterval> | null = null;

  readonly combatants = computed(() => this.board()?.combatants ?? []);

  readonly myCombatants = computed(() => {
    const userId = this.auth.user()?.id;
    const list = this.combatants();
    if (!userId) return [];
    return list.filter((c) => c.memberUserId === userId);
  });

  ngOnInit(): void {
    if (!this.auth.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/campaigns']);
      return;
    }
    this.campaignId.set(id);

    const qCode = this.route.snapshot.queryParamMap.get('code');
    if (qCode) this.code.set(qCode.toUpperCase());

    this.refresh();
    this.pollTimer = setInterval(() => this.refresh(true), 4000);
  }

  ngOnDestroy(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  refresh(silent = false): void {
    if (!silent) this.loading.set(true);
    this.campaigns.getInitiativeBoard(this.campaignId()).subscribe({
      next: (board) => {
        this.board.set(board);
        if (board.code && !this.code()) this.code.set(board.code);
        const mine = this.myCombatants();
        if (!this.selectedId() && mine.length === 1) {
          this.selectedId.set(mine[0].id);
        }
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger la collecte.');
        this.loading.set(false);
      },
    });
  }

  selectedCombatant(): InitiativeBoardCombatant | null {
    return this.combatants().find((c) => c.id === this.selectedId()) ?? null;
  }

  submit(): void {
    const combatantId = this.selectedId();
    const roll = this.roll();
    const code = this.code().trim();
    if (!combatantId || roll == null || !code) {
      this.error.set('Choisissez un personnage, un jet et un code.');
      return;
    }
    if (roll < 1 || roll > 30) {
      this.error.set('Le jet doit être entre 1 et 30.');
      return;
    }

    this.submitting.set(true);
    this.error.set(null);
    this.success.set(null);
    this.campaigns
      .submitInitiative(this.campaignId(), { code, combatantId, roll })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.success.set('Jet enregistré.');
          this.refresh(true);
        },
        error: (err) => {
          this.submitting.set(false);
          const msg =
            err?.error?.errors?.[0]?.reason ||
            err?.error?.message ||
            'Échec de l’enregistrement (code ou collecte).';
          this.error.set(typeof msg === 'string' ? msg : 'Échec de l’enregistrement.');
        },
      });
  }
}
