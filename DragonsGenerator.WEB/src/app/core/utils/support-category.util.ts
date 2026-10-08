export const SUPPORT_CATEGORIES = ['compte', 'bug', 'ia', 'campagne', 'autre'] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export function supportCategoryLabel(category: string | undefined | null): string {
  switch (category) {
    case 'compte':
      return 'Compte';
    case 'bug':
      return 'Bug';
    case 'ia':
      return 'IA';
    case 'campagne':
      return 'Campagne';
    default:
      return 'Autre';
  }
}

export function normalizeSupportCategory(raw: string | null | undefined): SupportCategory {
  const value = (raw ?? '').trim().toLowerCase();
  return (SUPPORT_CATEGORIES as readonly string[]).includes(value)
    ? (value as SupportCategory)
    : 'autre';
}
