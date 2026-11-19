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
    expect(getCreatureIcon({ name: 'Dragonnet d’argent' })).toBe('fluent-emoji:dragon-silver');
    expect(getCreatureIcon({ name: 'Dragon blanc adulte' })).toBe('fluent-emoji:dragon-white');
    expect(getCreatureIcon({ name: 'Dragon de cuivre vénérable' })).toBe(
      'fluent-emoji:dragon-copper',
    );
    expect(getCreatureIcon({ name: 'Jeune dragon d’agate' })).toBe('fluent-emoji:dragon-agate');
    expect(getCreatureIcon({ name: 'Pseudo-dragon' })).toBe('fluent-emoji:dragon');
    expect(getCreatureIcon({ name: 'Dragon de bronze' })).toBe('fluent-emoji:dragon-copper');
    expect(getCreatureIcon({ name: 'Guerrier gobelin' })).toBe('fluent-emoji:goblin');
    expect(getCreatureIcon({ name: 'Aigle géant' })).toBe('fluent-emoji:eagle');
    expect(getCreatureIcon({ name: 'Chameau', category: 'divers' })).toBe('fluent-emoji:camel');
    expect(getCreatureIcon({ name: 'Mule', category: 'divers' })).toBe('fluent-emoji:donkey');
    expect(getCreatureIcon({ name: 'Vautour' })).toBe('fluent-emoji:bird');
    expect(getCreatureIcon({ name: 'Griffon' })).toBe('fluent-emoji:eagle');
    expect(getCreatureIcon({ name: 'Inconnu', category: 'divers' })).toBe('fluent-emoji:paw-prints');
    expect(getCreatureIcon({ name: 'Golem de fer' })).toBe('fluent-emoji:robot');
    expect(getCreatureIcon({ name: 'Archimage' })).toBe('fluent-emoji:man-mage');
    expect(getCreatureIcon({ name: 'Archidruide' })).toBe('fluent-emoji:man-mage');
    expect(getCreatureIcon({ name: 'Araignée géante' })).toBe('fluent-emoji:spider');
    expect(getCreatureIcon({ name: 'Arbre animé hanté' })).toBe('fluent-emoji:deciduous-tree');
    expect(getCreatureIcon({ name: 'Chevalier' })).not.toBe('fluent-emoji:horse');
    expect(getCreatureIcon({ name: 'Brute gobelourse' })).toBe('fluent-emoji:goblin');
    expect(getCreatureIcon({ name: 'Basilic' })).toBe('fluent-emoji:t-rex');
    expect(getCreatureIcon({ name: 'Ankheg cendreuse' })).toBe('fluent-emoji:bug');
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
