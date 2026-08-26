/** Iconify fluent-emoji icons per character class id. */
export const CLASS_ICONS: Record<string, string> = {
  'cls-barbare': 'fluent-emoji:axe',
  'cls-barde': 'fluent-emoji:banjo',
  'cls-druide': 'fluent-emoji:herb',
  'cls-ensorceleur': 'fluent-emoji:sparkles',
  'cls-guerrier': 'fluent-emoji:crossed-swords',
  'cls-lettre': 'fluent-emoji:books',
  'cls-magicien': 'fluent-emoji:open-book',
  'cls-moine': 'fluent-emoji:person-in-lotus-position',
  'cls-paladin': 'fluent-emoji:shield',
  'cls-pretre': 'fluent-emoji:classical-building',
  'cls-rodeur': 'fluent-emoji:bow-and-arrow',
  'cls-roublard': 'fluent-emoji:dagger',
  'cls-sorcier': 'fluent-emoji:eye',
};

export function getClassIcon(classId: string): string {
  return CLASS_ICONS[classId] || 'fluent-emoji:bust-in-silhouette';
}
