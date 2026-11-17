/** Tips « comment jouer ce peuple » — 2–3 espèces + gabarit réutilisable. */

import type { GuideRulebookChapter, GuideRulebookSection } from './guide-rulebooks';

export interface GuideSpeciesPlaybook {
  speciesId: string;
  speciesName: string;
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

function speciesTip(
  speciesId: string,
  speciesName: string,
  flavor: string[],
  tips: string[],
  traps: string[],
): GuideSpeciesPlaybook {
  return {
    speciesId,
    speciesName,
    title: `Peuple — ${speciesName}`,
    subtitle: 'Conseils débutant pour incarner ce peuple sur Eana.',
    pdfFilename: `dragons-peuple-${speciesId.replace(/^sp-/, '')}.pdf`,
    related: [
      { label: 'Fiche Codex', path: `/species/${speciesId}` },
      { label: 'Créer un héros', path: '/create' },
      { label: 'Joueur à la table', path: '/guide/joueur-table' },
    ],
    chapters: [
      {
        id: 'peuple',
        title: `Jouer un ${speciesName}`,
        sections: [
          sec('identite', 'Sur la table', undefined, flavor),
          sec('tips', 'À retenir', undefined, tips),
          sec(
            'pieges',
            'Pièges du débutant',
            ['Erreurs fréquentes avec ce peuple.'],
            traps,
          ),
        ],
      },
    ],
  };
}

export const GUIDE_SPECIES_PLAYBOOKS: GuideSpeciesPlaybook[] = [
  speciesTip(
    'sp-humain',
    'Humain',
    [
      'Polyvalence : bons dans presque tous les rôles selon historique et classe.',
      'Souvent le choix le plus simple pour une première fiche.',
    ],
    [
      'Appuyez-vous sur l’historique et la classe pour définir votre niche.',
      'Annoncez clairement votre intention hors combat — pas besoin d’être « spécial ».',
    ],
    [
      'Chercher un « bonus racial unique » au lieu de jouer le personnage.',
      'Ignorer les traits listés sur la fiche Codex.',
    ],
  ),
  speciesTip(
    'sp-elfe',
    'Elfe',
    [
      'Sens, mobilité, longévité : souvent DEX / Perception et magie légère.',
      'Sous-espèces changent le ton (forêt, haut, etc.) — lisez la fiche.',
    ],
    [
      'Utilisez Perception et discrétion hors combat.',
      'En combat : distance ou mobilité avant le tanking lourd.',
    ],
    [
      'Oublier la vision / traits listés sur la fiche.',
      'Jouer un tank lourd sans les PV / armure adaptés.',
    ],
  ),
  speciesTip(
    'sp-nain',
    'Nain',
    [
      'Résistance, CON, artisanat : solide au front ou en soutien technique.',
      'Culture et outils d’artisan peuvent briller hors combat.',
    ],
    [
      'Annoncez les outils / maîtrises quand la scène s’y prête.',
      'En combat : restez utile au contact ou en soutien selon classe.',
    ],
    [
      'Ignorer les résistances / traits de peuplade.',
      'Jouer uniquement le cliché « mineur grincheux » sans lire la fiche Eana.',
    ],
  ),
  speciesTip(
    'sp-halfelin',
    'Halfelin',
    [
      'Petits, discrets, agiles : DEX, Discrétion, souvent chance ou ruse selon la lignée.',
      'Pieds-légers (médiateurs) et pieds-sûrs (nomades) ne se jouent pas pareil — lisez la fiche.',
    ],
    [
      'Annoncez Discrétion / escamotage hors combat, c’est votre force.',
      'En combat : mobilité et distance, pas le tanking.',
    ],
    [
      'Rester au contact comme un nain sans les PV / armure.',
      'Oublier la sous-espèce choisie à la forge.',
    ],
  ),
  speciesTip(
    'sp-gnome',
    'Gnome',
    [
      'INT, inventions, curiosité : outils, magie légère, mécaniques.',
      'Les gnomes des roches et svirfnebelins changent le ton — fiche Codex.',
    ],
    [
      'Proposez des solutions d’enquête, d’artisanat ou d’astuce, pas seulement des sorts.',
      'En combat : restez à l’abri, cantrips / arbalète selon classe.',
    ],
    [
      'Jouer uniquement le clown explosif sans lire les traits.',
      'Se placer au front « pour voir le mécanisme ».',
    ],
  ),
  speciesTip(
    'sp-drakeide',
    'Drakéide',
    [
      'Écailles, souffle, CHAR / FOR : fierté draconique et présence.',
      'La teinte d’écaille oriente souffle et affinités — elle est sur la fiche.',
    ],
    [
      'Annoncez le souffle (zone, type de dégâts) avant de le lancer.',
      'Hors combat : CHA pour impressionner, parfois savoirs anciens.',
    ],
    [
      'Oublier le souffle toute la soirée « pour plus tard ».',
      'Ignorer la teinte et les résistances listées.',
    ],
  ),
  speciesTip(
    'sp-tieffelin',
    'Tieffelin',
    [
      'Héritage fiélon : CHA / INT, résistance, sorts mineurs selon la lignée.',
      'Le rapport à l’humanité et au géniteur est un levier de rôle, pas une obligation de « méchant ».',
    ],
    [
      'Utilisez vision dans le noir et traits magiques hors combat.',
      'CHA pour l’influence — INT si votre build y va.',
    ],
    [
      'Jouer uniquement le cliché diabolique sans la fiche Eana (Xonim, stérilité, langue).',
      'Oublier les sorts raciaux déjà inscrits sur la feuille.',
    ],
  ),
  speciesTip(
    'sp-melesse',
    'Melessë',
    [
      'Ancêtres elfes et humains : CHA, aisance sociale, longévité. Sur Eana on dit melessë, pas « demi-elfe ».',
      'Chaque visage est un métissage unique — appuyez-vous sur l’historique.',
    ],
    [
      'CHA et compétences sociales : négociation, spectacle, médiation.',
      'Vision dans le noir et traits listés : vérifiez la fiche avant de les inventer.',
    ],
    [
      'Employer « demi-elfe » à la table si votre table suit le vocabulaire Eana.',
      'Jouer un elfe ou un humain générique sans les traits CHA.',
    ],
  ),
  speciesTip(
    'sp-merosis',
    'Merosis',
    [
      'Héritage orc : FOR / CON, intensité de vivre. Sur Eana on dit merosis, pas « demi-orc ».',
      'Gloire, défis, philosophies de clan kaani — un levier de rôle, pas seulement de la rage.',
    ],
    [
      'FOR / Athlétisme et endurance : annoncez-les hors combat.',
      'En combat : frontline selon classe, pas forcément barbare.',
    ],
    [
      'Jouer uniquement le brute sans relire les traits (relance, ténacité…).',
      'Employer « demi-orc » si la table suit le vocabulaire Eana.',
    ],
  ),
];

export function getGuideSpeciesPlaybook(
  speciesId: string | null | undefined,
): GuideSpeciesPlaybook | null {
  if (!speciesId) return null;
  return GUIDE_SPECIES_PLAYBOOKS.find((p) => p.speciesId === speciesId) ?? null;
}

export function speciesPlaybookPath(speciesId: string): string {
  return `/guide/espece/${speciesId}`;
}
