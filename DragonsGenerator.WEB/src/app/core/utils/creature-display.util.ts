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
  return 'fluent-emoji:dragon';
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

/** Icône portrait d’une fiche (nom d’abord, puis type, puis catégorie). */
export function getCreatureIcon(source: CreatureIconSource): string {
  const hay = foldIconKey(`${source.name ?? ''} ${source.type ?? ''}`);

  if (hayHas(hay, 'vampire') || hayHas(hay, 'vampirien')) return 'fluent-emoji:man-vampire';
  if (hayHas(hay, 'squelette')) return 'fluent-emoji:skull';
  if (hayHas(hay, 'zombie') || hayHas(hay, 'goule') || hayHas(hay, 'bleme') || hayHas(hay, 'morhave')) {
    return 'fluent-emoji:man-zombie';
  }
  if (
    hayHas(hay, 'fantome') ||
    hayHas(hay, 'spectre') ||
    hayHas(hay, 'sunsutaa') ||
    hayHas(hay, 'poltergeist') ||
    hayHas(hay, 'ame-en-peine') ||
    hayHas(hay, 'ame en peine')
  ) {
    return 'fluent-emoji:ghost';
  }
  if (hayHas(hay, 'liche')) return 'fluent-emoji:skull';
  if (hayHas(hay, 'loup-garou') || hayHas(hay, 'loup garou') || hayHas(hay, 'worg')) {
    return 'fluent-emoji:wolf';
  }
  if (hayWord(hay, 'loup')) return 'fluent-emoji:wolf';
  if (hayHas(hay, 'renard')) return 'fluent-emoji:fox';
  if (hayHas(hay, 'chauve-souris') || hayHas(hay, 'chauves-souris')) return 'fluent-emoji:bat';
  if (hayHas(hay, 'ours')) return 'fluent-emoji:bear';
  if (hayHas(hay, 'sanglier')) return 'fluent-emoji:boar';
  if (hayHas(hay, 'aigle') || hayHas(hay, 'faucon')) return 'fluent-emoji:eagle';
  if (hayHas(hay, 'hibou') || hayHas(hay, 'chouette')) return 'fluent-emoji:owl';
  if (hayHas(hay, 'araignee') || hayHas(hay, 'ankheg') || hayHas(hay, 'kheg')) {
    return 'fluent-emoji:spider';
  }
  if (hayWord(hay, 'rat') || hayHas(hay, 'rats')) return 'fluent-emoji:rat';
  if (hayHas(hay, 'lezard') || hayHas(hay, 'salamandre')) return 'fluent-emoji:lizard';
  if (hayHas(hay, 'serpent') || hayHas(hay, 'couleuvre')) return 'fluent-emoji:snake';
  if (hayHas(hay, 'crocodile') || hayHas(hay, 'alligator')) return 'fluent-emoji:crocodile';
  if (hayHas(hay, 'grenouille') || hayHas(hay, 'crapaud')) return 'fluent-emoji:frog';
  if (hayHas(hay, 'scorpion')) return 'fluent-emoji:scorpion';
  if (hayHas(hay, 'cheval') || hayHas(hay, 'destrier') || hayHas(hay, 'poney') || hayHas(hay, 'renne')) {
    return 'fluent-emoji:horse';
  }
  if (hayHas(hay, 'chevre') || hayHas(hay, 'bouc')) return 'fluent-emoji:goat';
  if (hayHas(hay, 'cerf') || hayHas(hay, 'biche') || hayHas(hay, 'gregaire')) return 'fluent-emoji:deer';
  if (hayHas(hay, 'taureau') || hayHas(hay, 'vache') || hayHas(hay, 'gorgone')) return 'fluent-emoji:ox';
  if (hayHas(hay, 'minotaure')) return 'fluent-emoji:ox';
  if (hayHas(hay, 'elephant')) return 'fluent-emoji:elephant';
  if (hayHas(hay, 'molosse') || hayHas(hay, 'chien')) return 'fluent-emoji:dog';
  if (hayHas(hay, 'chat') || hayHas(hay, 'panthere') || hayHas(hay, 'tigre')) return 'fluent-emoji:cat';
  if (hayHas(hay, 'corbeau') || hayHas(hay, 'oiseau')) return 'fluent-emoji:bird';
  if (hayHas(hay, 'poisson') || hayHas(hay, 'requin')) return 'fluent-emoji:shark';
  if (hayHas(hay, 'pieuvre') || hayHas(hay, 'kraken') || hayHas(hay, 'poulpe')) {
    return 'fluent-emoji:octopus';
  }
  if (hayHas(hay, 'abeille') || hayHas(hay, 'guepe') || hayHas(hay, 'insecte')) return 'fluent-emoji:bug';
  if (hayHas(hay, 'nuee')) return 'fluent-emoji:ant';

  if (hayHas(hay, 'dragonnet') || hayHas(hay, 'dragon')) return 'fluent-emoji:dragon';
  if (hayHas(hay, 'wyverne') || hayHas(hay, 'drake')) return 'fluent-emoji:dragon-face';

  if (hayHas(hay, 'gobelin')) return 'fluent-emoji:goblin';
  if (hayWord(hay, 'orc') || hayHas(hay, 'ogre')) return 'fluent-emoji:ogre';
  if (hayHas(hay, 'troll')) return 'fluent-emoji:troll';
  if (hayHas(hay, 'elfe') || hayHas(hay, 'drow') || hayHas(hay, 'elf')) return 'fluent-emoji:man-elf';
  if (hayHas(hay, 'fee') || hayHas(hay, 'fey') || hayHas(hay, 'anakedi') || hayHas(hay, 'gadai')) {
    return 'fluent-emoji:woman-fairy';
  }
  if (hayHas(hay, 'ange') || hayHas(hay, 'celeste') || hayHas(hay, 'pomoshch')) {
    return 'fluent-emoji:baby-angel';
  }
  if (
    hayHas(hay, 'diable') ||
    hayHas(hay, 'demon') ||
    hayHas(hay, 'fielon') ||
    hayHas(hay, 'askinos') ||
    hayHas(hay, 'imp')
  ) {
    return 'fluent-emoji:angry-face-with-horns';
  }

  if (hayHas(hay, 'golem') || hayHas(hay, 'artificielle') || hayHas(hay, 'armure animee')) {
    return 'fluent-emoji:robot';
  }
  if (hayHas(hay, 'mimique')) return 'fluent-emoji:wrapped-gift';
  if (hayHas(hay, 'gelatineux') || hayHas(hay, 'vase') || hayHas(hay, 'cube')) {
    return 'fluent-emoji:microbe';
  }
  if (hayHas(hay, 'chaine animee')) return 'fluent-emoji:link';
  if (hayHas(hay, 'mephite') || hayHas(hay, 'azer') || hayHas(hay, 'elementaire')) {
    if (hayHas(hay, 'feu') || hayHas(hay, 'magma') || hayHas(hay, 'cendre')) return 'fluent-emoji:fire';
    if (hayHas(hay, 'glace') || hayHas(hay, 'froid') || hayHas(hay, 'eau') || hayHas(hay, 'vapeur')) {
      return 'fluent-emoji:snowflake';
    }
    if (hayHas(hay, 'terre') || hayHas(hay, 'schatz')) return 'fluent-emoji:rock';
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
  if (hayHas(hay, 'druide') || hayHas(hay, 'chamane')) return 'fluent-emoji:herb';
  if (hayHas(hay, 'barde')) return 'fluent-emoji:musical-notes';
  if (hayHas(hay, 'paladin') || hayHas(hay, 'acolyte') || hayHas(hay, 'ecclesiast') || hayHas(hay, 'adorateur') || hayHas(hay, 'pretre')) {
    return 'fluent-emoji:folded-hands';
  }
  if (hayHas(hay, 'assassin') || hayHas(hay, 'ninja')) return 'fluent-emoji:ninja';
  if (hayHas(hay, 'espion')) return 'fluent-emoji:disguised-face';
  if (
    hayHas(hay, 'guerrier') ||
    hayHas(hay, 'veteran') ||
    hayHas(hay, 'champion') ||
    hayHas(hay, 'berserker') ||
    hayHas(hay, 'garde') ||
    hayHas(hay, 'soldat')
  ) {
    return 'fluent-emoji:crossed-swords';
  }
  if (hayHas(hay, 'bandit') || hayHas(hay, 'brute') || hayHas(hay, 'baron')) {
    return 'fluent-emoji:angry-face';
  }

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
