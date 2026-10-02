/** Tips ciblés par sous-classe — pattern template, pas 50 livrets complets. */

import type { GuideRulebookChapter, GuideRulebookSection } from './guide-rulebooks';

export interface GuideSubclassPlaybook {
  subclassId: string;
  subclassName: string;
  classId: string;
  className: string;
  title: string;
  subtitle: string;
  pdfFilename: string;
  related: { label: string; path: string }[];
  chapters: GuideRulebookChapter[];
}

function sec(
  id: string,
  title: string,
  paragraphs?: string[],
  bullets?: string[],
): GuideRulebookSection {
  return { id, title, paragraphs, bullets };
}

/** Gabarit court : identité + 3 tips + lien classe parente. */
function subclassTip(
  subclassId: string,
  subclassName: string,
  classId: string,
  className: string,
  identity: string[],
  tips: string[],
  traps: string[],
): GuideSubclassPlaybook {
  return {
    subclassId,
    subclassName,
    classId,
    className,
    title: `Sous-classe — ${subclassName}`,
    subtitle: `Complément au guide ${className} : ce que change cette voie.`,
    pdfFilename: `dragons-jouer-${subclassId.replace(/^subcls-/, '')}.pdf`,
    related: [
      { label: `Guide ${className}`, path: `/guide/classe/${classId}` },
      { label: 'Fiche Codex', path: `/classes/${classId}` },
      { label: 'Joueur à la table', path: '/guide/joueur-table' },
    ],
    chapters: [
      {
        id: 'identite',
        title: subclassName,
        sections: [
          sec('role', 'Ce que vous incarnez', undefined, identity),
          sec('tips', 'À la table', undefined, tips),
          sec(
            'pieges',
            'Pièges du débutant',
            ['Erreurs fréquentes avec cette sous-classe.'],
            traps,
          ),
        ],
      },
    ],
  };
}

export const GUIDE_SUBCLASS_PLAYBOOKS: GuideSubclassPlaybook[] = [
  subclassTip(
    'subcls-berserker',
    'Berserker',
    'cls-barbare',
    'Barbare',
    [
      'Rage plus agressive : frappes supplémentaires quand vous êtes en furie.',
      'Vous restez un tank de front — mais vous brûlez plus de ressources.',
    ],
    [
      'Gardez une Rage pour le pic du combat, pas le premier gobelin.',
      'Annoncez clairement quand vous entrez / sortez de Rage.',
    ],
    [
      'Tout dépenser au round 1 puis être « à plat » sur le boss.',
      'Ignorer le guide Barbare de base (positionnement, alliés).',
    ],
  ),
  subclassTip(
    'subcls-champion',
    'Champion',
    'cls-guerrier',
    'Guerrier',
    [
      'Critiques améliorés et athlétisme : le guerrier « pur » et lisible.',
      'Peu de listes magiques — idéal pour débuter.',
    ],
    [
      'Misez sur les coups critiques et les jets FOR / Athlétisme hors combat.',
      'Utilisez Second souffle / Action supplémentaire sans les garder « pour plus tard ».',
    ],
    [
      'Jouer comme un mage de guerre sans en avoir les outils.',
      'Oublier que vous êtes le filet de sécurité du groupe au front.',
    ],
  ),
  subclassTip(
    'subcls-elu-arcanique',
    'Élu arcanique',
    'cls-guerrier',
    'Guerrier',
    [
      'Guerrier qui ajoute une touche de magie de guerre Eana (pas un Eldritch Knight PHB).',
      'Vous restez martial : les sorts complètent, ils ne remplacent pas l’arme.',
    ],
    [
      'Lisez les sorts connus sur la fiche avant la session.',
      'Concentration : un seul sort concentré à la fois, comme les lanceurs.',
    ],
    [
      'Vider tous les emplacements sur des mobs faibles.',
      'Rester loin du front « pour lancer » alors que votre CA / PV sont faits pour le contact.',
    ],
  ),
  subclassTip(
    'subcls-domaine-de-la-vie',
    'Domaine de la Vie',
    'cls-pretre',
    'Prêtre',
    [
      'Soins renforcés : vous êtes le filet de sécurité du groupe.',
      'Priorité : alliés à terre ou blessés graves, pas le DPS.',
    ],
    [
      'Préparez soins et buffs chaque jour ; gardez un emplacement d’urgence.',
      'Placez-vous pour toucher les alliés sans vous exposer inutilement.',
    ],
    [
      'Tout soigner « au cas où » et ne plus rien avoir au boss.',
      'Aller au corps à corps sans armure / domaine adaptés.',
    ],
  ),
  subclassTip(
    'subcls-mage-de-guerre',
    'Mage de guerre',
    'cls-magicien',
    'Magicien',
    [
      'Magicien plus résistant au front léger : armures légères et options martiales selon progression.',
      'Toujours INT pour les sorts — ne jouez pas un guerrier déguisé.',
    ],
    [
      'Gardez la distance quand c’est possible ; utilisez la survivabilité pour les urgences.',
      'Concentration : buffs de groupe avant gros sorts de zone.',
    ],
    [
      'Imiter le champion au contact sans les PV / armure lourde.',
      'Oublier de préparer des utilitaires (contrôle, détection).',
    ],
  ),
];

export function getGuideSubclassPlaybook(
  subclassId: string | null | undefined,
): GuideSubclassPlaybook | null {
  if (!subclassId) return null;
  return GUIDE_SUBCLASS_PLAYBOOKS.find((p) => p.subclassId === subclassId) ?? null;
}

export function subclassPlaybookPath(subclassId: string): string {
  return `/guide/sous-classe/${subclassId}`;
}
