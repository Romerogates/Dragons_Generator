import {
  appendCreatureCombatantToSession,
  appendCreatureToEncounter,
  combatantFromCreature,
  encounterCreatureFromCodex,
  isCreatureAttackAction,
  parseAbilityModifier,
  parseAttackBonusFromText,
  parseCreatureHitPoints,
  parseDamageDiceFromText,
} from './combat-creature-import.util';
import type { Creature } from '@core/models/Creatures/creature';
import { emptyCampaignData } from '@core/models/Campaign/campaign';

function goblinFixture(overrides: Partial<Creature> = {}): Creature {
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
    ...overrides,
  };
}

describe('combat-creature-import.util', () => {
  it('parseCreatureHitPoints lit le total avant la formule', () => {
    expect(parseCreatureHitPoints('7 (2d6)')).toBe(7);
    expect(parseCreatureHitPoints('225 (18d12 + 108)')).toBe(225);
    expect(parseCreatureHitPoints(null)).toBeUndefined();
    expect(parseCreatureHitPoints(undefined)).toBeUndefined();
    expect(parseCreatureHitPoints('')).toBeUndefined();
    expect(parseCreatureHitPoints('  ')).toBeUndefined();
    expect(parseCreatureHitPoints('pv inconnus')).toBeUndefined();
  });

  it('parseAbilityModifier et bonus / dés d’attaque', () => {
    expect(parseAbilityModifier('+2')).toBe(2);
    expect(parseAbilityModifier('-1')).toBe(-1);
    expect(parseAbilityModifier(null)).toBeUndefined();
    expect(parseAbilityModifier(undefined)).toBeUndefined();
    expect(parseAbilityModifier('')).toBeUndefined();
    expect(parseAbilityModifier('mod')).toBeUndefined();

    expect(
      parseAttackBonusFromText("Attaque d'arme : +4 pour toucher, allonge 1,50 m."),
    ).toBe(4);
    expect(parseAttackBonusFromText("+5 au jet d'attaque")).toBe(5);
    expect(parseAttackBonusFromText("jet d'attaque +3")).toBe(3);
    expect(parseAttackBonusFromText('-2 à toucher')).toBe(-2);
    expect(parseAttackBonusFromText(null)).toBe(0);
    expect(parseAttackBonusFromText('pas de bonus')).toBe(0);

    expect(parseDamageDiceFromText('Réussite : 5 (1d6 + 2) dégâts tranchants.')).toBe('1d6+2');
    expect(parseDamageDiceFromText('2d8')).toBe('2d8');
    expect(parseDamageDiceFromText(null)).toBeUndefined();
    expect(parseDamageDiceFromText('aucun dé')).toBeUndefined();
  });

  it('isCreatureAttackAction ignore en-têtes et exige un motif d’attaque', () => {
    expect(isCreatureAttackAction('Attaques multiples', 'Le gobelin effectue deux attaques.')).toBe(
      false,
    );
    expect(isCreatureAttackAction('Attaque multiple', 'Deux attaques.')).toBe(false);
    expect(isCreatureAttackAction('Change-forme', 'Le doppelgänger se transforme.')).toBe(false);
    expect(isCreatureAttackAction('Métamorphe', 'Change d’apparence.')).toBe(false);
    expect(
      isCreatureAttackAction('Cimeterre', "Attaque d'arme : +4 pour toucher. 1d6 dégâts."),
    ).toBe(true);
    expect(isCreatureAttackAction('Cri', 'Effraie les ennemis proches.')).toBe(false);
    expect(isCreatureAttackAction('Morsure', null)).toBe(false);
  });

  it('filtre Attaques multiples et mappe le gobelin', () => {
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

  it('combatantFromCreature gère fallbacks dex / CA / sans attaques', () => {
    const viaDexterite = combatantFromCreature(
      goblinFixture({
        armorClass: 0,
        abilities: { dexterite: { score: 16, modifier: '+3' } } as Creature['abilities'],
        actions: [],
      }),
      'Sans attaque',
    );
    expect(viaDexterite.armorClass).toBe(10);
    expect(viaDexterite.initiativeBonus).toBe(3);
    expect(viaDexterite.attacks).toBeUndefined();

    const viaDexterity = combatantFromCreature(
      goblinFixture({
        abilities: { dexterity: { score: 12, modifier: '+1' } } as Creature['abilities'],
        actions: undefined,
      }),
      'Ally',
      'npc',
    );
    expect(viaDexterity.initiativeBonus).toBe(1);
    expect(viaDexterity.kind).toBe('npc');

    const noAbilities = combatantFromCreature(
      goblinFixture({
        abilities: undefined as unknown as Creature['abilities'],
        hitPoints: undefined as unknown as string,
      }),
      'Neutre',
    );
    expect(noAbilities.initiativeBonus).toBe(0);
    expect(noAbilities.maxHp).toBeUndefined();
  });

  it('appendCreatureCombatantToSession crée ou étend le combat', () => {
    const combatant = combatantFromCreature(goblinFixture(), 'Guerrier gobelin');
    const empty = {
      ...emptyCampaignData(),
      sessions: [{ id: 's1', title: 'S1', status: 'planned' as const, scheduledAt: '' }],
      activeSessionId: 's1',
    };

    const created = appendCreatureCombatantToSession(empty, combatant, { label: 'Rencontre' });
    expect(created?.sessions[0]?.activeCombat?.combatants.length).toBe(1);
    expect(created?.sessions[0]?.activeCombat?.combatants[0]?.name).toBe('Guerrier gobelin');
    expect(created?.sessions[0]?.activeCombat?.label).toBe('Rencontre');

    const again = appendCreatureCombatantToSession(created!, {
      ...combatant,
      id: 'cb-2',
      name: 'Gobelin 2',
    });
    expect(again?.sessions[0]?.activeCombat?.combatants.length).toBe(2);

    const defaultLabel = appendCreatureCombatantToSession(empty, combatant);
    expect(defaultLabel?.sessions[0]?.activeCombat?.label).toBe('Combat');

    expect(
      appendCreatureCombatantToSession({ ...empty, activeSessionId: null }, combatant),
    ).toBeNull();
    expect(
      appendCreatureCombatantToSession({ ...empty, activeSessionId: 'missing' }, combatant),
    ).toBeNull();
    expect(
      appendCreatureCombatantToSession(
        { ...empty, sessions: undefined as unknown as typeof empty.sessions },
        combatant,
      ),
    ).toBeNull();
  });

  it('appendCreatureToEncounter crée ou enrichit une rencontre', () => {
    const creature = goblinFixture();
    const line = encounterCreatureFromCodex(creature);
    expect(line.creatureId).toBe('cre-guerrier-gobelin');
    expect(line.quantity).toBe(1);

    const created = appendCreatureToEncounter(emptyCampaignData(), creature);
    expect(created.created).toBeTrue();
    expect(created.data.encounters.length).toBe(1);
    expect(created.encounterName).toContain('Guerrier gobelin');

    const bumped = appendCreatureToEncounter(created.data, creature, {
      encounterId: created.encounterId,
    });
    expect(bumped.created).toBeFalse();
    expect(bumped.data.encounters[0]?.creatures[0]?.quantity).toBe(2);

    const other = appendCreatureToEncounter(created.data, goblinFixture({ id: 'cre-autre', name: 'Autre' }), {
      encounterId: created.encounterId,
    });
    expect(other.data.encounters[0]?.creatures.length).toBe(2);

    const named = appendCreatureToEncounter(emptyCampaignData(), creature, {
      newEncounterName: 'Embuscade',
    });
    expect(named.encounterName).toBe('Embuscade');
  });
});
