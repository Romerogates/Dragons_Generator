/**
 * Catalogue des manifestations occultes (sorcier) — niveaux 2 à 18.
 * Le JSON classe référence "invocations_catalogue" sans données embarquées.
 */
export interface InvocationOption {
  id: string;
  name: string;
  desc: string;
  /** Niveau de sorcier minimum. */
  minLevel: number;
  /** Prérequis de faveur du pacte (optionnel). */
  requiresPact?: 'chaine' | 'lame' | 'tome';
}

export const WARLOCK_INVOCATIONS: InvocationOption[] = [
  // --- Niv. 2 ---
  {
    id: 'invoc-regard-du-lanceur-de-sorts',
    name: 'Regard du lanceur de sorts',
    desc: 'Vous pouvez lire toutes les écritures. Une fois par repos long : lancer Compréhension des langues sans emplacement.',
    minLevel: 2,
  },
  {
    id: 'invoc-armure-des-ombres',
    name: 'Armure des ombres',
    desc: 'Vous pouvez lancer Armure du mage sur vous-même à volonté, sans emplacement ni composantes matérielles.',
    minLevel: 2,
  },
  {
    id: 'invoc-devotion-eternelle',
    name: 'Dévotion éternelle',
    desc: 'Vous pouvez lancer Serviteur invisible à volonté, sans emplacement.',
    minLevel: 2,
  },
  {
    id: 'invoc-yeux-du-coureur-des-chemins',
    name: 'Yeux du coureur des chemins',
    desc: 'Vous pouvez voir normalement dans l’obscurité magique ou non, jusqu’à 36 m.',
    minLevel: 2,
  },
  {
    id: 'invoc-souffle-infernal',
    name: 'Souffle infernal',
    desc: 'Quand vous lancez Décharge occulte, ajoutez votre modificateur de Charisme aux dégâts.',
    minLevel: 2,
  },
  {
    id: 'invoc-vision-du-diable',
    name: 'Vision du diable',
    desc: 'Vous voyez normalement dans les ténèbres, magiques ou non, dans un rayon de 36 m.',
    minLevel: 2,
  },
  {
    id: 'invoc-livre-des-anciennes-secrets',
    name: 'Livre des anciennes secrets',
    desc: 'Votre Livre des ombres contient trois sorts de rituel supplémentaires de votre choix.',
    minLevel: 2,
    requiresPact: 'tome',
  },
  {
    id: 'invoc-chaine-de-voix',
    name: 'Chaîne d’ordres',
    desc: 'Votre familier peut attaquer indépendamment. Vous pouvez communiquer télépathiquement avec lui.',
    minLevel: 2,
    requiresPact: 'chaine',
  },
  {
    id: 'invoc-masque-de-nombreuses-faces',
    name: 'Masque aux mille visages',
    desc: 'Vous pouvez lancer Déguisement à volonté, sans emplacement.',
    minLevel: 2,
  },
  {
    id: 'invoc-lance-de-lethargie',
    name: 'Lance de léthargie',
    desc: 'Quand vous touchez avec Décharge occulte, la VD de la cible est réduite de 3 m jusqu’à votre prochain tour.',
    minLevel: 2,
  },
  {
    id: 'invoc-voix-de-la-chaine',
    name: 'Voix de la chaîne',
    desc: 'Vous pouvez communiquer télépathiquement avec votre familier et, via lui, avec toute créature à 30 m de lui.',
    minLevel: 2,
    requiresPact: 'chaine',
  },
  // --- Niv. 5 ---
  {
    id: 'invoc-lame-assoiffee',
    name: 'Lame assoiffée',
    desc: 'Vous pouvez attaquer deux fois (au lieu d’une) quand vous utilisez l’action Attaquer avec votre arme de pacte.',
    minLevel: 5,
    requiresPact: 'lame',
  },
  {
    id: 'invoc-murmures-de-la-tombe',
    name: 'Murmures de la tombe',
    desc: 'Vous pouvez lancer Parler avec les morts à volonté, sans emplacement (1 fois / cadavre).',
    minLevel: 5,
  },
  {
    id: 'invoc-signe-de-mauvais-augure',
    name: 'Signe de mauvais augure',
    desc: 'Vous pouvez lancer Malédiction une fois avec un emplacement de pacte. Récupération au repos court ou long.',
    minLevel: 5,
  },
  {
    id: 'invoc-repostes-agonisantes',
    name: 'Repostes agonisantes',
    desc: 'Quand vous êtes touché au corps à corps, vous pouvez utiliser votre réaction pour infliger des dégâts psychiques (égal à votre niveau de sorcier).',
    minLevel: 5,
  },
  {
    id: 'invoc-regard-petrifiant',
    name: 'Regard de Midgard',
    desc: 'Vous pouvez lancer Immobilisation de personne une fois avec un emplacement de pacte. Récupération au repos court ou long.',
    minLevel: 5,
  },
  {
    id: 'invoc-tome-des-anciens',
    name: 'Tomes des anciens',
    desc: 'Vous pouvez lancer un rituel de niveau 1–3 depuis votre Livre des ombres sans préparer le sort.',
    minLevel: 5,
    requiresPact: 'tome',
  },
  // --- Niv. 7 ---
  {
    id: 'invoc-couronne-du-roi',
    name: 'Couronne des mages',
    desc: 'Vous pouvez lancer Lévitation sur vous-même à volonté, sans emplacement.',
    minLevel: 7,
  },
  {
    id: 'invoc-sceau-du-diable',
    name: 'Sceau du diable',
    desc: 'Vous pouvez lancer Bannissement une fois avec un emplacement de pacte. Récupération au repos court ou long.',
    minLevel: 7,
  },
  {
    id: 'invoc-oeil-de-l-ombre',
    name: 'Œil de l’ombre',
    desc: 'Vous pouvez voir à travers les ténèbres magiques jusqu’à 36 m ; avantage aux tests de Perception dans le noir.',
    minLevel: 7,
  },
  {
    id: 'invoc-lame-affamee',
    name: 'Lame affamée',
    desc: 'Quand vous réduisez une créature à 0 PV avec votre arme de pacte, vous gagnez des PV temporaires égaux à votre modificateur de Charisme + niveau de sorcier (min. 1).',
    minLevel: 7,
    requiresPact: 'lame',
  },
  // --- Niv. 9 ---
  {
    id: 'invoc-maitre-des-mille-formes',
    name: 'Maître des mille formes',
    desc: 'Vous pouvez lancer Métamorphose une fois avec un emplacement de pacte. Récupération au repos long.',
    minLevel: 9,
  },
  {
    id: 'invoc-vision-autre-monde',
    name: 'Vision de l’autre monde',
    desc: 'Vous pouvez lancer Voir l’invisibilité à volonté, sans emplacement.',
    minLevel: 9,
  },
  {
    id: 'invoc-ascension-ascendante',
    name: 'Ascension minuit',
    desc: 'Vous pouvez lancer Vol sur vous-même à volonté, sans emplacement, mais vous retombez si vous êtes inconscient.',
    minLevel: 9,
  },
  {
    id: 'invoc-lien-vital',
    name: 'Lien vital',
    desc: 'Quand votre familier est à 30 m, vous pouvez utiliser votre action pour le soigner (2d8 + Cha). 1× / repos court.',
    minLevel: 9,
    requiresPact: 'chaine',
  },
  // --- Niv. 12 ---
  {
    id: 'invoc-armure-de-lignes-de-force',
    name: 'Armure de lignes de force',
    desc: 'Vous gagnez une résistance à un type de dégâts choisi (hors contondant/perforant/tranchant). Changeable au repos long.',
    minLevel: 12,
  },
  {
    id: 'invoc-mot-de-fin',
    name: 'Mot de fin',
    desc: 'Quand vous touchez avec Décharge occulte, vous pouvez pousser la cible de 3 m (Grand) ou 1,50 m.',
    minLevel: 12,
  },
  {
    id: 'invoc-lame-du-pacte-perfectionnee',
    name: 'Lame de pacte perfectionnée',
    desc: 'Votre arme de pacte compte comme magique. Vous pouvez la transformer en action bonus.',
    minLevel: 12,
    requiresPact: 'lame',
  },
  // --- Niv. 15 ---
  {
    id: 'invoc-sorcier-des-profondeurs',
    name: 'Voyageur des brumes',
    desc: 'Vous pouvez lancer Passage par les arbres (ou équivalent brumeux) une fois par repos long sans emplacement.',
    minLevel: 15,
  },
  {
    id: 'invoc-chaine-des-ames',
    name: 'Chaînes des âmes',
    desc: 'Votre familier peut lancer une fois Décharge occulte en utilisant vos emplacements de pacte.',
    minLevel: 15,
    requiresPact: 'chaine',
  },
  {
    id: 'invoc-livre-des-ombres-vivantes',
    name: 'Livre des ombres vivantes',
    desc: 'Vous pouvez lancer un sort de niveau 6 de votre livre une fois par repos long sans emplacement.',
    minLevel: 15,
    requiresPact: 'tome',
  },
  {
    id: 'invoc-regard-de-deux-esprits',
    name: 'Regard de deux esprits',
    desc: 'Vous pouvez voir et entendre à travers les sens d’une créature charmé ou de votre familier jusqu’à 18 km.',
    minLevel: 15,
  },
  // --- Niv. 18 ---
  {
    id: 'invoc-souffle-des-mondes',
    name: 'Souffle des mondes',
    desc: 'Décharge occulte ignore la résistance aux dégâts magiques et inflige +Cha dégâts supplémentaires une fois par tour.',
    minLevel: 18,
  },
  {
    id: 'invoc-manteau-du-suzerain',
    name: 'Manteau du Suzerain',
    desc: 'Vous avez l’avantage aux jets de sauvegarde contre les sorts. 1× / repos long : succès automatique à un JS contre un sort.',
    minLevel: 18,
  },
];

