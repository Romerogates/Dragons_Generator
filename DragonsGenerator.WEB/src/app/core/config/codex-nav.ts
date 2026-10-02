/** Source unique des liens Codex (navbar, context-menu, hub /codex, guide). */
export interface CodexNavLink {
  label: string;
  path: string;
  icon: string;
  /** Mots-clés FR pour la recherche globale / filtre navbar. */
  synonyms?: string[];
  blurb: string;
}

export const CODEX_NAV_LINKS: CodexNavLink[] = [
  {
    label: 'Espèces',
    path: '/species',
    icon: 'fluent-emoji:dna',
    synonyms: ['peuples', 'races'],
    blurb: 'Neuf peuples d’Eana',
  },
  {
    label: 'Classes',
    path: '/classes',
    icon: 'fluent-emoji:crossed-swords',
    synonyms: ['archétypes'],
    blurb: 'Treize classes et sous-classes',
  },
  {
    label: 'Civilisations',
    path: '/civilisations',
    icon: 'fluent-emoji:classical-building',
    synonyms: ['régions', 'royaumes', 'atlas'],
    blurb: 'Atlas et cultures',
  },
  {
    label: 'Équipements',
    path: '/equipments',
    icon: 'fluent-emoji:shield',
    synonyms: ['armes', 'armures', 'objets'],
    blurb: 'Armes, armures, outils',
  },
  {
    label: 'Sortilèges',
    path: '/spells',
    icon: 'fluent-emoji:sparkles',
    synonyms: ['sorts', 'magie', 'grimoire'],
    blurb: 'Grimoire des sorts',
  },
  {
    label: 'Bestiaire',
    path: '/creatures',
    icon: 'fluent-emoji:dragon',
    synonyms: ['monstres', 'créatures', 'ennemis'],
    blurb: 'Créatures et PNJ',
  },
  {
    label: 'Compétences',
    path: '/skills',
    icon: 'fluent-emoji:bookmark-tabs',
    synonyms: ['savoirs'],
    blurb: 'Savoirs et jets',
  },
  {
    label: 'Dons',
    path: '/feats',
    icon: 'fluent-emoji:trophy',
    synonyms: ['talents', 'feats'],
    blurb: 'Dons et talents',
  },
  {
    label: 'Historiques',
    path: '/backgrounds',
    icon: 'fluent-emoji:scroll',
    synonyms: ['backgrounds', 'origines'],
    blurb: 'Historiques de personnage',
  },
  {
    label: 'Actions de combat',
    path: '/combat-actions',
    icon: 'fluent-emoji:collision',
    synonyms: ['combat', 'actions'],
    blurb: 'Actions en combat',
  },
  {
    label: 'Divinités',
    path: '/deities',
    icon: 'fluent-emoji:glowing-star',
    synonyms: ['dieux', 'panthéon', 'foi'],
    blurb: 'Panthéon d’Eana',
  },
];

export function filterCodexNavLinks(query: string): CodexNavLink[] {
  const q = query.trim().toLowerCase();
  if (!q) return CODEX_NAV_LINKS;
  return CODEX_NAV_LINKS.filter((l) => {
    if (l.label.toLowerCase().includes(q) || l.path.toLowerCase().includes(q)) return true;
    if (l.blurb.toLowerCase().includes(q)) return true;
    return (l.synonyms ?? []).some((s) => s.toLowerCase().includes(q) || q.includes(s.toLowerCase()));
  });
}
