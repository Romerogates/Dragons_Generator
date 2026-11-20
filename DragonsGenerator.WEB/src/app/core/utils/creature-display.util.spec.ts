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
    expect(getCreatureIcon({ name: 'Dragon d’agate adulte' })).toBe('fluent-emoji:dragon-agate');
    expect(getCreatureIcon({ name: 'Pseudo-dragon' })).toBe('fluent-emoji:dragon');
    expect(getCreatureIcon({ name: 'Mille visages sous sa forme draconique' })).toBe(
      'fluent-emoji:dragon',
    );
    expect(getCreatureIcon({ name: 'Dragon de bronze' })).toBe('fluent-emoji:dragon-copper');
    expect(getCreatureIcon({ name: 'Guerrier gobelin' })).toBe('fluent-emoji:goblin');
    expect(getCreatureIcon({ name: 'Aigle géant' })).toBe('fluent-emoji:eagle');
    expect(getCreatureIcon({ name: 'Griffon' })).toBe('fluent-emoji:griffon');
    expect(getCreatureIcon({ name: 'Hippogriffe' })).toBe('fluent-emoji:hippogriff');
    expect(getCreatureIcon({ name: 'Hibou géant' })).toBe('fluent-emoji:owl');
    expect(getCreatureIcon({ name: 'Corbeau' })).toBe('fluent-emoji:raven');
    expect(getCreatureIcon({ name: 'Vautour' })).toBe('fluent-emoji:vulture');
    expect(getCreatureIcon({ name: 'Ours-hibou' })).toBe('fluent-emoji:owlbear');
    expect(getCreatureIcon({ name: 'Gelée ocre cendreuse' })).toBe('fluent-emoji:ochre-jelly');
    expect(getCreatureIcon({ name: 'Chevalier' })).toBe('fluent-emoji:knight');
    expect(getCreatureIcon({ name: 'Champion' })).toBe('fluent-emoji:champion');
    expect(getCreatureIcon({ name: 'Guerrier tribal' })).toBe('fluent-emoji:tribal');
    expect(getCreatureIcon({ name: 'Ezen champion orc' })).toBe('fluent-emoji:orc');
    expect(getCreatureIcon({ name: 'Faucon' })).toBe('fluent-emoji:falcon');
    expect(getCreatureIcon({ name: 'Faucon de sang' })).toBe('fluent-emoji:falcon');
    expect(getCreatureIcon({ name: 'Bantu, le calice de douleur' })).toBe('fluent-emoji:bantu');
    expect(getCreatureIcon({ name: 'Armure animée' })).toBe('fluent-emoji:animated-armor');
    expect(getCreatureIcon({ name: 'Golem de chair' })).toBe('fluent-emoji:flesh-golem');
    expect(getCreatureIcon({ name: 'Golem de fer' })).toBe('fluent-emoji:iron-golem');
    expect(getCreatureIcon({ name: 'Golem de pierre' })).toBe('fluent-emoji:stone-golem');
    expect(getCreatureIcon({ name: 'Golem d’argile' })).toBe('fluent-emoji:clay-golem');
    expect(getCreatureIcon({ name: 'Adorateur' })).toBe('fluent-emoji:worshipper');
    expect(getCreatureIcon({ name: 'Ecclésiastique' })).toBe('fluent-emoji:cleric');
    expect(getCreatureIcon({ name: 'Askinos le buveur de douleur' })).toBe('fluent-emoji:askinos');
    expect(getCreatureIcon({ name: 'Kûshu, le diable gelé' })).toBe('fluent-emoji:kushu');
    expect(getCreatureIcon({ name: 'Kentigern le seigneur vampire' })).toBe(
      'fluent-emoji:kentigern',
    );
    expect(getCreatureIcon({ name: 'Arslanikh, le lion du Kaan' })).toBe('fluent-emoji:lion');
    expect(getCreatureIcon({ name: 'Chat' })).toBe('fluent-emoji:cat');
    expect(getCreatureIcon({ name: 'Reine salamandre Tssikrreta' })).toBe(
      'fluent-emoji:salamander-queen',
    );
    expect(getCreatureIcon({ name: 'Gadaí, le chacripaon' })).toBe('fluent-emoji:gadai');
    expect(getCreatureIcon({ name: 'Anakedi' })).toBe('fluent-emoji:woman-fairy');
    expect(getCreatureIcon({ name: 'Liche' })).toBe('fluent-emoji:lich');
    expect(getCreatureIcon({ name: 'Sünsutaa' })).toBe('fluent-emoji:sunsutaa');
    expect(getCreatureIcon({ name: 'Sünsutaaikh' })).toBe('fluent-emoji:sunsutaa');
    expect(getCreatureIcon({ name: 'Âme-en-peine' })).toBe('fluent-emoji:wraith');
    expect(getCreatureIcon({ name: 'Fantôme' })).toBe('fluent-emoji:ghost');
    expect(getCreatureIcon({ name: 'Zombie ogre' })).toBe('fluent-emoji:ogre-zombie');
    expect(getCreatureIcon({ name: 'Zombie harro' })).toBe('fluent-emoji:harro-zombie');
    expect(getCreatureIcon({ name: 'Troupier kobold' })).toBe('fluent-emoji:kobold');
    expect(getCreatureIcon({ name: 'Chef d’escouade kobold' })).toBe('fluent-emoji:kobold');
    expect(getCreatureIcon({ name: 'Soldat hobgobelin' })).toBe('fluent-emoji:hobgoblin');
    expect(getCreatureIcon({ name: 'Arcaniste hobgobelin' })).toBe('fluent-emoji:hobgoblin');
    expect(getCreatureIcon({ name: 'Brute gobelourse' })).toBe('fluent-emoji:bugbear');
    expect(getCreatureIcon({ name: 'Quêteuse gobelours' })).toBe('fluent-emoji:bugbear');
    expect(getCreatureIcon({ name: 'Guerrier gobelin' })).toBe('fluent-emoji:goblin');
    expect(getCreatureIcon({ name: 'Chef de bande rat-garou' })).toBe('fluent-emoji:wererat');
    expect(getCreatureIcon({ name: 'Rat géant' })).toBe('fluent-emoji:rat');
    expect(getCreatureIcon({ name: 'Élan géant' })).toBe('fluent-emoji:elk');
    expect(getCreatureIcon({ name: 'Petit grégaire' })).toBe('fluent-emoji:deer');
    expect(getCreatureIcon({ name: 'Poney' })).toBe('fluent-emoji:pony');
    expect(getCreatureIcon({ name: 'Renne' })).toBe('fluent-emoji:reindeer');
    expect(getCreatureIcon({ name: 'Cheval de selle' })).toBe('fluent-emoji:horse');
    expect(getCreatureIcon({ name: 'Belette' })).toBe('fluent-emoji:weasel');
    expect(getCreatureIcon({ name: 'Blaireau' })).toBe('fluent-emoji:badger');
    expect(getCreatureIcon({ name: 'Renard' })).toBe('fluent-emoji:fox');
    expect(getCreatureIcon({ name: 'Salamandre' })).toBe('fluent-emoji:salamander');
    expect(getCreatureIcon({ name: 'Lézard cendreux' })).toBe('fluent-emoji:lizard');
    expect(getCreatureIcon({ name: 'Itelgini (haut chamane)' })).toBe('fluent-emoji:itelgini');
    expect(getCreatureIcon({ name: 'Synthia (paladine)' })).toBe('fluent-emoji:synthia');
    expect(getCreatureIcon({ name: 'Géant du givre sorcier de Gegaôr' })).toBe(
      'fluent-emoji:frost-giant',
    );
    expect(getCreatureIcon({ name: 'Géant des pierres sentinelle' })).toBe('fluent-emoji:giant');
    expect(getCreatureIcon({ name: 'Berserker sacré' })).toBe('fluent-emoji:holy-berserker');
    expect(getCreatureIcon({ name: 'Berserker' })).toBe('fluent-emoji:barbarian');
    expect(getCreatureIcon({ name: 'Squelette de destrier' })).toBe('fluent-emoji:skeleton-horse');
    expect(getCreatureIcon({ name: 'Squelette de minotaure' })).toBe(
      'fluent-emoji:skeleton-minotaur',
    );
    expect(getCreatureIcon({ name: 'Squelette de géant des pierres' })).toBe(
      'fluent-emoji:skeleton-giant',
    );
    expect(getCreatureIcon({ name: 'Squelette' })).toBe('fluent-emoji:skull');
    expect(getCreatureIcon({ name: 'Brute' })).toBe('fluent-emoji:thug');
    expect(getCreatureIcon({ name: 'Baron du crime' })).toBe('fluent-emoji:crime-baron');
    expect(getCreatureIcon({ name: 'Guerrier orc' })).toBe('fluent-emoji:orc');
    expect(getCreatureIcon({ name: 'Goule' })).toBe('fluent-emoji:ghoul');
    expect(getCreatureIcon({ name: 'Blême' })).toBe('fluent-emoji:bleme');
    expect(getCreatureIcon({ name: 'Morhâve' })).toBe('fluent-emoji:morhave');
    expect(getCreatureIcon({ name: 'Zombie' })).toBe('fluent-emoji:man-zombie');
    expect(getCreatureIcon({ name: 'Spectre' })).toBe('fluent-emoji:spectre');
    expect(getCreatureIcon({ name: 'Inane cauchemardesque' })).toBe('fluent-emoji:inane');
    expect(getCreatureIcon({ name: 'Loup-garou' })).toBe('fluent-emoji:werewolf');
    expect(getCreatureIcon({ name: 'Worg' })).toBe('fluent-emoji:worg');
    expect(getCreatureIcon({ name: 'Loup' })).toBe('fluent-emoji:wolf');
    expect(getCreatureIcon({ name: 'Minotaure' })).toBe('fluent-emoji:minotaur');
    expect(getCreatureIcon({ name: 'Smilodon' })).toBe('fluent-emoji:smilodon');
    expect(getCreatureIcon({ name: 'Ours polaire' })).toBe('fluent-emoji:polar-bear');
    expect(getCreatureIcon({ name: 'Ours brun' })).toBe('fluent-emoji:bear');
    expect(getCreatureIcon({ name: 'Fanatique' })).toBe('fluent-emoji:fanatic');
    expect(getCreatureIcon({ name: 'Archiprêtre' })).toBe('fluent-emoji:high-priest');
    expect(getCreatureIcon({ name: 'Acolyte' })).toBe('fluent-emoji:folded-hands');
    expect(getCreatureIcon({ name: 'Soldat d’élite' })).toBe('fluent-emoji:elite-soldier');
    expect(getCreatureIcon({ name: 'Vétéran' })).toBe('fluent-emoji:veteran');
    expect(getCreatureIcon({ name: 'Vétéran azer' })).toBe('fluent-emoji:azer');
    expect(getCreatureIcon({ name: 'Garde' })).toBe('fluent-emoji:guard');
    expect(getCreatureIcon({ name: 'Garde sacré' })).toBe('fluent-emoji:holy-guard');
    expect(getCreatureIcon({ name: 'Chameau', category: 'divers' })).toBe('fluent-emoji:camel');
    expect(getCreatureIcon({ name: 'Mule', category: 'divers' })).toBe('fluent-emoji:donkey');
    expect(getCreatureIcon({ name: 'Vautour' })).toBe('fluent-emoji:vulture');
    expect(getCreatureIcon({ name: 'Griffon' })).toBe('fluent-emoji:griffon');
    expect(getCreatureIcon({ name: 'Inconnu', category: 'divers' })).toBe('fluent-emoji:paw-prints');
    expect(getCreatureIcon({ name: 'Golem de fer' })).toBe('fluent-emoji:iron-golem');
    expect(getCreatureIcon({ name: 'Archimage' })).toBe('fluent-emoji:man-mage');
    expect(getCreatureIcon({ name: 'Archidruide' })).toBe('fluent-emoji:druid');
    expect(getCreatureIcon({ name: 'Druide' })).toBe('fluent-emoji:druid');
    expect(getCreatureIcon({ name: 'Haut chamane' })).toBe('fluent-emoji:druid');
    expect(getCreatureIcon({ name: 'Sorcier de la tour' })).toBe('fluent-emoji:warlock');
    expect(getCreatureIcon({ name: 'Paladin' })).toBe('fluent-emoji:paladin');
    expect(getCreatureIcon({ name: 'Doppelgänger' })).toBe('fluent-emoji:shapeshifter');
    expect(getCreatureIcon({ name: 'Araignée géante' })).toBe('fluent-emoji:spider');
    expect(getCreatureIcon({ name: 'Arbre animé hanté' })).toBe('fluent-emoji:deciduous-tree');
    expect(getCreatureIcon({ name: 'Chevalier' })).not.toBe('fluent-emoji:horse');
    expect(getCreatureIcon({ name: 'Brute gobelourse' })).toBe('fluent-emoji:bugbear');
    expect(getCreatureIcon({ name: 'Basilic' })).toBe('fluent-emoji:t-rex');
    expect(getCreatureIcon({ name: 'Tarasque' })).toBe('fluent-emoji:tarasque');
    expect(getCreatureIcon({ name: 'Remorhaz' })).toBe('fluent-emoji:remorhaz');
    expect(getCreatureIcon({ name: 'Bulette' })).toBe('fluent-emoji:bulette');
    expect(getCreatureIcon({ name: 'Cocatrice' })).toBe('fluent-emoji:cocatrice');
    expect(getCreatureIcon({ name: 'Schatz' })).toBe('fluent-emoji:schatz');
    expect(getCreatureIcon({ name: 'Jeune schatz' })).toBe('fluent-emoji:schatz');
    expect(getCreatureIcon({ name: 'Magmatique' })).toBe('fluent-emoji:magmatique');
    expect(getCreatureIcon({ name: 'Méphite magmatique' })).toBe('fluent-emoji:mephit');
    expect(getCreatureIcon({ name: 'Pomoshch' })).toBe('fluent-emoji:pomoshch');
    expect(getCreatureIcon({ name: 'Céleste de taille G, neutre' })).toBe(
      'fluent-emoji:celestial',
    );
    expect(getCreatureIcon({ name: 'Garde sacré' })).toBe('fluent-emoji:holy-guard');
    expect(getCreatureIcon({ name: 'Garde' })).toBe('fluent-emoji:guard');
    expect(getCreatureIcon({ name: 'Espion' })).toBe('fluent-emoji:spy');
    expect(getCreatureIcon({ name: 'Ankheg cendreuse' })).toBe('fluent-emoji:bug');
    expect(getCreatureIcon({ name: 'Sorcier de la tour' })).not.toBe('fluent-emoji:ogre');
    expect(getCreatureIcon({ name: 'Sorcier de la tour' })).not.toBe('fluent-emoji:druid');
    expect(getCreatureIcon({ name: 'Inconnu', type: 'Mort-vivant de taille M' })).toBe(
      'fluent-emoji:skull',
    );
    expect(getCreatureIcon({ name: 'PNJ', category: 'croyants' })).toBe(
      'fluent-emoji:place-of-worship',
    );
    expect(getCreatureIcon({ name: 'Méduse' })).toBe('fluent-emoji:medusa');
    expect(getCreatureIcon({ name: 'Géant des collines' })).toBe('fluent-emoji:giant');
    expect(getCreatureIcon({ name: 'Druide géant des pierres' })).toBe('fluent-emoji:druid');
    expect(getCreatureIcon({ name: 'Mimique' })).toBe('fluent-emoji:mimic');
    expect(getCreatureIcon({ name: 'Épée volante' })).toBe('fluent-emoji:flying-sword');
    expect(getCreatureIcon({ name: 'Homoncule' })).toBe('fluent-emoji:homunculus');
    expect(getCreatureIcon({ name: 'Aristocrate' })).toBe('fluent-emoji:noble');
    expect(getCreatureIcon({ name: 'Méphite de magma' })).toBe('fluent-emoji:mephit');
    expect(getCreatureIcon({ name: 'Assassin' })).toBe('fluent-emoji:ninja');
    expect(getCreatureIcon({ name: 'Bandit' })).toBe('fluent-emoji:angry-face');
    expect(getCreatureIcon({ name: 'Chef de bande' })).toBe('fluent-emoji:gang-leader');
    expect(getCreatureIcon({ name: 'Gladiateur' })).toBe('fluent-emoji:gladiator');
    expect(getCreatureIcon({ name: 'Chaîne animée' })).toBe('fluent-emoji:living-chain');
    expect(getCreatureIcon({ name: 'Azer' })).toBe('fluent-emoji:azer');
    expect(getCreatureIcon({ name: 'Vétéran azer' })).toBe('fluent-emoji:azer');
    expect(getCreatureIcon({ name: 'Tapis étouffant' })).toBe('fluent-emoji:flying-carpet');
    expect(getCreatureIcon({ name: 'Roturier' })).toBe('fluent-emoji:commoner');
    expect(getCreatureIcon({ name: 'Sage ulkan' })).toBe('fluent-emoji:ulkan');
    expect(getCreatureIcon({ name: 'Guerrier ulkan' })).toBe('fluent-emoji:ulkan');
    expect(
      getCreatureIcon({ name: 'La Maison', type: 'Fée (urbaine) de taille Gig' }),
    ).toBe('fluent-emoji:haunted-house');
    expect(getCreatureIcon({ name: 'Mille visages sous forme' })).toBe(
      'fluent-emoji:shapeshifter',
    );
    expect(
      getCreatureIcon({ name: 'Mille visages sous sa forme draconique' }),
    ).toBe('fluent-emoji:dragon');
    expect(getCreatureIcon({ name: 'Assangui' })).toBe('fluent-emoji:assangui');
    expect(getCreatureIcon({ name: 'Süiri' })).toBe('fluent-emoji:locust');
    expect(getCreatureIcon({ name: 'Süirel, ou nuée de süiris' })).toBe('fluent-emoji:locust');
    expect(getCreatureIcon({ name: 'Glaçanglot' })).toBe('fluent-emoji:ice-wraith');
    expect(getCreatureIcon({ name: 'Glashurle' })).toBe('fluent-emoji:ice-warden');
    expect(getCreatureIcon({ name: 'Réprouvé' })).toBe('fluent-emoji:revenant');
    expect(getCreatureIcon({ name: 'Un familier kaani' })).toBe('fluent-emoji:familiar');
    expect(getCreatureIcon({ name: 'Ez’Galwyn' })).toBe('fluent-emoji:drow');
    expect(getCreatureIcon({ name: 'Süi Adaçayi Kartaçöl' })).toBe('fluent-emoji:sui-adacayi');
    expect(getCreatureIcon({ name: 'Ikhworg' })).toBe('fluent-emoji:ikhworg');
    expect(getCreatureIcon({ name: 'Worg' })).toBe('fluent-emoji:worg');
    expect(getCreatureIcon({ name: 'Delsednae' })).toBe('fluent-emoji:delsednae');
    expect(getCreatureIcon({ name: 'Talsednae' })).toBe('fluent-emoji:talsednae');
    expect(getCreatureIcon({ name: 'Âme céleste, esprit mortel' })).toBe('fluent-emoji:delsednae');
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
