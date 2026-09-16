/** Guides « comment jouer ce perso » — un par classe. */

import type { GuideRulebookChapter, GuideRulebookSection } from './guide-rulebooks';

export interface GuideClassPlaybook {
  classId: string;
  className: string;
  title: string;
  subtitle: string;
  pdfFilename: string;
  /** Classes sans sorts / magie notable. */
  hasSpells: boolean;
  /** Liens utiles (Codex, livret joueur…). */
  related: { label: string; path: string }[];
  chapters: GuideRulebookChapter[];
}

function sec(
  id: string,
  title: string,
  paragraphs?: string[],
  bullets?: string[],
  numbered?: string[],
): GuideRulebookSection {
  return { id, title, paragraphs, bullets, numbered };
}

function playbook(
  classId: string,
  className: string,
  hasSpells: boolean,
  focus: string[],
  watch: string[],
  traps: string[],
  combat: string[],
  spellExtra?: string[],
): GuideClassPlaybook {
  const chapters: GuideRulebookChapter[] = [
    {
      id: 'role',
      title: `Jouer un ${className}`,
      sections: [
        sec('focus', 'Sur quoi vous concentrez', undefined, focus),
        sec('attention', 'Faites attention à', undefined, watch),
        sec(
          'pieges',
          'Pièges du débutant',
          [
            'Erreurs fréquentes à cette classe. Lisez-les une fois avant la première session.',
          ],
          traps,
        ),
      ],
    },
    {
      id: 'combat',
      title: 'En combat',
      sections: [
        sec(
          'tour',
          'À votre tour',
          [
            'Initiative (1d20+DEX) = ordre seulement. Puis à votre tour : action → jet pour toucher si besoin → dégâts. Ce ne sont pas le même jet.',
          ],
          combat,
        ),
      ],
    },
  ];
  if (hasSpells && spellExtra?.length) {
    chapters.push({
      id: 'sorts',
      title: 'Sorts',
      sections: [sec('magie', 'Vos sorts', undefined, spellExtra)],
    });
  } else if (!hasSpells) {
    chapters.push({
      id: 'pas-sorts',
      title: 'Pas de sorts',
      sections: [
        sec('note', 'Pour cette classe', [
          `Le ${className} n’utilise en général pas d’emplacements de sorts. Ignorez les sections « lancer un sort » des livrets généraux : concentrez-vous sur armes, mobilité et capacités de classe.`,
        ]),
      ],
    });
  }
  chapters.push({
    id: 'hors-combat',
    title: 'Hors combat',
    sections: [
      sec('skills', 'Compétences', [
        'Annoncez une intention claire. Le MJ choisit la compétence. Vérifiez sur votre fiche si elle est maîtrisée.',
        'Total = 1d20 + modificateur + bonus de maîtrise (seulement si maîtrisé). Exemple : 15 + 3 + 2 = 20. Sans maîtrise : 15 + 3 = 18. La maîtrise n’est pas un 2e dé — c’est le bonus d’entraînement de votre niveau.',
      ]),
      sec('suite', 'Pour aller plus loin', [
        'Relisez le livret Joueur à la table (fiche annotée + glossaire) si un chiffre de la fiche vous échappe.',
        'Ouvrez la fiche Codex de la classe (lien en haut de page) pour les capacités et sous-classes Eana.',
      ]),
    ],
  });
  return {
    classId,
    className,
    title: `Comment jouer — ${className}`,
    subtitle: 'Conseils débutant pour votre classe, après la forge du héros.',
    pdfFilename: `dragons-jouer-${classId.replace(/^cls-/, '')}.pdf`,
    hasSpells,
    related: [
      { label: 'Fiche Codex', path: `/classes/${classId}` },
      { label: 'Joueur à la table', path: '/guide/joueur-table' },
    ],
    chapters,
  };
}

