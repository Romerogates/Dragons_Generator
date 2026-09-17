import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap } from 'rxjs';
import { DataService } from '@core/services/data.service';
import { AuthService } from '@core/services/auth.service';
import { CampaignCloudService } from '@core/services/campaign-cloud.service';
import { CampaignSessionDockService } from '@core/services/campaign-session-dock.service';
import { Creature } from '@core/models/Creatures/creature';
import type { CampaignDetail, EncounterGroup } from '@core/models/Campaign/campaign';
import {
  ABILITY_LABELS,
  formatChallengeRating,
  getCreatureCategoryLabel,
} from '@core/utils/creature-display.util';
import {
  appendCreatureCombatantToSession,
  appendCreatureToEncounter,
  combatantFromCreature,
} from '@core/utils/combat-creature-import.util';
import { CodexDetailShell } from '@shared/components/codex-detail-shell/codex-detail-shell';

@Component({
  selector: 'app-creature-by-id',
  standalone: true,
  imports: [RouterLink, CodexDetailShell],
  templateUrl: './creature-by-id.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class CreatureById {
  private dataService = inject(DataService);
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private campaigns = inject(CampaignCloudService);
  private sessionDock = inject(CampaignSessionDockService);

  protected error = signal<string | null>(null);
  protected notFound = signal(false);
  protected addingToTable = signal(false);
  protected addingToEncounter = signal(false);
  protected tableFeedback = signal<{
    kind: 'ok' | 'err';
    text: string;
    link?: 'play' | 'encounters';
  } | null>(null);
  protected encounterPickerOpen = signal(false);
  protected encounterChoices = signal<EncounterGroup[]>([]);

  protected creature = toSignal(
    this.route.paramMap.pipe(
      switchMap((params) => {
        const id = params.get('id') ?? '';
        this.error.set(null);
        this.notFound.set(false);
        this.tableFeedback.set(null);
        this.encounterPickerOpen.set(false);
        this.encounterChoices.set([]);
        return this.dataService.getCreatureById(id).pipe(
          catchError((err) => {
            if (err?.status === 404) {
              this.notFound.set(true);
            } else {
              this.error.set('Impossible de consulter cette fiche de créature.');
            }
            return of(null);
          }),
        );
      }),
    ),
    { initialValue: undefined },
  );

  /** MJ connecté : le clic vérifie campagne / session. */
  protected canAddToCampaign = computed(() => this.auth.isLoggedIn());

  protected tableCampaignId = computed(
    () => this.sessionDock.campaignId() ?? this.sessionDock.rememberedCampaignId(),
  );

  protected abilityLabels = ABILITY_LABELS;
  protected categoryLabel = getCreatureCategoryLabel;
  protected formatCr = formatChallengeRating;

  protected abilityKeys(creature: Creature): string[] {
    return ['str', 'dex', 'con', 'int', 'wis', 'cha'].filter((k) => creature.abilities[k]);
  }

  protected addToActiveTable(): void {
    const creature = this.creature();
    const campaignId = this.sessionDock.rememberedCampaignId();
    if (!creature || this.addingToTable()) return;
    if (!campaignId) {
      this.tableFeedback.set({
        kind: 'err',
        text: 'Ouvrez d’abord une campagne en session, puis réessayez.',
      });
      return;
    }

    this.addingToTable.set(true);
    this.tableFeedback.set(null);
    this.encounterPickerOpen.set(false);

    this.campaigns.get(campaignId).subscribe({
      next: (detail) => {
        if (!detail.isOwner || !detail.data.activeSessionId) {
          this.addingToTable.set(false);
          this.tableFeedback.set({
            kind: 'err',
            text: 'Entrez en session MJ pour envoyer à la table.',
          });
          return;
        }
        const combatant = combatantFromCreature(creature, creature.name, 'monster');
        const nextData = appendCreatureCombatantToSession(detail.data, combatant, {
          label: 'Combat',
        });
        if (!nextData) {
          this.addingToTable.set(false);
          this.tableFeedback.set({
            kind: 'err',
            text: 'Aucune session active sur cette campagne.',
          });
          return;
        }
        this.campaigns.update(detail.id, detail.title, nextData).subscribe({
          next: () => {
            this.addingToTable.set(false);
            this.sessionDock.patchLiveCampaign({ ...detail, data: nextData });
            this.tableFeedback.set({
              kind: 'ok',
              text: `${creature.name} ajouté à la table.`,
              link: 'play',
            });
          },
          error: () => {
            this.addingToTable.set(false);
            this.tableFeedback.set({
              kind: 'err',
              text: 'Impossible d’ajouter à la table. Réessayez.',
            });
          },
        });
      },
      error: () => {
        this.addingToTable.set(false);
        this.tableFeedback.set({
          kind: 'err',
          text: 'Impossible de charger la campagne.',
        });
      },
    });
  }

  /** Ouvre le sélecteur ou crée directement s’il n’y a aucune rencontre. */
  protected beginAddToEncounter(): void {
    const creature = this.creature();
    const campaignId = this.sessionDock.rememberedCampaignId();
    if (!creature || this.addingToEncounter()) return;
    if (!campaignId) {
      this.tableFeedback.set({
        kind: 'err',
        text: 'Ouvrez d’abord une campagne (dock session), puis réessayez.',
      });
      return;
    }

    this.tableFeedback.set(null);
    this.addingToEncounter.set(true);

    this.campaigns.get(campaignId).subscribe({
      next: (detail) => {
        if (!detail.isOwner) {
          this.addingToEncounter.set(false);
          this.tableFeedback.set({
            kind: 'err',
            text: 'Seul le MJ peut préparer une rencontre.',
          });
          return;
        }
        const list = detail.data.encounters ?? [];
        if (!list.length) {
          this.commitAddToEncounter(detail, undefined, creature);
          return;
        }
        this.encounterChoices.set(list);
        this.encounterPickerOpen.set(true);
        this.addingToEncounter.set(false);
      },
      error: () => {
        this.addingToEncounter.set(false);
        this.tableFeedback.set({
          kind: 'err',
          text: 'Impossible de charger la campagne.',
        });
      },
    });
  }

  protected cancelEncounterPicker(): void {
    this.encounterPickerOpen.set(false);
    this.encounterChoices.set([]);
  }

  protected pickEncounter(encounterId: string | 'new'): void {
    const creature = this.creature();
    const campaignId = this.sessionDock.rememberedCampaignId();
    if (!creature || !campaignId || this.addingToEncounter()) return;

    this.addingToEncounter.set(true);
    this.campaigns.get(campaignId).subscribe({
      next: (detail) => {
        if (!detail.isOwner) {
          this.addingToEncounter.set(false);
          this.tableFeedback.set({
            kind: 'err',
            text: 'Seul le MJ peut préparer une rencontre.',
          });
          return;
        }
        this.commitAddToEncounter(
          detail,
          encounterId === 'new' ? undefined : encounterId,
          creature,
        );
      },
      error: () => {
        this.addingToEncounter.set(false);
        this.tableFeedback.set({
          kind: 'err',
          text: 'Impossible de charger la campagne.',
        });
      },
    });
  }

  private commitAddToEncounter(
    detail: CampaignDetail,
    encounterId: string | undefined,
    creature: Creature,
  ): void {
    const result = appendCreatureToEncounter(detail.data, creature, {
      encounterId,
      newEncounterName: encounterId ? undefined : `Rencontre — ${creature.name}`,
    });
    this.campaigns.update(detail.id, detail.title, result.data).subscribe({
      next: () => {
        this.addingToEncounter.set(false);
        this.encounterPickerOpen.set(false);
        this.encounterChoices.set([]);
        this.sessionDock.patchLiveCampaign({ ...detail, data: result.data });
        this.tableFeedback.set({
          kind: 'ok',
          text: result.created
            ? `${creature.name} → nouvelle rencontre « ${result.encounterName} ».`
            : `${creature.name} ajouté à « ${result.encounterName} ».`,
          link: 'encounters',
        });
      },
      error: () => {
        this.addingToEncounter.set(false);
        this.tableFeedback.set({
          kind: 'err',
          text: 'Impossible d’ajouter à la rencontre. Réessayez.',
        });
      },
    });
  }
}
