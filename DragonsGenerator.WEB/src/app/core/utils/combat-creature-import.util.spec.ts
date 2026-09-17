import {
  appendCreatureCombatantToSession,
  combatantFromCreature,
  isCreatureAttackAction,
  parseAbilityModifier,
  parseAttackBonusFromText,
  parseCreatureHitPoints,
  parseDamageDiceFromText,
} from './combat-creature-import.util';
import type { Creature } from '@core/models/Creatures/creature';
import { emptyCampaignData } from '@core/models/Campaign/campaign';

function goblinFixture(): Creature {
  return {
    id: 'cre-guerrier-gobelin',
    name: 'Guerrier gobelin',
    category: 'divers',
    part: null,
    section: null,
    type: 'Humanoïde',
    armorClass: 15,
    armorNote: 'armure de cuir, bouclier',
    hitPoints: '7 (2d6)',
    woundThreshold: 3,
    speed: '9 m',
    abilities: {
      str: { score: 8, modifier: '-1' },
      dex: { score: 14, modifier: '+2' },
      con: { score: 10, modifier: '+0' },
      int: { score: 10, modifier: '+0' },
      wis: { score: 8, modifier: '-1' },
      cha: { score: 8, modifier: '-1' },
    },
    savingThrows: null,
    skills: null,
    senses: null,
    languages: null,
    challengeRating: '1/4',
    xp: 50,
    traits: [],
    actions: [
      {
        name: 'Attaques multiples',
        description: 'Le gobelin effectue deux attaques.',
      },
      {
        name: 'Cimeterre',
        description:
          "Attaque d'arme de corps à corps : +4 pour toucher, allonge 1,50 m, une cible. Réussite : 5 (1d6 + 2) dégâts tranchants.",
      },
      {
        name: 'Arc court',
        description:
          "Attaque d'arme à distance : +4 pour toucher, portée 24/96 m, une cible. Réussite : 5 (1d6 + 2) dégâts perforants.",
      },
    ],
    reactions: [],
    legendaryActions: [],
    description: '',
  };
}

describe('combat-creature-import.util', () => {
  it('parseCreatureHitPoints lit le total avant la formule', () => {
    expect(parseCreatureHitPoints('7 (2d6)')).toBe(7);
    expect(parseCreatureHitPoints('225 (18d12 + 108)')).toBe(225);
    expect(parseCreatureHitPoints(null)).toBeUndefined();
  });

  it('parseAbilityModifier et bonus / dés d’attaque', () => {
    expect(parseAbilityModifier('+2')).toBe(2);
    expect(parseAbilityModifier('-1')).toBe(-1);
    expect(
      parseAttackBonusFromText("Attaque d'arme : +4 pour toucher, allonge 1,50 m."),
    ).toBe(4);
    expect(parseDamageDiceFromText('Réussite : 5 (1d6 + 2) dégâts tranchants.')).toBe('1d6+2');
  });

  it('filtre Attaques multiples et mappe le gobelin', () => {
    expect(isCreatureAttackAction('Attaques multiples', 'Le gobelin effectue deux attaques.')).toBe(
      false,
    );
    const c = combatantFromCreature(goblinFixture(), 'Guerrier gobelin', 'monster');
    expect(c.armorClass).toBe(15);
    expect(c.maxHp).toBe(7);
    expect(c.currentHp).toBe(7);
    expect(c.initiativeBonus).toBe(2);
    expect(c.sourceCreatureId).toBe('cre-guerrier-gobelin');
    expect(c.attacks?.map((a) => a.name)).toEqual(['Cimeterre', 'Arc court']);
    expect(c.attacks?.[0]?.attackBonus).toBe(4);
    expect(c.attacks?.[0]?.damageDice).toBe('1d6+2');
  });

  it('appendCreatureCombatantToSession crée ou étend le combat', () => {
    const combatant = combatantFromCreature(goblinFixture(), 'Guerrier gobelin');
    const empty = {
      ...emptyCampaignData(),
      sessions: [{ id: 's1', title: 'S1', status: 'planned' as const, scheduledAt: '' }],
      activeSessionId: 's1',
    };

    const created = appendCreatureCombatantToSession(empty, combatant);
    expect(created?.sessions[0]?.activeCombat?.combatants.length).toBe(1);
    expect(created?.sessions[0]?.activeCombat?.combatants[0]?.name).toBe('Guerrier gobelin');

    const again = appendCreatureCombatantToSession(created!, {
      ...combatant,
      id: 'cb-2',
      name: 'Gobelin 2',
    });
    expect(again?.sessions[0]?.activeCombat?.combatants.length).toBe(2);

    expect(
      appendCreatureCombatantToSession({ ...empty, activeSessionId: null }, combatant),
    ).toBeNull();
  });
});
