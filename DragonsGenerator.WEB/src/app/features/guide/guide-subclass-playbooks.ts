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
  subclassTip(
    'subcls-tueur-de-mages',
    'Tueur de mages',
    'cls-barbare',
    'Barbare',
    [
      'Rage tournée contre les lanceurs : interruption, poursuite, résistance magique selon progression.',
      'Vous restez un barbare de front — la cible prioritaire change.',
    ],
    [
      'Identifiez les lanceurs ennemis et fermez la distance.',
      'Gardez une Rage pour le mage, pas le premier sbire.',
    ],
    [
      'Chasser le mage en laissant le groupe sans tank.',
      'Ignorer le guide Barbare (Rage, position).',
    ],
  ),
  subclassTip(
    'subcls-voie-de-la-paume',
    'Voie de la paume',
    'cls-moine',
    'Moine',
    [
      'Ki pour enchaîner frappes et contrôle au contact.',
      'Mobilité d’abord : vous n’êtes pas un guerrier lourd.',
    ],
    [
      'Gardez du ki pour le pic du combat.',
      'Annoncez clairement chaque dépense de ki.',
    ],
    [
      'Vider le ki au round 1 sur un sbire.',
      'Rester immobile au milieu de la mêlée.',
    ],
  ),
  subclassTip(
    'subcls-voleur-roublard',
    'Voleur',
    'cls-roublard',
    'Roublard',
    [
      'Escalade, crochetage, second-story : l’exploration est votre terrain.',
      'La sournoise reste la règle d’or en combat.',
    ],
    [
      'Préparez Discrétion avant d’ouvrir une porte.',
      'Cherchez avantage ou allié au contact pour la sournoise.',
    ],
    [
      'Ouvrir toutes les serrures « pour voir » sans plan de fuite.',
      'Attaquer seul au front sans condition de sournoise.',
    ],
  ),
  subclassTip(
    'subcls-chasseur',
    'Chasseur',
    'cls-rodeur',
    'Rôdeur',
    [
      'Cibles marquées, options contre horde ou gros monstre.',
      'Distance et pistage : vous orientez le groupe dans la nature.',
    ],
    [
      'Choisissez la bonne option de chasseur selon l’ennemi.',
      'Concentration : un sort à la fois.',
    ],
    [
      'Rester collé au mage ennemi avec un arc à la main.',
      'Oublier Survie / Nature hors combat.',
    ],
  ),
  subclassTip(
    'subcls-serment-de-devotion',
    'Serment de dévotion',
    'cls-paladin',
    'Paladin',
    [
      'Protection, serments lumineux, smite ciblé.',
      'Vous êtes le filet du groupe autant que le DPS sacré.',
    ],
    [
      'Smite le boss, pas le premier gobelin.',
      'Tenez-vous près des alliés pour les auras.',
    ],
    [
      'Jouer un barbare sacré loin du groupe.',
      'Vider tous les emplacements au premier round.',
    ],
  ),
  subclassTip(
    'subcls-college-conteurs',
    'Collège des conteurs',
    'cls-barde',
    'Barde',
    [
      'Récits, inspiration, contrôle social et buffs.',
      'CHA partout : hors combat vous menez la scène.',
    ],
    [
      'Gardez de l’inspiration pour les jets qui comptent.',
      'Un seul sort de concentration à la fois.',
    ],
    [
      'Tout dépenser au premier jet « pour tester ».',
      'Aller au contact sans repli.',
    ],
  ),
  subclassTip(
    'subcls-cercle-de-la-terre',
    'Cercle de la terre',
    'cls-druide',
    'Druide',
    [
      'Sorts de terrain, récupération, identité liée au biome.',
      'SAG pour les sorts — la forme sauvage n’est pas obligatoire.',
    ],
    [
      'Préparez selon le lieu de la soirée (forêt, pierre, marais…).',
      'Concentration : ne la cassez pas en changeant de sort.',
    ],
    [
      'N’avoir que des sorts de dégâts.',
      'Se transformer trop tôt et perdre la forme avant le pic.',
    ],
  ),
  subclassTip(
    'subcls-lignee-draconique',
    'Lignée draconique',
    'cls-ensorceleur',
    'Ensorceleur',
    [
      'Sang de dragon : résistance, présence, sorts plus « élémentaires ».',
      'Peu de sorts connus : ils doivent coller à votre teinte.',
    ],
    [
      'Métamagie + emplacements = pic, pas le round 1 entier.',
      'CHA pour DD et attaques.',
    ],
    [
      'Vider sorcellerie dès le premier monstre.',
      'Oublier la résistance / origine draconique sur la fiche.',
    ],
  ),
  subclassTip(
    'subcls-seigneur-fielon',
    'Seigneur fiélon',
    'cls-sorcier',
    'Sorcier',
    [
      'Pacte infernal : cantrip fort, emplacements au repos court, tentations de rôle.',
      'Chaque sort compte — vous n’êtes pas un magicien.',
    ],
    [
      'Cantrip principal presque chaque tour.',
      'Relisez invocations et pacte avant la session.',
    ],
    [
      'Garder les emplacements « précieux » et ne jamais les lancer (ils reviennent).',
      'Imiter un prêtre soigneur sans en avoir les outils.',
    ],
  ),
  subclassTip(
    'subcls-alchimie',
    'Alchimie',
    'cls-lettre',
    'Lettré',
    [
      'Savoirs, préparations, outils d’érudit : l’enquête et les objets.',
      'INT d’abord — le combat n’est qu’un des terrains.',
    ],
    [
      'Annoncez vos outils / préparations hors combat.',
      'Vérifiez sur la fiche si vous avez vraiment des sorts.',
    ],
    [
      'Rester muet pendant l’enquête.',
      'Tanking au front sans PV / armure.',
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
