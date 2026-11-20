const CATEGORY_LABELS: Record<string, string> = {
  croyants: 'Croyants',
  habitants: 'Habitants',
  soldats: 'Soldats',
  arcanistes: 'Arcanistes',
  clandestins: 'Clandestins',
  'faune-urbaine': 'Faune urbaine',
  laboratoires: 'Laboratoires & bibliothèques',
  'laves-askamor': 'Laves d’Askamor',
  'rues-cité-franche': 'Rues de la Cité Franche',
  divers: 'Créatures diverses',
};

export function getCreatureCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category.replace(/-/g, ' ');
}

export function formatChallengeRating(cr: string): string {
  return cr === '0' ? '0' : `FP ${cr}`;
}

/** Valeur numérique approximative pour tri / filtres FP. */
export function parseChallengeRating(cr: string): number {
  if (cr === '0') return 0;
  if (cr.includes('/')) {
    const [num, den] = cr.split('/').map(Number);
    return den ? num / den : 0;
  }
  const n = Number(cr);
  return Number.isFinite(n) ? n : 0;
}

export type CrTier = 'low' | 'mid' | 'high' | 'legendary';

export function getCrTier(cr: string): CrTier {
  const v = parseChallengeRating(cr);
  if (v <= 1) return 'low';
  if (v <= 5) return 'mid';
  if (v <= 10) return 'high';
  return 'legendary';
}

export const CR_TIER_LABELS: Record<CrTier, string> = {
  low: 'Faible (0–1)',
  mid: 'Modéré (2–5)',
  high: 'Dangereux (6–10)',
  legendary: 'Légendaire (11+)',
};

export function getCategoryIcon(category: string): string {
  const key = category.toLowerCase();
  if (key.includes('croyant')) return 'fluent-emoji:place-of-worship';
  if (key.includes('soldat') || key.includes('clandestin')) return 'fluent-emoji:crossed-swords';
  if (key.includes('faune')) return 'fluent-emoji:paw-prints';
  if (key.includes('arcan')) return 'fluent-emoji:crystal-ball';
  if (key.includes('habitant')) return 'fluent-emoji:house';
  if (key.includes('laboratoire') || key.includes('biblioth')) return 'fluent-emoji:books';
  if (key.includes('askamor')) return 'fluent-emoji:fire';
  if (key.includes('cit')) return 'fluent-emoji:cityscape';
  if (key.includes('divers')) return 'fluent-emoji:paw-prints';
  return 'fluent-emoji:paw-prints';
}

export type CreatureIconSource = {
  name?: string | null;
  type?: string | null;
  category?: string | null;
};