export const GUIDE_CLASS_PLAYBOOKS: GuideClassPlaybook[] = [
  playbook(
    'cls-barbare',
    'Barbare',
    false,
    [
      'Rester au front, absorber les coups (CON / PV).',
      'Utiliser la Rage au bon moment.',
      'FOR pour frapper fort au corps à corps.',
    ],
    [
      'Ne pas vous éloigner trop des alliés fragiles.',
      'Gérer la Rage : durée et usages limités.',
      'Hors combat : FOR / Athlétisme, intimidation parfois.',
    ],
    [
      'Activer la Rage trop tôt (ou trop tard) et la perdre avant le vrai combat.',
      'Oublier la résistance aux dégâts pendant la Rage et jouer trop prudent.',
      'Courir seul loin du groupe : vous tankez, vous ne remplacez pas le soigneur.',
    ],
    [
      'Chargez ou placez-vous au contact.',
      'Attaque : 1d20 + bonus d’attaque (FOR) → dégâts d’arme.',
      'Activez Rage avant ou au début d’un gros échange.',
    ],
  ),
  playbook(
    'cls-guerrier',
    'Guerrier',
    false,
    [
      'Polyvalence martiale : une ou deux armes, bouclier, ou distance.',
      'Action supplémentaire / capacités de combattant selon le niveau.',
    ],
    [
      'Choisir la bonne posture (défense vs dégâts).',
      'Protéger les lanceurs derrière vous.',
    ],
    [
      'Garder Second souffle / Action supplémentaire « pour plus tard » et ne jamais les utiliser.',
      'Changer d’arme chaque round sans raison (perdez le fil de votre build).',
      'Laisser les lanceurs au contact pendant que vous chassez un solo au loin.',
    ],
    [
      'Attaque(s) au tour : 1d20 + bonus → dégâts.',
      'Utilisez vos ressources de classe (second souffle, etc.) quand les PV baissent.',
    ],
  ),
  playbook(
    'cls-moine',
    'Moine',
    false,
    [
      'Mobilité, frappes à mains nues / armes de moine.',
      'Points de ki pour options spéciales.',
    ],
    [
      'Ne pas gaspiller tout le ki au premier round.',
      'DEX et SAG comptent souvent autant que FOR.',
    ],
    [
      'Vider tout le ki au round 1 sur un mob faible.',
      'Rester immobile comme un guerrier lourd : votre force, c’est le repositionnement.',
      'Oublier que l’initiative (DEX) et le toucher sont deux jets séparés.',
    ],
    [
      'Approchez, enchaînez attaques / ki.',
      'Jets d’attaque DEX ou FOR selon build.',
    ],
  ),
  playbook(
    'cls-roublard',
    'Roublard',
    false,
    [
      'Attaques sournoises, discrétion, compétences.',
      'DEX, positionnement, alliés pour le flanc.',
    ],
    [
      'Sans avantage / conditions de sournoise : dégâts plus faibles.',
      'Hors combat : crochetage, discrétion, investigation.',
    ],
    [
      'Attaquer sans avantage ni allié au contact → pas de sournoise, dégâts mous.',
      'Ouvrir chaque porte « pour voir » sans Discrétion ni plan de fuite.',
      'Rester collé au front comme un tank : CA souvent plus basse.',
    ],
    [
      'Cherchez l’avantage ou un allié au contact de la cible.',
      'Attaque DEX → dégâts + dés de sournoise si applicable.',
    ],
  ),
  playbook(
    'cls-rodeur',
    'Rôdeur',
    true,
    [
      'Pistage, exploration, combat à distance ou hybride.',
      'Quelques sorts de soutien / dégâts.',
    ],
    [
      'Gérer emplacements de sorts et concentration.',
      'Rester mobile ; marquer les bonnes cibles.',
    ],
    [
      'Lancer un sort de concentration puis un autre qui l’annule sans le vouloir.',
      'Rester à distance nulle d’un mage ennemi alors que vous avez l’arc.',
      'Oublier les outils hors combat (Survie, Nature) — c’est votre force narrative.',
    ],
    [
      'Arc / armes : jets d’attaque DEX ou FOR.',
      'Sorts : attaque magique ou sauvegarde selon le sort.',
    ],
    [
      'Préparez 1–2 sorts utiles hors combat (pistage, soin léger…).',
      'Concentration : un seul sort de concentration à la fois.',
    ],
  ),
  playbook(
    'cls-paladin',
    'Paladin',
    true,
    [
      'Frontline + serments + smite (dégâts divins).',
      'CHA / FOR ; soutien du groupe.',
    ],
    [
      'Ne pas tout smite sur le premier mob.',
      'Aura et soins : timing.',
    ],
    [
      'Smiter le premier gobelin et n’avoir plus d’emplacement pour le boss.',
      'Oublier les soins / auras pour « faire plus de DPS ».',
      'Jouer loin du groupe : vos auras et protections ne servent à personne.',
    ],
    [
      'Attaque d’arme puis smite si gros coup.',
      'Jets de sauvegarde / sorts de serment selon build.',
    ],
    [
      'Emplacements pour smite et sorts de soutien.',
      'CHA pour le DD de certains effets.',
    ],
  ),
  playbook(
    'cls-barde',
    'Barde',
    true,
    [
      'Soutien, CHA, compétences polyvalentes.',
      'Inspiration et sorts de contrôle / buff.',
    ],
    [
      'Ne pas rester au contact sans armure solide.',
      'Garder de l’inspiration pour les moments clés.',
    ],
    [
      'Dépenser toute l’inspiration au premier jet « pour tester ».',
      'Aller au corps à corps sans plan de repli.',
      'Lancer deux sorts de concentration d’affilée et perdre le buff du groupe.',
    ],
    [
      'Sorts : sauvegarde ou attaque magique.',
      'Arme légère en secours si besoin.',
    ],
    [
      'CHA pour DD et attaques de sorts.',
      'Concentration sur les buffs importants.',
    ],
  ),
  playbook(
    'cls-pretre',
    'Prêtre',
    true,
    [
      'Soins, buffs, domaine divin.',
      'SAG pour les sorts.',
    ],
    [
      'Prioriser la survie du groupe vs DPS.',
      'Concentration et emplacements.',
    ],
    [
      'Garder tous les soins « au cas où » jusqu’à ce qu’un allié tombe.',
      'Se placer au front sans armure / domaine adaptés.',
      'Oublier que SAG (pas CHA) pilote vos sorts.',
    ],
    [
      'Cantrips + sorts de soin / combat de domaine.',
      'Sauvegardes ennemies contre votre DD.',
    ],
    [
      'Préparez soins et utilitaires chaque jour.',
      'SAG = caractéristique de sorts.',
    ],
  ),
  playbook(
    'cls-druide',
    'Druide',
    true,
    [
      'Nature, formes sauvages éventuelles, sorts SAG.',
      'Contrôle de zone et soutien.',
    ],
    [
      'Forme sauvage : PV et timing.',
      'Concentration en forme ou hors forme.',
    ],
    [
      'Se transformer trop tôt et perdre la forme avant le combat sérieux.',
      'Casser sa propre concentration en changeant de forme / sort.',
      'Préparer uniquement des sorts de dégâts et ignorer le contrôle de terrain.',
    ],
    [
      'Sorts de zone / invocation / cantrips.',
      'Ou frappe en forme animale.',
    ],
    [
      'SAG pour DD et attaques de sorts.',
      'Préparez selon terrain et mission.',
    ],
  ),
  playbook(
    'cls-magicien',
    'Magicien',
    true,
    [
      'Grimoire, INT, préparation quotidienne.',
      'Contrôle, dégâts, utilitaire.',
    ],
    [
      'Rester loin du front.',
      'Un sort de concentration à la fois.',
      'Emplacements = ressource rare.',
    ],
    [
      'Lancer le plus gros sort au premier monstre faible.',
      'Rester à portée d’une charge ennemie « pour mieux viser ».',
      'Oublier de préparer des utilitaires (détection, rituel, contrôle).',
    ],
    [
      'Cantrip chaque tour si pas de gros sort.',
      'Gros sorts sur les scènes importantes.',
    ],
    [
      'INT pour DD / attaques magiques.',
      'Préparez la liste le matin ; rituels si dispo.',
    ],
  ),
  playbook(
    'cls-ensorceleur',
    'Ensorceleur',
    true,
    [
      'Magie innée, CHA, métamagie.',
      'Moins de sorts connus, plus de flexibilité de lancement.',
    ],
    [
      'Ne pas tout dépenser au round 1.',
      'Positionnement arrière.',
    ],
    [
      'Vider sorcellerie + emplacements dès le round 1.',
      'Oublier la métamagie choisie (elle change votre façon de jouer).',
      'Se comparer au magicien : moins de sorts connus, plus de punch sur ceux que vous avez.',
    ],
    [
      'Cantrips + sorts signature.',
      'Métamagie pour twin / subtle / etc. selon choix.',
    ],
    [
      'CHA pour DD et attaques.',
      'Points de sorcellerie à gérer.',
    ],
  ),
  playbook(
    'cls-sorcier',
    'Sorcier',
    true,
    [
      'Pacte, CHA, emplacements qui reviennent au repos court.',
      'Cantrips forts + pactes.',
    ],
    [
      'Peu d’emplacements : chaque sort compte.',
      'Invocations : lire ce qu’elles changent.',
    ],
    [
      'Garder les emplacements « précieux » et ne jamais les dépenser (ils reviennent au repos court).',
      'Ignorer les invocations / pacte qui définissent votre rôle.',
      'Oublier que le cantrip principal est votre attaque de base chaque tour.',
    ],
    [
      'Cantrip principal souvent chaque tour.',
      'Emplacement pour pic de dégâts ou utilitaire.',
    ],
    [
      'CHA pour DD / attaques.',
      'Repos d’emplacements au repos court.',
    ],
  ),
  playbook(
    'cls-lettre',
    'Lettré',
    true,
    [
      'Savoirs, INT, outils d’érudit / magie selon votre version de règles.',
      'Soutien intellectuel et utilitaire.',
    ],
    [
      'Rester pertinent hors combat (enquête, langues, savoirs).',
      'En combat : cantrips / sorts ou armes légères selon build.',
    ],
    [
      'Rester silencieux hors combat alors que l’enquête est votre terrain.',
      'Imiter un guerrier au front sans les PV / armure.',
      'Oublier de vérifier sur la fiche si vous avez vraiment des sorts (build variable).',
    ],
    [
      'Priorisez les options listées sur votre fiche.',
      'Jets INT pour beaucoup d’actions hors combat.',
    ],
    [
      'Si vous avez des sorts : INT pour le DD.',
      'Sinon concentrez-vous sur compétences et objets.',
    ],
  ),
];

export function getGuideClassPlaybook(classId: string | null | undefined): GuideClassPlaybook | null {
  if (!classId) return null;
  return GUIDE_CLASS_PLAYBOOKS.find((p) => p.classId === classId) ?? null;
}

export function classPlaybookPath(classId: string): string {
  return `/guide/classe/${classId}`;
}

/** Nom de fichier PDF pack débutant = livret joueur table + ce guide. */
export function classBeginnerPackFilename(classId: string): string {
  const slug = classId.replace(/^cls-/, '');
  return `dragons-pack-debutant-${slug}.pdf`;
}
