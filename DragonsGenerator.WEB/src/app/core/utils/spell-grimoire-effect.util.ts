import type { Spell } from '@core/models/Spells/spell';
import { spellComponentsLabel, spellDurationLabel } from './spell-display.util';

/** Corrige les descriptions tronquées (ex. « ous poussez » → « Vous poussez »). */
export function normalizeSpellDescription(description: string): string {
  let text = description.trim();
  if (text.startsWith('ous ')) text = `V${text}`;
  text = text.replace(/\.\s+D Jous\b/g, '. Vous');
  text = text.replace(/\bD Jous\b/g, 'Vous');
  return text;
}

function formatGrimoireComponents(components: Spell['components']): string {
  const parts: string[] = [];
  if (components.v) parts.push('V');
  if (components.s) parts.push('S');
  if (components.m) {
    const mat = components.m.length > 20 ? `${components.m.substring(0, 18)}…` : components.m;
    parts.push(`M(${mat})`);
  }
  return parts.join(',');
}

function formatGrimoireDuration(spell: Pick<Spell, 'duration'>): string {
  const label = spellDurationLabel(spell);
  if (!label || label === '—') return '';
  return label.replace(/^Instantané$/i, 'Instantanée');
}

/** Résumé compact pour la colonne Effet du grimoire PDF. */
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

  const full = parts.join(' | ');
  if (full.length <= 140) return full;
  return `${full.substring(0, 137)}…`;
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
 * Calcule le découpage effet (en-tête + description) et le nombre de lignages consommés.
 * `splitTextToSize` évite les coupures au milieu des mots.
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
