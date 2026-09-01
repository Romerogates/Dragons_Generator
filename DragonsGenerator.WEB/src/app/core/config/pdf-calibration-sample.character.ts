import type { Character, ClericSpellcasting } from '@core/models/Character/character';

/** Personnage prêtre minimal pour calibrer le grimoire avec le vrai générateur PDF. */
export function buildGrimoireCalibrationSampleCharacter(): Character {
  const spellcasting: ClericSpellcasting = {
    kind: 'cleric',
    ability: 'Sagesse',
    spellSaveDC: 12,
    spellAttackBonus: 4,
    focus: 'eq-amulette',
    cantrips: { max: 3, used: 3 },
    spellSlots: [
      { level: 1, max: 2, used: 0 },
      { level: 2, max: 0, used: 0 },
      { level: 3, max: 0, used: 0 },
      { level: 4, max: 0, used: 0 },
      { level: 5, max: 0, used: 0 },
      { level: 6, max: 0, used: 0 },
      { level: 7, max: 0, used: 0 },
      { level: 8, max: 0, used: 0 },
      { level: 9, max: 0, used: 0 },
    ],
    deity: 'Mort',
    domain: 'Indicible',
    divineChannels: [
      {
        id: 'ch-turn-undead',
        name: 'Renvoi des morts-vivants',
        desc: '',
        uses: { max: 1, current: 1 },
      },
    ],
  };

  return {
    id: 'calibration-cleric',
    name: 'Test',
    species: { label: 'Gnome (des roches)', subspeciesLabel: null, refId: 'sp-gnome' },
    civilization: { label: 'Cité Franche', refId: 'civ-franche' },
    classes: [{ classLabel: 'Prêtre', subclassLabel: 'Indicible', refId: 'cls-pretre', level: 1, hitDie: 8 }],
    totalLevel: 1,
    proficiencyBonus: 2,
    abilities: { force: 10, dexterite: 12, constitution: 14, intelligence: 10, sagesse: 16, charisme: 10 },
    abilityModifiers: { force: 0, dexterite: 1, constitution: 2, intelligence: 0, sagesse: 3, charisme: 0 },
    proficiencies: { savingThrows: [], skills: [], armor: [], weapons: [], tools: [], languages: [] },
    vitality: { hitPointsCurrent: 8, hitPointsMax: 8, hitPointsTemporary: 0, woundThreshold: 4 },
    defense: { armorClass: 16 },
    initiative: 1,
    senses: { passivePerception: 14 },
    movement: { walk: 7.5, climb: 0, swim: 0, jumpHeight: 0, jumpLength: 0 },
    attacks: [{ name: "Masse d'armes", attackBonus: 4, damage: '1d6+2', damageType: 'contondant' }],
    equipment: [],
    personality: {},
    spellcasting,
    knownSpells: [
      {
        refId: 'spl-imprecation',
        name: 'Imprécation',
        level: 1,
        prepared: true,
        pageRef: 'p.123',
        effectSummary: "V,S · 1 min · Jusqu'à trois créatures de votre choix…",
      },
      {
        refId: 'spl-guidance',
        name: 'Guidance',
        level: 0,
        prepared: false,
        pageRef: 'p.45',
        effectSummary: 'V,S · 1 min · La cible peut ajouter 1d4…',
      },
    ],
  } as unknown as Character;
}
