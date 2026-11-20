/** Iconify ids per species — resolved to painted Codex portraits. */
export const SPECIES_ICONS: Record<string, string> = {
  'sp-drakeide': 'fluent-emoji:dragonborn',
  'sp-elfe': 'fluent-emoji:man-elf',
  'sp-gnome': 'fluent-emoji:gnome',
  'sp-halfelin': 'fluent-emoji:halfling',
  'sp-humain': 'fluent-emoji:human',
  'sp-melesse': 'fluent-emoji:halfelf',
  'sp-merosis': 'fluent-emoji:orc',
  'sp-merosi': 'fluent-emoji:orc',
  'sp-nain': 'fluent-emoji:dwarf',
  'sp-tieffelin': 'fluent-emoji:tiefling',
};

const SPECIES_LABEL_ICONS: readonly (readonly [string, string])[] = [
  ['drakéide', SPECIES_ICONS['sp-drakeide']],
  ['drakeide', SPECIES_ICONS['sp-drakeide']],
  ['elfe', SPECIES_ICONS['sp-elfe']],
  ['nain', SPECIES_ICONS['sp-nain']],
  ['halfelin', SPECIES_ICONS['sp-halfelin']],
  ['gnome', SPECIES_ICONS['sp-gnome']],
  ['meless', SPECIES_ICONS['sp-melesse']],
  ['demi-elf', SPECIES_ICONS['sp-melesse']],
  ['merosi', SPECIES_ICONS['sp-merosis']],
  ['demi-orc', SPECIES_ICONS['sp-merosis']],
  ['tieffelin', SPECIES_ICONS['sp-tieffelin']],
  ['mélancolia', SPECIES_ICONS['sp-tieffelin']],
  ['melancolia', SPECIES_ICONS['sp-tieffelin']],
  ['humain', SPECIES_ICONS['sp-humain']],
];

export function getSpeciesIcon(idOrName: string): string {
  const raw = (idOrName ?? '').trim();
  if (!raw) return 'fluent-emoji:bust-in-silhouette';
  const byId = SPECIES_ICONS[raw];
  if (byId) return byId;
  const name = raw.toLowerCase();
  for (const [label, icon] of SPECIES_LABEL_ICONS) {
    if (name.includes(label)) return icon;
  }
  return 'fluent-emoji:bust-in-silhouette';
}
