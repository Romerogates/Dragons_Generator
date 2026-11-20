import { uniqueUiPortraitIcons } from './painted-icon.util';

export interface ProfileAccent {
  id: string;
  label: string;
  gradient: string;
  ring: string;
  message: string;
  initialText: string;
  clear?: boolean;
}

export const PROFILE_ACCENTS: ProfileAccent[] = [
  {
    id: 'none',
    label: 'Aucune',
    gradient: '',
    ring: 'ring-slate-500/40',
    message: 'bg-slate-700',
    initialText: 'text-slate-200',
    clear: true,
  },
  { id: 'white', label: 'Blanc', gradient: 'from-white to-zinc-300', ring: 'ring-white/70', message: 'bg-slate-500', initialText: 'text-slate-900' },
  { id: 'slate', label: 'Ardoise', gradient: 'from-slate-500 to-slate-900', ring: 'ring-slate-400/50', message: 'bg-slate-700', initialText: 'text-white' },
  { id: 'gold', label: 'Or', gradient: 'from-amber-200 to-yellow-600', ring: 'ring-amber-300/60', message: 'bg-amber-700', initialText: 'text-slate-900' },
  { id: 'red', label: 'Rouge', gradient: 'from-red-600 to-rose-800', ring: 'ring-red-500/50', message: 'bg-red-600', initialText: 'text-white' },
  { id: 'crimson', label: 'Cramoisi', gradient: 'from-rose-800 to-red-950', ring: 'ring-rose-700/50', message: 'bg-rose-800', initialText: 'text-white' },
  { id: 'violet', label: 'Violet', gradient: 'from-violet-600 to-fuchsia-700', ring: 'ring-violet-500/50', message: 'bg-violet-600', initialText: 'text-white' },
  { id: 'fuchsia', label: 'Fuchsia', gradient: 'from-fuchsia-600 to-purple-700', ring: 'ring-fuchsia-500/50', message: 'bg-fuchsia-600', initialText: 'text-white' },
  { id: 'rose', label: 'Rose', gradient: 'from-rose-600 to-pink-700', ring: 'ring-rose-500/50', message: 'bg-rose-600', initialText: 'text-white' },
  { id: 'amber', label: 'Ambre', gradient: 'from-amber-500 to-orange-600', ring: 'ring-amber-500/50', message: 'bg-amber-600', initialText: 'text-white' },
  { id: 'lime', label: 'Lime', gradient: 'from-lime-500 to-green-700', ring: 'ring-lime-400/50', message: 'bg-lime-600', initialText: 'text-slate-900' },
  { id: 'emerald', label: 'Émeraude', gradient: 'from-emerald-600 to-teal-700', ring: 'ring-emerald-500/50', message: 'bg-emerald-600', initialText: 'text-white' },
  { id: 'cyan', label: 'Cyan', gradient: 'from-cyan-500 to-teal-700', ring: 'ring-cyan-400/50', message: 'bg-cyan-600', initialText: 'text-white' },
  { id: 'sky', label: 'Azur', gradient: 'from-sky-600 to-blue-700', ring: 'ring-sky-500/50', message: 'bg-sky-600', initialText: 'text-white' },
  { id: 'indigo', label: 'Indigo', gradient: 'from-indigo-600 to-blue-900', ring: 'ring-indigo-500/50', message: 'bg-indigo-600', initialText: 'text-white' },
];

function accentById(id: string | null | undefined): ProfileAccent {
  return PROFILE_ACCENTS.find((a) => a.id === id) ?? PROFILE_ACCENTS.find((a) => a.id === 'violet')!;
}

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
  const a = accentById(id);
  return a.clear ? '' : a.gradient;
}

/** Fond du cercle avatar (transparent si « Aucune »). */
export function accentSurfaceClass(id: string | null | undefined): string {
  const a = accentById(id);
  if (a.clear) return 'bg-transparent ring-1 ring-inset ring-slate-500/70';
  return `bg-gradient-to-br ${a.gradient}`;
}

export function accentInitialClass(id: string | null | undefined): string {
  return accentById(id).initialText;
}

/** FAB messages : jamais un fond blanc/vide (l’icône disparaîtrait). */
export function accentFabGradient(id: string | null | undefined): string {
  const a = accentById(id);
  if (a.clear || a.id === 'white') return 'from-slate-600 to-slate-800';
  return a.gradient;
}

export function accentRing(id: string | null | undefined): string {
  return accentById(id).ring;
}

export function profileInitial(name: string): string {
  const t = name.trim();
  return t ? t[0]!.toUpperCase() : '?';
}

export function accentMessageClass(id: string | null | undefined): string {
  return accentById(id).message;
}
