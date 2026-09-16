import type { Spell } from '@core/models/Spells/spell';
import type { SpellInstance } from '@core/models/Character/character';
import { spellDurationLabel } from './spell-display.util';

/** Corrige OCR / artefacts de source (icônes décoratives, titres collés, « Vous » tronqué). */
export function normalizeSpellDescription(description: string): string {
  let text = description.trim();

  // Artefacts OCR des livres sources (alt text d’images).
  text = text.replace(/\bDecorative icons?\b/gi, ' ');
  text = text.replace(/\bSpell icons? for \d+\w*\s+level\s+\w+/gi, ' ');
  text = text.replace(/\bDecorative letter [A-Z]\b[^\n.]*/gi, ' ');
  text = text.replace(/\bDecorative border\b[^\n.]*/gi, ' ');
  text = text.replace(/\bDecorative illustration[^\n.]*/gi, ' ');
  text = text.replace(/\bIllustration of [^\n.]*/gi, ' ');
  text = text.replace(/\bIllustration d['’][^\n.]*/gi, ' ');
  text = text.replace(/\bDiagramme de glyphe\b/gi, ' ');
  text = text.replace(/\bdecorative divider\b/gi, ' ');
  text = text.replace(/Anthony Martin Romero\s*\(Order\s*#\d+\)/gi, ' ');
  text = text.replace(/<page_number>.*?<\/page_number>/gi, ' ');

  // Préfixes OCR restants (logo / stamp / lettre ornée / and icons).
  text = text.replace(
    /^(Logo( de sort)?|Logo,\s*icon,\s*and(\s*stamp)?|stamp|Lettre ornée D|and(\s+icons?)?|icons?)\s+/i,
    '',
  );
  text = text.replace(/\bLogo de sort\b/gi, ' ');
  text = text.replace(/\bLogo,\s*icon,\s*and(\s*stamp)?\b/gi, ' ');
  text = text.replace(/\band\s+icons?\b/gi, ' ');
  text = text.replace(/\bstamp\b/gi, ' ');
  text = text.replace(/\bLettre ornée D\b/gi, ' ');

  // Titres markdown collés au milieu d’un paragraphe.
  text = text.replace(/\s*##\s+/g, '\n\n## ');
  text = text.replace(/\s*###\s+/g, '\n\n### ');

  text = text.replace(/\.\s+D Jous\b/g, '. Vous');
  text = text.replace(/\bD Jous\b/g, 'Vous');
  text = text.replace(/\bV ous\b/g, 'Vous');
  text = text.replace(/\bD ous\b/g, 'Vous');
  text = text.replace(/\bJouhait\b/g, 'Souhait');
  if (text.startsWith('ous ')) text = `V${text}`;
  if (/^D\s+Du\b/.test(text)) text = text.replace(/^D\s+/, '');
  if (/^D\s+Vous\b/.test(text)) text = text.replace(/^D\s+/, '');
  if (/^C\s+Choisissez\b/.test(text)) text = text.replace(/^C\s+/, '');

  text = text.replace(/[ \t]{2,}/g, ' ');
  text = text.replace(/ *\n */g, '\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

function formatGrimoireComponents(components: Spell['components']): string {
  const parts: string[] = [];
  if (components.v) parts.push('V');
  if (components.s) parts.push('S');
  if (components.m) {
    const mat = components.m.length > 24 ? `${components.m.substring(0, 22)}…` : components.m;
    parts.push(`M(${mat})`);
  }
  return parts.join(',');
}

function shortenDurationLabel(label: string): string {
  return label
    .replace(/^Instantané$/i, 'Instantanée')
    .replace(/^(\d+)\s+heure(s)?$/i, '$1 h')
    .replace(/^(\d+)\s+minute(s)?$/i, '$1 min')
    .replace(/^(\d+)\s+round(s)?$/i, '$1 rd')
    .replace(/^(\d+)\s+jour(s)?$/i, '$1 j');
}

function formatGrimoireDuration(spell: Pick<Spell, 'duration'>): string {
  const label = spellDurationLabel(spell);
  if (!label || label === '—') return '';
  return shortenDurationLabel(label);
}

/** Résumé pour la colonne Effet — description complète (césure PDF, pas troncature ici). */
export function buildGrimoireEffectSummary(spell: Spell): string {
  const parts: string[] = [];

  const comp = formatGrimoireComponents(spell.components);
  if (comp) parts.push(comp);

  const dur = formatGrimoireDuration(spell);
  if (dur) parts.push(dur);

  if (spell.description) {
    const normalized = normalizeSpellDescription(spell.description);
    const firstSentence = `${normalized.split(/\.\s/)[0]}.`;
    parts.push(firstSentence);
  }

  return parts.join(' | ');
}

/** Sépare composants/durée (ligne 1) et description (lignes suivantes). */
export function splitEffectForGrimoire(summary: string): { header: string; body: string } {
  const parts = summary
    .split(' | ')
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 3) {
    return { header: `${parts[0]} · ${parts[1]}`, body: parts.slice(2).join(' ') };
  }
  if (parts.length === 2) {
    return { header: parts[0], body: parts[1] };
  }
  return { header: '', body: summary.trim() };
}

export interface GrimoireEffectLayout {
  header: string;
  body: string;
  headerLines: string[];
  bodyLines: string[];
  rowsNeeded: number;
}

/**
 * Calcule le découpage effet et le nombre de lignages consommés.
 * `splitTextToSize` (jsPDF, bonne police) évite les coupures au milieu des mots.
 */
export function layoutGrimoireEffect(
  summary: string,
  splitTextToSize: (text: string, maxWidth: number) => string[],
  effectWidthMm: number,
  maxBodyLines = 2,
): GrimoireEffectLayout {
  const { header, body } = splitEffectForGrimoire(summary);
  const bodyTrim = body.trim();

  if (!bodyTrim) {
    const headerLines = header ? splitTextToSize(header, effectWidthMm) : [''];
    return {
      header,
      body: '',
      headerLines,
      bodyLines: [],
      rowsNeeded: Math.max(1, headerLines.length),
    };
  }

  const headerLines = header ? splitTextToSize(header, effectWidthMm) : [];
  const bodyLines = splitTextToSize(bodyTrim, effectWidthMm).slice(0, maxBodyLines);

  const singleLine = [header, bodyTrim].filter(Boolean).join(' · ');
  if (singleLine.length <= 52 && headerLines.length <= 1 && bodyLines.length <= 1) {
    const compact = splitTextToSize(singleLine, effectWidthMm);
    return {
      header: singleLine,
      body: '',
      headerLines: compact,
      bodyLines: [],
      rowsNeeded: Math.max(1, compact.length),
    };
  }

  return {
    header,
    body: bodyTrim,
    headerLines,
    bodyLines,
    rowsNeeded: Math.max(1, headerLines.length + bodyLines.length),
  };
}

export interface GrimoireSpellPlacement {
  spell: SpellInstance;
  startRow: number;
  layout: GrimoireEffectLayout;
}

export interface GrimoireTablePlan {
  placements: GrimoireSpellPlacement[];
  overflow: SpellInstance[];
}

/** Planifie les sorts sur un tableau à lignages limités (page principale ou supp). */
export function planGrimoireTable(
  spells: SpellInstance[],
  splitTextToSize: (text: string, maxWidth: number) => string[],
  effectWidthMm: number,
  maxRows: number,
  maxBodyLines = 2,
): GrimoireTablePlan {
  const placements: GrimoireSpellPlacement[] = [];
  let row = 0;

  for (let i = 0; i < spells.length; i++) {
    const spell = spells[i];
    let layout = layoutGrimoireEffect(
      spell.effectSummary ?? '',
      splitTextToSize,
      effectWidthMm,
      maxBodyLines,
    );
    if (row + layout.rowsNeeded > maxRows) {
      // Premier sort trop haut pour la page : on le force tronqué plutôt que de le perdre.
      if (placements.length === 0 && maxRows > 0) {
        layout = truncateGrimoireLayout(layout, maxRows);
        placements.push({ spell, startRow: 0, layout });
        return { placements, overflow: spells.slice(1) };
      }
      return { placements, overflow: spells.slice(i) };
    }
    placements.push({ spell, startRow: row, layout });
    row += layout.rowsNeeded;
  }

  return { placements, overflow: [] };
}

/** Tronque un layout pour tenir dans `maxRows` lignages. */
export function truncateGrimoireLayout(
  layout: GrimoireEffectLayout,
  maxRows: number,
): GrimoireEffectLayout {
  const cap = Math.max(1, maxRows);
  const headerLines = layout.headerLines.slice(0, cap);
  const remaining = Math.max(0, cap - headerLines.length);
  const bodyLines = layout.bodyLines.slice(0, remaining);
  return {
    ...layout,
    headerLines,
    bodyLines,
    rowsNeeded: Math.max(1, headerLines.length + bodyLines.length),
  };
}

/** Découpe une liste de sorts overflow en pages supplémentaires. */
export function paginateGrimoireOverflow(
  spells: SpellInstance[],
  splitTextToSize: (text: string, maxWidth: number) => string[],
  effectWidthMm: number,
  maxRowsPerPage: number,
  maxBodyLines = 3,
): GrimoireTablePlan[] {
  const pages: GrimoireTablePlan[] = [];
  let queue = spells;

  while (queue.length) {
    const plan = planGrimoireTable(
      queue,
      splitTextToSize,
      effectWidthMm,
      maxRowsPerPage,
      maxBodyLines,
    );
    if (!plan.placements.length) {
      // Sécurité : ne jamais abandonner silencieusement le reste de la file.
      const spell = queue[0];
      const layout = truncateGrimoireLayout(
        layoutGrimoireEffect(
          spell.effectSummary ?? '',
          splitTextToSize,
          effectWidthMm,
          maxBodyLines,
        ),
        Math.max(1, maxRowsPerPage),
      );
      pages.push({
        placements: [{ spell, startRow: 0, layout }],
        overflow: [],
      });
      queue = queue.slice(1);
      continue;
    }
    pages.push({ placements: plan.placements, overflow: [] });
    if (!plan.overflow.length) break;
    queue = plan.overflow;
  }

  return pages;
}
