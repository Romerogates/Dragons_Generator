/** Iconify ids per character class — resolved to painted Codex portraits. */
export const CLASS_ICONS: Record<string, string> = {
  'cls-barbare': 'fluent-emoji:barbarian',
  'cls-barde': 'fluent-emoji:bard',
  'cls-druide': 'fluent-emoji:druid',
  'cls-ensorceleur': 'fluent-emoji:sorcerer',
  'cls-guerrier': 'fluent-emoji:crossed-swords',
  'cls-lettre': 'fluent-emoji:scholar',
  'cls-magicien': 'fluent-emoji:man-mage',
  'cls-moine': 'fluent-emoji:monk',
  'cls-paladin': 'fluent-emoji:paladin',
  'cls-pretre': 'fluent-emoji:folded-hands',
  'cls-rodeur': 'fluent-emoji:ranger',
  'cls-roublard': 'fluent-emoji:dagger',
  'cls-sorcier': 'fluent-emoji:warlock',
};

const CLASS_LABEL_ICONS: readonly (readonly [string, string])[] = [
  ['barbare', CLASS_ICONS['cls-barbare']],
  ['barde', CLASS_ICONS['cls-barde']],
  ['druide', CLASS_ICONS['cls-druide']],
  ['ensorceleur', CLASS_ICONS['cls-ensorceleur']],
  ['magicien', CLASS_ICONS['cls-magicien']],
  ['lettré', CLASS_ICONS['cls-lettre']],
  ['lettre', CLASS_ICONS['cls-lettre']],
  ['moine', CLASS_ICONS['cls-moine']],
  ['paladin', CLASS_ICONS['cls-paladin']],
  ['prêtre', CLASS_ICONS['cls-pretre']],
  ['pretre', CLASS_ICONS['cls-pretre']],
  ['rôdeur', CLASS_ICONS['cls-rodeur']],
  ['rodeur', CLASS_ICONS['cls-rodeur']],
  ['roublard', CLASS_ICONS['cls-roublard']],
  ['sorcier', CLASS_ICONS['cls-sorcier']],
  ['guerrier', CLASS_ICONS['cls-guerrier']],
];

/** Id `cls-*` ou libellé FR (liste de persos). */
export function getClassIcon(classIdOrName: string): string {
  const raw = (classIdOrName ?? '').trim();
  if (!raw) return 'fluent-emoji:bust-in-silhouette';
  const byId = CLASS_ICONS[raw];
  if (byId) return byId;
  const name = raw.toLowerCase();
  for (const [label, icon] of CLASS_LABEL_ICONS) {
    if (name.includes(label)) return icon;
  }
  return 'fluent-emoji:bust-in-silhouette';
}
