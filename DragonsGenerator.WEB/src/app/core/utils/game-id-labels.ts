/**
 * Traduction centralisée des IDs techniques du jeu → libellés FR.
 *
 * Usage :
 *   labelForGameId('wp-cat-martial')           → 'Armes de guerre'
 *   formatGameIds(['ar-light','ar-shield'])    → 'Armures légères, Boucliers'
 *   labelForItemRef({ id: 'wp-dague', qty: 2 }) → '2× Dague'
 *
 * Templates : pipes `gameIdLabel` / `gameIdLabels`.
 * Catalogues API : registerGameLabel(id, name) pour enrichir à chaud.
 */

import { CATEGORY_FILTERS, resolveEquipmentRefId } from './equipment.utils';
import { normalizeSkillId } from './skill.utils';

/** Dictionnaire figé (catégories, compétences, outils, alias fréquents). */
export const GAME_ID_LABELS: Record<string, string> = {
  // --- Génériques ---
  any: 'Au choix',
  'skill-any': 'N’importe quelle compétence',
  'any-skills': 'N’importe quelle compétence',

  // --- Caractéristiques ---
  str: 'Force',
  dex: 'Dextérité',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Sagesse',
  cha: 'Charisme',
  for: 'Force',
  sag: 'Sagesse',
  Force: 'Force',
  Dextérité: 'Dextérité',
  Constitution: 'Constitution',
  Intelligence: 'Intelligence',
  Sagesse: 'Sagesse',
  Charisme: 'Charisme',

  // --- Armures (préfixes API classes) ---
  'ar-light': 'Armures légères',
  'ar-medium': 'Armures intermédiaires',
  'ar-heavy': 'Armures lourdes',
  'ar-shield': 'Boucliers',
  'ar-all': 'Toutes les armures',

  // --- Armes / catégories (alias classes) ---
  'wp-cat-simple': 'Armes courantes',
  'wp-cat-martial': 'Armes de guerre',
  'wp-category-simple': 'Armes courantes',
  'wp-category-martial': 'Armes de guerre',
  'wp-simple': 'Armes courantes',
  'wp-martial': 'Armes de guerre',
  'wp-arme-courante': 'Armes courantes',
  'wp-arme-de-guerre': 'Armes de guerre',
  'wp-arme-courante-corps-a-corps': 'Armes courantes de corps à corps',
  'wp-arme-de-guerre-cac': 'Armes de guerre de corps à corps',

  // --- Catégories normalisées (equipment.utils) ---
  'category-simple-weapons': 'Armes courantes',
  'category-simple-melee-weapons': 'Armes courantes de corps à corps',
  'category-simple-ranged-weapons': 'Armes courantes à distance',
  'category-martial-weapons': 'Armes de guerre',
  'category-martial-melee-weapons': 'Armes de guerre de corps à corps',
  'category-martial-ranged-weapons': 'Armes de guerre à distance',
  'category-light-armor': 'Armures légères',
  'category-medium-armor': 'Armures intermédiaires',
  'category-heavy-armor': 'Armures lourdes',
  'category-shield': 'Boucliers',
  'category-all-armor': 'Toutes les armures',
  'category-tools': 'Outils d’artisan',
  'category-musical-instruments': 'Instruments de musique',
  'category-gaming-sets': 'Matériel de jeu',
  'category-vehicles': 'Véhicules',
  'category-arcane-focus': 'Focaliseur arcanique',
  'category-druidic-focus': 'Focaliseur druidique',
  'category-holy-symbol': 'Symbole sacré',

  // --- Compétences ---
  'skill-acrobaties': 'Acrobaties',
  'skill-arcanes': 'Arcanes',
  'skill-arcana': 'Arcanes',
  'skill-athletisme': 'Athlétisme',
  'skill-discretion': 'Discrétion',
  'skill-dressage': 'Dressage',
  'skill-escamotage': 'Escamotage',
  'skill-histoire': 'Histoire',
  'skill-history': 'Histoire',
  'skill-intimidation': 'Intimidation',
  'skill-intuition': 'Intuition',
  'skill-insight': 'Intuition',
  'skill-investigation': 'Investigation',
  'skill-medecine': 'Médecine',
  'skill-medicine': 'Médecine',
  'skill-nature': 'Nature',
  'skill-perception': 'Perception',
  'skill-persuasion': 'Persuasion',
  'skill-religion': 'Religion',
  'skill-representation': 'Représentation',
  'skill-performance': 'Représentation',
  'skill-survie': 'Survie',
  'skill-survival': 'Survie',
  'skill-tromperie': 'Tromperie',
  'skill-deception': 'Tromperie',
  'skill-stealth': 'Discrétion',
  'skill-acrobatics': 'Acrobaties',
  'skill-athletics': 'Athlétisme',
  'skill-animal-handling': 'Dressage',
  'skill-sleight-of-hand': 'Escamotage',
  'skill-arcane': 'Arcanes',

  // --- Outils / instruments / jeux / véhicules ---
  'tl-necessaire-dalchimiste': 'Nécessaire d’alchimiste',
  'tl-necessaire-de-brasseur': 'Nécessaire de brasseur',
  'tl-necessaire-de-calligraphe': 'Nécessaire de calligraphe',
  'tl-necessaire-de-calligraphie': 'Nécessaire de calligraphie',
  'tl-necessaire-de-cartographe': 'Nécessaire de cartographe',
  'tl-necessaire-de-deguisement': 'Nécessaire de déguisement',
  'tl-necessaire-de-faussaire': 'Nécessaire de faussaire',
  'tl-necessaire-dempoisonneur': 'Nécessaire d’empoisonneur',
  'tl-necessaire-de-peintre': 'Nécessaire de peintre',
  'tl-necessaire-dherboristerie': 'Nécessaire d’herboristerie',
  'tl-necessaire-herboristerie': 'Nécessaire d’herboristerie',
  'tl-outils-de-bijoutier': 'Outils de bijoutier',
  'tl-outils-de-cordonnier': 'Outils de cordonnier',
  'tl-outils-de-forgeron': 'Outils de forgeron',
  'tl-outils-de-la-ferme': 'Outils de la ferme',
  'tl-outils-de-macon': 'Outils de maçon',
  'tl-outils-de-menuisier': 'Outils de menuisier',
  'tl-outils-de-potier': 'Outils de potier',
  'tl-outils-de-retameur': 'Outils de rétameur',
  'tl-outils-de-sculpteur-sur-bois': 'Outils de sculpteur sur bois',
  'tl-outils-de-tanneur': 'Outils de tanneur',
  'tl-outils-de-tisserand': 'Outils de tisserand',
  'tl-outils-de-verrier': 'Outils de verrier',
  'tl-outils-de-voleur': 'Outils de voleur',
  'tl-ustensiles-de-cuisinier': 'Ustensiles de cuisinier',
  'tl-instruments-de-navigation': 'Instruments de navigation',
  'tl-bombarde': 'Bombarde',
  'tl-cor': 'Cor',
  'tl-cornemuse': 'Cornemuse',
  'tl-dulcimer': 'Dulcimer',
  'tl-flute': 'Flûte',
  'tl-flute-de-pan': 'Flûte de Pan',
  'tl-luth': 'Luth',
  'tl-lyre': 'Lyre',
  'tl-tambour': 'Tambour',
  'tl-viole': 'Viole',
  'tl-des': 'Dés',
  'tl-echecs': 'Échecs',
  'tl-go': 'Go',
  'tl-jeu-de-cartes': 'Jeu de cartes',
  'tl-osselets': 'Osselets',
  'tl-vehicules-terrestres': 'Véhicules terrestres',
  'tl-vehicules-maritimes': 'Véhicules maritimes',
  'tl-focaliseur-arcanique': 'Focaliseur arcanique',
  'tl-focaliseur-druidique': 'Focaliseur druidique',
  'tl-symbole-sacre': 'Symbole sacré',
  'tl-focaliseur-personnel': 'Focaliseur personnel',

  // --- Types génériques (outils au choix) ---
  instrument: 'Instrument de musique (au choix)',
  gameSet: 'Matériel de jeu (au choix)',
  game_set: 'Matériel de jeu (au choix)',
  tool: 'Outil d’artisan (au choix)',
  artisan: 'Outil d’artisan (au choix)',
  vehicle: 'Véhicule (au choix)',
  vehicule: 'Véhicule (au choix)',

  // --- Armes courantes fréquentes ---
  'wp-dague': 'Dague',
  'wp-gourdin': 'Gourdin',
  'wp-javeline': 'Javeline',
  'wp-lance': 'Lance',
  'wp-masse-darmes': 'Masse d’armes',
  'wp-masse-d-armes': 'Masse d’armes',
  'wp-baton-de-combat': 'Bâton de combat',
  'wp-ceste': 'Ceste',
  'wp-serpe': 'Serpe',
  'wp-faucille': 'Serpe',
  'wp-flechette': 'Fléchette',
  'wp-fronde': 'Fronde',
  'wp-arbalete-legere': 'Arbalète légère',
  'wp-arbalete-de-poing': 'Arbalète de poing',
  'wp-epee-courte': 'Épée courte',
  'wp-epee-longue': 'Épée longue',
  'wp-cimeterre': 'Cimeterre',
  'wp-rapiere': 'Rapière',
};

