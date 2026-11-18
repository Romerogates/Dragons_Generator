export type CombatantKind = 'player' | 'monster' | 'npc';

export interface CombatantEncounterLink {
  encounterId: string;
  creatureIndex: number;
  /** Index de l'unité dans le groupe (0 … quantity−1). */
  unitIndex: number;
}

/** Snapshot d'attaque pour le tracker (import party / créature). */
export interface CombatantAttack {
  name: string;
  attackBonus: number;
  /** Ex. "1d8+3" ou "1d6". */
  damageDice?: string;
  damageBonus?: number;
  damageType?: string;
}

export interface Combatant {
  id: string;
  name: string;
  kind: CombatantKind;
  initiativeBonus: number;
  initiativeRoll?: number;
  currentHp?: number;
  maxHp?: number;
  conditions?: string[];
  /** Lien vers une ligne de rencontre (monstres importés). */
  encounterLink?: CombatantEncounterLink;
  /** Unité hors de combat (sync +1 kill sur la rencontre). */
  defeated?: boolean;
  /** Joueur lié (collecte d'initiative). */
  memberUserId?: string | null;
  /** Jet soumis par le joueur via la collecte. */
  playerSubmitted?: boolean;
  /** CA snapshot (affichage / résolution d'attaque). */
  armorClass?: number;
  /** Attaques snapshot à l'import. */
  attacks?: CombatantAttack[];
  /** Perso cloud lié (PJ). */
  characterId?: string | null;
  /** Id fiche Codex d’origine (bestiaire). */
  sourceCreatureId?: string | null;
  /** URL portrait jeton (https ou data:) — optionnel. */
  tokenImageUrl?: string | null;
  /** Position sur la carte de session (grille 0-based). */
  mapX?: number;
  mapY?: number;
}

export interface ActiveCombat {
  id: string;
  label?: string;
  encounterId?: string;
  round?: number;
  turnIndex: number;
  combatants: Combatant[];
  /** Collecte ouverte : les joueurs peuvent saisir leur jet. */
  collectingInitiative?: boolean;
  /** Code court partagé avec les joueurs. */
  initiativeCode?: string;
  /** Ordre manuel entre combattants à égalité d'initiative (ids). */
  turnOrderIds?: string[];
  /**
   * Fil guidé MJ : setup (roster) → initiative (ordre) → fight (menu Pokémon).
   * Absent → déduit (rétrocompat).
   */
  flowPhase?: 'setup' | 'initiative' | 'fight';
}

export interface CombatHistoryEntry {
  id: string;
  endedAt: string;
  label?: string;
  encounterId?: string;
  round: number;
  summary: string;
}