function foldIconKey(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function hayHas(hay: string, needle: string): boolean {
  return hay.includes(needle);
}

function hayWord(hay: string, word: string): boolean {
  return new RegExp(`(^|[^a-z])${word}([^a-z]|$)`).test(hay);
}

/** Portrait dragon teinté d’après la couleur dans le nom (argent, blanc, cuivre…). */
function dragonIconForHay(hay: string): string {
  if (hayHas(hay, 'argent')) return 'fluent-emoji:dragon-silver';
  if (hayHas(hay, 'agate')) return 'fluent-emoji:dragon-agate';
  if (hayHas(hay, 'cuivre') || hayHas(hay, 'laiton') || hayHas(hay, 'bronze')) {
    return 'fluent-emoji:dragon-copper';
  }
  if (hayWord(hay, 'blanc') || hayHas(hay, 'blanche')) return 'fluent-emoji:dragon-white';
  return 'fluent-emoji:dragon';
}

/** Icône portrait d’une fiche (nom d’abord, puis type, puis catégorie). */
export function getCreatureIcon(source: CreatureIconSource): string {
  const hay = foldIconKey(`${source.name ?? ''} ${source.type ?? ''}`);

  if (hayHas(hay, 'kentigern')) return 'fluent-emoji:kentigern';
  if (hayHas(hay, 'vampire') || hayHas(hay, 'vampirien')) return 'fluent-emoji:man-vampire';
  if (hayHas(hay, 'liche')) return 'fluent-emoji:lich';
  if (hayHas(hay, 'squelette') && hayHas(hay, 'destrier')) return 'fluent-emoji:skeleton-horse';
  if (hayHas(hay, 'squelette') && hayHas(hay, 'minotaure')) return 'fluent-emoji:skeleton-minotaur';
  if (hayHas(hay, 'squelette') && hayHas(hay, 'geant')) return 'fluent-emoji:skeleton-giant';
  if (hayHas(hay, 'squelette')) return 'fluent-emoji:skull';
  if (hayHas(hay, 'goule')) return 'fluent-emoji:ghoul';
  if (hayHas(hay, 'bleme')) return 'fluent-emoji:bleme';
  if (hayHas(hay, 'morhave')) return 'fluent-emoji:morhave';
  if (hayHas(hay, 'harro')) return 'fluent-emoji:harro-zombie';
  if (hayHas(hay, 'zombie') && hayHas(hay, 'ogre')) return 'fluent-emoji:ogre-zombie';
  if (hayHas(hay, 'zombie')) {
    return 'fluent-emoji:man-zombie';
  }
  if (hayHas(hay, 'spectre')) return 'fluent-emoji:spectre';
  if (hayHas(hay, 'inane')) return 'fluent-emoji:inane';
  if (hayHas(hay, 'sunsutaa')) return 'fluent-emoji:sunsutaa';
  if (hayHas(hay, 'ame-en-peine') || hayHas(hay, 'ame en peine')) return 'fluent-emoji:wraith';
  if (hayHas(hay, 'fantome') || hayHas(hay, 'poltergeist')) {
    return 'fluent-emoji:ghost';
  }
  if (hayHas(hay, 'ikhworg')) return 'fluent-emoji:ikhworg';
  if (hayHas(hay, 'loup-garou') || hayHas(hay, 'loup garou')) return 'fluent-emoji:werewolf';
  if (hayHas(hay, 'worg')) return 'fluent-emoji:worg';
  if (hayWord(hay, 'loup')) return 'fluent-emoji:wolf';
  if (hayHas(hay, 'belette')) return 'fluent-emoji:weasel';
  if (hayHas(hay, 'blaireau')) return 'fluent-emoji:badger';
  if (hayHas(hay, 'renard')) return 'fluent-emoji:fox';
  if (hayHas(hay, 'chauve-souris') || hayHas(hay, 'chauves-souris')) return 'fluent-emoji:bat';
  if (hayHas(hay, 'gobelours')) return 'fluent-emoji:bugbear';
  if (hayHas(hay, 'hobgobelin')) return 'fluent-emoji:hobgoblin';
  if (hayHas(hay, 'kobold')) return 'fluent-emoji:kobold';
  if (hayHas(hay, 'ours-hibou') || hayHas(hay, 'ours hibou')) return 'fluent-emoji:owlbear';
  if (hayHas(hay, 'polaire')) return 'fluent-emoji:polar-bear';
  if (hayWord(hay, 'ours')) return 'fluent-emoji:bear';
  if (hayHas(hay, 'sanglier')) return 'fluent-emoji:boar';
  if (hayHas(hay, 'griffon')) return 'fluent-emoji:griffon';
  if (hayHas(hay, 'hippogriffe')) return 'fluent-emoji:hippogriff';
  if (hayHas(hay, 'hibou') || hayHas(hay, 'chouette')) return 'fluent-emoji:owl';
  if (hayHas(hay, 'corbeau')) return 'fluent-emoji:raven';
  if (hayHas(hay, 'vautour')) return 'fluent-emoji:vulture';
  if (hayHas(hay, 'faucon')) return 'fluent-emoji:falcon';
  if (hayHas(hay, 'aigle')) {
    return 'fluent-emoji:eagle';
  }
  if (hayHas(hay, 'araignee') || hayHas(hay, 'lycose')) {
    return 'fluent-emoji:spider';
  }
  if (hayHas(hay, 'ankheg') || hayHas(hay, 'kheg') || hayHas(hay, 'insecte')) {
    return 'fluent-emoji:bug';
  }
  if (hayHas(hay, 'rat-garou') || hayHas(hay, 'rat garou')) return 'fluent-emoji:wererat';
  if (hayWord(hay, 'rat') || hayHas(hay, 'rats')) return 'fluent-emoji:rat';
  if (hayHas(hay, 'tssikrreta')) return 'fluent-emoji:salamander-queen';
  if (hayHas(hay, 'salamandre')) return 'fluent-emoji:salamander';
  if (hayHas(hay, 'lezard')) return 'fluent-emoji:lizard';
  if (hayHas(hay, 'serpent') || hayHas(hay, 'couleuvre')) return 'fluent-emoji:snake';
  if (hayHas(hay, 'crocodile') || hayHas(hay, 'alligator')) return 'fluent-emoji:crocodile';
  if (hayHas(hay, 'grenouille') || hayHas(hay, 'crapaud')) return 'fluent-emoji:frog';
  if (hayHas(hay, 'scorpion')) return 'fluent-emoji:scorpion';
  if (hayHas(hay, 'chameau')) return 'fluent-emoji:camel';
  if (hayWord(hay, 'mule') || hayWord(hay, 'ane')) return 'fluent-emoji:donkey';
  if (hayHas(hay, 'poney')) return 'fluent-emoji:pony';
  if (hayHas(hay, 'renne')) return 'fluent-emoji:reindeer';
  if (hayWord(hay, 'cheval') || hayHas(hay, 'destrier')) {
    return 'fluent-emoji:horse';
  }
  if (hayHas(hay, 'chevre') || hayHas(hay, 'bouc') || hayHas(hay, 'capricorne')) {
    return 'fluent-emoji:goat';
  }
  if (hayHas(hay, 'elan')) return 'fluent-emoji:elk';
  if (hayHas(hay, 'cerf') || hayHas(hay, 'biche') || hayHas(hay, 'gregaire')) {
    return 'fluent-emoji:deer';
  }
  if (hayHas(hay, 'minotaure')) return 'fluent-emoji:minotaur';
  if (hayHas(hay, 'taureau') || hayHas(hay, 'vache') || hayHas(hay, 'gorgone')) return 'fluent-emoji:ox';
  if (hayHas(hay, 'elephant')) return 'fluent-emoji:elephant';
  if (hayHas(hay, 'molosse') || hayHas(hay, 'chien')) return 'fluent-emoji:dog';
  if (hayHas(hay, 'smilodon')) return 'fluent-emoji:smilodon';
  if (hayHas(hay, 'arslanikh') || hayWord(hay, 'lion')) return 'fluent-emoji:lion';
  if (hayWord(hay, 'chat') || hayHas(hay, 'panthere') || hayHas(hay, 'tigre')) {
    return 'fluent-emoji:cat';
  }
  if (hayHas(hay, 'oiseau')) {
    return 'fluent-emoji:bird';
  }
  if (hayHas(hay, 'poisson') || hayHas(hay, 'requin')) return 'fluent-emoji:shark';
  if (hayHas(hay, 'pieuvre') || hayHas(hay, 'kraken') || hayHas(hay, 'poulpe')) {
    return 'fluent-emoji:octopus';
  }
  if (hayHas(hay, 'abeille') || hayHas(hay, 'guepe')) return 'fluent-emoji:bug';
  if (hayHas(hay, 'suiri') || hayHas(hay, 'suirel')) return 'fluent-emoji:locust';
  if (hayHas(hay, 'nuee')) return 'fluent-emoji:ant';

  if (
    hayHas(hay, 'dragonnet') ||
    hayHas(hay, 'dragon') ||
    hayHas(hay, 'draconique') ||
    hayHas(hay, 'wyverne') ||
    hayHas(hay, 'drake')
  ) {
    return dragonIconForHay(hay);
  }

  if (hayHas(hay, 'gobelin')) return 'fluent-emoji:goblin';
  if (hayWord(hay, 'orc')) return 'fluent-emoji:orc';
  if (hayHas(hay, 'ogre')) return 'fluent-emoji:ogre';
  if (hayHas(hay, 'troll')) return 'fluent-emoji:troll';
  if (hayHas(hay, 'drow') || hayHas(hay, 'galwyn')) return 'fluent-emoji:drow';
  if (hayHas(hay, 'elfe') || hayHas(hay, 'elf')) return 'fluent-emoji:man-elf';
  if (hayHas(hay, 'la maison') || hayWord(hay, 'maison')) return 'fluent-emoji:haunted-house';
  if (hayHas(hay, 'gadai')) return 'fluent-emoji:gadai';
  if (hayHas(hay, 'fee') || hayHas(hay, 'fey') || hayHas(hay, 'anakedi')) {
    return 'fluent-emoji:woman-fairy';
  }
  if (hayHas(hay, 'askinos')) return 'fluent-emoji:askinos';
  if (hayHas(hay, 'kushu')) return 'fluent-emoji:kushu';
  if (hayHas(hay, 'bantu')) return 'fluent-emoji:bantu';
  if (hayHas(hay, 'pomoshch')) return 'fluent-emoji:pomoshch';
  if (hayHas(hay, 'talsednae')) return 'fluent-emoji:talsednae';
  if (hayHas(hay, 'delsednae') || hayHas(hay, 'ame celeste')) return 'fluent-emoji:delsednae';
  if (hayWord(hay, 'ange')) return 'fluent-emoji:baby-angel';
  if (hayHas(hay, 'celeste')) return 'fluent-emoji:celestial';
  if (
    hayHas(hay, 'diable') ||
    hayHas(hay, 'demon') ||
    hayHas(hay, 'fielon') ||
    hayHas(hay, 'imp')
  ) {
    return 'fluent-emoji:angry-face-with-horns';
  }

  if (hayHas(hay, 'tarasque')) return 'fluent-emoji:tarasque';
  if (hayHas(hay, 'remorhaz')) return 'fluent-emoji:remorhaz';
  if (hayHas(hay, 'bulette')) return 'fluent-emoji:bulette';
  if (hayHas(hay, 'cocatrice')) return 'fluent-emoji:cocatrice';
  if (hayHas(hay, 'basilic')) return 'fluent-emoji:t-rex';
  if (hayHas(hay, 'gargouille')) return 'fluent-emoji:moai';
  if (hayHas(hay, 'arbre') || hayHas(hay, 'treant')) {
    return 'fluent-emoji:deciduous-tree';
  }
  if (hayHas(hay, 'armure animee')) return 'fluent-emoji:animated-armor';
  if (hayHas(hay, 'golem') && hayHas(hay, 'chair')) return 'fluent-emoji:flesh-golem';
  if (hayHas(hay, 'golem') && hayHas(hay, 'fer')) return 'fluent-emoji:iron-golem';
  if (hayHas(hay, 'golem') && hayHas(hay, 'argile')) return 'fluent-emoji:clay-golem';
  if (hayHas(hay, 'golem') && hayHas(hay, 'pierre')) return 'fluent-emoji:stone-golem';
  if (hayHas(hay, 'golem') || hayHas(hay, 'artificielle')) {
    return 'fluent-emoji:robot';
  }
  if (hayHas(hay, 'mimique')) return 'fluent-emoji:mimic';
  if (hayHas(hay, 'meduse')) return 'fluent-emoji:medusa';
  if (hayHas(hay, 'epee volante')) return 'fluent-emoji:flying-sword';
  if (hayHas(hay, 'tapis')) return 'fluent-emoji:flying-carpet';
  if (hayHas(hay, 'homoncule')) return 'fluent-emoji:homunculus';
  if (hayHas(hay, 'aristocrate')) return 'fluent-emoji:noble';
  if (hayHas(hay, 'expert')) return 'fluent-emoji:scholar';
  if (hayHas(hay, 'gelee')) return 'fluent-emoji:ochre-jelly';
  if (hayHas(hay, 'gelatineux') || hayHas(hay, 'vase') || hayHas(hay, 'cube')) {
    return 'fluent-emoji:microbe';
  }
  if (hayHas(hay, 'chaine animee')) return 'fluent-emoji:living-chain';
  if (hayHas(hay, 'mephite')) return 'fluent-emoji:mephit';
  if (hayHas(hay, 'azer')) return 'fluent-emoji:azer';
  if (hayHas(hay, 'ulkan')) return 'fluent-emoji:ulkan';
  if (hayHas(hay, 'roturier')) return 'fluent-emoji:commoner';
  if (hayHas(hay, 'doppelg')) return 'fluent-emoji:shapeshifter';
  if (hayHas(hay, 'mille visages') || hayHas(hay, 'ravageur')) {
    return 'fluent-emoji:shapeshifter';
  }
  if (hayHas(hay, 'assangui')) return 'fluent-emoji:assangui';
  if (hayHas(hay, 'glashurle')) return 'fluent-emoji:ice-warden';
  if (hayHas(hay, 'glacanglot')) return 'fluent-emoji:ice-wraith';
  if (hayHas(hay, 'reprouve')) return 'fluent-emoji:revenant';
  if (hayHas(hay, 'familier')) return 'fluent-emoji:familiar';
  if (hayHas(hay, 'adacayi') || hayHas(hay, 'kartacol')) return 'fluent-emoji:sui-adacayi';
  if (hayHas(hay, 'magmatique')) return 'fluent-emoji:magmatique';
  if (hayHas(hay, 'schatz')) return 'fluent-emoji:schatz';
  if (hayHas(hay, 'elementaire')) {
    if (hayHas(hay, 'feu') || hayHas(hay, 'magma') || hayHas(hay, 'cendre')) return 'fluent-emoji:fire';
    if (hayHas(hay, 'glace') || hayHas(hay, 'froid') || hayHas(hay, 'eau') || hayHas(hay, 'vapeur')) {
      return 'fluent-emoji:snowflake';
    }
    if (hayHas(hay, 'terre')) return 'fluent-emoji:rock';
    return 'fluent-emoji:cyclone';
  }

  if (
    hayHas(hay, 'mage') ||
    hayHas(hay, 'magicien') ||
    hayHas(hay, 'archimage') ||
    hayHas(hay, 'arcaniste')
  ) {
    return 'fluent-emoji:man-mage';
  }
  if (hayHas(hay, 'itelgini')) return 'fluent-emoji:itelgini';
  if (hayHas(hay, 'druide') || hayHas(hay, 'chamane')) return 'fluent-emoji:druid';
  if (hayHas(hay, 'givre')) return 'fluent-emoji:frost-giant';
  if (hayHas(hay, 'geant')) return 'fluent-emoji:giant';
  if (hayHas(hay, 'sorcier')) return 'fluent-emoji:warlock';
  if (hayHas(hay, 'barde')) return 'fluent-emoji:bard';
  if (hayHas(hay, 'synthia')) return 'fluent-emoji:synthia';
  if (hayHas(hay, 'paladin')) return 'fluent-emoji:paladin';
  if (hayHas(hay, 'fanatique')) return 'fluent-emoji:fanatic';
  if (hayHas(hay, 'archipretre')) return 'fluent-emoji:high-priest';
  if (hayHas(hay, 'adorateur')) return 'fluent-emoji:worshipper';
  if (hayHas(hay, 'ecclesiast')) return 'fluent-emoji:cleric';
  if (hayHas(hay, 'acolyte') || hayHas(hay, 'pretre')) {
    return 'fluent-emoji:folded-hands';
  }
  if (hayHas(hay, 'arpenteur') || hayHas(hay, 'eclaireur')) return 'fluent-emoji:ranger';
  if (hayHas(hay, 'garde sacre')) return 'fluent-emoji:holy-guard';
  if (hayHas(hay, 'chevalier')) return 'fluent-emoji:knight';
  if (hayHas(hay, 'berserker') && hayHas(hay, 'sacre')) return 'fluent-emoji:holy-berserker';
  if (hayHas(hay, 'berserker')) return 'fluent-emoji:barbarian';
  if (hayHas(hay, 'gladiateur')) return 'fluent-emoji:gladiator';
  if (hayHas(hay, 'champion')) return 'fluent-emoji:champion';
  if (hayHas(hay, 'tribal')) return 'fluent-emoji:tribal';
  if (hayHas(hay, 'assassin') || hayHas(hay, 'ninja')) return 'fluent-emoji:ninja';
  if (hayHas(hay, 'espion')) return 'fluent-emoji:spy';
  if (hayHas(hay, 'soldat') && hayHas(hay, 'elite')) return 'fluent-emoji:elite-soldier';
  if (hayHas(hay, 'veteran')) return 'fluent-emoji:veteran';
  if (hayWord(hay, 'garde')) return 'fluent-emoji:guard';
  if (hayHas(hay, 'guerrier') || hayHas(hay, 'soldat')) {
    return 'fluent-emoji:crossed-swords';
  }
  if (hayWord(hay, 'brute')) return 'fluent-emoji:thug';
  if (hayHas(hay, 'baron')) return 'fluent-emoji:crime-baron';
  if (hayHas(hay, 'chef de bande')) return 'fluent-emoji:gang-leader';
  if (hayHas(hay, 'bandit')) return 'fluent-emoji:angry-face';

  if (hayHas(hay, 'mort-vivant') || hayHas(hay, 'mort vivant')) return 'fluent-emoji:skull';
  if (hayHas(hay, 'monstruosite')) return 'fluent-emoji:ogre';
  if (hayHas(hay, 'bete')) return 'fluent-emoji:paw-prints';
  if (hayHas(hay, 'humanoide')) return 'fluent-emoji:person';
  if (hayHas(hay, 'fee')) return 'fluent-emoji:woman-fairy';

  return getCategoryIcon(source.category ?? '');
}

export const ABILITY_LABELS: Record<string, string> = {
  str: 'FOR',
  dex: 'DEX',
  con: 'CON',
  int: 'INT',
  wis: 'SAG',
  cha: 'CHA',
};

/** En-tête OCR / livre (« Le dragon utilise l’un des deux souffles suivants : ») sans contenu. */
export function isDanglingCodexIntro(description: string | null | undefined): boolean {
  const text = (description ?? '').trim();
  if (!text.endsWith(':')) return false;
  if (text.includes('\n')) return false;
  return text.length <= 140;
}

export function visibleCreatureBlocks<T extends { name: string; description: string }>(
  blocks: T[] | null | undefined,
): T[] {
  return (blocks ?? []).filter(
    (block) => block.name.trim().length > 0 || creatureBlockBody(block.description) !== null,
  );
}

/** Corps de particularité / action : masque les phrases d’intro coupées, garde le titre (ex. recharge). */
export function creatureBlockBody(description: string | null | undefined): string | null {
  const text = (description ?? '').trim();
  if (!text || isDanglingCodexIntro(text)) return null;
  return text;
}

/** Retire une phrase d’intro tronquée en fin de lore (« En voici quelques variantes : »). */
export function tidyCreatureLore(description: string | null | undefined): string {
  const text = (description ?? '').trim();
  if (!text.endsWith(':')) return text;
  const cut = text.replace(/\s+[^.!?\n]+:$/, '').trim();
  return cut || text;
}
