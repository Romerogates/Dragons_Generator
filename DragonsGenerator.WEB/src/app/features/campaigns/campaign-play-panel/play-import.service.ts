import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { CampaignCloudService } from '@core/services/campaign-cloud.service';
import { CharacterHandoffService } from '@core/services/character-handoff.service';
import { DataService } from '@core/services/data.service';
import { AuthService } from '@core/services/auth.service';
import type { Character } from '@core/models/Character/character';
import type { Creature } from '@core/models/Creatures/creature';
import type { CreatureSummary } from '@core/models/Creatures/creature-summary';
import type { StoryCreatureSelection } from '@core/models/Story/story';
import {
  ActiveCombat,
  CampaignMember,
  CampaignSession,
  Combatant,
  EncounterGroup,
  type CampaignDetail as CampaignDetailModel,
} from '@core/models/Campaign/campaign';
import {
  createActiveCombat,
  createCombatant,
  expandEncounterToCombatants,
  isCombatantDefeated,
} from '@core/utils/combat-tracker.util';
import { combatantFromCreature } from '@core/utils/combat-creature-import.util';
import { snapshotAttacksFromCharacter } from '@core/utils/combat-action.util';
import {
  approvedMembersNotInCombat,
  exclusivePlayImportPickers,
  type PlayImportPicker,
} from '@core/utils/play-combat-session.util';
import { CampaignPlaySessionStore } from '../campaign-play-session-store/campaign-play-session.store';

export type PlayImportHooks = {
  campaign: () => CampaignDetailModel;
  isDm: () => boolean;
  activeCombat: () => ActiveCombat | null;
  activeSession: () => CampaignSession | null;
  approvedPlayers: () => CampaignMember[];
  setFeedback: (
    kind: 'ok' | 'err',
    text: string,
    ttlMsOrOpts?: number | { ttlMs?: number; undo?: () => void },
  ) => void;
  clearFeedback: () => void;
  startCombatFromEncounter: (encounter: EncounterGroup) => void;
  setCombatantDefeated: (combatantId: string, defeated: boolean) => void;
  reload: () => void;
};

/**
 * Import party / codex / rencontres + fiches. Persist = CampaignPlaySessionStore.
 */
