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