export const PACT_BOONS: { id: string; name: string; desc: string }[] = [
  {
    id: 'pact-boon-chaine',
    name: 'Pacte de la chaîne',
    desc: 'Vous apprenez le sort Trouver un familier et pouvez invoquer des formes spéciales (diablotin, pseudodragon, quasit, lutin).',
  },
  {
    id: 'pact-boon-lame',
    name: 'Pacte de la lame',
    desc: 'Vous créez une arme de pacte liée. Vous êtes maîtrisant de cette arme et pouvez l’utiliser comme focaliseur.',
  },
  {
    id: 'pact-boon-tome',
    name: 'Pacte du tome',
    desc: 'Votre Livre des ombres vous confère trois sorts mineurs de n’importe quelle liste de classe.',
  },
];

export function invocationsForLevel(
  level: number,
  pactBoonId: string | null,
): InvocationOption[] {
  const pact =
    pactBoonId === 'pact-boon-chaine'
      ? 'chaine'
      : pactBoonId === 'pact-boon-lame'
        ? 'lame'
        : pactBoonId === 'pact-boon-tome'
          ? 'tome'
          : null;
  return WARLOCK_INVOCATIONS.filter((inv) => {
    if (inv.minLevel > level) return false;
    if (inv.requiresPact && inv.requiresPact !== pact) return false;
    return true;
  });
}

export function invocationLabel(id: string): string {
  return WARLOCK_INVOCATIONS.find((i) => i.id === id)?.name ?? id.replace(/^invoc-/, '').replace(/-/g, ' ');
}

export function pactBoonLabel(id: string | null | undefined): string {
  if (!id) return '';
  return PACT_BOONS.find((p) => p.id === id)?.name ?? id.replace(/^pact-boon-/, 'Pacte ').replace(/-/g, ' ');
}
