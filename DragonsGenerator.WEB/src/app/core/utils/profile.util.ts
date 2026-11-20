import { uniqueUiPortraitIcons } from './painted-icon.util';

export interface ProfileAccent {
  id: string;
  label: string;
  gradient: string;
  ring: string;
}

export const PROFILE_ACCENTS: ProfileAccent[] = [
  { id: 'violet', label: 'Violet', gradient: 'from-violet-600 to-fuchsia-700', ring: 'ring-violet-500/50' },
  { id: 'amber', label: 'Ambre', gradient: 'from-amber-500 to-orange-600', ring: 'ring-amber-500/50' },
  { id: 'emerald', label: 'Émeraude', gradient: 'from-emerald-600 to-teal-700', ring: 'ring-emerald-500/50' },
  { id: 'sky', label: 'Azur', gradient: 'from-sky-600 to-blue-700', ring: 'ring-sky-500/50' },
  { id: 'rose', label: 'Rose', gradient: 'from-rose-600 to-pink-700', ring: 'ring-rose-500/50' },
  { id: 'fuchsia', label: 'Fuchsia', gradient: 'from-fuchsia-600 to-purple-700', ring: 'ring-fuchsia-500/50' },
];

const PROFILE_AVATAR_CORE: { id: string; icon: string; label: string }[] = [
  { id: 'dragon', icon: 'fluent-emoji:dragon', label: 'Dragon' },
  { id: 'swords', icon: 'fluent-emoji:crossed-swords', label: 'Guerrier' },
  { id: 'mage', icon: 'fluent-emoji:man-mage', label: 'Mage' },
  { id: 'shield', icon: 'fluent-emoji:shield', label: 'Garde' },
  { id: 'scroll', icon: 'fluent-emoji:scroll', label: 'Scribe' },
  { id: 'star', icon: 'fluent-emoji:glowing-star', label: 'Étoile' },
  { id: 'dice', icon: 'fluent-emoji:game-die', label: 'Dés' },
  { id: 'map', icon: 'fluent-emoji:world-map', label: 'Explorateur' },
];

const AVATAR_LABELS: Record<string, string> = {
  'fluent-emoji:dragon': 'Dragon',
  'fluent-emoji:crossed-swords': 'Guerrier',
  'fluent-emoji:man-mage': 'Mage',
  'fluent-emoji:shield': 'Garde',
  'fluent-emoji:scroll': 'Scribe',
  'fluent-emoji:glowing-star': 'Étoile',
  'fluent-emoji:game-die': 'Dés',
  'fluent-emoji:world-map': 'Explorateur',
};

function labelFromPortraitIcon(icon: string, file: string): string {
  const known = AVATAR_LABELS[icon];
  if (known) return known;
  const base = file.split('/').pop()?.replace(/^ui-/, '').replace(/\.png$/i, '') ?? icon;
  return base.replace(/[-_]/g, ' ');
}

/** Avatars : classiques d’abord, puis tous les portraits peints du Codex. */
export const PROFILE_AVATAR_OPTIONS: { id: string; icon: string; label: string }[] = (() => {
  const seen = new Set(PROFILE_AVATAR_CORE.map((o) => o.icon));
  const extras = uniqueUiPortraitIcons()
    .filter((p) => !seen.has(p.icon))
    .map((p) => ({
      id: p.file.replace(/^\/assets\/equipment\//, '').replace(/\.png$/i, ''),
      icon: p.icon,
      label: labelFromPortraitIcon(p.icon, p.file),
    }));
  return [...PROFILE_AVATAR_CORE, ...extras];
})();

export function accentGradient(id: string | null | undefined): string {
  return PROFILE_ACCENTS.find((a) => a.id === id)?.gradient ?? PROFILE_ACCENTS[0].gradient;
}

export function accentRing(id: string | null | undefined): string {
  return PROFILE_ACCENTS.find((a) => a.id === id)?.ring ?? PROFILE_ACCENTS[0].ring;
}

export function profileInitial(name: string): string {
  const t = name.trim();
  return t ? t[0]!.toUpperCase() : '?';
}

export function accentMessageClass(id: string | null | undefined): string {
  switch (id) {
    case 'amber':
      return 'bg-amber-600';
    case 'emerald':
      return 'bg-emerald-600';
    case 'sky':
      return 'bg-sky-600';
    case 'rose':
      return 'bg-rose-600';
    case 'fuchsia':
      return 'bg-fuchsia-600';
    default:
      return 'bg-violet-600';
  }
}
