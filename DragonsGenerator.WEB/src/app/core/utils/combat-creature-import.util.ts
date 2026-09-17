import type { Creature } from '@core/models/Creatures/creature';
import type {
  CampaignData,
  Combatant,
  CombatantAttack,
} from '@core/models/Campaign/campaign';
import { createActiveCombat, createCombatant } from '@core/utils/combat-tracker.util';

const ATTACK_ACTION_RE =
  /pour\s+toucher|à\s+toucher|au\s+jet\s+d['']attaque|attaque\s+d['']arme|\d+d\d+/i;

/** Ignore les lignes d’en-tête (Attaques multiples, Change-forme, …). */
export function isCreatureAttackAction(name: string, description: string | undefined | null): boolean {
  const n = name.trim().toLowerCase();
  if (
    n.startsWith('attaques multiples') ||
    n.startsWith('attaque multiple') ||
    n.startsWith('change-forme') ||
    n.startsWith('métamorphe')
  ) {
    return false;
  }
  return ATTACK_ACTION_RE.test(description ?? '');
}

export function parseCreatureHitPoints(raw: string | undefined | null): number | undefined {
  if (!raw) return undefined;
  const m = String(raw).trim().match(/^(\d+)/);
  return m ? Number(m[1]) : undefined;
}

export function parseAbilityModifier(raw: string | undefined | null): number | undefined {
  if (!raw) return undefined;
  const m = String(raw).trim().match(/^([+-]?\d+)/);
  return m ? Number(m[1]) : undefined;
}

export function parseAttackBonusFromText(text: string | undefined | null): number {
  if (!text) return 0;
  const m =
    text.match(/\+\s*(\d+)\s*(?:au\s+jet\s+d['']attaque|pour\s+toucher|à\s+toucher)?/i) ??
    text.match(/jet\s+d['']attaque\s+([+-]\d+)/i) ??
    text.match(/([+-]\d+)\s*(?:pour\s+toucher|à\s+toucher)/i);
  return m ? Number(m[1]) : 0;
}

export function parseDamageDiceFromText(text: string | undefined | null): string | undefined {
  if (!text) return undefined;
  const m = text.match(/(\d+d\d+(?:\s*[+-]\s*\d+)?)/i);
  return m ? m[1]!.replace(/\s+/g, '') : undefined;
}

/** Mappe une fiche Codex → combattant (CA / PV / attaques). */
export function combatantFromCreature(
  creature: Creature,
  displayName: string,
  kind: Combatant['kind'] = 'monster',
): Combatant {
  const maxHp = parseCreatureHitPoints(creature.hitPoints);
  const abilities = creature.abilities ?? {};
  const dexMod =
    parseAbilityModifier(abilities['dex']?.modifier) ??
    parseAbilityModifier(abilities['dexterite']?.modifier) ??
    parseAbilityModifier(abilities['dexterity']?.modifier) ??
    0;
  const attacks: CombatantAttack[] = (creature.actions ?? [])
    .filter((a) => isCreatureAttackAction(a.name, a.description))
    .slice(0, 5)
    .map((a) => ({
      name: a.name,
      attackBonus: parseAttackBonusFromText(a.description),
      damageDice: parseDamageDiceFromText(a.description),
    }));
  return createCombatant({
    name: displayName,
    kind,
    armorClass: creature.armorClass || 10,
    maxHp,
    currentHp: maxHp,
    initiativeBonus: dexMod,
    attacks: attacks.length ? attacks : undefined,
    sourceCreatureId: creature.id,
  });
}

/**
 * Ajoute un combattant au combat de la session active.
 * Crée un combat (setup) s’il n’y en a pas encore.
 * @returns null si pas de session active
 */
export function appendCreatureCombatantToSession(
  data: CampaignData,
  combatant: Combatant,
  options?: { label?: string },
): CampaignData | null {
  const activeId = data.activeSessionId;
  if (!activeId) return null;
  const sessions = data.sessions ?? [];
  const session = sessions.find((s) => s.id === activeId);
  if (!session) return null;

  const nextCombat = session.activeCombat
    ? {
        ...session.activeCombat,
        combatants: [...session.activeCombat.combatants, combatant],
      }
    : createActiveCombat([combatant], { label: options?.label ?? 'Combat' });

  return {
    ...data,
    sessions: sessions.map((s) =>
      s.id === activeId ? { ...s, activeCombat: nextCombat } : s,
    ),
  };
}