/** Enrichissements runtime (noms issus de l’API équipements / compétences). */
const runtimeLabels = new Map<string, string>();

/** Enregistre un libellé issu d’un catalogue API (écrase le fallback, pas les clés figées utiles). */
export function registerGameLabel(id: string, label: string): void {
  if (!id || !label) return;
  const key = id.trim();
  runtimeLabels.set(key, label);
  // Alias skill-
  if (key.startsWith('ski-')) runtimeLabels.set(normalizeSkillId(key), label);
}

export function registerGameLabels(entries: Iterable<[string, string]>): void {
  for (const [id, label] of entries) registerGameLabel(id, label);
}

/** Accents / orthographes courantes pour le fallback slug → label. */
const TOKEN_FIXES: Record<string, string> = {
  arbalete: 'arbalète',
  epee: 'épée',
  masse: 'masse',
  baton: 'bâton',
  flechette: 'fléchette',
  flute: 'flûte',
  rapiere: 'rapière',
  macon: 'maçon',
  retameur: 'rétameur',
  necessaire: 'nécessaire',
  alchimiste: "d'alchimiste",
  herboristerie: "d'herboristerie",
  empoisonneur: "d'empoisonneur",
  medecine: 'médecine',
  representation: 'représentation',
  discretion: 'discrétion',
  athletisme: 'athlétisme',
  matelassee: 'matelassée',
  sacree: 'sacrée',
  sacre: 'sacré',
};