@Injectable()
export class PlayImportService {
  private readonly campaigns = inject(CampaignCloudService);
  private readonly data = inject(DataService);
  private readonly handoff = inject(CharacterHandoffService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly playStore = inject(CampaignPlaySessionStore);
  private hooks: PlayImportHooks | null = null;

  readonly importingParty = signal(false);
  readonly allyPickerOpen = signal(false);
  readonly enemyPickerOpen = signal(false);
  readonly campaignAllyPickerOpen = signal(false);
  readonly importingAllyId = signal<string | null>(null);
  readonly importingCreatureId = signal<string | null>(null);
  readonly codexCreatureSummaries = signal<CreatureSummary[]>([]);
  readonly codexCreatureSearch = signal('');
  readonly codexCreaturesLoading = signal(false);
  readonly sheetLoadingId = signal<string | null>(null);

  readonly filteredCodexCreatures = computed(() => {
    const q = this.codexCreatureSearch().trim().toLowerCase();
    const list = this.codexCreatureSummaries();
    if (!q) return list.slice(0, 24);
    return list
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q) ||
          (c.section?.toLowerCase().includes(q) ?? false) ||
          (c.part?.toLowerCase().includes(q) ?? false),
      )
      .slice(0, 36);
  });

  configure(hooks: PlayImportHooks): void {
    this.hooks = hooks;
  }

  resetPickers(): void {
    this.allyPickerOpen.set(false);
    this.enemyPickerOpen.set(false);
    this.campaignAllyPickerOpen.set(false);
    this.codexCreatureSearch.set('');
  }

  importPartyIntoCombat(): void {
    const approved = this.hooks?.approvedPlayers() ?? [];
    if (!approved.length) {
      this.hooks?.setFeedback(
        'err',
        'Aucun personnage joueur approuvé. Ajoutez un allié joueur ou un PNJ.',
      );
      return;
    }
    const existing = this.hooks?.activeCombat();
    const toImport = approvedMembersNotInCombat(approved, existing?.combatants ?? []);
    if (!toImport.length) {
      this.hooks?.setFeedback('ok', 'Tous les PJ approuvés sont déjà dans le combat.');
      return;
    }
    this.importMembersIntoCombat(toImport);
  }

  toggleAllyPicker(): void {
    this.applyImportPickers(this.allyPickerOpen() ? null : 'ally');
  }

  toggleCampaignAllyPicker(): void {
    this.applyImportPickers(this.campaignAllyPickerOpen() ? null : 'campaignAlly');
  }

  toggleEnemyPicker(): void {
    const opening = !this.enemyPickerOpen();
    this.applyImportPickers(opening ? 'enemy' : null);
    if (opening) this.ensureCodexCreatureSummaries();
    else this.codexCreatureSearch.set('');
  }

  setCodexCreatureSearch(value: string): void {
    this.codexCreatureSearch.set(value);
  }

  openMySheet(): void {
    const userId = this.auth.user()?.id;
    if (!userId) return;
    const mine = (this.hooks?.approvedPlayers() ?? []).find((p) => p.userId === userId);
    if (mine) this.openMemberSheet(mine, 'Votre héros à la table');
  }

  openCombatantSheet(combatant: Combatant, member: CampaignMember | null): void {
    if (!member) return;
    const label =
      member.userId === this.auth.user()?.id
        ? 'Votre héros à la table'
        : `${member.approvedCharacterName ?? member.displayName} (table)`;
    this.openMemberSheet(member, label);
  }

  openMemberSheet(member: CampaignMember, sourceLabel = 'Héros de la table'): void {
    if (!member.approvedCharacterId || this.sheetLoadingId() || !this.hooks) return;
    this.sheetLoadingId.set(member.id);
    this.hooks.clearFeedback();
    const campaignId = this.hooks.campaign().id;
    const returnUrl = `/campaigns/${campaignId}/play`;
    this.campaigns.getMemberCharacter(campaignId, member.id, 'approved').subscribe({
      next: (res) => {
        const character = { ...(res.data as object) } as Character;
        if (res.name) character.name = res.name;
        this.handoff.setCurrent(character, {
          mode: 'consult',
          sourceLabel,
          returnUrl,
        });
        this.sheetLoadingId.set(null);
        void this.router.navigate(['/character-sheet']);
      },
      error: () => {
        this.sheetLoadingId.set(null);
        this.hooks?.setFeedback('err', 'Impossible d’ouvrir la fiche.');
      },
    });
  }

  importPlayerAlly(member: CampaignMember): void {
    this.importMembersIntoCombat([member], { closePicker: true });
  }

  addCampaignCreatureAlly(selection: StoryCreatureSelection): void {
    this.addCampaignCreature(selection, 'ally');
  }

  addCampaignCreatureEnemy(selection: StoryCreatureSelection): void {
    this.addCampaignCreature(selection, 'enemy');
  }

  addCodexCreatureEnemy(summary: CreatureSummary): void {
    if (this.importingCreatureId() || this.importingParty()) return;
    this.importingCreatureId.set(summary.id);
    this.hooks?.clearFeedback();

    this.data.getCreatureById(summary.id).subscribe({
      next: (creature) => {
        this.importingCreatureId.set(null);
        this.enemyPickerOpen.set(false);
        this.codexCreatureSearch.set('');
        const combatant = this.combatantFromCreature(
          creature,
          creature.name || summary.name,
          'monster',
        );
        this.appendCombatants([combatant], combatant.name);
      },
      error: () => {
        this.importingCreatureId.set(null);
        const combatant = createCombatant({
          name: summary.name,
          kind: 'monster',
          armorClass: summary.armorClass || 10,
          initiativeBonus: 0,
        });
        this.appendCombatants([combatant], combatant.name);
        this.hooks?.setFeedback('err', 'Fiche créature incomplète — CA/PV à saisir manuellement.');
      },
    });
  }

  addEncounterToCombat(encounter: EncounterGroup): void {
    const base = expandEncounterToCombatants(encounter);
    if (!base.length) {
      this.hooks?.setFeedback('err', 'Cette rencontre n’a aucune créature.');
      return;
    }

    const requests = encounter.creatures.flatMap((cr, creatureIndex) =>
      Array.from({ length: cr.quantity }, (_, unitIndex) =>
        this.data.getCreatureById(cr.creatureId).pipe(
          map((creature) => {
            const baseName = cr.customName || cr.creatureName || creature.name;
            const name = cr.quantity > 1 ? `${baseName} ${unitIndex + 1}` : baseName;
            const combatant = this.combatantFromCreature(creature, name);
            return {
              ...combatant,
              encounterLink: { encounterId: encounter.id, creatureIndex, unitIndex },
              defeated: unitIndex < cr.defeated,
              currentHp: unitIndex < cr.defeated ? 0 : combatant.currentHp,
            } satisfies Combatant;
          }),
          catchError(() => {
            const fallback = base.find(
              (c) =>
                c.encounterLink?.creatureIndex === creatureIndex &&
                c.encounterLink?.unitIndex === unitIndex,
            );
            return of(
              fallback ??
                createCombatant({
                  name: cr.customName || cr.creatureName,
                  kind: 'monster',
                  armorClass: 10,
                }),
            );
          }),
        ),
      ),
    );

    this.importingParty.set(true);
    forkJoin(requests).subscribe({
      next: (combatants) => {
        this.importingParty.set(false);
        const current = this.hooks?.activeCombat();
        if (current) {
          this.playStore.patchCombat({
            ...current,
            combatants: [...current.combatants, ...combatants],
            label: current.label || encounter.name,
            encounterId: current.encounterId || encounter.id,
          });
        } else {
          this.playStore.setActiveCombat(
            createActiveCombat(combatants, { label: encounter.name, encounterId: encounter.id }),
          );
        }
        this.hooks?.setFeedback(
          'ok',
          `Rencontre « ${encounter.name} » ajoutée (${combatants.length} adversaire(s)).`,
        );
      },
      error: () => {
        this.importingParty.set(false);
        this.hooks?.startCombatFromEncounter(encounter);
      },
    });
  }

  markDefeated(encounterId: string, creatureIndex: number): void {
    if (!this.hooks?.isDm()) return;
    const combat = this.hooks.activeCombat();
    if (combat?.encounterId === encounterId) {
      const target = combat.combatants.find(
        (cb) =>
          cb.encounterLink?.encounterId === encounterId &&
          cb.encounterLink.creatureIndex === creatureIndex &&
          !isCombatantDefeated(cb),
      );
      if (target) {
        this.hooks.setCombatantDefeated(target.id, true);
        return;
      }
    }
    this.playStore.bumpEncounterDefeated(encounterId, creatureIndex, 1);
  }

  undoDefeated(encounterId: string, creatureIndex: number): void {
    if (!this.hooks?.isDm()) return;
    const combat = this.hooks.activeCombat();
    if (combat?.encounterId === encounterId) {
      const defeated = combat.combatants.filter(
        (cb) =>
          cb.encounterLink?.encounterId === encounterId &&
          cb.encounterLink.creatureIndex === creatureIndex &&
          isCombatantDefeated(cb),
      );
      const target = defeated[defeated.length - 1];
      if (target) {
        this.hooks.setCombatantDefeated(target.id, false);
        return;
      }
    }
    this.playStore.bumpEncounterDefeated(encounterId, creatureIndex, -1);
  }

  distributeEncounterXp(encounter: EncounterGroup): void {
    this.playStore.awardEncounterXp(encounter);
  }

  proposeCharacterFromPlay(characterId: string): void {
    this.playStore.proposeCharacter(characterId, () => this.hooks?.reload());
  }

  private applyImportPickers(open: PlayImportPicker | null): void {
    const flags = exclusivePlayImportPickers(open);
    this.allyPickerOpen.set(flags.ally);
    this.campaignAllyPickerOpen.set(flags.campaignAlly);
    this.enemyPickerOpen.set(flags.enemy);
  }

  private ensureCodexCreatureSummaries(): void {
    if (this.codexCreatureSummaries().length || this.codexCreaturesLoading()) return;
    this.codexCreaturesLoading.set(true);
    this.data.getCreaturesSummary().subscribe({
      next: (list) => {
        this.codexCreatureSummaries.set(list ?? []);
        this.codexCreaturesLoading.set(false);
      },
      error: () => {
        this.codexCreaturesLoading.set(false);
        this.hooks?.setFeedback('err', 'Impossible de charger le bestiaire codex.');
      },
    });
  }

  private addCampaignCreature(
    selection: StoryCreatureSelection,
    side: 'ally' | 'enemy',
  ): void {
    if (this.importingCreatureId() || this.importingParty()) return;
    this.importingCreatureId.set(selection.creatureId);
    this.hooks?.clearFeedback();

    this.data.getCreatureById(selection.creatureId).subscribe({
      next: (creature) => {
        this.importingCreatureId.set(null);
        this.enemyPickerOpen.set(false);
        this.campaignAllyPickerOpen.set(false);
        const combatant = this.combatantFromCreature(
          creature,
          selection.customName?.trim() || selection.creatureName,
          side === 'ally' ? 'npc' : 'monster',
        );
        this.appendCombatants([combatant], selection.customName || selection.creatureName);
      },
      error: () => {
        this.importingCreatureId.set(null);
        const combatant = createCombatant({
          name: selection.customName?.trim() || selection.creatureName,
          kind: side === 'ally' ? 'npc' : 'monster',
          armorClass: 10,
          initiativeBonus: 0,
        });
        this.appendCombatants([combatant], combatant.name);
        this.hooks?.setFeedback('err', 'Fiche créature incomplète — CA/PV à saisir manuellement.');
      },
    });
  }

  private appendCombatants(combatants: Combatant[], feedbackName?: string): void {
    const current = this.hooks?.activeCombat();
    if (current) {
      this.playStore.patchCombat(
        {
          ...current,
          combatants: [...current.combatants, ...combatants],
        },
        { immediate: true },
      );
    } else {
      this.playStore.setActiveCombat(createActiveCombat(combatants, { label: 'Combat' }));
    }
    if (feedbackName) {
      this.hooks?.setFeedback('ok', `${feedbackName} ajouté au combat.`);
    }
  }

  private combatantFromCreature(
    creature: Creature,
    displayName: string,
    kind: Combatant['kind'] = 'monster',
  ): Combatant {
    return combatantFromCreature(creature, displayName, kind);
  }

  private importMembersIntoCombat(
    members: CampaignMember[],
    options?: { closePicker?: boolean },
  ): void {
    if (!this.hooks?.activeSession() || !members.length) return;
    if (this.importingParty() || this.importingAllyId()) return;

    this.importingParty.set(true);
    if (members.length === 1) this.importingAllyId.set(members[0]!.id);
    this.hooks.clearFeedback();

    const campaignId = this.hooks.campaign().id;

    type ImportRow = { combatant: Combatant; incomplete: boolean };
    const requests = members.map((p) =>
      this.campaigns.getMemberCharacter(campaignId, p.id, 'approved').pipe(
        map((res): ImportRow => {
          const character = {
            ...(res.data as object),
            id: res.id,
            name: res.name ?? p.approvedCharacterName,
          } as Character;
          const combatant = this.combatantFromCharacter(character, p.userId);
          const incomplete =
            combatant.maxHp === undefined ||
            combatant.maxHp === null ||
            combatant.currentHp === undefined;
          return { combatant, incomplete };
        }),
        catchError(() =>
          of({
            combatant: createCombatant({
              name: p.approvedCharacterName ?? p.displayName,
              kind: 'player',
              initiativeBonus: 0,
              memberUserId: p.userId,
              armorClass: 10,
            }),
            incomplete: true,
          } satisfies ImportRow),
        ),
      ),
    );

    forkJoin(requests).subscribe({
      next: (rows) => {
        this.importingParty.set(false);
        this.importingAllyId.set(null);
        if (options?.closePicker) this.allyPickerOpen.set(false);

        const partyCombatants = rows.map((r) => r.combatant);
        const incomplete = rows.filter((r) => r.incomplete).length;
        const current = this.hooks?.activeCombat();

        if (current) {
          this.playStore.patchCombat({
            ...current,
            combatants: [...current.combatants, ...partyCombatants],
          });
        } else {
          this.playStore.setActiveCombat(createActiveCombat(partyCombatants, { label: 'Combat' }));
        }

        const parts = [
          members.length === 1
            ? `${partyCombatants[0]?.name ?? 'Héros'} ajouté`
            : `+${partyCombatants.length} PJ importé(s)`,
        ];
        if (incomplete > 0) {
          parts.push(`${incomplete} fiche(s) incomplète(s) — vérifiez PV / init`);
        }
        this.hooks?.setFeedback(incomplete > 0 ? 'err' : 'ok', parts.join(' · '));
      },
      error: () => {
        this.importingParty.set(false);
        this.importingAllyId.set(null);
        this.hooks?.setFeedback('err', 'Impossible d’ajouter le personnage. Réessayez.');
      },
    });
  }

  private combatantFromCharacter(character: Character, memberUserId?: string): Combatant {
    const maxHp =
      typeof character.vitality?.hitPointsMax === 'number'
        ? character.vitality.hitPointsMax
        : undefined;
    const armorClass =
      typeof character.defense?.armorClass === 'number'
        ? character.defense.armorClass
        : undefined;
    return createCombatant({
      name: character.name || 'Sans nom',
      kind: 'player',
      initiativeBonus: character.initiative ?? 0,
      maxHp,
      currentHp: maxHp,
      armorClass,
      attacks: snapshotAttacksFromCharacter(character.attacks),
      characterId: (character as { id?: string }).id ?? null,
      memberUserId: memberUserId ?? null,
    });
  }
}
