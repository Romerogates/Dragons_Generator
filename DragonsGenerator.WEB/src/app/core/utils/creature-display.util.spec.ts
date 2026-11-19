import {
  creatureBlockBody,
  getCreatureIcon,
  isDanglingCodexIntro,
  tidyCreatureLore,
  visibleCreatureBlocks,
} from './creature-display.util';

describe('creature-display.util Codex leftovers', () => {
  it('isDanglingCodexIntro flags short colon-only headers', () => {
    expect(isDanglingCodexIntro('Le dragon utilise l’un des deux souffles suivants :')).toBeTrue();
    expect(isDanglingCodexIntro('Le vampire est affecté des handicaps suivants :')).toBeTrue();
    expect(
      isDanglingCodexIntro('Attaque d’arme de corps à corps : +6 pour toucher, allonge 1,50 m.'),
    ).toBeFalse();
    expect(isDanglingCodexIntro('Lore sur deux lignes.\nVoici :')).toBeFalse();
  });

  it('creatureBlockBody hides dangling intros but keeps titled recharge rows', () => {
    expect(
      creatureBlockBody('Le dragon utilise l’un des deux souffles suivants :'),
    ).toBeNull();
    expect(creatureBlockBody('Cône de froid 4,50 m. JS Constitution DD 13.')).toBe(
      'Cône de froid 4,50 m. JS Constitution DD 13.',
    );
    const visible = visibleCreatureBlocks([
      { name: 'Souffle (recharge 5-6)', description: 'Le dragon utilise l’un des deux souffles suivants :' },
      { name: 'Souffle glacé', description: 'Cône de froid 4,50 m. JS Constitution DD 13.' },
    ]);
    expect(visible.map((b) => b.name)).toEqual(['Souffle (recharge 5-6)', 'Souffle glacé']);
  });

  it('getCreatureIcon picks a portrait from name then type then category', () => {
    expect(getCreatureIcon({ name: 'Vampire' })).toBe('fluent-emoji:man-vampire');
    expect(getCreatureIcon({ name: 'Squelette' })).toBe('fluent-emoji:skull');
    expect(getCreatureIcon({ name: 'Dragonnet d’argent' })).toBe('fluent-emoji:dragon');
    expect(getCreatureIcon({ name: 'Guerrier gobelin' })).toBe('fluent-emoji:goblin');
    expect(getCreatureIcon({ name: 'Aigle géant' })).toBe('fluent-emoji:eagle');
    expect(getCreatureIcon({ name: 'Golem de fer' })).toBe('fluent-emoji:robot');
    expect(getCreatureIcon({ name: 'Archimage' })).toBe('fluent-emoji:man-mage');
    expect(getCreatureIcon({ name: 'Sorcier de la tour' })).not.toBe('fluent-emoji:ogre');
    expect(getCreatureIcon({ name: 'Inconnu', type: 'Mort-vivant de taille M' })).toBe(
      'fluent-emoji:skull',
    );
    expect(getCreatureIcon({ name: 'PNJ', category: 'croyants' })).toBe(
      'fluent-emoji:place-of-worship',
    );
  });

  it('tidyCreatureLore drops a truncated last clause', () => {
    expect(tidyCreatureLore('Des araignées solitaires. En voici quelques variantes :')).toBe(
      'Des araignées solitaires.',
    );
    expect(tidyCreatureLore('Un dragon d’argent au nid caché.')).toBe(
      'Un dragon d’argent au nid caché.',
    );
  });
});