const PREFIXES =
  /^(skill|ski|wp|ar|gr|tl|eq|lg|ws|feat|cls|civ|spc|bg|spl|dmg|veh)-/i;

function slugToLabel(raw: string): string {
  let s = raw.trim();
  // qty suffix foo-x2
  s = s.replace(/-x\d+$/i, '');
  s = resolveEquipmentRefId(s);
  s = s.replace(PREFIXES, '');
  s = s.replace(/^cat-|^category-/i, '');
  s = s.replace(/-/g, ' ').trim();
  if (!s) return raw;

  const words = s.split(/\s+/).map((w) => {
    const lower = w.toLowerCase();
    const fixed = TOKEN_FIXES[lower] ?? lower;
    return fixed.charAt(0).toUpperCase() + fixed.slice(1);
  });
  return words.join(' ');
}

/**
 * Résout un ID technique vers un libellé FR.
 * Ordre : runtime catalogue → dictionnaire → catégories equipment → fallback slug.
 */
export function labelForGameId(id: string | null | undefined): string {
  if (id == null || id === '') return '—';
  const raw = String(id).trim();
  if (!raw) return '—';

  // Runtime (API)
  const runtime = runtimeLabels.get(raw) ?? runtimeLabels.get(resolveEquipmentRefId(raw));
  if (runtime) return runtime;

  // Skill alias ski- → skill-
  if (raw.startsWith('ski-') || raw.startsWith('skill-')) {
    const skillId = normalizeSkillId(raw);
    if (runtimeLabels.has(skillId)) return runtimeLabels.get(skillId)!;
    if (GAME_ID_LABELS[skillId]) return GAME_ID_LABELS[skillId];
  }

  if (GAME_ID_LABELS[raw]) return GAME_ID_LABELS[raw];

  const resolved = resolveEquipmentRefId(raw);
  if (GAME_ID_LABELS[resolved]) return GAME_ID_LABELS[resolved];

  const cat = CATEGORY_FILTERS[resolved];
  if (cat?.label) return cat.label;

  return slugToLabel(raw);
}

/** Liste d’IDs → chaîne affichable. */
export function formatGameIds(
  ids: readonly string[] | null | undefined,
  separator = ', ',
  empty = '—',
): string {
  if (!ids?.length) return empty;
  return ids.map((id) => labelForGameId(id)).join(separator);
}

/** Ref équipement { id, qty } → "2× Dague". */
export function labelForItemRef(
  ref: { id?: string; qty?: number } | string | null | undefined,
): string {
  if (ref == null) return '—';
  if (typeof ref === 'string') return labelForGameId(ref);
  const label = labelForGameId(ref.id);
  const qty = ref.qty ?? 1;
  return qty > 1 ? `${qty}× ${label}` : label;
}
